// E2–E5 Image-editor tests on the two Red Riding Hood errors (paid: 200 credits per image, through the same Jobs gate and
// ledger as the pipeline, run name "exp-errors"). Each test changes one variable against the run's own attempts.
//   E2 identity re-render: "return image 1 unchanged", chained 3 times from s10. Does a no-change edit hold everything still?
//   E3 framing invariant: slide 11's edit with an explicit "keep the painted border, zoom and crop" line (vs s11-a1/a2).
//   E4 local edit: only a crop around the change goes to the editor; the result is pasted back with a feathered edge.
//   E5 grounded position: slide 9's edit with the wolf's place written from what the plate shows (vs s9-a1..a3).
// Metrics (deterministic): SSIM of the region that must not change vs the base, and whether the white painted border survives.
// Usage: CLEANED_CAP=… node cleaned/experiments/images.mjs [--only E2,E4] [--estimate]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { Jobs } from "../src/jobs.js";
import { ssim } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ONLY = opt("--only", "E2,E3,E4,E5").split(","), estimate = args.includes("--estimate");
const src = join(RUNS, "custom-rrh1"), srcLog = JSON.parse(readFileSync(join(src, "run.json"), "utf8")), plan = srcLog.plan;
const name = "exp-errors", dir = join(RUNS, name);
for (const d of ["", "in", "out", "tmp"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json");
const run = { name, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const jobs = new Jobs(run, { estimate });
const ff = (a) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a]);
const take = (f) => { const to = `in/${f.split("/").pop()}`; if (!existsSync(run.path(to))) copyFileSync(join(src, f), run.path(to)); return to; };
const W = 2752, H = 1536;

// Region crop (x, y, w, h in base pixels) to a file, for region SSIM.
const crop = (file, [x, y, w, h], out) => { ff(["-i", run.path(file), "-vf", `scale=${W}:${H},crop=${w}:${h}:${x}:${y}`, run.path(out)]); return run.path(out); };
// Painted border kept? Mean luminance of the four corner patches; the plate's corners are white paper (≈ 254); a full-bleed rectangle reads ≈ 240.
function corners(file) {
  const px = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", run.path(file), "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  const at = (x, y) => { let s = 0; for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) s += px[(y + j) * W + x + i]; return s / 1600; };
  return Math.round(Math.min(at(10, 10), at(W - 50, 10), at(10, H - 50), at(W - 50, H - 50)));
}
const result = (test, variant, file, base, keep) => {
  const r = { test, variant, file, keep_ssim: ssim(crop(file, keep, `tmp/${variant}-k.png`), crop(base, keep, `tmp/${variant}-kb.png`)), whole_ssim: ssim(run.path(file), run.path(base)), corner_luma: corners(file) };
  console.log(`${test} ${variant}: keep-region SSIM ${r.keep_ssim}, whole SSIM ${r.whole_ssim}, corner luma ${r.corner_luma} (≥250 = painted border kept; ≈240 = cream rectangle)`);
  (run.log.results ??= []).push(r); run.save(); return r;
};
const s = (n) => plan.slides.find((x) => x.n === n);
const roots = Object.fromEntries(Object.entries(srcLog.jobs).filter(([k]) => k.startsWith("root-")).map(([k, j]) => [k.slice(5), take(j.file)]));
const prompt11 = srcLog.jobs["s11-a1"].prompt, prompt9 = srcLog.jobs["s9-a1"].prompt;
const refs = (ids) => ids.map((id) => roots[id]);
// Slide 11 changes only the door side; the left 45 % (window, bed, wolf) must not change.
const KEEP11 = [0, 0, 1238, H], KEEP9 = [1650, 0, 1102, H];   // slide 9: the right part (hearth, door) must not change

run.log.results = [];
const s10 = take("frames/s10-a2.png"), s8 = take("frames/s8-a1.png");
for (const f of ["s11-a1", "s11-a2"]) result("E3", `${f} (original prompt)`, take(`frames/${f}.png`), s10, KEEP11);
for (const f of ["s9-a1", "s9-a2", "s9-a3"]) result("E5", `${f} (original prompt)`, take(`frames/${f}.png`), s8, KEEP9);
console.log(`plate corner luma ${corners(take("roots/cottage-inside.png"))}, s10 ${corners(s10)}`);

