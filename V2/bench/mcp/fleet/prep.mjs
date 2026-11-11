// Prepares a fleet run: one folder per chat (chat.json, empty state), the tool lists of both builds, one system prompt per build, the shared credit ledger.
// A fleet chat = one headless `claude -p` host agent (run.mjs) that reaches the MCP only through chat.mjs; the simulated user and the classifier are helper calls inside chat.mjs.
// Usage: node V2/bench/mcp/fleet/prep.mjs --tag t1 --chats new:happy:A01a:live,old:stupid:B07a:dry     (side:persona:item:mode)
//    or: node V2/bench/mcp/fleet/prep.mjs --tag t1 --items A01a,B07a | --groups A,B --personas happy,stupid,dumper --sides old,new --mode dry|live
//   [--limit 60] credits the live chats of this run may spend in all (shared ledger); [--new-url http://127.0.0.1:8772/] [--refresh] re-read the tool lists
//   [--user-model sonnet] [--classifier-model haiku]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { key } from "../../../backend/lib/env.js";
import { STILLS } from "../../../backend/lib/models.js";
import { upload } from "../../../backend/lib/magichour.js";
import { PERSONAS, REPLY_ITEMS, bankOf } from "../personas.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), FLEET = join(V2, "bench/v1/results/fleet"), ITEMS = join(V2, "bench/v1/items"), FIX = join(V2, "bench/v1/fixtures"), OPENINGS = join(HERE, "../openings");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg("--tag"); if (!TAG || /[.\s/]/.test(TAG)) throw new Error("--tag <short name without dots or spaces>");
const URLS = { old: "https://mcp.magichour.ai/", new: arg("--new-url", "http://127.0.0.1:8772/") }, LIMIT = Number(arg("--limit", "0")), REFRESH = process.argv.includes("--refresh");
const HELPERS = { user: arg("--user-model", "sonnet"), classifier: arg("--classifier-model", "haiku") };
const readJson = (f, d = null) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
mkdirSync(join(FLEET, "neutral"), { recursive: true }); mkdirSync(join(FLEET, TAG), { recursive: true });
const CLAUDE_BIN = process.env.CLAUDE_BIN || execFileSync("which", ["claude"], { encoding: "utf8" }).trim();

// ---- which chats
const all = readdirSync(ITEMS).filter((f) => f.endsWith(".json")).map((f) => readJson(join(ITEMS, f))).sort((a, b) => a.id.localeCompare(b.id));
let specs = [];
if (arg("--chats")) specs = arg("--chats").split(",").map((s) => { const [side, persona, item, mode] = s.split(":"); return { side, persona, item, mode: mode || "dry" }; });
else {
  const only = (arg("--items", "") || "").split(",").filter(Boolean), groups = (arg("--groups", "") || "").split(",").filter(Boolean);
  const its = all.filter((it) => (!only.length || only.includes(it.id)) && (!groups.length || groups.includes(it.group)));
  for (const it of its) for (const persona of (arg("--personas", "happy,stupid,dumper")).split(",")) for (const side of (arg("--sides", "old,new")).split(",")) specs.push({ side, persona, item: it.id, mode: arg("--mode", "dry") });
}
if (!specs.length) throw new Error("no chats selected");

