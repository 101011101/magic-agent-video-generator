// Agent against the MCP baseline, item by item: the same prompt, the two outputs side by side, a pairwise judge that
// sees both in random order and picks one, and the behaviour that differs (questions, approvals, calls, models, credits,
// time). Reads graded result folders (bench/v1/grade.mjs on each). Writes compare.json, compare.md and index.html into
// a results folder that bench/v1/serve.mjs serves (http://localhost:4748/compare-mcp-1/), media from /sessions and /runs.
// Usage: node V2/bench/mcp/compare.mjs --mcp V2/bench/v1/results/mcp-1[,…] --agent V2/bench/v1/results/real-1[,…/latest]
//        [--judge] [--only A01d,B07a] [--out V2/bench/v1/results/compare-mcp-1] [--title "…"] [--concurrency 4]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { duration, size } from "../../backend/lib/media.js";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MCPS = (arg("--mcp", join(V2, "bench/v1/results/mcp-1")) || "").split(",").filter(Boolean), MCP = MCPS[0], AGENT = (arg("--agent", join(V2, "bench/v1/results/real-1")) || "").split(",").filter(Boolean);   // either side may be several folders: the newest record per item wins
const OUT = arg("--out", join(V2, "bench/v1/results", `compare-${basename(MCP)}`)), JUDGE = process.argv.includes("--judge"), only = (arg("--only", "") || "").split(",").filter(Boolean);
const TITLE = arg("--title", `Agent vs the Magic Hour MCP · ${basename(MCP)}`); mkdirSync(join(OUT, "frames"), { recursive: true });
const NAMES = { A: "Single images", B: "Image edits", C: "Faces and characters", D: "Short video", E: "Editing the user's video", F: "Sound", G: "Composed pieces", H: "Ads and reels", I: "Longer stories (film)", J: "Conversation" };
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm)$/i, AUD = /\.(mp3|wav|m4a)$/i;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0), pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");

// one folder: records and grades by id
const load = (dir) => { if (!existsSync(join(dir, "grades.json"))) throw new Error(`${dir}: no grades.json (run bench/v1/grade.mjs --dir first)`); const G = Object.fromEntries(JSON.parse(readFileSync(join(dir, "grades.json"), "utf8")).map((g) => [g.id, g])); const R = {}; for (const f of readdirSync(dir)) if (/^[A-J]\d\d[a-z]\.json$/.test(f)) { const r = JSON.parse(readFileSync(join(dir, f), "utf8")); if (G[r.id]) R[r.id] = { rec: r, grade: G[r.id], dir }; } return R; };
const M = {}; for (const d of MCPS) for (const [id, x] of Object.entries(load(d))) if (!M[id] || (x.rec.started || "") > (M[id].rec.started || "")) M[id] = x;
const A = {}; for (const d of AGENT) for (const [id, x] of Object.entries(load(d))) if (!A[id] || (x.rec.started || "") > (A[id].rec.started || "")) A[id] = x;   // the newest agent record per item
const ids = Object.keys(M).filter((id) => A[id] && (!only.length || only.includes(id))).sort();
console.log(`${ids.length} items on both sides · agent from ${AGENT.map((d) => basename(d)).join(", ")} · mcp from ${MCPS.map((d) => basename(d)).join(", ")}${JUDGE ? " · pairwise judge" : ""}`);

