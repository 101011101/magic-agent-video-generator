// The RUN-001 result page: a variable table that describes itself — every arm states what was held and what changed, so
// the table can be read without the ticket. House palette, matching current/tests/compare/index.html.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const verdict = (p) => (p === true ? '<span class="ok">PASS</span>' : p === false ? '<span class="bad">FAIL</span>' : '<span class="soft">not scored</span>');

export function renderPage(log) {
  const arms = log.arms || [];
  const groups = [...new Set(arms.map((a) => a.kind))];
  const held = Object.entries(log.hold || {}).map(([k, v]) => `${k} = ${v}`).join(" · ");

  const table = (kind) => {
    const rows = arms.filter((a) => a.kind === kind);
    if (!rows.length) return "";
    const g = rows[0];
    return `<h3>${esc(g.test)} — ${esc(kind)}</h3>
<p class="soft">Held constant: ${esc(held)}; prompt (identical in every row below): &ldquo;${esc(g.prompt)}&rdquo;${kind === "edit" ? "; source frame: identical bytes in every row" : ""}<br>Changed: <b>model only</b>. Pass when ${esc(g.criterion)}.</p>
<div class="wrap"><table>
<tr><th>model</th><th>est.</th><th>charged</th><th>s</th><th>verdict</th><th>observed</th><th>problem</th></tr>
${rows.map((a) => `<tr><td><code>${esc(a.model)}</code></td><td class="num">${a.estimate}</td><td class="num">${a.credits ?? "&mdash;"}</td><td class="num">${a.seconds ?? "&mdash;"}</td><td>${verdict(a.result?.pass)}</td><td>${esc(a.result?.observed ?? a.result?.error ?? "")}</td><td>${esc(a.result?.problem ?? "")}</td></tr>`).join("\n")}
</table></div>
<div class="strip">${rows.filter((a) => a.file).map((a) => `<figure><img src="${esc(a.file)}" alt="${esc(a.model)}" loading="lazy"><figcaption>${esc(a.model)} · ${a.credits ?? a.estimate} cr</figcaption></figure>`).join("")}</div>`;
  };

  const scored = arms.filter((a) => a.result && a.result.pass != null);
  const cheapest = scored.filter((a) => a.result.pass).sort((a, b) => (a.credits ?? a.estimate) - (b.credits ?? b.estimate))[0];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RUN-001 image-model sweep</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--card:#fbf7ef;--ok:#4f7a3a;--bad:#a0402d}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1d1813;--ink:#efe4d2;--soft:#b39b80;--line:#4a3d30;--card:#28211a;--ok:#8fbf6f;--bad:#e07a62}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif}main{max-width:1280px;margin:0 auto;padding:32px 16px 80px}
h1,h2,h3{font-weight:normal}h2{font-size:24px;border-top:1px solid var(--line);padding-top:20px;margin-top:40px}.soft{color:var(--soft)}a{color:var(--ink)}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{font-weight:normal;color:var(--soft)}
.ok{color:var(--ok)}.bad{color:var(--bad)}ul{margin:6px 0;padding-left:18px}
code{font:13px/1.45 ui-monospace,Menlo,monospace;background:var(--card);border:1px solid var(--line);padding:1px 4px}
.wrap{overflow-x:auto}.num{text-align:right;font-variant-numeric:tabular-nums}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0}
.strip figure{margin:0}.strip img{width:100%;display:block;border:1px solid var(--line)}
.strip figcaption{color:var(--soft);font-size:13px;padding-top:4px}
.note{border-left:3px solid var(--bad);padding:2px 0 2px 12px;margin:14px 0}
.good{border-left:3px solid var(--ok);padding:2px 0 2px 12px;margin:14px 0}</style></head><body><main>

<h1>RUN-001 &middot; image-model cost sweep</h1>
<p class="soft">Both pipelines buy every image from <code>nano-banana-pro</code> at 150&ndash;200 credits. This asks whether a model costing 5&ndash;50 holds the three properties the pipelines keep failing on at full price. ${log.dry_run ? "<b>Dry run &mdash; nothing was generated.</b>" : `Run ${esc(log.started_at)}.`}</p>

<div class="note"><b>Resolution is 1k, not the 2k both pipelines run.</b> 1k is the only resolution all six generator models share &mdash; <code>krea-2</code> tops out at 1k, <code>nano-banana-pro</code> starts at it. Holding resolution constant matters more than matching production, but it makes the <code>nano-banana-pro</code> row a 1k proxy for a 2k pipeline. A cheap winner needs confirming at 2k before it replaces anything, and <code>krea-2</code> never can.</div>

<h2>Spend</h2>
<div class="wrap"><table>
<tr><th>arms</th><th>estimated</th><th>charged</th><th>cap</th><th>ledger after</th></tr>
<tr><td class="num">${arms.length}</td><td class="num">${log.estimated_total}</td><td class="num">${log.charged_total ?? "&mdash;"}</td><td class="num">${log.cap}</td><td class="num">${log.ledger_after ?? "&mdash;"}</td></tr>
</table></div>
${cheapest ? `<div class="good"><b>Cheapest passing arm:</b> <code>${esc(cheapest.model)}</code> at ${cheapest.credits ?? cheapest.estimate} credits on ${esc(cheapest.kind)} &mdash; against <code>nano-banana-pro</code> at ${arms.find((a) => a.model === "nano-banana-pro" && a.kind === cheapest.kind)?.credits ?? 150}.</div>` : ""}

<h2>Arms</h2>
${groups.map(table).join("\n")}

<h2>How to read this</h2>
<ul>
<li>Within a group every row shares the prompt, aspect, resolution and image count. The only difference between rows is the model, so a difference in verdict is a difference between models.</li>
<li><b>est.</b> is the spec's &ldquo;from N credits/image&rdquo; floor; <b>charged</b> is what Magic Hour actually billed. They differ: the ledger shows <code>nano-banana-pro</code> billing 200 at 2k against a documented 150.</li>
<li>A <span class="soft">not scored</span> verdict means the frame exists but the vision judge did not run or failed &mdash; the credits were still spent. It is not a pass.</li>
</ul>
<p class="soft"><a href="../../compare/index.html">&larr; Pipeline A vs B</a> &middot; ticket <code>current/tickets/06-runs/RUN-001-image-model-cost-sweep.md</code></p>
</main></body></html>`;
}
