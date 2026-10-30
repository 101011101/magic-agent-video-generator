// Tool selection from the state (SM-100). A step says what it needs preserved and what it needs made; this picks the tool
// whose signature guarantees it, and then the model whose capabilities allow it. Nothing here chooses by name.
//
// Preservation comes from the signatures (src/signatures.js, loaded from the 40-tool fixture):
//   hard  — output.from_inputs names the slot the atom is carried from. The tool states it maintains the atom.
//   soft  — the editor rule: an edit tool keeps what its main input provides unless the prompt names it (signatures.passOrSet).
//   made  — output.makes_true. The tool can set the atom, which is not the same as preserving it.
// REFERENCE_ONLY atoms (identity, head_hair, body, voice) cannot be made by a prompt, so a step that must preserve one of
// them can only use a tool that passes it from an input. That rule is what reaches for a reference tool instead of a redraw.
//
// Model choice is a consequence of the same question. The capability facts are read from the tool catalog's own limits
// text, not hardcoded here: a step that needs audio cannot pick a model that returns none; a step that needs an end frame
// cannot pick a model that takes none. When several models qualify, PREFER decides, and its head is the model the
// pipelines used as a literal — so with no stated need the selection returns today's choice.
import { loadSignatures, REFERENCE_ONLY, AUDIO_ATOMS } from "./signatures.js";

// Preference order per media. The head of each list is the literal the live pipelines hardcoded, so an unconstrained
// step selects what it selected before. Order below the head is by recorded standing, not by price.
export const PREFER = {
  video: ["wan-3.0", "kling-3.0", "veo3.1", "seedance-2.5", "seedance-2.0", "ltx-2.5", "minimax-h3", "wan-2.2", "kling-2.6"],
  image: ["nano-banana-pro", "seedream-v4.5", "gpt-image-2", "seedream-v4", "krea-2", "flux-2-klein", "z-image-turbo"],
};

// Capability facts parsed from the catalog's limits text for /v1/image-to-video. The catalog states these as prose in
// `constraints`, so they are parsed once here rather than restated: a second copy would drift from the spec.
export function videoCapabilities(catalog) {
  const tool = catalog.tools.find((t) => t.name === "Image-to-Video");
  if (!tool) throw new Error("select: Image-to-Video missing from the catalog");
  const inputOf = (n) => tool.inputs.find((i) => i.name === n)?.constraints || "";
  // Sentence split, not /[^.]+/: model names contain dots (gemini-omni-1.1), so a naive match truncates the list.
  const sentence = (text, lead) => (text.split(/\.\s+(?=[A-Z])/).find((s) => new RegExp(`^\\s*${lead}`, "i").test(s)) || "").replace(new RegExp(`^\\s*${lead}\\s*:?\\s*`, "i"), "").replace(/\.$/, "");
  const noAudio = new Set(sentence(inputOf("audio"), "Not supported").split(",").map((s) => s.trim()).filter(Boolean));
  const endText = inputOf("assets.end_image_file_path");
  const noEnd = new Set((endText.match(/not supported by\s*([^;]+)/i)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean));
  const endMaxSeconds = {};
  for (const m of endText.match(/([\w.-]+(?:\/[\w.-]+)*)\s+need duration <=\s*(\d+)s/gi) || []) {
    const [, names, s] = m.match(/([\w.-]+(?:\/[\w.-]+)*)\s+need duration <=\s*(\d+)s/i);
    for (const n of names.split("/")) endMaxSeconds[n.trim()] = Number(s);
  }
  const durations = tool.limits?.duration_s?.per_model || {};
  const resolutions = tool.limits?.resolutions_per_model || {};
  const models = (tool.models || []).filter((m) => m !== "default");
  return { models, noAudio, noEnd, endMaxSeconds, durations, resolutions };
}

// Does `spec` (the catalog's prose, e.g. "2-10, 15, 20, 25, 30" or "integer 3-15") allow `n`?
export function allows(spec, n) {
  if (!spec) return true;
  for (const part of String(spec).replace(/\(.*?\)/g, "").split(",")) {
    const range = part.match(/(\d+)\s*-\s*(\d+)/);
    if (range && n >= Number(range[1]) && n <= Number(range[2])) return true;
    const exact = part.match(/^\s*(?:integer\s*)?(\d+(?:\.\d+)?)\s*$/);
    if (exact && Number(exact[1]) === n) return true;
  }
  return false;
}

