// Runs every request through every variant on an OpenAI model (Responses API).
// Usage: node docs/PRD/test-research/run-gpt.mjs [--only p1-grandma] [--force]
// Key: OPENAI_API_KEY env var, or OPENAI_API_KEY=... in docs/PRD/test-research/.env (gitignored).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.GPT_MODEL || "gpt-6.1-sol";
const EFFORT = process.env.GPT_EFFORT || "high";
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const force = args.includes("--force");

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const envFile = join(DIR, ".env");
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, "utf8").match(/^OPENAI_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("OPENAI_API_KEY not set (env or docs/PRD/test-research/.env)");
}
const KEY = apiKey();

const template = (name) => readFileSync(join(DIR, "templates", `${name}.md`), "utf8");
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

async function call(prompt) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: prompt, reasoning: { effort: EFFORT } }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (body.output || [])
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content || [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join("\n");
      if (!text) throw new Error(`empty output: ${JSON.stringify(body).slice(0, 500)}`);
      return { text, usage: body.usage || null };
    }
    const retryable = res.status === 429 || res.status >= 500;
    console.error(`HTTP ${res.status} (attempt ${attempt}): ${JSON.stringify(body).slice(0, 300)}`);
    if (!retryable || attempt === 3) throw new Error(`OpenAI HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

async function step(outDir, name, prompt, usageLog) {
  const file = join(outDir, `${name}.md`);
  if (existsSync(file) && !force) return readFileSync(file, "utf8");
  const t0 = Date.now();
  const { text, usage } = await call(prompt);
  writeFileSync(file, text);
  usageLog[name] = { usage, seconds: Math.round((Date.now() - t0) / 1000) };
  console.log(`  ${outDir.split("/").pop()}/${name} done (${usageLog[name].seconds}s)`);
  return text;
}

async function runRequest(r) {
  const outDir = join(DIR, "outputs", "gpt", r.id);
  mkdirSync(outDir, { recursive: true });
  const vars = { request: r.request, uploads: r.uploads };
  const usageLog = {};
  await Promise.all([
    step(outDir, "v1", fill(template("v1-one-shot"), vars), usageLog),
    step(outDir, "v2a", fill(template("v2a-structure-prompt"), vars), usageLog).then((v2a) =>
      step(outDir, "v2b", fill(template("v2b-script-from-structured"), { ...vars, v2a }), usageLog)),
    step(outDir, "v3a", fill(template("v3a-story"), vars), usageLog).then((v3a) => Promise.all([
      step(outDir, "v3b", fill(template("v3b-operational-chunks"), { ...vars, v3a }), usageLog),
      step(outDir, "v5b", fill(template("v5b-change-chunks"), { ...vars, v3a }), usageLog),
    ])),
    step(outDir, "v4", fill(template("v4-director-script"), vars), usageLog),
  ]);
  const metaFile = join(outDir, "meta.json");
  const prev = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
  writeFileSync(metaFile, JSON.stringify({ model: MODEL, effort: EFFORT, steps: { ...prev.steps, ...usageLog } }, null, 2));
}

const requests = JSON.parse(readFileSync(join(DIR, args.includes("--requests") ? args[args.indexOf("--requests") + 1] : "requests.json"), "utf8")).filter((r) => !only || r.id === only);
console.log(`Model ${MODEL}, effort ${EFFORT}, ${requests.length} requests`);
for (const r of requests) {
  console.log(r.id);
  await runRequest(r);
}
console.log("All done.");
