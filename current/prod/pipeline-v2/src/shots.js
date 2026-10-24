// Shot planner: story + operational chunks → bible + shot list (litmus rules). One LLM call.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "../../state-manager/src/paths.js";
import { jsonCall } from "../../state-manager/src/llm.js";

const str = { type: "string" };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["style", "bible", "shots", "layers"],
  properties: {
    style: str,
    bible: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "kind", "look", "upload"],
      properties: { name: str, kind: { type: "string", enum: ["character", "prop", "location"] }, look: str, upload: { type: ["string", "null"] } } } },
    layers: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "start_s", "end_s", "position"],
      properties: { text: str, start_s: { type: "number" }, end_s: { type: "number" }, position: { type: "string", enum: ["center", "lower third", "top"] } } } },
    shots: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["id", "chunks", "link", "location", "visible", "start_frame", "start_upload", "action", "camera", "seconds"],
      properties: {
        start_upload: { type: ["string", "null"] },
        id: str, chunks: { type: "array", items: { type: "integer" } }, link: { type: "string", enum: ["cut", "continuous"] },
        location: str, visible: { type: "array", items: str }, start_frame: str, action: str, camera: str,
        seconds: { type: "integer", enum: [5, 10] },
      } } },
  },
};

export const TEMPLATE = "current/tests/creative-director/templates/v6-shot-list.md";

export async function planShots({ request, uploads, story, chunks }) {
  const prompt = readFileSync(join(REPO, TEMPLATE), "utf8")
    .replace("{{request}}", request).replace("{{uploads}}", uploads).replace("{{story}}", story).replace("{{chunks}}", chunks);
  const plan = await jsonCall({ name: "shotlist", schema: SCHEMA, prompt, effort: "medium" });
  // The first shot of the video always starts a scene.
  if (plan.shots[0]) plan.shots[0].link = "cut";
  return plan;
}

// Groups shots into scenes: a cut starts a scene, continuous shots extend it.
export function scenesOf(shots) {
  const scenes = [];
  for (const s of shots) (s.link === "cut" || !scenes.length ? scenes.push([s]) : scenes.at(-1).push(s));
  return scenes;
}
