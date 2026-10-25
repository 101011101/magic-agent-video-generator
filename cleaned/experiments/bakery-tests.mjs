// Isolated tests on the photoreal bakery run (custom-bakery-real). Paid ones go through the Jobs gate under run "exp-bakery".
// Usage: node cleaned/experiments/bakery-tests.mjs S1 G5
//   S1  the neighbour's sheet with the SAME spec and only the medium word changed: "studio photograph of a real person" vs
//       "3D animated-film character". Does the theme word decide the look? (2 × 200 credits)
//   G5  scene 5 (the counter) as ONE grid from a hand-written minimal prompt: plate + one sheet per person + one image of the bread
//       as it is now, no spec text. What a grid prompt needs. (300 credits at 4k)
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { Jobs, IMAGE } from "../src/jobs.js";
import { checkGrid, cropCells } from "../src/grid.js";

const SRC = "custom-bakery-real", R = (f) => join(RUNS, SRC, f), src = JSON.parse(readFileSync(R("run.json"), "utf8"));
const OUT = join(RUNS, "exp-bakery"); mkdirSync(join(OUT, "in"), { recursive: true });
const run = { name: "exp-bakery", path: (f) => join(OUT, f), log: existsSync(join(OUT, "run.json")) ? JSON.parse(readFileSync(join(OUT, "run.json"), "utf8")) : {} };
run.save = () => writeFileSync(join(OUT, "run.json"), JSON.stringify(run.log, null, 2));
const jobs = new Jobs(run);
const take = (f) => { const to = `in/${f.split("/").pop()}`; if (!existsSync(join(OUT, to))) copyFileSync(R(f), join(OUT, to)); return to; };
const spec = (id) => src.asset_specs.find((a) => a.id === id);

// S1: same spec, two medium words. The current template is the control (7 tries, all 3D cartoon: roots/neighbour*.png).
async function S1() {
  const a = spec("neighbour");
  const body = `${a.spec} ${a.height}
Standing, front view, neutral pose, arms relaxed, whole figure visible head to feet.
Plain light-grey seamless studio backdrop, soft even light, nothing else in the picture; no text.`;
  const variants = {
    photo: `A studio photograph of a real person, full length, shot on a cinema camera. The person: ${body}`,
    cartoon: `A 3D animated-film character design, full length. The character: ${body}`,
  };
  await Promise.all(Object.entries(variants).map(([v, prompt]) => jobs.image(`S1-${v}`, `S1-neighbour-${v}.png`, prompt)));
  for (const [v, prompt] of Object.entries(variants)) console.log(`S1 ${v}: ${run.path(`S1-neighbour-${v}.png`)}\n  ${prompt.split("\n")[0].slice(0, 120)}…`);
}

// G5: scene 5 from a minimal prompt. Inputs: 1 plate, 2 baker, 3 neighbour (S1 photo sheet), 4 parent, 5 child, 6 bread state (s3-p5).
async function G5() {
  const neighbour = existsSync(run.path("S1-neighbour-photo.png")) ? "S1-neighbour-photo.png" : take("roots/neighbour-t7.png");
  const inputs = [take("roots/shop.png"), take("roots/baker.png"), neighbour, take("roots/parent.png"), take("roots/child.png"), take("frames/s3-p5.png")];
  const prompt = `A storyboard grid of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text. Cells 1 to 8 are eight consecutive moments in reading order; cell 9 is the empty shop.
Image 1 is the shop. Every cell shows this room from exactly this camera; only the people and the bread change.
Image 2 is the baker. Image 3 is the neighbour. Image 4 is the parent. Image 5 is the child. Each keeps the same face, hair and clothes in every cell; their poses and the grey backgrounds in those images do not apply.
Image 6 is how the bread looks now: one baked loaf on the wire cooling rack and one tray of baked croissants on the workbench. These are the only bread and pastries in the shop; the shelves stay empty.
Throughout: the baker stands behind the counter; the neighbour (a canvas shopping bag on her arm), the parent and the child stand across the counter from the baker, the neighbour nearest the blue front door.
1. The baker lifts one croissant from the tray.
2. The baker slips the croissant into a small brown paper bag on the counter.
3. The baker passes the paper bag across the counter to the neighbour.
4. The baker lifts the loaf from the cooling rack.
5. The baker folds a sheet of plain paper around the loaf on the counter.
6. The parent receives the wrapped loaf; the baker's shoulders droop.
7. The neighbour and the parent smile at the baker; the parent holds the wrapped loaf.
8. The baker lifts their head and smiles.
Live-action photograph, cinema camera, shallow depth of field, warm practical light.`;
  const file = "G5-grid.png";
  try { await jobs.image("G5", file, prompt, inputs, { ...IMAGE, resolution: "4k" }); }
  catch (e) { if (!/timed out/.test(e.message)) throw e; console.log("  4k timed out; 2k"); await jobs.image("G5-2k", file, prompt, inputs, { ...IMAGE, resolution: "2k" }); }
  const gc = await checkGrid(run.path(file), 8);
  console.log(`G5 grid check: ${gc.rows}×${gc.cols}${gc.equal_cells ? "" : ", unequal"}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
  const drawn = gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3];
  cropCells(run.path(file), drawn[0] * drawn[1], (i) => run.path(`G5-cell${i}.png`), drawn);
  console.log(`G5: ${run.path(file)} and G5-cell*.png`);
}

const tests = { S1, G5 };
for (const t of process.argv.slice(2)) { if (!tests[t]) throw new Error(`no test ${t}`); console.log(`== ${t}`); await tests[t](); }
run.save();
