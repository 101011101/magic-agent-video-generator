// Audio Agent: cue sheet (cues.json, editable) -> ambient beds per location -> placeholder score -> TTS voiceover -> mix.
// Clip audio (wan-3.0 diegetic sound, -16 LUFS per clip) stays at 0 dB; beds (-24 LUFS) run under each location run
// to hide the per-clip sound reset at seams; score (-26 LUFS) is ffmpeg-synthesised (no music model on this API).
// VO ducks the rest by -6 dB. Final: loudnorm I=-16 TP=-1.5 LRA=11 (two-pass), aac 192k, video copied.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { download, COST } from "./common.js";

const FF = process.env.FFMPEG || "ffmpeg", FP = process.env.FFPROBE || "ffprobe", SR = 48000;
export const VOICE = process.env.MH_VOICE || "David Attenborough"; // calm narrator preset (1266 presets; names in docs: Morgan Freeman, David Attenborough)
export const SYNTH = "synth placeholder: no music model on this API";
const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loc";
const kindOf = (c) => (/^(in|out|motif|swell)\b/.exec(c.text) || [])[1];

function ff(args, bin = FF) {
  const r = spawnSync(bin, ["-hide_banner", ...args], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${bin} failed: ${r.stderr.toString().slice(-1200)}`);
  return r.stderr.toString() + r.stdout.toString();
}
const probe = (f, q) => spawnSync(FP, ["-v", "error", ...q, "-of", "csv=p=0", f]).stdout.toString().trim();
export const duration = (f) => Number(probe(f, ["-show_entries", "format=duration"]));
export const hasAudio = (f) => probe(f, ["-select_streams", "a", "-show_entries", "stream=index"]) !== "";
// Integrated loudness (LUFS) of a file, or -70 for silence.
export function lufs(f) {
  const m = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(ff(["-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"]).split("Summary:").pop());
  return m && m[1] !== "-inf" ? Number(m[1]) : -70;
}
// Static gain so the file sits at target LUFS (beds/score are steady, so no dynamic loudnorm).
function normTo(raw, outFile, target) {
  const g = clamp(target - lufs(raw), -40, 40);
  ff(["-y", "-i", raw, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.89:level=false`, "-ar", SR, "-ac", 2, "-c:a", "pcm_s16le", outFile]);
  return g;
}

// 1. Cue sheet. Times are in the final video (timeline = stitch output). Writes `file` when given.
export function cueSheet(plan, timeline, file) {
  const seg = Object.fromEntries(timeline.map((s) => [s.id, s]));
  const shot = Object.fromEntries((plan.shots || []).map((s) => [s.id, s]));
  const totalS = Math.max(...timeline.map((s) => s.end_s));
  const at = (id, s) => { const g = seg[id]; return g && r2(g.start_s + clamp(s || 0, 0, g.end_s - g.start_s - 0.05)); };
  const cues = [];
  // ambient: one cue per run of consecutive segments in the same location
  for (let i = 0; i < timeline.length;) {
    let j = i; while (j + 1 < timeline.length && timeline[j + 1].location === timeline[i].location) j++;
    const run = timeline.slice(i, j + 1), loc = timeline[i].location;
    const text = [...new Set(run.map((g) => shot[g.id]?.sound?.ambient).filter(Boolean))].join("; ");
    cues.push({ t: r2(run[0].start_s), type: "ambient", shot: run[0].id, text, source: `bed:${loc}`, gain_db: 0, fade_s: 1, until: r2(run.at(-1).end_s) });
    i = j + 1;
  }
  for (const g of timeline) for (const e of shot[g.id]?.sound?.effects || [])
    cues.push({ t: at(g.id, e.at_s), type: "sfx", shot: g.id, text: e.text, source: "clip", gain_db: 0, fade_s: 0, until: null });
  const music = (plan.audio?.music || []).filter((m) => seg[m.shot]).map((m) => ({ ...m, t: at(m.shot, m.at_s) })).sort((a, b) => a.t - b.t);
  music.forEach((m, k) => {
    const out = m.kind === "in" ? music.slice(k + 1).find((x) => x.kind === "out" || x.kind === "in") : null;
    cues.push({ t: m.t, type: "music", shot: m.shot, text: `${m.kind}: ${m.text}`, source: SYNTH, gain_db: m.kind === "swell" ? 4 : 0,
      fade_s: m.kind === "in" ? 2 : m.kind === "out" ? 3 : 0, until: m.kind === "in" ? (out ? out.t : r2(totalS)) : null });
  });
  for (const v of plan.audio?.voiceover || []) if (seg[v.shot])
    cues.push({ t: at(v.shot, v.at_s), type: "voiceover", shot: v.shot, text: v.text, source: "tts", gain_db: 0, fade_s: 0, until: null });
  cues.sort((a, b) => a.t - b.t || a.type.localeCompare(b.type)).forEach((c, i) => (c.n = i + 1));
  const out = cues.map(({ n, ...c }) => ({ n, ...c }));
  if (file) writeFileSync(file, JSON.stringify(out, null, 2));
  return out;
}

