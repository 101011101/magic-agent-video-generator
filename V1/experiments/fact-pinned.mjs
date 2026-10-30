// Pinned shots: every clip's START and END are painted keyframes, and the cut between two clips is the same moment reframed
// (the second clip's start frame is painted FROM the first clip's end frame as a new framing). Clips are image-to-video with
// both frames pinned, so each shot begins and ends exactly where the stills say. Scene 2 of the Vanderbilt film as two clips.
// Usage: CLEANED_CAP=… node V1/experiments/fact-pinned.mjs --label vanderbilt2
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { check, ssim } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt2"), model = opt("--model", "wan-3.0");
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "pinned"), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), say = (m) => console.log(m);
const tail = `${L.medium.frame} One single frame, no text or captions.`;
const VOICE = { "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent", "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent" };
const sc = L.screenplay.scenes[1], line = (i) => sc.beats[i - 1];   // scene 2 beats: 4..8 are the lines

// Keyframes. A and B exist (the chain's frame 1 and frame 4 of scene 2); C is B reframed; D is C after the offer.
const A = "frames/s2-f1.png", B = "frames/s2-f4.png", C = "pinned/C.png", D = "pinned/D.png";
say("keyframe C: the handshake moment reframed as a medium two-shot (from B)");
await jobs.image("pinned-C", C, `Image 1 is a wide shot of a moment: Lincoln (right) and Vanderbilt (left) have just shaken hands, Stanton beside them. Make the SAME moment as a medium two-shot: the camera closer and a little to the left, Lincoln and Vanderbilt from the waist up facing each other, hands just released, Stanton visible behind between them; the same room, the same light, the same clothes and faces as image 1. Nothing is added.\n${tail}`, [B]);
say("keyframe D: the end of the exchange, same framing (from C)");
await jobs.image("pinned-D", D, `Edit image 1. Change ONLY this: Lincoln's head is up and he smiles slightly at Vanderbilt, who faces him squarely with his chin raised, having made his offer; Stanton behind watches Lincoln. Same framing, same camera, same room, same light; nothing is added.\n${tail}`, [C]);
say(`  C vs B ssim ${ssim(run.path(C), run.path(B))} · D vs C ssim ${ssim(run.path(D), run.path(C))}`);

// Clip 1: A → B, wide, 10 s: the entry, the handshake, Lincoln's question.
const p1 = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. Stanton leads Vanderbilt through the doorway at left toward Lincoln at right; Lincoln and Vanderbilt shake hands. As they do, Abraham Lincoln (${VOICE["ABRAHAM LINCOLN"]}) says: "${line(4).text}" Lips move with the words; the people move naturally; nothing appears that is not in the frames. Sound: a quiet 1860s room, the voice clearly; no music.`;
say("clip 1: A → B, 10 s");
await jobs.video(`pinned-clip1-${model}`, "pinned/clip1.mp4", p1, A, B, 10, { ...VIDEO, model, audio: true });
// Clip 2: C → D, medium, 20 s: the four remaining lines.
const lines = [5, 6, 7, 8].map((i) => line(i)), cap = (s) => s.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
const p2 = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. The two men speak in turn, lips moving with the words, with natural small gestures: ${lines.map((l) => `${cap(l.who)} (${VOICE[l.who] || "a natural period voice"}) says: "${l.text}"`).join(" ")} Nothing appears that is not in the frames. Sound: a quiet 1860s room, the voices clearly; no music.`;
say("clip 2: C → D, 20 s");
await jobs.video(`pinned-clip2-${model}`, "pinned/clip2.mp4", p2, C, D, 20, { ...VIDEO, model, audio: true });

// Checks and stitch.
async function transcribe(file) {
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3")); execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((t) => t.text || JSON.stringify(t).slice(0, 200)).catch((e) => String(e));
}
const q1 = check(run.path("pinned/clip1.mp4"), { start: run.path(A), end: run.path(B), path: run.path, key: "pinned-1" }), q2 = check(run.path("pinned/clip2.mp4"), { start: run.path(C), end: run.path(D), path: run.path, key: "pinned-2" });
const h1 = await transcribe("pinned/clip1.mp4"), h2 = await transcribe("pinned/clip2.mp4");
say(`clip 1: first≈A ${q1.first_vs_start} last≈B ${q1.last_vs_end} · heard: ${h1}`);
say(`clip 2: first≈C ${q2.first_vs_start} last≈D ${q2.last_vs_end} · heard: ${h2}`);
const parts = ["pinned/clip1.mp4", "pinned/clip2.mp4"].map((f) => { const p = run.path(f.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(f), "-vf", "setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p", "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
writeFileSync(run.path("pinned/concat.txt"), parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", run.path("pinned/concat.txt"), "-c", "copy", run.path("pinned/scene-2.mp4")]);
L.pinned = { keyframes: { A, B, C, D }, clips: [{ file: "pinned/clip1.mp4", prompt: p1, qa: q1, heard: h1, seconds: 10 }, { file: "pinned/clip2.mp4", prompt: p2, qa: q2, heard: h2, seconds: 20 }], out: "pinned/scene-2.mp4" }; run.save();
say(`done: pinned/scene-2.mp4 (30 s) · ${jobs.spent()} credits in this run so far`);
