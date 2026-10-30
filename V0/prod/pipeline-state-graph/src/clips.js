// Clips: motion and luma analysis, the continuous-seam fix, the stitch and the seam measures.
// Measured on wan-3.0 start-only clips (48 clips, 15 continuous joins): the tail does not freeze; the next clip's frame 0 is a
// darker (−2.4 luma) near-duplicate of the handoff frame (a 1-frame stall), the luma climbs back over ~5 frames, and the first
// 10 frames move at ~0.7× the previous tail. Fix: drop frame 0 (plus up to 2 more while the luma is off by > 1.0), then add a
// per-frame luma offset to the first 5 kept frames so they sit at the clip's own level. No end frames (freeze-then-snap).
// Seam metrics on brightness-compensated jumps (c): V = head speed / tail speed, S = seam step / median,
// L = |luma step| + |luma ramp|, plus seam_ssim between the handoff frames.
// Gate thresholds (SEAM) are PROVISIONAL. They are fitted to 7 continuous and 10 cut joins from a single case
// (current/tests/pipeline-state-graph/runs/p4-lighthouse-v{1,2,3}/run.json) read against tests/compare/index.html, and
// exactly ONE of those 7 continuous joins is clean (v3 b5→b6). One example cannot establish a band: treat a pass outside
// p4-lighthouse as unproven until a second case is measured.
//   ssim  the best-evidenced term. Joins that really start from the handoff frame measure 0.992–0.995 (v3, unedited
//         starts); an edited or re-generated start drops to 0.956 / 0.809 / 0.434 (v1, v2 — all three read as broken).
//         Cuts measure 0.206–0.371, so a cut above 0.5 did not cut. Note it is measured on the raw frame 0, before the
//         head drop, so it answers "did generation start from the handoff image", not "is the final join smooth".
//   S     0 (byte-identical) and 0.198 are v3's two duplicate joins; the next value up is 0.599, so the dup band is wide.
//         2.85 and 16.63 are the two visible jolts — the old gate tested `S >= 0.6` only, so 16.63 passed it.
//   V     NOT evidenced. The one clean join measures 0.645, which clears the 0.6 floor by 0.045; every other value in the
//         range comes from a join this gate fails. A legitimately accelerating subject (the desert-tokyo car) will exceed
//         1.7 without anything being wrong.
//   L     NOT evidenced, and the reason the old gate never passed anything: no join ever reached the old `L < 1.0` — the
//         floor across all runs is 1.26. The luma offsets do work (L falls to 0.21–0.60 of its before-fix value), but 3.0
//         is a ceiling drawn above the observed values, not a measured boundary; a legitimate large luma step at a
//         continuous join (a lamp igniting) would breach it. Cuts reach 89 (a location change), so L never applies to a cut.
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
  return { frames: n, median_c: r3(med), median_raw: r3(median(raw)), Y: Y.map(r3), c: c.map(r3), raw: raw.map(r3), steady_luma: r3(steady),
    head_luma_offsets: Y.slice(0, 5).map((y) => r3(y - steady)), ramp_frames: ramp,
    tail_speed: r3(mean(c.slice(-10)) / (med || 1)), head_speed: r3(mean(c.slice(0, 10)) / (med || 1)), end_snap: r3(Math.max(...c.slice(-2)) / (med || 1)) };
}
const r3 = (x) => Number(Number(x).toFixed(3));
export function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }

// fit[k] = mean abs diff (gray 160×90) between the previous clip's last frame and frame k of this clip, k < K.
// Needs both files because analyze() keeps only aggregates, not pixels (run.json would carry the buffers otherwise).
export function headFit(prevFile, file, K = 6) {
  const gray = (f, args) => execFileSync("ffmpeg", ["-loglevel", "error", ...args, "-i", f, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
  const prev = gray(prevFile, ["-sseof", "-0.2"]), head = gray(file, []);
  const last = prev.subarray(Math.max(0, Math.floor(prev.length / (W * H)) - 1) * W * H);
  const n = Math.min(K, Math.floor(head.length / (W * H)));
  return Array.from({ length: n }, (_, k) => { let s = 0; for (let i = 0; i < W * H; i++) s += Math.abs(head[k * W * H + i] - last[i]); return r3(s / (W * H)); });
}

// The fix for a clip that continues from the previous clip: how many head frames to drop and the luma offsets to add.
// With `fit` (headFit) the drop also removes a duplicated handoff frame — the rule ported from pipeline-memory's trimPlan,
// the only one measured to clear the duplicate: frame k is a duplicate while it sits below `dup` × this clip's own median
// motion, and the head starts at the first frame that moves.
export function seamFix(an, { maxDrop = 3, fit = null, dup = 0.25 } = {}) {
  let drop = 1;
  while (drop < maxDrop && Math.abs(an.Y[drop] - an.steady_luma) > 1.0) drop++;
  let duplicate = null;
  if (fit?.length) {
    const t = dup * (an.median_raw || 0);
    // The head starts at the first frame that moves away from the handoff frame; everything before it duplicates it.
    // `exhausted` = no frame in the window moved, so the whole window duplicates and motion starts at or beyond it — the
    // worst case there is, which the earlier rule turned into the smallest drop. `maxDrop` is the luma guard and does not
    // bound this: these frames were each measured as duplicates, so the examined window is the only honest bound.
    const first = fit.findIndex((d) => d >= t);
    const frames = first < 0 ? fit.length : first;
    duplicate = { threshold: r3(t), fit, pick: frames, frames, exhausted: first < 0, capped: first < 0 };
    drop = Math.max(drop, frames);
  }
  drop = Math.min(drop, Math.max(1, (an.frames || 1) - 2)); // never trim a clip away entirely
  const offsets = an.Y.slice(drop, drop + 5).map((y) => r3(an.steady_luma - y));
  return { drop, offsets: offsets.map((o) => (Math.abs(o) > 0.3 ? o : 0)), ...(duplicate ? { duplicate } : {}) };
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
// Gate thresholds. Every number is calibrated on the recorded joins — see the header.
export const SEAM = {
  handoff: 0.98,  // continuous: seam_ssim below this = the clip did not start from the real handoff frame
  dup: 0.25,      // continuous: S below this = the handoff frame plays twice
  stall: 0.6,     // continuous: S below this = motion reset
  jolt: 2.0,      // continuous: S above this = a visible step
  V: [0.6, 1.7],  // continuous: head/tail speed ratio
  L: 3.0,         // continuous: |luma step| + |luma ramp| after the offset fix
  cut: 0.5,       // cut: seam_ssim at or above this = the two shots still look alike, so the cut did not cut
};

// One verdict per join, per term, so a failure says which term broke and why. A cut and a continuous join have opposite
// requirements: a continuous join must be nearly identical at the handoff and keep moving; a cut must look different.
// terms[k] = "ok" | a short reason. Hard faults (a frame plays twice, a jolt, a failed cut, a lost handoff) set ok = false;
// drift in V or L is recorded as a soft fault and leaves ok true, because clean joins already span most of that range.
export function seamVerdict({ link, S, V, L, seam_ssim }) {
  const terms = {}, faults = [], soft = [];
  if (link === "continuous") {
    terms.ssim = seam_ssim >= SEAM.handoff ? "ok" : `handoff lost (${seam_ssim} < ${SEAM.handoff}): the start frame is not the previous clip's last frame`;
    terms.S = S < SEAM.dup ? `duplicate (S ${S} < ${SEAM.dup}): the handoff frame plays twice`
      : S < SEAM.stall ? `stall (S ${S} < ${SEAM.stall}): motion resets at the join`
      : S > SEAM.jolt ? `jolt (S ${S} > ${SEAM.jolt}): a visible step at the join` : "ok";
    terms.V = V >= SEAM.V[0] && V <= SEAM.V[1] ? "ok" : `speed ${V} outside ${SEAM.V[0]}–${SEAM.V[1]}`;
    terms.L = L < SEAM.L ? "ok" : `luma ${L} over ${SEAM.L}`;
    for (const k of ["ssim", "S"]) if (terms[k] !== "ok") faults.push(terms[k]);
    for (const k of ["V", "L"]) if (terms[k] !== "ok") soft.push(terms[k]);
  } else {
    terms.ssim = seam_ssim < SEAM.cut ? "ok" : `cut did not cut (${seam_ssim} ≥ ${SEAM.cut}): the two shots still look alike`;
    if (terms.ssim !== "ok") faults.push(terms.ssim);
  }
  return { pass: !faults.length, faults, soft, terms };
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
      const j = { from: p.id, to: q.id, link: q.link, seam_ssim: ssim(join(runDir, `${p.id}-last.png`), join(runDir, `${q.id}-first.png`)),
        jump: r3(fin.raw[at - 1] ?? 0), S: r3(seamC / med), V: after.V, L: after.L, before: { V: before.V, L: before.L, S_est: r3((b.raw.c[0] || 0) / med) },
        dropped: b.fix?.drop || 0, duplicate_fix: b.fix?.duplicate ?? null };
      out.joins.push({ ...j, ...seamVerdict(j) });
    }
  }
  return out;
}
