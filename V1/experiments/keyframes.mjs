// Storyboard, keyframe form: for one screenplay scene, the first frame in full (the scene prompt) and every later keyframe as the
// transformation only, written as the resulting state. Text only; one LLM call per scene. Prints the result for review.
// Usage: node cleaned/experiments/keyframes.mjs --from custom-bakery-real --scene 5 [--loaves]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "custom-bakery-real"), k = Number(opt("--scene", 5)), loaves = args.includes("--loaves");
const max = Number(opt("--max", 0));   // --max N: at most N keyframes after the first frame (a time budget); a keyframe may then cover several beats
const src = JSON.parse(readFileSync(join(RUNS, from, "run.json"), "utf8"));
const scene = src.screenplay.scenes[k - 1], place = src.seed_plan.places.find((p) => p.id === (src.board[k - 1].environment));
const cast = src.asset_specs.filter((a) => a.kind === "character"), props = src.asset_specs.filter((a) => a.kind !== "character");
// --beats: feed the screenplay's action lines (numbered) instead of the story sentences.
const beats = args.includes("--beats");
let lines = beats ? scene.beats.map((b, i) => `${i + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n") : scene.story_lines.join(" ");
if (loaves) lines = "At the counter, the baker wraps a warm loaf in paper and hands it to the neighbour, then wraps the second loaf for the parent. The baker’s tired face brightens at their grateful smiles.";

const KEY = S.obj({ n: S.int, source: S.str, state: S.str, enters: S.arr(S.str), leaves: S.arr(S.str) });
const r = await jsonCall({ name: "keyframes", effort: "medium", schema: S.obj({ first: S.str, keyframes: S.arr(KEY) }),
  prompt: `You are the storyboard artist. Turn ONE scene of a live-action film into keyframes for an image editor that makes each frame by editing the frame before it.
The scene is continuous: one place, one fixed camera, no cuts. Nothing enters or leaves unless the story says so.
Write:
- first: the first frame in full, as one paragraph a painter could work from: the place from its camera (use the layout below, in camera terms: left, right, near, far), every character present (name them; their looks come from the sheets, so say only where each stands and what each does), every prop and its state (counts, held or resting where). Nothing that is not in the story.
- keyframes: the moments after the first frame, in order: ${max ? `AT MOST ${max} keyframes: pick the ${max} moments that matter most for the scene to read, each may cover several consecutive changes (state the result of all of them)` : "ONE keyframe per change in the text, never several frames for one action"}, and no keyframe for a line that only describes the state. Each is ONE transformation from the frame before, written as the RESULTING state in one or two sentences: who now holds what, what lies where, who looks where, counts (one loaf left on the rack). Do not write actions or verbs of motion ("lifts", "passes"); write what is true in the frame. Only what the story contains: no added business. source: the story words this keyframe comes from, quoted. enters / leaves: character or prop names that come into or go out of the picture in this keyframe (usually none).

Place: ${place.id}: ${place.look} Camera: ${place.camera}
Layout: ${place.marks.filter((m) => !m.area && !m.id.includes(".")).map((m) => `${m.name}: ${m.essential || m.where}`).join("; ")}
Characters: ${cast.map((a) => a.name).join(", ")}
Props: ${props.map((a) => `${a.name} (${a.spec.split(/(?<=\.)\s/)[0]})`).join("; ")}

Scene ${k}: ${scene.inside ? "INT." : "EXT."} ${scene.place} — ${scene.time}
${beats ? "The screenplay's action lines for this scene (in order; source = the line number and words)" : "The story for this scene"}: ${beats ? "\n" : ""}${lines}` });

const out = join(RUNS, "exp-bakery"); mkdirSync(out, { recursive: true });
writeFileSync(join(out, `keyframes-s${k}${loaves ? "-loaves" : ""}${beats ? "-beats" : ""}${max ? `-max${max}` : ""}.json`), JSON.stringify(r, null, 2));
console.log(`FIRST FRAME\n${r.first}\n`);
for (const f of r.keyframes) console.log(`${f.n}. ${f.state}${f.enters.length ? `  [enters: ${f.enters.join(", ")}]` : ""}${f.leaves.length ? `  [leaves: ${f.leaves.join(", ")}]` : ""}\n   ← "${f.source}"`);
