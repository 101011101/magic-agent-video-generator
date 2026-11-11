// The report: every bench case with the agent's transcript, sheet, plan and tree beside the hand-made baseline, and the
// differences called out. One self-contained HTML page (no doctype; the Artifact tool wraps it), placeholders inlined.
// Usage: node V2/bench/report.js [--results V2/bench/results/report] [--out <file.html>] [--real <dir with real outputs>]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RES = arg("--results", join(HERE, "results", "report")), OUT = arg("--out", join(RES, "report.html"));
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const DAG = readFileSync(join(HERE, "..", "frontend", "dag.js"), "utf8");
const DAG_CSS = (DAG.match(/const DAG_CSS = `([\s\S]*?)`;/) || [])[1] || "";

const results = readdirSync(RES).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(RES, f), "utf8")));
const baseline = Object.fromEntries(readdirSync(join(HERE, "baseline")).filter((f) => f.endsWith(".json")).map((f) => { const b = JSON.parse(readFileSync(join(HERE, "baseline", f), "utf8")); return [b.id, b]; }));
const GROUPS = [["extraction", "Conversation: what the agent reads, infers and asks"], ["source", "Conversation: researched, from the user, or invented"], ["tools", "Micro tasks: one tool, or a short chain"], ["composed", "Working trees: sub-elements, composes, variants, and the film chain"]];

// a placeholder SVG inlined as a data URI, small
const inline = (rel) => { const f = join(RES, rel); if (!existsSync(f)) return null; const s = readFileSync(f, "utf8"); return `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`; };

function compare(r, b) {
  const out = [];
  if (!b) return [{ k: "baseline", v: "none written" }];
  const asked = r.rounds.flatMap((x) => x.questions.map((q) => q.field)), tools = (r.plan?.steps || []).map((s) => s.tool);
  const same = (a, c) => JSON.stringify(a) === JSON.stringify(c);
  out.push({ k: "questions", ok: same(asked, b.questions), v: `agent asked ${asked.length ? asked.join(", ") : "nothing"} · Claude would ask ${b.questions.length ? b.questions.join(", ") : "nothing"}` });
  out.push({ k: "shape", ok: (r.plan?.shape || "none") === b.shape || (!r.plan && b.tools.length === 0), v: `agent ${r.plan?.shape || "no plan"} · Claude ${b.shape}` });
  const tt = tools.filter((t) => t !== "search" && t !== "gate"), bt = b.tools.filter((t) => t !== "search");
  out.push({ k: "tools", ok: same(tt, bt), v: `agent ${tt.length ? tt.join(" → ") : "none"} · Claude ${bt.length ? bt.join(" → ") : "none"}` });
  if (r.plan?.refuse) out.push({ k: "refused", ok: b.tools.length === 0, v: r.plan.refuse });
  return out;
}

