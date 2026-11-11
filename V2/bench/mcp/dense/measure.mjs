// Measurements for one output video, to support the checklist: size, length, cuts, black frames, audio levels and silence, a
// timestamped transcript, solid-colour cards (when, and what colour), how closely the last frame matches the first, and, with
// --ref, how closely the start matches a reference clip. Also writes a sheet with one frame per second. Prints JSON and saves it.
// These are the objective lines; what is in the frames is still judged by looking at the sheet.
// Usage: node V2/bench/mcp/dense/measure.mjs <video> --out <dir> [--hex #3B1F6B] [--ref <clip>] [--around <seconds>] [--no-transcript]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { key } from "../../../backend/lib/env.js";

const argv = process.argv.slice(2), opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const V = resolve(argv[0] || ""), OUT = resolve(opt("--out") || "."), HEX = opt("--hex"), REF = opt("--ref") ? resolve(opt("--ref")) : null, AROUND = opt("--around");
if (!argv[0] || argv[0].startsWith("--")) { console.error("usage: node measure.mjs <video> --out <dir> [--hex #RRGGBB] [--ref <clip>] [--around <seconds>] [--no-transcript]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const BIG = { maxBuffer: 1 << 28 };
const both = (args) => { const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", ...BIG }); return (r.stdout || "") + (r.stderr || ""); };
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], BIG);
function probe(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8" }));
  const v = j.streams.find((s) => s.codec_type === "video"), a = j.streams.find((s) => s.codec_type === "audio"), [n, d] = (v?.r_frame_rate || "0/1").split("/").map(Number);
  return { width: v?.width, height: v?.height, seconds: Number(j.format.duration), fps: d ? n / d : n, audio: a?.codec_name || null };
}
const r2 = (x) => Math.round(x * 100) / 100, hex = (c) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase();
const p = probe(V), M = { file: V, ...p, seconds: r2(p.seconds), aspect: r2(p.width / p.height) };

// cuts and black frames
M.cuts = [...both(["-i", V, "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]).matchAll(/pts_time:([0-9.]+)/g)].map((m) => r2(Number(m[1])));
M.black = [...both(["-i", V, "-vf", "blackdetect=d=0.1:pix_th=0.10", "-an", "-f", "null", "-"]).matchAll(/black_start:([0-9.]+) black_end:([0-9.]+)/g)].map((m) => [r2(+m[1]), r2(+m[2])]);

// solid-colour cards: 4 samples a second, each frame averaged down to 8x8; a card is a run of frames whose border cells share one colour
const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", V, "-vf", "fps=4,scale=8:8:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], BIG);
const ring = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (x === 0 || y === 0 || x === 7 || y === 7) ring.push(y * 8 + x);
const cards = []; let cur = null;
for (let f = 0; (f + 1) * 192 <= raw.length; f++) {
  const px = ring.map((i) => [0, 1, 2].map((k) => raw[f * 192 + i * 3 + k])), mean = [0, 1, 2].map((k) => px.reduce((a, c) => a + c[k], 0) / px.length);
  const sd = Math.max(...[0, 1, 2].map((k) => Math.sqrt(px.reduce((a, c) => a + (c[k] - mean[k]) ** 2, 0) / px.length)));
  if (sd < 6) { if (!cur) cards.push((cur = { from: f / 4, to: f / 4, sum: [0, 0, 0], n: 0 })); cur.to = f / 4; cur.n++; cur.sum = cur.sum.map((s, k) => s + mean[k]); } else cur = null;
}
const target = HEX ? [1, 3, 5].map((i) => parseInt(HEX.slice(i, i + 2), 16)) : null;
M.cards = cards.filter((c) => c.n >= 2).map((c) => { const m = c.sum.map((s) => s / c.n); return { from: c.from, to: r2(Math.min(c.to + 0.25, p.seconds)), seconds: r2(Math.min(c.to + 0.25, p.seconds) - c.from), colour: hex(m), ...(target ? { distance_to_target: r2(Math.hypot(...m.map((x, k) => x - target[k]))) } : {}) }; });

// does the last frame match the first (a loop)?
ff(["-i", V, "-frames:v", "1", join(OUT, "first.png")]); ff(["-sseof", "-0.15", "-i", V, "-frames:v", "1", "-update", "1", join(OUT, "last.png")]);
M.first_last_ssim = Number((both(["-i", join(OUT, "first.png"), "-i", join(OUT, "last.png"), "-lavfi", "ssim", "-f", "null", "-"]).match(/All:([0-9.]+)/) || [])[1] ?? NaN);

// does the start match a reference clip (was the original kept, not regenerated)?
if (REF) {
  const rp = probe(REF), D = Math.min(rp.seconds, p.seconds).toFixed(2);
  const out = both(["-i", V, "-i", REF, "-lavfi", `[0:v]trim=0:${D},setpts=PTS-STARTPTS,fps=${rp.fps},scale=${rp.width}:${rp.height}[a];[1:v]trim=0:${D},setpts=PTS-STARTPTS[b];[a][b]ssim`, "-f", "null", "-"]);
  M.ref = { file: REF, width: rp.width, height: rp.height, seconds: r2(rp.seconds), same_size: rp.width === p.width && rp.height === p.height, ssim_over_ref_length: Number((out.match(/All:([0-9.]+)/) || [])[1] ?? NaN) };
}

// audio: overall level, level per third, how much of it is silent, and the words
if (p.audio) {
  const vol = (args) => Number((both([...args, "-vn", "-af", "volumedetect", "-f", "null", "-"]).match(/mean_volume: (-?[0-9.]+|-inf)/) || [])[1]), third = p.seconds / 3;
  const peak = Number((both(["-i", V, "-vn", "-af", "volumedetect", "-f", "null", "-"]).match(/max_volume: (-?[0-9.]+)/) || [])[1]);
  const win = [...both(["-i", V, "-vn", "-af", "aresample=16000,asetnsamples=1600,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"]).matchAll(/RMS_level=(-?[0-9.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -120 : Number(m[1]))).sort((a, b) => a - b);
  M.sound = { mean_db: vol(["-i", V]), peak_db: peak, thirds_db: [0, 1, 2].map((k) => vol(["-ss", String(third * k), "-t", String(third), "-i", V])), windows_100ms: win.length, silent_share: r2(win.filter((x) => x < -60).length / (win.length || 1)), quietest_db: r2(win[0]), median_db: r2(win[Math.floor(win.length / 2)]) };
  if (!argv.includes("--no-transcript") && peak > -45) {   // the transcriber invents words on silence, so a nearly silent track is not sent
    ff(["-i", V, "-vn", "-ac", "1", "-ar", "16000", join(OUT, "audio.wav")]);
    const form = new FormData(); form.append("model", "whisper-1"); form.append("response_format", "verbose_json"); form.append("timestamp_granularities[]", "segment"); form.append("language", "en"); form.append("file", new Blob([readFileSync(join(OUT, "audio.wav"))]), "a.wav");
    const j = await (await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form })).json();
    M.transcript = j.error ? { error: j.error.message } : { text: j.text, segments: (j.segments || []).map((s) => ({ from: r2(s.start), to: r2(s.end), text: s.text.trim(), no_speech: r2(s.no_speech_prob ?? 0) })) };
    // what an audio-capable model hears: music, speech, other sounds (the transcriber cannot tell music from silence)
    const HEAR = `Listen to this sound track from a short video. Report only what you hear; do not guess. Answer as JSON with these keys: "music" ("none", "throughout" or "part"), "music_where" (when it plays, short), "music_description" (short), "speech" ("none" or "some"), "speech_words" (the words, or ""), "other_sounds" (short).`;
    const h = await (await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-audio-1.5", modalities: ["text"], messages: [{ role: "user", content: [{ type: "text", text: HEAR }, { type: "input_audio", input_audio: { data: readFileSync(join(OUT, "audio.wav")).toString("base64"), format: "wav" } }] }] }) })).json();
    const said = h.choices?.[0]?.message?.content || "";
    M.sound.heard = h.error ? { error: h.error.message } : (() => { try { return JSON.parse(said.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return said; } })();
  }
} else M.sound = null;

// the sheet: the frame at 0 s, then one every second, 8 to a row; and, with --around, 8 frames across the second around that time
const rows = Math.ceil((Math.floor(p.seconds) + 1) / 8);
ff(["-i", V, "-vf", `select='isnan(prev_selected_t)+gte(t-prev_selected_t,1)',scale=240:-2,tile=8x${rows}`, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "4", join(OUT, "sheet.jpg")]);
if (AROUND) ff(["-ss", String(Math.max(0, Number(AROUND) - 0.5)), "-t", "1", "-i", V, "-vf", "fps=8,scale=240:-2,tile=8x1", "-frames:v", "1", "-q:v", "4", join(OUT, "around.jpg")]);
M.sheet = { file: join(OUT, "sheet.jpg"), frames: Math.floor(p.seconds) + 1, per_row: 8 };
writeFileSync(join(OUT, "measure.json"), JSON.stringify(M, null, 2));
console.log(JSON.stringify(M, null, 2));
