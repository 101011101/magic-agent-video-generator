// Pinned shots, done by the rule: IDENTITY FROM THE BANK, ENVIRONMENT FROM THE PLATE OR THE LAST FRAME. Every keyframe is painted
// with the portraits attached and the identities spelled out, then checked against the portraits (one retry) before anything
// is built on it. Clips are image-to-video pinned at both ends. Scene 2 of the Vanderbilt film as two clips with one cut.
// Usage: CLEANED_CAP=… node V1/experiments/fact-pinned2.mjs --label vanderbilt2
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { check, ssim } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt2"), model = opt("--model", "wan-3.0");
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "pinned2"), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), say = (m) => console.log(m);
const tail = `${L.medium.frame} One single frame, no text or captions.`;
const plate = L.bank["mansion-int"].file, P = { lincoln: L.bank.lincoln.file, vanderbilt: L.bank.vanderbilt.file, stanton: L.bank.stanton.file };
// The portraits are always images 2, 3, 4, in this order, with the telling features named so two bearded men cannot be confused.
const WHO = `Image 2 is Abraham Lincoln (tall, dark chin beard without a moustache, black frock coat). Image 3 is Cornelius Vanderbilt (older, white hair and white side-whiskers, clean-shaven chin, NO glasses). Image 4 is Edwin Stanton (full dark beard and moustache, small round glasses). Same faces and clothes of the period in every frame; the poses and backgrounds of those pictures do not apply.`;
const ports = [P.lincoln, P.vanderbilt, P.stanton];
const VOICE = { "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent", "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent" };
const sc = L.screenplay.scenes[1], line = (i) => sc.beats[i - 1];

// Identity check: who is who in the frame, against the portraits.
async function who(file, question) {
  return jsonCall({ name: "pinned-identity", effort: "medium", images: [run.path(file), ...ports.map((p) => run.path(p))],
    schema: S.obj({ answer: S.enum(["vanderbilt", "stanton", "lincoln", "neither", "unclear"]), people: S.int, note: S.str }),
    prompt: `Image 1 is a film frame. Image 2 is Abraham Lincoln, image 3 Cornelius Vanderbilt (white side-whiskers, no glasses), image 4 Edwin Stanton (full beard, round glasses).
${question} Answer with the id of the man from the portraits. people: how many people are in image 1. note: short.` });
}
async function paint(id, file, prompt, inputs, question, want) {
  for (let t = 1; t <= 2; t++) {
    const f = t === 1 ? file : file.replace(/\.png$/, `-t${t}.png`);
    await jobs.image(t === 1 ? id : `${id}-t${t}`, f, t === 1 ? prompt : `${prompt}\nIt is the man of image 3, white-whiskered and without glasses, whose hand Lincoln holds; the bearded man with glasses, image 4, stands behind and does not shake hands.`, inputs);
    const r = await who(f, question);
    say(`  ${id} try ${t}: ${r.answer} (${r.people} people) · ${r.note}`);
    if (r.answer === want && r.people === 3) return { file: f, check: r, tries: t };
    if (t === 2) return { file: f, check: r, tries: t, failed: true };
  }
}