const runRel = (run, f) => (isAbsolute(f) ? relative(run.dir, f) : f);
const abs = (run, f) => (isAbsolute(f) ? f : run.path(f));
export const bedFile = (loc) => `audio/bed-${slug(loc)}.wav`;

// 2. Ambient bed per location: clip audio of that location, crossfaded end to end and cycled to the longest run, LP 4 kHz, -24 LUFS.
export async function beds(run, timeline, clipsDir = run.dir) {
  mkdirSync(run.path("audio"), { recursive: true });
  const spans = {};
  for (let i = 0; i < timeline.length;) {
    let j = i; while (j + 1 < timeline.length && timeline[j + 1].location === timeline[i].location) j++;
    const loc = timeline[i].location; spans[loc] = Math.max(spans[loc] || 0, timeline[j].end_s - timeline[i].start_s); i = j + 1;
  }
  const res = {};
  for (const [loc, span] of Object.entries(spans)) {
    const clips = [...new Set(timeline.filter((g) => g.location === loc).map((g) => join(clipsDir, `${g.id}.mp4`)))].filter((f) => existsSync(f) && hasAudio(f));
    if (!clips.length) { res[loc] = null; continue; }
    const file = bedFile(loc), L = span + 1;
    await run.job(`bed:${loc}`, file, { loc, L, lp: 4000, lufs: -24 }, clips.map((f) => runRel(run, f)), 0, async () => {
      const t0 = Date.now(), lens = clips.map(duration), xf = clamp(Math.min(...lens) / 4, 0.1, 0.5);
      const seq = []; let len = 0;
      for (let k = 0; len < L || seq.length < 2; k++) { seq.push(k % clips.length); len += lens[k % clips.length] - (seq.length > 1 ? xf : 0); if (seq.length > 200) break; }
      const pre = seq.map((c, k) => `[${k}:a]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo[p${k}]`);
      let last = "p0"; const chain = seq.slice(1).map((_, k) => { const o = `x${k + 1}`, s = `[${last}][p${k + 1}]acrossfade=d=${xf}:c1=tri:c2=tri[${o}]`; last = o; return s; });
      const fc = [...pre, ...chain, `[${last}]lowpass=f=4000,atrim=0:${L.toFixed(3)},afade=t=in:d=0.05[out]`].join(";");
      const raw = run.path(`audio/bed-${slug(loc)}.raw.wav`);
      ff(["-y", ...seq.flatMap((c) => ["-i", clips[c]]), "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_s16le", raw]);
      const gain = normTo(raw, run.path(file), -24);
      return { credits: 0, seconds: Math.round((Date.now() - t0) / 1000), clips: clips.map((f) => runRel(run, f)), length_s: r2(L), gain_db: r2(gain) };
    });
    res[loc] = file;
  }
  return res;
}