if (ONLY.includes("E2")) {
  let prev = s10;
  for (let h = 1; h <= 3; h++) {
    const out = `out/E2-hop${h}.png`;
    await jobs.image(`E2-hop${h}`, out, "Return image 1 exactly as it is. Change nothing: same content, same framing and border, same colours and line work.", [prev]);
    if (!estimate) result("E2", `identity hop ${h}`, out, s10, [0, 0, W, H]);
    prev = out;
  }
}
if (ONLY.includes("E3")) {
  const p = prompt11.replace("Keep everything in image 1 that is not named below exactly as it is:", "Keep everything in image 1 that is not named below exactly as it is. Image 1 is a watercolour with a soft, uneven painted edge fading to white paper at all four sides: keep that edge, the zoom and the crop exactly; do not extend the painting to the frame edges. Also keep:");
  for (const v of [1, 2]) {
    const out = `out/E3-v${v}.png`;
    await jobs.image(`E3-v${v}`, out, `${p}\n(variant ${v})`, [s10, ...refs(["red", "wolf"])]);
    if (!estimate) result("E3", `framing line v${v}`, out, s10, KEEP11);
  }
}
if (ONLY.includes("E4")) {
  // Crop 16:9 around the door and Red (right half), edit only that, paste back with a 60 px feather.
  const R = [1300, 300, 1452, 817];
  ff(["-i", run.path(s10), "-vf", `crop=${R[2]}:${R[3]}:${R[0]}:${R[1]}`, run.path("in/s10-door.png")]);
  const p = `Edit image 1, a close crop of the right part of a frame (an open cottage door). Keep everything in image 1 that is not named below exactly as it is: the same crop, framing, objects, light and colours.
Little Red Riding Hood is already in image 1; image 2 is her identity reference — keep her looking like it.
Change: Little Red Riding Hood puts Red’s Basket on the floor beside the wooden entrance door. Red: just inside the door, bent with one hand at the basket handle; affectionate and cheerful, smiling toward the left of the frame (the bed). Take the expression and pose from this text, not from any reference image.`;
  for (const v of [1, 2]) {
    const raw = `out/E4-v${v}-crop.png`, out = `out/E4-v${v}.png`;
    await jobs.image(`E4-v${v}`, raw, `${p}\n(variant ${v})`, ["in/s10-door.png", roots.red]);
    if (estimate) continue;
    ff(["-i", run.path(s10), "-i", run.path(raw), "-filter_complex",
      `[1]scale=${R[2]}:${R[3]},format=rgba[e];color=black:s=${R[2]}x${R[3]},format=gray,drawbox=x=60:y=60:w=${R[2] - 120}:h=${R[3] - 120}:color=white:t=fill,boxblur=40[m];[e][m]alphamerge[ea];[0][ea]overlay=${R[0]}:${R[1]}`,
      "-frames:v", "1", run.path(out)]);
    result("E4", `local edit v${v}`, out, s10, KEEP11);
  }
}
if (ONLY.includes("E5")) {
  // The plate shows the tall headboard (with the pillow) nearest the camera and the low footboard at the hearth end.
  const grounded = "lying in the large wooden bed with his head on the pillow at the tall carved headboard nearest the camera (left), his body under the quilt and his feet toward the low footboard by the hearth";
  const p = prompt9.split("head beneath the small window").join(grounded);
  for (const v of [1, 2]) {
    const out = `out/E5-v${v}.png`;
    await jobs.image(`E5-v${v}`, out, `${p}\n(variant ${v})`, [s8, ...refs(["wolf"])]);
    if (!estimate) result("E5", `grounded position v${v}`, out, s8, KEEP9);
  }
}
if (estimate) console.log(`estimate: ${jobs.estimated.length} paid jobs, ${jobs.estimated.reduce((n, j) => n + j.cost, 0)} credits`);
else console.log(`spent ${jobs.spent()} credits; results in ${logFile}`);
