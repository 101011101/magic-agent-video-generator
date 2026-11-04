// Chain: start frame (text-to-image) → clip 1 → its last frame → clip 2 → … Each clip is one image-to-video call, no end frame.
// Usage: node V1/experiments/i2v-chain.mjs <spec.json> [--model seedance-2.0] [--res 480p] [--seconds 8]
// Resumable: a step whose output file exists is skipped.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { runJob, download, upload } from "../src/magichour.js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const specFile = resolve(process.argv[2]), spec = JSON.parse(readFileSync(specFile, "utf8"));
const DIR = dirname(specFile), video = { model: arg("model", "seedance-2.0"), resolution: arg("res", "480p"), audio: false }, seconds = Number(arg("seconds", 8));
const logFile = join(DIR, "chain.json"), log = existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { spec: specFile, video, seconds, steps: [] };
const save = () => writeFileSync(logFile, JSON.stringify(log, null, 2));
const ff = (args, opts) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], opts);
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames,duration", "-of", "json", f]).toString()).streams[0];

// 1. Start frame.
const start = join(DIR, "start.png");
if (!existsSync(start)) {
  const body = { name: `${spec.name} start`, image_count: 1, model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9", style: { prompt: spec.start } };
  console.log("start frame …");
  const r = await runJob("/v1/ai-image-generator", body, { kind: "image" });
  await download(r.url, start);
  log.steps.push({ name: "start", endpoint: "/v1/ai-image-generator", request: body, credits: r.credits, wall_seconds: r.seconds, output: "start.png" }); save();
}

// 2. Clips, each from the previous clip's frame N-3 (before the end snap).
let first = start;
for (let i = 0; i < spec.clips.length; i++) {
  const n = i + 1, out = join(DIR, `clip${n}.mp4`), firstPng = join(DIR, `clip${n}-first.png`), lastPng = join(DIR, `clip${n}-last.png`);
  if (!existsSync(out)) {
    const path = await upload(first);
    const body = { name: `${spec.name} clip ${n}`, ...video, end_seconds: seconds, style: { prompt: spec.clips[i] }, assets: { image_file_path: path } };
    console.log(`clip ${n}: ${video.model} ${video.resolution} ${seconds}s …`);
    const r = await runJob("/v1/image-to-video", body, { kind: "video" });
    await download(r.url, out);
    log.steps.push({ name: `clip${n}`, endpoint: "/v1/image-to-video", request: body, input: first.split("/").pop(), credits: r.credits, wall_seconds: r.seconds, output: `clip${n}.mp4` }); save();
  }
  const p = probe(out), N = Number(p.nb_read_frames);
  ff(["-i", out, "-frames:v", "1", firstPng]);
  ff(["-i", out, "-vf", `select=eq(n\\,${N - 3})`, "-fps_mode", "passthrough", "-frames:v", "1", lastPng]);
  ff(["-i", out, "-vf", `fps=2,scale=480:-2,tile=4x${Math.ceil(seconds * 2 / 4)}`, "-frames:v", "1", join(DIR, `clip${n}-strip.jpg`)]);
  const step = log.steps.find((s) => s.name === `clip${n}`);
  Object.assign(step, { probe: p, handoff_frame: N - 3 });
  first = lastPng;
}

// 3. Hard-cut join and a strip of the whole chain.
const clips = spec.clips.map((_, i) => join(DIR, `clip${i + 1}.mp4`));
ff([...clips.flatMap((c) => ["-i", c]), "-filter_complex", `${clips.map((_, i) => `[${i}:v]`).join("")}concat=n=${clips.length}:v=1:a=0[v]`, "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", join(DIR, "joined.mp4")]);
log.total_credits = log.steps.reduce((n, s) => n + (s.credits || 0), 0); save();
console.log(`done: ${log.total_credits} credits`);
