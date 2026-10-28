// Page for a seedream-test run: script, element table, presence matrix, sheets, clips with their references, findings.
// Usage: node seedream-test/page.mjs --label t1   (reads runs/<label>/run.json and optional notes.html)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const label = arg("label", "t1"), DIR = join(dirname(fileURLToPath(import.meta.url)), "runs", label);
const run = JSON.parse(readFileSync(join(DIR, "run.json"), "utf8")), s = run.script;
const notes = existsSync(join(DIR, "notes.html")) ? readFileSync(join(DIR, "notes.html"), "utf8") : "";
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const jpg = (png) => { const out = png.replace(/\.png$/, ".jpg"); if (existsSync(join(DIR, png)) && !existsSync(join(DIR, out))) ff(["-i", join(DIR, png), "-vf", "scale='min(1600,iw)':-2", "-q:v", "3", join(DIR, out)]); return out; };
const ssim = (a, b) => spawnSync("ffmpeg", ["-loglevel", "info", "-i", join(DIR, a), "-i", join(DIR, b), "-filter_complex", "[0:v][1:v]ssim", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/All:([0-9.]+)/)?.[1];

const css = `:root{--bg:#f4f5f2;--panel:#fff;--fg:#1c211e;--mut:#5f6863;--line:#dbe0dc;--ok:#1f7a4d;--bad:#b23a2f;--warn:#9a6b00;--mono:ui-monospace,Menlo,monospace}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e;--ok:#5ccb8f;--bad:#f07c6d;--warn:#e0b352}}
:root[data-theme="dark"]{--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e;--ok:#5ccb8f;--bad:#f07c6d;--warn:#e0b352}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px;display:grid;gap:18px}
h1{font-size:22px;margin:0}h2{font-size:17px;margin:0}h3{font-size:14px;margin:0}.mut{color:var(--mut);font-size:13px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:10px}
img,video{width:100%;border-radius:6px;border:1px solid var(--line);display:block}
pre{margin:0;padding:10px;background:var(--bg);border:1px solid var(--line);border-radius:6px;font:12.5px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
ul{margin:0;padding-left:20px}li{margin:2px 0}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
table{border-collapse:collapse;font-size:13px;width:100%}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}th{background:var(--bg)}td.c{text-align:center;font-family:var(--mono)}
.sheets{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.sheets figure{margin:0;display:grid;gap:4px}.sheets figcaption{font:12px var(--mono);color:var(--mut)}
.cap2{display:grid;grid-template-columns:1fr 1fr;gap:6px;font:12px var(--mono);color:var(--mut);text-align:center}`;

let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seedream Scene Test</title><style>${css}</style></head><body><main>
<h1>${esc(s.title)}: elements first, then two referenced clips</h1>
<p class="mut">Three kinds of call. 1: one LLM call writes the scene, gives every physical thing an id and a spec, and fills a presence table (which ids are in which clip). 2: one image call per element makes its reference sheet before any video. 3: one text-to-video call per clip (${run.video.model}, ${run.video.resolution}, ${run.seconds} s) whose references are exactly that clip's elements, named @id in the prompt; clip 2 also gets clip 1's hand-off frame as @last_frame. ${run.total_credits ?? 0} credits so far. Code: <code>seedream-test/run.mjs</code>, outputs in <code>seedream-test/runs/${label}/</code>.</p>

<section class="card"><h2>1. The script (one LLM call)</h2>
<pre>${esc(s.script)}</pre>
<h3>Elements</h3>
<table><tr><th>id</th><th>kind</th><th>name</th><th>spec</th></tr>${s.elements.map((e) => `<tr><td class="c">${e.id}</td><td>${e.kind}</td><td>${esc(e.name)}</td><td>${esc(e.spec)}</td></tr>`).join("")}</table>
<h3>Presence table (the state manager for this scene)</h3>
<table><tr><th>element</th>${s.clips.map((c) => `<th>clip ${c.n}</th>`).join("")}</tr>${s.elements.map((e) => `<tr><td class="c">${e.id}</td>${s.clips.map((c) => `<td class="c">${c.present.includes(e.id) ? (c.introduced.includes(e.id) ? "new" : "●") : ""}</td>`).join("")}</tr>`).join("")}</table>
<p class="mut">"new" = first seen in this clip. A clip's references are exactly its column.</p>
${s.clips.map((c) => `<h3>Clip ${c.n} must show</h3><ul>${c.must_show.map((m) => `<li>${esc(m)}</li>`).join("")}</ul><p class="mut">End state: ${esc(c.end_state)}</p>`).join("")}
</section>
`;
const sheets = run.sheets || {};
h += `<section class="card"><h2>2. The element sheets (one image call each, ${Object.values(sheets).reduce((n, x) => n + (x.credits || 0), 0)} credits)</h2>
<div class="sheets">${s.elements.map((e) => sheets[e.id] ? `<figure><img src="${jpg(sheets[e.id].file)}" alt="${e.id}"><figcaption>${e.id} · ${e.kind}</figcaption></figure>` : `<figure><figcaption>${e.id}: not made</figcaption></figure>`).join("")}</div>
</section>
`;
for (const c of s.clips) {
  const r = (run.clips || {})[c.n];
  if (!r) { h += `<section class="card"><h2>${c.n + 2}. Clip ${c.n}: not made yet</h2><pre>${esc(c.prompt)}</pre></section>\n`; continue; }
  jpg(`clip${c.n}-first.png`); jpg(`clip${c.n}-last.png`);
  let pair = "";
  if (c.n > 1 && existsSync(join(DIR, `clip${c.n - 1}-last.png`))) {
    const p = `clip${c.n}-handoff.jpg`;
    if (!existsSync(join(DIR, p))) ff(["-i", join(DIR, `clip${c.n - 1}-last.png`), "-i", join(DIR, `clip${c.n}-first.png`), "-filter_complex", "[0:v]scale=856:480[a];[1:v]scale=856:480[b];[a][b]hstack", "-q:v", "3", join(DIR, p)]);
    const sim = ssim(`clip${c.n}-first.png`, `clip${c.n - 1}-last.png`);
    pair = `<img src="${p}" alt="hand-off"><div class="cap2"><span>clip ${c.n - 1}, hand-off frame (sent as @last_frame)</span><span>clip ${c.n}, first frame${sim ? ` (SSIM ${Number(sim).toFixed(3)})` : ""}</span></div>`;
  }
  h += `<section class="card"><h2>${c.n + 2}. Clip ${c.n} (${r.credits} credits, ${r.wall_seconds} s to render, ${r.frames} frames)</h2>
<p class="mut">References sent: ${r.references.map((x) => `@${x}`).join(", ")}.</p>
<pre>${esc(r.request.style.prompt)}</pre>
<video src="${r.file}" controls muted playsinline preload="metadata"></video>
<img src="clip${c.n}-strip.jpg" alt="clip ${c.n}, one frame every half second"><p class="mut">One frame every half second, reading order.</p>
${pair}
</section>
`;
}
if (existsSync(join(DIR, "joined.mp4"))) h += `<section class="card"><h2>${s.clips.length + 3}. Both clips, hard cut</h2><video src="joined.mp4" controls muted playsinline preload="metadata"></video></section>\n`;
h += notes + `\n</main></body></html>\n`;
writeFileSync(join(DIR, "index.html"), h);
console.log(`index.html written: ${Object.keys(sheets).length} sheets, ${Object.keys(run.clips || {}).length} clips`);
