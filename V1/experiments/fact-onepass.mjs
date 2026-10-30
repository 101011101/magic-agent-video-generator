// One pass per scene: text-to-video with named references. The place, every character's picture and the painted keyframes go in
// as @references; the prompt is the whole scene (first frame, every change in order, the lines with voice descriptors) and the
// clip is as long as the scene. Nothing is pinned; the keyframes are references the model is told to pass through, in order.
// Usage: CLEANED_CAP=… node cleaned/experiments/fact-onepass.mjs --label vanderbilt2 --scene 2 [--model wan-3.0] [--seconds 16]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt2"), k = Number(opt("--scene", 2)), model = opt("--model", "wan-3.0"), seconds = Number(opt("--seconds", 16));
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "clips"), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), sc = L.screenplay.scenes[k - 1], byId = Object.fromEntries(L.elements.map((e) => [e.id, e]));
const frames = L.chain?.[k]?.frames || [], kf = L.keyframes[k];
const VOICE = { "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent", "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent", "EDWIN M. STANTON": "a firm, clipped baritone" };
const cap = (s) => s.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
const ambience = sc.inside ? "a quiet 1860s room, footsteps on carpet" : "a quiet 1860s street, wind, distant hooves";

// References: the place, each character present in the scene, and the painted keyframes in order (at most 10 in all).
const place = L.elements.find((e) => e.kind === "place" && e.scenes.includes(k)) || L.elements.find((e) => e.kind === "place");
const present = [...new Set([...(kf.present || []), ...kf.keyframes.flatMap((f) => f.enters || [])])].filter((id) => byId[id]?.kind === "character" && L.bank[id]?.file);
const refs = [{ name: "place", file: L.bank[place.id].file, what: `the place, ${place.name}` }, ...present.map((id) => ({ name: id, file: L.bank[id].file, what: `${byId[id].name} (same face and clothes)` })), ...frames.slice(0, 10 - 1 - present.length).map((f, i) => ({ name: `key${i + 1}`, file: f.file, what: `keyframe ${i + 1}` }))];
const beats = sc.beats.map((b) => (b.kind === "dialogue" ? `${cap(b.who)} (${VOICE[b.who] || "a natural period voice"}) says: "${b.text}"` : b.text)).join(" ");
const prompt = `One continuous shot of ${seconds} seconds from one fixed camera in @place. ${present.map((id) => `@${id} is ${byId[id].name}`).join("; ")}; keep their faces and clothes exactly. ${frames.length ? `The shot passes through these moments in order: ${frames.map((f, i) => `@key${i + 1}`).join(", then ")}; it begins exactly as @key1.` : `It begins as: ${kf.first}`}
What happens, in order: ${beats}
The people move naturally; whoever speaks has lips moving with the words. Nothing appears that is not in the references or named here. Sound: ${ambience}, the voices clearly; no music, no narration.`;
const file = `clips/s${k}-onepass-${model}.mp4`;
console.log(`one pass: ${model} ${seconds}s · references: ${refs.map((r) => `@${r.name}`).join(" ")}`);
await jobs.tvideo(`onepass-s${k}-${model}`, file, prompt, refs, seconds, { ...VIDEO, model, audio: true });
const mp3 = run.path(file.replace(/\.mp4$/, ".mp3"));
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
const heard = tr.text || JSON.stringify(tr).slice(0, 200);
console.log(`heard: ${heard}`);
((L.onepass ??= {})[k] ??= {})[model] = { file, prompt, refs: refs.map((r) => ({ name: r.name, file: r.file, what: r.what })), seconds, heard, credits: L.calls.at(-1)?.credits }; run.save();
console.log(`done · ${jobs.spent()} credits in this run so far`);
