// The model registry: every still and video model the pipeline may call, with the capability profile that the rest of the
// pipeline reads instead of constants. Changing a model changes the pipeline through this file alone: the screenplay's
// grid of clip lengths, the state manager's reference cap, which clip modes are possible (an end frame, named references,
// audio), the resolution the stills and clips are made at, and every cost estimate. Figures are from
// V2/reference/magic-hour-api-sheet.md (compiled from the official docs) and, where we have paid for a job, from the ledger
// ("measured"). A cost marked estimate has not been measured on our account.
//
// The abstract tools are the same across models: a still model is images + prompt → one image (the generator endpoint
// when there is no input image, the editor when there is); a video model is start (+ end) frame + prompt → one clip
// (image-to-video) or ordered named references + prompt → one clip (text-to-video). The profile says what each model
// can take and at what price; the pipeline adapts to the profile, never the other way round.

export const WIDTH = { "640px": 640, "1k": 1024, "2k": 2048, "4k": 4096, "360p": 640, "480p": 854, "720p": 1280, "1080p": 1920 };

// Still models. inputs = the editor's cap on additional input images (image 1 counts as one of them). cost per resolution in
// credits for one image; "from" prices from the sheet, measured where we have paid.
export const STILLS = {
  "nano-banana-pro": { inputs: 9, generate: true, edit: true, resolutions: ["1k", "2k", "4k"], cost: { "1k": 150, "2k": 200, "4k": 400 }, measured: ["2k", "4k"], plan: "creator" },
  "nano-banana-2.1": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 50, "1k": 50, "2k": 100, "4k": 150 }, measured: [], plan: "creator" },
  "nano-banana-2": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 100, "1k": 100, "2k": 100, "4k": 200 }, measured: [], plan: "creator" },
  "gpt-image-2": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 50, "1k": 100, "2k": 200, "4k": 400 }, measured: ["2k"], plan: "creator" },
  "gpt-image-2.5-flare": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 100, "1k": 100, "2k": 200, "4k": 400 }, measured: [], plan: "creator" },
  "seedream-v5-pro": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k"], cost: { "640px": 75, "1k": 75, "2k": 150 }, measured: ["2k"], plan: "creator" },
  "seedream-v4.5": { inputs: 9, generate: false, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 50, "1k": 50, "2k": 100, "4k": 200 }, measured: [], plan: "creator" },
  "seedream-v4": { inputs: 9, generate: true, edit: true, resolutions: ["640px", "1k", "2k", "4k"], cost: { "640px": 40, "1k": 40, "2k": 80, "4k": 160 }, measured: [], plan: "creator" },
  "flux-2-klein": { inputs: 5, generate: true, edit: true, resolutions: ["640px", "1k", "2k"], cost: { "640px": 5, "1k": 5, "2k": 10 }, measured: ["2k"], plan: "free" },
  "qwen-image-2.1": { inputs: 2, generate: true, edit: true, resolutions: ["640px", "1k", "2k"], cost: { "640px": 10, "1k": 10, "2k": 20 }, measured: ["2k"], plan: "free" },
  "qwen-edit": { inputs: 2, generate: false, edit: true, resolutions: ["640px", "1k", "2k"], cost: { "640px": 10, "1k": 10, "2k": 20 }, measured: [], plan: "free" },
  "krea-2": { inputs: 1, generate: true, edit: true, resolutions: ["640px", "1k"], cost: { "640px": 10, "1k": 10 }, measured: [], plan: "free" },
  "flux-schnell": { inputs: 0, generate: true, edit: false, resolutions: ["640px", "1k", "2k"], cost: { "640px": 5, "1k": 5, "2k": 10 }, measured: [], plan: "free" },
  "z-image-turbo": { inputs: 0, generate: true, edit: false, resolutions: ["640px", "1k", "2k"], cost: { "640px": 5, "1k": 5, "2k": 10 }, measured: [], plan: "free" },
};

