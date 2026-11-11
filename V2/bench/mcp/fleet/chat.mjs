#!/usr/bin/env node
// The one command a fleet host agent runs (see fleet/README in prep.mjs). One chat = one host agent; this script is its chat app and its Magic Hour account.
//   node chat.mjs <chatId> --begin                       print the user's first message
//   node chat.mjs <chatId> <tool> '<json arguments>'      call a Magic Hour MCP tool through the free-plan gate (dry chats: creates are refused and recorded)
//   node chat.mjs <chatId> --say '<message>' | --say -    send a message to the user (text on stdin with "-"); prints the simulated user's reply, or that the chat has ended
//   node chat.mjs <chatId> --status                       what has happened so far (for the runner)
// The simulated user and the reply classifier are headless `claude -p` calls (your Claude Code login, no API key). The persona logic is run.mjs's: a question or an
// approval request gets an answer in character (the happy user's approval is a fixed line), at most 3 answers, one push when the assistant says it cannot without
// having tried a call, one give-up line, refusal ends the chat. Every event is appended to calls.jsonl; the transcript is in state.json.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { key } from "../../../backend/lib/env.js";
import { STILLS, stillCost, videoCost } from "../../../backend/lib/models.js";
import { download } from "../../../backend/lib/magichour.js";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), FLEET = join(V2, "bench/v1/results/fleet");
const [chatId, cmd, ...rest] = process.argv.slice(2);
if (!chatId || !cmd) { console.log("usage: node chat.mjs <chatId> --begin | --say <text|-> | <tool> '<json>'"); process.exit(2); }
const tag = chatId.split(".")[0], dir = join(FLEET, tag, chatId);
const readJson = (f, d = null) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const chat = readJson(join(dir, "chat.json")); if (!chat) { console.log(`unknown chat ${chatId}`); process.exit(2); }
const P = chat.persona, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), parseJson = (s) => { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } };
const log = (ev) => appendFileSync(join(dir, "calls.jsonl"), JSON.stringify({ t: Date.now(), ...ev }) + "\n");
const S = readJson(join(dir, "state.json"), null) || { begun: false, ended: false, msg: 0, round: 0, nudged: false, gaveUp: false, approvals: 0, tried: 0, callsSinceUser: 0, transcript: [] };
const save = () => writeFileSync(join(dir, "state.json"), JSON.stringify(S, null, 1));
const cut = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n)} …[cut: ${s.length} chars in all]` : s; };

// ---- helper model calls: headless `claude -p`, no tools, no MCP servers, no user-level CLAUDE.md (setting sources: project, run from an empty folder)
function llm({ model, system, prompt, schema, what }) {
  const args = ["-p", prompt, "--model", model, "--output-format", "json", "--json-schema", JSON.stringify(schema), "--system-prompt", system, "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands", "--no-session-persistence", "--effort", "low", "--setting-sources", "project"];
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {   // infrastructure retries only (a rate limit or a crashed process); a different answer is never re-asked
    const t0 = Date.now(), r = spawnSync(chat.claude_bin || "claude", args, { cwd: join(FLEET, "neutral"), encoding: "utf8", timeout: 240000, maxBuffer: 1 << 25 });
    const j = parseJson((r.stdout || "").trim());
    if (j && !j.is_error && j.structured_output) { log({ type: "llm", what, model, ms: Date.now() - t0, usd: j.total_cost_usd, usage: j.usage && { in: j.usage.input_tokens, out: j.usage.output_tokens, cache_read: j.usage.cache_read_input_tokens, cache_write: j.usage.cache_creation_input_tokens }, attempt }); return j.structured_output; }
    last = (j?.result || r.stderr || r.stdout || "no output").toString().slice(0, 300);
    log({ type: "llm_error", what, model, attempt, error: last });
    spawnSync("sleep", [String(8 * attempt)]);
  }
  throw new Error(`helper model call failed: ${last}`);
}
const KIND = { type: "object", properties: { kind: { type: "string", enum: ["question", "approval", "delivered", "refusal", "cannot", "other"] }, why: { type: "string" } }, required: ["kind", "why"], additionalProperties: false };
const classify = (text, called) => llm({ what: "classify", model: chat.helpers.classifier, system: "You classify replies from a chat assistant. Answer only with the requested JSON.", schema: KIND, prompt: `Classify this reply from a chat assistant that can make images, video and sound with tools. It ${called ? "called tools before replying" : "called no tool"}.
- question: it asks the user for information or a choice (which picture, what wording, what size, what mood) and waits.
- approval: it asks the user to confirm, to proceed, or to approve spending credits, and waits.
- delivered: it presents a finished result (a link, or what was made), even with caveats.
- refusal: it declines on policy or safety grounds.
- cannot: it says it cannot do this with the tools or plan it has (needs a paid plan, no such tool, cannot upload).
- other.
REPLY:
"""${text.slice(0, 3000)}"""` });
const transcriptText = () => S.transcript.map((m) => (m.role === "user" ? `USER: ${m.text}` : `ASSISTANT: ${String(m.text).slice(0, 1500)}`)).join("\n");
function userReply(text, kind) {
  if (kind === "approval" && typeof P.approval === "string" && !chat.replyItem) return P.approval;   // a fixed approval line is used as is
  return llm({ what: "user", model: chat.helpers.user, system: "You play the user of a chat assistant, in character. Answer only with the requested JSON.", schema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"], additionalProperties: false },
    prompt: `You are playing a USER of a chat assistant that makes images, video and sound. Stay in character:
${P.reply}
YOUR KNOWLEDGE BANK, the only facts you have (never invent others): ${JSON.stringify(chat.bank)}
THE CONVERSATION SO FAR (you wrote the USER lines):
${transcriptText()}
THE ASSISTANT NOW SAYS${kind === "approval" ? " (it asks you to confirm, or to approve spending)" : kind === "question" ? " (it asks you something)" : ""}:
"""${text.slice(0, 3000)}"""
Write the user's next message.` }).reply;
}

// ---- the free plan, as run.mjs's gate states it (+ the prices measured in the live runs of 2026-11-10)
const FREE_STILL = Object.entries(STILLS).filter(([, m]) => m.plan === "free").map(([k]) => k), FREE_VIDEO = ["ltx-2.5", "minimax-h3"];
const IMAGE_TOOLS = new Set(["generate_image", "edit_image"]), VIDEO_MODEL_TOOLS = new Set(["create_video_from_text", "create_video_from_image", "edit_video", "replace_character_in_video", "create_spoken_ad_video"]);
const READ_ONLY = ["get_workflow_guide", "ping", "wait_for_video_project", "wait_for_image_project", "wait_for_audio_project", "fetch_image_download", "fetch_audio_download", "fetch_video_download", "get_account_info", "list_saved_items", "get_upload_urls", "get_face_detection_results", "get_video_project", "get_image_project", "get_audio_project", "join_production_clips", "join_videos", "get_last_frame", "voices_list"];
const FREE_TOOLS = new Set([...READ_ONLY, "plan_request", "plan_video_production", "detect_faces", "get_face_detection_results", "upload_chatgpt_image", "upload_chatgpt_media"]);
const FIXED = { swap_face_in_photo: 10, swap_head_in_photo: 10, remove_image_background: 5, colorize_photo: 10, create_meme: 10, create_qr_code: 0, generate_headshot: 50, create_gif_or_short_video: 50, edit_face_in_photo: 1, detect_faces: 0 };
const toolDefs = readJson(join(FLEET, `tools-${chat.side}.json`), { tools: [] }).tools || [];
const RO = new Set([...READ_ONLY, ...toolDefs.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name)]);
const secs = (a) => Math.max(1, Number(a.end_seconds ?? 5) - Number(a.start_seconds ?? 0));
function estimate(name, a) {
  try {
    if (IMAGE_TOOLS.has(name)) return stillCost(a.model, a.resolution && a.resolution !== "auto" ? a.resolution : "640px") * (a.image_count || 1);
    if (name === "create_spoken_ad_video") return 48 * secs(a);
    if (VIDEO_MODEL_TOOLS.has(name) && FREE_VIDEO.includes(a.model)) return videoCost(Number(a.end_seconds || 5) - Number(a.start_seconds || 0), a.model, "480p");
    if (name === "create_talking_photo") return 48 * secs(a);
    if (name === "swap_face_in_video") return 30 * secs(a);
    if (name === "add_subtitles_to_video") return 6 * secs(a);
    if (name === "ai_voice_generator_create_audio") return 4;
    if (name === "generate_music") return Number(a.duration || 15);
    if (name === "upscale_image") return (a.scale_factor === 4 ? 50 : 25) * (/balanced|creative/.test(a.style?.mode || "balanced") ? 2 : 1);
    if (name in FIXED) return FIXED[name];
  } catch { return null; }
  return null;
}
const UNPRICED = 150;   // what a call the price list cannot price reserves from the shared allowance until its real charge is known
function decide(name, a, left) {
  const deny = (reason) => ({ approve: false, reason });
  if (/^delete_/.test(name)) return deny("deletions are not part of this run");
  if (chat.mode === "dry" && !FREE_TOOLS.has(name)) return deny("insufficient credits (dry run: this run makes nothing; the attempted call is recorded)");
  const m = a.model, r = a.resolution;
  if (IMAGE_TOOLS.has(name)) {
    if (!m || m === "default" || !FREE_STILL.includes(m)) return deny(`model "${m || "default"}" is not available on the free plan; the free plan's image models are ${FREE_STILL.join(", ")} (set model explicitly)`);
    if (r && !["auto", "640px"].includes(r)) return deny(`resolution ${r} is not available on the free plan (640px is)`);
  }
  if (VIDEO_MODEL_TOOLS.has(name)) {
    if (!m || m === "default" || !FREE_VIDEO.includes(m)) return deny(`model "${m || "default"}" is not available on the free plan; the free plan's video models are ${FREE_VIDEO.join(" and ")} (set model explicitly)`);
    if (r !== "480p") return deny(`${r ? `resolution ${r} is` : "the default resolution is"} not available on the free plan; set resolution to 480p`);
  }
  if (["create_talking_photo", "create_video_from_audio", "translate_video", "upscale_video"].includes(name) && r && !["480p"].includes(r)) return deny(`resolution ${r} is not available on the free plan; set resolution to 480p`);
  if (name === "upscale_image" && Number(a.scale_factor) === 4) return deny("4x upscale is only available on paid plans; 2x is available");
  const est = estimate(name, a);
  if (est != null && est > left) return deny(`insufficient credits: this call needs about ${est} credits and ${Math.max(0, left)} remain on the account`);
  return { approve: true, reason: "", est };
}

