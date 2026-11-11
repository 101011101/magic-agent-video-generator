// The MCP baseline: every bench v1 item given, word for word, to an off-the-shelf chat model with Magic Hour's hosted MCP
// server connected and nothing else (the user's request of 2026-11-01: "install our MCP and just give it the exact same
// prompt you give your agent"). The chat model is the one the agent itself runs on (lib/llm.js MODEL), so the comparison
// is between the two systems, not two models. The proxy user answers its questions from the same answer sheet.
//
// The account is treated as a FREE account, which is the benchmark's rule: every create call goes through an approval
// gate (OpenAI's require_approval) that refuses a paid model, a resolution above the free plan's, a 4x upscale or a call
// beyond the free account's credits (400 at signup), the way the API would refuse a free key. Every call, approved or
// refused, is kept in the record. Outputs are downloaded into sessions/mcp-<prefix>-<id>/assets so the same grader
// (bench/v1/grade.mjs), report and pages read them; the record has the same shape as bench/v1/run.mjs writes.
// Usage: node V2/bench/mcp/run.mjs [--only A01d,B07a] [--groups A,B] [--items dir] [--out V2/bench/v1/results/mcp-1] [--prefix m1]
//        [--item-cap 400] [--cap 3000] [--concurrency 3] [--model gpt-6.1-sol] [--effort medium] [--probe]
//        [--persona happy|stupid|impatient|dumper|tightwad|changer] [--openings dir] [--dry]
// --persona: the user archetype the proxy user plays (personas.mjs). Its first message is openings/<persona>/<id>.json
// (written once by openings.mjs), the brief as written for happy; the changer sends one follow-up change after the result.
// After three answers the user gives up with the persona's line, once. --dry: nothing is made; every create call is refused
// at the gate and the questions, the replies and the attempted call are recorded (0 credits, OpenAI tokens only). Dry first.
// Every item also writes <id>.trace.json beside <id>.json: the whole conversation as ordered events with the milliseconds since the
// item began (user_message, proxy with the prompt that wrote the line, llm hop with tokens and time, thought, said, gate, call with
// full arguments and result, classify with the reason, turn_end). tools.json (what the driver was offered) and run.json (system
// prompt, the persona's rules, token totals, errors) sit in the folder. --thoughts adds the model's reasoning summaries (both paths).
// A fault part-way ends that conversation only: the record carries `error` and the turns so far. View: transcript.mjs --full.
// LLM_PROVIDER=anthropic (with ANTHROPIC_API_KEY, optional CLAUDE_USD_CAP) runs everything on Claude instead (default claude-opus-5-5): the host,
// the simulated user, the classifier. See claude/. Both sides then use the client-side tool path, with the same gate. A Claude run is its own
// column: it is not comparable with the GPT runs. Spend is in run.json (claude_spend).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { key } from "../../backend/lib/env.js";
import { jsonCall, S, MODEL } from "../../backend/lib/llm.js";
import { STILLS, stillCost, videoCost } from "../../backend/lib/models.js";
import { upload, download } from "../../backend/lib/magichour.js";
import { PERSONAS, REPLY_ITEMS, bankOf, applyChange } from "./personas.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../.."), FIX = join(V2, "bench/v1/fixtures");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ITEMS = arg("--items", join(V2, "bench/v1/items"));   // --items: another item folder with the same schema (the film briefs in bench/mcp/film/items)
const only = (arg("--only", "") || "").split(",").filter(Boolean), groups = (arg("--groups", "") || "").split(",").filter(Boolean);
const PREFIX = arg("--prefix", "m1"), OUT = arg("--out", join(V2, "bench/v1/results", "mcp-1")), N = Number(arg("--concurrency", "3"));
const LLM = arg("--model", MODEL), EFFORT = arg("--effort", "medium"), ITEM_CAP = Number(arg("--item-cap", "400")), CAP = Number(arg("--cap", "3000")), PROBE = process.argv.includes("--probe");
// --mcp-url: another server address. --local: the server is a build on this machine that OpenAI cannot reach, so its tools are
// offered as function tools and each call is made from here, through the same gate. --hide a,b: tools not offered (the "before" side).
// --fixture-url: a base address where the server can download the attached videos (a chat app hands its server a URL; an
// uploaded file_path cannot be read back), added to the attachment line of each video.
const FIXTURE_URL = arg("--fixture-url", "");
// --floor N (real runs): stop starting items when the account's own balance, read from Magic Hour before each item (free), is N credits or less.
// The guard that does not depend on this run's bookkeeping: set it to (balance now - what the batch may spend). At most --concurrency items are in flight past it.
const FLOOR = Number(arg("--floor", "0"));
// --thoughts: ask for the model's reasoning summaries and keep them, in order with the calls, as turn.timeline.
const THOUGHTS = process.argv.includes("--thoughts");
const MCP_URL = arg("--mcp-url", "https://mcp.magichour.ai/"), LOCAL = process.argv.includes("--local"), HIDE = (arg("--hide", "") || "").split(",").filter(Boolean);
const PERSONA = arg("--persona", "happy"), P = PERSONAS[PERSONA]; if (!P) throw new Error(`unknown persona ${PERSONA}; one of ${Object.keys(PERSONAS).join(", ")}`);
const DRY = process.argv.includes("--dry"), OPENINGS = arg("--openings", join(HERE, "openings"));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the free plan, as the MCP's own tool descriptions state it
const FREE_STILL = Object.entries(STILLS).filter(([, m]) => m.plan === "free").map(([k]) => k);   // flux-2-klein, qwen-image-2.1, qwen-edit, krea-2, flux-schnell, z-image-turbo
const FREE_VIDEO = ["ltx-2.5", "minimax-h3"];                                                       // "With default, paid tiers use kling-3.0 and Free uses ltx-2.5"
const IMAGE_TOOLS = new Set(["generate_image", "edit_image"]), VIDEO_MODEL_TOOLS = new Set(["create_video_from_text", "create_video_from_image", "edit_video", "replace_character_in_video", "create_spoken_ad_video"]);
const READ_ONLY = ["get_workflow_guide", "ping", "wait_for_video_project", "wait_for_image_project", "wait_for_audio_project", "fetch_image_download", "fetch_audio_download", "fetch_video_download", "get_account_info", "list_saved_items", "get_upload_urls", "get_face_detection_results", "get_video_project", "get_image_project", "get_audio_project", "join_production_clips", "join_videos", "get_last_frame"];   // the join spends nothing; its film link is downloaded like a finished job
const WAITS = new Set(["wait_for_video_project", "wait_for_image_project", "wait_for_audio_project", "get_video_project", "get_image_project", "get_audio_project"]);
// Tools that make nothing and cost nothing: the only ones a dry run lets through (the planning tools of the upgraded build among them).
const FREE_TOOLS = new Set([...READ_ONLY, "plan_request", "plan_video_production", "detect_faces", "get_face_detection_results", "upload_chatgpt_image", "upload_chatgpt_media"]);
const FIXED = { swap_face_in_photo: 10, swap_head_in_photo: 10, remove_image_background: 5, colorize_photo: 10, create_meme: 10, create_qr_code: 0, generate_headshot: 50, create_gif_or_short_video: 50, edit_face_in_photo: 1, detect_faces: 0 };

