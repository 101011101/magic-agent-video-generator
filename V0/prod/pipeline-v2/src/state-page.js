// Lineage page for a state store: one row per asset label, one card per instance, oldest first.
// Card: the frame, scene and role, stable or not, the pointer to its last stable instance (prev) and to the record it was built from (source).
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderState(store, title) {
  const lin = store.lineage();
  const rows = Object.entries(lin).map(([label, xs]) => {
    const a = store.assets[label];
    const stable = xs.filter((x) => x.stable).length;
    return `<h2>${esc(label)} <span class="soft">${esc(a.kind)} · ${stable}/${xs.length} stable</span></h2><p class="soft">${esc(a.look)}</p><div class="row">${xs.map((x) => `
      <div class="card ${x.stable ? "ok" : "bad"}"><img src="${esc(x.file)}" loading="lazy"><b>${x.record}</b> · scene ${x.scene} ${x.role}${x.rejected ? " (rejected)" : ""}<br>
      ${x.stable ? "✓ stable" : `✗ ${!x.present ? "missing" : x.same_as_prev === false ? "differs from prev" : "attribute mismatch"}`}<br>
      prev → ${x.prev || "none (first)"}${x.same_as_prev === null ? "" : x.same_as_prev ? " (same)" : " (different)"}<br>source → ${x.source || "text"}
      ${x.diffs?.length ? `<br><span class="soft">diffs: ${x.diffs.map(esc).join("; ")}</span>` : ""}
      ${Object.keys(x.observed || {}).length ? `<details><summary>attributes</summary>${Object.entries(x.observed).map(([k, v]) => `${k}: ${esc(v)} ${x.matches[k] ? "✓" : "✗"}${x.expected?.[k] ? ` <span class="soft">(want ${esc(x.expected[k])})</span>` : ""}`).join("<br>")}</details>` : ""}</div>`).join("")}</div>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Asset Lineage</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--ok:#4f7a3a;--bad:#a0402d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Georgia,serif}main{max-width:1200px;margin:0 auto;padding:32px 16px 80px}h1{font-weight:normal}h2{font-weight:normal;font-size:20px;border-top:1px solid var(--line);padding-top:16px;margin:28px 0 4px}.soft{color:var(--soft)}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}.card{flex:0 0 220px;background:#fbf7ef;border:1px solid var(--line);border-top:4px solid var(--ok);padding:8px;font-size:13px}.card.bad{border-top-color:var(--bad)}.card img{width:100%;display:block;margin-bottom:6px}details{margin-top:4px}</style></head><body><main>
<h1>${esc(title)} · asset lineage</h1><p class="soft">Each card is one instance of an asset in one frame. Stable = visible, invariant attributes match, and the pairwise check says it is the same asset as its last stable instance (prev). source = the record the frame was built from.</p>${rows}</main></body></html>`;
}
