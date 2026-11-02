// Agent against the MCP baseline, item by item: the same prompt, the two outputs side by side, a pairwise judge that
// sees both in random order and picks one, and the behaviour that differs (questions, approvals, calls, models, credits,
// time). Reads graded result folders (bench/v1/grade.mjs on each). Writes compare.json, compare.md and index.html into
// a results folder that bench/v1/serve.mjs serves (http://localhost:4748/compare-mcp-1/), media from /sessions and /runs.
// Each side on the page carries its pathway, collapsed: every step with its inputs, parameters and output (the agent's
// plan and what ran; the MCP's create calls and every call it made; a film's stages from the run folder).
// Usage: node V2/bench/mcp/compare.mjs --mcp V2/bench/v1/results/mcp-1[,…] --agent V2/bench/v1/results/real-1[,…/latest]
//        [--judge] [--only A01d,B07a] [--out V2/bench/v1/results/compare-mcp-1] [--title "…"] [--concurrency 4]
//   or:  node V2/bench/mcp/compare.mjs --from V2/bench/v1/results/compare-film-1,V2/bench/v1/results/compare-mcp-1 --out V2/bench/v1/results/compare-all-1
//        joins earlier comparisons into one long page, the parts in the order given (the films first there): the verdicts are
//        kept, everything else is re-read from the records, nothing is re-judged.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { duration, size } from "../../backend/lib/media.js";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = (arg("--from", "") || "").split(",").filter(Boolean);   // earlier comparisons to join, in page order
const MCPS = (arg("--mcp", join(V2, "bench/v1/results/mcp-1")) || "").split(",").filter(Boolean), MCP = MCPS[0], AGENT = (arg("--agent", join(V2, "bench/v1/results/real-1")) || "").split(",").filter(Boolean);   // either side may be several folders: the newest record per item wins
const OUT = arg("--out", join(V2, "bench/v1/results", FROM.length ? "compare-all" : `compare-${basename(MCP)}`)), JUDGE = process.argv.includes("--judge"), only = (arg("--only", "") || "").split(",").filter(Boolean);
const TITLE = arg("--title", FROM.length ? "Agent vs the Magic Hour MCP · the films, then the micro tasks" : `Agent vs the Magic Hour MCP · ${basename(MCP)}`); mkdirSync(OUT, { recursive: true });
// --names "Agent,MCP baseline": what the two sides are called on the page (the second is the --mcp side), e.g. --names "Direct,Chain" for the pipeline's two modes
const [NA, NM] = (arg("--names", "Agent,MCP baseline") || "Agent,MCP baseline").split(",").map((x) => x.trim()), sa = NA.split(" ")[0], sm = NM.split(" ")[0];
const NAMES = { A: "Single images", B: "Image edits", C: "Faces and characters", D: "Short video", E: "Editing the user's video", F: "Sound", G: "Composed pieces", H: "Ads and reels", I: "Longer stories (film)", J: "Conversation" };
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm)$/i, AUD = /\.(mp3|wav|m4a)$/i;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0), pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const partName = (gs) => (gs.every((g) => g === "I") ? "The films" : gs.includes("I") ? "Films and micro tasks" : "The micro tasks");

// one folder: records and grades by id; the newest record per item across folders
const load = (dir) => { if (!existsSync(join(dir, "grades.json"))) throw new Error(`${dir}: no grades.json (run bench/v1/grade.mjs --dir first)`); const G = Object.fromEntries(JSON.parse(readFileSync(join(dir, "grades.json"), "utf8")).map((g) => [g.id, g])); const R = {}; for (const f of readdirSync(dir)) if (/^[A-J]\d\d[a-z]\.json$/.test(f)) { const r = JSON.parse(readFileSync(join(dir, f), "utf8")); if (G[r.id]) R[r.id] = { rec: r, grade: G[r.id], dir }; } return R; };
const newest = (dirs) => { const X = {}; for (const d of dirs) for (const [id, x] of Object.entries(load(d))) if (!X[id] || (x.rec.started || "") > (X[id].rec.started || "")) X[id] = x; return X; };
const loadAll = (dirs) => { const X = {}; for (const d of dirs) for (const [id, x] of Object.entries(load(d))) (X[id] ??= []).push(x); return X; };   // every record per item
const pick = (xs, outputs) => { if (!xs?.length) return null; const same = xs.filter((x) => JSON.stringify(x.grade.outputs || []) === JSON.stringify(outputs || [])); return (same.length ? same : xs).sort((a, b) => (b.rec.started || "").localeCompare(a.rec.started || ""))[0]; };   // the record the judged comparison saw (same outputs), else the newest
const dirOf = (b) => { if (b.includes("/")) return resolve(b.startsWith("bench/") ? join(V2, b) : b); const c = [join(V2, "bench/v1/results", b), join(V2, "bench/mcp/film", b)].find((d) => existsSync(join(d, "grades.json"))); if (!c) throw new Error(`no result folder "${b}" under bench/v1/results or bench/mcp/film`); return c; };

