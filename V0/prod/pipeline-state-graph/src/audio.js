// Audio: the same states drive the sound. Location runs give one bed, change events give sfx, story beats give music cues.
// cueSheet() builds an editable cue sheet (cues.json) from the timeline and the real clip lengths.
// mixAudio() renders it: levelled clip tracks + one looped bed per location + a placeholder synth score, muxed onto the picture.
// No music or sfx endpoint exists: sfx and ambience only reach the clip through its video prompt (clip_sound).
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const r3 = (x) => Math.round(x * 1000) / 1000;
const SFX_AT = 0.6; // sfx sits at 60% of its clip
const CHORDS = [[110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220], [130.81, 196, 261.63, 329.63], [98, 146.83, 196, 246.94]]; // Am, F, C, G

export function cueSheet(timeline, parts) {
  const beatOf = Object.fromEntries((timeline.beats || []).map((b) => [b.n, b]));
  let at = 0;
  const run = parts.filter((p) => beatOf[p.beat]).map((p) => { const s = { ...p, b: beatOf[p.beat], start_s: r3(at), end_s: r3(at + p.seconds) }; at += p.seconds; return s; });
  const total = r3(at);
  const beds = [], sfx = [], music = [];
  for (const p of run) {
    const last = beds.at(-1);
    if (last && last.location === p.b.location) { last.end_s = p.end_s; last.beats.push(p.beat); }
    else beds.push({ id: `bed${beds.length + 1}`, location: p.b.location, time: p.b.time, weather: p.b.weather, ambience: p.b.ambience || "", start_s: p.start_s, end_s: p.end_s, beats: [p.beat] });
    for (const c of p.b.changes || []) if (c.sound?.trim())
      sfx.push({ beat: p.beat, at_s: r3(p.start_s + SFX_AT * p.seconds), entity: c.id, change: `${c.attr}: ${c.from} → ${c.to}`, sound: c.sound.trim() });
  }
  let open = null;
  const close = (t) => { if (open) { open.end_s = t; music.push(open); open = null; } };
  for (const p of run) {
    const m = p.b.music; if (!m?.event) continue;
    const ev = { beat: p.beat, event: m.event, at_s: p.start_s };
    if (m.event === "stop") { if (open) open.events.push(ev); close(p.start_s); continue; }
    if (m.event === "hold" && open) { open.beats.push(p.beat); open.events.push(ev); continue; }
    close(p.start_s); // start, change, or a hold with nothing open
    open = { cue: m.cue || "", start_s: p.start_s, end_s: null, beats: [p.beat], events: [ev] };
  }
  close(total);
  const clip_sound = Object.fromEntries((timeline.beats || []).map((b) => {
    const s = [b.ambience, ...(b.changes || []).map((c) => c.sound?.trim()).filter(Boolean)].filter(Boolean).join("; ");
    return [b.n, `Sound: ${s || "quiet room tone"}. No music.`];
  }));
  return {
    total_s: total, beds, sfx, music, clip_sound,
    notes: [
      "Times are absolute seconds in the final cut, from the trimmed clips' exact lengths. Edit them and re-run the mix.",
      "Ambience and sfx are generated inside each clip by the video model (wan-3.0 audio). They come from clip_sound in the video prompt; their exact timing is not controllable.",
      "sfx.at_s is the intended position (60% into the clip). No sfx endpoint exists, so no separate sfx file is placed there.",
      "Each bed is the first clip's own audio, looped under the whole location run at about -14 dB, so the background does not jump at every clip.",
      "Music is a PLACEHOLDER: a quiet synthetic chord pad (ffmpeg aevalsrc) per cue at about -26 LUFS. No music endpoint exists. Replace it with a real score; the cue text says what each cue should feel like.",
      "music=false in mixAudio skips the placeholder score.",
    ],
  };
}

const ff = (args) => {
  try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { throw new Error(`ffmpeg failed: ${String(e.stderr || e.message).slice(-1500)}`); }
};
const probe = (file, q) => execFileSync("ffprobe", ["-v", "error", ...q, "-of", "csv=p=0", file]).toString().trim();
const hasAudio = (file) => !!probe(file, ["-select_streams", "a", "-show_entries", "stream=index"]);
const ST = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
const LN = (i) => `loudnorm=I=${i}:TP=-1.5:LRA=11,${ST}`;