const A = "frames/s2-f1.png";
say("B: wide handshake, from the plate + portraits");
const B = await paint("pinned2-B", "pinned2/B.png", `Image 1 is the empty room. ${WHO} Put this moment into image 1, keeping its room, camera, light and colours exactly: a wide shot; Lincoln (image 2) stands at the right by the fireplace shaking hands with Vanderbilt (image 3), who faces him; Stanton (image 4) stands a step behind Vanderbilt, toward the door at the left, watching. Exactly three men.\n${tail}`, [plate, ...ports], "Which man is shaking hands with Lincoln?", "vanderbilt");
say("C: the same moment as a medium two-shot, environment and framing from B, identity from the portraits");
const C = await paint("pinned2-C", "pinned2/C.png", `Image 1 is a wide shot of a moment: Lincoln and Vanderbilt have just shaken hands, Stanton behind them. ${WHO} Make the SAME moment as a medium two-shot: the camera closer and a little to the left; Lincoln (image 2) and Vanderbilt (image 3) from the waist up facing each other, hands just released; Stanton (image 4) visible behind between them; the same room, light and clothes as image 1. Nothing is added.\n${tail}`, [B.file, ...ports], "Which man stands face to face with Lincoln, nearest him?", "vanderbilt");
say("D: the end of the exchange, same framing, from C + portraits");
const D = await paint("pinned2-D", "pinned2/D.png", `Edit image 1. ${WHO} Change ONLY this: Lincoln's (image 2) head is up and he smiles slightly at Vanderbilt (image 3), who faces him squarely with his chin raised, having made his offer; Stanton (image 4) behind watches Lincoln. Same framing, same camera, same room, same light; nothing is added.\n${tail}`, [C.file, ...ports], "Which man stands face to face with Lincoln, nearest him?", "vanderbilt");
say(`  C vs B ssim ${ssim(run.path(C.file), run.path(B.file))} · D vs C ssim ${ssim(run.path(D.file), run.path(C.file))}`);

const p1 = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. Stanton leads Vanderbilt through the doorway at left toward Lincoln at right; Lincoln and Vanderbilt shake hands. As they do, Abraham Lincoln (${VOICE["ABRAHAM LINCOLN"]}) says: "${line(4).text}" Lips move with the words; the people move naturally; nothing appears that is not in the frames. Sound: a quiet 1860s room, the voice clearly; no music.`;
say("clip 1: A → B, 10 s");
await jobs.video(`pinned2-clip1-${model}`, "pinned2/clip1.mp4", p1, A, B.file, 10, { ...VIDEO, model, audio: true });
const cap = (s) => s.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase()), lines = [5, 6, 7, 8].map((i) => line(i));
const p2 = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. The two men speak in turn, lips moving with the words, with natural small gestures: ${lines.map((l) => `${cap(l.who)} (${VOICE[l.who] || "a natural period voice"}) says: "${l.text}"`).join(" ")} Nothing appears that is not in the frames. Sound: a quiet 1860s room, the voices clearly; no music.`;
say("clip 2: C → D, 20 s");
await jobs.video(`pinned2-clip2-${model}`, "pinned2/clip2.mp4", p2, C.file, D.file, 20, { ...VIDEO, model, audio: true });

async function transcribe(file) {
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3")); execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((t) => t.text || JSON.stringify(t).slice(0, 200)).catch((e) => String(e));
}
const q1 = check(run.path("pinned2/clip1.mp4"), { start: run.path(A), end: run.path(B.file), path: run.path, key: "pinned2-1" }), q2 = check(run.path("pinned2/clip2.mp4"), { start: run.path(C.file), end: run.path(D.file), path: run.path, key: "pinned2-2" });
const h1 = await transcribe("pinned2/clip1.mp4"), h2 = await transcribe("pinned2/clip2.mp4");
say(`clip 1: first≈A ${q1.first_vs_start} last≈B ${q1.last_vs_end} · heard: ${h1}`);
say(`clip 2: first≈C ${q2.first_vs_start} last≈D ${q2.last_vs_end} · heard: ${h2}`);
const parts = ["pinned2/clip1.mp4", "pinned2/clip2.mp4"].map((f) => { const p = run.path(f.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(f), "-vf", "setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p", "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
writeFileSync(run.path("pinned2/concat.txt"), parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", run.path("pinned2/concat.txt"), "-c", "copy", run.path("pinned2/scene-2.mp4")]);
L.pinned2 = { keyframes: { A, B, C, D }, clips: [{ file: "pinned2/clip1.mp4", prompt: p1, qa: q1, heard: h1, seconds: 10 }, { file: "pinned2/clip2.mp4", prompt: p2, qa: q2, heard: h2, seconds: 20 }], out: "pinned2/scene-2.mp4" }; run.save();
say(`done: pinned2/scene-2.mp4 · ${jobs.spent()} credits in this run so far`);