// the pathway: every planned step with what ran for it, inputs resolved to files (an earlier step's output, or the session's materials); an MCP step shows its call's full arguments
const flat = (a) => { const o = { ...a }; if (o.style && typeof o.style === "object") { const { prompt, ...rest } = o.style; if (prompt) o.prompt = prompt; if (Object.keys(rest).length) o.style = rest; else delete o.style; } if (o.end_seconds != null) { o.seconds = o.end_seconds; delete o.end_seconds; } if (o.aspect_ratio) { o.aspect = o.aspect_ratio; delete o.aspect_ratio; } return o; };
const stepsOf = (r, side) => { const sd = r.sessionDir || "", made = {}, out = [], pool = side === "mcp" ? callsOf(r) : []; for (const [ti, t] of (r.turns || []).entries()) (t.plan?.steps || []).forEach((s, i) => { const R = (t.ran || [])[i] || {}; const inputs = (s.inputs || []).map((name) => ({ name, path: made[name] || (sd && existsSync(join(V2, sd, "materials", name)) ? join(sd, "materials", name) : null) })); if (R.output && s.produces) made[s.produces] = join(sd, R.output);
  let params = s.params || null; if (side === "mcp") { const c = pool.find((c) => c.name === s.tool && !c.used); if (c) { c.used = true; if (c.args && typeof c.args === "object") params = { ...(s.params || {}), ...flat(c.args) }; } }
  out.push({ turn: ti, tool: s.tool, model: s.model || null, resolution: s.resolution || null, credits: R.credits ?? s.credits ?? null, state: R.state || null, seconds: R.seconds ?? null, inputs, produces: s.produces || null, output: R.output ? join(sd, R.output) : null, params, why: s.why || null, note: R.note || null, error: R.error || null }); }); return out; };
const callsOf = (r) => (r.turns || []).flatMap((t, ti) => (t.calls || []).map((c) => { let args = c.arguments; try { args = JSON.parse(c.arguments); } catch {} const txt = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v)); return { turn: ti, name: c.name, args, output: txt(c.output).slice(0, 700), error: c.error ? txt(c.error).slice(0, 400) : null }; }));
// what each side did, in a few fields
const info = (x, side) => {
  const r = x.rec, g = x.grade, turns = r.turns || [];
  const dialog = turns.flatMap((t) => t.dialog || []);
  return { pass: !!g.pass, score: g.score ?? 0, spent: r.spent ?? g.spent ?? 0, seconds: r.seconds ?? g.seconds ?? 0, outputs: g.outputs || [], error: r.error || null,
    questions: dialog.filter((d) => side === "agent" || d.asked?.[0] !== "approval").length, approvals: side === "mcp" ? dialog.filter((d) => d.asked?.[0] === "approval").length : 0, stillAsking: turns.some((t) => t.stillAsking),
    chains: turns.map((t) => (t.plan ? (t.plan.refuse ? "refused" : t.plan.steps.map((s) => s.tool).join(" → ")) : t.stillAsking ? "still asking" : "no plan")),
    calls: side === "mcp" ? turns.reduce((a, t) => a + (t.calls || []).length, 0) : turns.reduce((a, t) => a + (t.plan?.steps || []).length, 0),
    models: [...new Set(turns.flatMap((t) => (t.plan?.steps || []).map((s) => s.model).filter((m) => m && m !== "code")))], denied: side === "mcp" ? turns.flatMap((t) => t.denied || []) : [],
    reply: turns.at(-1)?.agent || "", summary: g.judge?.summary || g.reply?.summary || "", faults: (g.judge?.faults || []).filter((f) => f.severity === "major").map((f) => f.what), tags: g.tags || [], kind: turns.at(-1)?.kind || null, failed: turns.flatMap((t) => (t.ran || []).filter((s) => s.state === "failed").map((s) => `${s.tool}: ${s.error || ""}`.slice(0, 160))),
    steps: stepsOf(r, side), mcpCalls: side === "mcp" ? callsOf(r) : [], dialog: dialog.map((d) => ({ asked: d.asked || [], agent: String(d.agent || "").slice(0, 600), user: String(d.user || "").slice(0, 400) })), stages: turns.flatMap((t) => t.stages || []) };
};

