// Deterministic media tools (ffmpeg): durations, frames, SSIM, crops, contact sheets, the stitch. No model calls.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
export const duration = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
export const size = (file) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]).toString().trim().split("x").map(Number);

export function frame(video, at, out) { ff(at === "last" ? ["-sseof", "-0.1", "-i", video, "-frames:v", "1", "-update", "1", out] : ["-i", video, "-frames:v", "1", "-update", "1", out]); return out; }
// Frames at a rate (per second) → files named <base>-fNN.jpg, scaled to 1024 wide for vision calls.
export function frames(video, base, fps = 2) { ff(["-i", video, "-vf", `fps=${fps},scale=1024:-2`, "-q:v", "4", `${base}-f%02d.jpg`]); }
// SSIM (grayscale, 640×360) of two images, 0–1; null if ffmpeg reports none.
export function ssim(a, b) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-filter_complex", "[0]scale=640:360,format=gray[x];[1]scale=640:360,format=gray[y];[x][y]ssim", "-f", "null", "-"]);
  const m = r.stderr.toString().match(/All:(\d(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1]) * 1000) / 1000 : null;
}
// First and last frame of a clip against its two stills.
export function clipEnds(video, { start, end, path, key }) {
  const first = frame(video, "first", path(`${key}-first.png`)), last = frame(video, "last", path(`${key}-last.png`));
  return { first_vs_start: ssim(first, start), last_vs_end: end ? ssim(last, end) : null, seconds: Math.round(duration(video) * 10) / 10 };
}
// A crop of an image, box in fractions of width and height {x, y, w, h}, scaled back up to the source width, 16:9 kept by the caller.
export function crop(file, box, out, width) { const [W, H] = size(file); const x = Math.round(box.x * W), y = Math.round(box.y * H), w = Math.round(box.w * W), h = Math.round(box.h * H); ff(["-i", file, "-vf", `crop=${w}:${h}:${x}:${y},scale=${width || W}:-2`, out]); return out; }
// Black letterbox or pillarbox bars around the picture (ffmpeg's cropdetect), in pixels per side. frac: the share of the
// height or width they take; boxed (a flag) at 5% or more, since the stitch crops anything thinner by code. The painter added
// 24-pixel bars top and bottom to four Top Gun stills (1.6% a side), and a bar painted into a master is inherited by every
// still built on it.
export function bars(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-vf", "cropdetect=limit=18:round=2:skip=0", "-frames:v", "1", "-f", "null", "-"]);
  const all = r.stderr.toString().match(/crop=\d+:\d+:\d+:\d+/g), m = all && all[all.length - 1].match(/crop=(\d+):(\d+):(\d+):(\d+)/), [W, H] = size(file);
  if (!m) return { top: 0, bottom: 0, left: 0, right: 0, frac: 0, boxed: false };
  const w = Number(m[1]), h = Number(m[2]), x = Number(m[3]), y = Number(m[4]), out = { top: y, bottom: H - y - h, left: x, right: W - x - w };
  out.frac = Math.round(Math.max((out.top + out.bottom) / H, (out.left + out.right) / W) * 1000) / 1000; out.boxed = out.frac >= 0.05; return out;
}
// A downscaled JPEG for pages.
export function thumb(file, out, width = 1000) { ff(["-i", file, "-vf", `scale='min(${width},iw)':-2`, "-q:v", "5", out]); return out; }
// Normalise and concatenate clips into one film (1280×720, 24 fps, aac).
export const fps = (file) => { const r = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", file]).toString().trim().split("/"); return r.length === 2 ? Number(r[0]) / Number(r[1]) : Number(r[0]) || 24; };
// Normalise and concatenate clips into one film (1280×720, aac). The frame rate is the clips' own (the first clip's), never
// forced: forcing 24 on 30-fps clips dropped one frame in five and juddered through every clip (current/research, A4.5).
export const hasAudio = (file) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file]).toString().includes("audio");
// Peak level of a file's audio in dB (volumedetect); -91 or so for digital silence, null without an audio stream.
export const peakDb = (file) => { if (!hasAudio(file)) return null; const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]); const m = r.stderr.toString().match(/max_volume:\s*(-?[\d.]+) dB/); return m ? Number(m[1]) : null; };
export function stitch(partsIn, listFile, out) {
  const parts = partsIn.map((p) => (typeof p === "string" ? { file: p } : p)), files = parts.map((p) => p.file);
  const rate = Math.max(...files.map((p) => Math.round(fps(p) * 1000) / 1000));   // the highest rate among the parts: a 24-fps title card never drags a 30-fps clip down
  const norm = parts.map(({ file: p, seconds, speed = 1 }, i) => { const q = p.replace(/\.mp4$/, "-part.mp4"); const silent = !hasAudio(p), quiet = silent || (peakDb(p) ?? -99) < -60;   // a part without sound gets a silent track; a silent track is not normalised (loudnorm on silence yields NaN and the encoder refuses it: the title card)
    // Thin black bars (a painter's letterbox carried into the clip) are cropped off before scaling; a bar above 10% is left
    // alone (a title card's black field would otherwise be "cropped" to its lettering).
    const lb = bars(p), [W, H] = size(p), cut = lb.frac > 0 && lb.frac <= 0.1 ? `crop=${W - lb.left - lb.right}:${H - lb.top - lb.bottom}:${lb.left}:${lb.top},` : "";
    const fit = cut ? "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" : "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2";   // a cut picture fills the frame (a slight zoom); an intact one is fitted
    const faster = speed > 1 ? `setpts=PTS/${speed},` : "", atempo = speed > 1 ? `atempo=${Math.min(2, speed)},` : "";   // faster playback: fewer seconds of motion, sound kept in pitch
    ff(["-i", p, ...(silent ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []), ...(seconds ? ["-t", String(seconds)] : []), "-vf", `setpts=PTS-STARTPTS,${faster}${cut}${fit},fps=${rate},format=yuv420p`, "-af", quiet ? `${atempo}aresample=48000` : `${atempo}loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000`, ...(silent ? ["-map", "0:v", "-map", "1:a", "-shortest"] : []), "-c:v", "libx264", "-crf", "18", "-c:a", "aac", q]); return q; });
  writeFileSync(listFile, norm.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out]);
  return out;
}
