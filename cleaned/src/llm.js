// LLM calls with strict JSON-schema output, optional images, disk cache keyed by (model, name, schema, prompt, images).
// OpenAI Responses API (gpt-6.1-sol, the newest flagship on this key). `model` overrides per call, for experiments.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { key, CACHE } from "./env.js";

export const MODEL = process.env.CLEANED_MODEL || "gpt-6.1-sol";
export const usage = { calls: 0, cached: 0, input_tokens: 0, output_tokens: 0 };

const toJpg = (file) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "scale=1024:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "-"]);

export async function jsonCall({ name, schema, prompt, images = [], effort = "medium", model = MODEL }) {
  const jpgs = images.map(toJpg);
  const h = createHash("sha256").update(JSON.stringify({ MODEL: model, name, schema, prompt, effort }));
  for (const j of jpgs) h.update(j);
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}-${h.digest("hex").slice(0, 24)}.json`);
  if (existsSync(file)) { usage.cached++; return JSON.parse(readFileSync(file, "utf8")); }
  const out = await openai({ model, name, schema, prompt, jpgs, effort });
  writeFileSync(file, JSON.stringify(out, null, 2));
  return out;
}

async function openai({ model: MODEL, name, schema, prompt, jpgs, effort }) {
  const content = [{ type: "input_text", text: prompt }, ...jpgs.map((j) => ({ type: "input_image", image_url: `data:image/jpeg;base64,${j.toString("base64")}` }))];
  // Background mode: create, then poll. A long high-effort call would otherwise outlive fetch's 300 s headers timeout.
  const body = { model: MODEL, reasoning: { effort }, background: true, store: true, input: [{ role: "user", content }], text: { format: { type: "json_schema", name, schema, strict: true } } };
  const headers = { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" };
  for (let attempt = 1; ; attempt++) {
    let res, data;
    try {
      res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(body) });
      data = await res.json().catch(() => ({}));
      // A background response that never completes would hang the run: cap the poll at 10 minutes, cancel it, and let the
      // outer loop retry once more (custom-bakery-real: one cell check polled for 12+ minutes).
      const t0 = Date.now();
      while (res.ok && (data.status === "queued" || data.status === "in_progress")) {
        if (Date.now() - t0 > 600000) { await fetch(`https://api.openai.com/v1/responses/${data.id}/cancel`, { method: "POST", headers }).catch(() => {}); throw new Error(`OpenAI ${name} still ${data.status} after 10 min (cancelled)`); }
        await new Promise((r) => setTimeout(r, 3000));
        res = await fetch(`https://api.openai.com/v1/responses/${data.id}`, { headers });
        data = await res.json().catch(() => ({}));
      }
      if (res.ok && data.status !== "completed") throw new Error(`OpenAI ${name} ${data.status}: ${JSON.stringify(data.error || data.incomplete_details || {}).slice(0, 400)}`);
    } catch (e) { if (attempt === 3) throw e; await new Promise((r) => setTimeout(r, 5000 * attempt)); continue; }
    if (res.ok) {
      const text = (data.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("");
      const out = JSON.parse(text);
      usage.calls++; usage.input_tokens += data.usage?.input_tokens || 0; usage.output_tokens += data.usage?.output_tokens || 0;
      return out;
    }
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`OpenAI ${name} HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

// Schema helpers (strict mode: every property required, no extras).
export const S = {
  str: { type: "string" }, int: { type: "integer" }, bool: { type: "boolean" },
  arr: (items) => ({ type: "array", items }),
  enum: (values) => ({ type: "string", enum: values }),
  obj: (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props }),
};