// 3. Placeholder score: A-minor pad (A2 C3 E3 A3, detuned pairs), slow tremolo, LP 1.2 kHz, aecho; only inside in..until spans
// with fades; swell = +4 dB rise over 2 s; motif = 110 Hz tone with 5 Hz vibrato for 2 s. Levelled to -26 LUFS. Returns outFile or null.
export function synthScore(cues, totalS, outFile) {
  const mus = cues.filter((c) => c.type === "music");
  const spans = mus.filter((c) => kindOf(c) === "in").map((c) => {
    const out = mus.find((o) => kindOf(o) === "out" && Math.abs(o.t - c.until) < 0.02);
    return { a: c.t, b: c.until ?? totalS, fi: Math.max(c.fade_s || 0.01, 0.01), fo: Math.max(out?.fade_s || c.fade_s || 0.01, 0.01), g: 10 ** ((c.gain_db || 0) / 20) };
  });
  const motifs = mus.filter((c) => kindOf(c) === "motif"), swells = mus.filter((c) => kindOf(c) === "swell");
  if (!spans.length && !motifs.length) return null;
  const T = "t";
  const env = spans.length ? `min(1,${spans.map((s) => `${s.g.toFixed(3)}*clip(min((${T}-${s.a})/${s.fi},(${s.b}-${T})/${s.fo}),0,1)`).join("+")})` : "0";
  const sw = swells.map((s) => `${(10 ** ((s.gain_db ?? 4) / 20) - 1).toFixed(3)}*clip(min((${T}-${s.t})/2,(${s.t + 6}-${T})/4),0,1)`).join("+") || "0";
  const pad = (d) => [[110, 0.30], [130.81, 0.22], [164.81, 0.22], [220, 0.12]]
    .map(([f, a]) => `${a}*(sin(2*PI*${f}*${T})+0.6*sin(2*PI*${(f + d).toFixed(2)}*${T})+0.15*sin(4*PI*${f}*${T}))`).join("+");
  const trem = `(0.8+0.2*sin(2*PI*0.18*${T}))`;
  const mot = motifs.map((m) => `${10 ** ((m.gain_db || 0) / 20)}*0.9*clip(min((${T}-${m.t})/0.3,(${m.t + 2}-${T})/0.5),0,1)*(0.8+0.2*sin(2*PI*5*${T}))*sin(2*PI*110*${T}+0.6*sin(2*PI*5*${T}))`).join("+") || "0";
  const ch = (d) => `(${pad(d)})*${trem}*${env}*(1+${sw})+${mot}`;
  const raw = outFile.replace(/\.wav$/, ".raw.wav");
  mkdirSync(join(outFile, ".."), { recursive: true });
  ff(["-y", "-f", "lavfi", "-i", `aevalsrc='${ch(0.45)}|${ch(-0.38)}':s=${SR}:d=${totalS.toFixed(3)}`,
    "-af", "lowpass=f=1200,aecho=0.8:0.6:180|400:0.35|0.2,lowpass=f=1200", "-t", totalS.toFixed(3), "-c:a", "pcm_s16le", raw]);
  normTo(raw, outFile, -26);
  return outFile;
}

// 4. Voiceover via Magic Hour TTS (0.1 credits/char). Returns [{ cue, file }].
export async function voiceover(run, cues, voice = VOICE) {
  mkdirSync(run.path("audio"), { recursive: true });
  const out = [];
  for (const cue of cues.filter((c) => c.type === "voiceover")) {
    const text = cue.text.slice(0, 1000), cost = Math.ceil(COST.tts_char * text.length);
    const key = `tts:${cue.n}`, prev = run.log.jobs[key]?.output;
    let file = prev?.startsWith(`audio/vo-${cue.n}.`) ? prev : `audio/vo-${cue.n}.mp3`, got = file;
    await run.job(key, file, { text, voice }, [], cost, async () => {
      const body = { name: `vo-${cue.n}`, style: { prompt: text, voice_name: voice } };
      const r = await run.mh("/v1/ai-voice-generator", body, "audio", cost);
      const url = r.downloads[0];
      got = `audio/vo-${cue.n}.${/\.wav(\?|$)/i.test(url) ? "wav" : "mp3"}`;
      await download(url, run.path(got));
      return { endpoint: "/v1/ai-voice-generator", request: body, credits: r.credits, seconds: r.seconds };
    });
    if (got !== file) { run.log.jobs[key].output = got; run.log.jobs[key].sig = run.sig({ text, voice }, []); run.save(); file = got; }
    out.push({ cue, file });
  }
  return out;
}