// ---- the rows: joined from earlier comparisons (--from), or judged here from two graded result folders
let parts;   // [{ name, from, groups, rows, mcp, agent, mcpDirs, agentDirs, judged }]
if (FROM.length) {
  parts = FROM.map((d) => { const c = JSON.parse(readFileSync(join(d, "compare.json"), "utf8")), mdirs = (c.mcpDirs || c.mcp || []).map(dirOf), adirs = (c.agentDirs || c.agent || []).map(dirOf), MA = loadAll(mdirs), AA = loadAll(adirs);
    const rs = c.rows.filter((r) => !only.length || only.includes(r.id)).map((r) => { const m = pick(MA[r.id], r.mcp.outputs), a = pick(AA[r.id], r.agent.outputs); if (!m || !a) return r; const same = (x, side) => JSON.stringify(x.grade.outputs || []) === JSON.stringify(side.outputs || []); return { ...r, title: m.rec.item?.title || r.title, agent: info(a, "agent"), mcp: info(m, "mcp"), stale: [same(a, r.agent) ? "" : "agent", same(m, r.mcp) ? "" : "mcp"].filter(Boolean) }; });   // the verdict kept; the sides re-read from the records the judge saw (the same outputs), so the page has the pathway; stale names a side re-run since
    const gs = [...new Set(rs.map((r) => r.group))].sort(), arm = (c.agent || []).includes("direct") ? ", direct generation" : (c.agent || []).some((x) => /^direct/.test(x)) ? ` (${(c.agent || []).join(", ")})` : (c.agent || []).includes("agent") ? ", the keyframe chain" : ""; return { name: partName(gs) + (gs.every((g) => g === "I") ? arm : ""), from: basename(d), groups: gs, rows: rs, mcp: mdirs.map((x) => basename(x)), agent: adirs.map((x) => basename(x)), mcpDirs: mdirs.map((x) => relative(V2, x)), agentDirs: adirs.map((x) => relative(V2, x)), judged: !!c.judged }; });
  console.log(parts.map((p) => `${p.name}: ${p.rows.length} items from ${p.from} (agent ${p.agent.join(", ")} · mcp ${p.mcp.join(", ")})`).join(" · "));
  const stale = parts.flatMap((p) => p.rows.filter((r) => r.stale?.length).map((r) => r.id)); if (stale.length) console.log("re-run since the judge saw them (verdict kept, the newer output shown): " + stale.join(", "));
} else {
  mkdirSync(join(OUT, "frames"), { recursive: true });
  const M = newest(MCPS), A = newest(AGENT);
  const ids = Object.keys(M).filter((id) => A[id] && (!only.length || only.includes(id))).sort();
  console.log(`${ids.length} items on both sides · agent from ${AGENT.map((d) => basename(d)).join(", ")} · mcp from ${MCPS.map((d) => basename(d)).join(", ")}${JUDGE ? " · pairwise judge" : ""}`);
  const framesOf = (file, tag) => { const d = duration(file); return [0.25, 0.75].map((q, k) => { const out = join(OUT, "frames", `${tag}-${k}.jpg`); execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, Math.min(d - 0.1, d * q))), "-i", file, "-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", out]); return out; }); };
  // a follow-up item: what each side had made before its last message, so "keep the same picture" can be judged
  const before = (x) => { const turns = x.rec.turns || []; const last = [...turns].reverse().findIndex((t) => t.ran); const k = last < 0 ? -1 : turns.length - 1 - last; return turns.slice(0, Math.max(0, k)).flatMap((t) => (t.ran || []).filter((s) => s.output && s.state === "done").map((s) => join(x.rec.sessionDir, s.output))).filter((p) => IMG.test(p)).slice(-2); };
  const picsOf = (outputs, tag) => { const pics = [], legend = []; for (const o of outputs.slice(0, 3)) { const f = join(V2, o); if (!existsSync(f)) continue; if (IMG.test(o)) { pics.push(f); legend.push(`image (${size(f).join("x")})`); } else if (VID.test(o)) { for (const fr of framesOf(f, `${tag}-${pics.length}`)) { pics.push(fr); } legend.push(`clip of ${Math.round(duration(f) * 10) / 10} s, two frames`); } else if (AUD.test(o)) legend.push(`sound of ${Math.round(duration(f))} s (not shown)`); } return { pics, legend }; };

  // the pairwise judge: both outputs, random order, one pick
  async function pairwise(id, item, a, m) {
    const flip = parseInt(id.replace(/\D/g, ""), 10) % 2 === 1;   // fixed per item, so a rerun judges the same order
    const [X, Y] = flip ? [m, a] : [a, m], px = picsOf(X.outputs, `${id}-x`), py = picsOf(Y.outputs, `${id}-y`);
    if (!px.pics.length && !py.pics.length) return null;
    const bx = before(flip ? M[id] : A[id]).map((p) => join(V2, p)).filter(existsSync), by = before(flip ? A[id] : M[id]).map((p) => join(V2, p)).filter(existsSync);
    const ctx = item.turns.length > 1 && (bx.length || by.length) ? `\nBEFORE THE LAST MESSAGE (context, not the outputs): ${bx.length ? `the ${bx.length} image(s) after the outputs are what system A had made before the last message` : "A: nothing shown"}; ${by.length ? `then ${by.length} image(s) are what system B had made before` : "B: nothing shown"}. Judge the OUTPUTS against the whole conversation: a follow-up that had to keep the earlier picture must keep it.` : "";
    const dialog = (item.turns || []).map((t, k) => `USER (message ${k + 1}): ${t.text}${t.materials?.length ? ` [attached ${t.materials.join(", ")}]` : ""}`).join("\n");
    const j = await jsonCall({ name: "bench-mcp-pairwise", effort: "medium", images: [...px.pics, ...py.pics, ...bx, ...by].slice(0, 12), schema: S.obj({ prefers: S.enum(["A", "B", "tie"]), margin: S.enum(["clear", "slight", "none"]), why: S.str, a_problems: S.str, b_problems: S.str }),
      prompt: `Two AI systems were given the same request. Judge which OUTPUT a demanding client would rather receive, from the images alone and the request. Do not guess which system made which; judge only what you see.

THE REQUEST:
${dialog}

MUST-HAVES the client stated or implied:
${(item.must_haves || []).map((x) => `- ${x}`).join("\n")}
EXACT TEXT that must appear: ${item.spec?.exact_text?.length ? item.spec.exact_text.map((x) => `"${x}"`).join(", ") : "none"}

OUTPUT A: ${px.pics.length ? `the first ${px.pics.length} image(s): ${px.legend.join("; ")}` : "nothing usable was delivered (no image to show)"}
OUTPUT B: ${py.pics.length ? `the next ${py.pics.length} image(s): ${py.legend.join("; ")}` : "nothing usable was delivered (no image to show)"}

${ctx}
Pick A or B (tie only when they are genuinely as good or as bad). margin: clear if one plainly serves the request better, slight if close, none for a tie. a_problems / b_problems: the main faults of each in one line (spelling, missing must-haves, artefacts, wrong size, not what was asked).` });
    const back = (p) => (p === "tie" ? "tie" : (p === "A") !== flip ? "agent" : "mcp");
    return { winner: back(j.prefers), margin: j.margin, why: j.why, agent_problems: flip ? j.b_problems : j.a_problems, mcp_problems: flip ? j.a_problems : j.b_problems, how: "judge" };
  }

  // four items at a time; a judge call that does not answer in five minutes falls back to the grader's verdict
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`no answer in ${ms / 60000} min`)), ms))]);
  async function one(id) {
    const item = M[id].rec.item, a = info(A[id], "agent"), m = info(M[id], "mcp");
    let v = null;
    if (JUDGE && a.outputs.length && m.outputs.length) { try { v = await timeout(pairwise(id, item, a, m), 5 * 60000); } catch (e) { console.log(`${id} judge error: ${e.message.slice(0, 120)}`); } }
    if (!v) {
      if (a.outputs.length && !m.outputs.length) v = { winner: "agent", margin: "clear", why: "the agent delivered a file; the MCP side delivered nothing", how: "made" };
      else if (m.outputs.length && !a.outputs.length) v = { winner: "mcp", margin: "clear", why: "the MCP side delivered a file; the agent delivered nothing", how: "made" };
      else if (Math.abs(a.score - m.score) >= 10) v = { winner: a.score > m.score ? "agent" : "mcp", margin: Math.abs(a.score - m.score) >= 30 ? "clear" : "slight", why: `by the grader's score (${a.score} vs ${m.score})`, how: "score" };
      else v = { winner: "tie", margin: "none", why: `scores within 10 (${a.score} vs ${m.score})`, how: "score" };
    }
    console.log(`${id.padEnd(6)} ${v.winner.padEnd(5)} ${v.margin.padEnd(6)} agent ${String(a.score).padStart(3)} ${String(a.spent).padStart(4)}cr · mcp ${String(m.score).padStart(3)} ${String(m.spent).padStart(4)}cr · ${v.why.slice(0, 90)}`);
    return { id, group: id[0], title: item.title, tests: item.tests, prompt: item.turns.map((t) => t.text), materials: [...new Set(item.turns.flatMap((t) => t.materials || []))], agent: a, mcp: m, verdict: v };
  }
  const rows = [], queue = [...ids];
  await Promise.all(Array.from({ length: Number(arg("--concurrency", "4")) }, async () => { while (queue.length) { const id = queue.shift(); rows.push(await one(id)); } }));
  rows.sort((x, y) => x.id.localeCompare(y.id));
  const gs = [...new Set(rows.map((r) => r.group))].sort();
  parts = [{ name: partName(gs), from: null, groups: gs, rows, mcp: MCPS.map((d) => basename(d)), agent: AGENT.map((d) => basename(d)), mcpDirs: MCPS.map((d) => relative(V2, resolve(d))), agentDirs: AGENT.map((d) => relative(V2, resolve(d))), judged: JUDGE }];
}
const rows = parts.flatMap((p) => p.rows), SRC = { mcp: [...new Set(parts.flatMap((p) => p.mcp))], agent: [...new Set(parts.flatMap((p) => p.agent))], mcpDirs: [...new Set(parts.flatMap((p) => p.mcpDirs))], agentDirs: [...new Set(parts.flatMap((p) => p.agentDirs))] }, JUDGED = parts.some((p) => p.judged);

