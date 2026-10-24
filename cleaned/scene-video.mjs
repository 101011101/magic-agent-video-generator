// One scene → video: a clip between each pair of consecutive keyframes (start frame → end frame), prompt = the moment's action,
// background sound and effects from the screenplay (wan-3.0 generates audio at no extra cost), then stitched into scene-k.mp4.
// Usage: CLEANED_CAP=… node cleaned/scene-video.mjs --run custom-bakery1 --scene 3 [--model wan-3.0] [--seconds 5]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "./src/env.js";
import { Jobs, VIDEO } from "./src/jobs.js";
import { stitch, check } from "./src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const name = opt("--run", "custom-bakery1"), k = Number(opt("--scene", 3)), model = opt("--model", "wan-3.0"), seconds = Number(opt("--seconds", 5));
const dir = join(RUNS, name), log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), t = JSON.parse(readFileSync(join(dir, "tracker.json"), "utf8"));
mkdirSync(join(dir, "clips"), { recursive: true });
const run = { name: `${name}-video`, path: (f) => join(dir, f), log: log.video_log || {} };
run.save = () => { log.video_log = run.log; writeFileSync(join(dir, "run.json"), JSON.stringify(log, null, 2)); };
const jobs = new Jobs(run);
const frames = t.frames.filter((f) => f.op === "edit" && f.scene === k).sort((a, b) => a.panel - b.panel);
const board = log.board, sp = log.screenplay;
// panels of grid k (grids split scenes by environment; map back through the frame's panel index within its screenplay scene)
const sceneIdx = (() => { let n = 0; for (let i = 0; i < board.length; i++) { const envs = board[i].panels.map((p) => p.environment || board[i].environment); let cur = null; for (const e of envs) { if (e !== cur) { n++; cur = e; } if (n === k) return i; } } return 0; })();
const scene = sp.scenes[sceneIdx], panels = board[sceneIdx].panels;
const panelFor = (f) => panels.find((p, i) => i === f.panel - 1 + (panels.findIndex((q) => (q.environment || board[sceneIdx].environment) === f.location))) || panels[f.panel - 1];
const clips = [];
for (let i = 0; i < frames.length - 1; i++) {
  const a = frames[i], b = frames[i + 1], p = panelFor(b) || {}, beats = (p.beats || []).map((j) => scene.beats[j - 1]).filter(Boolean);
  const sfx = beats.map((x) => x.sfx).filter(Boolean).join(", "), dialogue = beats.filter((x) => x.kind === "dialogue").map((x) => `${x.who} says "${x.text}"`).join(". ");
  const prompt = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. ${p.action || ""} ${(p.changes || []).map((c) => c.now).join("; ")}. Natural motion only; nothing appears that is not in the frames. Sound: ${scene.ambience || "room tone"}${sfx ? `; ${sfx}` : ""}${dialogue ? `; ${dialogue}` : "; no voices"}; no music.`;
  const file = `clips/scene-${k}-${i + 1}.mp4`;
  console.log(`clip ${i + 1}: ${a.file} → ${b.file} · ${p.action?.slice(0, 90)}`);
  await jobs.video(`scene-${k}-clip-${i + 1}`, file, prompt, a.file, b.file, seconds, { ...VIDEO, model, audio: true });
  const qa = check(run.path(file), { start: run.path(a.file), end: run.path(b.file), path: run.path, key: `scene-${k}-${i + 1}` });
  console.log(`  first≈start ${qa.first_vs_start} · last≈end ${qa.last_vs_end} · ${qa.seconds}s`);
  clips.push({ file, trimFirst: i > 0, prompt, qa, from: a.file, to: b.file });
}
// Stitch, keeping the audio of each clip.
const out = `clips/scene-${k}.mp4`;
if (clips.every((c) => existsSync(run.path(c.file)))) {
  stitchWithAudio(clips.map((c) => run.path(c.file)), run.path(out));
  console.log(`stitched: ${out} (${clips.length} clips, ${clips.length * seconds} s)`);
}
log.video = { ...(log.video || {}), [k]: { clips, out, model, seconds } }; writeFileSync(join(dir, "run.json"), JSON.stringify(log, null, 2));
console.log(`spent ${jobs.spent()} credits`);

function stitchWithAudio(files, outFile) {
  const { execFileSync } = require_("node:child_process");
  const parts = files.map((f, i) => { const p = f.replace(/\.mp4$/, `-part.mp4`); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", f, "-vf", `${i ? "trim=start_frame=1," : ""}setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`, "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
  const list = outFile.replace(/\.mp4$/, "-concat.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", outFile]);
}
function require_(m) { return createRequire(import.meta.url)(m); }
import { createRequire } from "node:module";
