// RUN-001 arms. One variable moves: the model. Everything else — prompt text, aspect, resolution, image_count, and for the
// editor the source frame bytes — is identical across every arm of a group, so a difference in the result is a difference
// between models and nothing else. Rates and ids are read off current/research/sources/magic-hour-openapi.json (see RATES);
// a model is only listed here if it is in that endpoint's live enum AND supports HOLD.resolution.
// Resolution note: 1k, not the 2k both pipelines run. 1k is the ONLY resolution all six generator models share — krea-2
// tops out at 1k and nano-banana-pro starts at 1k. Holding resolution constant is worth more than matching production,
// but it means the nano-banana-pro arm is a 1k proxy for a 2k pipeline, and a winner needs confirming at 2k (krea-2 never can).

// "from N credits/image" in the spec — a floor, not a price. The ledger shows nano-banana-pro charging 200 at 2k against
// a documented 150, so treat these as estimates and record credits_charged as the truth.
export const RATES = {
  "z-image-turbo": 5, "flux-2-klein": 5, "flux-schnell": 5, "krea-2": 10, "qwen-edit": 10,
  "seedream-v4": 40, "gpt-image-2": 50, "seedream-v4.5": 50, "nano-banana-pro": 150,
};
// What nano-banana-pro actually charged at 2k in current/tests/pipeline-memory/ledger.json. Used for the pessimistic total.
export const OBSERVED = { "nano-banana-pro": 200 };

export const HOLD = { aspect_ratio: "16:9", resolution: "1k", image_count: 1 };

export const GEN_MODELS = ["z-image-turbo", "flux-2-klein", "krea-2", "seedream-v4", "gpt-image-2", "nano-banana-pro"];
export const EDIT_MODELS = ["flux-2-klein", "qwen-edit", "seedream-v4.5", "nano-banana-pro"];

// Three prompts, each isolating one property the pipelines fail on at full price. Each is written so the property is
// stated unambiguously in the prompt itself — a model that fails has ignored an explicit instruction, not guessed wrong.
export const PROMPTS = {
  // M08 / TEST-038. The lighthouse shell: oversized in nearly every judged shot of every recorded run.
  scale: {
    id: "scale", test: "TEST-038 (M08)",
    prompt: "A woman's open palm held out flat, seen from the side in close view, with a single small ivory spiral seashell resting on it. The seashell is 7 cm long and fits easily within the cupped palm, smaller than her hand. Natural daylight, plain background.",
    criterion: "the shell is no more than 2x and no less than half the size it would really be against the hand (7 cm, smaller than the palm)",
  },
  // M09 / TEST-039. Readable branding appeared in 4 of 6 desert-tokyo shots despite a no-text requirement; retries are 0-for-3.
  text: {
    id: "text", test: "TEST-039 (M09)",
    prompt: "A narrow Tokyo side street at dusk with a convenience store front, vending machines and a rail bridge behind. Absolutely no text anywhere in the image: no signage, no lettering, no numbers, no logos, no brand marks, no writing of any kind on any surface.",
    criterion: "no readable glyph, letter, digit or logo anywhere in the frame",
  },
  // M10 / TEST-040. "One of three ships missing" is a recorded fault; count is stated in the verifier but never model-compared.
  count: {
    id: "count", test: "TEST-040 (M10)",
    prompt: "Exactly three identical small wooden fishing boats moored side by side at a stone harbour wall, seen from the quay. Three boats, no more and no fewer. Overcast daylight.",
    criterion: "exactly three boats are present — not two, not four",
  },
};

// M11 / TEST-041. One edit instruction, one source frame, four editors. Changes one property and names what must not move,
// so "preserved" is checkable rather than a matter of taste.
export const EDIT = {
  id: "edit", test: "TEST-041 (M11)",
  prompt: "Change only the time of day to dusk, with warm low sunlight. Keep the person exactly as they are — same face, same hair, same clothing, same pose and same position in the frame. Keep the building, the landscape and every fixed object exactly where they are and the same shape. Change nothing but the light.",
  criterion: "the person is recognisably the same person, and the fixed parts of the place are unchanged in shape and position",
};

// The source frame for the editor arms, generated once so all four editors edit identical bytes. Generated rather than
// taken from current/tests/compare/media/ because those are 480x270 thumbnails: every editor would be upscaling 2x+ and
// that, not the model, could decide the result. --editor-source <file> overrides and costs nothing.
export const SOURCE = {
  model: "nano-banana-pro",
  prompt: "A woman in a charcoal wool coat standing on a rocky shoreline in front of a white stone lighthouse and a small cottage, mid-morning overcast light, photographic, sharp focus.",
};

export const cost = (model, pessimistic = false) => (pessimistic && OBSERVED[model]) || RATES[model] || 0;
