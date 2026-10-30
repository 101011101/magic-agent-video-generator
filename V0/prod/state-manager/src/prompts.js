// Writes the actual prompt text for one tool call from its conditions (an "authored" leaf in the plan).
import { jsonCall } from "./llm.js";
import { condText } from "./solver.js";

const SCHEMA = { type: "object", additionalProperties: false, required: ["prompt"], properties: { prompt: { type: "string" } } };

export async function writePrompt({ tool, nature, sets, passes, inputs, style, aspect, duration, reference, strip = [], look = "" }) {
  const guide = {
    "AI Image Generator": "Describe one complete still frame: subjects with their exact look, setting, lighting, composition and style. Everything listed must be visible and true.",
    "AI Image Editor": "Write an edit instruction. Refer to input images as image 1, image 2, … in the order given. Say what to change; say to keep everything else exactly as in image 1. When a reference image supplies a character or object, say to keep that character or object identical to the reference.",
    "Image-to-Video": "Describe only the motion over the clip: how subjects move and change from the start frame (and to the end frame if given), plus camera movement. Do not re-describe the static scene. Keep identities unchanged.",
  }[tool] || "Describe what this tool must produce.";
  const prompt = `Write the prompt for one call to the video/image tool "${tool}".
Tool nature: ${nature}
Instructions for this tool: ${guide}
Keep it under 700 characters, concrete and visual. No text, captions or logos in the image unless listed.
Write like a film art director: give composition, framing and lens, light direction and quality, atmosphere, colour palette and texture, in the film's look${look ? ` (${look})` : ""}. For an edit, match the look of image 1.
Include only the subjects and objects listed below. Do not add any person, animal or object that is not listed.${reference ? `
This is a reference image for "${reference}": show only ${reference}, alone and fully visible, on a plain neutral background. Nothing else in the image.` : ""}

Conditions this call must make true:
${sets.map((c) => `- ${condText(c)}`).join("\n") || "- (none)"}
${strip.length ? `Remove these from image 1 completely (they are not in this scene): ${strip.join(", ")}\n` : ""}Conditions that come from the inputs and must be kept:
${passes.map((p) => `- ${condText(p.cond)} (from ${p.slot})`).join("\n") || "- (none)"}
Input images in order:
${inputs.map((i, n) => `- image ${n + 1} (${i.slot}): ${i.describe}`).join("\n") || "- (none)"}
Style: ${style || "as stated"} · Aspect: ${aspect || "as given"}${duration ? ` · Duration: ${duration} s` : ""}`;
  const out = await jsonCall({ name: "prompt", schema: SCHEMA, prompt, effort: "low" });
  return out.prompt;
}
