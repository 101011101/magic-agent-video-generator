// V4 catalogue: the tools the agent can predict and run. Each has its tier, the parameters it needs (required first),
// input/output types, the free model, and a cost function. Names follow the MCP where one exists.
export const FREE = { still: "qwen-image-2.1", stillFast: "z-image-turbo", stillRes: "640px", video: "ltx-2.5", videoRef: "minimax-h3", vres: "480p" };
export const GRID = {
  "ltx-2.5": { maxSeconds: 60, aspects: ["16:9", "9:16", "1:1"], refs: 0, startFrame: true, rate: 24 },
  "minimax-h3": { maxSeconds: 30, aspects: ["16:9", "9:16", "1:1"], refs: 9, startFrame: true, rate: 24 },
  "qwen-image-2.1": { aspects: ["16:9", "9:16", "1:1"], inputs: 3, cost: 10 },
  "z-image-turbo": { aspects: ["16:9", "9:16", "1:1"], inputs: 0, cost: 5 },
};
export const TOOLS = {
  generate_image:         { tier: 1, in: [], out: "image", params: ["subject", "aspect", "exact_words", "look"], required: ["subject", "aspect"], model: FREE.still, cost: () => 10 },
  edit_image:             { tier: 1, in: ["image"], out: "image", params: ["edit", "keep", "aspect", "exact_words"], required: ["edit"], model: FREE.still, cost: () => 10 },
  create_video_from_text: { tier: 1, in: [], out: "video", params: ["subject", "seconds", "aspect", "sound", "exact_words", "look"], required: ["subject", "seconds", "aspect", "sound"], model: FREE.video, cost: (p) => 24 * (Number(p.seconds) || 10) },
  create_video_from_image:{ tier: 1, in: ["image"], out: "video", params: ["motion", "seconds", "aspect", "sound", "keep"], required: ["motion", "seconds", "sound"], model: FREE.video, cost: (p) => 24 * (Number(p.seconds) || 10) },
  generate_music:         { tier: 1, in: [], out: "audio", params: ["mood", "seconds"], required: ["mood", "seconds"], model: "music", cost: (p) => Number(p.seconds) || 15 },
  voice_over:             { tier: 1, in: [], out: "audio", params: ["script", "voice", "language"], required: ["script"], model: "tts", cost: () => 0 },
  text_overlay:           { tier: 1, in: ["image|video"], out: "same", params: ["exact_words", "position"], required: ["exact_words"], model: "ffmpeg", cost: () => 0 },
  extend_video:           { tier: 1, in: ["video"], out: "video", params: ["continuation", "seconds", "aspect", "sound"], required: ["seconds"], model: FREE.video, cost: (p) => 24 * (Number(p.seconds) || 10) },
  adjust_image:           { tier: 1, in: ["image"], out: "image", params: ["adjustment"], required: ["adjustment"], model: "ffmpeg", cost: () => 0 },
  resize_image:           { tier: 1, in: ["image"], out: "image", params: ["targets"], required: ["targets"], model: "ffmpeg", cost: () => 0 },
  trim_video:             { tier: 1, in: ["video"], out: "video", params: ["range"], required: ["range"], model: "ffmpeg", cost: () => 0 },
  join_videos:            { tier: 1, in: ["video", "video"], out: "video", params: ["order", "transition", "music", "exact_words"], required: [], model: "ffmpeg", cost: () => 0 },
  add_subtitles_to_video: { tier: 1, in: ["video"], out: "video", params: ["language"], required: [], model: "magichour", cost: () => 5 },
  upscale_image:          { tier: 1, in: ["image"], out: "image", params: [], required: [], model: "magichour", cost: () => 5 },
  remove_image_background:{ tier: 1, in: ["image"], out: "image", params: [], required: [], model: "magichour", cost: () => 5 },
  swap_face_in_photo:     { tier: 2, in: ["image", "image"], out: "image", params: ["which_face"], required: [], model: "magichour", cost: () => 5 },
  swap_head_in_photo:     { tier: 2, in: ["image", "image"], out: "image", params: ["which_face"], required: [], model: "magichour", cost: () => 10 },
  create_talking_photo:   { tier: 2, in: ["image"], out: "video", params: ["script", "language"], required: ["script"], model: "magichour", cost: (p) => 48 * Math.max(3, Math.ceil(String(p.script || "").split(/\s+/).length / 2.5)) },
  video_production:       { tier: 3, in: ["image?"], out: "video", params: ["story", "seconds", "aspect", "sound", "exact_words"], required: ["story", "aspect", "sound"], model: FREE.video, cost: (p) => 24 * (Number(p.seconds) || 45) + 10 },
};
export const REF_PRIORITY = ["person", "copy", "product", "environment"];
export const REFUSE = ["a real living person placed in an endorsement or a scene they did not take part in", "a minor's face in a swap", "a trademark or logo copied onto a product"];
export const PARAM_TYPES = { seconds: "number", aspect: "one of 16:9, 9:16, 1:1 (a printed poster or flyer is 9:16; a landscape print 16:9)", sound: "one of none, ambient, music, narration, dialogue", exact_words: "list of strings", language: "string" };
