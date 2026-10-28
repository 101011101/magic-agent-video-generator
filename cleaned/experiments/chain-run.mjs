// Run the chain for one scene: frame 1 from the plate + sheets, every later frame from the one before, using the prompts that
// chain-prompts.mjs prints. Tool: Magic Hour /v1/ai-image-editor (nano-banana-pro, 2k, 200 credits per frame). One attempt per
// frame (no retries); the framing gate (SSIM to the previous frame) is measured and reported, not enforced.
// Usage: CLEANED_CAP=… node cleaned/experiments/chain-run.mjs --scene 1
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { Jobs } from "../src/jobs.js";
import { framing } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const k = Number(opt("--scene", 1));
const src = JSON.parse(readFileSync(join(RUNS, "custom-bakery-real", "run.json"), "utf8"));
const kf = JSON.parse(readFileSync(join(RUNS, "exp-bakery", `keyframes-s${k}-beats.json`), "utf8"));
const v2 = JSON.parse(readFileSync(join(RUNS, "custom-bakery-v2", "run.json"), "utf8"));
const OUT = join(RUNS, "exp-bakery"); mkdirSync(join(OUT, "in"), { recursive: true });
const run = { name: "exp-bakery", path: (f) => join(OUT, f), log: JSON.parse(readFileSync(join(OUT, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(OUT, "run.json"), JSON.stringify(run.log, null, 2));
const jobs = new Jobs(run);
const take = (f) => { const to = `in/v2-${f.split("/").pop()}`; if (!existsSync(join(OUT, to))) copyFileSync(join(RUNS, "custom-bakery-v2", f), join(OUT, to)); return to; };

const env = src.board[k - 1].environment, prevEnv = k > 1 ? src.board[k - 2].environment : null;
const chars = src.asset_specs.filter((a) => a.kind === "character"), present = chars.filter((c) => kf.first.toLowerCase().includes(c.name.toLowerCase()));
const medium = v2.medium;
// State manager, mocked for one scene: image 1 = the plate (first visit) or the last frame of the previous scene in the same place.
const prevLast = `chain-s${k - 1}-last.png`;
const base = prevEnv === env && existsSync(run.path(prevLast)) ? { file: prevLast, kind: "frame" } : { file: take(v2.plates[env].file), kind: "plate" };
const sheets = present.map((c) => ({ name: c.name, file: take(v2.sheets[c.id].file) }));
const who = sheets.map((s, i) => `Image ${i + 2} is ${s.name}: same face, hair and clothes; its pose and grey background do not apply.`).join(" ");
const tail = `${medium.frame} One single frame, no text.`;
const first = base.kind === "plate"
  ? `Image 1 is the empty place. ${who} Put this moment into image 1, keeping its room, camera, light and colours exactly:\n${kf.first}\n${tail}`
  : `Image 1 is this place as it was last seen. ${who} Edit image 1 into this moment; the room, camera, light and colours stay exactly as in image 1:\n${kf.first}\n${tail}`;

const frames = [], log = [];
let file = `chain-s${k}-f1.png`;
console.log(`scene ${k} (${env}): frame 1 ← ${base.kind} ${base.file}${sheets.length ? ` + sheets ${sheets.map((s) => s.name).join(", ")}` : ""}`);
await jobs.image(`chain-s${k}-f1`, file, first, [base.file, ...sheets.map((s) => s.file)]);
frames.push(file); log.push({ n: 1, file, inputs: [base.file, ...sheets.map((s) => s.file)], prompt: first });
for (const [i, f] of kf.keyframes.entries()) {
  const prev = file; file = `chain-s${k}-f${i + 2}.png`;
  const prompt = `Edit image 1. Change ONLY this: ${f.state} Everyone and everything else stays exactly as in image 1: same people in the same places and poses, same objects, same light, same framing, zoom and crop.\n${tail}`;
  console.log(`  frame ${i + 2} ← ${prev} · ${f.state.slice(0, 90)}`);
  await jobs.image(`chain-s${k}-f${i + 2}`, file, prompt, [prev]);
  const fr = framing(run.path(file), run.path(prev));
  console.log(`    framing vs previous: ssim ${fr.ssim}, corner shift ${fr.corner_shift}${fr.changed ? "  ← would be rejected as a repaint" : ""}`);
  frames.push(file); log.push({ n: i + 2, file, inputs: [prev], prompt, source: f.source, framing: fr });
}
copyFileSync(run.path(file), run.path(`chain-s${k}-last.png`));
(run.log.chain ??= {})[k] = { env, frames: log, credits: frames.length * 200 }; run.save();
console.log(`done: ${frames.length} frames, ${jobs.spent()} credits spent in this run so far`);
