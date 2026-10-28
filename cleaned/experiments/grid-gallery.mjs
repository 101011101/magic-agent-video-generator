// Every grid image ever generated, with the prompt and inputs that made it, on one page. Reads the runs' job records.
// Usage: node cleaned/experiments/grid-gallery.mjs  → runs/exp-bakery/page-grids/index.html (+ jpgs)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const OUT = join(RUNS, "exp-bakery", "page-grids"); mkdirSync(OUT, { recursive: true });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const RUNSET = [
  ["custom-bakery1", "Bakery, illustrated (pipeline, 23 Oct)", (k) => /^grid-/.test(k)],
  ["custom-bakery-real", "Bakery, photoreal (pipeline, 23–24 Oct)", (k) => /^grid-/.test(k)],
  ["custom-bakery-v2", "Bakery, photoreal, regrid (26 Oct)", (k) => /^grid-/.test(k)],
  ["exp-bakery", "Isolated tests (25–28 Oct)", (k) => /^(G5|G5b|T1|F1-v1|G9|X3-[ABC]|X4)$/.test(k)],
];
const sections = [];
for (const [run, title, pick] of RUNSET) {
  const f = join(RUNS, run, "run.json"); if (!existsSync(f)) continue;
  const r = JSON.parse(readFileSync(f, "utf8")), items = [];
  for (const [key, j] of Object.entries(r.jobs || {}).filter(([k]) => pick(k)).sort((a, b) => (a[1].at || "").localeCompare(b[1].at || ""))) {
    const src = join(RUNS, run, j.file); if (!existsSync(src)) continue;
    const jpg = `${run}-${key}.jpg`.replace(/[^a-z0-9.-]/gi, "-");
    if (!existsSync(join(OUT, jpg))) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", "scale=1400:-1", "-q:v", "6", join(OUT, jpg)]);
    items.push(`<section class="card"><h3>${esc(run)} / ${esc(key)} <span class="mut">${esc((j.at || "").slice(0, 16).replace("T", " "))} · ${j.model || "nano-banana-pro"} · ${j.credits} credits · inputs: ${j.inputs?.length ? j.inputs.map(esc).join(", ") : "none"}</span></h3>
<img src="${jpg}" alt="${esc(key)}" loading="lazy">
<details><summary>prompt as sent (${j.prompt.length} characters)</summary><pre>${esc(j.prompt)}</pre></details></section>`);
  }
  if (items.length) sections.push(`<h2>${esc(title)} <span class="mut">${items.length} grids</span></h2>${items.join("\n")}`);
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Every Grid So Far</title>
<style>
:root{--bg:#f4f5f2;--panel:#fff;--fg:#1c211e;--mut:#5f6863;--line:#dbe0dc;--mono:ui-monospace,Menlo,monospace}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}}
:root[data-theme="dark"]{--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1150px;margin:0 auto;padding:16px;display:grid;gap:14px}
h1{font-size:22px;margin:0}h2{font-size:17px;margin:14px 0 0}h3{font-size:14px;margin:0;font-family:var(--mono)}.mut{color:var(--mut);font-size:12px;font-weight:400}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:8px}
img{width:100%;border-radius:6px;border:1px solid var(--line);display:block}
pre{margin:0;padding:10px;background:var(--bg);border:1px solid var(--line);border-radius:6px;font:12px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
details summary{cursor:pointer;color:var(--mut);font-size:13px}
</style></head><body><main>
<h1>Every grid generated so far, with its prompt</h1>
<p class="mut">All grid images from the bakery runs and the isolated tests, in the order they were made, each with the exact prompt and input images sent to the model (nano-banana-pro, 4k unless noted). Click "prompt as sent" under each.</p>
${sections.join("\n")}
</main></body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`gallery: ${join(OUT, "index.html")} (${sections.length} sections)`);