const sections = GROUPS.map(([g, title]) => {
  const rs = results.filter((r) => r.group === g).sort((a, b) => a.id.localeCompare(b.id)); if (!rs.length) return "";
  const cards = rs.map((r, k) => {
    const b = baseline[r.id]; const cmp = compare(r, b); const agree = cmp.filter((c) => c.ok).length, total = cmp.filter((c) => c.ok !== undefined).length;
    const asked = r.rounds.flatMap((x) => x.questions.map((q) => q.field));
    const steps = (r.plan?.steps || []).map((s) => ({ tool: s.tool, produces: s.produces, inputs: s.inputs, state: s.state, output: s.output ? inline(s.output) : null, why: s.why }));
    const sheet = r.sheet ? [["goal", r.sheet.goal.value, r.sheet.goal.source], ...r.sheet.fields.filter((f) => f.source !== "not_applicable" && f.value).map((f) => [f.field, f.value, f.source])] : [];
    return `<article class="case" id="${esc(r.id)}">
<header><h3>${esc(r.id)}</h3><span class="score ${agree === total ? "ok" : agree ? "mid" : "bad"}">${agree}/${total} agree with Claude</span><span class="mut">${r.plan ? `${r.plan.shape} · ${steps.length} node${steps.length === 1 ? "" : "s"} · ~${r.plan.estimate_credits} credits` : "no plan"}</span></header>
<p class="brief">${esc(r.brief)}${r.materials?.length ? ` <span class="mut">+ ${esc(r.materials.join(", "))}</span>` : ""}</p>
<div class="two">
  <div><div class="lbl">transcript</div><div class="chat">${r.messages.map((m) => `<div class="msg ${m.who}">${esc(m.text).replace(/\n/g, "<br>")}</div>`).join("")}${r.plan?.say ? `<div class="msg agent">${esc(r.plan.say)}</div>` : ""}</div></div>
  <div><div class="lbl">what it understood</div><div class="grid">${sheet.map(([f, v, s]) => `<span class="${s === "inferred" ? "inf" : s === "assumed" ? "asm" : ""}${asked.includes(f) ? " ask" : ""}"><em>${esc(f)}</em><b>${esc(v)}</b></span>`).join("")}</div>
  ${steps.length ? `<div class="lbl">working tree</div><div class="dagbox" data-k="${esc(r.id)}"></div>` : ""}</div>
</div>
<div class="cmp"><div class="lbl">against the baseline <span class="mut">(Claude, by hand, from the brief alone${b ? `: ${esc(b.why)}` : ""})</span></div>
<table>${cmp.map((c) => `<tr class="${c.ok === undefined ? "" : c.ok ? "ok" : "bad"}"><td>${c.ok === undefined ? "" : c.ok ? "same" : "differs"}</td><td>${esc(c.k)}</td><td>${esc(c.v)}</td></tr>`).join("")}</table></div>
<details><summary>checks (${r.checks.filter((c) => c.pass).length}/${r.checks.length})</summary><table>${r.checks.map((c) => `<tr class="${c.pass ? "ok" : "bad"}"><td>${c.pass ? "pass" : "fail"}</td><td>${esc(c.name)}</td><td class="mut">${esc(JSON.stringify(c.got))}</td></tr>`).join("")}</table></details>
<script type="application/json" class="steps" data-k="${esc(r.id)}">${JSON.stringify(steps).replace(/<\//g, "<\\/")}</script>
</article>`;
  }).join("\n");
  return `<section><h2>${esc(title)}</h2><p class="mut">${rs.length} cases</p>${cards}</section>`;
}).join("\n");

const totals = results.map((r) => { const c = compare(r, baseline[r.id]).filter((x) => x.ok !== undefined); return [c.filter((x) => x.ok).length, c.length]; }).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
const checks = results.flatMap((r) => r.checks); const real = arg("--real");
let realBlock = "";
if (real && existsSync(real)) {
  const pics = readdirSync(real).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => ({ f, b64: readFileSync(join(real, f)).toString("base64") }));
  realBlock = `<section><h2>One tree run for real</h2><p class="mut">The Instagram post on the free tier: the jet photo edited into a dawn hangar (5 credits), the headline by the text-overlay tool (0 credits, by code), two sizes (5 each). 15 Magic Hour credits.</p><div class="real">${pics.map((p) => `<figure><img src="data:image/${/png$/i.test(p.f) ? "png" : "jpeg"};base64,${p.b64}" alt=""><figcaption>${esc(p.f)}</figcaption></figure>`).join("")}</div></section>`;
}

