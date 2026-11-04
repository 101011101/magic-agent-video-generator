// KEY REFERENCES v2 (T-058 case 3; a separate test pipeline beside backend/keyref, which stays as it was).
// The Magic Hour MCP baseline (one text-to-video call, one prose prompt of timed shots, audio off) beat keyref-1's two
// clips on the flower brief. v2 starts from the MCP's shape and keeps only what earns its place:
//   1. PROMPT FIRST: the whole piece as one prose prompt with timestamps (look, subject, element descriptions, timed beats
//      "0–4 s: …", exact words, the "no"s). It is cut into chunks ONLY when needed (longer than one generation of the
//      model, or --clips N), at beat boundaries; a chunk's prompt = the shared lines + its beats retimed from 0.
//   2. STATE: what is theoretically on screen in each chunk at each timestamp (entities per beat, from the prose), and,
//      after generation, what actually is (yes/no vision questions at those timestamps), plus first and last frames.
//   3. ASSET BANK, only for SEEDING: the first appearance of something that must look specific (the user's pictures; an
//      exact sign or label: painted once on qwen-image-2.1, checked, reused). Nothing else is painted.
//   4. Every other reference comes from earlier frames: for chunk k>1 the state says at which seconds each entity was
//      seen; those frames are searched, the clearest is confirmed by the vision model and attached as @name; plus
//      @previous = the last frame (or an earlier frame when the last fails a state check).
//   5. The continuity map: per chunk, every reference, where it came from (bank seed, or chunk j at t s) and why.
// Model: ltx-2.5 when no chunk carries a reference; minimax-h3 otherwise (ltx-2.5's references are undocumented and were
// not probed). Audio off unless the brief asks for sound. ffmpeg joins only when there is more than one chunk.
// Imports from lib/ only.
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../lib/llm.js";
import { video as videoModel, stillCost, videoCost } from "../lib/models.js";
import { duration, stitch } from "../lib/media.js";

export const PROMPT_LIMIT = 2000, PROMPT_TARGET = 1750;   // Magic Hour refuses style.prompt over 2,000 characters
export const STILL_MODEL = "qwen-image-2.1", STILL_RES = "640px";   // qwen letters well (4 of 4 exact in runs/probe-lettering)
export const NO_REF_MODEL = "ltx-2.5", REF_MODEL = "minimax-h3";
export const LTX_REFS = "ltx-2.5's named references are 'not documented' (reference/magic-hour-api-sheet.md table 3.1; lib/models.js refs: \"undocumented\"), so no credits were spent probing them: minimax-h3 carries any piece with a reference (up to 9 images, measured)";
export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "ref";
export const topSeconds = (model) => Math.max(...videoModel(model).grid);

export function frameAt(video, t, out) {
  const a = t < 0 ? ["-sseof", String(t)] : ["-ss", String(t)];
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a, "-i", video, "-frames:v", "1", "-update", "1", out]); return out;
}

export const RULES = [
  "Prompt first: the whole piece is written as one prose prompt with timestamps; it is cut into chunks only when it is longer than one generation (ltx-2.5 60 s, minimax-h3 30 s) or --clips forces it, at beat boundaries.",
  "Each chunk's prompt = the shared lines (look, subject, the descriptions of the elements in it, exact words, the \"no\"s) + its beats retimed from 0.",
  "Asset bank, for seeding only: the first appearance of something that must look specific. Seeds come from, in order: (1) the user's materials; (2) found real-world photos (Wikimedia Commons search + vision pick, composer/assets) when the research gate (composer/story) says a real thing appears; (3) a still made on qwen-image-2.1, yes/no-checked, only for what must be exact and cannot be found (a fictional shop's sign). Nothing else is painted.",
  "Every other reference comes from earlier frames: for chunk k>1, the frames of earlier chunks at the seconds the state says an entity was seen are searched; the clearest is vision-confirmed and attached as @name.",
  "Chunk k>1 also gets @previous: the last frame of chunk k-1, or the latest earlier frame that passes the state checks.",
  "Model: ltx-2.5 when no chunk carries a reference; minimax-h3 otherwise. Audio off unless the brief asks for sound.",
  "After each chunk: yes/no questions at each beat's timestamp (is each expected entity there?) and over the whole chunk (exact text everywhere, one product, the same people, the ending); one regeneration with the failure named if a required check fails, within the run's budget.",
  "ffmpeg joins only when there is more than one chunk.",
];

