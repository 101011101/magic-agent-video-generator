// The same bench items, word for word, given to the same chat model with a competitor's hosted MCP server connected and nothing
// else: bench/mcp/run.mjs for every other vendor. The account is the user's own free account on that service (signed in once with
// login.mjs). The conditions are in Benchmark/README.md of the MCP repo: free accounts only, each side on the allowance a new
// account starts with, and on each service the model that matches ours (servers.json "bench": plan, limits, rules).
// Every call that can create something goes through an approval gate that applies those rules, the way the account would refuse;
// purchase, checkout, delete and account tools are not offered at all. Read-only tools run without a gate.
// Outputs are downloaded into sessions/comp-<prefix>-<server>-<id>/assets and the record has the shape bench/mcp/run.mjs writes,
// so the same page generator reads it.
// Usage: node V2/bench/mcp/competitors/run.mjs --server krea [--only A2,A3] [--items dir] [--out dir] [--prefix c1]
//          [--profile bench_paid] [--budget 6] [--model gpt-6.1-sol] [--effort medium] [--probe]
//   --budget  the cap of the profile's budget (servers.json "budget"): seconds of generated video the account's credit covers
//   --probe   one harmless read-only call through the driver, to prove the driver can reach the server with the stored token
//   --dry     no driver and no job: put the item's attachments in place and print what the driver would be given
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { key } from "../../../backend/lib/env.js";
import { jsonCall, S, MODEL } from "../../../backend/lib/llm.js";
import { SERVERS, initialize, rpc, json } from "./common.mjs";
import { makeGate } from "./gate.mjs";
import { token } from "./login.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// --profile picks which set of conditions applies: "bench" (the default: a new free account) or another block of servers.json,
// such as "bench_paid" (the account has paid for volume and is held to the model that matches ours).
const NAME = arg("--server"), SRV = SERVERS[NAME], P = SRV?.[arg("--profile", "bench")];
if (!SRV?.url || !P) { console.error(`usage: node run.mjs --server <${Object.keys(SERVERS).filter((k) => SERVERS[k].bench).join(" | ")}> [--profile bench_paid] [--only A2] [--probe]`); process.exit(1); }
const ITEMS = arg("--items", join(V2, "bench/mcp/dense/items")), only = (arg("--only", "") || "").split(",").filter(Boolean), PREFIX = arg("--prefix", "c1");
const OUT = arg("--out", join(V2, "bench/v1/results", `comp-${PREFIX}-${NAME}`)), LLM = arg("--model", MODEL), EFFORT = arg("--effort", "medium"), PROBE = process.argv.includes("--probe");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the server: its tools, which are offered, which run without the gate
const TOKEN = await token(NAME); if (!TOKEN) throw new Error(`${NAME}: not signed in (login.mjs ${NAME})`);
const HIDE = /delete|logout|checkout|^select_account$|feedback|^track_|^report_session/;   // never offered: purchases, deletions, account switches, vendor telemetry
const READ = /^(get_|list_|search|show_|fetch_|check_|wait_|estimate_|browse|query_|hf_|hub_|inspect_|view_|recommend_|resolve_|verify_)|^(whoami|who_am_i|select_organization|cql|use_previous_output)$/;
async function direct(tool, args, url = SRV.url, tok = TOKEN) {   // one read-only call straight to a server (no driver): for the balance before and after, and for upload addresses
  const s = await initialize(url, tok); await rpc(url, tok, "notifications/initialized", undefined, s.session);
  const r = await rpc(url, tok, "tools/call", { name: tool, arguments: args }, s.session), res = r.body?.result;
  return res ? res.structuredContent ?? json((res.content || []).find((c) => c.type === "text")?.text || "") ?? (res.content || []).map((c) => c.text).join("\n") : null;
}
const s0 = await initialize(SRV.url, TOKEN); await rpc(SRV.url, TOKEN, "notifications/initialized", undefined, s0.session);
const TOOLS = ((await rpc(SRV.url, TOKEN, "tools/list", {}, s0.session)).body?.result?.tools || []).map((t) => t.name); if (!TOOLS.length) throw new Error(`${NAME}: the server listed no tools (HTTP ${s0.status})`);
const SERVER_INFO = s0.body?.result?.serverInfo || null, OFFERED = TOOLS.filter((t) => !HIDE.test(t)), NEVER = OFFERED.filter((t) => READ.test(t));
const MCP = () => ({ type: "mcp", server_label: NAME, server_url: SRV.url, authorization: TOKEN, require_approval: { never: { tool_names: PROBE ? [P.probe] : NEVER } }, allowed_tools: PROBE ? [P.probe] : OFFERED });
const BUDGET = arg("--budget") != null ? Number(arg("--budget")) : null, LIMITS = `${P.limits}${P.budget && BUDGET != null ? ` ${P.budget.tell.replace("{max}", String(BUDGET))}` : ""}`;
if (BUDGET != null && !(P.budget && BUDGET > 0)) throw new Error("--budget needs a profile with a budget block and a number above 0");
const SYSTEM = `You are a helpful assistant in a chat app. The user has connected the ${P.label} MCP server (tools that make and edit images, video and audio). The user's ${P.label} account is ${P.plan}. ${LIMITS} A call outside these limits is refused by the account. Do not start a purchase, an upgrade or a checkout.${P.attach_say ? ` ${P.attach_say}` : ""} When a job finishes, give the user the download link(s) of what you made.`;

