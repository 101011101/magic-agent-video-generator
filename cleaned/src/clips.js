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

// First frame vs the start keyframe; last frame vs the end keyframe (connected clips only).
export function check(video, { start, end, path, key }) {
  const first = frame(video, "first", path(`clips/${key}-first.png`)), last = frame(video, "last", path(`clips/${key}-last.png`));
  return { first_vs_start: ssim(first, start), last_vs_end: end ? ssim(last, end) : null, seconds: Math.round(duration(video) * 10) / 10 };
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