// ---- aggregates
const agg = (rs) => ({ n: rs.length, agent_pass: rs.filter((r) => r.agent.pass).length, mcp_pass: rs.filter((r) => r.mcp.pass).length, agent_mean: mean(rs.map((r) => r.agent.score)), mcp_mean: mean(rs.map((r) => r.mcp.score)),
  agent_made: rs.filter((r) => r.agent.outputs.length).length, mcp_made: rs.filter((r) => r.mcp.outputs.length).length, wins: rs.filter((r) => r.verdict.winner === "agent").length, losses: rs.filter((r) => r.verdict.winner === "mcp").length, ties: rs.filter((r) => r.verdict.winner === "tie").length,
  agent_credits: rs.reduce((x, r) => x + r.agent.spent, 0), mcp_credits: rs.reduce((x, r) => x + r.mcp.spent, 0), agent_seconds: rs.reduce((x, r) => x + r.agent.seconds, 0), mcp_seconds: rs.reduce((x, r) => x + r.mcp.seconds, 0),
  agent_questions: rs.reduce((x, r) => x + r.agent.questions, 0), mcp_questions: rs.reduce((x, r) => x + r.mcp.questions, 0), mcp_approvals: rs.reduce((x, r) => x + r.mcp.approvals, 0), mcp_denied: rs.reduce((x, r) => x + r.mcp.denied.length, 0), agent_calls: rs.reduce((x, r) => x + r.agent.calls, 0), mcp_calls: rs.reduce((x, r) => x + r.mcp.calls, 0) });