// ---- 1. the whole piece as one timed prose prompt (structured so it can be cut at beat boundaries) -------------------
const ELEMENT = S.obj({ id: S.str, kind: S.enum(["person", "place", "product", "prop"]), name: S.str, description: S.str, exact_text: S.arr(S.str), required: S.bool, why_required: S.str, real: S.bool, searches: S.arr(S.str) });
const BEAT = S.obj({ from: S.int, to: S.int, text: S.str, entities: S.arr(S.str), legible_text: S.arr(S.str) });
export async function writePiece({ brief, research = null }) {
  const p = await jsonCall({ name: "keyref2-piece-v1", effort: "medium", schema: S.obj({ seconds: S.int, seconds_why: S.str, sound_requested: S.bool, sound_why: S.str, look: S.str, subject: S.str, elements: S.arr(ELEMENT), beats: S.arr(BEAT), ends_on: S.str, nos: S.arr(S.str) }), prompt: `Write the prompt of a short video as ONE prose text-to-video prompt with timestamps, the way a strong director prompts a video model: an ad that one generation renders as 3–5 shots joined by natural edits. The brief is the contract: everything it asks for, in its order, nothing it does not. It is returned in parts so it can be cut at beat boundaries; read in order the parts must form one fluent prompt of at most 1,500 characters in all (the API refuses 2,000): look ≤ 20 words, subject ≤ 25 words, each description ≤ 25 words, each beat's text ≤ 40 words, each "no" ≤ 12 words. Beat text never repeats its own timestamp (it is added in front).

BRIEF: ${brief}
${research ? `RESEARCH (facts and documented looks; use them, invent nothing about real things):\n${(research.facts || []).map((f) => `- ${f.fact} [${f.source}]`).join("\n")}\n${(research.looks || []).map((l) => `- look of ${l.thing}: ${l.look} [${l.source}]`).join("\n")}\n` : ""}
- seconds: the length the brief asks for (integer); if none, the shortest length that tells it well (5–15 s). seconds_why: where it comes from.
- sound_requested: true only if the brief asks for sound, music, a voice or speech; sound_why: the brief's words that decide it.
- look: ONE sentence fixing the medium, aspect and look in the brief's own words (e.g. "Photorealistic widescreen 16:9 ad, warm natural dawn light, …").
- subject: ONE sentence: who and what the piece is about.
- elements: the people, places and products the brief needs on screen (props only when the story turns on them). id: one lowercase word (it may become a reference's @name). name: how the beats call it ("the florist"). description: one full sentence that introduces it with its fixed look (colours, clothes, materials), naming it as the beats do. exact_text: strings that must be spelled exactly on it (a shop sign, a label), only if the brief names them. required: true when the brief depends on it being seen; why_required: the brief's words. real: true only for a specific real person, place, building, vessel or object whose documented look matters (false for anything invented, such as a fictional shop or its staff); searches: 2–3 Wikimedia Commons searches for a photograph of it when real, else empty.
- beats: 3–5 timed shots covering 0 to seconds exactly, integer seconds, no gaps, in the brief's order. text: one or two sentences of prose for the shot: what is seen and what moves (show each action the brief names literally: "opens the shop" = unlocks and opens the front door from outside; "arranges" = gathers loose stems into one bouquet and wraps it), framing, camera move, light. A product that changes state (loose stems → wrapped bouquet) is ONE object throughout: say so. entities: the element ids visible in the shot. legible_text: exact strings legible in this shot. Lettering must be legible in few, deliberate shots (best: the shot the brief names, e.g. the ending); elsewhere keep it out of frame or not legible.
- ends_on: the final frame in one sentence.
- nos: what must not happen, short, never forbidding the cuts between shots (e.g. "no captions, subtitles or other readable text", "no speech or voiceover", "no second or floating bouquet: one bouquet, always held or resting").` });
  for (const e of p.elements) e.id = slug(e.id);
  const ids = new Set(p.elements.map((e) => e.id));
  for (const b of p.beats) { b.entities = [...new Set(b.entities.map(slug).filter((x) => ids.has(x)))]; b.text = b.text.replace(/^\s*\d+\s*[–-]\s*\d+\s*(s|sec|seconds)?\s*[:.,-]\s*/i, ""); }
  p.beats.sort((a, b) => a.from - b.from); p.beats.forEach((b, i) => { if (i === 0) b.from = 0; else b.from = p.beats[i - 1].to; }); p.beats[p.beats.length - 1].to = p.seconds;
  return p;
}

