// The local web app over the dry agent (prd/12-frontend.md). No dependencies. Routes:
//   POST /turn            {session, text, materials?, tier?, liberty?} → the agent's reply (sheet + questions | plan), saved to the session
//   GET  /session/:id     the session record
//   POST /session/:id/step {index, params, state}  write a tool card's edited parameters and state (proposed|paused|approved|skipped)
//   GET  /models          the registry by kind, with tiers
//   GET  /runs            run labels with a story
//   GET  /run/:label      story, screenplay, stills, clips, comments, flags of a run folder
//   POST /run/:label/comment {scene, shot?, text}   POST /run/:label/flag {still, text}
//   GET  /media/<label>/<path>   run media; GET /  the page
// Usage: node V2/src/agent/server.mjs [--port 4747]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { V2, RUNS } from "../lib/env.js";
import { STILLS, VIDEOS, TIERS } from "../lib/models.js";
import { turn } from "./agent.mjs";
import { price } from "./plan.js";

const PORT = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4747;
const SESS = join(V2, "sessions"); mkdirSync(SESS, { recursive: true });
const UI = join(V2, "ui");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".json": "application/json" };

const load = (id) => existsSync(join(SESS, `${id}.json`)) ? JSON.parse(readFileSync(join(SESS, `${id}.json`), "utf8")) : { id, messages: [], turns: [], assets: [], tier: "free", liberty: false, credits: 0 };
const save = (s) => writeFileSync(join(SESS, `${s.id}.json`), JSON.stringify(s, null, 2));
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b ? JSON.parse(b) : {})); });

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
    if (req.method === "POST" && p === "/turn") {
      const b = await body(req); const s = load(b.session || "default");
      if (b.tier) s.tier = b.tier; if (typeof b.liberty === "boolean") s.liberty = b.liberty;
      s.messages.push({ who: "user", text: b.text, at: Date.now() });
      const materials = [...new Set([...(s.materials || []), ...(b.materials || [])])]; s.materials = materials;
      const session = s.assets;
      const r = await turn({ messages: s.messages.filter((m) => m.who !== "card"), materials, session, tier: s.tier, liberty: s.liberty, goalHint: s.goal || null });
      s.goal = r.sheet.goal.value;
      const t = { at: Date.now(), sheet: r.sheet, questions: r.questions || null, plan: r.plan || null };
      if (r.plan) { t.plan.steps = t.plan.steps.map((st) => ({ ...st, state: "proposed" })); for (const st of t.plan.steps) s.assets.push({ label: st.produces, kind: /\.(mp4|mov)$/.test(st.produces) ? "clip" : /\.(mp3|wav)$/.test(st.produces) ? "sound" : "picture", from: st.tool, planned: true }); }
      s.turns.push(t);
      const understood = [`goal: ${r.sheet.goal.value} (${r.sheet.goal.source})`, ...r.sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => `${f.field}: ${f.value}${f.source === "stated" ? "" : ` (${f.source})`}`)].join("\n");
      const text = r.questions ? r.questions.map((q) => q.question + (q.default ? ` (default: ${q.default})` : "")).join("\n") : `${r.plan.current_state} → ${r.plan.desired_state}. ${r.plan.steps.length} step${r.plan.steps.length === 1 ? "" : "s"}, about ${r.plan.estimate_credits} credits.${r.plan.tier_move ? ` Beyond the free tier: ${r.plan.tier_move.why}.` : ""}${r.plan.refuse ? ` I can't do this one: ${r.plan.refuse}` : ""}`;
      s.messages.push({ who: "agent", text, understood, at: Date.now(), turn: s.turns.length - 1 });
      save(s); return json(res, 200, { session: s, turn: t, text, understood });
    }
    if (req.method === "GET" && p.startsWith("/session/")) return json(res, 200, load(decodeURIComponent(p.slice(9))));
    if (req.method === "POST" && /^\/session\/[^/]+\/step$/.test(p)) {
      const id = decodeURIComponent(p.split("/")[2]); const b = await body(req); const s = load(id); const t = s.turns[b.turn ?? s.turns.length - 1]; if (!t?.plan) return json(res, 400, { error: "no plan" });
      const st = t.plan.steps[b.index]; if (!st) return json(res, 400, { error: "no step" });
      if (b.params) Object.assign(st.params, b.params); if (b.model) st.params.model_override = b.model; if (b.state) st.state = b.state;
      const re = price({ ...t.plan, steps: t.plan.steps.map((x) => ({ ...x })) }, s.tier); t.plan.estimate_credits = re.estimate_credits;
      if (b.model) { st.model = b.model; st.credits = b.credits ?? st.credits; }
      if (b.state === "approved") s.messages.push({ who: "card", text: `approved: ${st.tool} on ${st.model} (${st.credits} credits) — dry, not called`, at: Date.now() });
      save(s); return json(res, 200, { step: st, estimate: t.plan.estimate_credits });
    }
    if (req.method === "POST" && p === "/session/reset") { const b = await body(req); const s = { id: b.session || "default", messages: [], turns: [], assets: [], tier: "free", liberty: !!b.liberty, credits: 0 }; save(s); return json(res, 200, s); }
    if (p === "/models") return json(res, 200, { stills: STILLS, videos: VIDEOS, tiers: TIERS });
    if (p === "/runs") return json(res, 200, readdirSync(RUNS).filter((d) => existsSync(join(RUNS, d, "run.json"))).map((d) => { const L = JSON.parse(readFileSync(join(RUNS, d, "run.json"), "utf8")); return { label: d, title: L.story?.title || "", brief: L.brief || "", stills: Object.keys(L.stills || {}).length }; }).filter((r) => r.title));
    if (req.method === "GET" && /^\/run\/[^/]+$/.test(p)) { const v = runView(decodeURIComponent(p.slice(5))); return v ? json(res, 200, v) : json(res, 404, { error: "no run" }); }
    if (req.method === "POST" && /^\/run\/[^/]+\/(comment|flag)$/.test(p)) {
      const [, , label, kind] = p.split("/"); const b = await body(req); const f = join(RUNS, label, "notes.json");
      const n = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { comments: [], flags: [] };
      (kind === "comment" ? n.comments : n.flags).push({ ...b, at: Date.now() }); writeFileSync(f, JSON.stringify(n, null, 2)); return json(res, 200, n);
    }
    if (p.startsWith("/media/")) { const rel = normalize(decodeURIComponent(p.slice(7))); if (rel.startsWith("..")) return json(res, 403, {}); const f = join(RUNS, rel); if (!existsSync(f) || statSync(f).isDirectory()) return json(res, 404, {}); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); return res.end(readFileSync(f)); }
    const f = join(UI, p === "/" ? "index.html" : normalize(p)); if (f.startsWith(UI) && existsSync(f) && !statSync(f).isDirectory()) { res.writeHead(200, { "content-type": MIME[extname(f)] || "text/plain" }); return res.end(readFileSync(f)); }
    json(res, 404, { error: "not found" });
  } catch (e) { json(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log(`agent ui → http://localhost:${PORT}`));