// What a call would cost, from the registry where the model decides it; null when the sheet does not say.
function estimate(name, a) {
  try {
    if (IMAGE_TOOLS.has(name)) return stillCost(a.model, a.resolution && a.resolution !== "auto" ? a.resolution : "640px") * (a.image_count || 1);
    if (VIDEO_MODEL_TOOLS.has(name) && FREE_VIDEO.includes(a.model)) return videoCost(Number(a.end_seconds || 5) - Number(a.start_seconds || 0), a.model, "480p");
    if (name === "generate_music") return Number(a.duration || 15);
    if (name === "upscale_image") return (a.scale_factor === 4 ? 50 : 25) * (/balanced|creative/.test(a.style?.mode || "balanced") ? 2 : 1);
    if (name in FIXED) return FIXED[name];
  } catch { return null; }
  return null;
}
// The gate: approve or refuse one call, the way a free account's API would.
function decide(name, a, left) {
  const deny = (reason) => ({ approve: false, reason });
  if (/^delete_/.test(name)) return deny("deletions are not part of this run");
  if (DRY && !FREE_TOOLS.has(name)) return deny("insufficient credits (dry run: this run makes nothing; the attempted call is recorded)");
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
  if (name === "create_production_clip" && left <= 0) return deny(`insufficient credits: the free account's ${ITEM_CAP} credits are used`);   // the server sets the clip's length, so the cap is checked on what was charged
  const est = estimate(name, a);
  if (est != null && est > left) return deny(`insufficient credits: this call needs about ${est} credits and ${Math.max(0, left)} remain of the free account's ${ITEM_CAP}`);
  return { approve: true, reason: "", est };
}