export function mixAudio(runDir, parts, cues, pictureFile, outFile, { music = true } = {}) {
  const dur = Number(probe(pictureFile, ["-show_entries", "format=duration"]));
  const files = parts.map((p) => join(runDir, p.file)), audio = files.map(hasAudio);
  const starts = []; let at = 0; for (const p of parts) { starts.push(at); at += p.seconds; }
  const bedOf = (beat) => (cues.beds || []).findIndex((b) => b.beats.includes(beat));
  const inputs = ["-i", pictureFile, ...files.flatMap((f) => ["-i", f])];
  const graph = [], labels = [], layers = [];
  const ms = (t) => Math.max(0, Math.round(t * 1000));

  // Clip tracks: levelled, 50 ms fades at cuts, 400 ms fades at joins inside a bed (the bed covers the dip).
  parts.forEach((p, i) => {
    const d = p.seconds, bed = bedOf(p.beat);
    const fin = i > 0 && bedOf(parts[i - 1].beat) === bed ? 0.4 : 0.05, fout = i < parts.length - 1 && bedOf(parts[i + 1].beat) === bed ? 0.4 : 0.05;
    const src = audio[i] ? `[${i + 1}:a]${ST},apad` : `anullsrc=r=48000:cl=stereo`;
    graph.push(`${src},atrim=duration=${d},${audio[i] ? LN(-16) + "," : ""}afade=t=in:d=${fin},afade=t=out:st=${r3(Math.max(0, d - fout))}:d=${fout},adelay=${ms(starts[i])}:all=1[c${i}]`);
    labels.push(`[c${i}]`);
  });
  layers.push({ name: "clips", count: parts.length, silent: audio.filter((a) => !a).length, duration_s: r3(at) });

  // Beds: the bed's first clip with audio, looped to the bed length, -14 dB, 1 s fades at the bed edges.
  let k = parts.length + 1, beds = 0;
  for (const b of cues.beds || []) {
    const i = parts.findIndex((p, j) => b.beats.includes(p.beat) && audio[j]);
    const len = b.end_s - b.start_s; if (i < 0 || len <= 0) continue;
    inputs.push("-stream_loop", "-1", "-i", files[i]);
    const f = Math.min(1, len / 2);
    graph.push(`[${k++}:a]${ST},atrim=duration=${r3(len)},asetpts=N/SR/TB,${LN(-16)},volume=-14dB,afade=t=in:d=${f},afade=t=out:st=${r3(len - f)}:d=${f},adelay=${ms(b.start_s)}:all=1[b${beds}]`);
    labels.push(`[b${beds++}]`);
  }
  layers.push({ name: "beds", count: beds, gain_db: -14 });

  // Music: placeholder pad per cue (minor/major chord partials, slow swell, low-pass, tremolo), about -26 LUFS, 1.5 s fades.
  let cuesOut = 0;
  if (music) (cues.music || []).forEach((c, j) => {
    const len = (c.end_s ?? dur) - c.start_s; if (len <= 0.2) return;
    const ch = CHORDS[j % CHORDS.length], amp = [1, 0.7, 0.5, 0.35];
    const voice = (det) => `0.15*(0.65+0.35*sin(2*PI*0.08*t))*(${ch.map((f, n) => `${amp[n]}*sin(2*PI*${r3(f * det)}*t)`).join("+")})`;
    const f = Math.min(1.5, len / 2);
    graph.push(`aevalsrc=${voice(1)}|${voice(1.003)}:s=48000:c=stereo:d=${r3(len)},lowpass=f=900,tremolo=f=0.25:d=0.2,${LN(-26)},afade=t=in:d=${f},afade=t=out:st=${r3(len - f)}:d=${f},adelay=${ms(c.start_s)}:all=1[m${cuesOut}]`);
    labels.push(`[m${cuesOut++}]`);
  });
  layers.push({ name: "music (placeholder pad)", count: cuesOut, target_lufs: -26 });

  graph.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=longest,${LN(-16)},apad,atrim=duration=${r3(dur)}[a]`);
  ff([...inputs, "-filter_complex", graph.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", outFile]);
  return { file: outFile, layers, filter_summary: `${parts.length} clip tracks (loudnorm -16, 50ms cut / 400ms in-bed fades) + ${beds} looped beds (-14 dB, 1s fades) + ${cuesOut} pad cues (-26 LUFS) → amix → loudnorm -16 → trim ${r3(dur)}s` };
}
