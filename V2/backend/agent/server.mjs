// The local web app over the dry agent (prd/12-frontend.md). No dependencies. Routes:
//   POST /turn                 {session, text, materials?, tier?, mode?} → sheet + questions | plan; saved to the session
//   GET  /session/:id          the session record
//   POST /session/:id/step     {turn?, index, params, model?, credits?, state}  a tool card's edits and state
//   POST /session/reset        {session, mode?}
//   POST /upload?session=&name=   raw body → sessions/<id>/materials/<name>
//   GET  /sessions/<id>/...    session files (materials, prompts)
//   GET  /models · GET /runs · GET /run/:label · POST /run/:label/comment|flag · GET /media/<label>/<path> · GET /
// Usage: node V2/backend/agent/server.mjs [--port 4747]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname, normalize, basename } from "node:path";
import { V2, RUNS } from "../lib/env.js";
import { STILLS, VIDEOS, TIERS } from "../lib/models.js";
import { turn } from "./agent.mjs";
import { price } from "./plan.js";
import { runTree, sessionTree } from "./worktree.js";
import { simulate, dependents as stepDependents } from "./simulate.js";
import { execute } from "./execute.js";
import { TOOLS, GROUPS } from "./catalogue.js";
import { copyFileSync } from "node:fs";
const RESULTS_DIR = join(V2, "results");
const running = {};

const PORT = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4747;
const SESS = join(V2, "sessions"); mkdirSync(SESS, { recursive: true });
const UI = join(V2, "frontend");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };

const sdir = (id) => { const d = join(SESS, id); mkdirSync(join(d, "materials"), { recursive: true }); mkdirSync(join(d, "prompts"), { recursive: true }); return d; };
const load = (id) => existsSync(join(sdir(id), "session.json")) ? JSON.parse(readFileSync(join(sdir(id), "session.json"), "utf8")) : { id, messages: [], turns: [], assets: [], materials: [], tier: "free", mode: "ask", credits: 0 };
const save = (s) => writeFileSync(join(sdir(s.id), "session.json"), JSON.stringify(s, null, 2));
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b ? JSON.parse(b) : {})); });
const raw = (req) => new Promise((ok) => { const parts = []; req.on("data", (c) => parts.push(c)); req.on("end", () => ok(Buffer.concat(parts))); });
const safe = (n) => basename(String(n)).replace(/[^\w.\-]+/g, "_");