// ---- OpenAI Responses API with the remote MCP tool; background mode so a long wait_for_* call does not outlive fetch.
// The MCP's tool list, read once (initialize + tools/list), so the run records the server version and offers every tool
// except the ones that would break the free-account emulation: the balance (the key is a creator account) and deletions.
const HIDDEN = ["get_account_info", "delete_video_project", "delete_image_project", "delete_audio_project", ...HIDE];
async function listTools() {
  const H = { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` };
  const parse = async (r) => { const t = await r.text(); if (r.headers.get("content-type")?.includes("text/event-stream")) { const d = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean); return JSON.parse(d.at(-1)); } return t ? JSON.parse(t) : null; };
  let r = await fetch(MCP_URL, { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "bench-mcp", version: "1" } } }) });
  const sid = r.headers.get("mcp-session-id"), init = await parse(r), H2 = { ...H, ...(sid ? { "mcp-session-id": sid } : {}) };
  await fetch(MCP_URL, { method: "POST", headers: H2, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }).catch(() => {});
  r = await fetch(MCP_URL, { method: "POST", headers: H2, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) });
  const tools = (await parse(r))?.result?.tools || []; if (!tools.length) throw new Error("the MCP listed no tools");
  return { server: init?.result?.serverInfo || null, tools: tools.map((t) => t.name), defs: tools };
}
const SERVER = await listTools(); const OFFERED = SERVER.tools.filter((t) => !HIDDEN.includes(t));
// What the driver was offered, kept beside the results: every tool's description and schema, so a choice of tool can be read against the words that led to it.
writeFileSync(join(OUT, "tools.json"), JSON.stringify({ at: new Date().toISOString(), server: SERVER.server, url: MCP_URL, local: LOCAL, offered: OFFERED, hidden: HIDDEN, tools: SERVER.defs.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })) }, null, 1));
const MCP = () => ({ type: "mcp", server_label: "magic_hour", server_url: MCP_URL, authorization: key("MAGIC_HOUR_API_KEY"), require_approval: { never: { tool_names: READ_ONLY.filter((t) => OFFERED.includes(t)) } }, allowed_tools: PROBE ? ["ping", "get_workflow_guide"] : OFFERED });
const SYSTEM = `You are a helpful assistant in a chat app. The user has connected the Magic Hour MCP server (tools that make and edit images, video and audio). The user's Magic Hour account is on the FREE plan: only free-plan models and settings run (images: ${FREE_STILL.join(", ")} at 640px; video: ${FREE_VIDEO.join(" or ")} at 480p; the other tools at their free settings). A call with a paid model, a higher resolution or more credits than the account has is refused by the account. Files the user attaches are already in their Magic Hour account: use the file_path given with each attachment wherever a tool takes a *_file_path. When a job finishes, give the user the download link(s) of what you made.`;
const headers = () => ({ authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" });
async function respond(body) {
  const tStart = Date.now();
  for (let attempt = 1; ; attempt++) {
    let res, data;
    try {
      res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: headers(), body: JSON.stringify({ ...body, background: true, store: true }) });
      data = await res.json().catch(() => ({}));
      const t0 = Date.now();
      while (res.ok && (data.status === "queued" || data.status === "in_progress")) {
        if (Date.now() - t0 > 20 * 60000) { await fetch(`https://api.openai.com/v1/responses/${data.id}/cancel`, { method: "POST", headers: headers() }).catch(() => {}); throw new Error(`OpenAI still ${data.status} after 20 min (cancelled)`); }
        await sleep(4000); res = await fetch(`https://api.openai.com/v1/responses/${data.id}`, { headers: headers() }); data = await res.json().catch(() => ({}));
      }
    } catch (e) { if (attempt === 3) throw e; await sleep(5000 * attempt); continue; }
    if (res.ok && data.status === "completed") { data._ms = Date.now() - tStart; data._attempts = attempt; return data; }   // wall time of the hop, retries included
    // A background response that failed on the tokens-per-minute limit is retried (2026-11-07: about 30 items were lost to it).
    if (res.ok && data.status === "failed" && /rate_limit/.test(JSON.stringify(data.error || {})) && attempt < 8) { await sleep(15000 * attempt); continue; }
    if (res.ok) throw new Error(`OpenAI ${data.status}: ${JSON.stringify(data.error || data.incomplete_details || {}).slice(0, 300)}`);
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await sleep(5000 * attempt);
  }
}
const textOf = (data) => (data.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n").trim();
const parseJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

// ---- the trace of one item (written to <id>.trace.json): every model hop with its time and tokens, each thought, message, tool call
// (full arguments and full result) and gate decision, each line the simulated user sent with the prompt that wrote it, each
// classification of the assistant's reply. In order, with the milliseconds since the item began. budget.emit(type, data) adds one.
const usageOf = (d) => ({ input: d.usage?.input_tokens ?? 0, output: d.usage?.output_tokens ?? 0, reasoning: d.usage?.output_tokens_details?.reasoning_tokens ?? 0, cached: d.usage?.input_tokens_details?.cached_tokens ?? 0 });
const inputText = (input) => typeof input === "string" ? input : (input || []).map((x) => {
  if (x.type) return `[${x.type}${x.call_id || x.approval_request_id ? ` ${x.call_id || x.approval_request_id}` : ""}${x.approve === false ? " refused" : ""}]${x.type === "function_call_output" ? ` ${String(x.output ?? "").slice(0, 3000)}` : ""}`;
  if (x.role === "developer") return `[developer] ${x.content}`;
  const pics = (x.content || []).filter((c) => c.type === "input_image").length;
  return (x.content || []).filter((c) => c.type === "input_text").map((c) => c.text).join("\n") + (pics ? `\n[+${pics} picture(s)]` : "");
}).join("\n");
function traceHop(budget, data, input, prev) {
  const u = usageOf(data), b = budget.usage; b.responses++; b.input += u.input; b.output += u.output; b.reasoning += u.reasoning; b.cached += u.cached;
  budget.emit("llm", { id: data.id, previous: prev ?? null, status: data.status, ms: data._ms, attempts: data._attempts, usage: u, input: inputText(input).slice(0, 20000), items: (data.output || []).map((o) => o.type) });
  for (const o of data.output || []) {
    if (o.type === "reasoning") { for (const sm of o.summary || []) if (sm.text) budget.emit("thought", { text: sm.text }); }
    else if (o.type === "message") { const t = (o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n"); if (t) budget.emit("said", { text: t }); }
    else if (o.type === "mcp_call") budget.emit("call", { name: o.name, arguments: o.arguments, output: o.output, error: o.error ? String(typeof o.error === "string" ? o.error : JSON.stringify(o.error)) : null });   // hosted: the result arrives with the call
    else if (o.type === "mcp_approval_request") budget.emit("approval_request", { name: o.name, arguments: o.arguments });
  }
}

// One user message in, the assistant's final reply out, with every tool call and every gate decision on the way.
async function converse(input, prev, budget) {
  if (CLAUDE) return claudeDriver(input, prev, budget);
  if (LOCAL) return converseLocal(input, prev, budget);
  const base = { model: LLM, instructions: SYSTEM, tools: [MCP()], reasoning: { effort: EFFORT, ...(THOUGHTS ? { summary: "detailed" } : {}) } };
  let data = await respond({ ...base, input, ...(prev ? { previous_response_id: prev } : {}) });
  traceHop(budget, data, input, prev);
  const calls = [], approvals = []; let text = "";
  for (let hop = 0; hop < 30; hop++) {
    for (const o of data.output || []) if (o.type === "mcp_call") {
      const c = { name: o.name, arguments: o.arguments, output: o.output, error: o.error ? String(typeof o.error === "string" ? o.error : JSON.stringify(o.error)) : null }; calls.push(c);
      const p = approvals.find((x) => x.approve && x.pending && x.name === o.name); if (p) { p.pending = false; budget.settle(p.est || 0, c.error ? 0 : Number(parseJson(c.output || "")?.credits_charged ?? ((c.output || "").match(/"credits_charged":\s*(\d+)/) || [])[1] ?? 0)); }
    }
    text = textOf(data) || text;
    const reqs = (data.output || []).filter((o) => o.type === "mcp_approval_request");
    if (!reqs.length) break;
    const inputs = [], notes = [];
    for (const r of reqs) {
      const a = parseJson(r.arguments) || {}, d = decide(r.name, a, budget.left());
      approvals.push({ name: r.name, args: a, approve: d.approve, reason: d.reason, est: d.est ?? null, pending: d.approve });
      budget.emit("gate", { name: r.name, arguments: r.arguments, approve: d.approve, reason: d.reason, est: d.est ?? null });
      if (d.approve) budget.reserve(d.est || 0);
      inputs.push({ type: "mcp_approval_response", approval_request_id: r.id, approve: d.approve });
      if (!d.approve) notes.push(`${r.name}: ${d.reason}`);
    }
    if (notes.length) inputs.push({ role: "developer", content: `The Magic Hour account refused these calls:\n${notes.map((n) => `- ${n}`).join("\n")}` });
    const before = data.id; data = await respond({ ...base, previous_response_id: data.id, input: inputs }); traceHop(budget, data, inputs, before);
  }
  return { id: data.id, text, calls, approvals };
}

// --local: the same loop with function tools. A read-only tool is called at once; any other call goes through the gate first.
const RO = new Set([...READ_ONLY, ...SERVER.defs.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name)]);
const FUNCTIONS = () => SERVER.defs.filter((t) => OFFERED.includes(t.name) && (!PROBE || ["ping", "get_workflow_guide"].includes(t.name))).map((t) => ({ type: "function", name: t.name, description: t.description || "", parameters: t.inputSchema || { type: "object", properties: {} }, strict: false }));
async function callLocal(name, args) {
  const r = await fetch(MCP_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }) });
  const t = await r.text(); let j = null;
  if (r.headers.get("content-type")?.includes("text/event-stream")) { const d = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean); j = parseJson(d.at(-1)); } else j = parseJson(t);
  if (!j || j.error) return { output: null, error: JSON.stringify(j?.error || t).slice(0, 800) };
  const res = j.result || {}, text = res.structuredContent ? JSON.stringify(res.structuredContent) : (res.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return res.isError ? { output: null, error: text.slice(0, 2000) } : { output: text, error: null };
}
// LLM_PROVIDER=anthropic: the host is a Claude model (bench/mcp/claude/). The same loop as converseLocal, client-side, for both sides.
// Made once: the driver holds the conversations, so every item must use the same one.
const CLAUDE = process.env.LLM_PROVIDER === "anthropic";
const claudeDriver = CLAUDE ? (await import("./claude/driver.mjs")).makeDriver({ model: LLM, system: SYSTEM, effort: EFFORT, thoughts: THOUGHTS, decide, callTool: callLocal, isReadOnly: (n) => RO.has(n), parseJson,
  toolDefs: SERVER.defs.filter((t) => OFFERED.includes(t.name) && (!PROBE || ["ping", "get_workflow_guide"].includes(t.name))) }) : null;
async function converseLocal(input, prev, budget) {
  const base = { model: LLM, instructions: SYSTEM, tools: FUNCTIONS(), reasoning: { effort: EFFORT, ...(THOUGHTS ? { summary: "detailed" } : {}) } };
  let data = await respond({ ...base, input, ...(prev ? { previous_response_id: prev } : {}) });
  traceHop(budget, data, input, prev);
  const calls = [], approvals = [], timeline = []; let text = "";
  for (let hop = 0; hop < 30; hop++) {
    text = textOf(data) || text;
    for (const o of data.output || []) {
      if (o.type === "reasoning") for (const sm of o.summary || []) if (sm.text) timeline.push({ type: "thought", text: sm.text });
      if (o.type === "message") { const t = (o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n"); if (t) timeline.push({ type: "said", text: t }); }
    }
    const asked = (data.output || []).filter((o) => o.type === "function_call");
    if (!asked.length) break;
    const inputs = [];
    for (const f of asked) {
      const a = parseJson(f.arguments) || {}; let d = { approve: true, reason: "", est: null }, c = null, ms = null;
      if (!RO.has(f.name)) { d = decide(f.name, a, budget.left()); approvals.push({ name: f.name, args: a, approve: d.approve, reason: d.reason, est: d.est ?? null }); budget.emit("gate", { name: f.name, arguments: f.arguments, approve: d.approve, reason: d.reason, est: d.est ?? null }); }
      if (d.approve) { budget.reserve(d.est || 0); const tc = Date.now(), r = await callLocal(f.name, a); ms = Date.now() - tc; c = { name: f.name, arguments: f.arguments, output: r.output, error: r.error }; calls.push(c); budget.settle(d.est || 0, r.error || RO.has(f.name) ? 0 : Number(parseJson(r.output || "")?.credits_charged ?? 0)); }   // a read-only call (a wait) repeats the job's charge in its output: not counted again
      budget.emit("call", { name: f.name, arguments: f.arguments, output: d.approve ? c.output : null, error: d.approve ? c.error : null, ...(d.approve ? {} : { refused: d.reason }), ms });
      inputs.push({ type: "function_call_output", call_id: f.call_id, output: d.approve ? (c.error ? `Error: ${c.error}` : c.output || "") : `The Magic Hour account refused this call: ${d.reason}` });
      timeline.push({ type: "call", name: f.name, arguments: f.arguments, result: (d.approve ? (c.error ? `Error: ${c.error}` : c.output || "") : `Refused by the account: ${d.reason}`).slice(0, 30000) });
    }
    const before = data.id; data = await respond({ ...base, previous_response_id: data.id, input: inputs }); traceHop(budget, data, inputs, before);
  }
  return { id: data.id, text, calls, approvals, timeline };
}

// What kind of reply that was: a question for the user, a request to proceed, a delivery, a refusal, a "cannot".
const kindOf = async (text, called, emit) => { const k = await classify(text, called); emit?.("classify", { kind: k.kind, why: k.why, called, reply: text.slice(0, 3000) }); return k; };
const classify = (text, called) => jsonCall({ name: "bench-mcp-kind", effort: "low", schema: S.obj({ kind: S.enum(["question", "approval", "delivered", "refusal", "cannot", "other"]), why: S.str }), prompt: `Classify this reply from a chat assistant that can make images, video and sound with tools. It ${called ? "called tools before replying" : "called no tool"}.
- question: it asks the user for information or a choice (which picture, what wording, what size, what mood) and waits.
- approval: it asks the user to confirm, to proceed, or to approve spending credits, and waits.
- delivered: it presents a finished result (a link, or what was made), even with caveats.
- refusal: it declines on policy or safety grounds.
- cannot: it says it cannot do this with the tools or plan it has (needs a paid plan, no such tool, cannot upload).
- other.
REPLY:
"""${text.slice(0, 3000)}"""` });
// The proxy user: the persona's rule, its knowledge bank and the whole conversation so far (every turn of the item, so a
// follow-up or a second question is answered in character and consistently). A fixed approval line is used as is.
const transcript = (turns) => turns.map((t) => [`USER: ${t.text}`, ...t.dialog.map((d) => `ASSISTANT: ${String(d.agent || "").slice(0, 1500)}\nUSER: ${d.user}`), ...(t.kind ? [`ASSISTANT: ${String(t.agent || "").slice(0, 1500)}`] : [])].join("\n")).join("\n");
// An item whose result IS the reply (a refusal, a quote, a "tell me first", a stop at a budget) is never pushed on: the generic nudge and the
// fixed approval line would make the user contradict their own request (J53a: "if it is over, stop" answered with "go ahead anyway").
const replyItem = (it) => REPLY_ITEMS.has(it.id) || ["none", "text"].includes(it.spec?.kind) || !!it.expect?.refuse;
const userReply = async ({ text, kind, turns, bank, emit, fixedOk = true }) => {
  if (kind === "approval" && typeof P.approval === "string" && fixedOk) { emit?.("proxy", { fixed: true, persona: PERSONA, reply: P.approval }); return P.approval; }
  const prompt = `You are playing a USER of a chat assistant that makes images, video and sound. Stay in character:
${P.reply}
YOUR KNOWLEDGE BANK, the only facts you have (never invent others): ${JSON.stringify(bank)}
THE CONVERSATION SO FAR (you wrote the USER lines):
${transcript(turns)}
THE ASSISTANT NOW SAYS${kind === "approval" ? " (it asks you to confirm, or to approve spending)" : kind === "question" ? " (it asks you something)" : ""}:
"""${text.slice(0, 3000)}"""
Write the user's next message.`;
  const out = await jsonCall({ name: "bench-mcp-proxy-user-v2", effort: "low", schema: S.obj({ reply: S.str }), prompt });
  emit?.("proxy", { persona: PERSONA, kind, prompt, reply: out.reply });   // the exact prompt that wrote the line, so the simulated user can be audited
  return out.reply;
};
// The persona's first message: the brief as written, or the opening written for it by openings.mjs.
function openingFor(it) {
  if (!P.opening && PERSONA !== "changer") return { text: it.turns[0].text, as_written: true };
  const f = join(OPENINGS, PERSONA, `${it.id}.json`);
  if (!existsSync(f)) throw new Error(`no opening for ${PERSONA}/${it.id}: node V2/bench/mcp/openings.mjs --persona ${PERSONA} --only ${it.id}`);
  return JSON.parse(readFileSync(f, "utf8"));
}

// ---- fixtures: uploaded once to the account (free), the file_path handed to the model with the attachment
const UP = join(OUT, "uploads.json"); const uploads = existsSync(UP) ? JSON.parse(readFileSync(UP, "utf8")) : {};
async function uploaded(name) { if (!uploads[name]) { uploads[name] = await upload(join(FIX, name)); writeFileSync(UP, JSON.stringify(uploads, null, 2)); } return uploads[name]; }
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm)$/i;
const jpg = (file) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "scale=1024:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "-"], { maxBuffer: 1 << 26 }).toString("base64");
async function userInput(msg) {
  const content = [], lines = [];
  for (const m of msg.materials || []) {
    if (/\.(txt|md)$/i.test(m)) { lines.push(`[Attached: ${m}]\nContents of ${m}:\n${readFileSync(join(FIX, m), "utf8").slice(0, 3000)}`); continue; }   // a text file is pasted, not uploaded (Magic Hour takes media only)
    const p = await uploaded(m); lines.push(`[Attached: ${m} — Magic Hour file_path: ${p}${FIXTURE_URL && (VID.test(m) || IMG.test(m)) ? ` — URL: ${FIXTURE_URL}/${m}` : ""}]`);
    if (IMG.test(m)) content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${jpg(join(FIX, m))}`, detail: "low" });
  }
  content.unshift({ type: "input_text", text: [msg.text, ...lines].join("\n") });
  return [{ role: "user", content }];
}

// ---- the account balance, for the run-level cross-check (free, GET /v1/account)
const balance = async () => { try { const r = await fetch("https://api.magichour.ai/v1/account", { headers: { authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}` } }); const j = await r.json(); return { tier: j.tier, credits: j.credits }; } catch { return null; } };

