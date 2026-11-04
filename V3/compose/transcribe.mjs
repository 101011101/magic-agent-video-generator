// Timed transcript of a clip (whisper-1, verbose_json). Usage: node V3/compose/transcribe.mjs <file.mp4>  → one line per segment
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { key } from "../../V2/backend/lib/env.js";
const file = process.argv[2], wav = `${file}.wav`;
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", wav]);
const form = new FormData(); form.append("model", "whisper-1"); form.append("response_format", "verbose_json"); form.append("file", new Blob([readFileSync(wav)]), "a.wav");
const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((x) => x.json());
console.log((r.segments || []).map((g) => `[${Math.round(g.start * 10) / 10}-${Math.round(g.end * 10) / 10} s] "${g.text.trim()}"`).join(" ") || "(no speech)");
