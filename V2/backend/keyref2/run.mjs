// Key references v2: see keyref.js. A separate pipeline beside backend/keyref (unchanged).
// Usage: CLEANED_CAP=… node V2/backend/keyref2/run.mjs --brief "…" --label keyref2-1 [--budget 500] [--dry]
//        [--seed <file>: a checked still offered to the asset bank (copied in only if it passes the seeded element's checks)]
//        [--picture id=<file>: the user's picture of an element] [--clips N: force N chunks] [--model m] [--vres 480p] [--audio on|off]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { RUNS, V2 } from "../lib/env.js";
import { Jobs } from "../lib/jobs.js";
import { usage } from "../lib/llm.js";
import { runStory } from "../composer/story/story.js";      // the research gate (fiction / needs_research) and web research; imported, not edited
import { runAssets } from "../composer/assets/assets.js";   // Wikimedia Commons search + vision pick, provenance kept; imported, not edited
import { STILL_MODEL, STILL_RES, NO_REF_MODEL, REF_MODEL, LTX_REFS, RULES, topSeconds, writePiece, assemble, fit, chunk, ask, pick, chunkQuestions, frameAt, stillCost, videoCost, duration, stitch } from "./keyref.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const brief = opt("--brief"), label = opt("--label"), CLIPS = opt("--clips") ? Number(opt("--clips")) : null, MODEL_OPT = opt("--model", null), VRES = opt("--vres", "480p");
const BUDGET = Number(opt("--budget", 500)), AUDIO_OPT = opt("--audio", null), DRY = args.includes("--dry"), SEEDS = all("--seed").map((f) => resolve(f));
const PICTURES = Object.fromEntries(all("--picture").map((x) => x.split("=")));
if (!brief || !label) { console.error("--brief and --label are required"); process.exit(2); }
const dir = join(RUNS, label); for (const d of ["", "bank", "chunks", "frames"]) mkdirSync(join(dir, d), { recursive: true });
const recFile = join(dir, DRY ? "keyref-dry.json" : "keyref.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};
const rec = { label, pipeline: "backend/keyref2", brief, at: new Date().toISOString(), dry: DRY, args: { clips: CLIPS, model: MODEL_OPT, resolution: VRES, audio: AUDIO_OPT, budget: BUDGET, seeds: SEEDS.map((f) => f.replace(`${V2}/`, "")), pictures: PICTURES }, jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {}, tools: [], vlm: [], llm: [] };
const run = { name: label, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run, { estimate: DRY }), say = (m) => console.log(m), rel = (f) => ({ path: run.path(f), rel: f }), short = (f) => f.replace(`${V2}/`, "");
class Budget extends Error {}
const pay = (what, cost) => { if (jobs.spent() + cost > BUDGET) throw new Budget(`budget ${BUDGET}: ${what} (${cost}) would take this run to ${jobs.spent() + cost}`); };
const llm = (name, purpose) => rec.llm.push({ name, purpose, model: process.env.CLEANED_MODEL || "gpt-6.1-sol" });
const ff = (op, inputs, output) => rec.tools.push({ tool: "ffmpeg", op, inputs, output, credits: 0 });

// ---- 0. the research gate (composer/story): fiction or a record; do real things appear whose looks matter? ----
say("== research gate");
const G = rec.gate_log = {};
await runStory({ brief, log: G, run: { ...run, save: run.save }, say, seconds: Number((brief.match(/(\d+)[- ]second/) || [])[1]) || 30 });
llm("research-gate-v2 (+ research when needed, + story)", "composer/story: the fiction / needs_research gate");
rec.gate = { fiction: G.gate.fiction, needs_research: G.gate.needs_research, why: G.gate.why, queries: G.gate.queries, mode: G.mode, research: G.research ? { facts: G.research.facts.length, looks: G.research.looks.length } : null };

// ---- 1. prompt first ----
say("== the whole piece as one timed prompt");
const piece = rec.piece = await writePiece({ brief, research: G.research || null }); llm("keyref2-piece-v1", "the whole piece as one timed prose prompt, in parts");
const AUDIO = AUDIO_OPT ? AUDIO_OPT === "on" : piece.sound_requested;
const els = Object.fromEntries(piece.elements.map((e) => [e.id, e]));
const whole = assemble(piece, piece.beats, { audio: AUDIO });
rec.whole_prompt = { prompt: whole, chars: whole.length };
say(whole);

// ---- 2. chunks only when needed; the model; the seeds ----
const realSeed = (e) => G.gate.needs_research && e.real;
const seeded = piece.elements.filter((e) => PICTURES[e.id] || realSeed(e) || e.exact_text.length);
let MODEL = MODEL_OPT, chunks;
if (MODEL) chunks = chunk(piece, topSeconds(MODEL), CLIPS);
else { chunks = chunk(piece, topSeconds(NO_REF_MODEL), CLIPS); MODEL = seeded.length || chunks.length > 1 ? REF_MODEL : NO_REF_MODEL; if (MODEL !== NO_REF_MODEL) chunks = chunk(piece, topSeconds(MODEL), CLIPS); }
const VIDEO = { model: MODEL, resolution: VRES, audio: AUDIO, aspect_ratio: "16:9" };
const firstChunk = (id) => chunks.find((c) => c.beats.some((b) => b.entities.includes(id)))?.n;
const state = rec.state = {
  rules: RULES,
  length_plan: { seconds: piece.seconds, seconds_why: piece.seconds_why, chunks: chunks.map(({ n, from, to, seconds }) => ({ n, from, to, seconds })), why: CLIPS ? `${chunks.length} chunks forced (--clips ${CLIPS}), cut at beat boundaries` : `${piece.seconds} s ${chunks.length === 1 ? `fits one ${MODEL} generation (up to ${topSeconds(MODEL)} s): no cut` : `is longer than one ${MODEL} generation (${topSeconds(MODEL)} s): cut at beat boundaries into ${chunks.length}`}` },
  model: { name: MODEL, resolution: VRES, why: MODEL_OPT ? `forced --model ${MODEL_OPT}` : MODEL === NO_REF_MODEL ? `${NO_REF_MODEL}: no chunk carries a reference; it renders up to ${topSeconds(NO_REF_MODEL)} s a call, as the MCP used it` : `${REF_MODEL}: ${seeded.length ? `a seed is attached (${seeded.map((e) => `@${e.id}`).join(", ")})` : ""}${seeded.length && chunks.length > 1 ? " and " : ""}${chunks.length > 1 ? "chunks after the first carry @previous and frame references" : ""}; ${LTX_REFS}` },
  audio: { on: AUDIO, why: AUDIO_OPT ? `forced --audio ${AUDIO_OPT}` : piece.sound_requested ? `the brief asks for sound: ${piece.sound_why}` : `off: the brief does not ask for sound (${piece.sound_why}); the model's own audio invents speech` },
  elements: piece.elements.map((e) => ({ id: e.id, kind: e.kind, name: e.name, description: e.description, exact_text: e.exact_text, required: e.required, why_required: e.why_required, first_chunk: firstChunk(e.id),
    real: e.real,
    seed: PICTURES[e.id] ? { needed: true, why: `the user's picture (${PICTURES[e.id]})`, from: "user" } : realSeed(e) ? { needed: true, why: `a real ${e.kind} whose documented look matters (research gate: ${G.gate.why})`, from: "found photo" } : e.exact_text.length ? { needed: true, why: `must read exactly ${e.exact_text.map((t) => `"${t}"`).join(", ")} on its first appearance: video models misspell lettering from prose alone (the MCP's opening sign read "Peal & Sten")`, from: "made still" } : { needed: false, why: e.kind === "person" ? "a person: the prose describes them; later chunks take them from earlier frames" : "nothing about it must be exact: the prose describes it; later chunks take it from earlier frames" } })),
  bank: {},
  chunks: [],   // per chunk: the timeline (theory and fact), the references with their sources (the continuity map), the attempts
};
say(`  ${state.length_plan.why}\n  model: ${state.model.why}\n  audio: ${state.audio.why}`);
say(state.elements.map((e) => `  @${e.id} (${e.kind}, first in chunk ${e.first_chunk}): ${e.seed.needed ? "SEED" : "no seed"}: ${e.seed.why}`).join("\n"));
run.save();
const stEl = Object.fromEntries(state.elements.map((e) => [e.id, e]));

// ---- 3. the asset bank: seeds only. (1) the user's materials, (2) found photos of real things, (3) made stills ----
const realOnes = state.elements.filter((e) => e.seed.from === "found photo");
state.seed_sources = {
  user_materials: Object.keys(PICTURES).length ? { used: true, items: PICTURES } : { used: false, why: "none given" },
  found_photos: !G.gate.needs_research ? { used: false, why: `not needed: ${G.gate.fiction ? "fiction" : "nonfiction"}, no real thing whose look matters (research gate: ${G.gate.why})` } : !realOnes.length ? { used: false, why: `the gate asked for research (${G.gate.why}), but no element on screen is a specific real thing` } : { used: true, why: G.gate.why, items: {} },
  made_stills: { used: state.elements.some((e) => e.seed.from === "made still"), why: "only for what must be exact and cannot be found" },
};
// (2) found photos: composer/assets' Commons search and vision pick, given only the real elements (no generation)
let found = {};
if (realOnes.length && !DRY) {
  const kindOf = { person: "character", place: "place", product: "prop", prop: "prop" };
  const LA = rec.found_log = { mode: G.mode, research: G.research, story: { title: G.story?.title || "", style: piece.look, story: G.story?.story || brief }, medium: { person: "A photograph of a real person", object: "A photograph of an object", place: "A photograph of", cell: "a film still", frame: "A film still.", treatment: "Full colour." }, features: {}, voices: {},
    bank: { narrator: { source: "voice-only", voice: { preset: "alloy", sample: "(not made: keyref2 needs no voice)" } } },
    elements: realOnes.map((e) => ({ id: e.id.replace(/[^a-z0-9-]/g, "") || "x", name: e.name, aka: "", kind: kindOf[e.kind], real: true, searches: els[e.id].searches || [], look: e.description, setting: "", size_m: 1, dims: { length_m: 1, width_m: 1, height_m: 1 } })) };
  mkdirSync(run.path("refs"), { recursive: true });
  await runAssets({ log: LA, run: { ...run, save: run.save }, jobs, say, generate: false });
  llm("ref-pick-v2 (composer/assets)", "Commons search and vision pick for the real elements");
  for (const e of realOnes) { const b = LA.bank[e.id]; if (b?.source === "commons" && b.file) { found[e.id] = b; state.seed_sources.found_photos.items[e.id] = { file: b.file, title: b.title, page: b.page, license: b.license, artist: b.artist, search: b.search }; } else state.seed_sources.found_photos.items[e.id] = { file: null, why: "nothing usable on Commons" }; }
  run.save();
}
const seedQuestions = (e) => [
  ...e.exact_text.map((t) => ({ q: `Does lettering in this image read exactly "${t}" (every letter right)?`, required: true, kind: "exact text", text: t })),
  { q: `Does this image show: ${e.description}`, required: true, kind: "element" },
  ...(e.kind !== "person" ? [{ q: "Is the image free of people and of any readable text other than the exact lettering asked for?", required: true, kind: "clean" }] : []),
];
async function seed(e) {
  if (found[e.id]) { const b = found[e.id], f = `bank/${e.id}${extname(b.file)}`; copyFileSync(run.path(b.file), run.path(f)); return { file: f, source: `found photo: ${b.title} (${b.page}; licence ${b.license || "unstated"}${b.artist ? `; ${String(b.artist).replace(/<[^>]+>/g, "")}` : ""})`, page: b.page, license: b.license, credits: 0 }; }
  if (e.seed.from === "found photo" && !e.exact_text.length && !DRY) return null;   // a real thing not found is not painted: the prose carries it
  if (PICTURES[e.id]) { const f = `bank/${e.id}${extname(PICTURES[e.id])}`; copyFileSync(resolve(PICTURES[e.id]), run.path(f)); return { file: f, source: `the user's picture (${PICTURES[e.id]})`, credits: 0 }; }
  const qs = seedQuestions(e);
  for (const src of SEEDS) {
    const f = `bank/${e.id}.png`; copyFileSync(src, run.path(f));
    const v = await ask({ rec, stage: "seed", about: `@${e.id}: offered ${short(src)}`, questions: qs, images: [rel(f)], labels: [`@${e.id}`] }); llm("keyref2-vlm-v1", `check the offered seed for @${e.id}`);
    if (v.pass) { ff(`copy ${short(src)} into the bank as @${e.id}`, [short(src)], f); return { file: f, source: `reused ${short(src)} (painted on ${STILL_MODEL} in an earlier run, 10 credits then); passed this run's checks`, credits: 0, check: true }; }
  }
  const cost = stillCost(STILL_MODEL, STILL_RES), img = { model: STILL_MODEL, resolution: STILL_RES, aspect_ratio: "16:9" };
  const prompt = `Photographic 16:9 still. ${piece.look} ${e.description}${e.exact_text.length ? ` The lettering reads exactly ${e.exact_text.map((t) => `"${t}"`).join(", ")}, clean and legible.` : ""} No people, no captions, no other readable text.`;
  let best = null;
  for (let a = 1; a <= 2; a++) {
    const f = `bank/${e.id}-${a}.png`, p = a === 1 ? prompt : `${prompt} It must clearly show: ${best.v.answers.filter((x) => x.answer !== "yes").map((x) => x.q).join(" ")}`;
    if (!DRY) pay(`seed-${e.id}-${a}`, cost);
    const j = await jobs.image(`seed-${e.id}-${a}`, f, p, [], img);
    rec.tools.push({ tool: "image generator", endpoint: "/v1/ai-image-generator", model: STILL_MODEL, resolution: STILL_RES, prompt: p, credits: DRY ? 0 : j.credits || 0, output: f, for: `seed @${e.id}, attempt ${a}` });
    if (DRY) return { file: f, source: `painted on ${STILL_MODEL} (dry: estimated ${cost})`, credits: 0 };
    const v = await ask({ rec, stage: "seed", about: `@${e.id} attempt ${a}`, questions: qs, images: [rel(f)], labels: [`@${e.id}`] });
    const yes = (x) => x.answers.filter((q) => q.answer === "yes").length;
    if (!best || yes(v) > yes(best.v)) best = { f, v, a, credits: j.credits || 0 };
    if (v.pass) break;
  }
  return { file: best.f, source: `painted on ${STILL_MODEL}${best.a > 1 ? " (second attempt)" : ""}`, check: best.v.pass };
}
for (const e of state.elements.filter((x) => x.seed.needed)) {
  const s = await seed(e); if (!s) { e.seed.result = "not found; the prose carries it"; continue; }
  state.bank[e.id] = { ...s, why: e.seed.why, from: e.seed.from, for_chunk: e.first_chunk }; run.save();
  say(`  bank @${e.id} = ${state.bank[e.id].file} (${state.bank[e.id].source})`);
}

// ---- 4. per chunk: the continuity references, the prompt, the call, the checks ----
const pad = (t) => String(t).replace(".", "_").padStart(4, "0");
const grab = (file, t, tag) => { const f = `frames/${tag}-t${pad(t)}.png`; frameAt(run.path(file), t, run.path(f)); return f; };
const hadFrame = (j) => state.chunks[j - 1]?.attempts.find((a) => a.key === state.chunks[j - 1].chosen);
// Where the state says an entity was actually seen in earlier chunks: [{ chunk, t (chunk-relative), abs, frame }]
const sightings = (id, before) => state.chunks.filter((c) => c.n < before && c.chosen).flatMap((c) => c.timeline.filter((b) => b.actual?.[id]?.answer === "yes").map((b) => ({ chunk: c.n, t: b.t, abs: b.abs_t, frame: b.actual[id].frame })));

async function previousFrame(k) {
  const pc = state.chunks[k - 2], pa = hadFrame(k - 1), lastBeat = pc.timeline[pc.timeline.length - 1];
  const carry = lastBeat.entities, cands = [{ f: pa.frames.last, t: "last" }, ...pa.frames.strip.map((f, i) => ({ f, t: pa.frames.stripT[i] })).reverse()];
  const qs = [...carry.map((id) => ({ q: `Is ${els[id].name} (${els[id].description}) clearly visible?`, required: true, kind: "present", element: id })), ...carry.filter((id) => els[id].kind === "product").map((id) => ({ q: `Is there exactly one ${els[id].name}, held or resting, not floating or duplicated?`, required: true, kind: "one product", element: id })), ...carry.flatMap((id) => els[id].exact_text.map((t) => ({ q: `If "${t}" is legible, does it read exactly "${t}"? (yes if not legible)`, required: true, kind: "exact text", element: id })))];
  for (const c of cands.slice(0, 5)) {
    const v = await ask({ rec, stage: "previous", about: `chunk ${k - 1} at ${c.t === "last" ? "its last frame" : `${c.t} s`} as @previous for chunk ${k}`, questions: qs, images: [rel(c.f)], labels: [c.f] });
    if (v.pass) return { name: "previous", file: c.f, from: `chunk ${k - 1}, ${c.t === "last" ? "last frame" : `${c.t} s (the last frame failed a state check)`}`, why: `continuity: chunk ${k} picks up where chunk ${k - 1} ends; checked for ${carry.map((id) => `@${id}`).join(", ") || "the scene"}`, check: v.pass };
  }
  return { name: "previous", file: pa.frames.last, from: `chunk ${k - 1}, last frame`, why: `continuity; no recent frame passed every state check, so the last frame is used and the entities are attached from earlier frames`, check: false };
}
// An entity of chunk k seen in earlier chunks: search those frames, pick the clearest, confirm it, attach as @id.
async function frameRef(id, k) {
  const e = els[id], seen = sightings(id, k).slice(-6);
  if (!seen.length) return null;
  const i = seen.length > 1 ? await pick({ rec, entity: e, images: seen.map((s) => rel(s.frame)), labels: seen.map((s) => `chunk ${s.chunk} at ${s.t} s`) }) : 0, s = seen[i];
  const qs = [{ q: `Is ${e.name} clearly visible here: ${e.description}`, required: true, kind: "confirm" }, ...e.exact_text.map((t) => ({ q: `Does the lettering read exactly "${t}", every letter right?`, required: true, kind: "exact text" }))];
  const v = await ask({ rec, stage: "confirm", about: `@${id} from chunk ${s.chunk} at ${s.t} s`, questions: qs, images: [rel(s.frame)], labels: [`chunk ${s.chunk} at ${s.t} s`] });
  if (!v.pass) return { failed: `chunk ${s.chunk} at ${s.t} s did not pass (${v.answers.filter((a) => a.answer !== "yes").map((a) => a.evidence).join("; ")})` };
  return { name: id, file: s.frame, from: `chunk ${s.chunk} at ${s.t} s (${s.abs} s of the piece)`, why: `${e.name} was seen there (state: yes at that beat); the clearest of ${seen.length} sightings`, check: true };
}

const STRIP = (sec) => Array.from({ length: Math.ceil(sec / 2) }, (_, i) => 2 * i + 1).filter((t) => t < sec);
let stopped = null;
try {
  for (const ch of chunks) {
    const k = ch.n, refs = [], notes = [];
    const ids = [...new Set(ch.beats.flatMap((b) => b.entities))];
    if (k > 1 && !DRY) { refs.push(await previousFrame(k)); }
    if (k > 1 && DRY) refs.push({ name: "previous", file: `frames/chunk-${k - 1}-last.png`, from: `chunk ${k - 1}, last frame (dry: not made yet)`, why: "continuity" });
    for (const id of ids) {
      if (state.bank[id] && stEl[id].first_chunk === k) { refs.push({ name: id, file: state.bank[id].file, from: "asset bank (seed)", why: `first appearance; ${state.bank[id].why}` }); continue; }
      if (k === 1) continue;
      if (DRY) { notes.push(`@${id}: would be searched in earlier frames at the seconds the state saw it (dry)`); continue; }
      const r = await frameRef(id, k);
      if (r?.name) refs.push(r);
      else if (state.bank[id]) refs.push({ name: id, file: state.bank[id].file, from: "asset bank (seed, again)", why: r?.failed ? `no earlier frame passed: ${r.failed}` : "not seen in an earlier chunk" });
      else notes.push(`@${id}: no reference (${r?.failed || "first appears in this chunk; the prose describes it"})`);
    }
    for (const id of ids) if (!refs.some((r) => r.name === id)) notes.push(k === 1 ? `@${id}: no reference: first appearance, nothing exact about it; the prose describes it` : `@${id}: not attached`);
    if (refs.length > 9) { notes.push(`capped at 9 references (${refs.slice(9).map((r) => `@${r.name}`).join(", ")} dropped)`); refs.length = 9; }
    const refNames = Object.fromEntries(refs.filter((r) => r.name !== "previous").map((r) => [r.name, true]));
    const assembled = assemble(piece, ch.beats, { refs: refNames, previous: k > 1, audio: AUDIO });
    const { prompt, shortened } = await fit(assembled, refs.map((r) => `@${r.name}`));
    const t0 = ch.beats[0].from;
    const c = { n: k, from: ch.from, to: ch.to, seconds: ch.seconds, refs, notes, prompt, prompt_chars: prompt.length, shortened,
      timeline: ch.beats.map((b) => ({ from: b.from - t0, to: b.to - t0, abs_from: b.from, abs_to: b.to, t: Math.round(((b.from + b.to) / 2 - t0) * 2) / 2, abs_t: Math.round((b.from + b.to) / 2 * 2) / 2, text: b.text, entities: b.entities, legible_text: b.legible_text })),
      attempts: [] };
    state.chunks.push(c); run.save();
    say(`--- chunk ${k} (${ch.from}–${ch.to} s, ${ch.seconds} s; ${prompt.length} chars) refs: ${refs.map((r) => `@${r.name} ← ${r.from}`).join("; ") || "none"}${notes.length ? `\n  ${notes.join("\n  ")}` : ""}`);
    let failure = null;
    for (let a = 1; a <= 2; a++) {
      const p = failure ? (await fit(`${prompt} A first attempt failed; this time: ${failure.map((f) => f.kind === "one product" ? `one ${els[f.element]?.name || "product"} only, always in someone's hands or resting, never floating or doubled` : f.kind === "exact text everywhere" || f.kind === "exact text" ? `the lettering reads exactly "${f.text}" in every shot it is legible, never misspelled (it read "${f.evidence}")` : f.q).join("; ")}.`, refs.map((r) => `@${r.name}`))).prompt : prompt;
      const key = a === 1 ? `chunk-${k}` : `chunk-${k}-retry`, file = `chunks/${key}.mp4`, cost = videoCost(ch.seconds, MODEL, VRES, AUDIO);
      const att = { attempt: a, key, file, prompt: p, prompt_chars: p.length, model: MODEL, seconds: ch.seconds, cost, failure_named: failure?.map((f) => f.q) || null };
      c.attempts.push(att); run.save();
      if (a === 1) say(prompt);
      if (DRY) { await jobs.tvideo(key, file, p, refs.map(({ name, file }) => ({ name, file })), ch.seconds, VIDEO); att.estimated = cost; break; }
      try { pay(key, cost); } catch (e) { if (a === 1) throw e; att.skipped = String(e.message); say(`  regeneration skipped: ${att.skipped}`); break; }
      const j = await jobs.tvideo(key, file, p, refs.map(({ name, file }) => ({ name, file })), ch.seconds, VIDEO);
      att.credits = j.credits || 0; att.cached = !!j.cached;
      rec.tools.push({ tool: "text-to-video", endpoint: "/v1/text-to-video", model: MODEL, resolution: VRES, audio: AUDIO, seconds: ch.seconds, inputs: refs.map((r) => `@${r.name}=${r.file}`), prompt: p, credits: att.credits, cached: att.cached, output: file, for: `chunk ${k}${a > 1 ? " (regeneration)" : ""}` });
      // frames: first, last, every 2 s from 1 s, and one at each beat's timestamp
      const dur = duration(run.path(file)), stripT = STRIP(dur);
      att.frames = { rendered: Math.round(dur * 10) / 10, first: `frames/${key}-first.png`, last: null, strip: stripT.map((t) => grab(file, t, key)), stripT };
      frameAt(run.path(file), 0, run.path(att.frames.first)); att.frames.last = `frames/${key}-last.png`; frameAt(run.path(file), -0.1, run.path(att.frames.last));
      const beatFrames = c.timeline.map((b) => grab(file, Math.min(b.t, dur - 0.1), key));
      ff(`frames of ${key}: first, last, every 2 s from 1 s, each beat's timestamp`, [file], [att.frames.first, ...att.frames.strip, att.frames.last, ...beatFrames]);
      // (a) the timeline: at each beat's timestamp, is each entity the prose puts there actually there?
      const tq = c.timeline.flatMap((b, i) => b.entities.map((id) => ({ q: `In image ${i + 1} (${b.t} s): is ${els[id].name} visible (${els[id].description})?`, required: false, kind: "timeline", beat: i, element: id })));
      att.timeline = await ask({ rec, stage: "timeline", about: `${key}: the entities the prose puts at each beat's timestamp`, questions: tq, images: beatFrames.map(rel), labels: c.timeline.map((b) => `${b.t} s (beat ${b.from}–${b.to} s)`) });
      att.beat_frames = beatFrames;
      // (b) the whole chunk: exact text, one product, the same people, the ending
      const imgs = [...att.frames.strip, att.frames.last];
      att.check = await ask({ rec, stage: "chunk", about: `${key}: exact text, one product, the same people, the ending`, questions: chunkQuestions(ch, piece, k === chunks.length), images: imgs.map(rel), labels: [...stripT.map((t) => `${t} s`), "last frame"] });
      llm("keyref2-vlm-v1", `checks of ${key} (timeline + chunk)`); run.save();
      const fails = att.check.answers.filter((x) => x.required && x.answer !== "yes");
      say(`  ${key}: ${att.frames.rendered} s, ${att.credits} credits; timeline ${att.timeline.answers.filter((x) => x.answer === "yes").length}/${tq.length} yes; checks ${att.check.pass ? "all required yes" : `FAILED: ${fails.map((f) => `${f.kind} (${f.evidence})`).join("; ")}`}`);
      if (att.check.pass) break;
      failure = fails;
      if (a === 1) att.retry_reason = `required check failed: ${fails.map((f) => f.q).join(" | ")}; no cheaper fix (the lettering and objects are inside the generated picture), so one regeneration with the failure named`;
    }
    if (DRY) { c.chosen = c.attempts[0].key; continue; }
    const made = c.attempts.filter((x) => x.check), sc = (x) => x.check.answers.filter((q) => q.required && q.answer === "yes").length;
    const best = made.reduce((b, x) => (sc(x) > sc(b) ? x : b), made[0]);
    c.chosen = best.key;
    c.timeline.forEach((b, i) => { b.actual = Object.fromEntries(b.entities.map((id) => { const a = best.timeline.answers.find((x) => x.beat === i && x.element === id); return [id, { answer: a?.answer || "unclear", frame: best.beat_frames[i], evidence: a?.evidence || "" }]; })); });
    c.first = best.frames.first; c.last = best.frames.last;
    run.save();
  }
} catch (e) { if (!(e instanceof Budget) && !/credit cap/.test(String(e))) throw e; stopped = String(e.message || e); say(`STOPPED: ${stopped}`); }

// ---- 5. the film ----
if (DRY) {
  rec.estimate = { jobs: jobs.estimated, total: jobs.estimated.reduce((a, b) => a + b.cost, 0), budget: BUDGET, note: "a regeneration, if a required check fails, costs the chunk again and runs only if the budget allows" };
  say(`== dry run: ${jobs.estimated.map((x) => `${x.key} ${x.cost}`).join(", ") || "nothing paid"} → ${rec.estimate.total} credits (budget ${BUDGET})`);
} else if (!stopped && state.chunks.length === chunks.length && state.chunks.every((c) => c.chosen)) {
  const files = state.chunks.map((c) => c.attempts.find((a) => a.key === c.chosen).file);
  rec.outputs = { chunks: files };
  if (files.length === 1) { rec.outputs.film = files[0]; rec.outputs.join = "none: one chunk"; }
  else { const film = "chunks/film.mp4"; stitch(files.map((f) => run.path(f)), run.path("chunks/concat.txt"), run.path(film)); ff("join (normalise to 1280×720, concat)", files, film); rec.outputs.film = film; rec.outputs.join = "ffmpeg concat"; }
  rec.outputs.film_seconds = Math.round(duration(run.path(rec.outputs.film)) * 10) / 10;
  say(`film: runs/${label}/${rec.outputs.film} (${rec.outputs.film_seconds} s)`);
}
rec.stopped = stopped; rec.credits = jobs.spent(); rec.paid_calls = rec.calls.filter((c) => c.credits).length; rec.llm_usage = { ...usage }; run.save();
say(`credits this run: ${rec.credits} in ${rec.paid_calls} paid call(s)`);
