// Continuity checks with ffmpeg: frame extraction and SSIM (grayscale, 640x360; 1.0 = identical).
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

function ff(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-400)}`);
  return r.stderr;
}

export function firstFrame(video, out) { ff(["-loglevel", "error", "-i", video, "-frames:v", "1", out]); return out; }
// The last decoded frame: seek near the end and keep overwriting one image.
export function lastFrame(video, out) { ff(["-loglevel", "error", "-sseof", "-0.5", "-i", video, "-update", "1", out]); return out; }

// fit: centre-crop b to a's aspect first (a reference image vs a video frame; the video models crop the same way).
export function ssim(a, b, { fit = false } = {}) {
  const crop = fit ? "crop='trunc(min(iw,ih*AW/AH)/2)*2':'trunc(min(ih,iw*AH/AW)/2)*2'," : "";
  let pre = "";
  if (fit) { const [w, h] = size(a); pre = crop.replaceAll("AW", w).replaceAll("AH", h); }
  const err = ff(["-i", a, "-i", b, "-lavfi", `[0:v]scale=640:360,format=gray[x];[1:v]${pre}scale=640:360,format=gray[y];[x][y]ssim`, "-frames:v", "1", "-f", "null", "-"]);
  const m = err.match(/All:([\d.]+)/);
  if (!m) throw new Error(`no SSIM in ffmpeg output for ${a} vs ${b}`);
  return Number(Number(m[1]).toFixed(3));
}
function size(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" });
  return r.stdout.trim().split(",").map(Number);
}

// Frames of one clip, cached in <runDir>/frames/<id>-first.png and -last.png.
export function clipFrames(runDir, id, video) {
  const dir = join(runDir, "frames"); mkdirSync(dir, { recursive: true });
  const first = join(dir, `${id}-first.png`), last = join(dir, `${id}-last.png`);
  if (!existsSync(first)) firstFrame(video, first);
  if (!existsSync(last)) lastFrame(video, last);
  return { first, last, firstRel: `frames/${id}-first.png`, lastRel: `frames/${id}-last.png` };
}

// Continuity report for a run's chain. file(id) gives the absolute path of a node's output (or null).
// Per clip: SSIM(first frame, start image), SSIM(last frame, end image). Per seam: SSIM(last frame of clip n, first frame of clip n+1).
// Good end-frame models reach 0.98+ on both ends and 0.98 on real-last-frame seams; seedance-1.5 sits at 0.6-0.8.
export const THRESHOLD = { start: 0.9, end: 0.9, seam: 0.9 };
export function checkContinuity(runDir, chain, file) {
  const clips = chain.map((c) => {
    const v = file(c.video);
    if (!v) return { video: c.video, missing: true };
    const f = clipFrames(runDir, c.video, v);
    const startImg = c.start && file(c.start), endImg = c.end && file(c.end);
    const out = { video: c.video, first: f.firstRel, last: f.lastRel, _first: f.first, _last: f.last };
    if (startImg) out.start = ssim(f.first, startImg, { fit: true });
    if (endImg) out.end = ssim(f.last, endImg, { fit: true });
    out.flags = [];
    if (out.start != null && out.start < THRESHOLD.start) out.flags.push(`first frame off start image (${out.start})`);
    if (out.end != null && out.end < THRESHOLD.end) out.flags.push(`last frame off end image (${out.end})`);
    return out;
  });
  const seams = [];
  for (let i = 1; i < clips.length; i++) {
    const a = clips[i - 1], b = clips[i];
    if (a.missing || b.missing) continue;
    const s = { from: a.video, to: b.video, kind: chain[i].handoff || null, ssim: ssim(a._last, b._first) };
    if (s.ssim < THRESHOLD.seam && s.kind !== "cut") s.flag = `seam jump (${s.ssim})`;
    seams.push(s);
  }
  for (const c of clips) { delete c._first; delete c._last; }
  return { method: "ffmpeg ssim, grayscale 640x360; reference images centre-cropped to the clip aspect", threshold: THRESHOLD, clips, seams };
}