function runView(label) {
  const dir = join(RUNS, label); if (!existsSync(join(dir, "run.json"))) return null;
  const L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
  const notes = existsSync(join(dir, "notes.json")) ? JSON.parse(readFileSync(join(dir, "notes.json"), "utf8")) : { comments: [], flags: [] };
  const stills = Object.entries(L.stills || {}).map(([id, s]) => {
    const attempts = existsSync(join(dir, "stills")) ? readdirSync(join(dir, "stills")).filter((f) => f.startsWith(`${id}.`) || f.startsWith(`${id}-r`)).sort() : [];
    const job = Object.values(L.jobs || {}).find((j) => j.file === s.file);
    return { id, ...s, attempts: attempts.map((f) => `stills/${f}`), prompt: job?.prompt || "", inputs: job?.inputs || [] };
  }).sort((a, b) => a.scene - b.scene || a.shot - b.shot);
  const clips = existsSync(join(dir, "clips")) ? readdirSync(join(dir, "clips")).filter((f) => /^(seq-[\d-]+|s\d+(-r\d+)?)\.mp4$/.test(f)).map((f) => `clips/${f}`) : [];
  const film = ["film-music.mp4", "film.mp4", "film-raw.mp4"].map((f) => `clips/${f}`).find((f) => existsSync(join(dir, f))) || null;
  return { label, brief: L.brief, mode: L.mode, story: L.story, research: L.research, script: L.script, stills, clips, film, summary: L.summary, notes };
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"); const p = url.pathname;
  try {
    if (req.method === "POST" && p === "/upload") {
      const id = url.searchParams.get("session") || "default", name = safe(url.searchParams.get("name") || "file");
      const buf = await raw(req); writeFileSync(join(sdir(id), "materials", name), buf);
      const s = load(id); s.materials = [...new Set([...(s.materials || []), name])]; save(s);
      return json(res, 200, { name, url: `/sessions/${encodeURIComponent(id)}/materials/${encodeURIComponent(name)}` });
    }
    if (req.method === "POST" && p === "/turn") {
      const b = await body(req); const s = load(b.session || "default");
      if (b.tier) s.tier = b.tier; if (b.mode) s.mode = b.mode;
      const foc = b.focus && s.turns[b.focus.turn]?.plan?.steps?.[b.focus.index] ? { ...b.focus, step: s.turns[b.focus.turn].plan.steps[b.focus.index] } : null;
      s.messages.push({ who: "user", text: b.text, at: Date.now(), attached: b.materials || [], focus: foc ? { turn: foc.turn, index: foc.index, produces: foc.step.produces } : null });
      s.materials = [...new Set([...(s.materials || []), ...(b.materials || [])])];
      const r = await turn({ messages: s.messages.filter((m) => m.who !== "card").map((m) => ({ who: m.who, text: `${m.attached?.length ? `${m.text} [attached: ${m.attached.join(", ")}]` : m.text}${m.focus ? ` [looking at: ${m.focus.produces}, a ${s.turns[m.focus.turn]?.plan?.steps?.[m.focus.index]?.tool || "node"} in turn ${m.focus.turn + 1}]` : ""}` })), materials: s.materials, attached: b.materials || [], session: s.assets, tier: s.tier, liberty: s.mode === "auto", goalHint: s.goal || null, focus: foc });
      s.goal = r.questions ? r.sheet.goal.value : null;   // the goal carries only while questions are open; a new request after a plan starts fresh
      s.request = s.request || b.text;   // the message that started this request; questions and answers do not replace it
      const ti = s.turns.length, d = sdir(s.id);
      const t = { at: Date.now(), sheet: r.sheet, questions: r.questions || null, plan: r.plan || null, files: {}, brief: s.request }; if (!r.questions) s.request = null;
      writeFileSync(join(d, "prompts", `turn-${ti}-sheet.json`), JSON.stringify(r.sheet, null, 2)); t.files.sheet = `turn-${ti}-sheet.json`;
      if (r.plan) {
        if (foc && r.sheet.about_focus) t.plan.about = { turn: foc.turn, index: foc.index, produces: foc.step.produces };
        if (r.plan.steps.length > 1) t.plan.dir = `tree-${ti + 1}`;   // a directory per working tree; a single node is the elementary tree and lives at the root
        t.plan.steps = t.plan.steps.map((st, i) => { const f = `turn-${ti}-step-${i}.txt`; writeFileSync(join(d, "prompts", f), `${st.tool} on ${st.model}${st.resolution ? ` ${st.resolution}` : ""}\ninputs: ${st.inputs.join(", ")}\nproduces: ${st.produces}\n\n${st.params.prompt_or_change}\n${st.params.extra ? `\n${st.params.extra}` : ""}`); return { ...st, state: s.mode === "plan" ? "plan" : "proposed", prompt_file: f }; });
        writeFileSync(join(d, "prompts", `turn-${ti}-plan.json`), JSON.stringify(t.plan, null, 2)); t.files.plan = `turn-${ti}-plan.json`;
        for (const st of t.plan.steps) s.assets.push({ label: st.produces, kind: /\.(mp4|mov)$/.test(st.produces) ? "clip" : /\.(mp3|wav)$/.test(st.produces) ? "sound" : "picture", from: st.tool, planned: true });
      }
      s.turns.push(t);
      const text = r.questions ? `Before I plan this I need ${r.questions.length === 1 ? "one thing" : "a few things"}:\n` + r.questions.map((q) => `· ${q.question}${q.default ? ` (default: ${q.default})` : ""}`).join("\n") : `${r.plan.say || ""}${r.plan.tier_move ? ` This needs more than the free tier: ${r.plan.tier_move.why}.` : ""}${r.plan.refuse ? ` I can't do this one: ${r.plan.refuse}` : ""}`.trim();
      s.messages.push({ who: "agent", text, at: Date.now(), turn: ti });
      save(s); return json(res, 200, { session: s, turn: t, text, turnIndex: ti });
    }
    if (req.method === "GET" && /^\/session\/[^/]+$/.test(p)) return json(res, 200, load(decodeURIComponent(p.slice(9))));
    if (req.method === "POST" && /^\/session\/[^/]+\/step$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id); const t = s.turns[b.turn ?? s.turns.length - 1]; if (!t?.plan) return json(res, 400, { error: "no plan" });
      const st = t.plan.steps[b.index]; if (!st) return json(res, 400, { error: "no step" });
      if (b.remake) { st.attempts = [...(st.attempts || []), ...(st.output ? [st.output] : [])]; st.attempt = (st.attempt || 0) + 1; st.state = "stale"; st.output = null; st.cached = false; st.credits_spent = null; for (const j of stepDependents(t.plan.steps, b.index)) if (t.plan.steps[j].state === "done") t.plan.steps[j].state = "stale"; save(s); return json(res, 200, { step: st, estimate: t.plan.estimate_credits }); }
      const wasDone = st.state === "done"; if (b.params) Object.assign(st.params, b.params); if (Array.isArray(b.inputs)) st.inputs = b.inputs; if (wasDone && (b.params || b.inputs || b.model)) { st.state = "stale"; for (const j of stepDependents(t.plan.steps, b.index)) if (t.plan.steps[j].state === "done") t.plan.steps[j].state = "stale"; } if (b.model) { st.model = b.model; if (b.resolution) st.resolution = b.resolution; } if (b.credits != null) st.credits = b.credits; if (b.state) st.state = b.state;
      t.plan.estimate_credits = t.plan.steps.reduce((a, x) => a + (x.state === "skipped" ? 0 : x.credits || 0), 0);
      writeFileSync(join(sdir(id), "prompts", st.prompt_file || `step-${b.index}.txt`), `${st.tool} on ${st.model}${st.resolution ? ` ${st.resolution}` : ""}\ninputs: ${st.inputs.join(", ")}\nproduces: ${st.produces}\n\n${st.params.prompt_or_change}\n${st.params.extra ? `\n${st.params.extra}` : ""}`);
      save(s); return json(res, 200, { step: st, estimate: t.plan.estimate_credits });
    }
    if (req.method === "POST" && /^\/session\/[^/]+\/note$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id); const t = s.turns[b.turn]; const st = t?.plan?.steps?.[b.index];
      const text = `About the ${st ? st.tool.replace(/-/g, " ") : "step"}${st ? ` (${st.produces})` : ""}: ${b.text}`;
      s.messages.push({ who: "user", text, at: Date.now(), step: { turn: b.turn, index: b.index } }); save(s);
      return json(res, 200, { text });
    }
    if (req.method === "POST" && /^\/session\/[^/]+\/simulate$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id); const t = s.turns[b.turn ?? s.turns.length - 1]; if (!t?.plan) return json(res, 400, { error: "no plan" });
      const stale = Array.isArray(b.indices) ? b.indices : t.plan.steps.map((x, i) => (x.state === "done" || x.state === "paused" || x.state === "skipped" ? -1 : i)).filter((i) => i >= 0);
      simulate(t.plan, sdir(id), { only: stale });
      for (const st of t.plan.steps) { const a = s.assets.find((x) => x.label === st.produces); if (a) { a.file = st.output; a.planned = false; } }
      s.messages.push({ who: "agent", text: `Done (simulated): ${t.plan.steps.filter((x) => x.state === "done").length} of ${t.plan.steps.length} nodes made, ${stale.length} just now.`, at: Date.now(), turn: b.turn ?? s.turns.length - 1, sim: true });
      save(s); return json(res, 200, { plan: t.plan, made: stale });
    }
    if (req.method === "POST" && /^\/session\/[^/]+\/execute$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id); const ti = b.turn ?? s.turns.length - 1; const t = s.turns[ti]; if (!t?.plan) return json(res, 400, { error: "no plan" });
      if (running[id]) return json(res, 409, { error: "already running" });
      const only = Array.isArray(b.indices) ? b.indices : t.plan.steps.map((x, i) => (x.state === "done" || x.state === "paused" || x.state === "skipped" ? -1 : i)).filter((i) => i >= 0);
      t.plan.turn = ti; running[id] = true; save(s);
      const brief = t.brief || s.messages.find((m) => m.who === "user")?.text || "";
      const merge = (i, st) => { const cur = load(id); const target = cur.turns[ti].plan.steps[i]; for (const k of ["state", "output", "credits_spent", "cached", "error", "note", "simulated", "run", "page", "started_at", "ran_at", "attempt", "attempts"]) if (st[k] !== undefined) target[k] = st[k]; const a = cur.assets.find((x) => x.label === st.produces); if (a && st.output) { a.file = st.output; a.planned = false; } return cur; };
      execute(t.plan, sdir(id), { id, tier: s.tier, sheet: t.sheet, brief, only, say: (m) => { const cur = load(id); cur.messages.push({ who: "agent", text: m, at: Date.now(), turn: ti, exec: true }); save(cur); }, onStep: (i, st) => { save(merge(i, st)); } })
        .catch((e) => { const cur = load(id); cur.messages.push({ who: "agent", text: `Stopped: ${String(e.message || e).slice(0, 200)}`, at: Date.now(), turn: ti, exec: true }); save(cur); })
        .finally(() => { delete running[id]; });
      return json(res, 200, { started: true, only });
    }
    if (req.method === "POST" && p === "/import") {
      const b = await body(req); const id = b.session || "default"; const src = normalize(b.from || ""); if (src.startsWith("..") || !existsSync(join(V2, src))) return json(res, 404, { error: "no file" });
      const name = safe(b.name || basename(src)); copyFileSync(join(V2, src), join(sdir(id), "materials", name)); const s = load(id); s.materials = [...new Set([...(s.materials || []), name])]; save(s);
      return json(res, 200, { name, url: `/sessions/${encodeURIComponent(id)}/materials/${encodeURIComponent(name)}` });
    }
    if (p.startsWith("/results/")) { const rel = normalize(decodeURIComponent(p.slice(9))); if (rel.startsWith("..")) return json(res, 403, {}); let f = join(RESULTS_DIR, rel); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html"); if (!existsSync(f)) return json(res, 404, {}); res.writeHead(200, { "content-type": MIME[extname(f)] || "text/html; charset=utf-8" }); return res.end(readFileSync(f)); }
    if (req.method === "GET" && p === "/running") return json(res, 200, running);
    if (req.method === "GET" && p === "/catalogue") return json(res, 200, { groups: GROUPS, tools: TOOLS.map((t) => ({ id: t.id, group: t.group, takes: t.takes, makes: t.makes, needs: t.needs, custom: !!t.custom, guarantees: t.guarantees || [] })) });
    if (req.method === "POST" && /^\/session\/[^/]+\/plan$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id);
      if (b.new) { const ti = s.turns.length; const t = { at: Date.now(), sheet: { goal: { value: "change", source: "session", confidence: 1, quote: "", why: "a tree the user started" }, refers_to: "", fields: [] }, questions: null, plan: { shape: "tree", say: "", desired_state: b.name || "a tree of your own", current_state: "", steps: [], questions_left: [], refuse: "", tier: s.tier, estimate_credits: 0, tier_move: null, dir: `tree-${ti + 1}`, turn: ti }, files: {}, user_made: true }; s.turns.push(t); s.messages.push({ who: "agent", text: `An empty tree. Add tools from the catalogue and wire them.`, at: Date.now(), turn: ti }); save(s); return json(res, 200, { turn: ti }); }
      const t = s.turns[b.turn ?? s.turns.length - 1]; if (!t?.plan) return json(res, 400, { error: "no plan" });
      if (b.canvas) { t.plan.canvas = b.canvas; save(s); return json(res, 200, { canvas: t.plan.canvas }); }
      if (b.add) { const def = TOOLS.find((x) => x.id === b.add.tool); if (!def) return json(res, 400, { error: "unknown tool" }); const n = t.plan.steps.length; const ext = def.makes === "clip" || def.makes === "film" ? "mp4" : def.makes === "sound" ? "mp3" : def.makes === "text" ? "txt" : def.makes === "verdict" ? "json" : "png"; const produces = b.add.produces || `${def.id.replace(/-/g, "_")}_${n + 1}.${ext}`; const st = { group: def.group, tool: def.id, inputs: b.add.inputs || [], produces, params: { seconds: def.makes === "clip" ? 5 : 0, aspect: "", resolution: "", prompt_or_change: b.add.prompt || "", extra: "" }, why: "added by the user", needs_beyond_free: "", state: "proposed", user_added: true, pos: b.add.pos || null, prompt_file: `turn-${b.turn}-step-${n}.txt` }; t.plan.steps.push(st); const re = price({ ...t.plan, steps: t.plan.steps.map((x) => ({ ...x })) }, s.tier); Object.assign(st, { model: re.steps[n].model, resolution: re.steps[n].resolution, credits: re.steps[n].credits }); t.plan.estimate_credits = re.estimate_credits; writeFileSync(join(sdir(id), "prompts", st.prompt_file), `${st.tool}\n\n${st.params.prompt_or_change}`); save(s); return json(res, 200, { index: n, step: st }); }
      if (b.remove != null) { const gone = t.plan.steps[b.remove]; if (!gone) return json(res, 400, { error: "no step" }); t.plan.steps.splice(b.remove, 1); for (const st of t.plan.steps) st.inputs = st.inputs.filter((x) => x !== gone.produces); s.assets = s.assets.filter((a) => a.label !== gone.produces); t.plan.estimate_credits = t.plan.steps.reduce((a, x) => a + (x.state === "skipped" ? 0 : x.credits || 0), 0); save(s); return json(res, 200, { removed: gone.produces }); }
      return json(res, 400, { error: "nothing to do" });
    }
    if (req.method === "POST" && p === "/session/reset") { const b = await body(req); const old = load(b.session || "default"); const s = { id: b.session || "default", messages: [], turns: [], assets: [], materials: old.materials || [], tier: old.tier || "free", mode: b.mode || old.mode || "ask", credits: 0 }; save(s); return json(res, 200, s); }
    if (p.startsWith("/sessions/")) { const rel = normalize(decodeURIComponent(p.slice(10))); if (rel.startsWith("..")) return json(res, 403, {}); const f = join(SESS, rel); if (!existsSync(f) || statSync(f).isDirectory()) return json(res, 404, {}); res.writeHead(200, { "content-type": MIME[extname(f).toLowerCase()] || "application/octet-stream" }); return res.end(readFileSync(f)); }
    if (req.method === "GET" && /^\/tree\/run\/[^/]+$/.test(p)) { const label = decodeURIComponent(p.split("/")[3]); const f = join(RUNS, label, "run.json"); if (!existsSync(f)) return json(res, 404, { error: "no run" }); return json(res, 200, runTree(JSON.parse(readFileSync(f, "utf8")), label)); }
    if (req.method === "GET" && /^\/tree\/session\/[^/]+$/.test(p)) return json(res, 200, sessionTree(load(decodeURIComponent(p.split("/")[3])), { loadRun: (label) => { const f = join(RUNS, label, "run.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; } }));
    if (p === "/models") return json(res, 200, { stills: STILLS, videos: VIDEOS, tiers: TIERS });
    if (p === "/runs") return json(res, 200, readdirSync(RUNS).filter((d) => existsSync(join(RUNS, d, "run.json"))).map((d) => { const L = JSON.parse(readFileSync(join(RUNS, d, "run.json"), "utf8")); return { label: d, title: L.story?.title || "", stills: Object.keys(L.stills || {}).length }; }).filter((r) => r.title));
    if (req.method === "GET" && /^\/run\/[^/]+$/.test(p)) { const v = runView(decodeURIComponent(p.slice(5))); return v ? json(res, 200, v) : json(res, 404, { error: "no run" }); }
    if (req.method === "POST" && /^\/run\/[^/]+\/(comment|flag)$/.test(p)) {
      const [, , label, kind] = p.split("/"); const b = await body(req); const f = join(RUNS, label, "notes.json");
      const n = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { comments: [], flags: [] };
      (kind === "comment" ? n.comments : n.flags).push({ ...b, at: Date.now() }); writeFileSync(f, JSON.stringify(n, null, 2)); return json(res, 200, n);
    }
    if (p.startsWith("/runs/") && p !== "/runs") { const rel = normalize(decodeURIComponent(p.slice(6))); if (rel.startsWith("..")) return json(res, 403, {}); const f = join(RUNS, rel); if (!existsSync(f) || statSync(f).isDirectory()) return json(res, 404, {}); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); return res.end(readFileSync(f)); }
    if (p.startsWith("/media/")) { const rel = normalize(decodeURIComponent(p.slice(7))); if (rel.startsWith("..")) return json(res, 403, {}); const f = join(RUNS, rel); if (!existsSync(f) || statSync(f).isDirectory()) return json(res, 404, {}); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); return res.end(readFileSync(f)); }
    const f = join(UI, p === "/" ? "index.html" : normalize(p)); if (f.startsWith(UI) && existsSync(f) && !statSync(f).isDirectory()) { res.writeHead(200, { "content-type": MIME[extname(f)] || "text/plain" }); return res.end(readFileSync(f)); }
    json(res, 404, { error: "not found" });
  } catch (e) { json(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log(`agent ui → http://localhost:${PORT}`));
