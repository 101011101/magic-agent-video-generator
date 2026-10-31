// The benchmark page: the data and almost nothing else. Per case: the brief, the transcript, the sheet, the plan,
// the checks. Minimal headings.
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function page(results, { tier, stamp }) {
  const total = results.flatMap((r) => r.checks || []), ok = total.filter((x) => x.pass).length;
  const rows = results.map((r) => {
    const asked = r.rounds.flatMap((x) => x.questions.map((q) => q.field));
    const sheet = r.sheet ? [[`goal`, r.sheet.goal.value, r.sheet.goal.source, r.sheet.goal.confidence, r.sheet.goal.quote], ...r.sheet.fields.filter((f) => f.source !== "not_applicable").map((f) => [f.field, f.value, f.source, f.confidence, f.quote])] : [];
    return `<section>
<h2>${esc(r.id)} <small>${esc(r.group)}${r.error ? " · error" : ""}</small></h2>
<p class="brief">${esc(r.brief)}${r.materials?.length ? ` <small>+ ${esc(r.materials.join(", "))}</small>` : ""}</p>
${r.error ? `<p class="bad">${esc(r.error)}</p>` : ""}
<div class="cols">
<div><h3>transcript</h3>${r.messages.length > 1 ? r.messages.slice(1).map((m) => `<p class="${m.who}"><b>${m.who}</b> ${esc(m.text).replace(/\n/g, "<br>")}</p>`).join("") : "<p class='mut'>no questions</p>"}</div>
<div><h3>sheet</h3><table>${sheet.map(([f, v, s, c, q]) => `<tr class="${asked.includes(f) ? "asked" : s}"><td>${esc(f)}</td><td>${esc(v) || "—"}</td><td class="mut">${esc(s)}${s === "inferred" ? ` ${Number(c).toFixed(2)}` : ""}${asked.includes(f) ? " · asked" : ""}</td><td class="q">${q ? `“${esc(q)}”` : ""}</td></tr>`).join("")}</table></div>
</div>
<h3>tools</h3>${r.plan ? `<p class="mut">${esc(r.plan.current_state)} → ${esc(r.plan.desired_state)}</p><table>${r.plan.steps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.group)}</td><td><b>${esc(s.tool)}</b></td><td>${esc(s.model)}${s.resolution ? ` ${esc(s.resolution)}` : ""}</td><td>${esc(s.inputs.join(", "))} → ${esc(s.produces)}</td><td>${esc(s.params.prompt_or_change)}${s.params.seconds ? ` · ${s.params.seconds} s` : ""}${s.params.aspect ? ` · ${esc(s.params.aspect)}` : ""}${s.params.extra ? ` · ${esc(s.params.extra)}` : ""}</td><td class="num">${s.credits}</td></tr>`).join("")}</table><p class="mut">estimate ${r.plan.estimate_credits} credits${r.plan.tier_move ? ` · beyond free: ${esc(r.plan.tier_move.why)}` : ""}${r.plan.refuse ? ` · <span class="bad">refuse: ${esc(r.plan.refuse)}</span>` : ""}${r.plan.questions_left?.length ? ` · still needs: ${esc(r.plan.questions_left.join("; "))}` : ""}</p>` : `<p class="mut">${r.unresolved ? "unresolved after 3 rounds" : "none"}</p>`}
<h3>checks</h3><table>${(r.checks || []).map((c) => `<tr class="${c.pass ? "ok" : "bad"}"><td>${c.pass ? "pass" : "fail"}</td><td>${esc(c.name)}</td><td class="mut">${esc(JSON.stringify(c.got))}</td></tr>`).join("")}</table>
</section>`;
  }).join("\n");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>bench ${esc(stamp)}</title>
<style>
:root{--bg:#fff;--fg:#111;--mut:#777;--rule:#e4e4e4;--ok:#1a7f37;--bad:#b42318;--ask:#fff6d6;--inf:#f3f7ff}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121416;--fg:#e8e8e8;--mut:#9a9a9a;--rule:#2a2d31;--ok:#4cc26b;--bad:#f0706b;--ask:#3a3217;--inf:#1b2330;color-scheme:dark}}
:root[data-theme=dark]{--bg:#121416;--fg:#e8e8e8;--mut:#9a9a9a;--rule:#2a2d31;--ok:#4cc26b;--bad:#f0706b;--ask:#3a3217;--inf:#1b2330;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,system-ui,sans-serif;margin:0;padding:24px max(16px,env(safe-area-inset-right,0px)) 64px max(16px,env(safe-area-inset-left,0px));max-width:1100px;margin:0 auto}
h1{font-size:16px;font-weight:600;margin:0 0 4px} h2{font-size:15px;font-weight:600;margin:0 0 4px} h3{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:14px 0 4px}
small,.mut{color:var(--mut);font-weight:400} section{border-top:1px solid var(--rule);padding:20px 0}
.brief{margin:0;font-size:15px} .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px} @media(max-width:720px){.cols{grid-template-columns:1fr}}
.cols>div{min-width:0} table{border-collapse:collapse;width:100%} td{padding:3px 8px 3px 0;vertical-align:top;border-top:1px solid var(--rule)} td:first-child{white-space:nowrap} .num{text-align:right;font-variant-numeric:tabular-nums}
tr.asked td{background:var(--ask)} tr.inferred td{background:var(--inf)} .q{color:var(--mut);font-style:italic} p.agent{margin:4px 0;padding-left:12px;border-left:2px solid var(--rule)} p.user{margin:4px 0 10px;padding-left:12px;border-left:2px solid var(--ok)}
tr.ok td:first-child{color:var(--ok)} tr.bad td:first-child,.bad{color:var(--bad)}
</style>
<h1>bench · ${esc(stamp)} · tier ${esc(tier)} · ${ok}/${total.length} checks</h1>
<p class="mut">dry: no tool called. yellow = asked, blue = inferred. quotes = the words that supported a stated value.</p>
${rows}`;
}
