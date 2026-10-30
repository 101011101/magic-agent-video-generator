// Video for a chain scene: one clip between each pair of consecutive keyframes (start frame → end frame), wan-3.0 720p with sound,
// prompt = the screenplay beats that keyframe covers + their sfx + the scene's ambience; stitched with audio.
// Usage: CLEANED_CAP=… node cleaned/experiments/chain-video.mjs --scene 2 [--seconds 5]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { check } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const k = Number(opt("--scene", 2)), seconds = Number(opt("--seconds", 5));
const OUT = join(RUNS, "exp-bakery");
const run = { name: "exp-bakery", path: (f) => join(OUT, f), log: JSON.parse(readFileSync(join(OUT, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(OUT, "run.json"), JSON.stringify(run.log, null, 2));
const jobs = new Jobs(run);
const src = JSON.parse(readFileSync(join(RUNS, "custom-bakery-real", "run.json"), "utf8")), scene = src.screenplay.scenes[k - 1];
const chain = run.log.chain[k], frames = chain.frames;

// The beats a keyframe covers: its "source" quotes them with their numbers ("5. Baker opens the oven…").
const beatsOf = (f) => [...(f.source || "").matchAll(/(\d+)\./g)].map((m) => scene.beats[Number(m[1]) - 1]).filter(Boolean);
const clips = [];
for (let i = 0; i < frames.length - 1; i++) {
  const a = frames[i], b = frames[i + 1], beats = beatsOf(b);
  const action = beats.map((x) => x.text).join(" ") || b.prompt.split("Change ONLY this: ")[1]?.split(" Everyone")[0] || "";
  const sfx = beats.map((x) => x.sfx).filter(Boolean).join(", ");
  const prompt = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. What happens between them: ${action} Natural motion only; nothing appears that is not in the frames. Sound: ${scene.ambience || "room tone"}${sfx ? `; ${sfx}` : ""}; no voices; no music.`;
  const file = `chain-s${k}-clip${i + 1}.mp4`;
  console.log(`clip ${i + 1}: ${a.file} → ${b.file} · ${action.slice(0, 100)}`);
  await jobs.video(`chain-s${k}-clip${i + 1}`, file, prompt, a.file, b.file, seconds, { ...VIDEO, model: "wan-3.0", audio: true });
  const qa = check(run.path(file), { start: run.path(a.file), end: run.path(b.file), path: run.path, key: `chain-s${k}-${i + 1}` });
  console.log(`  first≈start ${qa.first_vs_start} · last≈end ${qa.last_vs_end} · ${qa.seconds}s`);
  clips.push({ file, prompt, qa, from: a.file, to: b.file });
}
const out = `chain-s${k}.mp4`;
const parts = clips.map((c, i) => { const p = run.path(c.file.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(c.file), "-vf", `${i ? "trim=start_frame=1," : ""}setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`, "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
const list = run.path(`chain-s${k}-concat.txt`); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", run.path(out)]);
chain.video = { clips, out, seconds, model: "wan-3.0" }; run.save();
console.log(`stitched: ${out} (${clips.length} clips, ${clips.length * seconds} s) · ${jobs.spent()} credits spent in this run so far`);
