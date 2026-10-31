// The benchmark page: the data and almost nothing else. Per case: the brief, the transcript as bubbles, the sheet,
// the plan as a tree with arrows (placeholders in the nodes when simulated), the tools table, the checks.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const DAG = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "ui", "dag.js"), "utf8");

export function page(results, { tier, stamp }) {
  const total = results.flatMap((r) => r.checks || []), ok = total.filter((x) => x.pass).length;
  const rows = results.map((r, k) => {
    const asked = r.rounds.flatMap((x) => x.questions.map((q) => q.field));
    const sheet = r.sheet ? [[`goal`, r.sheet.goal.value, r.sheet.goal.source, r.sheet.goal.confidence, r.sheet.goal.quote], ...r.sheet.fields.filter((f) => f.source !== "not_applicable").map((f) => [f.field, f.value, f.source, f.confidence, f.quote])] : [];
    const steps = r.plan?.steps || [];
    return `<section>
<h2>${esc(r.id)} <small>${esc(r.group)}${r.plan?.shape ? ` · ${esc(r.plan.shape)}` : ""}${r.error ? " · error" : ""}</small></h2>
<p class="brief">${esc(r.brief)}${r.materials?.length ? ` <small>+ ${esc(r.materials.join(", "))}</small>` : ""}</p>
${r.error ? `<p class="bad">${esc(r.error)}</p>` : ""}
<div class="cols">
<div><h3>transcript</h3><div class="chat">${r.messages.map((m) => `<div class="msg ${m.who}">${esc(m.text).replace(/\n/g, "<br>")}</div>`).join("")}${r.messages.length === 1 ? `<div class="msg agent mut">no questions</div>` : ""}${r.plan?.say ? `<div class="msg agent">${esc(r.plan.say)}</div>` : ""}</div></div>
<div><h3>sheet</h3><table>${sheet.map(([f, v, s, c, q]) => `<tr class="${asked.includes(f) ? "asked" : s}"><td>${esc(f)}</td><td>${esc(v) || "—"}</td><td class="mut">${esc(s)}${s === "inferred" ? ` ${Number(c).toFixed(2)}` : ""}${asked.includes(f) ? " · asked" : ""}</td><td class="q">${q ? `“${esc(q)}”` : ""}</td></tr>`).join("")}</table></div>
</div>
<h3>working tree${steps.length ? ` <small>${steps.length} node${steps.length === 1 ? "" : "s"} · ~${r.plan.estimate_credits} cr${r.plan.tier_move ? ` · beyond free: ${esc(r.plan.tier_move.why)}` : ""}${r.plan.refuse ? ` · <span class="bad">refuse: ${esc(r.plan.refuse)}</span>` : ""}</small>` : ""}</h3>
${steps.length ? `<div class="dagbox" data-k="${k}"></div><p class="mut">${esc(r.plan.current_state)} → ${esc(r.plan.desired_state)}</p>
<table>${steps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.group)}</td><td><b>${esc(s.tool)}</b></td><td>${esc(s.model)}${s.resolution ? ` ${esc(s.resolution)}` : ""}</td><td>${esc(s.inputs.join(", "))} → ${esc(s.produces)}</td><td>${esc(s.params.prompt_or_change)}${s.params.seconds ? ` · ${s.params.seconds} s` : ""}${s.params.aspect ? ` · ${esc(s.params.aspect)}` : ""}${s.params.extra ? ` · ${esc(s.params.extra)}` : ""}</td><td class="num">${s.credits}</td></tr>`).join("")}</table>` : `<p class="mut">${r.unresolved ? "unresolved after 3 rounds" : "none"}</p>`}
<h3>checks</h3><table>${(r.checks || []).map((c) => `<tr class="${c.pass ? "ok" : "bad"}"><td>${c.pass ? "pass" : "fail"}</td><td>${esc(c.name)}</td><td class="mut">${esc(JSON.stringify(c.got))}</td></tr>`).join("")}</table>
</section>`;
  }).join("\n");
  const data = results.map((r) => (r.plan?.steps || []).map((s) => ({ tool: s.tool, produces: s.produces, inputs: s.inputs, state: s.state, output: s.output || null, why: s.why })));
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>bench ${esc(stamp)}</title>
<style>
:root{--bg:#fff;--fg:#111;--mut:#777;--rule:#e4e4e4;--ok:#1a7f37;--bad:#b42318;--ask:#fff6d6;--inf:#f3f7ff;--me:#1f6feb;--mefg:#fff;--them:#f0f0f2;--grey:#f0f0f2;--blue:#1f6feb;--warn:#ff9f0a}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121416;--fg:#e8e8e8;--mut:#9a9a9a;--rule:#2a2d31;--ok:#4cc26b;--bad:#f0706b;--ask:#3a3217;--inf:#1b2330;--me:#2f6fd6;--mefg:#fff;--them:#24282d;--grey:#24282d;--blue:#4c8dff;color-scheme:dark}}
:root[data-theme=dark]{--bg:#121416;--fg:#e8e8e8;--mut:#9a9a9a;--rule:#2a2d31;--ok:#4cc26b;--bad:#f0706b;--ask:#3a3217;--inf:#1b2330;--me:#2f6fd6;--mefg:#fff;--them:#24282d;--grey:#24282d;--blue:#4c8dff;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-right,0px)) 64px max(16px,env(safe-area-inset-left,0px));max-width:1100px;margin:0 auto}
h1{font-size:16px;font-weight:600;margin:0 0 4px} h2{font-size:15px;font-weight:600;margin:0 0 4px} h3{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:14px 0 4px}
small,.mut{color:var(--mut);font-weight:400;text-transform:none;letter-spacing:0} section{border-top:1px solid var(--rule);padding:20px 0}
.brief{margin:0;font-size:15px} .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px} @media(max-width:720px){.cols{grid-template-columns:1fr}}
.cols>div{min-width:0} table{border-collapse:collapse;width:100%} td{padding:3px 8px 3px 0;vertical-align:top;border-top:1px solid var(--rule)} td:first-child{white-space:nowrap} .num{text-align:right;font-variant-numeric:tabular-nums}
tr.asked td{background:var(--ask)} tr.inferred td{background:var(--inf)} .q{color:var(--mut);font-style:italic}
.chat{display:flex;flex-direction:column;gap:8px} .msg{max-width:82%;padding:8px 12px;border-radius:16px;line-height:1.4}
.msg.user{align-self:flex-end;background:var(--me);color:var(--mefg);border-bottom-right-radius:4px} .msg.agent{align-self:flex-start;background:var(--them);border-bottom-left-radius:4px}
tr.ok td:first-child{color:var(--ok)} tr.bad td:first-child,.bad{color:var(--bad)}
${DAG_CSS_FROM_FILE()}
</style>
<h1>bench · ${esc(stamp)} · tier ${esc(tier)} · ${ok}/${total.length} checks</h1>
<p class="mut">dry: no tool called${results.some((r) => r.plan?.steps?.some((s) => s.simulated)) ? "; outputs are simulated placeholders" : ""}. yellow = asked, blue = inferred. the tree: dashed = supplied, green = made.</p>
${rows}
<script>${DAG.replace(/if \(typeof module[^\n]*\n?/, "")}</script>
<script>
const DATA = ${JSON.stringify(data)};
document.querySelectorAll(".dagbox").forEach((box) => { const steps = DATA[Number(box.dataset.k)]; drawDag(box, steps, { media: (s) => s.output || null }); });
</script>`;
}
function DAG_CSS_FROM_FILE() { const m = DAG.match(/const DAG_CSS = `([\s\S]*?)`;/); return m ? m[1] : ""; }
