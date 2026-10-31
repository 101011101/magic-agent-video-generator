// The live benchmark: scripted sessions played through the running server with the tools executing for REAL on the
// free tier; each turn scored on what was asked, which tools were chosen and what it cost; a self-contained page.
// Usage: node V2/bench/live.mjs [--only name,name] [--server http://localhost:4747] [--out V2/bench/results/live/<stamp>]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { proxyUser } from "../backend/agent/agent.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const U = arg("--server", "http://localhost:4747"), only = (arg("--only", "") || "").split(",").filter(Boolean);
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2"), OUT = arg("--out", join(HERE, "results", "live", stamp)); mkdirSync(OUT, { recursive: true });
const api = async (p, b) => { for (let k = 0; ; k++) { try { return await (await fetch(U + p, b ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) } : undefined)).json(); } catch (e) { if (k >= 2) throw e; console.log(`  (retrying ${p}: ${e.cause?.code || e.message})`); await new Promise((r) => setTimeout(r, 3000)); } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ledger = () => JSON.parse(readFileSync(join(V2, "runs", "ledger.json"), "utf8")).total;
const thumb = (file) => { if (!/\.(png|jpe?g|webp|mp4|mov)$/i.test(file)) return null; try { const out = join(OUT, "t-" + Math.random().toString(36).slice(2) + ".jpg"); if (/\.(mp4|mov)$/i.test(file)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "0.5", "-i", file, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "6", out]); else execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", "scale=360:-2", "-q:v", "6", out]); return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`; } catch { return null; } };

const ASSEMBLE = arg("--assemble"); 
const scripts = ASSEMBLE ? [] : readdirSync(join(HERE, "live")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(HERE, "live", f), "utf8"))).filter((s) => !only.length || only.includes(s.name));
const order = ["conversation-full", "conversation", "multi-turn", "tools", "trees", "film"]; scripts.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
const results = [];
for (const sc of scripts) {
  const sid = `live-${sc.name}`; const t0 = ledger(); console.log(`\n== ${sc.name} (${sc.mode}) · budget ${sc.budget}`);
  await api("/session/reset", { session: sid, mode: sc.mode });
  const turns = []; let lastSend = null, spentHere = 0, stop = false;
  for (const st of sc.steps) {
    if (stop) break;
    if (st.do === "import") { await api("/import", { session: sid, from: st.from, name: st.name }); continue; }
    if (st.do === "send") {
      let r = await api("/turn", { session: sid, text: st.text, materials: st.materials || [], tier: "free", mode: sc.mode });
      const rec = { text: st.text, materials: st.materials || [], agent: r.text, asked: (r.turn.questions || []).map((q) => q.field), answered: null, expect: st.expect || {}, plan: null, checks: [] };
      if (r.turn.questions && st.answer) { rec.answered = st.answer; r = await api("/turn", { session: sid, text: st.answer, materials: [], tier: "free", mode: sc.mode }); rec.agent2 = r.text; if (r.turn.questions) rec.stillAsking = (r.turn.questions || []).map((q) => q.field); }
      // a scripted user answers from the case's sheet, as many rounds as the agent needs (up to three)
      rec.dialog = []; rec.case = st.case || null;
      for (let k = 0; r.turn.questions && st.answer_sheet && k < 3; k++) { const reply = await proxyUser({ answerSheet: st.answer_sheet, questions: r.turn.questions, brief: st.text }); rec.dialog.push({ asked: r.turn.questions.map((q) => q.field), agent: r.text, user: reply }); r = await api("/turn", { session: sid, text: reply, materials: [], tier: "free", mode: sc.mode }); rec.agentFinal = r.text; }
      if (r.turn.questions) rec.stillAsking = r.turn.questions.map((q) => q.field);
      rec.turnIndex = r.turnIndex; rec.plan = r.turn.plan ? { shape: r.turn.plan.shape, steps: r.turn.plan.steps.map((s) => ({ tool: s.tool, inputs: s.inputs, produces: s.produces, credits: s.credits })), estimate: r.turn.plan.estimate_credits } : null;
      lastSend = rec; turns.push(rec); console.log(`  ${st.text.slice(0, 60)} → ${rec.asked.length ? `asked ${rec.asked.join(",")}; ` : ""}${rec.plan ? rec.plan.steps.map((s) => s.tool).join(" → ") + ` (~${rec.plan.estimate})` : "no plan"}`);
      continue;
    }
    if (st.do === "run" && lastSend?.plan) {
      const est = lastSend.plan.estimate || 0; if (spentHere + est > sc.budget) { lastSend.skipped = `over budget (${spentHere} + ~${est} > ${sc.budget})`; console.log(`  skipped: ${lastSend.skipped}`); continue; }
      const before = ledger(); await api(`/session/${sid}/execute`, { turn: lastSend.turnIndex });
      for (let i = 0; i < 400; i++) { await sleep(3000); const run = await api("/running"); if (!run[sid]) break; }
      const S = await api(`/session/${sid}`); const t = S.turns[lastSend.turnIndex];
      lastSend.ran = t.plan.steps.map((s) => ({ tool: s.tool, state: s.state, output: s.output, credits: s.credits_spent, note: s.note, error: s.error, thumb: s.output && !s.output.startsWith("../../") ? thumb(join(V2, "sessions", sid, s.output)) : null, page: s.page }));
      lastSend.spent = ledger() - before; spentHere += lastSend.spent; writeFileSync(join(OUT, `${sc.name}.json`), JSON.stringify({ ...sc, session: sid, turns, spent: ledger() - t0 }, null, 2)); console.log(`  ran: ${lastSend.ran.map((s) => `${s.tool}:${s.state}`).join(", ")} · ${lastSend.spent} credits`);
      if (lastSend.ran.some((s) => s.state === "failed")) console.log(`  failed: ${lastSend.ran.filter((s) => s.state === "failed").map((s) => s.error).join(" | ")}`);
    }
  }
  // scoring
  for (const rec of turns) {
    const e = rec.expect, tools = rec.plan ? rec.plan.steps.map((s) => s.tool) : []; const add = (name, pass, got) => rec.checks.push({ name, pass: !!pass, got });
    if (e.asks != null) add(e.asks ? "asks first" : "asks nothing", e.asks ? rec.asked.length > 0 : rec.asked.length === 0, rec.asked);
    if (e.tools) add("tools " + e.tools.join(" → "), JSON.stringify(tools) === JSON.stringify(e.tools), tools);
    if (e.tools_any) add("tools one of " + e.tools_any.map((a) => a.join("→")).join(" | "), e.tools_any.some((a) => JSON.stringify(a) === JSON.stringify(tools)), tools);
    if (e.shape) add("shape " + e.shape, rec.plan?.shape === e.shape, rec.plan?.shape);
    if (e.credits_max != null && rec.spent != null) add(`spent ≤ ${e.credits_max}`, rec.spent <= e.credits_max, rec.spent);
    if (rec.ran) add("every node made", rec.ran.every((s) => s.state === "done" || s.state === "flagged"), rec.ran.map((s) => s.state));
    if (e.refers === "last" && rec.plan) { const prev = turns[turns.indexOf(rec) - 1]; add("takes the previous output", !!prev?.plan && rec.plan.steps.some((s) => s.inputs.includes(prev.plan.steps.at(-1).produces)), rec.plan.steps.map((s) => s.inputs)); }
    if (e.refers === "first" && rec.plan) { const first = turns.find((t) => t.plan); add("takes the first output", rec.plan.steps.some((s) => s.inputs.includes(first.plan.steps.at(-1).produces)), rec.plan.steps.map((s) => s.inputs)); }
  }
  const spent = ledger() - t0; results.push({ ...sc, session: sid, turns, spent }); console.log(`  == ${sc.name}: ${spent} credits, ${turns.flatMap((t) => t.checks).filter((c) => c.pass).length}/${turns.flatMap((t) => t.checks).length} checks`);
  writeFileSync(join(OUT, `${sc.name}.json`), JSON.stringify(results.at(-1), null, 2));
}
// the page (from this run, or from every JSON in --assemble <dir>)
if (ASSEMBLE) { for (const f of readdirSync(ASSEMBLE).filter((x) => x.endsWith(".json"))) results.push(JSON.parse(readFileSync(join(ASSEMBLE, f), "utf8"))); const ord = ["conversation", "multi-turn", "tools", "trees", "film"]; results.sort((a, b) => ord.indexOf(a.name) - ord.indexOf(b.name)); }
const PAGE_DIR = ASSEMBLE || OUT;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const total = results.reduce((a, r) => a + r.spent, 0), checks = results.flatMap((r) => r.turns.flatMap((t) => t.checks));
const html = `<title>Live Bench</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f6f8;--card:#fff;--fg:#1c1c1e;--mut:#7a7a80;--rule:#e3e3e8;--blue:#0a66d6;--ok:#2a9d4a;--bad:#c93b2f;--grey:#eef0f3;--me:#0a66d6;--them:#eceef1;color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1012;--card:#1a1b1e;--fg:#ececf0;--mut:#9a9aa2;--rule:#2b2c31;--blue:#5aa0ff;--ok:#4fc46e;--bad:#f0706b;--grey:#25262b;--me:#2f6fd6;--them:#26272c;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0f1012;--card:#1a1b1e;--fg:#ececf0;--mut:#9a9aa2;--rule:#2b2c31;--blue:#5aa0ff;--ok:#4fc46e;--bad:#f0706b;--grey:#25262b;--me:#2f6fd6;--them:#26272c;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 80px}
*{box-sizing:border-box} .wrap{max-width:940px;margin:0 auto} h1{font-size:22px;font-weight:700;margin:0 0 6px;letter-spacing:-.01em} h2{font-size:16px;font-weight:600;margin:34px 0 4px} .mut{color:var(--mut)} .lead{max-width:70ch;color:var(--mut);margin:0 0 10px}
.tot{display:flex;gap:18px;flex-wrap:wrap;margin:14px 0 6px;font-size:13px} .tot b{font-size:20px;font-weight:700;display:block;font-variant-numeric:tabular-nums}
.turn{background:var(--card);border-radius:16px;corner-shape:squircle;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 18px rgba(0,0,0,.05);padding:12px 14px;margin:10px 0;display:flex;flex-direction:column;gap:8px}
.chat{display:flex;flex-direction:column;gap:6px} .msg{max-width:88%;padding:7px 11px;border-radius:15px;line-height:1.4;font-size:13.5px;white-space:pre-wrap} .msg.user{align-self:flex-end;background:var(--me);color:#fff;border-bottom-right-radius:4px} .msg.agent{align-self:flex-start;background:var(--them);border-bottom-left-radius:4px}
.nodes{display:flex;gap:8px;flex-wrap:wrap} .node{width:150px;border:1.5px solid var(--rule);border-radius:12px;corner-shape:squircle;padding:6px;font-size:11.5px;display:flex;flex-direction:column;gap:4px} .node[data-s=done]{border-color:var(--ok)} .node[data-s=flagged]{border-color:#d08a0c} .node[data-s=failed]{border-color:var(--bad)} .node img{width:100%;border-radius:8px;display:block;background:#000} .node b{font-weight:600} .node small{color:var(--mut);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chk{display:flex;flex-wrap:wrap;gap:6px;font-size:11.5px} .chk span{border-radius:999px;padding:2px 9px;background:var(--grey)} .chk .ok{color:var(--ok)} .chk .bad{color:var(--bad)}
.hd{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--mut)} .hd b{color:var(--fg)}
</style>
<div class="wrap">
<h1>Live Bench</h1>
<p class="lead">Scripted sessions played through the agent with every tool executing for real on the free tier. Each turn shows the request, the agent's words, the questions it asked and the answer given, the nodes it ran with their outputs, what it cost at Magic Hour, and the checks.</p>
<div class="tot"><span><b>${results.length}</b>sessions</span><span><b>${results.reduce((a, r) => a + r.turns.length, 0)}</b>turns</span><span><b>${total}</b>Magic Hour credits</span><span><b>${checks.filter((c) => c.pass).length}/${checks.length}</b>checks</span></div>
${results.map((r) => `<section><h2>${esc(r.name)} <span class="mut">· ${esc(r.what)} · ${r.spent} credits</span></h2>
${r.turns.map((t) => `<div class="turn">
<div class="chat"><div class="msg user">${esc(t.text)}${t.materials.length ? ` <span style="opacity:.7">+ ${esc(t.materials.join(", "))}</span>` : ""}</div><div class="msg agent">${esc(t.agent)}</div>${t.answered ? `<div class="msg user">${esc(t.answered)}</div><div class="msg agent">${esc(t.agent2 || "")}</div>` : ""}</div>
<div class="hd">${t.plan ? `<b>${esc(t.plan.shape)}</b> · ${t.plan.steps.map((s) => esc(s.tool)).join(" → ")} · ~${t.plan.estimate} est${t.spent != null ? ` · <b>${t.spent} spent</b>` : ""}` : "no plan"}${t.skipped ? ` · <span style="color:var(--bad)">${esc(t.skipped)}</span>` : ""}</div>
${t.ran ? `<div class="nodes">${t.ran.map((s) => `<div class="node" data-s="${esc(s.state)}">${s.thumb ? `<img src="${s.thumb}" alt="">` : ""}<b>${esc(s.tool)}</b><small>${esc(s.state)}${s.credits != null ? ` · ${s.credits} cr` : ""}</small>${s.note || s.error ? `<small title="${esc(s.note || s.error)}">${esc((s.note || s.error).slice(0, 70))}</small>` : ""}${s.page ? `<small>${esc(s.page)}</small>` : ""}</div>`).join("")}</div>` : ""}
<div class="chk">${t.checks.map((c) => `<span class="${c.pass ? "ok" : "bad"}" title="${esc(JSON.stringify(c.got))}">${c.pass ? "✓" : "✗"} ${esc(c.name)}</span>`).join("")}</div>
</div>`).join("")}</section>`).join("")}
</div>`;
writeFileSync(join(PAGE_DIR, "index.html"), html); console.log(`\n${total} credits · ${checks.filter((c) => c.pass).length}/${checks.length} checks · ${PAGE_DIR}/index.html`);