// ---- the record: every call becomes a step; a finished job's files are downloaded and become the steps that deliver
const MEDIA_URL = /https?:\/\/[^\s"'\\<>]+?\.(?:png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a)(?:\?[^\s"'\\<>]*)?/gi;
const strings = (x, out = []) => { if (typeof x === "string") out.push(x); else if (x && typeof x === "object") for (const v of Object.values(x)) strings(v, out); return out; };
async function buildSteps(calls, sess, fixturesByPath, M, turn) {   // M = { byJob, files, n }: shared across the item's turns, so a follow-up that takes an earlier output is wired to it
  const steps = [];
  const resolve = (v) => typeof v === "string" && v ? (M.files[v]?.produces || fixturesByPath[v] || Object.entries(M.files).find(([u]) => u.split("?")[0] === v.split("?")[0])?.[1]?.produces || null) : null;
  for (const c of calls) {
    const a = parseJson(c.arguments) || {}, out = c.output || "", j = parseJson(out);
    const urls = [...new Set([...out.matchAll(MEDIA_URL)].map((m) => m[0]))].filter((u) => !/magichour\.ai\/my-library|\/upload/.test(u));
    const credits = Number(j?.credits_charged ?? (out.match(/"credits_charged":\s*(\d+)/) || [])[1] ?? 0);
    if (READ_ONLY.includes(c.name) || /^delete_/.test(c.name)) {
      const jobId = a.id || j?.id || (out.match(/"id":\s*"([^"]+)"/) || [])[1], step = jobId ? M.byJob[jobId] : null;
      if (step && credits) step.credits = credits;
      for (const u of urls) {
        if (M.files[u]) continue;
        const ext = (new URL(u).pathname.match(/\.\w+$/) || [".bin"])[0], f = `assets/${String(++M.n).padStart(2, "0")}-${(step?.tool || c.name).replace(/[^a-z0-9_]+/gi, "-")}${ext}`;
        mkdirSync(join(sess, "assets"), { recursive: true });
        try { await download(u, join(sess, f)); } catch (e) { if (step && !step.output) { step.state = "failed"; step.error = `download: ${e.message.slice(0, 200)}`; } continue; }
        M.files[u] = { produces: f.slice(7) };
        if (step && !step.output && step.turn === turn) { step.output = f; step.produces = f.slice(7); step.url = u; }   // the job's first file is the create step's output
        else steps.push({ tool: step?.tool || c.name, state: "done", error: null, produces: f.slice(7), inputs: step ? (step.turn === turn ? [...step.inputs] : [step.produces]) : [], params: step?.params || {}, credits: 0, output: f, url: u, extra: true });   // a second file of the same job, or a job from an earlier turn
      }
      continue;
    }
    const refs = [...new Set(strings(a).map(resolve).filter(Boolean))];
    const jobId = j?.id || (out.match(/"id":\s*"([^"]+)"/) || [])[1];
    const step = { tool: c.name, state: c.error ? "failed" : "done", error: c.error ? c.error.slice(0, 300) : (j?.error ? JSON.stringify(j.error).slice(0, 300) : null), produces: jobId ? `job:${jobId}` : `${c.name}-${M.n + steps.length + 1}`, inputs: refs, params: { model: a.model || null, resolution: a.resolution || null, seconds: a.end_seconds ?? a.duration ?? null, aspect: a.aspect_ratio || a.orientation || null, prompt: (a.style?.prompt || a.prompt || a.style?.lyrics || "").slice(0, 400) }, credits, output: null, job: jobId || null, turn };
    if (j?.error || /^\s*\{\s*"error"/.test(out)) step.state = "failed";
    steps.push(step); if (jobId) M.byJob[jobId] = step;
  }
  return steps;
}

// ---- items
const items = readdirSync(ITEMS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(ITEMS, f), "utf8")))
  .filter((it) => (!only.length || only.includes(it.id)) && (groups.length ? groups.includes(it.group) : it.group !== "I")).sort((a, b) => a.id.localeCompare(b.id));
