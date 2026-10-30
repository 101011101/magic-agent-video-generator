// Review page for a run's asset bank and seed plates (works mid-run): every sheet with all its tries and checks, every plate
// try with the plate-check lines from the log. Usage: node cleaned/experiments/review.mjs custom-rrh3
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const name = process.argv[2], dir = join(RUNS, name), log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const text = ["-seed.log", "-assets.log", ".log"].map((s) => join(RUNS, name + s)).filter(existsSync).map((f) => readFileSync(f, "utf8")).join("\n");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const roots = readdirSync(join(dir, "roots"));
const tries = (id) => roots.filter((f) => f === `${id}.png` || f.startsWith(`${id}-t`)).sort().map((f) => `roots/${f}`);
const lines = (re) => text.split("\n").filter((l) => re.test(l)).map((l) => l.trim());
const specs = Object.fromEntries((log.asset_specs || []).map((a) => [a.id, a]));
const assets = log.assets || {};
const sheet = (a) => {
  const canon = assets[a.id]?.file, ok = assets[a.id]?.ok;
  return `<section><h3>${esc(a.name)} <small>${esc(a.kind)} · ${ok === undefined ? "in progress" : ok ? '<b class="ok">checks pass</b>' : '<b class="bad">checks fail</b>'}</small></h3>
  <p class="meta">${esc(a.spec)}${a.height ? ` <b>Height:</b> ${esc(a.height)}` : ""}</p>
  <div class="row">${tries(a.id).map((f) => `<figure class="${f === canon ? "canon" : ""}"><img src="${esc(f)}" alt=""><figcaption>${f === canon ? "<b>canonical</b> · " : ""}${esc(f.split("/")[1])}</figcaption></figure>`).join("")}</div>
  <ul class="meta">${lines(new RegExp(`sheet ${a.id}( \\(kept\\))? try`)).slice(-6).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>`;
};
const plates = (log.world?.locations || []).map((l) => {
  const seed = log.seed?.[l.id];
  return `<section><h3>${esc(l.name)} <small>${seed ? `canonical: ${esc(seed.plate)}${seed.unresolved?.length ? ` · <b class="bad">still off: ${esc(seed.unresolved.join(", "))}</b>` : ' · <b class="ok">key marks match</b>'}` : "in progress"}</small></h3>
  <div class="row">${tries(l.id).map((f) => `<figure class="wide ${f === seed?.plate ? "canon" : ""}"><img src="${esc(f)}" alt=""><figcaption>${f === seed?.plate ? "<b>canonical</b> · " : ""}${esc(f.split("/")[1])}</figcaption></figure>`).join("")}</div>
  <ul class="meta">${lines(new RegExp(`plate ${l.id} try`)).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
  ${log.seed_plan ? `<details><summary>ground plan</summary><table>${log.seed_plan.places.find((p) => p.id === l.id).marks.map((m) => `<tr><td>${esc(m.id)}${m.key ? " ★" : ""}</td><td>${esc(m.where)}</td></tr>`).join("")}</table></details>` : ""}</section>`;
}).join("");
writeFileSync(join(dir, "review.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(log.world?.title)} review</title>
<style>:root{--bg:#fafaf8;--fg:#1b1b1b;--mut:#6b6b6b;--line:#e2e2dc;--ok:#1f7a3a;--bad:#b3261e;--hl:#c08a00}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--mut:#9a9a9a;--line:#2c2c2c;--ok:#5bc27a;--bad:#ff7b72;--hl:#e0b040}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:0 auto;padding:16px}
section{border-top:1px solid var(--line);padding:12px 0}.meta{color:var(--mut);font-size:13px}.ok{color:var(--ok)}.bad{color:var(--bad)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}figure{margin:0;width:260px}figure.wide{width:560px;max-width:100%}
img{width:100%;border-radius:6px;border:3px solid transparent}figure.canon img{border-color:var(--hl)}figcaption{font-size:12px;color:var(--mut)}
table{font-size:13px;border-collapse:collapse}td{border:1px solid var(--line);padding:3px 8px;vertical-align:top}</style></head><body><main>
<h1>${esc(log.world?.title)}: sheets and plates</h1>
<p class="meta">${esc(name)} · gold border = canonical · style: ${esc(log.world?.style)}</p>
<h2>Plates (seed)</h2>${plates}
<h2>Asset sheets</h2>${(log.world?.entities || []).map((e) => sheet({ ...e, ...(specs[e.id] || {}) })).join("")}
</main></body></html>`);
console.log(join(dir, "review.html"));
