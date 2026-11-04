// Video for one scene of a fact-film chain: a wan-3.0 clip between each pair of painted keyframes (start → end, the acting in
// the prompt), then, for a frame that carries spoken lines, a veo3.1 dialogue clip from that frame (audio on, voice descriptors,
// transcribed to check the words); all stitched with sound. --long adds the comparison: ONE long veo3.1 clip from the scene's
// first frame with every change and line in the text ("just do these changes"), kept as its own file.
// Usage: CLEANED_CAP=… node V1/experiments/fact-video.mjs --label vanderbilt2 --scene 2 [--seconds 5] [--long]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { check } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt2"), k = Number(opt("--scene", 1)), seconds = Number(opt("--seconds", 5)), long = args.includes("--long");
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "clips"), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), sc = L.screenplay.scenes[k - 1], frames = L.chain[k].frames, kf = L.keyframes[k];
const VOICE = { "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent", "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent", "EDWIN M. STANTON": "a firm, clipped baritone" };
const cap = (s) => s.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
const ambience = sc.inside ? "a quiet 1860s room, footsteps on carpet" : "a quiet 1860s street, wind, distant hooves";
const posOf = (f) => kf.keyframes.find((x) => x.source === f.source)?.positions || "";

async function transcribe(file) {
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3"));
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  return tr.text || JSON.stringify(tr).slice(0, 200);
}

const clips = [];
for (let i = 0; i < frames.length; i++) {
  const a = frames[i], b = frames[i + 1];
  if (b) {
    const action = (b.source || "").replace(/^\s*\d+\.\s*/, "").replace(/^"|"$/g, "");
    const prompt = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. What happens between them: ${action} ${posOf(b)} The people move naturally, with steps, turns and small gestures; no one crosses in front of another. Nothing appears that is not in the frames. Sound: ${ambience}; no voices; no music.`;
    const file = `clips/s${k}-${i + 1}.mp4`;
    console.log(`clip ${i + 1}: ${a.file} → ${b.file} · ${action.slice(0, 80)}`);
    await jobs.video(`video-s${k}-${i + 1}`, file, prompt, a.file, b.file, seconds, { ...VIDEO, model: "wan-3.0", audio: true });
    const qa = check(run.path(file), { start: run.path(a.file), end: run.path(b.file), path: run.path, key: `s${k}-${i + 1}` });
    console.log(`  first≈start ${qa.first_vs_start} · last≈end ${qa.last_vs_end}`);
    clips.push({ kind: "motion", file, prompt, from: a.file, to: b.file, qa });
  }
  if (b?.spoken?.length) {
    // The lines spoken over frame b, as one veo3.1 clip from that frame: 8 s for up to two lines, 16 s for more.
    const lines = b.spoken, secs = lines.length <= 2 ? 8 : 16;
    const prompt = `Image 1 is the first frame of one continuous shot; the camera does not move; the same people stay where they stand. They speak, in this order, lips moving with the words, with natural small gestures:
${lines.map((l) => `${cap(l.who)} (${VOICE[l.who] || "a natural period voice"}) says: "${l.text}"`).join("\n")}
Nothing appears that is not in the frame. Sound: ${ambience}, the voices clearly; no music, no narration.`;
    const file = `clips/s${k}-${i + 1}-dialogue.mp4`;
    console.log(`dialogue clip from ${b.file} · veo3.1 ${secs}s · ${lines.length} lines`);
    await jobs.video(`video-s${k}-${i + 1}-dialogue`, file, prompt, b.file, null, secs, { ...VIDEO, model: "veo3.1", audio: true });
    const heard = await transcribe(file);
    console.log(`  heard: ${heard}`);
    clips.push({ kind: "dialogue", file, prompt, from: b.file, lines, heard, seconds: secs });
  }
}
// Stitch in order, keeping each clip's audio; a motion clip that follows another drops its repeated first frame.
const parts = clips.map((c, i) => { const p = run.path(c.file.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(c.file), "-vf", `${i && c.kind === "motion" ? "trim=start_frame=1," : ""}setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`, "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
const list = run.path(`clips/s${k}-concat.txt`); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
const out = `clips/s${k}.mp4`; execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", run.path(out)]);
(L.video ??= {})[k] = { clips, out }; run.save();
console.log(`stitched: ${out} (${clips.length} clips)`);

if (long) {
  // The comparison: one clip from the first frame with the whole scene in words; the later keyframes are not used.
  const beats = sc.beats.map((b) => (b.kind === "dialogue" ? `${cap(b.who)} (${VOICE[b.who] || "a natural period voice"}) says: "${b.text}"` : b.text)).join(" ");
  const prompt = `Image 1 is the first frame of one continuous shot; the camera does not move. Over the shot this happens, in order: ${beats} The people move naturally; whoever speaks has lips moving with the words. Nothing appears that is not in the frame or named here. Sound: ${ambience}, the voices clearly; no music, no narration.`;
  const file = `clips/s${k}-long.mp4`;
  console.log(`long clip from ${frames[0].file} · veo3.1 16s · the whole scene in text`);
  await jobs.video(`video-s${k}-long`, file, prompt, frames[0].file, null, 16, { ...VIDEO, model: "veo3.1", audio: true });
  const heard = await transcribe(file);
  console.log(`  heard: ${heard}`);
  L.video[k].long = { file, prompt, heard }; run.save();
}
console.log(`done · ${jobs.spent()} credits in this run so far`);
