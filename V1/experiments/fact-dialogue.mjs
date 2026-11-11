// Dialogue at video time: one clip from a painted keyframe with the lines spoken IN the generation (veo3.1, audio on), each
// speaker given a voice descriptor in the prompt. Then the clip's audio is transcribed (OpenAI) to check the words.
// Usage: CLEANED_CAP=… node V1/experiments/fact-dialogue.mjs --label vanderbilt --scene 2 --frame 4 [--model veo3.1] [--seconds 8]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt"), k = Number(opt("--scene", 2)), fn = Number(opt("--frame", 4)), model = opt("--model", "veo3.1"), seconds = Number(opt("--seconds", 8));
const dir = join(RUNS, `exp-${label}`), run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run);
const frame = L.chain[k].frames.find((f) => f.frame === fn);
if (!frame?.spoken?.length) throw new Error(`frame ${fn} of scene ${k} has no spoken lines`);

// Voice descriptors: documented where the record has them (Lincoln's voice was high and reedy), else from the character's look.
const VOICE = {
  "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent",
  "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent",
  "EDWIN M. STANTON": "a firm, clipped baritone",
};
const lines = frame.spoken.slice(0, 2);   // what fits in one short clip
const prompt = `Image 1 is the first frame of one continuous shot; the camera does not move; the same three men stay where they are. They speak, in this order, lips moving with the words:
${lines.map((l) => `${l.who.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase())} (${VOICE[l.who] || "a natural period voice"}) says: "${l.text}"`).join("\n")}
Natural gestures only; nothing appears that is not in the frame. Sound: a quiet 1860s room, the two voices clearly; no music, no narration.`;
const file = `frames/s${k}-f${fn}-dialogue-${model}.mp4`;
console.log(`clip from ${frame.file} · ${model} ${seconds}s · lines: ${lines.map((l) => `${l.who}: "${l.text.slice(0, 40)}…"`).join(" / ")}`);
await jobs.video(`dialogue-s${k}-f${fn}-${model}`, file, prompt, frame.file, null, seconds, { ...VIDEO, model, audio: true });

// Transcribe the clip's audio to check the words (OpenAI transcription).
const mp3 = run.path(file.replace(/\.mp4$/, ".mp3"));
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json());
const heard = tr.text || JSON.stringify(tr).slice(0, 300);
console.log(`transcription: ${heard}`);
(L.dialogue ??= {})[`s${k}-f${fn}-${model}`] = { file, model, seconds, prompt, lines, heard, credits: L.calls.at(-1)?.credits }; run.save();
console.log(`done · ${jobs.spent()} credits in this run so far`);
