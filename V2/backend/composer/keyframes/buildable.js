// Is a keyframe buildable in one shot on the model it is painted with? Like any request: the frame's prompt is split.
// When it needs readable words (a sign, a nameplate, a label) and the paint model letters poorly, the model paints the
// SCENE prompt: the whole frame prompt with all its context, minus the lettering (the words are not in it at all; a
// prompt that still held them, even saying "leave it blank", got them painted and misspelled: "ECCON TALK"); then a model
// that letters well writes the words onto the painted frame. Every frame is then READ: a word missing or misspelled, or
// lettering nobody asked for (klein's "Maso 909" nameplate in every frame of the podcast film), gets one fix on the
// lettering model. On a model that letters well the frame is one shot, and still read. The gates run on the final frame.
import { copyFileSync } from "node:fs";
import { size } from "../../lib/media.js";
import { jsonCall, S } from "../../lib/llm.js";
import { STILLS, lettersWell, stillsFor } from "../../lib/models.js";

// The lettering model this run may use: the paint model itself when it letters well, else the cheapest that does.
export function letterModel(still, tier) {
  if (lettersWell(still)) return still;
  const ok = stillsFor(tier).filter((m) => m.text === "good" && m.edit).sort((a, b) => Math.min(...Object.values(a.cost)) - Math.min(...Object.values(b.cost)));
  return ok[0]?.id || null;
}

// The plan for one frame: the words it must show, and the steps. A model proposes; code holds it to the registry.
export async function buildPlan({ prompt, still, tier }) {
  const models = stillsFor(tier).filter((m) => m.edit || m.generate).map((m) => `${m.id}: lettering ${m.text || "unmeasured (treat as poor)"}, ${m.inputs} input pictures${m.edit ? ", edits" : ""}`).join("\n");
  const r = await jsonCall({ name: "keyframe-buildable", effort: "low", schema: S.obj({ words: S.arr(S.obj({ text: S.str, where: S.str })), scene: S.str, steps: S.arr(S.obj({ op: S.enum(["paint", "letter"]), model: S.str, why: S.str })) }), prompt: `A keyframe of a film is about to be painted on ${still}. Decide whether it is buildable in one shot with the models available, or needs steps.
words: every word, name or number the frame must show READABLY (a sign, a nameplate, a label, a screen, a title painted into the scene), verbatim, with where it is; [] when the frame shows none (people, a room, objects without legible writing; a book spine or a logo too small to read is not a word). Subtitles and on-screen captions added in the edit are NOT painted: leave them out.
scene: when there are words, the frame's prompt REWRITTEN for the paint step: keep everything (people, faces, poses, hands, objects, room, light, camera, style, every reference instruction) and take the lettering out completely: no quoted words, no "reads", "says", "labelled", no mention of letters, writing or text, and no negation about them; a lettered thing stays as the plain object (a neon sign → "an unlit neon tube fixture on the wall"; a nameplate → "a small brass plaque on the table"). "" when there are no words.
steps: [{op:"paint", model:"${still}"}] when there are no words or ${still} letters well; else [{op:"paint", model:"${still}"}, {op:"letter", model: a model below that letters well, to correct the words}].
MODELS AVAILABLE:
${models}
THE FRAME'S PROMPT:
${prompt}` });
  const L = letterModel(still, tier), words = r.words.filter((w) => w.text.trim());
  // code holds the plan to the registry: no words → one paint; words on a good letterer → one paint; else paint + letter
  const split = words.length > 0 && !lettersWell(still) && !!L && !!r.scene.trim();
  const steps = [{ op: "paint", model: still, prompt: split ? "scene" : "frame" }, ...(split ? [{ op: "letter", model: L }] : []), ...(L ? [{ op: "read" }, { op: "fix-if-wrong", model: L }] : [])];
  return { words, scene: split ? r.scene : "", steps, split, proposed: r.steps, note: words.length && !L ? `needs ${words.map((w) => `"${w.text}"`).join(", ")} but no model on this tier letters well` : "" };
}

