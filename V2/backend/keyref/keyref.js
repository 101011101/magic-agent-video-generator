// KEY REFERENCES (T-058 case 3, a separate test pipeline): the video model composes every clip; we only feed it the key
// references a clip cannot do without. story → screenplay in clip batches (sized by the video model's longest clip) →
// a small state manager (the element table; per clip the references it needs: reference stills made once and reused, and
// for every clip after the first the previous clip's LAST FRAME as @previous) → specific yes/no vision checks (each
// reference before it is sent; each last frame against what the next clip must continue; each clip's opening frames
// against its continuity list) → one text-to-video call per clip with its references bound by @name → an ffmpeg stitch.
// Imports from lib/ and composer/ only; edits nothing there.
import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../lib/llm.js";
import { video as videoModel, stillCost, videoCost } from "../lib/models.js";
import { duration, ssim, stitch } from "../lib/media.js";
import { PROMPT_LIMIT, PROMPT_TARGET } from "../composer/direct/direct.js";

export const STILL = { place: "qwen-image-2.1", product: "qwen-image-2.1", prop: "qwen-image-2.1", person: "flux-2-klein" };   // qwen letters well (the sign); klein is half the price for a person
export const STILL_RES = "640px";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "ref";

// A frame at a time (seconds; negative = from the end), as PNG.
export function frameAt(video, t, out) {
  const a = t < 0 ? ["-sseof", String(t)] : ["-ss", String(t)];
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a, "-i", video, "-frames:v", "1", "-update", "1", out]); return out;
}

// ---- 1. the screenplay as clip batches -------------------------------------------------------------------------------
export function clipLengths(total, n, model) {
  const g = videoModel(model).grid, top = Math.max(...g), snap = (w) => g.reduce((b, x) => (Math.abs(x - w) < Math.abs(b - w) ? x : b), g[0]);
  const out = []; let left = total; for (let k = 0; k < n; k++) { const s = snap(k === n - 1 ? left : Math.round(total / n)); out.push(s); left -= s; }
  return { lengths: out, top, fits: out.every((s) => s <= top && g.includes(s)) };
}

const ELEMENT = S.obj({ id: S.str, kind: S.enum(["place", "product", "person", "prop"]), name: S.str, look: S.str, lettering: S.arr(S.str), needs_reference: S.bool, why: S.str, reference_prompt: S.str, must_show: S.arr(S.str) });
const CLIP = S.obj({ n: S.int, seconds: S.num, summary: S.str, beats: S.arr(S.obj({ t: S.str, action: S.str })), on_screen: S.arr(S.str), states: S.arr(S.obj({ id: S.str, state: S.str })), spoken: S.arr(S.obj({ who: S.str, words: S.str })), words_on_screen: S.arr(S.str), sound: S.str, continuity: S.arr(S.str), ends_on: S.str });

