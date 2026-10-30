// The call-site face of the selector (SM-100). `select.js` answers "which tool does this state need"; this wraps it for
// the two places a pipeline actually spends money, memoises the signature load, and records the decision so a run page
// can show why a tool was used instead of only which.
//
// Day-one behaviour is unchanged on purpose. The model the pipeline passes in is the head of the preference list, so it
// is chosen whenever it satisfies the step. The selector only overrides it when the step states a need the model cannot
// meet — an end frame on a model that takes none, audio on a model that returns none, a duration it does not allow —
// and it says so on the record rather than silently substituting.
//
// `need` is optional at every call site. Without it the choice is today's; with it the choice follows the state. That is
// the seam: a caller that knows which entities are in frame passes `need.preserve`, and selection becomes state-driven
// for that step with no further change here.
import { loadSignatures, loadCatalog } from "./signatures.js";
import { selectTool, selectVideoModel, videoCapabilities, PREFER } from "./select.js";

let _sigs = null, _caps = null;
const sigs = () => (_sigs ??= loadSignatures({ includeAnalysis: true }));
const caps = () => (_caps ??= videoCapabilities(loadCatalog()));

// Which image endpoint this step needs. Returns { endpoint, tool, reason, decision } — `decision` is for the run log.
export function chooseImageTool({ inputs = [], need = null } = {}) {
  const step = { outMedia: "image", inputCount: inputs.length, preserve: need?.preserve || [], make: need?.make || [] };
  // The literals the pipelines used, in the order the ternary used them, so an unconstrained step lands where it did.
  const prefer = inputs.length ? ["AI Image Editor"] : ["AI Image Generator"];
  const { pick, reason } = selectTool(step, sigs(), prefer);
  const fallback = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
  const endpoint = pick ? sigs().byName[pick.tool]?.endpoint || fallback : fallback;
  return {
    endpoint, tool: pick?.tool || null, reason,
    decision: { step: "image", inputs: inputs.length, preserve: step.preserve, endpoint, tool: pick?.tool || "(fallback)", reason, state_driven: !!need },
  };
}

// Which video model this step needs. `VIDEO` is the pipeline's literal; it wins unless the step rules it out.
export function chooseVideoModel(VIDEO, { seconds = null, endFrame = false, need = null } = {}) {
  const needs = { audio: !!VIDEO.audio, endFrame, seconds, resolution: VIDEO.resolution || null, ...(need || {}) };
  const { model, viable, rejected, reason } = selectVideoModel(needs, caps(), [VIDEO.model, ...PREFER.video]);
  const overridden = model && VIDEO.model && model !== VIDEO.model;
  return {
    model: model || VIDEO.model, overridden,
    reason: overridden ? `${VIDEO.model} cannot satisfy ${JSON.stringify(needs)}: ${rejected.find((r) => r.model === VIDEO.model)?.why || "unknown"} → ${model}` : reason,
    decision: { step: "video", needs, model: model || VIDEO.model, requested: VIDEO.model, overridden, viable, rejected, state_driven: !!need },
  };
}
