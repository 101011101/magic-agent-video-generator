// Loads the atom vocabulary and tool signatures, and normalizes them for the solver.
// Source: current/tests/fixtures/tool-signatures.json, plus proposed fixes from current/docs/solver-traces.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./paths.js";

const FIXTURE = join(REPO, "current/tests/fixtures/tool-signatures.json");
const CATALOG = join(REPO, "current/tests/fixtures/magic-hour-tools.json");

// Proposed fixes from the solver traces (not yet in the fixture). Marked "proposed" everywhere they show up.
const PROPOSED_ATOMS = [
  { atom: "visibility", scope: "layer", definition: "Opacity of an element or layer over time (hidden, fading, visible).", proposed: true },
  { atom: "layer_position", scope: "layer", definition: "Position and scale of one element or layer within the frame, over time.", proposed: true },
];
const ALL_ATOMS = [
  "identity", "head_hair", "body", "wardrobe", "expression", "pose_action", "speech_sync", "voice",
  "background", "lighting", "props", "camera", "style", "text", "speech_audio", "music", "sfx",
  "media_type", "duration", "aspect", "resolution", "frame_rate", "visibility", "layer_position",
];
const PROPOSED_TOOLS = [
  {
    tool: "canvas", provider: "ours (proposed)", kind: "from_scratch", proposed: true,
    nature: "Proposed: creates an empty canvas of a given size, duration and background (solid colour or transparent). Deterministic.",
    inputs: [{ slot: "settings", media: "text", required: true, provides: [] }],
    output: { media: "video", from_inputs: {}, makes_true: ["media_type", "background", "duration", "aspect", "resolution"], dropped: [], not_specified: [] },
  },
  {
    tool: "layer_composite", provider: "ours (proposed)", kind: "join", proposed: true,
    nature: "Proposed join: places several visual layers (each an image or video with its own keyframed visibility and position) on a base canvas. Deterministic and exact.",
    inputs: [
      { slot: "base", media: "video", required: true, provides: ALL_ATOMS },
      { slot: "layers[i]", media: "image", required: true, provides: ["identity", "text", "style"] },
      { slot: "keyframes", media: "text", required: true, provides: [] },
    ],
    output: { media: "video", from_inputs: {}, makes_true: ["visibility", "layer_position"], dropped: [], not_specified: [] },
  },
];
// Proposed patches to existing deterministic tools.
const PATCHES = {
  fade: { makes_true: ["visibility"] },
  transform: { makes_true: ["camera", "layer_position"] },
};
const JOIN_TOOLS = new Set(["stitch", "audio_mix_mux", "text_overlay", "logo_overlay", "layer_composite"]);
// Atoms a prompt cannot reproduce: they must pass through from a reference (binding rule).
export const REFERENCE_ONLY = new Set(["identity", "head_hair", "body", "voice"]);
export const AUDIO_ATOMS = new Set(["music", "sfx", "speech_audio", "voice"]);

const slotOf = (s) => String(s).split(" ")[0];

export function loadSignatures() {
  const fx = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
  const limits = Object.fromEntries(catalog.tools.map((t) => [t.name, t.limits || {}]));
  const atoms = [...fx.atoms, ...PROPOSED_ATOMS];
  const tools = [...fx.signatures, ...PROPOSED_TOOLS]
    .filter((s) => !["analysis", "utility"].includes(s.kind) || JOIN_TOOLS.has(s.tool))
    .map((s) => {
      const out = s.output || {};
      const patch = PATCHES[s.tool] || {};
      const makes = new Set([...(out.makes_true || []), ...(patch.makes_true || [])]);
      makes.delete("media_type");
      // passes: atom -> { slot, endSlot? }  (endSlot = a second slot that supplies the atom at t = end)
      const passes = {};
      for (const [atom, src] of Object.entries(out.from_inputs || {})) {
        const slot = slotOf(src);
        const end = /end_image_file_path at t=end/.test(src) ? "assets.end_image_file_path" : null;
        passes[atom] = { slot: slot === "segments[*]" ? "segments[i]" : slot, endSlot: end };
      }
      // Fix 3 (solver traces): edit tools keep what their main input provides unless the prompt names it.
      const main = (s.inputs || []).find((i) => i.required && i.media !== "text");
      const passOrSet = new Set();
      if (s.kind === "edit" && main) for (const a of main.provides) if (makes.has(a) && !passes[a]) passOrSet.add(a);
      const mediaOut = String(out.media || "video").split("|");
      const maxDuration = durationLimit(limits[s.tool]);
      return {
        name: s.tool, kind: JOIN_TOOLS.has(s.tool) ? "join" : s.kind, provider: s.provider || "Magic Hour",
        proposed: !!s.proposed || !!PATCHES[s.tool], nature: s.nature || "",
        inputs: s.inputs || [], mediaOut, makes, passes, passOrSet, mainSlot: main?.slot || null,
        notSpecified: new Set(out.not_specified || []), maxDuration,
        hasPrompt: (s.inputs || []).some((i) => i.media === "text"),
      };
    });
  return { atoms, tools, byName: Object.fromEntries(tools.map((t) => [t.name, t])) };
}

function durationLimit(lim) {
  const d = lim?.duration_s;
  if (typeof d === "number") return d;
  if (d && typeof d === "object") {
    const nums = JSON.stringify(d).match(/\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length) return Math.max(...nums);
  }
  if (typeof d === "string") {
    const nums = d.match(/\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length) return Math.max(...nums);
  }
  return null;
}