// 5. Mix: picture audio 0 dB + beds + score -> duck under VO -> + VO -> loudnorm (two-pass) -> aac, video copied.
export async function mix(run, { picture, cues, timeline, out = "final.mp4", totalS, score = "audio/score.wav", voiceovers = [] }) {
  const pic = abs(run, picture); totalS ??= duration(pic);
  const inputs = [pic], args = [], bg = [], vo = [];
  const add = (file, loop) => { args.push(...(loop ? ["-stream_loop", "-1"] : []), "-i", abs(run, file)); inputs.push(file); return inputs.length - 1; };
  const fmt = `aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo`;
  const fc = [];
  if (hasAudio(pic)) fc.push(`[0:a]${fmt}[c0]`); else { fc.push(`anullsrc=r=${SR}:cl=stereo,atrim=0:${totalS}[c0]`); }
  bg.push("[c0]");
  for (const c of cues.filter((c) => c.type === "ambient")) {
    const f = bedFile(c.source.replace(/^bed:/, ""));
    if (!existsSync(run.path(f))) continue;
    const d = Math.max(0.1, (c.until ?? totalS) - c.t), fd = Math.min(c.fade_s || 0, d / 2), i = add(f, true);
    fc.push(`[${i}:a]${fmt},atrim=0:${d.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${fd || 0.01},afade=t=out:st=${(d - (fd || 0.01)).toFixed(3)}:d=${fd || 0.01},volume=${c.gain_db || 0}dB,adelay=${Math.round(c.t * 1000)}:all=1[b${c.n}]`);
    bg.push(`[b${c.n}]`);
  }
  if (score && existsSync(abs(run, score))) { const i = add(score); fc.push(`[${i}:a]${fmt}[sc]`); bg.push("[sc]"); }
  const vwin = [];
  for (const { cue, file } of voiceovers) {
    const i = add(file), d = duration(abs(run, file));
    vwin.push([cue.t, cue.t + d]);
    fc.push(`[${i}:a]${fmt},volume=${cue.gain_db || 0}dB,adelay=${Math.round(cue.t * 1000)}:all=1[v${cue.n}]`); vo.push(`[v${cue.n}]`);
  }
  fc.push(`${bg.join("")}amix=inputs=${bg.length}:duration=first:normalize=0[bg]`);
  let last = "[bg]";
  if (vwin.length) {
    const duck = vwin.map(([a, b]) => `clip(min((t-${(a - 0.2).toFixed(2)})/0.2,(${(b + 0.3).toFixed(2)}-t)/0.3),0,1)`).join("+");
    fc.push(`[bg]volume='1-0.5*min(1,${duck})':eval=frame[dk]`, `[dk]${vo.join("")}amix=inputs=${vo.length + 1}:duration=first:normalize=0[pre]`);
    last = "[pre]";
  }
  const graph = (ln) => [...fc, `${last}loudnorm=I=-16:TP=-1.5:LRA=11${ln},aresample=${SR},aformat=channel_layouts=stereo[aout]`].join(";");
  const base = ["-y", "-i", pic, ...args];
  // Pass 1 measures the mix. If ffmpeg does not print the JSON (format change, truncated output, a silent mix), fall back
  // to the single-pass loudnorm instead of dereferencing null and losing the whole mix to a TypeError.
  const probe = /\{[^{}]*"input_i"[^{}]*\}/.exec(ff([...base, "-filter_complex", graph(":print_format=json"), "-map", "[aout]", "-t", totalS.toFixed(3), "-f", "null", "-"]));
  if (!probe) console.error("  audio: loudnorm measurement not found in the ffmpeg output — single-pass normalisation");
  const m = probe ? JSON.parse(probe[0]) : null;
  const filter = m ? graph(`:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`) : graph("");
  ff([...base, "-filter_complex", filter, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", SR, "-ac", 2, "-shortest", "-movflags", "+faststart", abs(run, out)]);
  return { inputs, filter, out };
}

// 6. Orchestrate: cues (arg > cues.json > cueSheet) -> beds -> score -> voiceover -> mix. Estimate mode stops after TTS costing.
export async function renderAudio(run, { plan, timeline, picture = "picture.mp4", out = "final.mp4", cues, clipsDir }) {
  const cueFile = run.path("cues.json");
  cues ??= existsSync(cueFile) ? JSON.parse(readFileSync(cueFile, "utf8")) : cueSheet(plan, timeline, cueFile);
  const totalS = duration(abs(run, picture)) || Math.max(...timeline.map((s) => s.end_s));
  const voiceovers = await voiceover(run, cues);
  if (run.estimate) return { cues, beds: null, score: null, voiceovers, mix: null };
  const bedFiles = await beds(run, timeline, clipsDir);
  mkdirSync(run.path("audio"), { recursive: true });
  const score = synthScore(cues, totalS, run.path("audio/score.wav")) && "audio/score.wav";
  const m = await mix(run, { picture, cues, timeline, out, totalS, score, voiceovers });
  return { cues, beds: bedFiles, score, voiceovers, mix: m };
}
