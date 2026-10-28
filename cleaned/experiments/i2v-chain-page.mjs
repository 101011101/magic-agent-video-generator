// Build index.html for a chain run from chain.json + spec.json. Re-run after each clip lands.
// Usage: node cleaned/experiments/i2v-chain-page.mjs <run dir> [notes.html]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const DIR = resolve(process.argv[2]), notes = process.argv[3] && existsSync(join(DIR, process.argv[3])) ? readFileSync(join(DIR, process.argv[3]), "utf8") : "";
const spec = JSON.parse(readFileSync(join(DIR, "spec.json"), "utf8")), log = JSON.parse(readFileSync(join(DIR, "chain.json"), "utf8"));
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const jpg = (png) => { const out = png.replace(/\.png$/, ".jpg"); if (existsSync(join(DIR, png)) && !existsSync(join(DIR, out))) ff(["-i", join(DIR, png), "-q:v", "3", join(DIR, out)]); return out; };
const ssimOut = (a, b) => spawnSync("ffmpeg", ["-loglevel", "info", "-i", join(DIR, a), "-i", join(DIR, b), "-filter_complex", "[0:v][1:v]ssim", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/All:([0-9.]+)/)?.[1] ?? null;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const style = readFileSync(join(DIR, "..", "exp-bakery", "page", "index.html"), "utf8").split("\n").slice(1, 13).join("\n");

const clips = spec.clips.map((p, i) => ({ n: i + 1, prompt: p, step: log.steps.find((s) => s.name === `clip${i + 1}`) })).filter((c) => c.step && existsSync(join(DIR, `clip${c.n}.mp4`)));
const total = log.steps.reduce((n, s) => n + (s.credits || 0), 0);
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Adventure Chain</title>
${style}
img,video{width:100%;border-radius:6px;border:1px solid var(--line);display:block}.cap2{display:grid;grid-template-columns:1fr 1fr;gap:6px;font:12px var(--mono);color:var(--mut);text-align:center}
</style></head><body><main>
<h1>${esc(spec.name)}: one start frame, then each clip from the last frame of the one before</h1>
<p class="mut">Model ${log.video.model}, ${log.video.resolution}, ${log.seconds} s per clip, no end frames. Start frame from the image generator (nano-banana-pro, 2k, 16:9). Hand-off: frame N−3 of each clip (before the end snap) becomes the next clip's only input. ${clips.length} of ${spec.clips.length} clips so far, ${total} credits. Script: <code>cleaned/experiments/i2v-chain.mjs</code>, spec and outputs in <code>runs/exp-adventure/</code>.</p>
`;
if (existsSync(join(DIR, "start-rejected-likeness.png"))) html += `<section class="card"><h2>0. First start frame, rejected by the video model</h2>
<img src="${jpg("start-rejected-likeness.png")}" alt="rejected start frame">
<p>The image generator read "1930s pulp adventurer, fedora, leather jacket" as one specific actor. Seedance refused the clip with code <code>nsfw</code> ("content policy"), which here means a real-person likeness. The failed job was refunded. Rule: describe an original character in the start-frame prompt and say so; the video filter is stricter than the image one.</p></section>
`;
html += `<section class="card"><h2>1. The start frame (200 credits)</h2>
<img src="${jpg("start.png")}" alt="start frame">
<pre>${esc(spec.start)}</pre></section>
`;
for (const c of clips) {
  const prev = c.n === 1 ? "start.jpg" : `clip${c.n - 1}-last.jpg`;
  jpg(`clip${c.n}-first.png`); jpg(`clip${c.n}-last.png`); if (c.n > 1) jpg(`clip${c.n - 1}-last.png`);
  const pair = `clip${c.n}-handoff.jpg`;
  if (!existsSync(join(DIR, pair))) ff(["-i", join(DIR, prev), "-i", join(DIR, `clip${c.n}-first.jpg`), "-filter_complex", `[0:v]scale=856:480[a];[1:v]scale=856:480[b];[a][b]hstack`, "-q:v", "3", join(DIR, pair)]);
  const sim = c.n === 1 ? null : ssimOut(`clip${c.n}-first.png`, `clip${c.n - 1}-last.png`);
  const p = c.step.probe || {};
  html += `<section class="card"><h2>${c.n + 1}. Clip ${c.n} (${c.step.credits} credits, ${c.step.wall_seconds} s to render${p.width ? `, ${p.width}×${p.height}, ${p.nb_read_frames} frames` : ""})</h2>
<p class="mut">Input: ${c.n === 1 ? "the start frame" : `frame ${log.steps.find((s) => s.name === `clip${c.n - 1}`)?.handoff_frame} of clip ${c.n - 1}`}.</p>
<pre>${esc(c.prompt)}</pre>
<video src="clip${c.n}.mp4" controls muted playsinline preload="metadata"></video>
<img src="clip${c.n}-strip.jpg" alt="clip ${c.n}, one frame every half second">
<p class="mut">One frame every half second, reading order.</p>
<img src="${pair}" alt="hand-off into clip ${c.n}">
<div class="cap2"><span>${c.n === 1 ? "start frame" : `clip ${c.n - 1}, hand-off frame`}</span><span>clip ${c.n}, first frame${sim ? ` (SSIM ${Number(sim).toFixed(3)})` : ""}</span></div>
</section>
`;
}
if (existsSync(join(DIR, "joined.mp4"))) html += `<section class="card"><h2>${clips.length + 2}. All clips, hard cut, no re-timing</h2><video src="joined.mp4" controls muted playsinline preload="metadata"></video></section>\n`;
if (notes) html += notes + "\n";
html += `</main></body></html>\n`;
writeFileSync(join(DIR, "index.html"), html);
console.log(`index.html: ${clips.length} clips`);
