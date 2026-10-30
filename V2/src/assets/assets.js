// ASSETS: the element table from the story, then procurement. Real things (nonfiction) are referenced from Wikimedia Commons
// (candidates pooled over several searches, one vision pick, provenance kept); the rest are generated with the medium as the
// noun of the prompt and a style reference so plates match; an earlier run's bank can be reused element by element.
// Then the cast lines: each person's telling features (one vision call per portrait) and a voice descriptor (one call).
import { copyFileSync, existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { jsonCall, S } from "../lib/llm.js";
import { key } from "../lib/env.js";
import { bars, crop as cropImage, size as imageSize } from "../lib/media.js";

const UA = "magic-agent-video-generator/0.2 (research pipeline; contact via repository)";

// A Commons picture used as a PLATE must be a usable environment: the place itself, empty of people or nearly so, and in a
// medium the film can stand on (a photograph for a live-action film; an engraving pulls every frame to line art). One
// vision call per candidate pick; a rejected pick falls through to generation.
async function plateUsable(run, file, placeName, liveAction) {
  const r = await jsonCall({ name: "plate-usable", effort: "low", images: [run.path(file)], schema: S.obj({ medium: S.enum(["photograph", "engraving", "painting", "drawing", "map", "other"]), people: S.int, empty_view: S.bool, why: S.str }),
    prompt: `This picture is proposed as the EMPTY reference view of the place "${placeName}" for a film: every frame of a scene there will be painted into it. medium: what the picture is. people: how many people are visible. empty_view: true only if it shows the place itself with no crowd and no event (a few distant figures are tolerable), as a set would look before the actors arrive. why: short.` });
  const ok = r.empty_view && r.people <= 2 && (!liveAction || r.medium === "photograph");
  return { ok, ...r };
}

// A generated sheet against its own look: the image model adds things on its own (an offshore platform on an open-sea plate
// whose look said "no coastal landmarks or buildings"), and a plate's invention is then "missing" from every frame painted
// from it. One vision call per generated sheet; flag only (the user says --retry root-<id> or --accept root-<id>).
async function sheetMatchesLook(run, file, e) {
  const r = await jsonCall({ name: "sheet-check", effort: "low", images: [run.path(file)], schema: S.obj({ ok: S.bool, excluded_present: S.arr(S.str), prominent_extras: S.arr(S.str), why: S.str }),
    prompt: `This picture was generated as the reference sheet of ${e.name} (${e.kind}) from this description: "${e.look}". excluded_present: things the description rules out that are nonetheless in the picture (a building where it says none, people where it says empty). prominent_extras: large things in the picture that the description never mentions and that would have to appear in every frame made from it (a structure, a vehicle, a second subject); not textures, weather or small details. ok: true when both lists are empty. why: short.` });
  return { ok: r.ok && !r.excluded_present.length && !r.prominent_extras.length, ...r };
}

export async function runAssets({ log: L, run, jobs, say = console.log, reuse = null, map = {}, generate = true, retry = [], accept = [] }) {
  L.bank ??= {};
  for (const id of retry) if (L.bank[id] && !L.bank[id].reused_from) { (L.bank_attempts ??= {})[id] = [...(L.bank_attempts?.[id] || []), L.bank[id]]; delete L.bank[id]; delete L.jobs?.[`root-${id}`]; say(`  ${id}: sheet forgotten for a fresh one (the earlier one is kept in bank_attempts)`); }
  for (const id of accept) if (L.bank[id]?.flagged) { L.bank[id].accepted = L.bank[id].flagged; delete L.bank[id].flagged; say(`  ${id}: sheet accepted as it is`); }
  run.save();
  const mode = L.mode || "nonfiction", facts = L.research?.facts || [];
  // 1. Elements: everything that must look the same every time it is drawn.
  if (!L.elements) {
    say("elements…");
    const EL = S.obj({ id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, name: S.str, aka: S.str, kind: S.enum(["character", "prop", "place", "fixture"]), real: S.bool, searches: S.arr(S.str), look: S.str });
    L.elements = (await jsonCall({ name: "elements-v2", effort: "medium", schema: S.obj({ elements: S.arr(EL) }),
      prompt: `List every element of this story that must look the same every time it is drawn: characters, movable props, one place per distinct location, and fixtures (fixed things of a place that the action uses: a doorway, a counter, a fireplace).
For each: id (short, lowercase, hyphens); name (as the story calls it, unique across elements: a vessel or thing named after a person is called by its kind and name, "the steamship Vanderbilt", never the bare person's name); aka: its common modern name if different ("White House" for the Executive Mansion), else ""; kind; real: true only if it is a specific real person, place, vessel, building or object whose look is documented (photos, portraits, engravings exist)${mode === "fiction" ? " (this is an invented story: its people are not real, but a real aircraft, vessel, vehicle, building or place in it is)" : ""}; searches: 2-4 Wikimedia Commons search strings that would find a picture of the real thing, from specific to plain ("White House 1860s", "Abraham Lincoln portrait 1862"), empty if not real; look: one line of what never changes about it (build, face, clothing of the period, material, rig, style), never a state.
${L.research?.looks?.length ? `Documented looks from research:\n${L.research.looks.map((l) => `- ${l.thing}: ${l.look}`).join("\n")}\n` : ""}
Story:
${L.story.story}` })).elements;
    if (mode === "fiction") for (const e of L.elements) if (e.kind === "character") { e.real = false; e.searches = []; }   // invented people; real hardware and places keep their record
    run.save();
  }
  const els = L.elements;
  say(`elements: ${els.length} (${els.filter((e) => e.real).length} real): ${els.map((e) => `${e.id}/${e.kind}`).join(", ")}`);

  // 2. The medium as noun phrases, and the treatment (colour or monochrome, said once).
  L.medium ??= await jsonCall({ name: "medium", effort: "low", schema: S.obj({ person: S.str, object: S.str, place: S.str, cell: S.str, frame: S.str, treatment: S.str }),
    prompt: `From this visual style line, write the MEDIUM as noun phrases a prompt can start with, nothing about scenes, colours or light:
person: a full-length picture of one person in this medium ("A studio photograph of a real person"); object: the same for one object; place: the same for an empty place, ending in "of"; cell: what one still frame of the story IS, as a noun phrase, never "footage"; frame: one closing sentence for a story frame naming the medium and camera.
treatment: the one line that does name colour: one sentence, ending in a full stop, stating explicitly colour or monochrome, grain, contrast and finish, which every image prompt of the film begins with ("Full colour, fine film grain, natural contrast, no sepia or black-and-white."); when the style line is silent, a live-action film is full colour.
Never use words that imply a widescreen, anamorphic, letterboxed or cinemascope presentation (no "cinema camera", "cinematic", "anamorphic", "widescreen"): every picture fills a plain 16:9 frame edge to edge; say "film still" or "photograph" instead.
Style: ${L.story.style}` });

  // 3. The bank. Reuse first (same element id in an earlier run), then Commons for real things, then generation.
  L.bank ??= {}; L.style_ref ??= null;
  const old = reuse && existsSync(join(reuse, "run.json")) ? JSON.parse(readFileSync(join(reuse, "run.json"), "utf8")) : null;
  const plain = (e) => e.name.replace(/\s*\(.*?\)\s*/g, " ").split(/\s[—–-]\s/)[0].trim();
  const year = facts.map((f) => (String(f.when).match(/\b1[5-9]\d\d\b|\b20\d\d\b/) || [])[0]).filter(Boolean)[0], decade = year ? `${Math.floor(Number(year) / 10) * 10}s` : "";
  const searches = (e) => { const names = [...new Set([e.aka, plain(e)].filter(Boolean))]; return [...new Set([...(e.searches || []).filter(Boolean), ...names.flatMap((n) => (e.kind === "character" ? [`${n} portrait`, `${n} photograph`] : [`${n} ${decade}`, `${n} photograph`])), ...names])]; };
  const order = [...els.filter((e) => e.kind === "place"), ...els.filter((e) => e.kind !== "place")];
  for (const e of order) {
    if (L.bank[e.id]?.file && existsSync(run.path(L.bank[e.id].file))) { if (e.kind === "place" && L.bank[e.id].source !== "commons") L.style_ref ??= L.bank[e.id].file; continue; }
    if (L.bank[e.id]?.source === "text" && (e.kind === "fixture" || !generate)) continue;   // an earlier run left a prop as text: it is procured now
    if (L.bank[e.id]?.source === "pending-generation" && !generate) continue;
    if (L.bank[e.id]?.source === "pending-generation" && L.bank[e.id].record && generate) { /* fall through to generation from the record below */ }
    // Reuse: the same id in the earlier run, else the same kind of element with the same common name (and the same interior /
    // exterior sense for a place), else the same normalised name.
    const nm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim(), io = (s) => (/interior|inside/.test(nm(s)) ? "int" : /exterior|outside|front/.test(nm(s)) ? "ext" : "");
    const match = (map[e.id] && old?.elements?.find((o) => o.id === map[e.id])) || old?.elements?.find((o) => o.id === e.id) || old?.elements?.find((o) => o.kind === e.kind && o.aka && nm(o.aka) === nm(e.aka) && (e.kind !== "place" || io(o.name) === io(e.name))) || old?.elements?.find((o) => o.kind === e.kind && nm(o.name) === nm(e.name));
    const ob = match ? old?.bank?.[match.id] : null;
    if (ob?.file && existsSync(join(reuse, ob.file))) { copyFileSync(join(reuse, ob.file), run.path(ob.file)); if (ob.voice?.sample && existsSync(join(reuse, ob.voice.sample))) { mkdirSync(run.path("sound"), { recursive: true }); copyFileSync(join(reuse, ob.voice.sample), run.path(ob.voice.sample)); }   // the voice sample travels with the entry
      L.bank[e.id] = { ...ob, reused_from: `${reuse}:${match.id}` }; say(`  ${e.id}: reused ${match.id} from ${reuse} (${ob.source})`); if (e.kind === "place" && ob.source !== "commons") L.style_ref ??= ob.file; run.save(); continue; }
    // Commons.
    if (e.real) {
      const cands = [], seen = new Set(), used = [];
      for (const q of searches(e)) { const got = await commons(q, 6); let n = 0; for (const c of got) if (!seen.has(c.title) && cands.length < 10) { seen.add(c.title); cands.push(c); n++; } if (n) used.push(q); if (cands.length >= 8) break; }
      const files = [];
      for (const [i, c] of cands.entries()) { const f = `refs/${e.id}-${i + 1}.jpg`; try { await download(c.thumb, run.path(f)); files.push({ ...c, file: f }); } catch {} }
      if (files.length) {
        const pick = await jsonCall({ name: "ref-pick-v2", effort: "low", images: files.map((f) => run.path(f.file)), schema: S.obj({ pick: S.int, why: S.str }),
          prompt: `Images 1 to ${files.length} are candidates for the reference picture of ${e.name} (${e.kind}; ${e.look}) in a period-accurate film. Candidates, in order: ${files.map((f, i) => `${i + 1}: "${f.title}" (${f.date || "date unknown"})`).join("; ")}.
pick: the number of the best one: a single clear depiction of this exact thing itself (a portrait or photograph of the person, the vessel, the building; a period engraving or painting is fine), not a map, a page of text, a statue, a modern replica, a two-up or stereograph card, or something else named after it; 0 if none qualifies. why: short.` });
        const p = pick.pick >= 1 && pick.pick <= files.length ? files[pick.pick - 1] : null;
        // A place's candidates are tried in rank order until one passes the plate check (the first pick alone once lost the
        // real F-35 cockpit to an exterior photo with two people); a real picture that is not usable as an empty plate is
        // kept as the RECORD of the place, and the plate is then generated from it rather than from words.
        const ranked = p ? [p, ...files.filter((f) => f !== p)] : [];
        let chosen = null, rejected = null;
        for (const cand of (e.kind === "place" ? ranked.slice(0, 3) : ranked.slice(0, 1))) {
          const usable = e.kind === "place" ? await plateUsable(run, cand.file, e.name, /live-action|photograph|documentary/i.test(L.story.style || "")) : null;
          if (!usable || usable.ok) { chosen = cand; break; }
          rejected ??= { cand, usable }; say(`  ${e.id}: Commons candidate "${cand.title}" is not usable as a plate (${usable.medium}, ${usable.people} people; ${usable.why})`);
        }
        if (chosen) { L.bank[e.id] = { source: "commons", file: chosen.file, title: chosen.title, page: chosen.page, license: chosen.license, date: chosen.date, artist: chosen.artist, why: pick.why, candidates: files.length, search: used.join(" + ") }; say(`  ${e.id}: Commons → ${chosen.title} (${chosen.date || "?"})`); run.save(); continue; }
        if (rejected) { L.bank[e.id] = { source: "pending-generation", look: e.look, record: { file: rejected.cand.file, title: rejected.cand.title, page: rejected.cand.page, license: rejected.cand.license } }; say(`  ${e.id}: the record picture "${rejected.cand.title}" is kept; the plate will be generated from it`); }
        else say(`  ${e.id}: Commons gave ${files.length} candidates, none usable (${pick.why})`);
      } else say(`  ${e.id}: nothing on Commons for ${searches(e).map((q) => `"${q}"`).join(", ")}`);
    }
    // Generation: every element that can stand in a frame on its own (characters, places, props) gets a picture, because the
    // state manager can only hold a thing consistent through a picture it can send; an invented or unphotographed prop left as
    // text (the Top Gun warship) was painted as a different ship in every frame. Fixtures are part of their place's plate.
    if (e.kind !== "fixture" && !generate) { L.bank[e.id] = { source: "pending-generation", look: e.look }; say(`  ${e.id}: needs generation (not run: --no-generate)`); run.save(); continue; }
    if (e.kind !== "fixture") {
      const record = L.bank[e.id]?.record, file = `roots/${e.id}.png`, ref = record ? [record.file, ...(L.style_ref ? [L.style_ref] : [])] : e.kind !== "character" && L.style_ref ? [L.style_ref] : [];
      const match1 = record ? `Image 1 is a photograph of this real place: keep its layout, fixtures, materials and markings exactly, and show it EMPTY of people, as a set before the actors arrive${ref.length > 1 ? "; match the colour treatment, grain and contrast of image 2" : ""}.\n` : ref.length ? "Match the colour treatment, grain and contrast of image 1 exactly; the subject itself is described below, not taken from image 1.\n" : "";
      const prompt = e.kind === "character"
        ? `${L.medium.treatment} ${L.medium.person}, full length. The person: ${e.look}\nStanding, front view, neutral pose, arms relaxed, whole figure visible head to feet.\nPlain light-grey seamless studio backdrop, soft even light, nothing else in the picture; no text.`
        : e.kind === "place" ? `${L.medium.treatment} ${match1}${L.medium.place} ${e.name}, empty of people, one single image. ${e.look} Period-accurate in every detail. No text or labels.`
        : `${L.medium.treatment} ${match1}${L.medium.object} ${e.name}, the whole thing seen from the side, filling the frame, in its natural setting with nothing else of note and no people, one single image. ${e.look} Period-accurate in every detail. No text or labels.`;
      const job = await jobs.image(`root-${e.id}`, file, prompt, ref);
      if (job.estimated) { say(`  ${e.id}: would be generated (${e.kind}, ${job.credits} credits); dry run`); continue; }
      // The image model letterboxes on its own when the medium sounds like cinema (every Top Gun plate came with 24-pixel
      // bars, one with a 228-pixel bar, and the bars were carried into every frame painted from them, then widened). Thin
      // bars are cropped off the sheet here, the raw file kept; a thick bar is named for the user.
      const lb = bars(run.path(file)), barsNote = lb.frac > 0 ? `black bars ${lb.top}+${lb.bottom} px top/bottom, ${lb.left}+${lb.right} px sides` : "";
      if (lb.frac > 0 && lb.frac <= 0.3) { const raw = file.replace(/\.png$/, "-raw.png"); renameSync(run.path(file), run.path(raw)); const [W, H] = imageSize(run.path(raw)); cropImage(run.path(raw), { x: lb.left / W, y: lb.top / H, w: (W - lb.left - lb.right) / W, h: (H - lb.top - lb.bottom) / H }, run.path(file)); say(`  ${e.id}: ${barsNote}, cropped off (raw kept as ${raw})`); }
      else if (lb.frac > 0.3) say(`  ${e.id}: FLAGGED ${barsNote}; look at it before it is used`);
      const fit = await sheetMatchesLook(run, file, e);
      L.bank[e.id] = { source: record ? "generated-from-record" : "generated", file, prompt, ...(record ? { record } : {}), ...(ref.length ? { style_ref: ref.at(-1) } : {}), ...(barsNote ? { bars: barsNote } : {}), ...(fit.ok ? {} : { flagged: `${[...fit.excluded_present.map((x) => `excluded by its description: ${x}`), ...fit.prominent_extras.map((x) => `not in its description: ${x}`)].join("; ")} (${fit.why})` }) };
      say(`  ${e.id}: generated (${e.kind})${fit.ok ? "" : ` · FLAGGED ${L.bank[e.id].flagged}`}`);
      if (e.kind === "place") L.style_ref ??= file;
    } else L.bank[e.id] = { source: "text", look: e.look };
    run.save();
  }

  // 4. Cast lines: how each person is named in every prompt, and how each voice is performed. Identity facts: no salt.
  const chars = els.filter((e) => e.kind === "character" && L.bank[e.id]?.file);
  L.features ??= {};
  for (const c of chars) L.features[c.id] ??= (await jsonCall({ name: "cast-features", effort: "low", images: [run.path(L.bank[c.id].file)], schema: S.obj({ features: S.str }),
    prompt: `This is the reference picture of ${c.name}. In at most 15 words, the telling features that tell this person from others in the same film (hair colour and style, beard or whiskers or clean-shaven, glasses, build). No clothes, no expression.` })).features;
  L.voices ??= chars.length ? await jsonCall({ name: "voice-cast-desc", effort: "low", schema: S.obj(Object.fromEntries(chars.map((c) => [c.id, S.str]))),
    prompt: `For each character, one line describing the voice for a video model to perform (pitch, pace, accent, timbre), from what the record says where it says anything, else plausible for the person's age and origin. One performable line each, no commentary about sources:\n${chars.map((c) => `- ${c.id}: ${c.name}. ${(L.research?.looks || []).filter((l) => l.thing.toLowerCase().includes(c.name.split(" ").pop().toLowerCase())).map((l) => l.look).join(" ")}`).join("\n")}` }) : {};
  run.save();
  say(`cast: ${chars.map((c) => `${c.id}: ${L.features[c.id]}`).join(" · ")}`);

  // 5. The voice bank: a ready-made preset voice per character (and one for the narrator), chosen once from the descriptor,
  // rendered once as a short sample for approval, and kept as a property of the asset (the state manager's element table).
  // Presets are stable by construction: the same voice reads every line of that character in every clip.
  const PRESETS = { alloy: "neutral, even, mid pitch, any gender", ash: "male, low, dry, measured", ballad: "male, warm, lyrical, mid-low", coral: "female, warm, bright", echo: "male, mid, clear, plain", fable: "male, mid-high, expressive, British-leaning", nova: "female, young, light", onyx: "male, deep, authoritative", sage: "female, calm, low", shimmer: "female, soft, airy", verse: "male, mid, conversational" };
  const want = [...chars.map((c) => ({ id: c.id, name: c.name, descriptor: L.voices[c.id] || "" })), { id: "narrator", name: "the narrator", descriptor: "a calm documentary narrator for this film: measured, clear, unhurried" }].filter((w) => !L.bank[w.id]?.voice?.preset);
  if (want.length) {
    const picked = await jsonCall({ name: "voice-presets", effort: "low", schema: S.obj({ choices: S.arr(S.obj({ id: S.enum(want.map((w) => w.id)), preset: S.enum(Object.keys(PRESETS)), instructions: S.str, why: S.str })) }),
      prompt: `Pick a ready-made text-to-speech voice for each of these speakers and write a one-line delivery instruction for it (pace, tone, accent colouring, age; no impersonation of a real person's actual voice, only a plausible performance). Presets:\n${Object.entries(PRESETS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\nSpeakers:\n${want.map((w) => `- ${w.id} (${w.name}): ${w.descriptor}`).join("\n")}` });
    for (const ch of picked.choices) { const id = ch.id; L.bank[id] ??= id === "narrator" ? { source: "voice-only" } : L.bank[id]; if (!L.bank[id]) continue; L.bank[id].voice = { provider: "openai-tts", preset: ch.preset, instructions: ch.instructions, descriptor: want.find((w) => w.id === id)?.descriptor || "", why: ch.why }; }
    run.save();
  }
  for (const w of [...chars.map((c) => c.id), "narrator"]) {
    const v = L.bank[w]?.voice; if (!v?.preset || v.sample) continue;
    const text = w === "narrator" ? `${L.story.title}. A short film from the record.` : `My name is ${L.elements.find((e) => e.id === w)?.name || w}. ${L.story.story.split(/(?<=\.)\s/)[0] || ""}`;
    const file = `sound/voice-${w}.mp3`; mkdirSync(run.path("sound"), { recursive: true });
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: v.preset, input: text, instructions: v.instructions, response_format: "mp3" }) });
    if (!res.ok) { say(`  voice sample for ${w}: TTS HTTP ${res.status}`); continue; }
    writeFileSync(run.path(file), Buffer.from(await res.arrayBuffer())); v.sample = file; v.sample_text = text; run.save();
  }
  say(`voices: ${[...chars.map((c) => c.id), "narrator"].map((w) => `${w}: ${L.bank[w]?.voice?.preset || "-"}`).join(" · ")}`);
  const flagged = Object.entries(L.bank).filter(([, b]) => b.flagged).map(([id]) => id);
  if (flagged.length) say(`\nREVIEW (sheets): ${flagged.map((id) => `${id}: ${L.bank[id].flagged}`).join(" | ")}\nlook at them in the results page, then rerun with --retry ${flagged.map((id) => `root-${id}`).join(",")} or --accept ${flagged.map((id) => `root-${id}`).join(",")}`);
  return { log: L, flagged };
}

async function commons(q, n = 6) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024`;
  const r = await fetch(url, { headers: { "user-agent": UA } }).then((x) => x.json()).catch(() => ({}));
  return Object.values(r.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => ({ title: p.title, ...(p.imageinfo?.[0] || {}) }))
    .filter((p) => /image\/(jpeg|png)/.test(p.mime || "")).map((p) => ({ title: p.title, thumb: p.thumburl, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, license: p.extmetadata?.LicenseShortName?.value || "", date: (p.extmetadata?.DateTimeOriginal?.value || "").replace(/<[^>]+>/g, "").slice(0, 40), artist: (p.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 60) }));
}
async function download(url, file) { const r = await fetch(url, { headers: { "user-agent": UA } }); if (!r.ok) throw new Error(`download ${r.status}`); writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; }