// Video models. grid = the clip lengths (seconds) the model makes with an end frame; rate = credits per second of output per
// resolution; audioExtra = credits per second added when audio is on (0 = included); refs = what text-to-video may be given
// as named references ("none" = no text-to-video with references; "undocumented" = the sheet does not say, the call may
// fail); maxRefs = named references per text-to-video call; endFrame = image-to-video honours an end frame.
export const VIDEOS = {
  "wan-3.0": { grid: [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], resolutions: ["480p", "720p", "1080p"], rate: { "480p": 48, "720p": 96, "1080p": 180 }, audioExtra: 0, refs: ["images", "videos", "audio"], maxRefs: 10, endFrame: true, measured: ["720p"], plan: "creator" },
  "kling-3.0": { grid: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolutions: ["720p", "1080p", "4k"], rate: { "720p": 48, "1080p": 72, "4k": 240 }, audioExtra: 24, refs: ["images", "videos"], maxRefs: 5, endFrame: true, measured: [], plan: "creator" },
  "kling-2.6": { grid: [5, 10], resolutions: ["720p", "1080p"], rate: { "720p": 36, "1080p": 72 }, audioExtra: null, refs: "undocumented", maxRefs: 0, endFrame: "1080p", measured: [], plan: "unstated" },
  "ltx-2.5": { grid: Array.from({ length: 60 }, (_, i) => i + 1), resolutions: ["480p", "720p", "1080p"], rate: { "480p": 24, "720p": 48, "1080p": 72 }, audioExtra: 0, refs: "undocumented", maxRefs: 10, endFrame: true, measured: [], plan: "free" },
  "minimax-h3": { grid: Array.from({ length: 30 }, (_, i) => i + 1), resolutions: ["480p", "720p", "1080p"], rate: { "480p": 24, "720p": 48, "1080p": 72 }, audioExtra: 0, refs: ["images", "videos", "audio"], maxRefs: 9, endFrame: true, measured: ["480p", "720p"], plan: "free" },   // maxRefs 9: two sequences with ten image references were refused ("not a valid image file"); nine with a voice, and six, rendered
  "wan-2.2": { grid: [3, 4, 5, 6, 7, 8, 9, 10, 15], resolutions: ["480p", "720p", "1080p"], rate: { "480p": 24, "720p": 48, "1080p": 72 }, audioExtra: null, refs: "undocumented", maxRefs: 0, endFrame: false, measured: [], plan: "unstated" },
  "gemini-omni-1.1": { grid: [3, 4, 5, 6, 7, 8, 9, 10], resolutions: ["360p", "720p", "1080p", "4k"], rate: { "360p": 48, "720p": 144, "1080p": 192, "4k": 384 }, audioExtra: null, refs: ["images", "videos"], maxRefs: 10, endFrame: true, measured: [], plan: "unstated" },
  "veo3.1": { grid: [4, 6, 8], resolutions: ["720p", "1080p"], rate: { "720p": 96, "1080p": 120 }, audioExtra: 24, refs: ["images"], maxRefs: 3, endFrame: true, measured: ["720p"], plan: "unstated" },
  "veo3.1-lite": { grid: [4, 6, 8], resolutions: ["720p", "1080p"], rate: { "720p": 48, "1080p": 72 }, audioExtra: 24, refs: "undocumented", maxRefs: 0, endFrame: true, measured: [], plan: "unstated" },
  "seedance-1.5": { grid: [4, 5, 6, 7, 8, 9, 10, 11, 12], resolutions: ["480p", "720p", "1080p"], rate: { "480p": 30, "720p": 60, "1080p": 90 }, audioExtra: "double", refs: "undocumented", maxRefs: 0, endFrame: true, measured: [], plan: "unstated" },
  "seedance-2.5": { grid: [4, 5, 6, 7, 8, 9, 10, 15, 20, 30], resolutions: ["720p"], rate: { "720p": 336 }, audioExtra: 0, refs: ["images", "videos", "audio"], maxRefs: 10, endFrame: true, measured: [], plan: "unstated" },
};

