// Lip-sync test on a few dialogue panels of a panels run: voice (OpenAI TTS, one cast voice per character) → clip of the panel
// (Magic Hour image-to-video, background sound on) → lip sync (Magic Hour, lite) with the voice → the clip's background sound
// mixed back under the voice (ffmpeg). Paid jobs go through the Jobs gate and the ledger.
// Usage: CLEANED_CAP=… node cleaned/experiments/lipsync-test.mjs custom-rrh5 [--n 2] [--model wan-3.0]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { castVoices, speak } from "../src/voice.js";
import { duration } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const name = args[0], dir = join(RUNS, name), N = Number(opt("--n", 2)), model = opt("--model", "wan-3.0");
const log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), tracker = JSON.parse(readFileSync(join(dir, "tracker.json"), "utf8"));
for (const d of ["audio", "clips"]) mkdirSync(join(dir, d), { recursive: true });
const run = { name: `${name}-lipsync`, path: (f) => join(dir, f), log: log.lipsync_log || {} };
run.save = () => { log.lipsync_log = run.log; writeFileSync(join(dir, "run.json"), JSON.stringify(log, null, 2)); };
const jobs = new Jobs(run);
const ents = log.plan.entities, byName = (who) => ents.find((e) => e.kind === "character" && (e.name.toLowerCase() === who.toLowerCase() || who.toLowerCase().includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(who.toLowerCase())));

// Panels with one spoken line by a character who is in the frame.
const picks = [];
for (const s of log.plan.slides) {
  const d = s.beats?.find((b) => b.kind === "dialogue" && byName(b.who) && s.present.includes(byName(b.who).id));
  if (d && !picks.some((p) => p.speaker.id === byName(d.who).id)) picks.push({ s, line: d.text, speaker: byName(d.who) });
  if (picks.length >= N) break;
}
const cast = log.voices ??= await castVoices(ents.filter((e) => e.kind === "character"), log.screenplay ? log.screenplay.scenes.flatMap((x) => x.beats.map((b) => b.text)).join(" ").slice(0, 4000) : "");
run.save();

const out = [];
for (const { s, line, speaker } of picks) {
  const frame = tracker.frames.find((f) => f.slide === s.n);
  const voice = `audio/p${s.n}-${speaker.id}.mp3`;
  await speak(line, cast[speaker.id], join(dir, voice));
  const secs = Math.max(4, Math.ceil(duration(join(dir, voice)) + 1.5));
  // The clip: the panel animated, the speaker talking; background sound from the scene (generated with the clip).
  const prompt = `${s.what} ${speaker.name} says, mouth moving: "${line}". Small natural motion, camera still. Sound: ${s.ambience || "quiet room tone"}; no music, no other voices.`;
  const clip = `clips/p${s.n}.mp4`;
  await jobs.video(`clip-p${s.n}`, clip, prompt, frame.file, null, secs, { ...VIDEO, model, audio: true });
  const synced = `clips/p${s.n}-lipsync.mp4`;
  await jobs.lipsync(`lipsync-p${s.n}`, synced, clip, voice, secs);
  // Mix: the voice (from the lip-sync output) over the clip's background sound at a lower level.
  const final = `clips/p${s.n}-final.mp4`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, synced), "-i", join(dir, clip), "-filter_complex",
    "[1:a]volume=0.35[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", join(dir, final)]);
  out.push({ panel: s.n, speaker: speaker.name, line, voice: cast[speaker.id], clip, synced, final, seconds: secs });
  console.log(`panel ${s.n}: ${speaker.name} "${line}" → ${final}`);
}
log.lipsync = out; writeFileSync(join(dir, "run.json"), JSON.stringify(log, null, 2));
console.log(`spent ${jobs.spent()} credits`);