export async function writeScreenplay({ brief, story, lengths, model, say }) {
  const n = lengths.length;
  const sp = await jsonCall({ name: "keyref-screenplay-v1", effort: "medium", schema: S.obj({ title: S.str, look: S.str, elements: S.arr(ELEMENT), clips: S.arr(CLIP) }), prompt: `Write the screenplay of a short film as exactly ${n} clip batches. Each batch is ONE text-to-video generation on ${model} (it composes the shot, moves the camera, makes the sound, letters short words); the batches play back to back. A batch must be something one generation can carry: one continuous shot or at most one simple camera move, a few beats, nothing that needs a cut inside it.

BRIEF (the contract): ${brief}
STORY: ${story.title || ""} (${story.kind || ""}; style: ${story.style || ""})
${story.story || ""}

THE BATCHES: ${lengths.map((s, i) => `clip ${i + 1}: ${s} s`).join(", ")}. Clip k+1 starts from clip k's LAST FRAME (it is attached to the call as a picture): clip k must END on a frame that clip k+1 can pick up mid-action (the same people, place and light), and clip k+1 must not re-introduce what is already there.

ELEMENTS: the things that must stay the same across clips or must be exactly right: the place(s), the product(s), the people. id: one lowercase word (it becomes the reference's @name). look: one visual sentence (colours, clothes, materials) that every prompt reuses verbatim. lettering: exact strings that must be spelled on the element (the shop sign), else empty.
needs_reference: whether a still of this element is painted first and fed to the video model. TRUE only for what the prose alone gets wrong and the film is judged on: the place the film must be recognised in (its look and its lettered sign) and the product the ad sells as it must look at its key moment. FALSE for people (a person who recurs is carried into the next clip by the previous clip's last frame; the video model invents them well from the look sentence) and for anything incidental. At most 3 elements need a reference; fewer is better. why: one line.
reference_prompt (when needs_reference): a complete description to paint ONE still of the element alone, 16:9, photographic, in the film's light: a place as an empty establishing plate (no people), with every lettered string in quotes; a product as it looks at its key moment, on a plain surface, no people. Empty when needs_reference is false.
must_show: 2–4 short facts a viewer can check on that still with yes/no (e.g. "a sign reading exactly 'X'", "no people", "white peonies"); empty when needs_reference is false.

CLIPS (exactly ${n}, seconds exactly as given): summary; beats: 2–4 timed beats from the clip's own start ("0–3 s") saying what is seen and what moves; on_screen: the element ids visible in the clip; states: the state of each changing element in this clip (the bouquet as loose stems, then wrapped), where it matters; spoken: at most one short line in the whole film, exact words, only if it helps the ad (else empty: then nobody speaks); words_on_screen: exact on-screen strings beyond the element's own lettering (usually none; no captions); sound: one line of what is heard (ambience, soft music, the line if any); continuity: for clip 1 empty; for clip k>1 the 2–5 concrete things that must carry over from clip k-1's last frame (who, what they hold, where, the light); ends_on: what the LAST frame shows, concretely.
Also: title; look: one opening sentence fixing the medium and the look, used in every prompt.` });
  sp.clips = sp.clips.slice(0, n); sp.clips.forEach((c, i) => { c.n = i + 1; c.seconds = lengths[i]; });
  for (const e of sp.elements) e.id = slug(e.id);
  return sp;
}

// Can the tool carry each batch? Deterministic checks, recorded.
export function checkBatches(sp, model, maxRefsPlanned) {
  const m = videoModel(model), top = Math.max(...m.grid);
  return sp.clips.map((c) => {
    const words = c.spoken.reduce((a, s) => a + s.words.split(/\s+/).filter(Boolean).length, 0);
    const checks = [
      { check: `${c.seconds} s is on ${model}'s grid (max ${top} s)`, ok: m.grid.includes(c.seconds) && c.seconds <= top },
      { check: `${c.beats.length} beats fit ${c.seconds} s (at most one per 2 s)`, ok: c.beats.length <= Math.ceil(c.seconds / 2) },
      { check: `${words} spoken words fit ${c.seconds} s (about 2.3 words a second)`, ok: words <= c.seconds * 2.3 },
      { check: `references planned ${maxRefsPlanned[c.n - 1] ?? 0} ≤ ${m.maxRefs}`, ok: (maxRefsPlanned[c.n - 1] ?? 0) <= m.maxRefs },
    ];
    return { clip: c.n, ok: checks.every((x) => x.ok), checks };
  });
}

