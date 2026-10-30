// Litmus test, outside the pipeline: start frame → clip 1 → real last frame → clip 2. Hand-written prompts, direct API calls.
// Usage: node current/research/litmus/run-litmus.mjs [--only A|B]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runJob, download, uploadFile } from "../../prod/state-manager/src/magichour.js";
import { firstFrame, lastFrame, ssim } from "../../prod/state-manager/src/continuity.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const VIDEO = { model: "wan-3.0", resolution: "720p", end_seconds: 5, audio: false };

const TESTS = [
  {
    id: "A", title: "Lighthouse keeper (painterly)",
    image: "Painterly melancholy oil-painting style, 16:9 wide shot. A woman lighthouse keeper in her sixties with grey hair tied in a bun and a long dark wool coat stands on a rocky dawn shore, facing the camera from the middle distance. A white lighthouse on a headland behind her, tide pools reflecting a pale lavender sky, kelp on wet sand. Soft diffuse dawn light, muted palette.",
    clip1: "She walks slowly toward the camera along the waterline, coat moving in the wind. Static camera. Gentle waves in the background.",
    clip2: "She stops, kneels down on the wet sand, and picks up a small glowing amber spiral shell, holding it in both hands. Static camera.",
  },
  {
    id: "B", title: "City street (photoreal)",
    image: "Photorealistic 35mm film still, 16:9. A man in his thirties wearing a red jacket and dark jeans walks on a busy city sidewalk on an overcast afternoon, seen from the front at medium-wide distance. Shop windows, parked cars, pedestrians in soft focus behind him.",
    clip1: "He walks steadily toward the camera along the sidewalk. Pedestrians pass behind him. Static camera.",
    clip2: "He slows to a stop, takes a phone out of his jacket pocket, and looks at the screen. Static camera.",
  },
];

for (const t of TESTS.filter((x) => !only || x.id === only)) {
  const out = join(DIR, `test-${t.id}`);
  if (existsSync(join(out, "result.json"))) { console.log(`test ${t.id} already done, skipping`); continue; }
  mkdirSync(out, { recursive: true });
  const log = { ...t, video: VIDEO, steps: [] };
  const step = (s) => { log.steps.push(s); writeFileSync(join(out, "result.json"), JSON.stringify(log, null, 2)); };

  // 1. Start frame: text-to-image.
  const imgBody = { name: `litmus ${t.id} start`, image_count: 1, model: "nano-banana-pro", aspect_ratio: "16:9", resolution: "2k", style: { prompt: t.image } };
  const img = await runJob("/v1/ai-image-generator", imgBody, "image");
  await download(img.downloads[0], join(out, "start.png"));
  step({ name: "start frame", endpoint: "/v1/ai-image-generator", request: imgBody, credits: img.credits, seconds: img.seconds, output: "start.png" });

  // 2. Clip 1 from the start frame (no end frame).
  const startPath = await uploadFile(join(out, "start.png"), "image");
  const c1Body = { name: `litmus ${t.id} clip1`, ...VIDEO, style: { prompt: t.clip1 }, assets: { image_file_path: startPath } };
  const c1 = await runJob("/v1/image-to-video", c1Body, "video");
  await download(c1.downloads[0], join(out, "clip1.mp4"));
  firstFrame(join(out, "clip1.mp4"), join(out, "clip1-first.png"));
  lastFrame(join(out, "clip1.mp4"), join(out, "clip1-last.png"));
  step({ name: "clip 1", endpoint: "/v1/image-to-video", request: c1Body, credits: c1.credits, seconds: c1.seconds, output: "clip1.mp4",
    ssim_first_vs_start: ssim(join(out, "clip1-first.png"), join(out, "start.png"), { fit: true }) });

  // 3. Clip 2 from the REAL last frame of clip 1.
  const lastPath = await uploadFile(join(out, "clip1-last.png"), "image");
  const c2Body = { name: `litmus ${t.id} clip2`, ...VIDEO, style: { prompt: t.clip2 }, assets: { image_file_path: lastPath } };
  const c2 = await runJob("/v1/image-to-video", c2Body, "video");
  await download(c2.downloads[0], join(out, "clip2.mp4"));
  firstFrame(join(out, "clip2.mp4"), join(out, "clip2-first.png"));
  lastFrame(join(out, "clip2.mp4"), join(out, "clip2-last.png"));
  step({ name: "clip 2 (from clip 1's last frame)", endpoint: "/v1/image-to-video", request: c2Body, credits: c2.credits, seconds: c2.seconds, output: "clip2.mp4",
    ssim_first_vs_clip1_last: ssim(join(out, "clip2-first.png"), join(out, "clip1-last.png")) });

  // 4. Join (hard cut, no re-timing) and frame strips.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(out, "clip1.mp4"), "-i", join(out, "clip2.mp4"), "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", join(out, "joined.mp4")]);
  for (const c of ["clip1", "clip2"]) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(out, `${c}.mp4`), "-vf", "fps=2,scale=320:-2,tile=5x2", "-frames:v", "1", join(out, `${c}-strip.jpg`)]);
  log.total_credits = log.steps.reduce((n, s) => n + (s.credits || 0), 0);
  writeFileSync(join(out, "result.json"), JSON.stringify(log, null, 2));
  console.log(`test ${t.id}: ${log.total_credits} credits; seam ssim ${log.steps[2].ssim_first_vs_clip1_last}`);
}