const html = `<title>Agent Bench Report</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f6f8;--card:#fff;--fg:#1c1c1e;--mut:#7a7a80;--rule:#e3e3e8;--blue:#0a66d6;--ok:#2a9d4a;--bad:#c93b2f;--mid:#d08a0c;--grey:#eef0f3;--inf:#eaf2ff;--asm:#fff3df;--me:#0a66d6;--them:#eceef1;color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1012;--card:#1a1b1e;--fg:#ececf0;--mut:#9a9aa2;--rule:#2b2c31;--blue:#5aa0ff;--ok:#4fc46e;--bad:#f0706b;--mid:#f0b64a;--grey:#25262b;--inf:#17263d;--asm:#3b2b12;--me:#2f6fd6;--them:#26272c;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0f1012;--card:#1a1b1e;--fg:#ececf0;--mut:#9a9aa2;--rule:#2b2c31;--blue:#5aa0ff;--ok:#4fc46e;--bad:#f0706b;--mid:#f0b64a;--grey:#25262b;--inf:#17263d;--asm:#3b2b12;--me:#2f6fd6;--them:#26272c;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 80px}
*{box-sizing:border-box} .wrap{max-width:980px;margin:0 auto}
h1{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:0 0 6px} h2{font-size:16px;font-weight:600;margin:36px 0 2px;letter-spacing:-.01em} h3{font-size:14px;font-weight:600;margin:0} .mut{color:var(--mut)} .lead{max-width:70ch;color:var(--mut);margin:0 0 10px}
.tot{display:flex;gap:18px;flex-wrap:wrap;margin:14px 0 6px;font-size:13px} .tot b{font-size:20px;font-weight:700;display:block;font-variant-numeric:tabular-nums}
.case{background:var(--card);border-radius:16px;corner-shape:squircle;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 18px rgba(0,0,0,.05);padding:14px 16px;margin:12px 0;display:flex;flex-direction:column;gap:10px}
.case header{display:flex;align-items:center;gap:10px;flex-wrap:wrap} .score{font-size:11.5px;font-weight:600;border-radius:999px;padding:3px 9px;background:var(--grey)} .score.ok{color:var(--ok)} .score.mid{color:var(--mid)} .score.bad{color:var(--bad)}
.brief{margin:0;font-size:14.5px} .two{display:grid;grid-template-columns:1fr 1fr;gap:14px} .two>div{min-width:0} @media(max-width:700px){.two{grid-template-columns:1fr}}
.lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:4px 0}
.chat{display:flex;flex-direction:column;gap:6px} .msg{max-width:88%;padding:7px 11px;border-radius:15px;line-height:1.4;font-size:13.5px;white-space:pre-wrap} .msg.user{align-self:flex-end;background:var(--me);color:#fff;border-bottom-right-radius:4px} .msg.agent{align-self:flex-start;background:var(--them);border-bottom-left-radius:4px}
.grid{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px} .grid span{display:inline-flex;gap:5px;align-items:baseline;white-space:nowrap} .grid em{font-style:normal;color:var(--mut);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em} .grid b{font-weight:500} .grid .inf b{background:var(--inf);border-radius:4px;padding:0 4px} .grid .asm b{background:var(--asm);border-radius:4px;padding:0 4px} .grid .ask b{outline:1.5px solid var(--mid);border-radius:4px;padding:0 4px}
table{border-collapse:collapse;width:100%;font-size:13px} td{padding:4px 8px 4px 0;vertical-align:top;border-top:1px solid var(--rule)} td:first-child{white-space:nowrap;font-weight:600;width:60px} tr.ok td:first-child{color:var(--ok)} tr.bad td:first-child{color:var(--bad)}
details{font-size:12.5px;color:var(--mut)} summary{cursor:pointer}
.real{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px} .real figure{margin:0} .real img{width:100%;border-radius:12px;display:block} .real figcaption{font-size:11.5px;color:var(--mut);margin-top:4px}
${DAG_CSS}
.dag-node{width:96px;font-size:10px} .dag-cols{gap:34px}
</style>
<div class="wrap">
<h1>Agent Bench Report</h1>
<p class="lead">Every case runs through the agent dry: the sheet and the plan are real model calls, the tool calls are simulated (placeholders in the nodes). A proxy user answers the agent's questions from the case's answer sheet. Beside each result is the baseline: what Claude would ask and call, written by hand from the brief alone, before looking.</p>
<div class="tot"><span><b>${results.length}</b>cases</span><span><b>${totals[0]}/${totals[1]}</b>baseline agreements</span><span><b>${checks.filter((c) => c.pass).length}/${checks.length}</b>expectation checks</span><span><b>${results.filter((r) => r.plan?.shape === "film").length}</b>film chains</span><span><b>${results.filter((r) => r.plan?.shape === "tree").length}</b>working trees</span></div>
<p class="mut">yellow outline = asked; blue = inferred; amber = assumed. In a tree: dashed = supplied by the user, green = made (simulated).</p>
${realBlock}
${sections}
</div>
<script>${DAG.replace(/if \(typeof module[^\n]*\n?/, "")}</script>
<script>
document.querySelectorAll(".dagbox").forEach((box) => { const data = JSON.parse(document.querySelector('script.steps[data-k="' + CSS.escape(box.dataset.k) + '"]').textContent); drawDag(box, data, { media: (s) => s.output || null }); });
</script>`;
writeFileSync(OUT, html); console.log(`report → ${OUT} (${(html.length / 1024).toFixed(0)} KB, ${results.length} cases)`);
