// Root-cause "why chains" for the recurring unmet checklist items (why_clusters.py writes fleet/why/clusters.json): one headless `claude -p` agent per cluster reads sample chats
// (transcript, tool calls and results, grade, output frames) and the tool descriptions, then asks "why?" until it reaches an axiom. Result: fleet/why/<id>.json.
// Usage: node V2/bench/mcp/fleet/why.mjs [--concurrency 8] [--model opus] [--only id,id]
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), FLEET = join(V2, "bench/v1/results/fleet"), WHY = join(FLEET, "why"), ITEMS = join(V2, "bench/v1/items");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("--concurrency", "8")), MODEL = arg("--model", "opus"), only = (arg("--only", "") || "").split(",").filter(Boolean);
const clusters = JSON.parse(readFileSync(join(WHY, "clusters.json"), "utf8"));
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const SCHEMA = { type: "object", properties: {
  whys: { type: "array", items: { type: "object", properties: { why: { type: "string" }, because: { type: "string" }, evidence: { type: "string" } }, required: ["why", "because", "evidence"], additionalProperties: false } },
  axiom: { type: "string" }, category: { type: "string", enum: ["host_behavior", "mcp_tool_description", "mcp_tool_behavior", "generator_limit", "free_plan_limit", "brief_ambiguity", "grader_artifact", "harness_artifact", "other"] },
  builds: { type: "string", enum: ["old", "new", "both"] }, fix: { type: "string" } }, required: ["whys", "axiom", "category", "builds", "fix"], additionalProperties: false };
const chatDir = (id) => join(FLEET, id.split(".")[0], id);
function prompt(c) {
  const old = c.chats.filter((x) => x.split(".")[1] === "old"), nw = c.chats.filter((x) => x.split(".")[1] === "new"), sample = [...old.slice(0, 2), ...nw.slice(0, 2)].slice(0, 4);
  const files = sample.map((id) => `- ${id}: ${chatDir(id)}/{chat.json (brief, persona), state.json (the conversation), calls.jsonl (every tool call with arguments and result), grade.json (checklist and the grader's reasons)}; output frames: ${chatDir(id)}/grade/*.jpg`).join("\n");
  return `You are doing root-cause analysis for a benchmark of the Magic Hour MCP server (tools that let a chat assistant make images, video and audio). Two builds are compared: "old" (the hosted server) and "new" (a local upgraded build). Each chat is one assistant (a Claude agent) talking to a simulated user (happy = gives the right information; stupid = lost and vague; dumper = oversharing) and using the MCP tools on a free-plan account.

SYMPTOM: in ${c.n} chats (builds ${JSON.stringify(c.builds)}; users ${JSON.stringify(c.personas)}) of test ${c.item}, the checklist item "${c.symptom}" was NOT met.${c.got ? ` Measured: ${c.got}.` : ""}${c.graded_why ? ` The grader's reason in one chat: ${c.graded_why}` : ""}

TASK: explain the root cause as a chain of whys. Start from the symptom and ask "why?" again and again. Answer each why with a concrete cause backed by evidence (name the file and what it shows: the conversation, the arguments the assistant sent, the tool result, the tool description, the output frames). Continue until you reach an AXIOM: a fact that needs no further explanation inside this system, for example a limit of the generation model or the free plan, an ambiguity in the brief itself, an instruction the assistant ignored with no deeper cause in the tool descriptions, or a defect of the grader or the test harness. Do not stop at the first plausible cause and do not invent: if the evidence cannot decide between two causes, say what is missing and take the better supported one. Use 3 to 8 whys. Say whether the cause sits in the old build, the new build or both, and give one concrete fix (or "none: inherent").

EVIDENCE (read what you need with the Read tool; look at several chats, both builds if present):
${files}
- the test: ${join(ITEMS, c.item + ".json")} (brief, must_haves, spec, answer_sheet)
- tool lists with the exact descriptions the assistant saw: ${join(FLEET, "tools-old.json")} and ${join(FLEET, "tools-new.json")} (long: read with offset and limit, search for the tool name)
Answer only with the requested JSON.`;
}
function run(c) {
  return new Promise((resolve) => {
    const out = join(WHY, `${c.id}.json`), args = ["-p", prompt(c), "--model", MODEL, "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA), "--system-prompt", "You are a careful root-cause analyst. Ground every step in the files you read.",
      "--tools", "Read", "--allowedTools", `Read(/${FLEET}/**)`, `Read(/${ITEMS}/**)`, "--permission-mode", "dontAsk", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands", "--no-session-persistence", "--effort", "medium", "--setting-sources", "project"];
    const p = spawn(CLAUDE_BIN, args, { cwd: join(FLEET, "neutral"), stdio: ["ignore", "pipe", "pipe"] }); let o = "", e = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (e += d));
    const timer = setTimeout(() => p.kill("SIGKILL"), 12 * 60000), t0 = Date.now();
    p.on("close", () => { clearTimeout(timer); let j = null; try { j = JSON.parse(o.trim()); } catch {}
      const r = j?.structured_output; writeFileSync(out, JSON.stringify({ id: c.id, key: c.key, symptom: c.symptom, item: c.item, n: c.n, builds: c.builds, result: r || null, error: r ? null : String(j?.result || e).slice(0, 300), seconds: Math.round((Date.now() - t0) / 1000), usd: j?.total_cost_usd }, null, 1));
      console.log(`${c.id} ${String(Math.round((Date.now() - t0) / 1000)).padStart(3)} s · ${c.item} · ${c.symptom.slice(0, 50)} · ${r ? `${r.whys.length} whys → ${r.category}` : "ERROR"}`); resolve(); });
  });
}
const todo = clusters.filter((c) => (!only.length || only.includes(c.id)) && (process.argv.includes("--force") || !existsSync(join(WHY, `${c.id}.json`))));
console.log(`${todo.length} clusters to analyse (${clusters.length} in all), ${MODEL}, ${N} at a time`);
const q = [...todo]; await Promise.all(Array.from({ length: N }, async () => { while (q.length) await run(q.shift()); })); console.log("WHY-DONE");