// ---- the shared credit allowance of the whole fleet run (one ledger file, a lock directory for the read-modify-write)
const ledgerFile = join(FLEET, tag, "ledger.json"), lockDir = join(FLEET, tag, "ledger.lock");
async function withLock(fn) {
  for (let i = 0; i < 600; i++) {
    try { mkdirSync(lockDir); } catch (e) { if (e.code !== "EEXIST") throw e; try { if (Date.now() - statSync(lockDir).mtimeMs > 15000) rmdirSync(lockDir); } catch {} await sleep(20 + Math.random() * 60); continue; }
    try { return fn(); } finally { try { rmdirSync(lockDir); } catch {} }
  }
  throw new Error("ledger lock timeout");
}
const ledger = () => readJson(ledgerFile, { limit: 0, spent: 0, reserved: 0, floor: 0 });
const balance = async () => { try { const r = await fetch("https://api.magichour.ai/v1/account", { headers: { authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` } }); return (await r.json()).credits ?? null; } catch { return null; } };

async function callMcp(name, args) {
  const r = await fetch(chat.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }) });
  const t = await r.text(); let j = null;
  if (r.headers.get("content-type")?.includes("text/event-stream")) { const d = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean); j = parseJson(d.at(-1)); } else j = parseJson(t);
  if (!j || j.error) return { output: null, error: JSON.stringify(j?.error || t).slice(0, 800) };
  const res = j.result || {}, text = res.structuredContent ? JSON.stringify(res.structuredContent) : (res.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return res.isError ? { output: null, error: text.slice(0, 2000) } : { output: text, error: null };
}
const MEDIA_URL = /https?:\/\/[^\s"'\\<>]+?\.(?:png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a)(?:\?[^\s"'\\<>]*)?/gi;
async function saveMedia(name, output) {
  const files = [], seen = new Set(S.mediaSeen || []);
  for (const u of [...new Set([...(output || "").matchAll(MEDIA_URL)].map((m) => m[0]))].filter((u) => !/magichour\.ai\/my-library|\/upload/.test(u))) {
    const base = u.split("?")[0]; if (seen.has(base)) continue; seen.add(base);
    const ext = (new URL(u).pathname.match(/\.\w+$/) || [".bin"])[0], f = `assets/${String(seen.size).padStart(2, "0")}-${name.replace(/[^a-z0-9_]+/gi, "-")}${ext}`;
    mkdirSync(join(dir, "assets"), { recursive: true });
    try { await download(u, join(dir, f)); files.push(f); } catch (e) { files.push(`download failed: ${String(e.message).slice(0, 80)}`); }
  }
  S.mediaSeen = [...seen]; return files;
}
async function tool(name, rawArgs) {
  if (S.ended) { console.log("THE CONVERSATION HAS ENDED. Nothing more can be done in it. Answer only with the word: done"); return; }   // a chat app has no work after the last message
  const a = parseJson(rawArgs || "{}"); if (a === null || typeof a !== "object") { console.log("The arguments must be one JSON object."); return; }
  const ro = RO.has(name), free = ro || FREE_TOOLS.has(name); let d = { approve: true, reason: "", est: null }, reserve = 0;
  if (!ro) {
    const L = ledger(); d = decide(name, a, chat.mode === "dry" ? 1e9 : L.limit - L.spent - L.reserved);
    S.approvals++;
    if (d.approve && !free && chat.mode !== "dry") {
      reserve = d.est ?? UNPRICED;
      const ok = await withLock(() => { const l = ledger(); if (l.spent + l.reserved + reserve > l.limit) return false; l.reserved += reserve; writeFileSync(ledgerFile, JSON.stringify(l)); return true; });
      if (!ok) { d = { approve: false, reason: `insufficient credits: this call needs about ${reserve} credits and the account's remaining allowance is lower` }; reserve = 0; }
      else { const b = await balance(); if (b == null || b <= L.floor) { await withLock(() => { const l = ledger(); l.reserved -= reserve; writeFileSync(ledgerFile, JSON.stringify(l)); }); d = { approve: false, reason: "insufficient credits: the account has no credits left to spend" }; reserve = 0; } }
    }
  }
  if (!d.approve) { log({ type: "call", tool: name, args: a, approve: false, reason: d.reason, est: d.est ?? null }); save(); console.log(`The Magic Hour account refused this call: ${d.reason}`); return; }
  S.callsSinceUser++;   // a refused call is a gate decision, not a call made: "called tools before replying" counts the calls that ran
  const t0 = Date.now(), r = await callMcp(name, a), ms = Date.now() - t0;
  let credits = 0;
  if (!ro) credits = r.error ? 0 : Number(parseJson(r.output || "")?.credits_charged ?? 0);
  if (reserve) await withLock(() => { const l = ledger(); l.reserved -= reserve; l.spent += credits; writeFileSync(ledgerFile, JSON.stringify(l)); });
  const files = r.error ? [] : await saveMedia(name, r.output);
  log({ type: "call", tool: name, args: a, approve: true, est: d.est ?? null, credits, ms, output: cut(r.output, 30000), error: r.error, files });
  save(); console.log(r.error ? `Error: ${r.error}` : cut(r.output, 30000));
}

// ---- the conversation
const showMessage = (m) => `${m.message}`;
function begin() {
  if (!S.begun) { S.begun = true; S.transcript.push({ role: "user", text: chat.messages[0].text, msg: 0 }); log({ type: "begin" }); S.callsSinceUser = 0; save(); }
  console.log(`THE USER'S MESSAGE:\n${showMessage(chat.messages[S.msg])}`);
}
async function say(text) {
  if (S.ended) { console.log("THE CONVERSATION HAS ENDED. Answer only with the word: done"); return; }
  if (!S.begun) { console.log("Run --begin first."); return; }
  text = String(text || "").trim(); if (!text) { console.log("The message is empty."); return; }
  const called = S.callsSinceUser > 0, k = classify(text, called), isQA = ["question", "approval"].includes(k.kind);
  const nudgeLine = chat.itemNudge || (S.approvals === S.tried && !chat.replyItem ? P.nudge : null), nudge = k.kind === "cannot" && !!nudgeLine && !S.nudged;
  let reply = null, mark = {};   // the simulated user reads the conversation as it stood before this message (the message itself is given to it separately)
  if (S.round < 3 && (isQA || nudge)) { reply = nudge ? nudgeLine : userReply(text, k.kind); S.nudged ||= nudge; S.round++; S.tried = S.approvals; mark = nudge ? { nudge: true } : {}; }
  else if (isQA && P.giveUp && !S.gaveUp) { reply = P.giveUp; S.gaveUp = true; mark = { give_up: true }; }
  S.transcript.push({ role: "assistant", text, kind: k.kind, why: k.why, called }); log({ type: "say", kind: k.kind, why: k.why, called, text: cut(text, 6000) });
  if (reply != null) { S.transcript.push({ role: "user", text: reply, ...mark }); S.callsSinceUser = 0; log({ type: "user", text: reply, ...mark }); save(); console.log(`THE USER REPLIES:\n${reply}`); return; }
  // this user message is done: refusal ends the chat; otherwise the next message of the item, or the end
  log({ type: "turn_end", kind: k.kind, msg: S.msg });
  if (k.kind !== "refusal" && S.msg + 1 < chat.messages.length) {
    S.msg++; S.round = 0; S.nudged = false; S.gaveUp = false; S.approvals = 0; S.tried = 0; S.callsSinceUser = 0;
    S.transcript.push({ role: "user", text: chat.messages[S.msg].text, msg: S.msg }); log({ type: "user", text: chat.messages[S.msg].text, next_message: true }); save();
    console.log(`THE USER'S NEXT MESSAGE:\n${showMessage(chat.messages[S.msg])}`); return;
  }
  S.ended = true; log({ type: "end", kind: k.kind }); save(); console.log("THE CONVERSATION HAS ENDED. Answer only with the word: done");
}
if (cmd === "--begin") begin();
else if (cmd === "--say") { const t = rest[0] === "-" ? readFileSync(0, "utf8") : rest.join(" "); await say(t); }
else if (cmd === "--status") console.log(JSON.stringify({ begun: S.begun, ended: S.ended, msg: S.msg, round: S.round, turns: S.transcript.length, approvals: S.approvals }));
else await tool(cmd, rest[0]);
save();