// what each side did, in a few fields
const info = (x, side) => {
  const r = x.rec, g = x.grade, turns = r.turns || [];
  const dialog = turns.flatMap((t) => t.dialog || []);
  return { pass: !!g.pass, score: g.score ?? 0, spent: r.spent ?? g.spent ?? 0, seconds: r.seconds ?? g.seconds ?? 0, outputs: g.outputs || [], error: r.error || null,
    questions: dialog.filter((d) => side === "agent" || d.asked?.[0] !== "approval").length, approvals: side === "mcp" ? dialog.filter((d) => d.asked?.[0] === "approval").length : 0, stillAsking: turns.some((t) => t.stillAsking),
    chains: turns.map((t) => (t.plan ? (t.plan.refuse ? "refused" : t.plan.steps.map((s) => s.tool).join(" → ")) : t.stillAsking ? "still asking" : "no plan")),
    calls: side === "mcp" ? turns.reduce((a, t) => a + (t.calls || []).length, 0) : turns.reduce((a, t) => a + (t.plan?.steps || []).length, 0),
    models: [...new Set(turns.flatMap((t) => (t.plan?.steps || []).map((s) => s.model).filter((m) => m && m !== "code")))], denied: side === "mcp" ? turns.flatMap((t) => t.denied || []) : [],
    reply: turns.at(-1)?.agent || "", summary: g.judge?.summary || g.reply?.summary || "", faults: (g.judge?.faults || []).filter((f) => f.severity === "major").map((f) => f.what), tags: g.tags || [], kind: turns.at(-1)?.kind || null, failed: turns.flatMap((t) => (t.ran || []).filter((s) => s.state === "failed").map((s) => `${s.tool}: ${s.error || ""}`.slice(0, 160))) };
};
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
const rows = [], queue = [...ids];
await Promise.all(Array.from({ length: Number(arg("--concurrency", "4")) }, async () => { while (queue.length) { const id = queue.shift(); rows.push(await one(id)); } }));
rows.sort((x, y) => x.id.localeCompare(y.id));
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

// ---- aggregates
const agg = (rs) => ({ n: rs.length, agent_pass: rs.filter((r) => r.agent.pass).length, mcp_pass: rs.filter((r) => r.mcp.pass).length, agent_mean: mean(rs.map((r) => r.agent.score)), mcp_mean: mean(rs.map((r) => r.mcp.score)),
  agent_made: rs.filter((r) => r.agent.outputs.length).length, mcp_made: rs.filter((r) => r.mcp.outputs.length).length, wins: rs.filter((r) => r.verdict.winner === "agent").length, losses: rs.filter((r) => r.verdict.winner === "mcp").length, ties: rs.filter((r) => r.verdict.winner === "tie").length,
  agent_credits: rs.reduce((x, r) => x + r.agent.spent, 0), mcp_credits: rs.reduce((x, r) => x + r.mcp.spent, 0), agent_seconds: rs.reduce((x, r) => x + r.agent.seconds, 0), mcp_seconds: rs.reduce((x, r) => x + r.mcp.seconds, 0),
  agent_questions: rs.reduce((x, r) => x + r.agent.questions, 0), mcp_questions: rs.reduce((x, r) => x + r.mcp.questions, 0), mcp_approvals: rs.reduce((x, r) => x + r.mcp.approvals, 0), mcp_denied: rs.reduce((x, r) => x + r.mcp.denied.length, 0), agent_calls: rs.reduce((x, r) => x + r.agent.calls, 0), mcp_calls: rs.reduce((x, r) => x + r.mcp.calls, 0) });
