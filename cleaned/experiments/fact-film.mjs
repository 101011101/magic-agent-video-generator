// A film from a true subject: brief → research gate (small, cheap call) → research round (web search) when the gate is not
// confident → story written only from the facts → screenplay → master element table → asset bank: real things are REFERENCED
// from Wikimedia Commons (photos, portraits, engravings, with provenance), only things with no record are generated → keyframes
// for the first scenes → state manager picks the images per frame → state table + page. Nothing is painted for the frames.
// Usage: CLEANED_CAP=… node cleaned/experiments/fact-film.mjs --brief "…" --label vanderbilt --scenes 2
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { jsonCall, S, usage } from "../src/llm.js";
import { Jobs } from "../src/jobs.js";
import { writeScreenplay, screenplayText } from "../src/screenplay.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const brief = opt("--brief", "An interesting true fact about Cornelius Vanderbilt, as a 30-second live-action film."), label = opt("--label", "vanderbilt"), nScenes = Number(opt("--scenes", 2));
const dir = join(RUNS, `exp-${label}`); for (const d of ["", "refs", "roots", "page"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json"), run = { name: `exp-${label}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), say = (m) => console.log(m), t0 = Date.now();
Object.assign(L, { brief, started_at: new Date().toISOString() });

// 1. Gate: does this brief need research? A cheap, low-effort call.
L.gate ??= await jsonCall({ name: "research-gate", effort: "low", schema: S.obj({ needs_research: S.bool, confidence: S.int, why: S.str, queries: S.arr(S.str) }),
  prompt: `A short film will be written from this brief. Decide whether writing it ACCURATELY needs research first: real people, places, events, dates, or objects whose look is on record (then research is needed), versus a made-up story where invention is fine.
needs_research; confidence: 0-100 that no research is needed; why: one line; queries: 2-5 web searches that would settle the facts and the documented looks (empty if none).
Brief: ${brief}` });
say(`gate: needs_research=${L.gate.needs_research} (confidence no research needed: ${L.gate.confidence}) · ${L.gate.why}`);
run.save();

// 2. Research round: facts with sources, and the documented look of the real things.
if (L.gate.needs_research && !L.research) {
  say("research…");
  L.research = await jsonCall({ name: "research", effort: "medium", tools: [{ type: "web_search" }],
    schema: S.obj({ subject: S.str, facts: S.arr(S.obj({ n: S.int, fact: S.str, when: S.str, source: S.str })), looks: S.arr(S.obj({ thing: S.str, look: S.str, source: S.str })) }),
    prompt: `Research for a short factual film. Brief: ${brief}
Suggested searches: ${L.gate.queries.join(" · ")}
Use web search. Return:
- facts: 6-10 verified facts, numbered, each with its date and the URL it comes from, around ONE interesting true episode that could be shown on screen in 30 seconds (who, where, what happened, what it led to).
- looks: the documented LOOK of every real person, place, vessel, building or object involved (appearance, age at the time, clothing, vessel type and rig, building style) with a source URL each. Only what the sources say; no invention.` });
  run.save();
}
const facts = L.research?.facts || [];
say(`facts: ${facts.length}; looks: ${L.research?.looks?.length || 0}`);

// 3. Story, from the facts only.
if (!L.story) {
  say("story…");
  L.story = await jsonCall({ name: "fact-story", effort: "high", schema: S.obj({ title: S.str, style: S.str, story: S.str, fact_use: S.arr(S.str) }),
    prompt: `Write the story of a 30-second live-action film from this brief: ${brief}
Use ONLY the facts below (and the documented looks). Every sentence must be supported by a numbered fact; add no invented event, line of dialogue, or object. Pick one episode and show it on screen, in order, in plain prose, 120-200 words; name the real people, places, vessels and years concretely as the facts give them.
- title; style: one line of visual style (live-action, period-accurate, documentary realism; camera; light).
- story; fact_use: one entry per paragraph, "paragraph N: facts a, b".
Facts:
${facts.map((f) => `${f.n}. (${f.when}) ${f.fact} [${f.source}]`).join("\n")}
Documented looks:
${(L.research?.looks || []).map((l) => `- ${l.thing}: ${l.look} [${l.source}]`).join("\n")}` });
  run.save();
}
say(`story: ${L.story.title}`);

// 4. Screenplay (the same call as the pipeline's).
if (!L.screenplay) { say("screenplay…"); L.screenplay = await writeScreenplay(L.story.story); writeFileSync(join(dir, "screenplay.txt"), `${L.screenplay.title.toUpperCase()}\n\n${screenplayText(L.screenplay)}`); run.save(); }
const sp = L.screenplay;
say(`screenplay: ${sp.scenes.length} scenes`);

// 5. Master element table.
if (!L.elements) {
  say("elements…");
  const EL = S.obj({ id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, name: S.str, aka: S.str, kind: S.enum(["character", "prop", "place", "fixture"]), real: S.bool, searches: S.arr(S.str), look: S.str, scenes: S.arr(S.int) });
  L.elements = (await jsonCall({ name: "elements", effort: "medium", schema: S.obj({ elements: S.arr(EL) }),
    prompt: `List every element of this screenplay that must look the same every time it is drawn: characters, movable props, one place per distinct scene heading, and fixtures (fixed things of a place that the action uses).
For each: id (short, lowercase); name (as the screenplay calls it); aka: its common modern name if different ("White House" for the Executive Mansion), else ""; kind; real: true if it is a specific real person, place, vessel, building or object whose look is documented (photos, portraits, engravings exist), false if generic; searches: 2-4 Wikimedia Commons search strings that would find a picture of the real thing, from specific to plain (e.g. "White House 1860s", "Abraham Lincoln portrait 1862"); empty if not real; look: one line of what never changes about it (build, face, clothing of the period, material, rig, style), never a state; scenes: the scene numbers it appears in.
Documented looks from research:
${(L.research?.looks || []).map((l) => `- ${l.thing}: ${l.look}`).join("\n")}

Screenplay:
${screenplayText(sp)}` })).elements;
  run.save();
}
const els = L.elements, byId = Object.fromEntries(els.map((e) => [e.id, e]));
say(`elements: ${els.length} (${els.filter((e) => e.real).length} real)`);

// 6. Asset bank. Real things: Wikimedia Commons search → candidates → one vision pick. Others: generated (characters, places) or text.
// Style is state (PRD §4b): the treatment names colour or monochrome once, so plates made apart cannot drift to sepia. A run whose
// cached medium predates it keeps its wording (every frame prompt hashes on it) and only gains the treatment.
if (!L.medium?.treatment) L.medium = { ...(await jsonCall({ name: "medium", effort: "low", schema: S.obj({ person: S.str, object: S.str, place: S.str, cell: S.str, frame: S.str, treatment: S.str }),
  prompt: `From this visual style line, write the MEDIUM as noun phrases a prompt can start with, nothing about scenes, colours or light:
person: a full-length picture of one person in this medium ("A studio photograph of a real person"); object: the same for one object; place: the same for an empty place, ending in "of"; cell: what one still frame of the story IS, as a noun phrase, never "footage"; frame: one closing sentence for a story frame naming the medium and camera.
treatment: the one line that does name colour: one sentence, ending in a full stop, stating explicitly colour or monochrome, grain, contrast and finish, which every image prompt of the film begins with ("Full colour, fine film grain, natural contrast, no sepia or black-and-white."); when the style line is silent, a live-action film is full colour.
Style: ${L.story.style}` })), ...L.medium };
const UA = "magic-agent-video-generator/0.1 (research pipeline; contact via repository)";
async function commons(q, n = 6) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024`;
  const r = await fetch(url, { headers: { "user-agent": UA } }).then((x) => x.json()).catch(() => ({}));
  return Object.values(r.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => ({ title: p.title, ...(p.imageinfo?.[0] || {}) }))
    .filter((p) => /image\/(jpeg|png)/.test(p.mime || "")).map((p) => ({ title: p.title, thumb: p.thumburl, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, license: p.extmetadata?.LicenseShortName?.value || "", date: (p.extmetadata?.DateTimeOriginal?.value || "").replace(/<[^>]+>/g, "").slice(0, 40), artist: (p.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 60) }));
}
// Search strings, pooled: the model's (specific to plain), then "<name> portrait" / "<name> photograph", then the bare name.
// ("Cornelius Vanderbilt portrait 1860 1865" found nothing; "Cornelius Vanderbilt portrait" finds the daguerreotypes.)
const plain = (e) => e.name.replace(/\s*\(.*?\)\s*/g, " ").split(/\s[—–-]\s/)[0].trim();
const year = facts.map((f) => (String(f.when).match(/\b1[5-9]\d\d\b|\b20\d\d\b/) || [])[0]).filter(Boolean)[0], decade = year ? `${Math.floor(Number(year) / 10) * 10}s` : "";
const searches = (e) => { const names = [...new Set([e.aka, plain(e)].filter(Boolean))]; return [...new Set([...(e.searches || [e.search]).filter(Boolean), ...names.flatMap((n) => (e.kind === "character" ? [`${n} portrait`, `${n} photograph`] : [`${n} ${decade}`, `${n} photograph`, `${n} ${decade} photograph`])), ...names])]; };
async function download(url, file) { const r = await fetch(url, { headers: { "user-agent": UA } }); if (!r.ok) throw new Error(`download ${r.status}`); writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; }
L.bank ??= {};
// Style is state (PRD §4b): places go first, in scene order, and the first generated plate becomes the style reference every later
// plate is edited against (a Commons photo is a record of the place, not the film's treatment). Kept once set, so a resumed run
// matches the same plate; null when no plate is generated.
const order = [...els.filter((e) => e.kind === "place").sort((a, b) => Math.min(...a.scenes, 99) - Math.min(...b.scenes, 99)), ...els.filter((e) => e.kind !== "place")];
L.style_ref ??= null;
for (const e of order) {
  if (e.kind === "place" && L.bank[e.id]?.source === "generated") L.style_ref ??= L.bank[e.id].file;   // a plate kept from an earlier run still sets it
  if (L.bank[e.id] && !(e.real && L.bank[e.id].source !== "commons")) continue;   // a real thing that had to be generated is retried on Commons
  if (e.real) {
    // Pool candidates across the search strings (deduplicated by title) up to 10, so one vision call sees them all.
    const cands = [], seen = new Set(), used = [];
    for (const q of searches(e)) { const got = await commons(q, 6); let n = 0; for (const c of got) if (!seen.has(c.title) && cands.length < 10) { seen.add(c.title); cands.push(c); n++; } if (n) used.push(q); if (cands.length >= 8) break; }
    const files = [];
    for (const [i, c] of cands.entries()) { const f = `refs/${e.id}-${i + 1}.jpg`; try { await download(c.thumb, run.path(f)); files.push({ ...c, file: f }); } catch {} }
    if (files.length) {
      const pick = await jsonCall({ name: "ref-pick", effort: "low", images: files.map((f) => run.path(f.file)), schema: S.obj({ pick: S.int, why: S.str }),
        prompt: `Images 1 to ${files.length} are candidates for the reference picture of ${e.name} (${e.kind}; ${e.look}) in a period-accurate film. Candidates, in order: ${files.map((f, i) => `${i + 1}: "${f.title}" (${f.date || "date unknown"})`).join("; ")}.
pick: the number of the best one, a clear depiction of this exact thing itself (a portrait or photograph of the person, the vessel, the building; a period engraving or painting is fine), not a map, a page of text, a statue, a modern replica or something else named after it; 0 if none qualifies. why: short.` });
      const p = pick.pick >= 1 && pick.pick <= files.length ? files[pick.pick - 1] : null;
      if (p) { L.bank[e.id] = { source: "commons", file: p.file, title: p.title, page: p.page, license: p.license, date: p.date, artist: p.artist, why: pick.why, candidates: files.length, search: used.join(" + ") }; say(`  ${e.id}: Commons → ${p.title} (${p.date || "?"}) via ${used.map((q) => `"${q}"`).join(", ")}`); run.save(); continue; }
      say(`  ${e.id}: Commons gave ${files.length} candidates for ${used.map((q) => `"${q}"`).join(", ")}, none usable (${pick.why})`);
    } else say(`  ${e.id}: nothing on Commons for ${searches(e).map((q) => `"${q}"`).join(", ")}`);
    if (L.bank[e.id]) { say(`  ${e.id}: keeping the generated one`); continue; }
  }
  if (e.kind === "character" || e.kind === "place") {
    const file = `roots/${e.id}.png`, ref = e.kind === "place" && L.style_ref ? [L.style_ref] : [];   // a later plate is an edit against the style reference
    const prompt = e.kind === "character"
      ? `${L.medium.treatment} ${L.medium.person}, full length. The person: ${e.look}\nStanding, front view, neutral pose, arms relaxed, whole figure visible head to feet.\nPlain light-grey seamless studio backdrop, soft even light, nothing else in the picture; no text.`
      : `${L.medium.treatment} ${ref.length ? "Match the colour treatment, grain and contrast of image 1 exactly; the place itself is described below, not taken from image 1.\n" : ""}${L.medium.place} ${e.name}, empty of people, one single image. ${e.look} Period-accurate in every detail. No text or labels.`;
    await jobs.image(`root-${e.id}`, file, prompt, ref);
    L.bank[e.id] = { source: "generated", file, prompt, ...(ref.length ? { style_ref: ref[0] } : {}) }; say(`  ${e.id}: generated (${e.kind}${ref.length ? ", against the style reference" : ""})`);
    if (e.kind === "place") L.style_ref ??= file;
    run.save();
  } else { L.bank[e.id] = { source: "text", look: e.look }; say(`  ${e.id}: text only`); run.save(); }
}

// 7. Keyframes for the first scenes: first frame = what goes into the plate; one resting state per action, quoting its line.
const KEY = S.obj({ n: S.int, source: S.str, state: S.str, positions: S.str, enters: S.arr(S.str), leaves: S.arr(S.str) });
L.keyframes ??= {};
for (let k = 1; k <= Math.min(nScenes, sp.scenes.length); k++) {
  if (L.keyframes[k]) continue;
  const sc = sp.scenes[k - 1], place = els.find((e) => e.kind === "place" && e.scenes.includes(k)) || els.find((e) => e.kind === "place");
  const chars = els.filter((e) => e.kind === "character"), props = els.filter((e) => e.kind === "prop" || e.kind === "fixture");
  L.keyframes[k] = await jsonCall({ name: "keyframes", effort: "medium", schema: S.obj({ present: S.arr(S.str), first: S.str, keyframes: S.arr(KEY) }),
    prompt: `You are the storyboard artist. Turn ONE scene of a live-action film into keyframes for an image editor that makes each frame by editing the frame before it. Image 1 of the first frame is a picture of the empty place; the people's looks come from their reference pictures.
The scene is continuous: one place, one fixed camera, no cuts. Nothing enters or leaves unless the text says so.
Blocking is continuous too: every state says where each character stands relative to the others and which way they face, and nobody crosses anyone unless the line says so.
Write:
- present: the ids of the characters and props in the first frame.
- first: ONLY what is put into the empty place for the first frame: each character by id, where they stand and what they do; each prop and its state. Do not describe the place itself.
- keyframes: ONE keyframe per action line, never several frames for one action, none for a line that only describes the state. Each is the RESTING state that results, in one or two sentences (who holds what, what lies where, who looks where, counts); nothing mid-air unless the text says so; no verbs of motion. Only what the text contains. source: the line it comes from, quoted. positions: one clause per character: where they stand relative to the others and facing which way. enters / leaves: ids that come into or go out of the picture.
Place: ${place?.name || sc.place}: ${place?.look || ""}
Characters (ids): ${chars.map((c) => `${c.id} = ${c.name}`).join(", ")}
Props and fixtures (ids): ${props.map((p) => `${p.id} = ${p.name}`).join(", ")}

Scene ${k}: ${sc.inside ? "INT." : "EXT."} ${sc.place} — ${sc.time}
${sc.beats.map((b, i) => `${i + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n")}` });
  run.save();
}

// 8. State manager: the images each frame gets. Frame 1: the place's reference + one picture per character present. Frame k: the
// previous frame (+ a picture for whoever enters). Rows = the state table.
const rows = [], last = {};
for (let k = 1; k <= Math.min(nScenes, sp.scenes.length); k++) {
  const sc = sp.scenes[k - 1], kf = L.keyframes[k], place = els.find((e) => e.kind === "place" && e.scenes.includes(k)) || els.find((e) => e.kind === "place");
  const pic = (id) => L.bank[id]?.file ? { id, file: L.bank[id].file, source: L.bank[id].source } : null;
  const base = last[place?.id] ? { role: "previous frame of this place", ...last[place.id] } : { role: "place reference", id: place?.id, ...(pic(place?.id) || {}) };
  const present = new Set(kf.present.filter((id) => byId[id]));
  const chars = [...present].filter((id) => byId[id].kind === "character").map(pic).filter(Boolean);
  // Style is state (PRD §4b): a first frame painted onto a plate that is not the style reference gets the reference as its last
  // image; the reference plate itself, and a previous frame, already carry the treatment, and later frames inherit it.
  const style = base.role === "place reference" && L.style_ref && base.file !== L.style_ref ? { role: "style reference", id: els.find((e) => L.bank[e.id]?.file === L.style_ref)?.id, file: L.style_ref } : null;
  const named = [...chars.map((c, i) => `Image ${i + 2} is ${byId[c.id].name}: the same person, same face and clothes of the period; the pose and background of that picture do not apply.`), ...(style ? [`Image ${chars.length + 2} matches the colour treatment, grain and contrast every frame must have.`] : [])].join(" ");
  const first = `Image 1 is ${base.role === "place reference" ? `the empty place, ${place?.name}` : "this place as it was last seen"}. ${named} ${base.role === "place reference" ? "Put this moment into image 1, keeping its place, camera, light and colours exactly:" : "Edit image 1 into this moment; the place, camera, light and colours stay exactly as in image 1:"}\n${kf.first}\n${L.medium.frame} One single frame, no text.`;
  rows.push({ scene: k, frame: 1, place: place?.id, present: [...present], inputs: [{ role: base.role, id: base.id, file: base.file, source: base.source }, ...chars.map((c) => ({ role: "character reference", ...c })), ...(style ? [style] : [])], prompt: first, source: "scene opening" });
  let prevId = `s${k}-f1`;
  kf.keyframes.forEach((f, i) => {
    for (const id of f.leaves || []) present.delete(id);
    const entering = (f.enters || []).filter((id) => byId[id]); for (const id of entering) present.add(id);
    const refs = entering.filter((id) => byId[id].kind === "character").map(pic).filter(Boolean);
    const add = refs.map((c, j) => ` Image ${j + 2} is ${byId[c.id].name}, entering: the same person, same face and clothes.`).join("");
    rows.push({ scene: k, frame: i + 2, place: place?.id, present: [...present], inputs: [{ role: "previous frame", id: prevId }, ...refs.map((c) => ({ role: "character reference", ...c }))], prompt: `Edit image 1. Change ONLY this: ${f.state}${f.positions ? ` ${f.positions}` : ""}${add} Everything not named stays as in image 1.\n${L.medium.frame} One single frame, no text.`, source: f.source });   // keyframes cached before `positions` existed have none
    prevId = `s${k}-f${i + 2}`;
  });
  if (place) last[place.id] = { id: prevId };
}
L.state_table = rows;
L.summary = { credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save();

// 9. Page.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const img = (f) => { if (!f) return ""; const j = `page/${f.replace(/[\/]/g, "-").replace(/\.png$/, ".jpg")}`; if (!existsSync(run.path(j))) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(f), "-vf", "scale='min(1000,iw)':-1", "-q:v", "5", run.path(j)]); return j.slice(5); };
const bankHtml = els.map((e) => { const b = L.bank[e.id] || {}; return `<div class="asset"><h4>${esc(e.name)} <span class="mut">${e.id} · ${e.kind}${e.real ? " · real" : ""}</span></h4>${b.file ? `<img src="${img(b.file)}" alt="${esc(e.name)}">` : ""}<p class="mut">${b.source === "commons" ? `Wikimedia Commons: <a href="${b.page}">${esc(b.title)}</a> · ${esc(b.date || "")} ${esc(b.artist || "")} · ${esc(b.license)}<br>${esc(b.why)}` : b.source === "generated" ? `generated (no record to reference)` : `text only: ${esc(b.look)}`}</p><p class="mut">look: ${esc(e.look)}</p></div>`; }).join("");
const stateHtml = `<table><tr><th>scene</th><th>frame</th><th>place</th><th>present</th><th>inputs (what the editor is given)</th><th>from</th></tr>${rows.map((r) => `<tr><td>${r.scene}</td><td>${r.frame}</td><td>${esc(r.place)}</td><td>${r.present.join(", ")}</td><td>${r.inputs.map((i) => `${esc(i.role)}${i.id ? `: ${esc(i.id)}` : ""}${i.source ? ` (${i.source})` : ""}`).join("<br>")}</td><td>${esc(r.source)}</td></tr>`).join("")}</table>`;
const promptsHtml = rows.map((r) => `<details${r.frame === 1 ? " open" : ""}><summary>scene ${r.scene} · frame ${r.frame} · inputs: ${r.inputs.map((i) => esc(i.id || i.role)).join(", ")}</summary><pre>${esc(r.prompt)}</pre></details>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(L.story.title)}</title>
<style>:root{--bg:#f4f5f2;--panel:#fff;--fg:#1c211e;--mut:#5f6863;--line:#dbe0dc;--mono:ui-monospace,Menlo,monospace}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}}:root[data-theme="dark"]{--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1150px;margin:0 auto;padding:16px;display:grid;gap:16px}h1{font-size:22px;margin:0}h2{font-size:17px;margin:0}h4{margin:0;font-size:14px}.mut{color:var(--mut);font-size:13px;font-weight:400}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px}img{width:100%;border-radius:6px;border:1px solid var(--line);display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.asset{display:grid;gap:6px;align-content:start}pre{margin:0;padding:10px;background:var(--bg);border:1px solid var(--line);border-radius:6px;font:12.5px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:5px 7px;border-bottom:1px solid var(--line);vertical-align:top}th{font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}details summary{cursor:pointer;color:var(--mut);font-size:13px}a{color:inherit}</style></head><body><main>
<h1>${esc(L.story.title)}</h1><p class="mut">Brief: ${esc(brief)}</p>
<section class="card"><h2>1. Research gate</h2><p>needs research: <strong>${L.gate.needs_research}</strong> (confidence that none is needed: ${L.gate.confidence}/100) — ${esc(L.gate.why)}</p><p class="mut">queries: ${L.gate.queries.map(esc).join(" · ")}</p></section>
${L.research ? `<section class="card"><h2>2. Research round (web search)</h2><p class="mut">${esc(L.research.subject)}</p><ol>${facts.map((f) => `<li>(${esc(f.when)}) ${esc(f.fact)} <a href="${esc(f.source)}">source</a></li>`).join("")}</ol><h4>Documented looks</h4><ul>${(L.research.looks || []).map((l) => `<li><strong>${esc(l.thing)}</strong>: ${esc(l.look)} <a href="${esc(l.source)}">source</a></li>`).join("")}</ul></section>` : ""}
<section class="card"><h2>3. Story</h2><p class="mut">style: ${esc(L.story.style)}</p>${L.story.story.split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join("")}<p class="mut">${L.story.fact_use.map(esc).join(" · ")}</p></section>
<section class="card"><h2>4. Screenplay</h2><pre>${esc(screenplayText(sp))}</pre></section>
<section class="card"><h2>5. Master element table and asset bank</h2><p class="mut">Real things are referenced from Wikimedia Commons (chosen by one vision call among the search results); things with no record are generated; the rest are text.</p><div class="grid">${bankHtml}</div></section>
<section class="card"><h2>6. State table: scenes ${rows.length ? `1–${Math.min(nScenes, sp.scenes.length)}` : ""}, frame by frame</h2>${stateHtml}</section>
<section class="card"><h2>7. Frame prompts as the chain would send them</h2>${promptsHtml}</section>
<p class="mut">${esc(JSON.stringify(L.summary))}</p>
</main></body></html>`;
writeFileSync(join(dir, "page", "index.html"), html);
say(`done: ${JSON.stringify(L.summary)} · page: ${join(dir, "page", "index.html")}`);
