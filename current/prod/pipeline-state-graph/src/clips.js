// Clips: motion and luma analysis, the continuous-seam fix, the stitch and the seam measures.
// Measured on wan-3.0 start-only clips (48 clips, 15 continuous joins): the tail does not freeze; the next clip's frame 0 is a
// darker (−2.4 luma) near-duplicate of the handoff frame (a 1-frame stall), the luma climbs back over ~5 frames, and the first
// 10 frames move at ~0.7× the previous tail. Fix: drop frame 0 (plus up to 2 more while the luma is off by > 1.0), then add a
// per-frame luma offset to the first 5 kept frames so they sit at the clip's own level. No end frames (freeze-then-snap).
// Seam metrics on brightness-compensated jumps (c): V = head speed / tail speed (clean 0.8–1.25), S = seam step / median
// (clean 0.7–1.3; < 0.5 = stall), L = |luma step| + |luma ramp| (clean < 1.0).
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { ssim } from "../../state-manager/src/continuity.js";

const W = 160, H = 90;
export function frameCount(f) { return Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f]).toString().trim()); }
export function duration(f) { return Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", f]).toString().trim()); }
export function fps(f) { const [a, b] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", f]).toString().trim().split("/").map(Number); return b ? a / b : a || 30; }
export function hasAudio(f) { return !!execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", f]).toString().trim(); }

// Gray 160×90 frames → per-frame luma and brightness-compensated jumps c[k] = mean |(f[k] − f[k−1]) − (Y[k] − Y[k−1])|.
export function analyze(file) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(buf.length / (W * H)), Y = [], c = [], raw = [];
  for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < W * H; i++) s += buf[k * W * H + i]; Y.push(s / (W * H)); }
  for (let k = 1; k < n; k++) {
    const d = Y[k] - Y[k - 1]; let s = 0, r = 0;
    for (let i = 0; i < W * H; i++) { const x = buf[k * W * H + i] - buf[(k - 1) * W * H + i]; r += Math.abs(x); s += Math.abs(x - d); }
    c.push(s / (W * H)); raw.push(r / (W * H));
  }
  const med = median(c);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const steady = mean(Y.slice(5, 10));
  // Frames to reach 0.7× the median speed (the motion ramp), tail speed vs median, end snap.
  let ramp = 0; for (let k = 0; k < Math.min(30, c.length); k++) if (mean(c.slice(k, k + 5)) >= 0.7 * med) { ramp = k; break; } else ramp = k + 1;
  return { frames: n, median_c: r3(med), Y: Y.map(r3), c: c.map(r3), raw: raw.map(r3), steady_luma: r3(steady),
    head_luma_offsets: Y.slice(0, 5).map((y) => r3(y - steady)), ramp_frames: ramp,
    tail_speed: r3(mean(c.slice(-10)) / (med || 1)), head_speed: r3(mean(c.slice(0, 10)) / (med || 1)), end_snap: r3(Math.max(...c.slice(-2)) / (med || 1)) };
}
const r3 = (x) => Number(Number(x).toFixed(3));
export function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }

// The fix for a clip that continues from the previous clip: how many head frames to drop and the luma offsets to add.
export function seamFix(an, { maxDrop = 3 } = {}) {
  let drop = 1;
  while (drop < maxDrop && Math.abs(an.Y[drop] - an.steady_luma) > 1.0) drop++;
  const offsets = an.Y.slice(drop, drop + 5).map((y) => r3(an.steady_luma - y));
  return { drop, offsets: offsets.map((o) => (Math.abs(o) > 0.3 ? o : 0)) };
}

// Writes dst: src with `drop` head frames removed, luma offsets added to the first kept frames, 1280×720 30 fps, audio kept in sync.
export function cutClip(src, dst, { drop = 0, offsets = [] } = {}) {
  const ramp = offsets.map((o, i) => `if(eq(N,${i}),${o},`).join("") + "0" + ")".repeat(offsets.length);
  const geq = offsets.some((o) => o) ? `,geq=lum='clip(lum(X,Y)+(${ramp}),0,255)':cb='cb(X,Y)':cr='cr(X,Y)'` : "";
  const vf = `trim=start_frame=${drop},setpts=PTS-STARTPTS${geq},scale=1280:720:flags=lanczos,setsar=1,fps=30,format=yuv420p`;
  const audio = hasAudio(src) ? ["-af", `atrim=start=${(drop / fps(src)).toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000`, "-c:a", "aac", "-b:a", "192k"] : ["-an"];
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", vf, ...audio, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", dst], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`cutClip failed: ${r.stderr.slice(-400)}`);
  return dst;
}

