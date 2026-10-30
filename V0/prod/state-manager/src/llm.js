// Minimal OpenAI Responses API client with strict JSON-schema output and a disk cache.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { REPO, TESTS } from "./paths.js";

const MODEL = process.env.SM_MODEL || "gpt-6.1-sol";
const CACHE_DIR = join(TESTS, "cache");

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (const f of [join(TESTS, ".env"), join(REPO, "current/tests/creative-director/.env")]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^OPENAI_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("OPENAI_API_KEY not set (env, current/tests/state-manager/.env, or current/tests/creative-director/.env)");
}

export const usage = { calls: 0, cached: 0, input_tokens: 0, output_tokens: 0 };

export async function jsonCall({ name, schema, prompt, effort = "medium" }) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = createHash("sha256").update(JSON.stringify({ MODEL, name, schema, prompt, effort })).digest("hex").slice(0, 24);
  const file = join(CACHE_DIR, `${name}-${key}.json`);
  if (existsSync(file)) { usage.cached++; return JSON.parse(readFileSync(file, "utf8")); }
  const body = {
    model: MODEL, input: prompt, reasoning: { effort },
    text: { format: { type: "json_schema", name, schema, strict: true } },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || [])
        .filter((c) => c.type === "output_text").map((c) => c.text).join("");
      const parsed = JSON.parse(text);
      usage.calls++; usage.input_tokens += data.usage?.input_tokens || 0; usage.output_tokens += data.usage?.output_tokens || 0;
      writeFileSync(file, JSON.stringify(parsed, null, 2));
      return parsed;
    }
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}
