// Builds the checkpoint site (static, for Vercel): current/checkpoint/site/index.html + media/.
// Content comes from the run logs: lighthouse v1, grandma v1, bakery v1 (pipeline v2).
// Usage: node current/checkpoint/build.mjs   then deploy current/checkpoint/site/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const DIR = dirname(fileURLToPath(import.meta.url)), REPO = join(DIR, "../.."), RUNS = join(REPO, "current/tests/pipeline-v2/runs");
const SITE = join(DIR, "site"), MEDIA = join(SITE, "media");
mkdirSync(MEDIA, { recursive: true });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (x) => Number(x).toLocaleString("en-US");
const mins = (s) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

// Web copies: H.264, faststart, smaller than the CRF 16 masters. Posters from the middle of each video.
function web(src, name) {
  const out = join(MEDIA, `${name}.mp4`), poster = join(MEDIA, `${name}.jpg`);
  if (!existsSync(out)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out]);
  if (!existsSync(poster)) {
    const d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString());
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(d / 2), "-i", src, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", poster]);
  }
  return { video: `media/${name}.mp4`, poster: `media/${name}.jpg` };
}
function image(src, name) {
  const out = join(MEDIA, `${name}.jpg`);
  if (!existsSync(out)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=1280:-2", "-q:v", "4", out]);
  return `media/${name}.jpg`;
}

// Wall-clock times are not in the logs; they come from file timestamps of each run (see notes).
const RUN = [
  { key: "lighthouse", dir: "p4-lighthouse-v1", wall_s: 18 * 60, wall_note: "two invocations: first 4 scenes (~6 min), then the rest (~12 min); scenes run in parallel",
    llm: ["Creative director: story (gpt-6.1-sol)", "Creative director: change-based operational chunks (gpt-6.1-sol)", "Shot planner: bible + 24-shot list (gpt-6.1-sol)"] },
  { key: "grandma", dir: "p1-grandma-v1", wall_s: 210, wall_note: "includes the stand-in upload",
    llm: ["Creative director: story", "Creative director: operational chunks", "Shot planner (gpt-6.1-sol)", "Fixtures check (gpt-6.1-sol)"] },
  { key: "bakery", dir: "p2-bakery-v1", wall_s: 300, wall_note: "generation only; the first text overlay did not stop (bug, fixed) and was re-run from cache",
    llm: ["Creative director: story", "Creative director: operational chunks", "Shot planner (gpt-6.1-sol)", "Fixtures check (gpt-6.1-sol)", "Vision check on each cut frame (gpt-6.1-sol)"] },
];

const cards = RUN.map((r) => {
  const l = JSON.parse(readFileSync(join(RUNS, r.dir, "run.json"), "utf8"));
  const media = web(join(RUNS, r.dir, "final.mp4"), r.key);
  const ids = l.scenes.flat(), shots = l.plan.shots.filter((s) => ids.includes(s.id));
  const jobs = Object.entries(l.jobs).filter(([k]) => ids.some((id) => k.endsWith(`:${id}`)) || k.startsWith("ref:") && existsSync(join(RUNS, r.dir, `refs/${k.slice(4)}.png`)));
  const upload = existsSync(join(REPO, `current/tests/pipeline-v2/uploads/${l.case.id}/u1.json`)) ? JSON.parse(readFileSync(join(REPO, `current/tests/pipeline-v2/uploads/${l.case.id}/u1.json`), "utf8")) : null;
  const credits = jobs.reduce((s, [, j]) => s + (j.credits || 0), 0) + (upload?.credits || 0);
  const compute = jobs.reduce((s, [, j]) => s + (j.seconds || 0), 0);
  const kind = (k) => ({ ref: "Reference image", frame: "Cut start frame", clip: "Video clip", repair: "Repaired frame" }[k.split(":")[0]] || k);
  const model = (j) => j.request?.model ? `${j.request.model}${j.request.resolution ? ` ${j.request.resolution}` : ""}` : "";
  const sortKey = (k) => ["ref", "frame", "repair", "clip"].indexOf(k.split(":")[0]) * 1000 + (ids.indexOf(k.split(":")[1]) + 1);
  const calls = jobs.sort((a, b) => sortKey(a[0]) - sortKey(b[0])).map(([k, j], i) => `<tr><td>${i + 1}</td><td>${kind(k)}<br><span class="soft">${esc(k.split(":")[1])}</span></td><td>${esc(j.endpoint || "")}<br><span class="soft">${esc(model(j))}${j.request?.end_seconds ? ` · ${j.request.end_seconds}s` : ""}</span></td><td>${n(j.credits || 0)}</td><td>${j.seconds ?? ""}</td><td class="p">${esc(j.request?.style?.prompt || "")}${j.checks?.length > 1 ? `<br><span class="soft">Retried: ${esc(j.checks[0].problem)}</span>` : ""}</td></tr>`).join("");
  const cont = l.measures.joins.filter((j) => j.link === "continuous"), cuts = l.measures.joins.filter((j) => j.link === "cut");
  const rng = (xs, k) => { if (!xs.length) return "–"; const lo = Math.min(...xs.map((x) => x[k])), hi = Math.max(...xs.map((x) => x[k])); return lo === hi ? String(lo) : `${lo}–${hi}`; };
  const stats = [
    ["Length", `${shots.reduce((s, x) => s + x.seconds, 0)} s · ${shots.length} clip${shots.length > 1 ? "s" : ""} · ${l.scenes.length} scene${l.scenes.length > 1 ? "s" : ""}`],
    ["Magic Hour credits", `${n(credits)}${upload ? ` (incl. ${n(upload.credits)} for the stand-in upload)` : ""}`],
    ["Wall-clock", `about ${mins(r.wall_s)} (${r.wall_note})`],
    ["Job time (sum)", `${mins(compute)} across ${jobs.length + (upload ? 1 : 0)} Magic Hour jobs`],
    ["Clip start matches its frame", rng(Object.values(l.measures.clips), "first_vs_start")],
    ...(cont.length ? [["Continuous joins", `${cont.length} · similarity ${rng(cont, "seam_ssim")} · frame jump ${rng(cont, "jump")} (normal motion ≈ ${l.measures.median_jump})`]] : []),
    ...(cuts.length ? [["Cuts", String(cuts.length)]] : []),
    ...(l.plan.layers?.length ? [["Text layers", l.plan.layers.map((x) => `“${esc(x.text)}” ${x.start_s}–${x.end_s} s (rendered, exact)`).join("; ")]] : []),
  ].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("");
  const shotRows = shots.map((s) => `<tr><td>${esc(s.id)}</td><td>${s.link}${s.start_upload ? " · upload" : ""}</td><td>${esc(s.location)}</td><td>${esc(s.action)} ${esc(s.camera)}</td></tr>`).join("");
  return { r, l, html: `<section id="${r.key}"><h2>${esc(l.case.title)}</h2><blockquote>“${esc(l.case.request)}”</blockquote>
  ${upload ? `<div class="upload"><img src="${image(join(REPO, `current/tests/pipeline-v2/uploads/${l.case.id}/u1.png`), `${r.key}-upload`)}" alt="Uploaded photo (stand-in)"><p class="soft">Upload u1 is a stand-in, generated from the test case's description of the photo (no real photo in the test set yet). The clip starts on this exact image.</p></div>` : ""}
  <video src="${media.video}" poster="${media.poster}" controls playsinline preload="none"></video>
  <table class="stats">${stats}</table>
  <details><summary>Shot list (${shots.length})</summary><table class="list">${shotRows}</table></details>
  <details><summary>LLM calls</summary><ul>${r.llm.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>
  <details><summary>Magic Hour tool calls (${jobs.length + (upload ? 1 : 0)})</summary><div class="scroll"><table class="list calls"><tr><th>#</th><th>Step</th><th>Endpoint · model</th><th>Credits</th><th>s</th><th>Prompt</th></tr>
  ${upload ? `<tr><td>0</td><td>Stand-in upload</td><td>/v1/ai-image-generator<br><span class="soft">${esc(upload.request.model)} ${esc(upload.request.resolution)}</span></td><td>${n(upload.credits)}</td><td></td><td class="p">${esc(upload.request.style.prompt)}</td></tr>` : ""}${calls}</table></div></details>
  ${r.key === "lighthouse" ? `<details><summary>Creative director output: story</summary><pre>${esc(l.story)}</pre></details>` : ""}</section>` };
});

writeFileSync(join(SITE, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Magic Agent Checkpoint</title>
<meta name="description" content="Checkpoint 2026-10-08: one-shot prompt to finished video, pipeline v2.">
<style>
:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--card:#fbf7ef;--accent:#a0522d}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1d1814;--ink:#efe4d6;--soft:#b9a58f;--line:#3d332a;--card:#26201b;--accent:#d98a5f}}
:root[data-theme="dark"]{--bg:#1d1814;--ink:#efe4d6;--soft:#b9a58f;--line:#3d332a;--card:#26201b;--accent:#d98a5f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Georgia,"Times New Roman",serif}
main{max-width:980px;margin:0 auto;padding:48px 16px 96px}h1{font-weight:normal;font-size:36px;margin:0 0 6px}h2{font-weight:normal;font-size:26px;margin:0 0 10px}
h3{font-weight:normal;font-size:19px;margin:28px 0 8px}.soft{color:var(--soft)}a{color:var(--accent)}
nav a{margin-right:14px}section{border-top:1px solid var(--line);padding-top:30px;margin-top:40px}
blockquote{margin:12px 0 18px;padding:12px 16px;background:var(--card);border-left:3px solid var(--accent);font-size:18px}
video{width:100%;display:block;background:#000;border-radius:4px}
table{border-collapse:collapse;width:100%}.stats{margin:16px 0}.stats th{text-align:left;font-weight:normal;color:var(--soft);width:34%;vertical-align:top;padding:5px 10px 5px 0;border-bottom:1px solid var(--line)}
.stats td{padding:5px 0;border-bottom:1px solid var(--line)}.list{font-size:13px}.list td,.list th{border-bottom:1px solid var(--line);padding:5px 6px;vertical-align:top;text-align:left;font-weight:normal}
.calls .p{font-size:12px;color:var(--soft);min-width:320px}.scroll{overflow-x:auto}
details{margin:10px 0;background:var(--card);border:1px solid var(--line);padding:8px 12px}summary{cursor:pointer}
pre{white-space:pre-wrap;font:15px/1.6 Georgia,serif}.upload{display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:center;margin-bottom:14px}.upload img{width:100%;border:1px solid var(--line)}
ol.pipe{padding-left:22px}ol.pipe li{margin:6px 0}.kv{color:var(--soft);font-size:14px}
@media(max-width:640px){.upload{grid-template-columns:1fr}.stats th{width:42%}}
</style></head><body><main>
<h1>Magic Agent · checkpoint</h1><p class="soft">2026-10-08 · one natural-language prompt → finished video · pipeline v2</p>
<nav><a href="#lighthouse">Lighthouse</a><a href="#grandma">Grandma</a><a href="#bakery">Bakery</a><a href="#pipeline">Pipeline</a><a href="#issues">Known issues</a></nav>
${cards.map((c) => c.html).join("")}
<section id="pipeline"><h2>Pipeline</h2>
<ol class="pipe">
<li><b>Creative director</b> (LLM): the prompt becomes a story, then change-based operational chunks (baseline + <i>property: from → to</i> per chunk).</li>
<li><b>Shot planner</b> (1 LLM call): a bible (each character, prop and location with a fixed look; one style line) and a shot list. A shot is one action, 5 or 10 s, a fixed camera or one simple move, linked to the previous shot as <i>cut</i> or <i>continuous</i>. Uploads and on-screen text are marked here.</li>
<li><b>References</b>: one clean image per bible entry that appears in 2 or more scenes (nano-banana-pro 2k). An uploaded image is used as is.</li>
<li><b>Cut start frames</b>: image editor with the references (or the upload itself when the request is “animate this photo”). A vision check counts the entities; a frame with a missing or doubled character is made again once.</li>
<li><b>Clips</b>: wan-3.0, 720p, start frame only, no end frame. A continuous shot starts from the real last frame of the previous clip; a vision check confirms its characters are in that frame.</li>
<li><b>Stitch</b>: native 30 fps, 1280×720, hard joins. Exact text is rendered separately (headless browser) and overlaid, so it is never misspelled.</li>
</ol>
<p class="kv">Jobs are cached by a hash of their prompt and input files, so a change re-runs only what depends on it. <code>--estimate</code> prices a run before it spends anything.</p></section>
<section id="issues"><h2>Known issues</h2><ul>
<li>Cut frames are drawn from isolated references and text, not from earlier frames, so scale and context are re-invented at every cut (the shell is often too large; the lighthouse lamp reads as a hand lantern).</li>
<li>When a character leaves the frame in a continuous chain, the video model can invent a new person when the next action needs them (a check and frame repair now guard this).</li>
<li>No audio yet (score, sound, voice).</li>
<li>The grandma photo is a stand-in; real uploads are not tested yet.</li>
<li>Next: build each cut by transforming the earlier frame that already holds the most of its elements, and merge missing ones from the frames where they last appeared (in test).</li>
</ul></section>
</main></body></html>`);
console.log("wrote current/checkpoint/site/index.html");
