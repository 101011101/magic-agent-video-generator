// The Claude (Anthropic) provider of the MCP bench: the only file that calls the SDK. Switched on with LLM_PROVIDER=anthropic;
// the OpenAI path (backend/lib/llm.js, bench/mcp/run.mjs) is unchanged and stays the default.
//   claudeJson    one answer in a JSON schema: used by jsonCall (backend/lib/llm.js) for the simulated user, the reply classifier and the judges.
//   claudeMessage one assistant turn with tools: used by claude/driver.mjs, the host model's loop.
// Key: ANTHROPIC_API_KEY (the process environment first, then the repository root .env: see backend/lib/env.js). Never printed.
// CLAUDE_USD_CAP: stop making calls when the estimated spend reaches this many dollars (0 or unset: no cap). `spend` counts every call.
import Anthropic from "@anthropic-ai/sdk";
import { key } from "../../../backend/lib/env.js";

// USD per million tokens: input, output, cache read, cache write (5 minutes). The model table of the claude-api reference, 2026-10-06.
const PRICE = { "claude-opus-5-5": [4, 20, 0.2, 5], "claude-sonnet-5-5": [2, 10, 0.2, 2.5], "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125] };
export const spend = { calls: 0, input: 0, output: 0, cache_read: 0, cache_write: 0, usd: 0 };   // input = tokens not read from the cache
const CAP = Number(process.env.CLAUDE_USD_CAP || 0);

let shared = null;
const client = () => (shared ||= new Anthropic({ apiKey: key("ANTHROPIC_API_KEY"), maxRetries: 3, timeout: 20 * 60 * 1000 }));

// Count one response. Returns the totals in the shape the trace uses: input is everything the model read, cached the part read from the cache.
function count(model, usage) {
  const u = usage || {}, p = PRICE[model] || PRICE["claude-opus-5-5"];
  const fresh = u.input_tokens || 0, out = u.output_tokens || 0, read = u.cache_read_input_tokens || 0, wrote = u.cache_creation_input_tokens || 0;
  spend.calls++; spend.input += fresh; spend.output += out; spend.cache_read += read; spend.cache_write += wrote;
  spend.usd += (fresh * p[0] + out * p[1] + read * p[2] + wrote * p[3]) / 1e6;
  return { input: fresh + read + wrote, output: out, cached: read, cache_write: wrote };
}

// One request. The SDK retries briefly by itself; a longer wait here covers a rate limit or an overloaded period (429, 529, 5xx).
async function create(params) {
  const t0 = Date.now();
  for (let attempt = 1; ; attempt++) {
    if (CAP && spend.usd >= CAP) throw new Error(`Claude spend cap reached: about $${spend.usd.toFixed(2)} of $${CAP}`);
    try {
      const res = await client().messages.create(params);
      res._ms = Date.now() - t0; res._attempts = attempt;
      return res;
    } catch (e) {
      const busy = e?.status === 429 || e?.status === 529 || e?.status >= 500;
      if (!busy || attempt >= 6) throw e;
      const wait = Number(e.headers?.get?.("retry-after")) || 0;
      await new Promise((r) => setTimeout(r, Math.max(wait * 1000, 15000 * attempt)));
    }
  }
}

export async function claudeJson({ model, name, schema, prompt, jpgs = [], effort = "medium" }) {
  const content = [...jpgs.map((j) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: j.toString("base64") } })), { type: "text", text: prompt }];
  const res = await create({ model, max_tokens: 16000, output_config: { effort, format: { type: "json_schema", schema } }, messages: [{ role: "user", content }] });
  count(model, res.usage);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Claude ${name} stopped: ${res.stop_reason}`);
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(text); } catch { throw new Error(`Claude ${name}: the answer is not JSON: ${text.slice(0, 200)}`); }
}

// thoughts: ask for a summary of the model's reasoning (kept in the trace); without it the reasoning is not returned.
export async function claudeMessage({ model, system, tools, messages, effort, thoughts }) {
  const res = await create({
    model, max_tokens: 16000, system, tools, messages,
    cache_control: { type: "ephemeral" },   // caches up to the newest block, so each hop of a long conversation reads the earlier ones from the cache
    output_config: { effort },
    ...(thoughts ? { thinking: { type: "adaptive", display: "summarized" } } : {}),
  });
  res._usage = count(model, res.usage);
  return res;
}