const total = agg(rows);
for (const p of parts) { p.total = agg(p.rows); p.byGroup = Object.fromEntries(p.groups.map((g) => [g, agg(p.rows.filter((r) => r.group === g))])); }
const groups = Object.fromEntries(parts.flatMap((p) => Object.entries(p.byGroup)));   // in page order: the films first when --from puts them first
const models = {}; for (const r of rows) for (const m of r.mcp.models) models[m] = (models[m] || 0) + 1;
const denials = {}; for (const r of rows) for (const d of r.mcp.denied) { const k = d.replace(/^[^:]+: /, "").replace(/"[^"]*"/g, "…").replace(/\d+/g, "n").slice(0, 70); denials[k] = (denials[k] || 0) + 1; }
const mcpTools = {}; for (const r of rows) for (const c of r.mcp.chains.flatMap((c) => c.split(" → "))) if (c && !/refused|still asking|no plan/.test(c)) mcpTools[c] = (mcpTools[c] || 0) + 1;
const winRate = (x) => pct(x.wins, x.wins + x.losses);
writeFileSync(join(OUT, "compare.json"), JSON.stringify({ at: new Date().toISOString(), mcp: SRC.mcp, agent: SRC.agent, mcpDirs: SRC.mcpDirs, agentDirs: SRC.agentDirs, judged: JUDGED, parts: parts.map((p) => ({ name: p.name, from: p.from, groups: p.groups, n: p.rows.length, mcp: p.mcp, agent: p.agent, mcpDirs: p.mcpDirs, agentDirs: p.agentDirs, judged: p.judged, total: p.total })), total, groups, models, denials, mcpTools, rows }, null, 2));

// ---- the text report
const L = [`# ${TITLE}`, "", `${rows.length} items, the same prompt to both. Agent records from ${SRC.agent.join(" and ")}; MCP baseline from ${SRC.mcp.join(" and ")} (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).${parts.length > 1 ? ` Joined from ${parts.map((p) => `${p.from} (${p.name.toLowerCase()}, ${p.rows.length})`).join(" and ")}, in that order.` : ""}`, "",
  `**Head to head: the agent wins ${total.wins}, the MCP wins ${total.losses}, ${total.ties} ties → win rate ${winRate(total)} of decided items${JUDGED ? " (pairwise judge where both delivered; otherwise made-vs-not or the grader's score)" : " (made-vs-not, else the grader's score; no pairwise judge)"}.**`, "",
  "| | Agent | MCP |", "|---|---|---|", `| pass | ${total.agent_pass} (${pct(total.agent_pass, total.n)}) | ${total.mcp_pass} (${pct(total.mcp_pass, total.n)}) |`, `| mean score | ${total.agent_mean} | ${total.mcp_mean} |`, `| delivered a file | ${total.agent_made} | ${total.mcp_made} |`,
  `| credits | ${total.agent_credits} | ${total.mcp_credits} |`, `| minutes of item time | ${Math.round(total.agent_seconds / 60)} | ${Math.round(total.mcp_seconds / 60)} |`, `| questions asked (for information) | ${total.agent_questions} | ${total.mcp_questions} |`, `| asked the user to approve or proceed | 0 | ${total.mcp_approvals} |`, `| calls refused by the free-plan gate | — | ${total.mcp_denied} |`, `| steps planned / tool calls | ${total.agent_calls} | ${total.mcp_calls} |`, "",
  ...(parts.length > 1 ? ["| Part | Items | Agent wins | MCP wins | Ties | Win rate | Agent pass | MCP pass | Agent mean | MCP mean | Agent credits | MCP credits |", "|---|---|---|---|---|---|---|---|---|---|---|---|", ...parts.map((p) => `| ${p.name} (${p.from}) | ${p.total.n} | ${p.total.wins} | ${p.total.losses} | ${p.total.ties} | ${winRate(p.total)} | ${p.total.agent_pass} | ${p.total.mcp_pass} | ${p.total.agent_mean} | ${p.total.mcp_mean} | ${p.total.agent_credits} | ${p.total.mcp_credits} |`), ""] : []),
  "| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |", "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...Object.entries(groups).map(([g, x]) => `| ${g}. ${NAMES[g] || g} | ${x.n} | ${x.agent_pass} | ${x.mcp_pass} | ${x.agent_mean} | ${x.mcp_mean} | ${x.wins} | ${x.losses} | ${x.ties} | ${winRate(x)} | ${x.agent_credits} | ${x.mcp_credits} |`), "",
  "## What the MCP side did", "", `Models it chose: ${Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(", ") || "none"}.`, `Tools it called (steps): ${Object.entries(mcpTools).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(", ") || "none"}.`,
  ...(Object.keys(denials).length ? ["", "Calls the free-plan gate refused:", ...Object.entries(denials).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${n}× ${k}`)] : []), ""];
const line = (r) => `- **${r.id}** ${r.title} · agent ${r.agent.score}${r.agent.pass ? " pass" : ""} (${r.agent.spent} cr) vs MCP ${r.mcp.score}${r.mcp.pass ? " pass" : ""} (${r.mcp.spent} cr) · ${r.verdict.why.slice(0, 160)}`;
const losses = rows.filter((r) => r.verdict.winner === "mcp"); L.push(`## Where the MCP won (${losses.length})`, "", ...(losses.length ? losses.map(line) : ["- none"]), "");
const wins = rows.filter((r) => r.verdict.winner === "agent").sort((a, b) => (b.agent.score - b.mcp.score) - (a.agent.score - a.mcp.score)); L.push(`## The agent's clearest wins (top ${Math.min(12, wins.length)} of ${wins.length})`, "", ...wins.slice(0, 12).map(line), "");
const both = rows.filter((r) => !r.agent.pass && !r.mcp.pass); L.push(`## Both failed (${both.length})`, "", ...both.slice(0, 40).map((r) => `- **${r.id}** ${r.title} · agent: ${(r.agent.summary || r.agent.tags.join(", ")).slice(0, 110)} · MCP: ${(r.mcp.summary || r.mcp.tags.join(", ")).slice(0, 110)}`), "");
writeFileSync(join(OUT, "compare.md"), L.join("\n") + "\n");

// ---- the page: the MCP's result on the left, the agent's on the right, item by item; the parts in order, each under its heading
// the user's attachments as small embedded thumbnails (the page server serves sessions and runs, not the fixtures)
const thumbs = {}; const thumb = (name) => { if (thumbs[name] !== undefined) return thumbs[name]; const f = join(V2, "bench/v1/fixtures", name); try { thumbs[name] = IMG.test(name) && existsSync(f) ? `data:image/jpeg;base64,${execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=160:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "6", "-"], { maxBuffer: 1 << 24 }).toString("base64")}` : null; } catch { thumbs[name] = null; } return thumbs[name]; };
const short = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n)} … (${s.length} chars)` : s; };
const media = (p, cls = "m", preload = "metadata") => { if (!p) return ""; const u = esc("/" + p); if (VID.test(p)) return `<video class="${cls}" src="${u}" controls preload="${preload}"></video>`; if (AUD.test(p)) return `<audio src="${u}" controls preload="none"></audio>`; if (IMG.test(p)) return `<a href="${u}" target="_blank"><img class="${cls}" src="${u}" loading="lazy" alt=""></a>`; return `<a href="${u}" target="_blank">${esc(p.split("/").pop())}</a>`; };
const pm = (p) => media(p, "pm", "none"), inp = (i) => (i.path ? pm(i.path) : thumb(i.name) ? `<img class="pm" src="${thumb(i.name)}" title="${esc(i.name)}" alt="">` : `<span class="fn">${esc(i.name)}</span>`);
// a step's parameters as text: the prompt first, then the rest that is set
const paramsText = (p) => { if (!p || typeof p !== "object") return String(p ?? ""); const o = { ...p }, main = o.prompt ?? o.prompt_or_change ?? o.motion ?? o.change ?? null; for (const k of ["prompt", "prompt_or_change", "motion", "change"]) delete o[k]; const keep = ([, v]) => v !== null && v !== undefined && v !== "" && v !== false && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Object.keys(v).length); return [main ? `prompt: ${main}` : "", ...Object.entries(o).filter(keep).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)].filter(Boolean).join("\n"); };
const stepHtml = (s, k) => `<li class="st ${esc(s.state || "")}"><div class="sh"><b>${k + 1}. ${esc(s.tool)}</b> <span class="meta">${[s.model, s.resolution, s.params?.seconds ? `${s.params.seconds} s` : "", s.params?.aspect || s.params?.aspect_ratio || "", s.params?.audio != null ? `audio ${s.params.audio ? "on" : "off"}` : "", s.credits != null ? `${s.credits} cr` : "", s.state, s.seconds ? `${s.seconds} s to run` : ""].filter(Boolean).map(esc).join(" · ")}</span></div>
  ${s.inputs?.length ? `<div class="io"><span class="lbl">in</span>${s.inputs.map(inp).join("")}</div>` : ""}${s.params ? `<pre class="pp">${esc(short(paramsText(s.params), 3000))}</pre>` : ""}
  ${s.why ? `<div class="meta">why: ${esc(s.why)}</div>` : ""}${s.note ? `<div class="meta">note: ${esc(short(s.note, 300))}</div>` : ""}${s.error ? `<div class="faults">${esc(short(s.error, 300))}</div>` : ""}
  <div class="io"><span class="lbl">out</span>${s.output ? pm(s.output) : `<span class="meta">${s.produces ? `${esc(s.produces)} — ` : ""}nothing</span>`}</div></li>`;
const stageHtml = (g, k) => `<li class="st"><div class="sh"><b>${k + 1}. ${esc(g.stage)}</b> <span class="meta">${g.credits || 0} cr${g.items?.length ? ` · ${g.items.length} ${g.stage === "keyframes" ? "stills" : g.stage === "assets" ? "roots" : g.stage === "clips" ? "clips" : "files"}` : ""}${g.file ? ` · <a href="${esc("/" + g.file)}" target="_blank">the full text</a>` : ""}</span></div>
  ${g.note ? `<div class="meta">${esc(short(g.note, 400))}</div>` : ""}${g.text ? `<details><summary>text (${g.text.length} chars)</summary><pre class="pp">${esc(short(g.text, 12000))}</pre></details>` : ""}
  ${g.items?.length ? `<div class="grid">${g.items.map((it) => `<div class="cell">${it.inputs?.length ? `<div class="io"><span class="lbl">from</span>${it.inputs.map(inp).join("")}</div>` : ""}${it.file ? pm(it.file) : ""}<div class="meta"><b>${esc(it.id)}</b>${it.note ? ` · ${esc(short(it.note, 300))}` : ""}</div>${it.attempts?.length ? `<div class="io"><span class="lbl">earlier</span>${it.attempts.map((p) => pm(p)).join("")}</div>` : ""}${it.prompt ? `<details><summary>prompt (${it.prompt.length} chars)</summary><pre class="pp">${esc(short(it.prompt, 6000))}</pre></details>` : ""}</div>`).join("")}</div>` : ""}</li>`;
const pathway = (x, side) => {
  const film = x.stages?.length > 0, n = film ? x.stages.length : x.steps.length; if (!n && !x.mcpCalls.length && !x.dialog.length) return "";
  const line = film ? x.stages.map((g) => g.stage).join(" → ") : x.steps.map((s) => `${s.tool}${s.model && s.model !== "code" ? `@${s.model}` : ""}`).join(" → "), credits = film ? x.stages.reduce((a, g) => a + (g.credits || 0), 0) : x.steps.reduce((a, s) => a + (s.credits || 0), 0);
  return `<details class="path"><summary><b>pathway</b> <span class="meta">${esc(short(line, 170))} · ${n} ${film ? "stages" : "steps"}${side === "mcp" && x.mcpCalls.length ? ` · ${x.mcpCalls.length} calls` : ""} · ${credits} cr</span></summary>
  ${x.dialog.length ? `<div class="dlg">${x.dialog.map((d) => `<div><span class="lbl">asked</span> ${esc(short(d.agent, 400))}</div><div><span class="lbl">user</span> ${esc(short(d.user, 300))}</div>`).join("")}</div>` : ""}
  <ol class="steps">${film ? x.stages.map(stageHtml).join("") : x.steps.map(stepHtml).join("")}</ol>
  ${x.mcpCalls.length ? `<details class="calls"><summary>every MCP call (${x.mcpCalls.length}): ${esc(short(x.mcpCalls.map((c) => c.name).join(" → "), 160))}</summary><ol>${x.mcpCalls.map((c) => `<li><b>${esc(c.name)}</b>${c.error ? ` <span class="faults">error: ${esc(short(c.error, 240))}</span>` : ""}<pre class="pp">${esc(short(typeof c.args === "string" ? c.args : JSON.stringify(c.args, null, 1), 3000))}</pre>${c.output ? `<pre class="pp out">→ ${esc(short(c.output, 500))}</pre>` : ""}</li>`).join("")}</ol></details>` : ""}</details>`;
};
const side = (x, name, which) => `<div class="side ${x.pass ? "pass" : "fail"}"><div class="hd"><b>${name}</b> <span class="sc">${x.score}</span> ${x.pass ? '<span class="tag ok">pass</span>' : '<span class="tag no">fail</span>'} <span class="meta">${x.spent} cr${x.seconds ? ` · ${x.seconds} s` : ""}${x.questions ? ` · asked ${x.questions}` : ""}${x.approvals ? ` · approval ×${x.approvals}` : ""}${x.denied.length ? ` · refused ×${x.denied.length}` : ""}</span></div>
  <div class="media">${x.outputs.length ? x.outputs.slice(0, 4).map((o) => media(o)).join("") : `<div class="none">nothing delivered${x.error ? `: ${esc(x.error.slice(0, 160))}` : ""}</div>`}</div>
  <div class="chain">${esc(x.chains.join(" | "))}${x.models.length ? ` <span class="meta">(${esc(x.models.join(", "))})</span>` : ""}</div>
  ${pathway(x, which)}
  ${x.summary ? `<div class="judge">${esc(x.summary)}</div>` : ""}${x.faults.length ? `<div class="faults">${esc(x.faults.join(" · "))}</div>` : ""}${x.failed.length ? `<div class="faults">${esc(x.failed.join(" · "))}</div>` : ""}
  ${x.reply ? `<details><summary>reply</summary><pre>${esc(x.reply.slice(0, 1500))}</pre></details>` : ""}</div>`;
const row = (r, k) => `<section class="item p${k} g${r.group} w-${r.verdict.winner}" id="${r.id}"><div class="top"><span class="id">${r.id}</span> <b>${esc(r.title)}</b> <span class="verdict ${r.verdict.winner}">${r.verdict.winner === "tie" ? "tie" : `${r.verdict.winner === "agent" ? sa : sm} wins`}${r.verdict.margin !== "none" ? ` (${r.verdict.margin})` : ""}</span> <span class="meta">${esc(r.verdict.why.slice(0, 200))}</span>${r.stale?.length ? ` <span class="tag no" title="this side was re-run after the judge saw it: the verdict is the judge's, the output shown is the newer one">re-run since judged: ${r.stale.join(", ")}</span>` : ""}</div>
  <div class="prompt">${r.prompt.map((p, k) => `<div>${r.prompt.length > 1 ? `<span class="meta">message ${k + 1}:</span> ` : ""}${esc(p)}</div>`).join("")}${r.materials.length ? `<div class="atts">${r.materials.map((m) => thumb(m) ? `<img src="${thumb(m)}" title="${esc(m)}" alt="">` : `<span class="meta">${esc(m)}</span>`).join("")}</div>` : ""}</div>
  <div class="sides">${side(r.mcp, NM, "mcp")}${side(r.agent, NA, "agent")}</div>
  ${r.verdict.how === "judge" ? `<div class="pw"><b>Judge:</b> ${esc(r.verdict.why)} <span class="meta">${sm}: ${esc(r.verdict.mcp_problems || "")} · ${sa}: ${esc(r.verdict.agent_problems || "")}</span></div>` : ""}</section>`;
const stat = (x) => `${sa} wins <b>${x.wins}</b> · ${sm} wins <b>${x.losses}</b> · ties <b>${x.ties}</b> · win rate <b>${winRate(x)}</b> · pass ${sa} <b>${x.agent_pass}</b> vs ${sm} <b>${x.mcp_pass}</b> · mean <b>${x.agent_mean}</b> vs <b>${x.mcp_mean}</b> · credits <b>${x.agent_credits}</b> vs <b>${x.mcp_credits}</b>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(TITLE)}</title><style>
body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:0;background:#f5f5f4;color:#222}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:10px 16px;z-index:2}h1{font-size:18px;margin:0 0 6px}
.stats{display:flex;gap:18px;flex-wrap:wrap}.stats b{font-size:16px}.parts{margin-top:4px;font-size:13px}.parts b{font-size:14px}.filters{margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.filters button{border:1px solid #ccc;background:#fff;border-radius:12px;padding:2px 10px;cursor:pointer}.filters button.on{background:#222;color:#fff;border-color:#222}.filters .sep{color:#ccc}
table{border-collapse:collapse;font-size:13px;margin:10px 16px}td,th{border:1px solid #ddd;padding:3px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
h2.part{margin:22px 16px 4px;font-size:17px}h2.part .meta{font-weight:400;font-size:13px}
.item{background:#fff;margin:12px 16px;border:1px solid #ddd;border-radius:8px;padding:10px 14px}.item.hidden,h2.hidden{display:none}.top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.id{font-family:ui-monospace,Menlo,monospace;color:#666}
.verdict{padding:1px 8px;border-radius:10px;font-weight:600}.verdict.agent{background:#dcfce7;color:#166534}.verdict.mcp{background:#fee2e2;color:#991b1b}.verdict.tie{background:#e5e7eb;color:#374151}.meta{color:#777;font-size:12px}
.prompt{margin:6px 0 8px;padding:6px 10px;background:#fafaf9;border-left:3px solid #ccc;white-space:pre-wrap}.gI .prompt{max-height:220px;overflow:auto}.atts img{height:56px;margin:4px 6px 0 0;border:1px solid #ddd}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:12px}.side{border:1px solid #e5e5e5;border-radius:6px;padding:8px;min-width:0}.side.pass{border-color:#86efac}.hd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.sc{font-weight:700;font-size:16px}
.tag{font-size:11px;padding:0 6px;border-radius:8px}.tag.ok{background:#dcfce7;color:#166534}.tag.no{background:#fee2e2;color:#991b1b}.media{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.m{max-height:260px;max-width:100%;border:1px solid #ddd;background:#000}.gI .m{max-height:480px;width:100%}
.none{color:#991b1b;padding:20px;background:#fef2f2;width:100%}.chain{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#444;margin:4px 0}.judge{font-size:13px;color:#333}.faults{font-size:12px;color:#991b1b}.pw{margin-top:6px;font-size:13px;border-top:1px dashed #ddd;padding-top:6px}
details{font-size:12px}summary{cursor:pointer}pre{white-space:pre-wrap;background:#fafaf9;padding:6px;font-size:12px;margin:4px 0}
details.path{margin:6px 0;border-top:1px dashed #e5e5e5;padding-top:4px}details.path>summary{font-size:13px}.steps{margin:6px 0 0;padding-left:18px}.st{margin:6px 0;padding:6px 8px;background:#fafaf9;border-radius:6px}.st.failed{background:#fef2f2}.st.flagged{background:#fffbeb}.sh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.io{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}.lbl{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.04em;min-width:26px}.pm{max-height:120px;max-width:200px;border:1px solid #ddd;background:#000}.pp{max-height:280px;overflow:auto;background:#fff}.pp.out{color:#555}.fn{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin-top:6px}.cell{border:1px solid #e5e5e5;border-radius:6px;padding:6px;background:#fff;min-width:0}.cell>.pm,.cell>a>.pm{max-height:160px;max-width:100%}.dlg{font-size:12px;margin:4px 0;padding:4px 8px;border-left:2px solid #ddd}details.calls{margin-top:6px}details.calls ol{padding-left:18px}
@media(max-width:640px){.sides{grid-template-columns:1fr}}
</style></head><body><header><h1>${esc(TITLE)}</h1><div class="stats"><span>items <b>${total.n}</b></span><span>${sa} wins <b>${total.wins}</b></span><span>${sm} wins <b>${total.losses}</b></span><span>ties <b>${total.ties}</b></span><span>win rate <b>${winRate(total)}</b></span><span>pass ${sa} <b>${total.agent_pass}</b> vs ${sm} <b>${total.mcp_pass}</b></span><span>mean ${sa} <b>${total.agent_mean}</b> vs ${sm} <b>${total.mcp_mean}</b></span><span>credits ${sa} <b>${total.agent_credits}</b> vs ${sm} <b>${total.mcp_credits}</b></span><span>questions ${sa} <b>${total.agent_questions}</b> vs ${sm} <b>${total.mcp_questions}</b> (+${total.mcp_approvals} approvals)</span></div>
${parts.length > 1 ? `<div class="stats parts">${parts.map((p, k) => `<span><a href="#part${k}">${esc(p.name)}</a> (${p.rows.length}): ${stat(p.total)}</span>`).join("")}</div>` : ""}
<div class="filters"><button class="on" data-f="all">all</button><button data-f="w-agent">${sa} wins</button><button data-f="w-mcp">${sm} wins</button><button data-f="w-tie">ties</button>${parts.length > 1 ? parts.map((p, k) => `<button data-f="p${k}">${esc(p.name.toLowerCase())}</button>`).join("") : ""}${Object.keys(groups).map((g) => `<button data-f="g${g}">${g}. ${esc(NAMES[g] || g)}</button>`).join("")}<span class="sep">|</span><button id="open-all">open all pathways</button><button id="close-all">close all</button></div></header>
<table><tr><th>Group</th><th>Items</th><th>${sa} pass</th><th>${sm} pass</th><th>${sa} mean</th><th>${sm} mean</th><th>${sa} wins</th><th>${sm} wins</th><th>Ties</th><th>Win rate</th><th>${sa} credits</th><th>${sm} credits</th><th>${sa} questions</th><th>${sm} questions</th><th>${sm} approvals</th></tr>
${Object.entries(groups).map(([g, x]) => `<tr><td>${g}. ${esc(NAMES[g] || g)}</td><td>${x.n}</td><td>${x.agent_pass}</td><td>${x.mcp_pass}</td><td>${x.agent_mean}</td><td>${x.mcp_mean}</td><td>${x.wins}</td><td>${x.losses}</td><td>${x.ties}</td><td>${winRate(x)}</td><td>${x.agent_credits}</td><td>${x.mcp_credits}</td><td>${x.agent_questions}</td><td>${x.mcp_questions}</td><td>${x.mcp_approvals}</td></tr>`).join("")}</table>
${parts.map((p, k) => `${parts.length > 1 ? `<h2 class="part p${k}" id="part${k}">${esc(p.name)} <span class="meta">${p.rows.length} items from ${esc(p.from || "this run")} · ${stat(p.total)}</span></h2>` : ""}\n${p.rows.map((r) => row(r, k)).join("\n")}`).join("\n")}
<script>document.querySelectorAll(".filters button[data-f]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button[data-f]").forEach(x=>x.classList.remove("on"));b.classList.add("on");const f=b.dataset.f;document.querySelectorAll(".item").forEach(it=>it.classList.toggle("hidden",f!=="all"&&!it.classList.contains(f)));document.querySelectorAll("h2.part").forEach(h=>h.classList.toggle("hidden",f.startsWith("p")&&!h.classList.contains(f)))});
document.getElementById("open-all").onclick=()=>document.querySelectorAll(".item:not(.hidden) details.path").forEach(d=>d.open=true);document.getElementById("close-all").onclick=()=>document.querySelectorAll("details.path").forEach(d=>d.open=false);</script></body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`\nagent ${total.wins} · mcp ${total.losses} · ties ${total.ties} · win rate ${winRate(total)} · pass ${total.agent_pass} vs ${total.mcp_pass} · mean ${total.agent_mean} vs ${total.mcp_mean} · credits ${total.agent_credits} vs ${total.mcp_credits}\n→ ${OUT}/compare.md, index.html (serve: node V2/bench/v1/serve.mjs → http://localhost:4748/${basename(OUT)}/)`);
