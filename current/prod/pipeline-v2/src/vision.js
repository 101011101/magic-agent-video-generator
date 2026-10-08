// Vision checks on frames (OpenAI Responses API with an image input, strict JSON, disk cache keyed by image hash).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { REPO, TESTS } from "../../state-manager/src/paths.js";
import { usage } from "../../state-manager/src/llm.js";

const MODEL = process.env.SM_MODEL || "gpt-6.1-sol";
const CACHE = join(TESTS, "cache");
function key() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (const f of [join(TESTS, ".env"), join(REPO, "current/tests/creative-director/.env")]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^OPENAI_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("OPENAI_API_KEY not set");
}

async function visionCall(name, schema, text, image) {
  const jpg = execFileSync("ffmpeg", ["-loglevel", "error", "-i", image, "-vf", "scale=1024:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "-"]);
  const h = createHash("sha256").update(JSON.stringify({ MODEL, name, schema, text })).update(jpg).digest("hex").slice(0, 24);
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}-${h}.json`);
  if (existsSync(file)) { usage.cached++; return JSON.parse(readFileSync(file, "utf8")); }
  const body = { model: MODEL, reasoning: { effort: "low" }, text: { format: { type: "json_schema", name, schema, strict: true } },
    input: [{ role: "user", content: [{ type: "input_text", text }, { type: "input_image", image_url: `data:image/jpeg;base64,${jpg.toString("base64")}` }] }] };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const out = JSON.parse((data.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join(""));
      usage.calls++; usage.input_tokens += data.usage?.input_tokens || 0; usage.output_tokens += data.usage?.output_tokens || 0;
      writeFileSync(file, JSON.stringify(out, null, 2));
      return out;
    }
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`OpenAI vision HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

// Start-frame gate: each listed entity must appear, each character exactly once.
export async function checkFrame(image, entities) {
  const schema = { type: "object", additionalProperties: false, required: ["counts", "ok", "problem"], properties: {
    counts: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "count"], properties: { name: { type: "string" }, count: { type: "integer" } } } },
    ok: { type: "boolean" }, problem: { type: "string" } } };
  const text = `This is the first frame of a film shot. It should show: ${entities.map((e) => `${e.name} (${e.kind}: ${e.look})`).join("; ")}.
Count how many times each one appears in the frame. ok = true only if every character appears exactly once and every prop appears at least once. problem: one short sentence, or "".`;
  return visionCall("checkframe", schema, text, image);
}

// Continuous-shot gate: are the characters that the next action needs visible in the real last frame?
export async function checkCarry(image, characters, action) {
  const schema = { type: "object", additionalProperties: false, required: ["missing", "start_frame"], properties: {
    missing: { type: "array", items: { type: "string", enum: characters.map((c) => c.name) } }, start_frame: { type: "string" } } };
  const text = `This is the last frame of a film shot. The next shot continues from it with this action: "${action}".
Characters the action needs: ${characters.map((c) => `${c.name} (${c.look})`).join("; ")}.
missing: the characters that are not clearly visible in this frame (face or body), or [].
start_frame: if any are missing, one paragraph describing this same frame (same place, camera, light and objects) with the missing characters added where the action needs them; else "".`;
  return visionCall("checkcarry", schema, text, image);
}