// ---- attachments: a user's file reaches each service its own way (servers.json bench.attach). The file is put into the user's
// account before the message is sent, and the message names it, as bench/mcp/run.mjs does with Magic Hour file paths.
const FIX = join(V2, "bench/v1/fixtures"), attached = {}, handed = new Map();   // handed: address given to the driver → the fixture it stands for
const MIME = { mp4: "video/mp4", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav" };
// Krea's get_upload_url hands back a presigned address; the file goes up as multipart and the reply carries an asset address that
// anyone can read. Pictures are stored as sent; video is stored re-compressed (same size, rate and length).
async function kreaUpload(file, name, url, tok) {
  const r = await direct("get_upload_url", {}, url, tok), text = typeof r === "string" ? r : JSON.stringify(r), up = (text.match(/https:\/\/[^\s"\\]+/) || [])[0];
  if (!up || !new URL(up).hostname.endsWith("krea.ai")) throw new Error("Krea gave no upload address");
  const fd = new FormData(); fd.append("file", new Blob([readFileSync(file)], { type: MIME[name.split(".").pop().toLowerCase()] || "application/octet-stream" }), name);
  const res = await fetch(up, { method: "POST", body: fd }), body = await res.text(), asset = (body.match(/https:\/\/[^\s"\\]+/) || [])[0];
  if (!res.ok || !asset) throw new Error(`Krea upload failed (HTTP ${res.status})`);
  handed.set(asset, name); return asset;
}
async function attach(name) {
  if (attached[name]) return attached[name];
  const file = join(FIX, name);
  if (P.attach === "comfy-upload") {   // upload_file hands back a single-use, credential-free PUT address on the Comfy Cloud host
    const r = await direct("upload_file", { file_path: file, client_os: "darwin" }), text = typeof r === "string" ? r : JSON.stringify(r);
    const url = (text.match(/https:\/\/cloud\.comfy\.org\/api\/uploads\/[A-Za-z0-9_-]+/) || [])[0], type = (text.match(/Content-Type: ([\w/+.-]+)/) || [])[1];
    if (!url) throw new Error("Comfy Cloud gave no upload address");
    const put = await fetch(url, { method: "PUT", headers: type ? { "content-type": type } : {}, body: readFileSync(file) }), j = json(await put.text());
    if (!put.ok || !j?.name) throw new Error(`Comfy Cloud upload failed (HTTP ${put.status})`);
    return (attached[name] = `[Attached: ${name} — already uploaded to your Comfy Cloud inputs as "${j.subfolder ? `${j.subfolder}/` : ""}${j.name}"]`);
  }
  if (P.attach === "krea-upload") return (attached[name] = `[Attached: ${name} — already uploaded to your Krea account: ${await kreaUpload(file, name, SRV.url, TOKEN)}]`);
  if (P.attach === "public-link") {   // the service has no upload tool, so the user's file is given as a link anyone can read (it sits in the user's Krea uploads)
    const tok = await token("krea"); if (!tok) throw new Error("public links need the Krea sign-in (login.mjs krea)");
    return (attached[name] = `[Attached: ${name} — public link: ${await kreaUpload(file, name, SERVERS.krea.url, tok)}]`);
  }
  throw new Error(`this item has attachments, and the runner cannot pass files to ${P.label} yet`);
}
const jpg = (file) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", "scale=1024:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "4", "-"], { maxBuffer: 1 << 26 }).toString("base64");
async function userInput(msg) {   // the message as the chat app sends it: the text, a line per attachment, and each picture for the model to look at
  if (!(msg.materials || []).length) return msg.text;
  const lines = [], content = [];
  for (const m of msg.materials) { lines.push(await attach(m)); if (/\.(png|jpe?g|webp)$/i.test(m)) content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${jpg(join(FIX, m))}`, detail: "low" }); }
  return [{ role: "user", content: [{ type: "input_text", text: [msg.text, ...lines].join("\n") }, ...content] }];
}

// The gate (gate.mjs): approve or refuse one call by the service's rules in servers.json, the way the account there would.
const GATE = makeGate(P, BUDGET);
async function balance() {
  if (!P.balance) return null;
  try { let args = P.balance.args || {}; if (P.balance.org) { const o = await direct("select_organization", {}); args = { org_id: o?.organizations?.[0]?.id }; } return await direct(P.balance.tool, args); } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
}

// ---- OpenAI Responses API with the remote MCP tool; background mode so a long wait call does not outlive fetch
const headers = () => ({ authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" });
// The request is posted once. Only a post that did not go through is posted again; a failed status read is read again and never
// posted again, because a second post would run the whole turn, and every paid tool call in it, a second time.
async function respond(body) {
  let res, data;
  for (let attempt = 1; ; attempt++) {
    try { res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: headers(), body: JSON.stringify({ ...body, background: true, store: true }) }); data = await res.json().catch(() => ({})); }
    catch (e) { if (attempt === 3) throw e; await sleep(5000 * attempt); continue; }
    if (res.ok) break;
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await sleep(5000 * attempt);
  }
  for (let t0 = Date.now(), misses = 0; data.status === "queued" || data.status === "in_progress"; ) {
    if (Date.now() - t0 > 20 * 60000) { await fetch(`https://api.openai.com/v1/responses/${data.id}/cancel`, { method: "POST", headers: headers() }).catch(() => {}); throw new Error(`OpenAI still ${data.status} after 20 min (cancelled)`); }
    await sleep(4000);
    try { const r = await fetch(`https://api.openai.com/v1/responses/${data.id}`, { headers: headers() }); if (!r.ok) throw new Error(`HTTP ${r.status}`); data = await r.json(); misses = 0; }
    catch (e) { if (++misses > 20) throw new Error(`OpenAI status reads keep failing: ${e.message}`); }
  }
  if (data.status === "completed") return data;
  throw new Error(`OpenAI ${data.status}: ${JSON.stringify(data.error || data.incomplete_details || {}).slice(0, 300)}`);
}
const textOf = (data) => (data.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n").trim();
// One user message in, the assistant's final reply out, with every tool call and every gate decision on the way.
async function converse(input, prev) {
  const base = { model: LLM, instructions: SYSTEM, tools: [MCP()], reasoning: { effort: EFFORT } };
  let data = await respond({ ...base, input, ...(prev ? { previous_response_id: prev } : {}) });
  const calls = [], approvals = []; let text = "";
  for (let hop = 0; hop < 40; hop++) {
    for (const o of data.output || []) if (o.type === "mcp_call") { calls.push({ name: o.name, arguments: o.arguments, output: o.output, error: o.error ? String(typeof o.error === "string" ? o.error : JSON.stringify(o.error)) : null }); GATE.settle(o); }   // settle before the next decisions: a call the service refused gives back what it took
    text = textOf(data) || text;
    const reqs = (data.output || []).filter((o) => o.type === "mcp_approval_request"); if (!reqs.length) break;
    const inputs = [], notes = [];
    for (const r of reqs) {
      const a = json(r.arguments) || {}, d = GATE.decide(r.name, a, r.id);
      approvals.push({ name: r.name, args: a, approve: d.approve, reason: d.reason });
      inputs.push({ type: "mcp_approval_response", approval_request_id: r.id, approve: d.approve });
      if (!d.approve) notes.push(d.reason);
    }
    if (notes.length) inputs.push({ role: "developer", content: `The ${P.label} account refused these calls:\n${notes.map((n) => `- ${n}`).join("\n")}` });
    data = await respond({ ...base, previous_response_id: data.id, input: inputs });
  }
  return { id: data.id, text, calls, approvals };
}
// What kind of reply that was, and what the proxy user answers: the same two prompts as bench/mcp/run.mjs.
const kindOf = (text, called) => jsonCall({ name: "bench-mcp-kind", effort: "low", schema: S.obj({ kind: S.enum(["question", "approval", "delivered", "refusal", "cannot", "other"]), why: S.str }), prompt: `Classify this reply from a chat assistant that can make images, video and sound with tools. It ${called ? "called tools before replying" : "called no tool"}.
- question: it asks the user for information or a choice (which picture, what wording, what size, what mood) and waits.
- approval: it asks the user to confirm, to proceed, or to approve spending credits, and waits.
- delivered: it presents a finished result (a link, or what was made), even with caveats.
- refusal: it declines on policy or safety grounds.
- cannot: it says it cannot do this with the tools or plan it has (needs a paid plan, no such tool, cannot upload).
- other.
REPLY:
"""${text.slice(0, 3000)}"""` });
const userReply = async ({ item, text, kind, brief }) => kind === "approval" ? "Yes, go ahead." : (await jsonCall({ name: "bench-mcp-proxy-user", effort: "low", schema: S.obj({ reply: S.str }), prompt: `You are playing a USER of a chat assistant that makes images, video and sound. You already wrote this request: "${brief}". The assistant now replies:
"""${text.slice(0, 3000)}"""
Answer ONLY what it asks, in one short natural message, using ONLY the answer sheet below. If the sheet has no value for something asked, say "your call" for that. If it asks whether to proceed, or how many credits it may spend, say yes, go ahead. Do not add anything that was not asked. Do not restate the request.
ANSWER SHEET: ${JSON.stringify(item.answer_sheet)}` })).reply;

// ---- the files: every address in the final reply and in the tool results that serves a video, a sound or a picture
const EXT = { "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp4": ".m4a", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
async function collect(T, sess, seen) {
  const texts = [T.agent || "", ...T.calls.map((c) => c.output || "")], urls = [...new Set(texts.flatMap((t) => [...t.matchAll(/https?:\/\/[^\s"'\\<>)\]]+/g)].map((m) => m[0].replace(/[.,;]+$/, ""))))].filter((u) => !seen.has(u) && !handed.has(u)).slice(0, 40);   // an address the user's own file sits at is not an output
  const found = [];
  for (const u of urls) {
    seen.add(u);
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(120000) }), type = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!res.ok || !EXT[type]) { res.body?.cancel(); continue; }
      found.push({ url: u, type, bytes: Buffer.from(await res.arrayBuffer()) });
    } catch { /* not a file we can fetch */ }
  }
  const keep = found.some((f) => f.type.startsWith("video/") || f.type.startsWith("audio/")) ? found.filter((f) => !f.type.startsWith("image/")) : found;   // pictures only when no video or sound came back
  if (keep.length) mkdirSync(join(sess, "assets"), { recursive: true });
  return keep.map((f, i) => { const file = `assets/${String(i + 1).padStart(2, "0")}-${NAME}${EXT[f.type]}`; writeFileSync(join(sess, file), f.bytes); return { file, url: f.url.split("?")[0], type: f.type, bytes: f.bytes.length }; });
}

// ---- run
if (PROBE) {
  const r = await converse(`Call the tool ${P.probe} once and tell me in one short line what it returned.`, null);
  console.log(`${NAME} probe · ${SERVER_INFO?.name || "?"} ${SERVER_INFO?.version || ""} · ${TOOLS.length} tools · driver ${LLM}\n  calls: ${r.calls.map((c) => `${c.name}${c.error ? ` ERROR ${c.error.slice(0, 160)}` : " ok"}`).join(", ") || "none"}\n  reply: ${r.text.replace(/\s+/g, " ").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>").slice(0, 220)}`);
  process.exit(r.calls.some((c) => !c.error) ? 0 : 1);
}
const items = readdirSync(ITEMS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(ITEMS, f), "utf8"))).filter((it) => !only.length || only.includes(it.id)).sort((a, b) => a.id.localeCompare(b.id));
if (process.argv.includes("--dry")) {   // no driver, no job: put the attachments in place and show what the driver would be given
  console.log(`SYSTEM: ${SYSTEM}\n`);
  for (const it of items) for (const m of it.turns) { const input = await userInput(m); console.log(`${it.id} USER: ${(typeof input === "string" ? input : input[0].content[0].text).replace(/https?:\/\/[^\s\]]+/g, (u) => `<${new URL(u).hostname}/…${u.slice(-9)}>`)}${typeof input === "string" ? "" : ` [+ ${input[0].content.length - 1} picture(s) shown]`}\n`); }
  process.exit(0);
}
console.log(`${P.label} ${SERVER_INFO?.name || "?"} ${SERVER_INFO?.version || ""}: ${TOOLS.length} tools, ${OFFERED.length} offered, ${NEVER.length} without the gate · ${items.length} items · ${LLM} ${EFFORT} · ${relative(V2, OUT)}`);
const b0 = await balance(); if (b0) console.log(`balance before: ${JSON.stringify(b0).slice(0, 200)}`);
const done = [];
for (const it of items) {
  const sid = `comp-${PREFIX}-${NAME}-${it.id}`, sess = join(V2, "sessions", sid), t0 = Date.now(); mkdirSync(sess, { recursive: true });
  const rec = { id: it.id, item: it, session: sid, sessionDir: `sessions/${sid}`, baseline: NAME, server: P.label, model: LLM, effort: EFFORT, simulated: false, turns: [], started: new Date(t0).toISOString() };
  const seen = new Set(), brief = it.turns[0].text; let prev = null; GATE.reset();
  try {
    for (const msg of it.turns) {
      const input = await userInput(msg);   // uploads any attachment first; throws when the service has no attach method
      const T = { text: msg.text, materials: msg.materials || [], dialog: [], agent: null, calls: [], approvals: [] }, s1 = Date.now();
      let r = await converse(input, prev); prev = r.id;
      T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals);
      let k = await kindOf(r.text, r.calls.length > 0);
      T.firstQuestions = ["question", "approval"].includes(k.kind) ? [{ field: k.kind, question: r.text.slice(0, 400) }] : [];
      for (let round = 0, nudged = false; round < 3; round++) {   // the cooperative user: answers questions from the sheet, and says the item's nudge once after a "cannot"
        const nudge = k.kind === "cannot" && !!it.nudge && !nudged;
        if (!["question", "approval"].includes(k.kind) && !nudge) break;
        const reply = nudge ? it.nudge : await userReply({ item: it, text: r.text, kind: k.kind, brief }); nudged ||= nudge;
        T.dialog.push({ agent: r.text, asked: [k.kind], user: reply, calls_before: T.calls.length });
        r = await converse(reply, prev); prev = r.id;
        T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals);
        k = await kindOf(r.text, r.calls.length > 0);
      }
      if (["question", "approval"].includes(k.kind)) T.stillAsking = [r.text.slice(0, 400)];
      T.files = await collect(T, sess, seen);
      if (!T.files.length && T.calls.some((c) => !READ.test(c.name) && !c.error) && !["refusal", "cannot", "question", "approval"].includes(k.kind)) {   // a job was started but no file came back: the cooperative user waits and asks once
        const reply = "Please wait for it to finish, then give me the download link.";
        T.dialog.push({ agent: r.text, asked: ["pending"], user: reply, calls_before: T.calls.length });
        r = await converse(reply, prev); prev = r.id;
        T.agent = r.text; T.calls.push(...r.calls); T.approvals.push(...r.approvals);
        k = await kindOf(r.text, r.calls.length > 0);
        T.files = await collect(T, sess, seen);
      }
      T.kind = k.kind; T.denied = T.approvals.filter((a) => !a.approve).map((a) => a.reason);
      T.spent = 0; T.seconds = Math.round((Date.now() - s1) / 1000);
      rec.turns.push(T);
      if (T.kind === "refusal") break;
    }
  } catch (e) { rec.error = String(e.message || e); }
  rec.seconds = Math.round((Date.now() - t0) / 1000); rec.spent = 0; rec.gate = GATE.state();
  if (handed.size) {   // keep what each public address serves: the copy the service was given (a host may store video re-compressed)
    mkdirSync(join(sess, "given"), { recursive: true }); rec.given = [];
    for (const [u, name] of handed) if ((it.turns || []).some((m) => (m.materials || []).includes(name))) try { const g = await fetch(u, { signal: AbortSignal.timeout(120000) }), b = Buffer.from(await g.arrayBuffer()); if (g.ok) { writeFileSync(join(sess, "given", name), b); rec.given.push({ name, file: `given/${name}`, bytes: b.length, same_as_fixture: b.equals(readFileSync(join(FIX, name))) }); } } catch { /* the address stopped serving */ }
  }
  writeFileSync(join(OUT, `${it.id}.json`), JSON.stringify(rec, null, 2)); done.push(rec);
  console.log(`${it.id.padEnd(4)} ${String(rec.seconds).padStart(4)} s · ${rec.error ? `ERROR ${rec.error.slice(0, 200)}` : rec.turns.map((t) => `${t.kind} · ${t.dialog.length ? `${t.dialog.map((d) => d.asked[0]).join("+")} · ` : ""}${t.calls.map((c) => `${c.name}${c.error ? "!" : ""}`).join("→") || "no tool"}${t.denied.length ? ` [refused ${t.denied.length}]` : ""} [${t.files.length} files]`).join(" | ")}`);
}
const b1 = await balance(); if (b1) console.log(`balance after:  ${JSON.stringify(b1).slice(0, 200)}`);
writeFileSync(join(OUT, "run.json"), JSON.stringify({ at: new Date().toISOString(), baseline: NAME, mcp: SERVER_INFO, tools_offered: OFFERED.length, hidden: TOOLS.filter((t) => HIDE.test(t)), model: LLM, effort: EFFORT, items: items.length, profile: arg("--profile", "bench"), plan: P.plan, limits: LIMITS, budget: BUDGET, max_creates: P.max_creates ?? null, attach: P.attach ?? null, balance_before: b0, balance_after: b1 }, null, 2));
