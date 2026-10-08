// Litmus C: 4 continuous clips (each from the real last frame of the one before), then a cut to a new place.
// Clips 1-2 are reused from test A (same method). Hard-cut join at native 30 fps, no trims, no end frames.
// Usage: node current/research/litmus/run-litmus-chain.mjs
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runJob, download, uploadFile } from "../../prod/state-manager/src/magichour.js";
import { firstFrame, lastFrame, ssim } from "../../prod/state-manager/src/continuity.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const A = join(DIR, "test-A"), out = join(DIR, "test-C");
const VIDEO = { model: "wan-3.0", resolution: "720p", end_seconds: 5, audio: false };
const CLIPS = [
  { id: "clip1", reuse: "clip1.mp4", prompt: "She walks slowly toward the camera along the waterline, coat moving in the wind. Static camera. Gentle waves in the background." },
  { id: "clip2", reuse: "clip2.mp4", prompt: "She stops, kneels down on the wet sand, and picks up a small glowing amber spiral shell, holding it in both hands. Static camera." },
  { id: "clip3", prompt: "She stands up slowly, still holding the glowing shell, and looks toward the lighthouse. Static camera." },
  { id: "clip4", prompt: "She turns and walks away from the camera along the shore toward the lighthouse. Static camera." },
];
const CUT = {
  image: "The same woman: grey hair in a bun, long dark wool coat, same face. New place: inside the lantern room at the top of the lighthouse at night. Warm lamp light, a large brass Fresnel lens behind her, dark sea through the windows. She holds the small glowing amber spiral shell. Painterly melancholy oil-painting style, 16:9 medium shot.",
  clip: "She places the glowing shell on the windowsill and looks out at the dark sea. Static camera.",
};

mkdirSync(out, { recursive: true });
const logPath = join(out, "result.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath)) : { video: VIDEO, steps: [] };
const done = (name) => log.steps.find((s) => s.name === name);
const step = (s) => { log.steps.push(s); writeFileSync(logPath, JSON.stringify(log, null, 2)); };

async function clip(id, prompt, startPng, name) {
  if (done(name)) return;
  const path = await uploadFile(startPng, "image");
  const body = { name: `litmus C ${id}`, ...VIDEO, style: { prompt }, assets: { image_file_path: path } };
  const r = await runJob("/v1/image-to-video", body, "video");
  await download(r.downloads[0], join(out, `${id}.mp4`));
  firstFrame(join(out, `${id}.mp4`), join(out, `${id}-first.png`));
  step({ name, endpoint: "/v1/image-to-video", request: body, credits: r.credits, seconds: r.seconds, output: `${id}.mp4`,
    ssim_first_vs_start: ssim(join(out, `${id}-first.png`), startPng, { fit: true }) });
}

// Continuous chain.
copyFileSync(join(A, "start.png"), join(out, "start.png"));
for (const [i, c] of CLIPS.entries()) {
  if (c.reuse) { if (!done(c.id)) { copyFileSync(join(A, c.reuse), join(out, `${c.id}.mp4`)); step({ name: c.id, reused_from: `test-A/${c.reuse}`, prompt: c.prompt, credits: 0 }); } }
  else await clip(c.id, c.prompt, join(out, `${CLIPS[i - 1].id}-last.png`), c.id);
  firstFrame(join(out, `${c.id}.mp4`), join(out, `${c.id}-first.png`));
  lastFrame(join(out, `${c.id}.mp4`), join(out, `${c.id}-last.png`));
}

// Cut: fresh start frame in a new place, character from the clean start image (not from the previous clip).
if (!done("cut frame")) {
  const ref = await uploadFile(join(A, "start.png"), "image");
  const body = { name: "litmus C cut frame", image_count: 1, model: "nano-banana-pro", aspect_ratio: "16:9", resolution: "2k", style: { prompt: CUT.image }, assets: { image_file_paths: [ref] } };
  const r = await runJob("/v1/ai-image-editor", body, "image");
  await download(r.downloads[0], join(out, "cut-start.png"));
  step({ name: "cut frame", endpoint: "/v1/ai-image-editor", request: body, credits: r.credits, seconds: r.seconds, output: "cut-start.png" });
}
await clip("clip5", CUT.clip, join(out, "cut-start.png"), "clip5 (after cut)");

// Hard-cut join, native 30 fps, no trims. Report per-join frame jumps.
const ids = [...CLIPS.map((c) => c.id), "clip5"];
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...ids.flatMap((id) => ["-i", join(out, `${id}.mp4`)]), "-filter_complex",
  ids.map((_, i) => `[${i}:v]scale=1280:720:flags=lanczos,setsar=1,format=yuv420p[v${i}]`).join(";") + ";" + ids.map((_, i) => `[v${i}]`).join("") + `concat=n=${ids.length}:v=1:a=0[v]`,
  "-map", "[v]", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(out, "joined.mp4")]);
for (const id of ids) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(out, `${id}.mp4`), "-vf", "fps=2,scale=320:-2,tile=5x2", "-frames:v", "1", join(out, `${id}-strip.jpg`)]);
log.seams = ids.slice(1).map((id, i) => ({ from: ids[i], to: id, ssim_last_vs_first: ssim(join(out, `${ids[i]}-last.png`), join(out, `${id}-first.png`)) }));
log.total_credits = log.steps.reduce((n, s) => n + (s.credits || 0), 0);
writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log(JSON.stringify({ credits: log.total_credits, seams: log.seams }, null, 1));