// Tiers: a named profile of models and resolutions. `paid` is what every film so far was made with; `free` honours the free
// plan's models and resolutions (640px stills, 480p video, free-flagged models only); `cheap` runs the free-flagged models
// at paid resolutions on a paid account (10 to 20 times cheaper than `paid`, nothing lost to resolution).
export const TIERS = {
  paid: { still: "nano-banana-pro", res: "2k", video: "wan-3.0", vres: "720p" },
  cheap: { still: "flux-2-klein", res: "2k", video: "minimax-h3", vres: "720p" },
  free: { still: "flux-2-klein", res: "640px", video: "minimax-h3", vres: "480p" },
};

const need = (table, name, kind) => { const m = table[name]; if (!m) throw new Error(`unknown ${kind} model "${name}" (known: ${Object.keys(table).join(", ")})`); return m; };
export const still = (name) => need(STILLS, name, "still");
export const video = (name) => need(VIDEOS, name, "video");

// Costs. A still at a resolution; a clip of `seconds` at a resolution with or without audio; a music bed.
export function stillCost(name, res) { const m = still(name); if (!m.resolutions.includes(res)) throw new Error(`${name} does not make ${res} (it makes ${m.resolutions.join(", ")})`); return m.cost[res]; }
export function videoRate(name, res, audio = true) {
  const m = video(name); if (!m.resolutions.includes(res)) throw new Error(`${name} does not make ${res} (it makes ${m.resolutions.join(", ")})`);
  const base = m.rate[res]; if (!audio) return base;
  return m.audioExtra === "double" ? base * 2 : base + (m.audioExtra || 0);
}
export const videoCost = (seconds, name, res, audio = true) => seconds * videoRate(name, res, audio);

// The grid of clip lengths a video model makes (the screenplay snaps every shot to it).
export const grid = (name) => video(name).grid;

// How many images a paint may send in all (image 1 included), for a still model: the model's cap, and never more than the
// pipeline's own cap (nine references once came back as a labelled collage).
export const maxImages = (name, pipelineCap = 4) => Math.min(pipelineCap, still(name).inputs + 1);

// Which clip modes a video model supports: pinned and start need an end frame (start does not, strictly, but shares the
// endpoint); t2v and seq need named references. Returns { ok, why } so the pipeline can refuse or warn before paying.
export function supports(name, mode, res = null) {
  const m = video(name);
  if (res && !m.resolutions.includes(res)) return { ok: false, why: `${name} does not make ${res}` };
  if (mode === "pinned" && !m.endFrame) return { ok: false, why: `${name} takes no end frame; use --clips start, t2v or seq` };
  if (mode === "pinned" && typeof m.endFrame === "string" && res && res !== m.endFrame) return { ok: false, why: `${name} honours an end frame only at ${m.endFrame}` };
  if ((mode === "t2v" || mode === "seq") && m.refs === "none") return { ok: false, why: `${name} takes no named references; use --clips pinned or start` };
  if ((mode === "t2v" || mode === "seq") && m.refs === "undocumented") return { ok: true, why: `${name}'s support for named references is not documented; the call may fail` };
  return { ok: true, why: "" };
}

// One line describing a profile, for the run log and the results page.
export function describe({ still: s, res, video: v, vres }) {
  const a = still(s), b = video(v);
  return `still ${s} @${res} (${stillCost(s, res)} credits${a.measured.includes(res) ? "" : ", estimate"}, ${a.inputs} input images, ${a.plan}) · video ${v} @${vres} (${videoRate(v, vres, true)}/s with audio${b.measured.includes(vres) ? "" : ", estimate"}; refs ${Array.isArray(b.refs) ? b.refs.join("+") : b.refs}; end frame ${b.endFrame === true ? "yes" : b.endFrame || "no"}; ${b.plan})`;
}

// A profile from --tier and the overriding flags; validated.
export function profile({ tier = "paid", still: s, res, video: v, vres } = {}) {
  const t = TIERS[tier]; if (!t) throw new Error(`unknown tier "${tier}" (known: ${Object.keys(TIERS).join(", ")})`);
  const p = { tier, still: s || t.still, res: res || t.res, video: v || t.video, vres: vres || t.vres };
  stillCost(p.still, p.res); videoRate(p.video, p.vres);   // throws on an unknown model or a resolution it does not make
  return p;
}