// ---- 2. the vision checks: specific yes/no questions, never a general review ----------------------------------------
export async function ask({ rec, stage, about, questions, images, labels }) {
  const r = await jsonCall({ name: "keyref-vlm-v1", effort: "low", schema: S.obj({ answers: S.arr(S.obj({ q: S.str, answer: S.enum(["yes", "no", "unclear"]), evidence: S.str })) }), images: images.map((x) => x.path), prompt: `Answer ONLY the numbered questions below about the attached image${images.length > 1 ? "s" : ""}, one answer per question, in order. Do not review or describe the images otherwise. "yes" only if it is clearly true in the picture; evidence: a few words of what you actually see (transcribe any lettering you are asked about exactly).
${images.length > 1 ? `The images, in order: ${labels.map((l, i) => `image ${i + 1} = ${l}`).join("; ")}.\n` : ""}
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` });
  const answers = questions.map((q, i) => ({ q, answer: r.answers[i]?.answer || "unclear", evidence: r.answers[i]?.evidence || "" }));
  const entry = { stage, about, images: images.map((x) => x.rel), labels, answers, pass: answers.every((a) => a.answer === "yes") };
  rec.vlm.push(entry); return entry;
}

// ---- 3. the prompt of one clip --------------------------------------------------------------------------------------
export async function writePrompt({ sp, clip, refs, model, audio }) {
  const els = Object.fromEntries(sp.elements.map((e) => [e.id, e]));
  const p = await jsonCall({ name: "keyref-prompt-v1", effort: "medium", schema: S.obj({ prompt: S.str }), prompt: `Write the prompt for ONE text-to-video generation (${model}, ${clip.seconds} s, 16:9, ${audio ? "sound generated by the model" : "no sound"}). Prose, no headings, ${Math.min(1100, PROMPT_TARGET - 400)}–${PROMPT_TARGET} characters (hard limit ${PROMPT_LIMIT}).
Start with this sentence verbatim: "${sp.look}"
${refs.length ? `Reference pictures attached to the call, each bound ONLY if its @name appears in the prompt: ${refs.map((r) => `@${r.name} = ${r.role}`).join("; ")}. Use each @name exactly where it governs the picture${refs.some((r) => r.name === "previous") ? ` (begin the action with: "Continue directly from @previous, the last frame of the previous shot: the same people, place, light and camera, picked up mid-action; nothing re-introduced.")` : ""}; e.g. "the shop front, its sign and window exactly as in @shopfront".` : "No reference pictures are attached: describe everything in words; never mention a reference."}
THE CLIP: ${clip.summary}
Beats (timed from the clip's start): ${clip.beats.map((b) => `${b.t}: ${b.action}`).join(" | ")}
Who and what is on screen, described the same way in every clip: ${clip.on_screen.map((id) => els[id] ? `${els[id].name}: ${els[id].look}${els[id].lettering.length ? ` (lettering exactly: ${els[id].lettering.map((s) => `"${s}"`).join(", ")})` : ""}` : id).join("; ")}
States: ${clip.states.map((s) => `${s.id}: ${s.state}`).join("; ") || "none"}
${clip.continuity.length ? `Must carry over from the previous shot: ${clip.continuity.join("; ")}` : ""}
Spoken: ${clip.spoken.length ? clip.spoken.map((s) => `${s.who} says exactly: "${s.words}"`).join("; ") : "nobody speaks; no voices, no dialogue, no narration"}
Sound: ${clip.sound}
On-screen text: ${clip.words_on_screen.length ? clip.words_on_screen.map((w) => `"${w}"`).join(", ") : "none beyond the lettering on the place itself"}
The last frame shows: ${clip.ends_on}
End with the constraints: one continuous shot, no cuts; no captions, subtitles or extra text; ${clip.spoken.length ? "no other speech" : "no speech of any kind"}; the same people throughout.` });
  let prompt = p.prompt;
  for (const r of [...refs].reverse()) if (!prompt.includes(`@${r.name}`)) prompt = (r.name === "previous" ? "Continue directly from @previous, the last frame of the previous shot: the same people, place and light, mid-action. " : `Match @${r.name}. `) + prompt;   // the API binds a reference only by its @name
  if (prompt.length > PROMPT_LIMIT) prompt = prompt.slice(0, PROMPT_LIMIT - 1);
  return prompt;
}

export { stillCost, videoCost, duration, ssim, stitch, existsSync, mkdirSync };