const total = agg(rows), groups = Object.fromEntries([...new Set(rows.map((r) => r.group))].sort().map((g) => [g, agg(rows.filter((r) => r.group === g))]));
const models = {}; for (const r of rows) for (const m of r.mcp.models) models[m] = (models[m] || 0) + 1;
const denials = {}; for (const r of rows) for (const d of r.mcp.denied) { const k = d.replace(/^[^:]+: /, "").replace(/"[^"]*"/g, "…").replace(/\d+/g, "n").slice(0, 70); denials[k] = (denials[k] || 0) + 1; }
const mcpTools = {}; for (const r of rows) for (const c of r.mcp.chains.flatMap((c) => c.split(" → "))) if (c && !/refused|still asking|no plan/.test(c)) mcpTools[c] = (mcpTools[c] || 0) + 1;
const winRate = (x) => pct(x.wins, x.wins + x.losses);
writeFileSync(join(OUT, "compare.json"), JSON.stringify({ at: new Date().toISOString(), mcp: MCPS.map((d) => basename(d)), agent: AGENT.map((d) => basename(d)), judged: JUDGE, total, groups, models, denials, mcpTools, rows }, null, 2));

// ---- the text report
const L = [`# ${TITLE}`, "", `${rows.length} items, the same prompt to both. Agent records from ${AGENT.map((d) => basename(d)).join(" and ")}; MCP baseline from ${MCPS.map((d) => basename(d)).join(" and ")} (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).`, "",
  `**Head to head: the agent wins ${total.wins}, the MCP wins ${total.losses}, ${total.ties} ties → win rate ${winRate(total)} of decided items${JUDGE ? " (pairwise judge where both delivered; otherwise made-vs-not or the grader's score)" : " (made-vs-not, else the grader's score; no pairwise judge)"}.**`, "",
  "| | Agent | MCP |", "|---|---|---|", `| pass | ${total.agent_pass} (${pct(total.agent_pass, total.n)}) | ${total.mcp_pass} (${pct(total.mcp_pass, total.n)}) |`, `| mean score | ${total.agent_mean} | ${total.mcp_mean} |`, `| delivered a file | ${total.agent_made} | ${total.mcp_made} |`,
  `| credits | ${total.agent_credits} | ${total.mcp_credits} |`, `| minutes of item time | ${Math.round(total.agent_seconds / 60)} | ${Math.round(total.mcp_seconds / 60)} |`, `| questions asked (for information) | ${total.agent_questions} | ${total.mcp_questions} |`, `| asked the user to approve or proceed | 0 | ${total.mcp_approvals} |`, `| calls refused by the free-plan gate | — | ${total.mcp_denied} |`, `| steps planned / tool calls | ${total.agent_calls} | ${total.mcp_calls} |`, "",
  "| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |", "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...Object.entries(groups).map(([g, x]) => `| ${g}. ${NAMES[g] || g} | ${x.n} | ${x.agent_pass} | ${x.mcp_pass} | ${x.agent_mean} | ${x.mcp_mean} | ${x.wins} | ${x.losses} | ${x.ties} | ${winRate(x)} | ${x.agent_credits} | ${x.mcp_credits} |`), "",
  "## What the MCP side did", "", `Models it chose: ${Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(", ") || "none"}.`, `Tools it called (steps): ${Object.entries(mcpTools).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(", ") || "none"}.`,
  ...(Object.keys(denials).length ? ["", "Calls the free-plan gate refused:", ...Object.entries(denials).sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${n}× ${k}`)] : []), ""];
const line = (r) => `- **${r.id}** ${r.title} · agent ${r.agent.score}${r.agent.pass ? " pass" : ""} (${r.agent.spent} cr) vs MCP ${r.mcp.score}${r.mcp.pass ? " pass" : ""} (${r.mcp.spent} cr) · ${r.verdict.why.slice(0, 160)}`;
const losses = rows.filter((r) => r.verdict.winner === "mcp"); L.push(`## Where the MCP won (${losses.length})`, "", ...(losses.length ? losses.map(line) : ["- none"]), "");
const wins = rows.filter((r) => r.verdict.winner === "agent").sort((a, b) => (b.agent.score - b.mcp.score) - (a.agent.score - a.mcp.score)); L.push(`## The agent's clearest wins (top ${Math.min(12, wins.length)} of ${wins.length})`, "", ...wins.slice(0, 12).map(line), "");
const both = rows.filter((r) => !r.agent.pass && !r.mcp.pass); L.push(`## Both failed (${both.length})`, "", ...both.slice(0, 40).map((r) => `- **${r.id}** ${r.title} · agent: ${(r.agent.summary || r.agent.tags.join(", ")).slice(0, 110)} · MCP: ${(r.mcp.summary || r.mcp.tags.join(", ")).slice(0, 110)}`), "");
writeFileSync(join(OUT, "compare.md"), L.join("\n") + "\n");

// ---- the page
// the user's attachments as small embedded thumbnails (the page server serves sessions and runs, not the fixtures)
const thumbs = {}; const thumb = (name) => { if (thumbs[name] !== undefined) return thumbs[name]; const f = join(V2, "bench/v1/fixtures", name); try { thumbs[name] = IMG.test(name) && existsSync(f) ? `data:image/jpeg;base64,${execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=160:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "6", "-"], { maxBuffer: 1 << 24 }).toString("base64")}` : null; } catch { thumbs[name] = null; } return thumbs[name]; };
const media = (p, small = true) => { if (!p) return ""; const u = esc("/" + p); if (VID.test(p)) return `<video class="m" src="${u}" controls preload="metadata"></video>`; if (AUD.test(p)) return `<audio src="${u}" controls preload="none"></audio>`; if (IMG.test(p)) return `<a href="${u}" target="_blank"><img class="m" src="${u}" loading="lazy" alt=""></a>`; return `<a href="${u}" target="_blank">${esc(p.split("/").pop())}</a>`; };
const side = (x, name) => `<div class="side ${x.pass ? "pass" : "fail"}"><div class="hd"><b>${name}</b> <span class="sc">${x.score}</span> ${x.pass ? '<span class="tag ok">pass</span>' : '<span class="tag no">fail</span>'} <span class="meta">${x.spent} cr · ${x.seconds} s${x.questions ? ` · asked ${x.questions}` : ""}${x.approvals ? ` · approval ×${x.approvals}` : ""}${x.denied.length ? ` · refused ×${x.denied.length}` : ""}</span></div>
  <div class="media">${x.outputs.length ? x.outputs.slice(0, 4).map((o) => media(o)).join("") : `<div class="none">nothing delivered${x.error ? `: ${esc(x.error.slice(0, 160))}` : ""}</div>`}</div>
  <div class="chain">${esc(x.chains.join(" | "))}${x.models.length ? ` <span class="meta">(${esc(x.models.join(", "))})</span>` : ""}</div>
  ${x.summary ? `<div class="judge">${esc(x.summary)}</div>` : ""}${x.faults.length ? `<div class="faults">${esc(x.faults.join(" · "))}</div>` : ""}${x.failed.length ? `<div class="faults">${esc(x.failed.join(" · "))}</div>` : ""}
  ${x.reply ? `<details><summary>reply</summary><pre>${esc(x.reply.slice(0, 1500))}</pre></details>` : ""}</div>`;
const row = (r) => `<section class="item g${r.group} w-${r.verdict.winner}" id="${r.id}"><div class="top"><span class="id">${r.id}</span> <b>${esc(r.title)}</b> <span class="verdict ${r.verdict.winner}">${r.verdict.winner === "tie" ? "tie" : `${r.verdict.winner} wins`}${r.verdict.margin !== "none" ? ` (${r.verdict.margin})` : ""}</span> <span class="meta">${esc(r.verdict.why.slice(0, 200))}</span></div>
  <div class="prompt">${r.prompt.map((p, k) => `<div>${r.prompt.length > 1 ? `<span class="meta">message ${k + 1}:</span> ` : ""}${esc(p)}</div>`).join("")}${r.materials.length ? `<div class="atts">${r.materials.map((m) => thumb(m) ? `<img src="${thumb(m)}" title="${esc(m)}" alt="">` : `<span class="meta">${esc(m)}</span>`).join("")}</div>` : ""}</div>
  <div class="sides">${side(r.agent, "Agent")}${side(r.mcp, "MCP baseline")}</div>
  ${r.verdict.how === "judge" ? `<div class="pw"><b>Judge:</b> ${esc(r.verdict.why)} <span class="meta">agent: ${esc(r.verdict.agent_problems || "")} · MCP: ${esc(r.verdict.mcp_problems || "")}</span></div>` : ""}</section>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(TITLE)}</title><style>
body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:0;background:#f5f5f4;color:#222}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:10px 16px;z-index:2}h1{font-size:18px;margin:0 0 6px}
.stats{display:flex;gap:18px;flex-wrap:wrap}.stats b{font-size:16px}.filters{margin-top:6px;display:flex;gap:8px;flex-wrap:wrap}.filters button{border:1px solid #ccc;background:#fff;border-radius:12px;padding:2px 10px;cursor:pointer}.filters button.on{background:#222;color:#fff;border-color:#222}
table{border-collapse:collapse;font-size:13px;margin:10px 16px}td,th{border:1px solid #ddd;padding:3px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
.item{background:#fff;margin:12px 16px;border:1px solid #ddd;border-radius:8px;padding:10px 14px}.item.hidden{display:none}.top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.id{font-family:ui-monospace,Menlo,monospace;color:#666}
.verdict{padding:1px 8px;border-radius:10px;font-weight:600}.verdict.agent{background:#dcfce7;color:#166534}.verdict.mcp{background:#fee2e2;color:#991b1b}.verdict.tie{background:#e5e7eb;color:#374151}.meta{color:#777;font-size:12px}
.prompt{margin:6px 0 8px;padding:6px 10px;background:#fafaf9;border-left:3px solid #ccc}.atts img{height:56px;margin:4px 6px 0 0;border:1px solid #ddd}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:12px}.side{border:1px solid #e5e5e5;border-radius:6px;padding:8px}.side.pass{border-color:#86efac}.hd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.sc{font-weight:700;font-size:16px}
.tag{font-size:11px;padding:0 6px;border-radius:8px}.tag.ok{background:#dcfce7;color:#166534}.tag.no{background:#fee2e2;color:#991b1b}.media{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.m{max-height:260px;max-width:100%;border:1px solid #ddd;background:#000}
.none{color:#991b1b;padding:20px;background:#fef2f2;width:100%}.chain{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#444;margin:4px 0}.judge{font-size:13px;color:#333}.faults{font-size:12px;color:#991b1b}.pw{margin-top:6px;font-size:13px;border-top:1px dashed #ddd;padding-top:6px}
details{font-size:12px}pre{white-space:pre-wrap;background:#fafaf9;padding:6px;font-size:12px}@media(max-width:900px){.sides{grid-template-columns:1fr}}
</style></head><body><header><h1>${esc(TITLE)}</h1><div class="stats"><span>items <b>${total.n}</b></span><span>agent wins <b>${total.wins}</b></span><span>MCP wins <b>${total.losses}</b></span><span>ties <b>${total.ties}</b></span><span>win rate <b>${winRate(total)}</b></span><span>pass agent <b>${total.agent_pass}</b> vs MCP <b>${total.mcp_pass}</b></span><span>mean agent <b>${total.agent_mean}</b> vs MCP <b>${total.mcp_mean}</b></span><span>credits agent <b>${total.agent_credits}</b> vs MCP <b>${total.mcp_credits}</b></span><span>questions agent <b>${total.agent_questions}</b> vs MCP <b>${total.mcp_questions}</b> (+${total.mcp_approvals} approvals)</span></div>
<div class="filters"><button class="on" data-f="all">all</button><button data-f="w-agent">agent wins</button><button data-f="w-mcp">MCP wins</button><button data-f="w-tie">ties</button>${Object.keys(groups).map((g) => `<button data-f="g${g}">${g}. ${esc(NAMES[g] || g)}</button>`).join("")}</div></header>
<table><tr><th>Group</th><th>Items</th><th>Agent pass</th><th>MCP pass</th><th>Agent mean</th><th>MCP mean</th><th>Agent wins</th><th>MCP wins</th><th>Ties</th><th>Win rate</th><th>Agent credits</th><th>MCP credits</th><th>Agent questions</th><th>MCP questions</th><th>MCP approvals</th></tr>
${Object.entries(groups).map(([g, x]) => `<tr><td>${g}. ${esc(NAMES[g] || g)}</td><td>${x.n}</td><td>${x.agent_pass}</td><td>${x.mcp_pass}</td><td>${x.agent_mean}</td><td>${x.mcp_mean}</td><td>${x.wins}</td><td>${x.losses}</td><td>${x.ties}</td><td>${winRate(x)}</td><td>${x.agent_credits}</td><td>${x.mcp_credits}</td><td>${x.agent_questions}</td><td>${x.mcp_questions}</td><td>${x.mcp_approvals}</td></tr>`).join("")}</table>
${rows.map(row).join("\n")}
<script>document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("on"));b.classList.add("on");const f=b.dataset.f;document.querySelectorAll(".item").forEach(it=>it.classList.toggle("hidden",f!=="all"&&!it.classList.contains(f)))});</script></body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`\nagent ${total.wins} · mcp ${total.losses} · ties ${total.ties} · win rate ${winRate(total)} · pass ${total.agent_pass} vs ${total.mcp_pass} · mean ${total.agent_mean} vs ${total.mcp_mean} · credits ${total.agent_credits} vs ${total.mcp_credits}\n→ ${OUT}/compare.md, index.html (serve: node V2/bench/v1/serve.mjs → http://localhost:4748/${basename(OUT)}/)`);