// Page.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sections = TESTS.filter((t) => existsSync(join(DIR, `test-${t.id}`, "result.json"))).map((t) => {
  const r = JSON.parse(execFileSync("cat", [join(DIR, `test-${t.id}`, "result.json")]).toString());
  const p = `test-${t.id}`;
  return `<section><h2>Test ${t.id} · ${esc(t.title)}</h2><p class="soft">${r.total_credits ?? "?"} credits · video ${esc(r.video.model)} ${esc(r.video.resolution)} ${r.video.end_seconds}s · images nano-banana-pro 2k</p>
  <h3>1 · Start frame (text-to-image)</h3><div class="two"><img src="${p}/start.png"><div><p class="lab">Prompt</p><p>${esc(t.image)}</p></div></div>
  <h3>2 · Clip 1 (from the start frame, no end frame)</h3><div class="two"><video src="${p}/clip1.mp4" controls muted loop playsinline></video><div><p class="lab">Prompt</p><p>${esc(t.clip1)}</p><p class="soft">first frame vs start image: ${r.steps[1]?.ssim_first_vs_start ?? "–"}</p></div></div><img src="${p}/clip1-strip.jpg">
  <h3>3 · Last frame of clip 1 → start of clip 2</h3><div class="two"><img src="${p}/clip1-last.png"><img src="${p}/clip2-first.png"></div><p class="soft">left: clip 1 last frame (extracted) · right: clip 2 first frame · similarity ${r.steps[2]?.ssim_first_vs_clip1_last ?? "–"}</p>
  <h3>4 · Clip 2 (from clip 1's real last frame)</h3><div class="two"><video src="${p}/clip2.mp4" controls muted loop playsinline></video><div><p class="lab">Prompt</p><p>${esc(t.clip2)}</p></div></div><img src="${p}/clip2-strip.jpg">
  <h3>5 · Joined (hard cut, no edits)</h3><video src="${p}/joined.mp4" controls muted playsinline class="wide"></video>
  <details><summary>Exact API requests</summary><pre>${esc(JSON.stringify(r.steps.map((s) => ({ step: s.name, endpoint: s.endpoint, request: s.request, credits: s.credits, seconds: s.seconds })), null, 2))}</pre></details></section>`;
}).join("");
writeFileSync(join(DIR, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Litmus: Clip Then Last-Frame Clip</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1100px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:30px}h2{font-weight:normal;font-size:24px;border-top:1px solid var(--line);padding-top:20px;margin-top:40px}h3{font-weight:normal;color:var(--soft);font-size:17px;margin:20px 0 6px}.soft{color:var(--soft)}.lab{font-variant:small-caps;color:var(--soft);margin:0}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}img,video{width:100%;display:block;border:1px solid var(--line)}pre{white-space:pre-wrap;font-size:12px;background:#fbf7ef;padding:10px;border:1px solid var(--line)}@media(max-width:760px){.two{grid-template-columns:1fr}}</style></head><body><main>
<h1>Litmus: clip, then a clip from its last frame</h1><p class="soft">Outside the pipeline: hand-written prompts, direct Magic Hour calls. Start frame (text-to-image) → clip 1 (image-to-video, start frame only) → extract clip 1's real last frame → clip 2 from that frame → hard-cut join. Similarity: SSIM, grayscale 640×360, 1.0 = identical.</p>${sections}</main></body></html>`);
console.log("page: current/research/litmus/index.html");