// Hard joins at native 30 fps; each clip's own audio levelled, padded or cut to its picture, 50 ms fades (the cue-sheet mix replaces it).
export function stitch(runDir, parts, out) {
  const ids = parts.map((p) => p.file);
  const audioOf = (f, i) => {
    const d = duration(join(runDir, f));
    const src = hasAudio(join(runDir, f)) ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,apad` : "anullsrc=r=48000:cl=stereo";
    return `${src},atrim=duration=${d},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, d - 0.05)}:d=0.05[a${i}]`;
  };
  const graph = [...ids.map((_, i) => `[${i}:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v${i}]`), ...ids.map(audioOf)].join(";") + ";" + ids.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${ids.length}:v=1:a=1[v][a]`;
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...ids.flatMap((f) => ["-i", join(runDir, f)]), "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-c:a", "aac", "-b:a", "192k", join(runDir, out)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`stitch failed: ${r.stderr.slice(-400)}`);
  return out;
}
export function strip(src, dst) { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "fps=2,scale=320:-2,tile=5x2", "-frames:v", "1", dst]); }

// Seam metrics between the analysis of A (its tail) and B (its head). before = raw B, after = the cut B.
export function seamMetrics(a, b) {
  const mean = (x) => x.reduce((p, q) => p + q, 0) / (x.length || 1);
  const med = median([...a.c, ...b.c]) || 1;
  // The step across the seam: the compensated difference between A's last frame and B's first is not in either series, so it
  // is estimated from the stitched video by the caller; here V and L come from the two clips.
  return { V: r3(mean(b.c.slice(0, 10)) / (mean(a.c.slice(-10)) || 1)), L: r3(Math.abs(b.Y[0] - a.Y.at(-1)) + Math.abs((b.Y[5] ?? b.Y.at(-1)) - b.Y[0])), median_c: r3(med) };
}
// Measures over the final picture: per join the compensated step S at the seam, the raw jump, V, L, and the seam SSIM.
export function measures(runDir, parts, finalFile, analyses) {
  const fin = analyze(join(runDir, finalFile));
  const out = { median_jump: fin.median_c, joins: [], clips: {} };
  let at = 0;
  for (const [i, p] of parts.entries()) {
    const a = analyses[p.id];
    out.clips[p.id] = { frames: a.after.frames, first_vs_start: p.start ? ssim(join(runDir, `${p.id}-first.png`), join(runDir, p.start), { fit: true }) : null, ramp_frames: a.raw.ramp_frames,
      head_speed: a.raw.head_speed, tail_speed: a.raw.tail_speed, end_snap: a.raw.end_snap, dropped: a.fix?.drop || 0, luma_offsets: a.fix?.offsets || [], frame0_luma_offset: a.raw.head_luma_offsets[0] };
    at += a.after.frames;
    if (i < parts.length - 1) {
      const q = parts[i + 1], b = analyses[q.id], seamC = fin.c[at - 1] ?? 0, med = median([...a.after.c, ...b.after.c]) || 1;
      const before = seamMetrics(a.raw, b.raw), after = seamMetrics(a.after, b.after);
      out.joins.push({ from: p.id, to: q.id, link: q.link, seam_ssim: ssim(join(runDir, `${p.id}-last.png`), join(runDir, `${q.id}-first.png`)),
        jump: r3(fin.raw[at - 1] ?? 0), S: r3(seamC / med), V: after.V, L: after.L, before: { V: before.V, L: before.L, S_est: r3((b.raw.c[0] || 0) / med) },
        pass: q.link !== "continuous" ? null : after.V >= 0.8 && after.V <= 1.25 && seamC / med >= 0.6 && after.L < 1.0, dropped: b.fix?.drop || 0 });
    }
  }
  return out;
}
