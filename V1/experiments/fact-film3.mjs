// Story → SHOOTING SCRIPT (one call) → prompts by code → stills → clips → film. Nothing after the script is written by a
// model: still prompts and clip prompts are transcriptions of it (src/prompts.js + a KF variant in src/kf/), and the script
// is checked in code (src/script.js) before anything is paid. Without --build the run stops after writing the script, the
// checks, the cast lines and every assembled prompt, so they can be inspected first.
// KF variants: the still template is src/kf/<id>.js (--kf kf1). Everything a variant makes lives under runs/exp-<label>/<kf>/
// (frames.txt, clips.txt, page/, stills/, clips/) next to a copy of the template files that made it, so variants of the
// same script can be compared side by side. The script, the cast lines and the bank are shared by all variants.
// Usage: CLEANED_CAP=… node V1/experiments/fact-film3.mjs --from vanderbilt2 --label vanderbilt5 [--kf kf1] [--total 30] [--max 15] [--model wan-3.0] [--still nano-banana-pro] [--reactions] [--build [--stills] [--shot N] [--subtitles] [--retry s1-3,clip-2] [--accept s1-3,clip-2]] [--parallel 3]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, ROOT, key } from "../src/env.js";
import { jsonCall, S, usage } from "../src/llm.js";
import { Jobs, VIDEO, COST } from "../src/jobs.js";
import { writeScript, checkScript, scriptText, inFrame } from "../src/script.js";
import { planStills, clipPrompt, policySafe } from "../src/prompts.js";
import { check } from "../src/clips.js";
import { captionCard, burnCaptions, subtitlesFromScript } from "../src/captions.js";
import { State } from "../src/state.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "vanderbilt2"), label = opt("--label", "vanderbilt5"), KFID = opt("--kf", "kf1"), TOTAL = Number(opt("--total", 30)), MAX = Number(opt("--max", 15)), model = opt("--model", "wan-3.0"), STILL = opt("--still", "nano-banana-pro"), BUILD = args.includes("--build"), PAR = Number(opt("--parallel", 3));
const REACTIONS = args.includes("--reactions");   // paint expression-only end frames as their own stills (default: the clip carries them)
const ONLY = Number(opt("--shot", 0));            // build one shot only: its stills (and the stills they chain from) and its clip; no stitch
// Gates flag, they never remake. A flagged still or clip stays for review; --retry s1-3,clip-2 remakes those (and whatever was
// built on a retried still); --accept s1-3,clip-2 keeps them as they are. The build stops before clips while a still is
// flagged, and before the stitch while a clip is flagged.
const RETRY = (opt("--retry", "") || "").split(",").filter(Boolean), ACCEPT = (opt("--accept", "") || "").split(",").filter(Boolean), RECHECK = (opt("--recheck", "") || "").split(",").filter(Boolean);   // --recheck s1-3: run the gates again on the still as painted (after a gate was refined), no painting
const KF = await import(`../src/kf/${KFID}.js`);
const src = JSON.parse(readFileSync(join(RUNS, `exp-${from}`, "run.json"), "utf8"));
const dir = join(RUNS, `exp-${label}`), kdir = join(dir, KFID);
for (const d of ["refs", "roots"]) mkdirSync(join(dir, d), { recursive: true });
for (const d of ["", "stills", "clips", "page"]) mkdirSync(join(kdir, d), { recursive: true });
const logFile = join(dir, "run.json"), run = { name: `exp-${label}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), say = (m) => console.log(m), t0 = Date.now(), salt = label;
const kp = (f) => `${KFID}/${f}`;   // a run-relative path inside the variant's directory

// 0. From the source run: brief, research, story, elements, medium, bank (files copied). Nothing after the story is reused.
for (const k of ["brief", "gate", "research", "story", "elements", "medium"]) L[k] ??= src[k];
L.bank ??= src.bank;
for (const b of Object.values(L.bank)) if (b.file && !existsSync(run.path(b.file))) copyFileSync(join(RUNS, `exp-${from}`, b.file), run.path(b.file));
const els = L.elements, byId = Object.fromEntries(els.map((e) => [e.id, e])), chars = els.filter((e) => e.kind === "character" && L.bank[e.id]?.file);

// 1. The state manager's place table (what each plate actually contains, one vision call per plate, once per run), then the
// shooting script, one call, staged around those fixtures, then the code checks. Shared by every KF variant.
const state = new State({ els, bank: L.bank, features: {}, log: L, run });
await state.describePlaces();
say(`places: ${els.filter((e) => e.kind === "place").map((p) => `${p.id}: ${L.places[p.id]?.fixtures ? `${L.places[p.id].walls}; ${L.places[p.id].fixtures.map((f) => `${f.detail || f.name} (${f.side}, ${f.depth})`).join("; ")}` : "no plate described"}`).join("\n        ")}`);
if (!L.script) { say("shooting script…"); L.script = await writeScript({ story: L.story.story, elements: els, total: TOTAL, max: MAX, model, salt, seen: L.places }); run.save(); }
const text = scriptText(L.script, els, { total: TOTAL });
writeFileSync(run.path("shooting-script.txt"), text); say(text);
const checks = checkScript(L.script, { total: TOTAL, max: MAX, model, elements: els }); L.script_checks = checks; run.save();
say(`\nchecks: ${checks.errors.length ? `ERRORS\n  ${checks.errors.join("\n  ")}` : "timing contiguous and on the grid, every element in every frame, thirds consistent, beats inside their shots"}${checks.notes.length ? `\nnotes:\n  ${checks.notes.join("\n  ")}` : ""}`);

// 2. Cast: how each person is named in every prompt (one vision call per portrait) and how each voice is performed (one call).
// Identity facts, not creative: no salt, so they are shared across runs.
L.features ??= {};
for (const c of chars) {
  if (L.features[c.id]) continue;
  L.features[c.id] = (await jsonCall({ name: "cast-features", effort: "low", images: [run.path(L.bank[c.id].file)], schema: S.obj({ features: S.str }),
    prompt: `This is the reference picture of ${c.name}. In at most 15 words, the telling features that tell this person from others in the same film (hair colour and style, beard or whiskers or clean-shaven, glasses, build). No clothes, no expression.` })).features;
}
L.voices ??= await jsonCall({ name: "voice-cast-desc", effort: "low", schema: S.obj(Object.fromEntries(chars.map((c) => [c.id, S.str]))),
  prompt: `For each character, one line describing the voice for a video model to perform (pitch, pace, accent, timbre), from what the record says where it says anything (Lincoln's voice was high and reedy), else plausible for the person's age and origin:\n${chars.map((c) => `- ${c.id}: ${c.name}. ${(L.research?.looks || []).filter((l) => l.thing.toLowerCase().includes(c.name.split(" ").pop().toLowerCase())).map((l) => l.look).join(" ")}`).join("\n")}` });
run.save(); state.features = L.features;
say(`\ncast: ${chars.map((c) => `${c.id}: ${L.features[c.id]}`).join(" · ")}`);

// 3. The plan, by code, for this KF variant: the distinct stills with their prompts and references, and the clip prompts.
// The template files that made it are copied next to the outputs.
L.kf ??= {}; const K = L.kf[KFID] ??= { name: KF.KF.name };
for (const f of [`kf/${KFID}.js`, "prompts.js", "script.js"]) copyFileSync(join(ROOT, "src", f), join(kdir, f.split("/").pop()));
writeFileSync(join(kdir, "README.txt"), `${KFID}: ${KF.KF.name}\nmade ${new Date().toISOString()} by: node V1/experiments/fact-film3.mjs ${args.join(" ")}\n${KFID}.js is the still template, prompts.js the plan, clip template and helpers, script.js the shooting-script stage, all as they were when this variant was generated. frames.txt and clips.txt hold every assembled prompt; stills/, clips/ and page/ the build. The script itself (../shooting-script.txt) and the cast lines (../run.json) are shared by every variant.\n`);
const plan = planStills(L.script, { reactions: REACTIONS }), scene = (n) => L.script.scenes.find((x) => x.n === n);
const stillById = (id) => (id ? plan.stills.find((x) => x.id === id) || null : null);
for (const s of plan.stills) Object.assign(s, KF.stillPrompt({ still: s, env: stillById(s.env), prev: stillById(s.prev), scene: scene(s.scene), els, features: L.features, medium: L.medium, state }));
const clips = L.script.scenes.flatMap((sc) => sc.shots.map((h) => ({ n: h.n, scene: sc.n, seconds: h.seconds, start: plan.byShot[h.n].start, end: plan.byShot[h.n].end, prompt: clipPrompt({ shot: h, scene: sc, els, voices: L.voices, features: L.features }) })));
K.plan = { stills: plan.stills.map(({ key, ...s }) => s), clips }; run.save();
writeFileSync(join(kdir, "frames.txt"), plan.stills.map((s) => `${s.id}  (${s.uses.join(", ")})  from: ${s.envKind}${s.env ? ` ${s.env}` : ""}  after: ${s.prev || "-"}  images: ${s.images.join(", ")}\n${s.prompt}\n`).join("\n"));
writeFileSync(join(kdir, "clips.txt"), clips.map((c) => `clip ${c.n}  ${c.seconds} s  ${c.start} → ${c.end}\n${c.prompt}\n`).join("\n"));
const secs = clips.reduce((n, c) => n + c.seconds, 0);
say(`\nplan (${KFID}): ${plan.stills.length} stills (${plan.stills.map((s) => `${s.id}: ${s.uses.join(", ")}`).join(" · ")}) = ${plan.stills.length * COST.image} credits; ${clips.length} clips, ${secs} s = ${COST.video(secs, model)} credits on ${model}`);
const esc_ = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;"), CSS = `<style>body{font:14px/1.45 system-ui;margin:24px;max-width:1200px}pre{white-space:pre-wrap;background:#f6f6f6;padding:10px;font-size:12px}img,video{max-width:100%}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}h2{margin-top:32px}</style>`;
if (checks.errors.length) { say("the script has errors: nothing is painted"); process.exit(1); }
if (!BUILD) {
  writeFileSync(join(kdir, "page", "index.html"), `<!doctype html><meta charset="utf-8"><title>${esc_(L.script.title)} — ${KFID} review</title>${CSS}<h1>${esc_(L.script.title)} (${TOTAL} s) — ${KFID}: script and prompts, nothing painted</h1><p>${esc_(KF.KF.name)}</p><h2>Shooting script</h2><pre>${esc_(text)}</pre><h2>Checks</h2><pre>${esc_([...checks.errors, ...checks.notes].join("\n") || "all passed")}</pre><h2>Still prompts (${plan.stills.length})</h2>${plan.stills.map((s) => `<h3>${s.id} · ${s.uses.join(", ")}</h3><pre>images: ${s.images.join(", ")}\n\n${esc_(s.prompt)}</pre>`).join("")}<h2>Clip prompts (${clips.length})</h2>${clips.map((c) => `<h3>clip ${c.n} · ${c.seconds} s · ${c.start} → ${c.end}</h3><pre>${esc_(c.prompt)}</pre>`).join("")}`);
  say(`stopping before the first still (${KFID}/frames.txt, ${KFID}/clips.txt and ${KFID}/page/index.html hold every prompt; --build to paint and film)`); process.exit(0);
}

// 4. Stills: chains per place (each still edits the latest still of its place), places in parallel. Every still is painted
// with the portraits attached and checked by feature and by third before anything is built on it; one retry, then stop.
// The gate: the count of people and their left-to-right ORDER against the frame, which is what the 180-degree line needs.
// The exact third is reported, not enforced: a man "a pace ahead" of another in the left third lands at the edge of the centre.
const checkStill = (file, people) => jsonCall({ name: "still-check-order", effort: "low", images: [run.path(file)],
  schema: S.obj({ people: S.int, ...(people.length ? { order: S.arr(S.enum(people.map((p) => p.id))), sides: S.obj(Object.fromEntries(people.map((p) => [p.id, S.enum(["left", "centre", "right", "absent"])]))) } : {}), note: S.str }),
  prompt: `In this picture: how many people are visible?${people.length ? ` These people may be in it:\n${people.map((p) => `- ${p.id}: ${L.features[p.id]}`).join("\n")}\norder: the ids of those visible, from the left edge of the picture to the right edge. sides: for each id, the third of the frame the person stands in (left, centre, right), or absent.` : ""}\nnote: anything wrong (an extra person, a face that does not match the features), short.` });
const RANK = { left: 0, centre: 1, right: 2 };
const orderOk = (people, order = []) => people.every((p) => order.includes(p.id)) && people.every((a) => people.every((b) => RANK[a.third] >= RANK[b.third] || order.indexOf(a.id) < order.indexOf(b.id)));
K.painted ??= {}; K.attempts ??= {}; K.made ??= {};
// --retry: forget the current attempt of each named item (its history is kept), and everything built on a retried still.
const dependents = (id) => plan.stills.filter((x) => x.env === id).flatMap((x) => [x.id, ...dependents(x.id)]);
for (const id of RETRY) {
  if (id.startsWith("clip-")) { const n = Number(id.slice(5)); if (K.made[n]) { (K.attempts[id] ??= []).push(K.made[n]); delete K.made[n]; } continue; }
  for (const d of [id, ...dependents(id)]) { if (K.painted[d]) { (K.attempts[d] ??= []).push(K.painted[d]); delete K.painted[d]; } for (const c of clips) if ((c.start === d || c.end === d) && K.made[c.n]) { (K.attempts[`clip-${c.n}`] ??= []).push(K.made[c.n]); delete K.made[c.n]; } }
}
for (const id of ACCEPT) { if (id.startsWith("clip-")) { const m = K.made[Number(id.slice(5))]; if (m?.identity) { m.identity.ok = true; m.accepted = true; } } else if (K.painted[id]) { K.painted[id].bad = false; K.painted[id].accepted = true; } }
run.save();
const resolve = (ref) => { const [kind, id] = ref.split(":"); return kind === "env" ? K.painted[id].file : L.bank[id].file; };
async function paint(s) {
  const people = s.frame.people.filter(inFrame), images = s.images.map(resolve), k = (K.attempts[s.id] || []).length, suffix = k ? `-r${k}` : "";
  const f = kp(`stills/${s.id}${suffix}.png`);
  await jobs.image(`still-${KFID}-${s.id}${suffix}`, f, s.prompt, images, { model: STILL, resolution: "2k", aspect_ratio: "16:9" });
  const c = await checkStill(f, people), peopleBad = c.people !== people.length || !orderOk(people, c.order), off = people.filter((p) => c.sides?.[p.id] !== p.third).map((p) => `${p.id} ${c.sides?.[p.id]}≠${p.third}`);
  const room = await state.roomCheck(f, s.place), bad = peopleBad || !room.ok;
  say(`  ${s.id}${suffix}: ${c.people} people (want ${people.length}) · order ${(c.order || []).join(" < ") || "-"}${peopleBad ? " · people FLAGGED" : " · people ok"}${off.length ? ` (thirds off: ${off.join(", ")})` : ""} · room ${room.ok ? "ok" : `FLAGGED${room.added?.length ? ` (added: ${room.added.join(", ")})` : ""}`} · ${c.note} ${room.note || ""}`);
  K.painted[s.id] = { file: f, check: { ...c, room }, bad, images, prompt: s.prompt, attempt: k + 1 }; run.save();
  state.record(s, { file: f, gate: bad ? "flagged" : "ok" }, stillById(s.env));
  return !bad;
}
// --shot N: only the stills that shot uses, plus every still they chain from (image 1 of an edit or a reframe).
const wanted = new Set(); const need = (id) => { if (!id || wanted.has(id)) return; wanted.add(id); need(plan.stills.find((x) => x.id === id)?.env); };
if (ONLY) { if (!plan.byShot[ONLY]) { say(`no shot ${ONLY}`); process.exit(1); } need(plan.byShot[ONLY].start); need(plan.byShot[ONLY].end); }
const toPaint = plan.stills.filter((s) => !ONLY || wanted.has(s.id)), toClip = clips.filter((c) => !ONLY || c.n === ONLY);
say(`building ${toPaint.length} stills and ${toClip.length} clip${toClip.length === 1 ? "" : "s"}${ONLY ? ` (shot ${ONLY} only)` : ""}`);
// --recheck: the gates again on a still as it stands, without painting (after a gate's criterion was refined).
for (const id of RECHECK) {
  const s = plan.stills.find((x) => x.id === id), p = K.painted[id]; if (!s || !p) continue;
  const people = s.frame.people.filter(inFrame), c = await checkStill(p.file, people), room = await state.roomCheck(p.file, s.place), peopleBad = c.people !== people.length || !orderOk(people, c.order);
  p.check = { ...c, room }; p.bad = peopleBad || !room.ok; p.rechecked = true; run.save(); state.record(s, { file: p.file, gate: p.bad ? "flagged" : "ok" }, stillById(s.env));
  say(`  recheck ${id}: ${c.people} people (want ${people.length}) · order ${(c.order || []).join(" < ")} · people ${peopleBad ? "FLAGGED" : "ok"} · room ${room.ok ? "ok" : `FLAGGED${room.added?.length ? ` (added: ${room.added.join(", ")})` : ""}`} · ${c.note} ${room.note || ""}`);
}
const places = [...new Set(toPaint.map((s) => s.place))];
// Per place, in plan order. A still is painted unless something it is painted from (its env chain) is flagged or missing.
const envFlagged = (s) => { for (let e = stillById(s.env); e; e = stillById(e.env)) { if (!K.painted[e.id] || K.painted[e.id].bad) return e.id; } return null; };
await Promise.all(places.map(async (p) => { for (const s of toPaint.filter((x) => x.place === p)) { if (K.painted[s.id]) continue; const f = envFlagged(s); if (f) { say(`  ${s.id}: waiting on ${f}`); continue; } await paint(s); } }));
const stale = toPaint.filter((s) => K.painted[s.id]?.prompt && K.painted[s.id].prompt !== s.prompt);
if (stale.length) say(`note: painted with an older prompt (retry to repaint): ${stale.map((s) => s.id).join(", ")}`);
const flaggedStills = toPaint.filter((s) => K.painted[s.id]?.bad), blocked = toPaint.filter((s) => !K.painted[s.id]);
if (flaggedStills.length) {
  say(`\nREVIEW (stills): ${flaggedStills.map((s) => `${s.id}: ${s.frame.people.filter(inFrame).length} wanted, ${K.painted[s.id].check.people} seen, order ${(K.painted[s.id].check.order || []).join(" < ")}; room ${K.painted[s.id].check.room?.ok ? "ok" : "FLAGGED"}; ${K.painted[s.id].check.note} ${K.painted[s.id].check.room?.note || ""}`).join(" | ")}${blocked.length ? ` · not painted yet (built on a flagged still): ${blocked.map((s) => s.id).join(", ")}` : ""}`);
  say(`look at them in the slideshow, then rerun with --retry ${flaggedStills.map((s) => s.id).join(",")} or --accept ${flaggedStills.map((s) => s.id).join(",")}`); process.exit(2);
}
if (args.includes("--stills")) { K.summary = { stills: plan.stills.length, credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save(); say(`stills done (${jobs.spent()} credits this run); stopping before the clips (--build without --stills to continue)`); process.exit(0); }

// 5. Clips, pinned on both stills, PAR at a time.
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); })); };
async function transcribe(file) {
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3")); execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((t) => t.text || "").catch(() => "");
}
// The clip gate: frames every half second, one vision call: the count and left-to-right order of the people in each frame
// against the shot's frames, and whether anyone's face, beard, hair or glasses turn into another person's. A clip that
// fails is made once more; a second failure is kept but marked, since nothing is built on a clip.
async function checkClip(file, c) {
  const h = scene(c.scene).shots.find((x) => x.n === c.n), people = [...new Set([...h.first.people, ...h.last.people].filter(inFrame).map((p) => p.id))];
  const base = file.replace(/\.mp4$/, ""); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(file), "-vf", "fps=2,scale=1024:-2", "-q:v", "4", run.path(`${base}-f%02d.jpg`)]);
  const frames = []; for (let i = 1; existsSync(run.path(`${base}-f${String(i).padStart(2, "0")}.jpg`)); i++) frames.push(`${base}-f${String(i).padStart(2, "0")}.jpg`);
  if (!people.length || !frames.length) return { ok: true, frames: frames.length, note: "no people to check" };
  const r = await jsonCall({ name: "clip-check", effort: "low", images: frames.map((f) => run.path(f)),
    schema: S.obj({ frames: S.arr(S.obj({ image: S.int, people: S.int, order: S.arr(S.enum(people)) })), drift: S.bool, note: S.str }),
    prompt: `Images 1 to ${frames.length} are frames in time order from one ${c.seconds}-second clip, two per second. These people may appear:\n${people.map((id) => `- ${id}: ${L.features[id]}`).join("\n")}\nFor each image: people = how many people are visible; order = the ids visible, from the left edge to the right edge. drift = true if in ANY image a person's face, beard, hair or glasses have turned into another person's (for example the bearded man losing his beard or gaining side-whiskers). note: which image and what, short.` });
  const want = [h.first, h.last].map((fr) => fr.people.filter(inFrame)), counts = new Set(want.map((w) => w.length));
  const badFrames = r.frames.filter((f) => !counts.has(f.people) || !want.some((w) => w.every((p) => f.order.includes(p.id)) && orderOk(w, f.order))).map((f) => f.image);
  return { ok: !r.drift && !badFrames.length, drift: r.drift, badFrames, frames: frames.length, note: r.note };
}
await pool(toClip, PAR, async (c) => {
  if (K.made[c.n]) return;
  const start = K.painted[c.start].file, end = K.painted[c.end].file, lines = scene(c.scene).shots.find((h) => h.n === c.n).lines.length;
  const k = (K.attempts[`clip-${c.n}`] || []).length, base = k ? `-r${k}` : "";
  // One attempt per run. The only automatic resubmission is for a content-filter rejection, which returns nothing to review:
  // then once more with the policy-safe prompt. Gate results are recorded and flagged, never acted on.
  let made, prompt = c.prompt, suffix = base;
  for (let t = 1; t <= 2; t++) {
    const file = kp(`clips/s${c.n}${suffix}.mp4`), key = `clip-${KFID}-${c.n}-${model}${suffix}`;
    try { await jobs.video(key, file, prompt, start, end, c.seconds, { ...VIDEO, model, audio: true }); }
    catch (e) {
      const msg = String(e).slice(0, 300);
      if (msg.includes('"code":"nsfw"') && prompt === c.prompt) { prompt = policySafe(c.prompt); suffix = `${base}-p`; say(`  clip ${c.n}: rejected by the content filter; resubmitting with the policy-safe prompt`); continue; }
      say(`  clip ${c.n}: FAILED ${msg}`); made = { error: msg, prompt, start, end }; break;
    }
    const qa = check(run.path(file), { start: run.path(start), end: run.path(end), path: (f) => run.path(kp(f)), key: `s${c.n}${suffix}` });
    const identity = await checkClip(file, c), heard = lines ? await transcribe(file) : "";
    say(`  clip ${c.n}${suffix ? ` (${suffix.slice(1)})` : ""}: first≈start ${qa.first_vs_start} last≈end ${qa.last_vs_end} · identity ${identity.ok ? "ok" : `FLAGGED${identity.drift ? " (drift)" : ""}${identity.badFrames?.length ? ` frames ${identity.badFrames.join(",")}` : ""}`} · ${identity.note}${heard ? ` · heard: ${heard}` : ""}`);
    made = { clip: file, start, end, qa, heard, identity, attempt: k + 1, prompt: prompt === c.prompt ? undefined : prompt };
    break;
  }
  K.made[c.n] = made; run.save();
});
const missing = toClip.filter((c) => !K.made[c.n]?.clip), flaggedClips = toClip.filter((c) => K.made[c.n]?.clip && !K.made[c.n].identity?.ok);
if (missing.length || flaggedClips.length) {
  if (missing.length) say(`\nFAILED: clip${missing.length > 1 ? "s" : ""} ${missing.map((c) => c.n).join(", ")} (${missing.map((c) => K.made[c.n]?.error || "not made").join(" | ")})`);
  if (flaggedClips.length) say(`\nREVIEW (clips): ${flaggedClips.map((c) => `clip ${c.n}: ${K.made[c.n].identity.note}${K.made[c.n].identity.badFrames?.length ? ` (frames ${K.made[c.n].identity.badFrames.join(",")})` : ""}`).join(" | ")}`);
  say(`not stitched. Look in the slideshow, then rerun with --retry ${[...missing, ...flaggedClips].map((c) => `clip-${c.n}`).join(",")} or --accept ${flaggedClips.map((c) => `clip-${c.n}`).join(",")}`); process.exit(2);
}
if (ONLY) { K.summary = { ...(K.summary || {}), partial: `shot ${ONLY}`, credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save(); say(`shot ${ONLY} done (${jobs.spent()} credits this run); no stitch. See compare/index.html`); process.exit(0); }

// 6. Stitch, then the captions as overlay cards (src/captions.js), never painted: each from its film second for 4 seconds or
// until the next caption, whichever comes first.
const parts = clips.map((c) => { const f = K.made[c.n].clip, p = run.path(f.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(f), "-vf", "setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p", "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
writeFileSync(run.path(kp("clips/concat.txt")), parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", run.path(kp("clips/concat.txt")), "-c", "copy", run.path(kp("clips/film-raw.mp4"))]);
// With --subtitles the lines are burned too (made by code from the screenplay, never by a model), and the captions move to
// the top so the two never collide.
const SUBS = args.includes("--subtitles");
const all = L.script.scenes.flatMap((sc) => sc.captions).sort((a, b) => a.at - b.at);
const caps = all.map((c, i) => ({ file: captionCard(c.text, run.path(kp(`clips/caption-${i + 1}.png`)), { at: SUBS ? "top" : "bottom" }), from: c.at, to: Math.min(c.at + 4, all[i + 1]?.at ?? Infinity) }));
const subs = SUBS ? subtitlesFromScript(L.script).map((s, i) => ({ file: captionCard(s.text, run.path(kp(`clips/subtitle-${i + 1}.png`)), { size: 26 }), from: s.from, to: s.to })) : [];
burnCaptions(run.path(kp("clips/film-raw.mp4")), run.path(kp("clips/film.mp4")), [...caps, ...subs]);

// 7. Page (at <kf>/page/index.html; media paths are relative to it).
const rel = (f) => `../../${f}`;
const html = `<!doctype html><meta charset="utf-8"><title>${esc_(L.script.title)} — ${KFID}</title>${CSS}
<h1>${esc_(L.script.title)} (${TOTAL} s) — ${KFID}</h1><p>${esc_(KF.KF.name)}</p><video controls src="${rel(kp("clips/film.mp4"))}"></video>
<h2>Shooting script</h2><pre>${esc_(text)}</pre>
<h2>Stills</h2>${plan.stills.map((s) => `<h3>${s.id} · ${s.uses.join(", ")}${K.painted[s.id]?.bad ? " · check failed" : ""}</h3><div class="row"><img src="${rel(K.painted[s.id].file)}"><pre>images: ${s.images.join(", ")}\n\n${esc_(s.prompt)}\n\ncheck: ${esc_(JSON.stringify(K.painted[s.id].check))}</pre></div>`).join("")}
<h2>Clips</h2>${clips.map((c) => `<h3>clip ${c.n} · ${c.seconds} s · ${c.start} → ${c.end}</h3><div class="row"><video controls src="${rel(K.made[c.n].clip)}"></video><pre>${esc_(c.prompt)}\n\nfirst≈start ${K.made[c.n].qa.first_vs_start} · last≈end ${K.made[c.n].qa.last_vs_end}${K.made[c.n].heard ? `\nheard: ${esc_(K.made[c.n].heard)}` : ""}</pre></div>`).join("")}`;
writeFileSync(join(kdir, "page", "index.html"), html);
K.summary = { seconds: secs, credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save();
say(`film: ${KFID}/clips/film.mp4 (${secs} s) · ${KFID}/page/index.html · ${JSON.stringify(K.summary)}`);