// The prompt of a chunk (or of the whole piece): the shared lines + the beats retimed from 0 + the @names it carries.
export function assemble(piece, beats, { refs = {}, previous = false, audio = false } = {}) {
  const t0 = beats[0].from, ids = new Set(beats.flatMap((b) => b.entities)), texts = [...new Set(beats.flatMap((b) => b.legible_text))];
  const els = piece.elements.filter((e) => ids.has(e.id));
  const nos = [...piece.nos, audio ? "" : "silent: no speech, no voiceover"].filter(Boolean).map((x) => x.replace(/[.;\s]+$/, ""));
  return [
    piece.look.trim(),
    `${piece.subject.trim().replace(/\.?$/, ".")} Same people, place and product throughout.`,
    previous ? "Continue directly from @previous: the same people, place, light and camera, mid-action; re-introduce nothing." : "",
    ...els.map((e) => `${e.description.trim().replace(/\.?$/, ".")}${refs[e.id] ? ` ${e.name[0].toUpperCase()}${e.name.slice(1)} matches @${e.id}.` : ""}`),
    ...beats.map((b) => `${b.from - t0}–${b.to - t0} s: ${b.text.trim()}`),
    texts.length ? texts.map((t) => `Wherever it is legible the lettering reads exactly "${t}", every letter right.`).join(" ") : "",
    `${nos.map((x, i) => (i ? x[0].toLowerCase() + x.slice(1) : x)).join("; ")}.`,
  ].filter(Boolean).join(" ");
}

