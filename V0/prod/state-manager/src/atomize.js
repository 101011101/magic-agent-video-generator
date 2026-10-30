// Step 3a: operational chunks → state spec (bindings, uploads, segments of true/false conditions, layers).
// One LLM call per case, constrained to the atom vocabulary by a strict JSON schema.
import { jsonCall } from "./llm.js";

const str = { type: "string" };
const nstr = { type: ["string", "null"] };
const cond = (atomEnum) => ({
  type: "object", additionalProperties: false,
  required: ["subject", "atom", "value", "from", "rigid"],
  properties: {
    subject: { ...str, description: "Binding name (entity or scene) this condition is about, or 'scene' / 'format'." },
    atom: { type: "string", enum: atomEnum },
    value: { ...str, description: "Target value (the 'to' value for a change). Short. Reuse exact strings for the same thing everywhere." },
    from: { ...nstr, description: "For a change: the value before. null for a held condition." },
    rigid: { type: "boolean", description: "True if the user specified it exactly (must not change)." },
  },
});

export function stateSpecSchema(atomEnum) {
  return {
    type: "object", additionalProperties: false,
    required: ["bindings", "uploads", "format", "segments", "layers"],
    properties: {
      bindings: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["name", "kind", "real", "source", "upload", "description"],
          properties: {
            name: { ...str, description: "Short snake_case name, e.g. grandma, keeper, volt_can, sendly_circle, kitchen." },
            kind: { type: "string", enum: ["character", "product", "logo_element", "prop", "scene", "style"] },
            real: { type: "boolean", description: "True if it is a specific real person, product or asset that a prompt cannot reproduce." },
            source: { type: "string", enum: ["upload", "generate", "ask", "research"], description: "Where its identity comes from. upload = an uploaded file shows it; generate = fictional, a tool can invent it; ask = real but not uploaded, only the user can supply it; research = a public fact or public asset." },
            upload: { ...nstr, description: "Upload name if source = upload." },
            description: str,
          },
        },
      },
      uploads: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["name", "media", "description", "satisfies"],
          properties: {
            name: str, media: { type: "string", enum: ["image", "video", "audio"] }, description: str,
            satisfies: { type: "array", description: "Conditions the uploaded file already makes true, using the same subject/atom/value strings as the segments.", items: cond(atomEnum) },
          },
        },
      },
      format: {
        type: "object", additionalProperties: false, required: ["media", "aspect", "total_duration_s"],
        properties: { media: { type: "string", enum: ["video", "image"] }, aspect: str, total_duration_s: { type: "number" } },
      },
      segments: {
        type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["id", "name", "quote", "type", "duration_s", "depends_on", "conditions"],
          properties: {
            id: str, name: str, quote: str,
            type: { type: "string", enum: ["continuous", "cut"] },
            duration_s: { type: "number" },
            depends_on: { type: "array", items: str },
            conditions: { type: "array", items: cond(atomEnum) },
          },
        },
      },
      layers: {
        type: "array", description: "Conditions that span time across segments: music, sound effects, speech, on-screen text and logos. Not visual-content atoms.",
        items: {
          type: "object", additionalProperties: false,
          required: ["subject", "atom", "value", "rigid", "start_s", "end_s"],
          properties: { subject: str, atom: { type: "string", enum: ["text", "music", "sfx", "speech_audio", "voice"] }, value: str, rigid: { type: "boolean" }, start_s: { type: "number" }, end_s: { type: "number" } },
        },
      },
    },
  };
}

export async function atomize({ request, uploads, story, chunks, atoms }) {
  const atomEnum = atoms.filter((a) => !["media_type"].includes(a.atom)).map((a) => a.atom);
  const vocab = atoms.filter((a) => a.atom !== "media_type").map((a) => `- ${a.atom} (${a.scope}): ${a.definition}`).join("\n");
  const prompt = `You turn operational chunks for a video into a state spec of true/false conditions for a planning system.

Rules:
- Atoms are the elements that change, plus the baseline elements that matter (the baseline is a change from nothing). Elements that never change and were never specified get no condition.
- Use only these atoms:
${vocab}
- Bindings: every character, product, logo element, important prop, scene (location) and style gets one binding with a short name. Conditions use the binding name as subject. Format conditions use subject "format"; general scene atoms with no specific binding use subject "scene".
- A binding's source: upload (an uploaded file shows it), generate (fictional; a tool can invent it), ask (a specific real person, product or asset that is not uploaded; only the user can supply it), research (a public fact or public asset).
- For each upload, list every condition it already makes true (including style, camera framing and aspect when the file shows them), with exactly the same subject/atom/value strings used in the segments.
- Segments: one per operational chunk, in order. Do not make a separate segment for the baseline: put the baseline conditions into the first segment (and into later segments where they still matter). Type: continuous (the change happens within one shot) or cut. Each segment lists its conditions: the held conditions that matter in that segment (identity and look of bound entities present, background, lighting, style, camera) with from = null, and its changes with from = the value before and value = the value after. Reuse identical value strings for the same thing across segments.
- Put music, sound effects, speech/voice and on-screen text or logo overlays in "layers" with their time range, not in segments. Only add a layer for something that is present. Never add a layer or condition whose value is none, silent or absent.
- rigid = true only for values the user specified exactly in the request.
- visibility and layer_position are only for graphic overlay elements (logos, on-screen text, motion-graphics shapes) that sit on a separate layer. Things inside a filmed or generated scene (people, products, props, glows, objects appearing) use props, pose_action, lighting or camera instead.
- Every background condition uses a scene binding (a named location) as its subject, for example beach, kitchen, lantern_room. When the story returns to a location, reuse that same binding name.
- style is the look of a single frame (photoreal, painterly, anime, colour grade). Motion qualities (subtle movement, natural gestures, pacing) belong to pose_action or camera, not style.
- Keep values short (a few words).

User request: ${request}
Uploads: ${uploads}

Story:
${story}

Operational chunks (change-based):
${chunks}`;
  return jsonCall({ name: "statespec", schema: stateSpecSchema(atomEnum), prompt, effort: "medium" });
}