console.log(`MCP ${SERVER.server?.name || "?"} ${SERVER.server?.version || ""}: ${SERVER.tools.length} tools, ${OFFERED.length} offered (hidden: ${HIDDEN.join(", ")})`);
console.log(`${items.length} items · ${PROBE ? "PROBE (account info only)" : DRY ? "DRY: nothing is made, every create call is refused at the gate" : `REAL, free plan as a gate, ${ITEM_CAP} per item, ${CAP} for the run`} · persona ${PERSONA} · ${N} at a time · ${LLM} ${EFFORT} · ${relative(V2, OUT)}`);
let spentRun = 0;
const b0 = await balance(); if (b0) console.log(`account: ${b0.tier}, ${b0.credits} credits`);

async function runItem(it) {
  const sid = `mcp-${PREFIX}-${it.id}`, sess = join(V2, "sessions", sid), t0 = Date.now(); mkdirSync(sess, { recursive: true });
  const rec = { id: it.id, item: it, session: sid, sessionDir: `sessions/${sid}`, baseline: "mcp", provider: CLAUDE ? "anthropic" : "openai", model: LLM, effort: EFFORT, simulated: false, turns: [], started: new Date(t0).toISOString() };
  const fixturesByPath = {}, M = { byJob: {}, files: {}, n: 0 }; let prev = null, reserved = 0, charged = 0;
  const trace = [], ev = (type, d = {}) => trace.push({ t: Date.now() - t0, type, ...d });   // the item's trace, see traceHop
  const budget = { left: () => ITEM_CAP - reserved - charged, reserve: (x) => { reserved += x; }, settle: (est, cost) => { reserved -= est; charged += cost; }, emit: ev, usage: { responses: 0, input: 0, output: 0, reasoning: 0, cached: 0 } };   // a call reserves its estimate until its result arrives; what it charged then counts (a failed call, nothing)
  let T = null;   // the turn in progress, kept so a fault part-way still leaves what had happened
  try {
  const opening = openingFor(it), bank = bankOf(it); rec.persona = PERSONA; rec.opening = opening; rec.dry = DRY;
  ev("item_start", { id: it.id, title: it.title, persona: PERSONA, dry: DRY, local: LOCAL, mcp_url: MCP_URL, server: SERVER.server, provider: CLAUDE ? "anthropic" : "openai", model: LLM, effort: EFFORT, item_cap: ITEM_CAP, spec: it.spec, expect: it.expect, must_haves: it.must_haves, answer_sheet: it.answer_sheet });
  ev("opening", { as_written: !!opening.as_written, text: opening.text, withheld: opening.withheld ?? null, extras: opening.extras ?? null, change: opening.change ?? null });
  const change = PERSONA === "changer" ? opening.change || null : null; if (change) rec.change = { ...change, sent: false };
  const turns = it.turns.map((m, i) => (i === 0 ? { ...m, text: opening.text } : m));
  if (change) turns.push({ text: change.say, materials: [], follow_up: true });   // the changer's one change, after the result (in a dry run: after the attempted call)
  for (const msg of turns) {
    if (msg.follow_up) { if (!DRY && rec.turns.at(-1)?.kind !== "delivered") { rec.change.skipped = `nothing was delivered (${rec.turns.at(-1)?.kind})`; break; } rec.change.sent = true; rec.item = applyChange(it, change); }
    T = { text: msg.text, materials: msg.materials || [], dialog: [], agent: null, calls: [], approvals: [], ...(msg.follow_up ? { follow_up: true } : {}) };
    for (const m of msg.materials || []) if (!/\.(txt|md)$/i.test(m)) fixturesByPath[await uploaded(m)] = m;
    const s1 = Date.now();
    ev("user_message", { turn: rec.turns.length, role: msg.follow_up ? "follow_up" : rec.turns.length ? "next_message" : "opening", text: msg.text, materials: msg.materials || [] });
    let r = await converse(PROBE ? "Call ping and tell me whether Magic Hour is reachable." : await userInput(msg), prev, budget); prev = r.id;
    T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals); if (r.timeline) T.timeline = [...(T.timeline || []), ...r.timeline];
    let k = await kindOf(r.text, r.calls.length > 0, ev);
    T.firstQuestions = ["question", "approval"].includes(k.kind) ? [{ field: k.kind, question: r.text.slice(0, 400) }] : [];
    // An item may carry a `nudge`: what a cooperative user says, once, when the assistant answers that it cannot do the request.
    // Without one, the persona pushes once when the assistant says it cannot (or will not) without having attempted a single call
    // since the user's last message; a "cannot" after a refused call stands.
    let tried = 0;
    for (let round = 0, nudged = false; round < 3; round++) {
      const nudgeLine = it.nudge || (T.approvals.length === tried && !replyItem(it) ? P.nudge : null), nudge = k.kind === "cannot" && !!nudgeLine && !nudged;
      if (!["question", "approval"].includes(k.kind) && !nudge) break;
      const reply = nudge ? nudgeLine : await userReply({ text: r.text, kind: k.kind, turns: [...rec.turns, T], bank, emit: ev, fixedOk: !replyItem(it) }); nudged ||= nudge;
      T.dialog.push({ agent: r.text, asked: [k.kind], why: k.why, user: reply, calls_before: T.calls.length, ...(nudge ? { nudge: true } : {}) });   // calls_before: where in T.calls this exchange happened
      ev("user_message", { turn: rec.turns.length, role: nudge ? "nudge" : "reply", round: round + 1, text: reply });
      tried = T.approvals.length;
      r = await converse(reply, prev, budget); prev = r.id;
      T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals); if (r.timeline) T.timeline = [...(T.timeline || []), ...r.timeline];
      k = await kindOf(r.text, r.calls.length > 0, ev);
    }
    if (["question", "approval"].includes(k.kind) && P.give_up) {   // the round limit: the user gives up on the conversation, once
      T.dialog.push({ agent: r.text, asked: [k.kind], why: k.why, user: P.give_up, calls_before: T.calls.length, gave_up: true }); rec.gave_up = true;
      ev("user_message", { turn: rec.turns.length, role: "give_up", text: P.give_up });
      r = await converse(P.give_up, prev, budget); prev = r.id;
      T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals); if (r.timeline) T.timeline = [...(T.timeline || []), ...r.timeline];
      k = await kindOf(r.text, r.calls.length > 0, ev);
    }
    if (["question", "approval"].includes(k.kind)) T.stillAsking = [r.text.slice(0, 400)];
    T.kind = k.kind; T.denied = T.approvals.filter((a) => !a.approve).map((a) => `${a.name}: ${a.reason}`); for (const a of T.approvals) delete a.pending;
    const steps = await buildSteps(T.calls, sess, fixturesByPath, M, rec.turns.length);
    T.plan = { shape: "mcp", say: r.text.slice(0, 400), refuse: k.kind === "refusal" ? r.text.slice(0, 400) : "", tier_move: k.kind === "cannot" ? r.text.slice(0, 400) : null, estimate: null, steps: steps.map((s) => ({ tool: s.tool, model: s.params.model, resolution: s.params.resolution, inputs: s.inputs, produces: s.produces, params: s.params, credits: s.credits })) };
    if (steps.length) T.ran = steps.map((s) => ({ tool: s.tool, state: s.state, output: s.output, credits: s.credits, cached: false, simulated: false, note: s.url ? "downloaded from the job's signed URL" : s.state === "done" && !s.output && !READ_ONLY.includes(s.tool) ? "the job was created but its result was never fetched" : null, error: s.error, seconds: null }));
    T.spent = steps.reduce((a, s) => a + (s.credits || 0), 0); T.seconds = Math.round((Date.now() - s1) / 1000);   // (a turn with no steps has no `ran`, see above)
    rec.turns.push(T);
    ev("turn_end", { turn: rec.turns.length - 1, kind: T.kind, seconds: T.seconds, calls: T.calls.length, refused: T.denied.length, spent: T.spent, still_asking: !!T.stillAsking });
    if (T.kind === "refusal") break;
  }
  } catch (e) {   // a fault (OpenAI, the server) ends this conversation, not the sweep: the record keeps what happened up to it and says so
    rec.error = String(e.message || e); ev("error", { message: rec.error });
    if (T && !rec.turns.includes(T)) { T.partial = true; T.kind = T.kind || "error"; T.denied = T.approvals.filter((a) => !a.approve).map((a) => `${a.name}: ${a.reason}`); for (const a of T.approvals) delete a.pending; rec.turns.push(T); }
    console.log(`${it.id} ERROR ${rec.error.slice(0, 300)}`);
  }
  rec.spent = rec.turns.reduce((a, t) => a + (t.spent || 0), 0); rec.seconds = Math.round((Date.now() - t0) / 1000); spentRun += rec.spent;
  rec.usage = budget.usage; rec.server = { name: SERVER.server?.name, version: SERVER.server?.version, url: MCP_URL, local: LOCAL, hidden: HIDDEN }; rec.trace_file = `${it.id}.trace.json`;
  ev("item_end", { spent: rec.spent, seconds: rec.seconds, gave_up: !!rec.gave_up, usage: budget.usage, error: rec.error || null });
  writeFileSync(join(OUT, rec.trace_file), JSON.stringify({ id: it.id, persona: PERSONA, dry: DRY, events: trace }, null, 1));
  writeFileSync(join(OUT, `${it.id}.json`), JSON.stringify(rec, null, 2));
  console.log(`${it.id.padEnd(6)} ${String(rec.spent).padStart(4)} cr ${String(rec.seconds).padStart(4)} s · ${rec.turns.map((t) => `${t.dialog.length ? `${t.dialog.map((d) => d.asked[0]).join("+")} ` : ""}${t.calls.length ? t.calls.map((c) => c.name.replace(/^(create_|generate_|wait_for_|get_)/, "")).join("→") : "no tool"}${t.denied.length ? ` [refused ${t.denied.length}]` : ""} [${(t.ran || []).filter((s) => s.output).length} files]`).join(" | ")}`);
  return rec;
}

