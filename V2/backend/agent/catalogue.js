// The tool catalogue: every tool the agent may plan with, in groups by what it does to state (prd/11-agent.md).
// A tool names its group, what it takes and what it makes, the endpoint or the pipeline code behind it, and which
// registry kind (still | video | none) decides its model and cost. The planner reasons in groups, then picks a tool.
export const GROUPS = {
  make: "nothing → a picture, a clip or a sound",
  compose: "a brief → a film with a story (the pipeline)",
  animate: "a picture (+ sound) → a clip",
  "change-identity": "a picture or clip → the same with another person in it",
  "change-content": "a picture or clip → the same with something added, removed or altered",
  "change-form": "a picture or clip → the same, bigger, cleaner, reframed, cut out",
  speech: "a clip (+ text) → the same with words: subtitles, a dub, lip-sync",
  find: "a question → an answer; zero credit",
  inspect: "an asset → a verdict; zero credit",
};

import { CUSTOM_TOOLS } from "../tools/index.js";

export const TOOLS = [
  ...CUSTOM_TOOLS,
  { id: "image", group: "make", takes: [], makes: "picture", endpoint: "/v1/ai-image-generator", kind: "still", needs: ["subject"], cannot: ["legible text"] },
  { id: "text-to-video", group: "make", takes: ["optional references"], makes: "clip", endpoint: "/v1/text-to-video", kind: "video", needs: ["subject", "seconds"] },
  { id: "music", group: "make", takes: [], makes: "sound", endpoint: "/v1/ai-music-generator", kind: "none", credits: "1 per second", needs: ["cue", "seconds"] },
  { id: "story", group: "compose", takes: ["the brief sheet"], makes: "story", endpoint: "pipeline.mjs --until story", kind: "pipeline", needs: ["kind", "audience", "direction"] },
  { id: "assets", group: "compose", takes: ["story", "materials as records"], makes: "bank", endpoint: "pipeline.mjs --until assets", kind: "pipeline", needs: ["story"] },
  { id: "screenplay", group: "compose", takes: ["story", "bank"], makes: "screenplay", endpoint: "pipeline.mjs --until screenplay", kind: "pipeline", needs: ["story", "platform", "length"] },
  { id: "keyframes", group: "compose", takes: ["screenplay", "bank"], makes: "stills", endpoint: "pipeline.mjs --until paint", kind: "pipeline", needs: ["screenplay"] },
  { id: "clips", group: "compose", takes: ["stills", "screenplay"], makes: "clips", endpoint: "pipeline.mjs --until film", kind: "pipeline", needs: ["stills"] },
  { id: "film", group: "compose", takes: ["clips"], makes: "film", endpoint: "the stitch", kind: "pipeline", needs: ["clips"] },
  { id: "podcast", group: "compose", takes: ["speakers", "topic"], makes: "film", endpoint: "pipeline.mjs --kind podcast", kind: "pipeline", needs: ["speakers", "length"] },
  { id: "image-to-video", group: "animate", takes: ["picture", "optional end picture"], makes: "clip", endpoint: "/v1/image-to-video", kind: "video", needs: ["picture", "seconds", "motion"] },
  { id: "talking-photo", group: "animate", takes: ["picture", "sound"], makes: "clip", endpoint: "/v1/ai-talking-photo", kind: "none", needs: ["picture", "sound"] },
  { id: "audio-to-video", group: "animate", takes: ["sound", "optional picture"], makes: "clip", endpoint: "/v1/audio-to-video", kind: "video", needs: ["sound"] },
  { id: "face-swap-photo", group: "change-identity", takes: ["picture", "face"], makes: "picture", endpoint: "/v1/face-swap-photo", kind: "none", needs: ["picture", "face"] },
  { id: "face-swap-video", group: "change-identity", takes: ["clip", "face"], makes: "clip", endpoint: "/v1/face-swap", kind: "none", needs: ["clip", "face"] },
  { id: "character-replace", group: "change-identity", takes: ["clip", "character"], makes: "clip", endpoint: "/v1/character-replace", kind: "video", needs: ["clip", "character"] },
  { id: "head-swap", group: "change-identity", takes: ["picture", "head"], makes: "picture", endpoint: "/v1/head-swap", kind: "none", needs: ["picture", "head"] },
  { id: "clothes-changer", group: "change-identity", takes: ["picture", "garment"], makes: "picture", endpoint: "/v1/ai-clothes-changer", kind: "none", needs: ["picture", "garment"] },
  { id: "image-edit", group: "change-content", takes: ["picture", "up to 9 more pictures"], makes: "picture", endpoint: "/v1/ai-image-editor", kind: "still", needs: ["picture", "change"], cannot: ["legible text (a model cannot spell reliably)"] },
  { id: "video-edit", group: "change-content", takes: ["clip"], makes: "clip", endpoint: "/v1/ai-video-editor", kind: "video", needs: ["clip", "change"] },
  { id: "video-style", group: "change-content", takes: ["clip"], makes: "clip", endpoint: "/v1/animation (video-to-video)", kind: "none", needs: ["clip", "style"] },
  { id: "edit-run", group: "change-content", takes: ["a run this session made", "shots or seconds"], makes: "film", endpoint: "pipeline.mjs --retry/--only", kind: "pipeline", needs: ["run", "change"] },
  { id: "upscale-image", group: "change-form", takes: ["picture"], makes: "picture", endpoint: "/v1/ai-image-upscaler", kind: "none", needs: ["picture"] },
  { id: "upscale-video", group: "change-form", takes: ["clip"], makes: "clip", endpoint: "/v1/ai-video-upscaler", kind: "none", needs: ["clip"] },
  { id: "background-remove", group: "change-form", takes: ["picture"], makes: "picture", endpoint: "/v1/image-background-remover", kind: "none", needs: ["picture"] },
  { id: "colorize", group: "change-form", takes: ["picture"], makes: "picture", endpoint: "/v1/photo-colorizer", kind: "none", needs: ["picture"] },
  { id: "captions", group: "speech", takes: ["clip"], makes: "clip", endpoint: "/v1/auto-subtitle-generator", kind: "none", needs: ["clip", "language"] },
  { id: "translate", group: "speech", takes: ["clip"], makes: "clip", endpoint: "/v1/ai-video-translator", kind: "none", needs: ["clip", "language"] },
  { id: "lip-sync", group: "speech", takes: ["clip", "sound"], makes: "clip", endpoint: "/v1/lip-sync", kind: "none", needs: ["clip", "sound"] },
  { id: "voice-clone", group: "speech", takes: ["sound sample", "text"], makes: "sound", endpoint: "/v1/ai-voice-cloner", kind: "none", needs: ["sample", "text"] },
  { id: "search", group: "find", takes: ["a question"], makes: "answer", endpoint: "Commons / web search", kind: "none", needs: ["question"] },
  { id: "estimate", group: "find", takes: ["a plan"], makes: "credits", endpoint: "lib/models.js", kind: "none", needs: ["plan"] },
  { id: "gate", group: "inspect", takes: ["asset", "what to check"], makes: "verdict", endpoint: "vision call", kind: "none", needs: ["asset"] },
];

export const tool = (id) => TOOLS.find((t) => t.id === id);

// The catalogue as text for the planner's prompt.
export function catalogueText() {
  const byGroup = {};
  for (const t of TOOLS) (byGroup[t.group] ??= []).push(t);
  return Object.entries(GROUPS).map(([g, what]) => `${g}: ${what}\n${(byGroup[g] || []).map((t) => `  - ${t.id}: takes ${t.takes.length ? t.takes.join(", ") : "nothing"}; makes a ${t.makes}; needs ${t.needs.join(", ")}${t.guarantees ? `; GUARANTEES ${t.guarantees.join(", ")}` : ""}${t.cannot ? `; CANNOT give ${t.cannot.join(", ")}` : ""}${t.custom ? "; by code, 0 credits" : ""}`).join("\n")}`).join("\n");
}
