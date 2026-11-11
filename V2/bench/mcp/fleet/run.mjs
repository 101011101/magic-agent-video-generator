// Runs the host agents of a prepared fleet run (prep.mjs): one headless `claude -p` session per chat, N at a time, on your Claude Code login (no API key).
// The host gets only Bash (for chat.mjs, nothing else) and Read (for its own chat's attachments), no MCP servers, no skills, no user-level CLAUDE.md.
// No retries: a chat that fails stays a failed record (the benchmark's rule). A chat is skipped when its host.json exists.
// Usage: node V2/bench/mcp/fleet/run.mjs --tag t1 [--concurrency 8] [--host opus] [--effort medium] [--only chatId,chatId] [--timeout-min 45] [--max-usd 8]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url)), FLEET = join(HERE, "../../../bench/v1/results/fleet"), CHAT = join(HERE, "chat.mjs");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg("--tag"), N = Number(arg("--concurrency", "6")), HOST = arg("--host", "opus"), EFFORT = arg("--effort", "medium"), TIMEOUT = Number(arg("--timeout-min", "45")) * 60000, MAXUSD = arg("--max-usd", "8");
const only = (arg("--only", "") || "").split(",").filter(Boolean);
const readJson = (f, d = null) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const chats = readJson(join(FLEET, TAG, "chats.json")); if (!chats) throw new Error(`no chats.json for tag ${TAG}: run prep.mjs first`);
const CLAUDE_BIN = readJson(join(FLEET, TAG, chats[0].chatId, "chat.json")).claude_bin || "claude";
const todo = chats.filter((c) => (!only.length || only.includes(c.chatId)) && !existsSync(join(FLEET, TAG, c.chatId, "host.json")));
console.log(`${todo.length} of ${chats.length} chats to run · host ${HOST} (effort ${EFFORT}) · ${N} at a time · tag ${TAG}`);

function summary(c) {
  const dir = join(FLEET, TAG, c.chatId), ev = (existsSync(join(dir, "calls.jsonl")) ? readFileSync(join(dir, "calls.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
  const credits = ev.filter((e) => e.type === "call" && e.approve).reduce((a, e) => a + (e.credits || 0), 0), says = ev.filter((e) => e.type === "say"), helper = ev.filter((e) => e.type === "llm").reduce((a, e) => a + (e.usd || 0), 0);
  return { credits, calls: ev.filter((e) => e.type === "call").length, refused: ev.filter((e) => e.type === "call" && !e.approve).length, kind: says.at(-1)?.kind || "-", turns: says.length, helper_usd: helper };
}
function runChat(c) {
  return new Promise((resolve) => {
    const dir = join(FLEET, TAG, c.chatId), sys = join(FLEET, TAG, `system-${c.side}.txt`);
    const args = ["-p", `Your chat id is ${c.chatId}. Start with the --begin command, then follow the instructions in your system prompt.`, "--model", HOST, "--output-format", "json", "--system-prompt-file", sys,
      "--tools", "Bash,Read", "--allowedTools", `Bash(node ${CHAT} ${c.chatId} *)`, `Read(${dir}/attachments/**)`, "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands",
      "--no-session-persistence", "--effort", EFFORT, "--setting-sources", "project", "--permission-mode", "dontAsk", "--max-budget-usd", String(MAXUSD)];
    const t0 = Date.now(), p = spawn(CLAUDE_BIN, args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => p.kill("SIGKILL"), TIMEOUT);
    p.on("close", (code, signal) => {
      clearTimeout(timer); let j = null; try { j = JSON.parse(out.trim()); } catch {}
      const st = readJson(join(dir, "state.json"), {}); let endedBy = st.ended ? "chat" : null;
      if (!st.ended && st.begun && j?.result && !/^\s*done\W*$/i.test(j.result)) {   // the host stopped without ending the chat: its final text is the last thing it said
        spawnSync("node", [CHAT, c.chatId, "--say", "-"], { input: String(j.result), encoding: "utf8", timeout: 300000 }); endedBy = "host_stopped";
      }
      writeFileSync(join(dir, "host.json"), JSON.stringify({ chatId: c.chatId, host: HOST, effort: EFFORT, started: t0, seconds: Math.round((Date.now() - t0) / 1000), exit: code, signal, ended_by: endedBy, timed_out: signal === "SIGKILL", stderr: err.slice(-600), result: j }, null, 1));
      const s = summary(c), hostUsd = j?.total_cost_usd ?? null;
      console.log(`${c.chatId.padEnd(34)} ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s · host $${hostUsd == null ? "?" : hostUsd.toFixed(2)} (+ helpers $${s.helper_usd.toFixed(3)}) · ${s.credits} cr · ${s.calls} calls (${s.refused} refused) · ${s.turns} msgs · ${s.kind}${endedBy === "host_stopped" ? " · host stopped early" : ""}${j?.is_error || code ? ` · ERROR ${String(j?.result || err).slice(0, 160).replace(/\s+/g, " ")}` : ""}`);
      resolve();
    });
  });
}
const queue = [...todo];
// the first chat of each build runs alone first, so the (long) system prompt is written to the cache once and the rest read it
if (!process.argv.includes("--no-warm")) { const warm = ["old", "new"].map((side) => queue.find((c) => c.side === side)).filter(Boolean); for (const c of warm) queue.splice(queue.indexOf(c), 1); await Promise.all(warm.map(runChat)); }
await Promise.all(Array.from({ length: N }, async () => { while (queue.length) await runChat(queue.shift()); }));
console.log(`FLEET-DONE ${TAG}`);