// Fix the lettering of a painted frame in one edit: write the required words exactly, remove what was not asked for.
// A garbled copy of a WANTED line is a misspelling to fix, never stray text to remove (A03d: the fix was told to letter the
// address and also to delete its two garbled lines, and broke the lines that were right); a lone mark is not lettering.
export const realStray = (stray, words) => stray.filter((x) => { const t = norm(x.text); if (t.length < 2 || /garbled|pseudo|letter-?like|illegible|scattered|fragment/i.test(`${x.text} ${x.where}`)) return false;
  return !words.some((w) => { const W = norm(w.text); return W.includes(t) || t.includes(W) || String(x.text).toLowerCase().split(/\W+/).filter((p) => p.length >= 4).some((p) => W.includes(norm(p))); }); });
export async function fixText({ jobs, run, key, file, words, wrong, stray, model, res, design = false, round = 1 }) {
  const raw = file.replace(/\.png$/, round > 1 ? `-before-text-fix${round}.png` : "-before-text-fix.png"); copyFileSync(run.path(file), run.path(raw));
  const keep = realStray(stray, words);
  const parts = [...wrong.map((w) => `make the lettering on ${w.where || "the lettered surface"} read exactly "${w.text}"${/'/.test(w.text) ? " (with a straight typewriter apostrophe ', not a curly one)" : ""}`), ...keep.map((x) => `remove the ${x.where || "lettering"} ("${x.text}") entirely, object and lettering both, showing what is behind it`)];
  const [W, H] = size(run.path(raw)), r = W / H, aspect = r > 1.3 ? "16:9" : r < 0.77 ? "9:16" : "1:1";   // the picture's own shape (a hard 16:9 reframed square flyers)
  return jobs.image(`${key}${round > 1 ? `-r${round}` : ""}`, file, `In this picture: ${parts.join("; ")}. ${design ? "Keep every other line of lettering exactly as it is, in the same place, size and typeface; change nothing else in the design: layout, colours, ground and marks stay." : "Change nothing else: the people, faces, poses, hands, light, colours and framing stay exactly as they are."}`, [raw], { model, resolution: STILLS[model].resolutions.includes(res) ? res : STILLS[model].resolutions[0], aspect_ratio: aspect });
}
// Which required words the frame does not read correctly (case and spacing ignored).
// strict: spaces and punctuation count (a postcode's space), quote styles and line breaks do not; the frame's readings are
// joined, so a wrapped address still matches.
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "");
const tight = (t) => String(t).toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
// strict also keeps the apostrophe's style: a straight ' typed by the user is not a curly ’ (A03d failed on that alone)
const tightQ = (t) => String(t).toLowerCase().replace(/[“”]/g, '"').replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
export const misread = (words, seen, { strict = false } = {}) => { const all = (strict ? tightQ : tight)(seen.map((x) => x.text).join(" ")); if (strict) return words.filter((w) => !all.includes(tightQ(w.text))); return words.filter((w) => strict ? !all.includes(tight(w.text)) : !seen.some((x) => norm(x.text).includes(norm(w.text)))); };

// After painting: lettering in the frame that the plan did not ask for.
export async function strayText({ run, file, words }) {
  return jsonCall({ name: "keyframe-stray-text", effort: "low", images: [run.path(file)], schema: S.obj({ seen: S.arr(S.obj({ text: S.str, where: S.str })), stray: S.arr(S.obj({ text: S.str, where: S.str })) }), prompt: `List every piece of legible or pseudo-legible lettering in this film frame (signs, nameplates, labels, screens, paper, garbled letters; not book spines too small to read, not a microphone's brand mark too small to read). seen: all of it, each transcribed character for character as drawn (keep the apostrophe's shape: a straight ' or a curly ’; keep dashes, commas and full stops). stray: those that are NOT among the wanted words: ${words.length ? words.map((w) => `"${w.text}"`).join(", ") : "(none wanted)"}.` });
}