// Which tools can serve this step. need: { outMedia, preserve[], make[], inputCount }.
// Returns every candidate with its verdict, strongest first, so a rejection is as inspectable as a choice.
export function rankTools(need, sigs = loadSignatures({ includeAnalysis: true })) {
  const { outMedia, preserve = [], make = [], inputCount = 0 } = need;
  const out = [];
  for (const t of sigs.tools) {
    const why = [], blocking = [];
    if (!t.mediaOut.includes(outMedia)) continue; // a tool that cannot produce the medium is not a candidate at all
    // Input slots: a from_scratch tool takes no media input; an edit tool requires one.
    const mediaSlots = (t.inputs || []).filter((i) => i.media !== "text");
    const requiredMedia = mediaSlots.filter((i) => i.required).length;
    if (inputCount < requiredMedia) blocking.push(`needs ${requiredMedia} media input(s), step has ${inputCount}`);
    if (inputCount > 0 && mediaSlots.length === 0) blocking.push("takes no media input, step supplies one");
    // Preservation.
    const hard = [], soft = [], lost = [];
    for (const a of preserve) {
      if (t.passes[a]) hard.push(a);
      else if (t.passOrSet.has(a)) soft.push(a);
      else lost.push(a);
    }
    for (const a of lost) {
      // A reference-only atom cannot be re-made by a prompt, so losing it is fatal, not a downgrade.
      if (REFERENCE_ONLY.has(a)) blocking.push(`cannot preserve ${a} (reference-only; this tool does not carry it)`);
      else if (!t.makes.has(a)) blocking.push(`cannot preserve or make ${a}`);
      else why.push(`${a} would be re-made, not preserved`);
    }
    // Production.
    const cannotMake = make.filter((a) => !t.makes.has(a) && !t.passes[a]);
    if (cannotMake.length) blocking.push(`cannot make ${cannotMake.join(", ")}`);
    if (hard.length) why.push(`carries ${hard.join(", ")}`);
    if (soft.length) why.push(`keeps ${soft.join(", ")} unless the prompt names it`);
    // Score: hard preservation is worth more than soft; a soft-only match is a weaker claim on the step.
    const score = hard.length * 10 + soft.length * 3 - (t.proposed ? 1 : 0);
    out.push({ tool: t.name, kind: t.kind, provider: t.provider, ok: !blocking.length, score, hard, soft, blocking, why });
  }
  return out.sort((a, b) => b.ok - a.ok || b.score - a.score);
}

// The chosen tool for a step, or an explicit failure. `prefer` breaks a tie by tool name when the state does not.
export function selectTool(need, sigs, prefer = []) {
  const ranked = rankTools(need, sigs);
  const viable = ranked.filter((r) => r.ok);
  const pick = viable.find((r) => prefer.includes(r.tool)) || viable[0] || null;
  return { pick, ranked, reason: pick ? pick.why.join("; ") || "no property constraint; first viable tool" : "no tool satisfies this step" };
}

// The model for a video step, as a consequence of what the step needs. needs: { audio, endFrame, seconds, resolution }.
export function selectVideoModel(needs, caps, prefer = PREFER.video) {
  const { audio = false, endFrame = false, seconds = null, resolution = null } = needs;
  const rejected = [];
  const viable = caps.models.filter((m) => {
    const no = [];
    if (audio && caps.noAudio.has(m)) no.push("returns no audio");
    if (endFrame && caps.noEnd.has(m)) no.push("takes no end frame");
    if (endFrame && seconds != null && caps.endMaxSeconds[m] != null && seconds > caps.endMaxSeconds[m]) no.push(`end frame only to ${caps.endMaxSeconds[m]}s`);
    if (seconds != null && !allows(caps.durations[m], seconds)) no.push(`does not allow ${seconds}s`);
    if (resolution && caps.resolutions[m] && !String(caps.resolutions[m]).includes(resolution)) no.push(`no ${resolution}`);
    if (no.length) rejected.push({ model: m, why: no.join("; ") });
    return !no.length;
  });
  const model = prefer.find((m) => viable.includes(m)) || viable[0] || null;
  return { model, viable, rejected, reason: model ? `${model}: ${describe(needs)}` : `no model satisfies ${describe(needs)}` };
}
const describe = (n) => [n.audio && "audio", n.endFrame && "end frame", n.seconds != null && `${n.seconds}s`, n.resolution].filter(Boolean).join(", ") || "no stated need";

// What a step must preserve, derived from the state rather than written by hand: every bound entity the frame shows
// contributes its reference-only atoms, because those are the ones a prompt cannot rebuild.
export function preservedAtoms(entities = [], extra = []) {
  const set = new Set(extra);
  for (const e of entities) {
    if (e.kind === "character") for (const a of ["identity", "head_hair", "body"]) set.add(a);
    else if (e.kind === "prop" || e.kind === "product") set.add("identity");
  }
  return [...set];
}

export { REFERENCE_ONLY, AUDIO_ATOMS };