// ---- the tool lists, read once per build: exactly what a chat app would show the model (the account balance and the deletions are hidden, as in run.mjs)
const HIDDEN = ["get_account_info", "delete_video_project", "delete_image_project", "delete_audio_project"];
async function listTools(url) {
  const H = { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` };
  const parse = async (r) => { const t = await r.text(); if (r.headers.get("content-type")?.includes("text/event-stream")) { const d = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean); return JSON.parse(d.at(-1)); } return t ? JSON.parse(t) : null; };
  let r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "bench-fleet", version: "1" } } }) });
  const sid = r.headers.get("mcp-session-id"), init = await parse(r), H2 = { ...H, ...(sid ? { "mcp-session-id": sid } : {}) };
  await fetch(url, { method: "POST", headers: H2, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }).catch(() => {});
  r = await fetch(url, { method: "POST", headers: H2, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) });
  const tools = (await parse(r))?.result?.tools || []; if (!tools.length) throw new Error(`${url} listed no tools`);
  return { server: init?.result?.serverInfo || null, tools: tools.filter((t) => !HIDDEN.includes(t.name)).map((t) => ({ name: t.name, description: t.description || "", inputSchema: t.inputSchema || { type: "object", properties: {} }, annotations: t.annotations })) };
}
const FREE_STILL = Object.entries(STILLS).filter(([, m]) => m.plan === "free").map(([k]) => k), FREE_VIDEO = ["ltx-2.5", "minimax-h3"];
const SYSTEM = `You are a helpful assistant in a chat app. The user has connected the Magic Hour MCP server (tools that make and edit images, video and audio). The user's Magic Hour account is on the FREE plan: only free-plan models and settings run (images: ${FREE_STILL.join(", ")} at 640px; video: ${FREE_VIDEO.join(" or ")} at 480p; the other tools at their free settings). A call with a paid model, a higher resolution or more credits than the account has is refused by the account. Files the user attaches are already in their Magic Hour account: use the file_path given with each attachment wherever a tool takes a *_file_path. When a job finishes, give the user the download link(s) of what you made.`;
const CHAT = join(HERE, "chat.mjs");
for (const side of [...new Set(specs.map((s) => s.side))]) {
  const jf = join(FLEET, `tools-${side}.json`);
  if (REFRESH || !existsSync(jf)) writeFileSync(jf, JSON.stringify(await listTools(URLS[side]), null, 1));
  const L = readJson(jf), md = L.tools.map((t) => `### ${t.name}\n${t.description}\nInput schema: ${JSON.stringify(t.inputSchema)}`).join("\n\n");
  writeFileSync(join(FLEET, TAG, `system-${side}.txt`), `${SYSTEM}

The Magic Hour MCP server's tools are listed at the end of this message, each with its description and input schema: they are the tools your chat app gives you.

How this chat app works (your chat id is in the task message; write it in place of <ID>):
1. Start by running this command; it prints the user's first message:
   node ${CHAT} <ID> --begin
2. To use a tool, run this command (a tool can take minutes: set the Bash timeout to 600000 ms). It prints the tool's result:
   node ${CHAT} <ID> <tool_name> '<arguments as one JSON object>'
3. Everything you want the user to read must go through this command; your own final text is NOT shown to the user. It prints the user's reply:
   node ${CHAT} <ID> --say - <<'EOF'
   <your message to the user>
   EOF
4. Keep going until a command says the conversation has ended, then answer only with the word: done
Each turn works like a chat app: do all the tool work for the user's message first, including waiting for any job to finish, then send ONE message with --say. Do not send progress messages such as "working on it": a message that promises something later is your last word for the turn.
Rules: use no command except these and no tool except Bash and Read (Read is for attached pictures; the local path is shown beside each attachment); read no other file; never reach the Magic Hour MCP any other way.

THE TOOLS (${side === "old" ? "hosted server" : "local build"}, ${L.tools.length} tools)

${md}
`);
}

// ---- the chats
const uploadsFile = join(FLEET, "uploads.json"), uploads = readJson(uploadsFile, {});
const IMG = /\.(png|jpe?g|webp)$/i;
async function messageFor(chatDir, msg, text) {
  const lines = [];
  for (const m of msg.materials || []) {
    if (/\.(txt|md)$/i.test(m)) { lines.push(`[Attached: ${m}]\nContents of ${m}:\n${readFileSync(join(FIX, m), "utf8").slice(0, 3000)}`); continue; }
    if (!uploads[m]) { uploads[m] = await upload(join(FIX, m)); writeFileSync(uploadsFile, JSON.stringify(uploads, null, 2)); }
    mkdirSync(join(chatDir, "attachments"), { recursive: true }); copyFileSync(join(FIX, m), join(chatDir, "attachments", m));
    lines.push(`[Attached: ${m} — Magic Hour file_path: ${uploads[m]}${IMG.test(m) ? ` — a copy you can open with the Read tool: ${join(chatDir, "attachments", m)}` : ""}]`);
  }
  return [text, ...lines].join("\n");
}
const byId = Object.fromEntries(all.map((it) => [it.id, it])), out = [];
for (const s of specs) {
  const it = byId[s.item], P = PERSONAS[s.persona]; if (!it) throw new Error(`unknown item ${s.item}`); if (!P) throw new Error(`unknown persona ${s.persona}`);
  const chatId = `${TAG}.${s.side}.${s.persona}.${s.item}`, chatDir = join(FLEET, TAG, chatId); mkdirSync(chatDir, { recursive: true });
  const opening = !P.opening ? { text: it.turns[0].text } : readJson(join(OPENINGS, s.persona, `${s.item}.json`)); if (!opening) throw new Error(`no opening for ${s.persona}/${s.item}`);
  const messages = [];
  for (let i = 0; i < it.turns.length; i++) { const text = i === 0 ? opening.text : it.turns[i].text; messages.push({ text, materials: it.turns[i].materials || [], message: await messageFor(chatDir, it.turns[i], text) }); }
  const chat = { chatId, tag: TAG, side: s.side, url: URLS[s.side], mode: s.mode, item: s.item, title: it.title, group: it.group, persona: { name: s.persona, reply: P.reply, approval: P.approval, giveUp: P.give_up, nudge: P.nudge },
    replyItem: REPLY_ITEMS.has(it.id) || ["none", "text"].includes(it.spec?.kind) || !!it.expect?.refuse, itemNudge: it.nudge || null, bank: bankOf(it), messages, helpers: HELPERS, claude_bin: CLAUDE_BIN };
  writeFileSync(join(chatDir, "chat.json"), JSON.stringify(chat, null, 1));
  if (!existsSync(join(chatDir, "calls.jsonl"))) writeFileSync(join(chatDir, "calls.jsonl"), "");
  out.push({ chatId, side: s.side, persona: s.persona, item: s.item, mode: s.mode });
}
// ---- the shared allowance for the live chats of this run: nothing may start below the floor (the real account balance, read from Magic Hour)
const live = specs.some((s) => s.mode === "live");
if (!existsSync(join(FLEET, TAG, "ledger.json")) || arg("--limit")) {
  let floor = 0, start = null;
  if (live) { if (!LIMIT) throw new Error("live chats need --limit <credits>"); const r = await fetch("https://api.magichour.ai/v1/account", { headers: { authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` } }); start = (await r.json()).credits; floor = start - LIMIT; }
  writeFileSync(join(FLEET, TAG, "ledger.json"), JSON.stringify({ limit: LIMIT, spent: 0, reserved: 0, start, floor }));
}
writeFileSync(join(FLEET, TAG, "chats.json"), JSON.stringify(out, null, 1));
console.log(`${out.length} chats prepared in ${join(FLEET, TAG)}${live ? ` · live allowance ${LIMIT} credits (ledger floor ${readJson(join(FLEET, TAG, "ledger.json")).floor})` : " · dry (no credits)"} · system prompts: ${[...new Set(specs.map((s) => s.side))].map((x) => `system-${x}.txt`).join(", ")}`);