const queue = [...items], done = [];
await Promise.all(Array.from({ length: N }, async () => { while (queue.length) { if (spentRun >= CAP) { console.log(`cap ${CAP} reached; ${queue.length} items not run`); queue.length = 0; break; } if (FLOOR && !DRY) { const acct = await balance(); if (!acct || acct.credits <= FLOOR) { console.log(`${acct ? `account at ${acct.credits} credits, the floor is ${FLOOR}` : "account balance unreadable"}; ${queue.length} items not run`); queue.length = 0; break; } } const it = queue.shift(); try { done.push(await runItem(it)); } catch (e) { console.log(`${it.id} ERROR ${e.message.slice(0, 300)}`); writeFileSync(join(OUT, `${it.id}.json`), JSON.stringify({ id: it.id, item: it, baseline: "mcp", error: String(e.message || e) }, null, 2)); } } }));
const b1 = await balance();
const sum = (k) => done.reduce((a, r) => a + (r.usage?.[k] || 0), 0);
const claudeSpend = CLAUDE ? (await import("./claude/client.mjs")).spend : null;   // every Claude call of this process: the host, the simulated user, the classifier
writeFileSync(join(OUT, "run.json"), JSON.stringify({ at: new Date().toISOString(), baseline: "mcp", provider: CLAUDE ? "anthropic" : "openai", claude_spend: claudeSpend, mcp: SERVER.server, mcp_url: MCP_URL, local: LOCAL, tools_offered: OFFERED.length, hidden: HIDDEN, model: LLM, effort: EFFORT, thoughts: THOUGHTS, concurrency: N, item_cap: ITEM_CAP, persona: PERSONA, persona_def: P, dry: DRY, openings: relative(V2, OPENINGS), items: items.length, errors: done.filter((r) => r.error).map((r) => ({ id: r.id, error: String(r.error).slice(0, 300) })), spent: done.reduce((a, r) => a + (r.spent || 0), 0), usage: { responses: sum("responses"), input: sum("input"), output: sum("output"), reasoning: sum("reasoning"), cached: sum("cached") }, system: SYSTEM, tools_file: "tools.json", balance_before: b0, balance_after: b1 }, null, 2));
console.log(`\n${done.length}/${items.length} items · ${done.reduce((a, r) => a + (r.spent || 0), 0)} credits charged${b0 && b1 ? ` · balance ${b0.credits} → ${b1.credits} (${b0.credits - b1.credits} by the account)` : ""}${claudeSpend ? ` · Claude ${claudeSpend.calls} calls, about $${claudeSpend.usd.toFixed(2)}` : ""} · ${relative(V2, OUT)}`);
