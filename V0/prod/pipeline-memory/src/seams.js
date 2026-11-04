// Seams between clips: per-frame motion, trims at continuous joins, stitch (trim + crossfade), seam measures.
// Unit: mean abs diff of 320x180 grayscale frames (0-255). Evidence (wan-3.0 i2v, p4-lighthouse-v1): frame 0 of a
// continuation clip is an odd dark frame (2.3-2.6 off the source frame; frame 1 sits 0.7-1.5 off), then some clips stall
// 2-6 frames (motion reset); no static hold, no end settle, no duplicate frame. Crossfades blur motion: default is trim + hard join.
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { ssim } from "../../state-manager/src/continuity.js";

const W = 320, H = 180, PX = W * H, FPS = 30;
const round = (x, d = 2) => Number(x.toFixed(d));
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr.toString().slice(-800)}`);
  return r;
}
// All frames of a video as 320x180 gray buffers.
export function grayFrames(video) {
  const out = run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", video, "-an", "-vf", `scale=${W}:${H},format=gray`, "-fps_mode", "passthrough", "-f", "rawvideo", "-"]).stdout;
  return Array.from({ length: Math.floor(out.length / PX) }, (_, i) => out.subarray(i * PX, (i + 1) * PX));
}
export function frameDiff(a, b) { let s = 0; for (let i = 0; i < PX; i++) s += Math.abs(a[i] - b[i]); return round(s / PX); }
const profileOf = (f) => f.slice(1).map((x, i) => frameDiff(x, f[i]));

// p[i] = diff between frame i+1 and frame i (length = frames - 1).
export function motionProfile(video) { return profileOf(grayFrames(video)); }

// Near-static frames (diff < frac * ref; ref = the clip median by default) at the start / end: the frames to trim.
export function holdAtStart(p, { frac = 0.25, max = 15, ref = median(p) } = {}) { const t = frac * ref; let k = 0; while (k < max && k < p.length && p[k] < t) k++; return k; }
export function settleAtEnd(p, { frac = 0.25, max = 15, ref = median(p) } = {}) { const t = frac * ref; let k = 0; while (k < max && k < p.length && p[p.length - 1 - k] < t) k++; return k; }
// End-frame snap (diff > mult * median) in the last frames.
export function snapAtEnd(p, { mult = 3, max = 5 } = {}) { const t = mult * median(p); let k = 0; while (k < max && k < p.length && p[p.length - 1 - k] > t) k++; return k; }

// Clip facts for trimPlan. fit[k] = diff(last frame of prev clip, frame k of this clip), k < K.
export function analyze(video, prev = null, K = 6) {
  const f = grayFrames(video), a = { frames: f.length, profile: profileOf(f), last: f.at(-1) };
  if (prev) a.fit = f.slice(0, K).map((x) => frameDiff(prev.last, x));
  return a;
}

// clips[i] = analyze() result; links[i] = link INTO clip i ('cut' | 'continuous'; links[0] is ignored).
// Trims only at continuous joins. Head: max(start hold, 1 if frame 0 duplicates the source, pick + stall), where
// pick = best-fitting frame of the first K vs the source frame (skips the odd frame 0) and stall = frames after pick that move
// < stallFrac x the previous clip's tail motion (motion reset). Tail of the previous clip: max(settle, snap). Keep >= 90% of each clip.
export function trimPlan(clips, links, { frac = 0.25, stallFrac = 0.5, stallMax = 8, keep = 0.9, tie = 1.1 } = {}) {
  const plan = clips.map((c) => ({ headTrim: 0, tailTrim: 0, frames: c.frames }));
  for (let i = 1; i < clips.length; i++) {
    if (links[i] !== "continuous") continue;
    const c = clips[i], p = clips[i - 1], dupT = frac * median(c.profile), fit = c.fit || [];
    const duplicate = fit.length > 0 && fit[0] < dupT;
    const ok = fit.map((d, k) => [d, k]).filter(([d]) => d >= dupT);
    const best = ok.length ? Math.min(...ok.map(([d]) => d)) : 0;
    const pick = ok.length ? ok.find(([d]) => d <= best * tie)[1] : 0;
    const hold = holdAtStart(c.profile, { frac }), settle = settleAtEnd(p.profile, { frac }), snap = snapAtEnd(p.profile);
    const stall = holdAtStart(c.profile.slice(pick), { frac: stallFrac, max: stallMax, ref: median(p.profile.slice(-15)) });
    Object.assign(plan[i], { headTrim: Math.max(hold, pick + stall, duplicate ? 1 : 0), hold, pick, stall, duplicate, fit });
    Object.assign(plan[i - 1], { tailTrim: Math.max(settle, snap), settle, snap });
  }
  for (const t of plan) {
    const budget = Math.floor(t.frames * (1 - keep));
    t.headTrim = Math.min(t.headTrim, budget);
    t.tailTrim = Math.min(t.tailTrim, budget - t.headTrim);
  }
  return plan;
}

const hasAudio = (f) => run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", f]).stdout.toString().trim() !== "";

// Scale to 1280x720 @30, trim, hard-join cuts, crossfade continuous joins (xfadeFrames 0 = plain concat; trim false = no trims).
// Returns { out, duration, starts (s, each clip's first kept frame in the output), segments, plan }.
export function stitch({ runDir = ".", clips, links, out, audio = true, xfadeFrames = 0, trim = true }) {
  out = resolve(runDir, out);
  const files = clips.map((c) => resolve(runDir, c.file));
  const info = []; for (let i = 0; i < files.length; i++) info.push(analyze(files[i], links[i] === "continuous" ? info[i - 1] : null));
  const plan = trim ? trimPlan(info, links) : info.map((c) => ({ headTrim: 0, tailTrim: 0, frames: c.frames }));
  const xs = xfadeFrames / FPS, g = [], starts = [];
  let v = "v0", a = "a0", dur = 0;
  files.forEach((f, i) => {
    const { headTrim: h, tailTrim: t, frames: n } = plan[i], d = (n - h - t) / FPS;
    g.push(`[${i}:v]scale=1280:720,setsar=1,fps=${FPS},format=yuv420p,trim=start_frame=${h}:end_frame=${n - t},setpts=PTS-STARTPTS,settb=1/${FPS}[v${i}]`);
    if (audio) g.push(hasAudio(f)
      ? `[${i}:a]atrim=start=${h / FPS},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${d}[a${i}]`
      : `anullsrc=r=48000:cl=stereo,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${d}[a${i}]`);
    if (i === 0) { starts.push(0); dur = d; return; }
    const fade = xfadeFrames > 0 && links[i] === "continuous" && d > xs && dur > xs;
    if (fade) {
      const off = round(dur - xs, 4);
      g.push(`[${v}][v${i}]xfade=transition=fade:duration=${xs}:offset=${off}[vx${i}]`);
      if (audio) g.push(`[${a}][a${i}]acrossfade=d=${xs}[ax${i}]`);
      starts.push(off); dur = off + d;
    } else {
      g.push(`[${v}][v${i}]concat=n=2:v=1:a=0,settb=1/${FPS}[vx${i}]`);
      if (audio) g.push(`[${a}][a${i}]concat=n=2:v=0:a=1[ax${i}]`);
      starts.push(dur); dur += d;
    }
    plan[i].xfade = fade ? xfadeFrames : 0;
    v = `vx${i}`; a = `ax${i}`;
  });
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  files.forEach((f) => args.push("-i", f));
  args.push("-filter_complex", g.join(";"), "-map", `[${v}]`);
  if (audio) args.push("-map", `[${a}]`, "-c:a", "aac", "-b:a", "192k");
  args.push("-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", out);
  run("ffmpeg", args);
  const segments = clips.map((c, i) => ({ id: c.id, start: round(starts[i], 3), headTrim: plan[i].headTrim, tailTrim: plan[i].tailTrim, xfade: plan[i].xfade || 0 }));
  return { out, duration: round(dur, 3), starts: segments.map((s) => s.start), segments, plan };
}

// Seam measures on a FINAL video, so a hard concat (before) and the stitched output (after) compare 1:1.
// starts/xfade: from stitch(); default = untrimmed hard concat. jump = max frame diff across the seam window,
// dip = min diff within ±10 frames of the seam / median diff of the two segments (freeze ~ 0),
// carry = mean diff of the 6 frames after the seam window / the 6 before (motion reset < 1), seam_ssim = frame before vs frame after the window.
// hold/settle/duplicate come from the source clips. median_jump covers continuous joins only.
export function measureJoins({ runDir = ".", clips, links, final, starts, xfade, frac = 0.25, span }) {
  const info = []; clips.forEach((c, i) => info.push(analyze(resolve(runDir, c.file), links[i] === "continuous" ? info[i - 1] : null)));
  if (!starts) { starts = [0]; for (let i = 1; i < info.length; i++) starts.push(starts[i - 1] + info[i - 1].frames / FPS); }
  xfade ||= clips.map(() => 0);
  const ff = grayFrames(resolve(runDir, final)), P = profileOf(ff), tmp = mkdtempSync(join(tmpdir(), "seams-"));
  const at = (s) => Math.round(s * FPS);
  try {
    const joins = [];
    for (let i = 1; i < clips.length; i++) {
      const s = at(starts[i]), x = span ?? (xfade[i] || 0), end = i + 1 < clips.length ? at(starts[i + 1]) : ff.length;
      const win = P.slice(Math.max(0, s - 1), s + x), near = P.slice(Math.max(0, s - 11), Math.min(P.length, s + x + 10));
      const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      const carry = round(mean(P.slice(s + x, s + x + 6)) / mean(P.slice(Math.max(0, s - 7), s - 1)));
      const m = median(P.slice(at(starts[i - 1]), Math.min(P.length, end - 1)));
      const pre = join(tmp, `${i}-a.png`), post = join(tmp, `${i}-b.png`);
      png(ff[s - 1], pre); png(ff[Math.min(ff.length - 1, s + x)], post);
      const c = info[i], fit = c.fit || [];
      joins.push({ from: clips[i - 1].id, to: clips[i].id, link: links[i], seam_ssim: ssim(pre, post), jump: Math.max(...win), jump_rel: round(Math.max(...win) / m),
        dip: round(Math.min(...near) / m), carry, hold_frames: holdAtStart(c.profile, { frac }), settle_frames: settleAtEnd(info[i - 1].profile, { frac }),
        duplicate: links[i] === "continuous" && fit.length > 0 && fit[0] < frac * median(c.profile), source_jump: fit[0] ?? null });
    }
    const cont = joins.filter((j) => j.link === "continuous");
    return { median_motion: median(P), median_jump: median(cont.map((j) => j.jump)), joins };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
function png(buf, out) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", `${W}x${H}`, "-i", "-", "-frames:v", "1", out], { input: buf });
  if (r.status !== 0) throw new Error(`ffmpeg png failed: ${r.stderr.toString().slice(-400)}`);
}