export async function fit(prompt, keep) {
  if (prompt.length <= PROMPT_LIMIT) return { prompt, shortened: false };
  const c = await jsonCall({ name: "keyref2-shorten-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite this video prompt under ${PROMPT_TARGET} characters. Keep every quoted string, every @name (${keep.join(", ") || "none"}), every timestamp and its beat, the first sentence and the closing "no"s; cut adjectives and repetition.\n\n${prompt}` });
  return { prompt: c.prompt.length <= PROMPT_LIMIT ? c.prompt : c.prompt.slice(0, PROMPT_LIMIT), shortened: true };
}

// ---- 2. chunks: only when needed, at beat boundaries -------------------------------------------------------------------
export function chunk(piece, top, forced = null) {
  const B = piece.beats, ends = B.map((b) => b.to);
  const cuts = [];   // the index of the beat each chunk ends on
  if (forced && forced > 1) {
    if (B.length < forced) throw new Error(`${forced} chunks asked for, but the prompt has only ${B.length} beats`);
    let lo = 0;
    for (let k = 1; k < forced; k++) { const target = (piece.seconds * k) / forced; let best = -1; for (let j = lo; j < B.length - (forced - k); j++) if (best < 0 || Math.abs(ends[j] - target) < Math.abs(ends[best] - target)) best = j; cuts.push(best); lo = best + 1; }
  } else {
    let start = 0;
    B.forEach((b, i) => { if (b.to - b.from > top) throw new Error(`beat ${b.from}–${b.to} s is longer than one generation (${top} s)`); if (b.to - start > top) { cuts.push(i - 1); start = b.from; } });
  }
  cuts.push(B.length - 1);
  let s = 0;
  return cuts.map((c, k) => { const beats = B.slice(s, c + 1); s = c + 1; return { n: k + 1, from: beats[0].from, to: beats[beats.length - 1].to, seconds: beats[beats.length - 1].to - beats[0].from, beats }; });
}

// ---- 3. the vision checks: fixed yes/no questions, never a general review ---------------------------------------------
export async function ask({ rec, stage, about, questions, images, labels }) {
  const r = await jsonCall({ name: "keyref2-vlm-v1", effort: "low", images: images.map((x) => x.path), schema: S.obj({ answers: S.arr(S.obj({ q: S.str, answer: S.enum(["yes", "no", "unclear"]), frames: S.arr(S.int), evidence: S.str })) }), prompt: `Answer ONLY the numbered questions below about the attached image${images.length > 1 ? "s" : ""}, one answer per question, in order: yes, no or unclear; "frames" = the image numbers (1–${images.length}) the answer rests on; "evidence" = what you see, in a few words (transcribe any lettering exactly as it reads, letter by letter). Be strict: a misspelled or partly legible word is not "exactly".
${images.length > 1 ? `The images, in order: ${labels.map((l, i) => `${i + 1} = ${l}`).join("; ")}.\n` : ""}
${questions.map((q, i) => `${i + 1}. ${q.q}`).join("\n")}` });
  const answers = questions.map((q, i) => ({ ...q, answer: r.answers[i]?.answer || "unclear", frames: r.answers[i]?.frames || [], evidence: r.answers[i]?.evidence || "" }));
  const entry = { stage, about, images: images.map((x) => x.rel), labels, answers, pass: answers.filter((a) => a.required).every((a) => a.answer === "yes") };
  rec.vlm.push(entry); return entry;
}

// Which of several frames shows an entity most clearly (for a reference taken from earlier frames).
export async function pick({ rec, entity, images, labels }) {
  const r = await jsonCall({ name: "keyref2-pick-v1", effort: "low", images: images.map((x) => x.path), schema: S.obj({ index: S.int, evidence: S.str }), prompt: `Which of the ${images.length} images (1–${images.length}) shows this most clearly and completely: ${entity.description} Answer only the index and a few words of evidence. The images: ${labels.map((l, i) => `${i + 1} = ${l}`).join("; ")}.` });
  const i = Math.min(images.length, Math.max(1, r.index)) - 1;
  rec.vlm.push({ stage: "pick", about: `the clearest earlier frame of @${entity.id}`, images: images.map((x) => x.rel), labels, answers: [{ q: `Which image shows ${entity.name} most clearly?`, answer: `image ${i + 1} (${labels[i]})`, evidence: r.evidence, required: false }], pass: true });
  return i;
}

// The whole-chunk questions: exact text (present where the prose says, and right everywhere), one product, the same
// people, the ending (last chunk). Per-beat presence questions are asked separately at each beat's timestamp.
export function chunkQuestions(ch, piece, last) {
  const ids = new Set(ch.beats.flatMap((b) => b.entities)), els = piece.elements.filter((e) => ids.has(e.id)), q = [];
  for (const t of [...new Set(ch.beats.flatMap((b) => b.legible_text))]) q.push({ q: `Does lettering that reads exactly "${t}" appear in at least one image?`, required: true, kind: "exact text", text: t });
  for (const e of els) for (const t of e.exact_text) q.push({ q: `Wherever the name "${t}" (or an attempt at it) is legible, in every image, does it read exactly "${t}"? Answer no if any instance is misspelled.`, required: true, kind: "exact text everywhere", element: e.id, text: t });
  for (const e of els.filter((x) => x.kind === "product")) q.push({ q: `Is there only ever one ${e.name} in each image, always held or resting on something (never duplicated, never floating unsupported)?`, required: true, kind: "one product", element: e.id });
  for (const e of els.filter((x) => x.kind === "person")) q.push({ q: `Is ${e.name} the same person in every image they appear in (same face, hair and clothes)?`, required: true, kind: "same person", element: e.id });
  if (last) q.push({ q: `Does the last image show: ${piece.ends_on}?`, required: true, kind: "ending" });
  return q;
}

export { stillCost, videoCost, duration, stitch };
