// One scene, one video call: a start frame → image-to-video, no end frame. Cheap model first.
// Usage: node cleaned/experiments/i2v-single.mjs [--model ltx-2.5] [--res 480p] [--seconds 10] [--label ltx-10s]
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runJob, download, upload } from "../src/magichour.js";
import { RUNS } from "../src/env.js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const model = arg("model", "ltx-2.5"), resolution = arg("res", "480p"), seconds = Number(arg("seconds", 10)), label = arg("label", `${model}-${resolution}-${seconds}s`);
const DIR = join(RUNS, "exp-bakery", "i2v"), start = join(DIR, "start.jpg"), out = join(DIR, `${label}.mp4`);
if (existsSync(out)) { console.log(`${out} exists; delete it to rerun`); process.exit(0); }

const prompt = `Live-action, fixed wide camera, no camera movement. Inside a small bakery, the baker behind the counter picks up the first loaf from the cooling rack, wraps it in a sheet of cream paper, and hands it across the counter to the older woman in the blue cardigan, who takes it and holds it against her bag. He then lifts the second loaf, wraps it in paper, and hands it to the young woman in the terracotta jacket, who takes it in both hands. The child watches and looks up at the baker. The baker's tired face brightens into a smile as the two women smile back at him. The cooling rack is empty at the end. Everyone stays where they stand. Natural, unhurried movement.`;

const t0 = Date.now();
const path = await upload(start);
const body = { name: `exp-bakery i2v ${label}`, model, resolution, end_seconds: seconds, audio: false, style: { prompt }, assets: { image_file_path: path } };
console.log(`submitting ${model} ${resolution} ${seconds}s …`);
const r = await runJob("/v1/image-to-video", body, { kind: "video" });
await download(r.url, out);
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
ff(["-i", out, "-frames:v", "1", join(DIR, `${label}-first.png`)]);
ff(["-sseof", "-0.2", "-i", out, "-update", "1", "-frames:v", "1", join(DIR, `${label}-last.png`)]);
ff(["-i", out, "-vf", `fps=1,scale=480:-2,tile=5x${Math.ceil(seconds / 5)}`, "-frames:v", "1", join(DIR, `${label}-strip.jpg`)]);
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration", "-of", "json", out]).toString();
const log = { label, model, resolution, seconds, prompt, request: body, job_id: r.id, credits: r.credits, wall_seconds: r.seconds, output: `${label}.mp4`, probe: JSON.parse(probe).streams[0], at: new Date().toISOString() };
writeFileSync(join(DIR, `${label}.json`), JSON.stringify(log, null, 2));
console.log(JSON.stringify({ credits: r.credits, wall_seconds: r.seconds, stream: log.probe }, null, 2));
