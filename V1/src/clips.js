// Deterministic clip tools (ffmpeg): duration, first/last frame SSIM against the keyframes, and the stitch.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
export const duration = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

function frame(video, at, out) {
  ff(at === "last" ? ["-sseof", "-0.1", "-i", video, "-frames:v", "1", "-update", "1", out] : ["-i", video, "-frames:v", "1", out]);
  return out;
}

// SSIM (grayscale, 640×360) of two images, 0–1; null if ffmpeg reports none.
export function ssim(a, b) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-filter_complex", "[0]scale=640:360,format=gray[x];[1]scale=640:360,format=gray[y];[x][y]ssim", "-f", "null", "-"]);
  const m = r.stderr.toString().match(/All:(\d(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1]) * 1000) / 1000 : null;
}

// Darkest of the four corner patches (mean luma, 0–255), at 688×384. A painted edge on white paper reads ≈ 254; full bleed lower.
export function corners(file) {
  const W = 688, H = 384, p = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  const at = (x, y) => { let s = 0; for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) s += p[(y + j) * W + x + i]; return s / 100; };
  return Math.round(Math.min(at(2, 2), at(W - 12, 2), at(2, H - 12), at(W - 12, H - 12)));
}

// Framing gate for an edit: did the editor re-paint the whole picture (zoom, crop, border) instead of changing part of it?
// Calibrated on custom-rrh1 (38 edits): normal edits 0.78–0.98 SSIM to their base; whole re-paints 0.08–0.61, or the border flips.
export const FRAMING = { minSsim: 0.7, maxCornerShift: 10 };
export function framing(file, base) {
  const s = ssim(file, base), c = Math.abs(corners(file) - corners(base));
  return { ssim: s, corner_shift: c, changed: (s !== null && s < FRAMING.minSsim) || c >= FRAMING.maxCornerShift };
}

// First frame vs the start keyframe; last frame vs the end keyframe (connected) or vs the start keyframe (cut: how far the
// unpinned clip drifted from its own keyframe — V-006).
export function check(video, { start, end, path, key }) {
  const first = frame(video, "first", path(`clips/${key}-first.png`)), last = frame(video, "last", path(`clips/${key}-last.png`));
  return { first_vs_start: ssim(first, start), last_vs_end: end ? ssim(last, end) : null, last_vs_start: end ? null : ssim(last, start), seconds: Math.round(duration(video) * 10) / 10 };
}

// Stitch clips into one film. At a connected seam the next clip's first frame repeats the previous clip's last frame, so it
// is dropped. Everything is re-encoded to one size and rate so concat cannot fail on mismatched streams.
export function stitch(clips, out, path) {
  const parts = clips.map((c, i) => {
    const p = path(`clips/part-${i}.mp4`), trim = c.trimFirst ? "trim=start_frame=1," : "";
    ff(["-i", path(c.file), "-an", "-vf", `${trim}setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`, "-c:v", "libx264", "-crf", "18", p]);
    return p;
  });
  const list = path("clips/concat.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", path(out)]);
  return out;
}
