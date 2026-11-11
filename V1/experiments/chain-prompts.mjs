// The chain's prompts for one scene, composed from its keyframe breakdown (keyframes.mjs --beats) and the state manager's choice
// of images: first frame = the place's plate (or its latest frame) + one sheet per character present; every later frame = the
// previous frame only (+ a sheet for anyone entering). Assets are taken from custom-bakery-v2 (sheets and plates already made).
// Usage: node V1/experiments/chain-prompts.mjs --scene 2   → prints tool, inputs and prompt per frame; nothing is generated.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const k = Number(opt("--scene", 1)), src = JSON.parse(readFileSync(join(RUNS, "custom-bakery-real", "run.json"), "utf8"));
const kf = JSON.parse(readFileSync(join(RUNS, "exp-bakery", `keyframes-s${k}-beats.json`), "utf8"));
const assets = JSON.parse(readFileSync(join(RUNS, "custom-bakery-v2", "run.json"), "utf8"));   // sheets, plates, medium
const env = src.board[k - 1].environment, scene = src.screenplay.scenes[k - 1];
const heading = `${scene.inside ? "INT." : "EXT."} ${scene.place} — ${scene.time}`;
const chars = src.asset_specs.filter((a) => a.kind === "character"), present = chars.filter((c) => kf.first.toLowerCase().includes(c.name.toLowerCase()));
const medium = assets.medium;

// State manager (mocked for this scene): the place's latest frame is scene k-1's last frame when it is the same place, else the plate.
const prevScene = k > 1 ? src.board[k - 2].environment : null;
const base = prevScene === env ? { file: `custom-bakery-v2/frames/s${k - 1}-last.png (the last frame of scene ${k - 1}, same place)`, kind: "frame" } : { file: `custom-bakery-v2/${assets.plates[env].file}`, kind: "plate" };
const sheets = present.map((c) => ({ id: c.id, name: c.name, file: `custom-bakery-v2/${assets.sheets[c.id].file}` }));
const lines = [];
lines.push(`SCENE ${k}: ${heading}   place: ${env}`);
lines.push(`assets needed: ${base.kind === "plate" ? `plate of ${env}` : `last frame of scene ${k - 1}`}${sheets.length ? `, sheets: ${sheets.map((s) => s.name).join(", ")}` : ""}  (all exist in custom-bakery-v2 except frames not yet made)`);
// Frame 1.
const imgs = [base.file, ...sheets.map((s) => s.file)];
const who = sheets.map((s, i) => `Image ${i + 2} is ${s.name}: same face, hair and clothes; its pose and grey background do not apply.`).join(" ");
const f1 = base.kind === "plate"
  ? `Image 1 is the empty place. ${who} Put this moment into image 1, keeping its room, camera, light and colours exactly:\n${kf.first}\n${medium.frame} One single frame, no text.`
  : `Image 1 is this place as it was last seen. ${who} Edit image 1 into this moment; the room, camera, light and colours stay exactly as in image 1:\n${kf.first}\n${medium.frame} One single frame, no text.`;
lines.push(`\n--- frame 1 · tool: Magic Hour /v1/ai-image-editor, nano-banana-pro, 2k (200 credits) · inputs: ${imgs.join(", ")}\n${f1}`);
// Later frames.
kf.keyframes.forEach((f, i) => {
  const enter = (f.enters || []).map((n) => sheets.find((s) => s.name.toLowerCase() === n.toLowerCase()) || chars.find((c) => c.name.toLowerCase() === n.toLowerCase()));
  const ins = [`frame ${i + 1} of this scene`, ...enter.filter(Boolean).map((e) => `custom-bakery-v2/${assets.sheets[e.id]?.file || "(sheet needed: " + e.name + ")"}`)];
  const add = enter.filter(Boolean).map((e, j) => ` Image ${j + 2} is ${e.name}, entering: same face, hair and clothes; its pose and grey background do not apply.`).join("");
  const p = `Edit image 1. Change ONLY this: ${f.state}${add} Everyone and everything else stays exactly as in image 1: same people in the same places and poses, same objects, same light, same framing, zoom and crop.\n${medium.frame} One single frame, no text.`;
  lines.push(`\n--- frame ${i + 2} · tool: /v1/ai-image-editor, nano-banana-pro, 2k (200) · inputs: ${ins.join(", ")} · from: "${f.source.replace(/\s+/g, " ")}"\n${p}`);
});
console.log(lines.join("\n"));
