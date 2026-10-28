// Isolated tests on the photoreal bakery run (custom-bakery-real). Paid ones go through the Jobs gate under run "exp-bakery".
// Usage: node cleaned/experiments/bakery-tests.mjs S1 G5
//   S1  the neighbour's sheet with the SAME spec and only the medium word changed: "studio photograph of a real person" vs
//       "3D animated-film character". Does the theme word decide the look? (2 × 200 credits)
//   G5  scene 5 (the counter) as ONE grid from a hand-written minimal prompt: plate + one sheet per person + one image of the bread
//       as it is now, no spec text. What a grid prompt needs. (300 credits at 4k)
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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

// G5b: the same scene, inputs and moments, but ONE account of the cells: cell 1 in full, every later cell only its change.
async function G5b() {
  const neighbour = existsSync(run.path("S1-neighbour-photo.png")) ? "S1-neighbour-photo.png" : take("roots/neighbour-t7.png");
  const inputs = [take("roots/shop.png"), take("roots/baker.png"), neighbour, take("roots/parent.png"), take("roots/child.png"), take("frames/s3-p5.png")];
  const prompt = `A storyboard grid of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text. Cells 1 to 8 are eight consecutive moments of one continuous shot, in reading order; cell 9 is the empty shop.
Image 1 is the shop; every cell is this room from exactly this camera. Image 2 is the baker, image 3 the neighbour, image 4 the parent, image 5 the child: same face, hair and clothes in every cell; their poses and grey backgrounds do not apply. Image 6 shows the bread as it is now.
Cell 1, in full: the baker stands behind the counter and lifts one croissant from the tray of baked croissants on the workbench behind them. Across the counter stand three customers: the neighbour nearest the blue front door, a canvas shopping bag on her arm; the parent beside her; the child beside the parent. One baked loaf rests on the wire cooling rack. A small brown paper bag stands open on the counter. There is no other bread or pastry anywhere; the shelves are empty.
Each later cell is the cell before it with ONLY the change named; everyone and everything else stays exactly where it was.
2. The baker slips the croissant into the paper bag.
3. The baker passes the paper bag across the counter; the neighbour takes it.
4. The baker lifts the loaf from the cooling rack.
5. The baker folds a sheet of plain paper around the loaf on the counter.
6. The parent holds the wrapped loaf; the baker's shoulders droop.
7. The neighbour and the parent smile at the baker.
8. The baker lifts their head and smiles.
Live-action photograph, cinema camera, shallow depth of field, warm practical light.`;
  const file = "G5b-grid.png";
  try { await jobs.image("G5b", file, prompt, inputs, { ...IMAGE, resolution: "4k" }); }
  catch (e) { if (!/timed out/.test(e.message)) throw e; console.log("  4k timed out; 2k"); await jobs.image("G5b-2k", file, prompt, inputs, { ...IMAGE, resolution: "2k" }); }
  const gc = await checkGrid(run.path(file), 8);
  console.log(`G5b grid check: ${gc.rows}×${gc.cols}${gc.equal_cells ? "" : ", unequal"}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
  const drawn = gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3];
  cropCells(run.path(file), drawn[0] * drawn[1], (i) => run.path(`G5b-cell${i}.png`), drawn);
  console.log(`G5b: ${run.path(file)} and G5b-cell*.png`);
}

// T1: text only, no reference images. A slug describing cell 1 in full, then one bullet of change per cell. Loaves only.
async function T1() {
  const prompt = `One image made of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text. Every cell is a live-action photograph. Cells 1 to 8 are eight consecutive moments of one continuous shot from one fixed camera, in reading order; cell 9 is the empty bakery.

Cell 1: A live-action photograph, cinema camera, shallow depth of field, warm practical light. Inside a small neighbourhood bakery at opening time, from one fixed wide camera in the rear customer-side corner: a blue glazed front door at the far left with a chest-height shop sign on it, a wooden sales counter on the left running from near to far, a wooden workbench with a cream flour bowl at the far right under a large front window, a black baking oven and a wire cooling rack against the right wall, cream plaster walls, honey-coloured timber, worn stone floor. Behind the counter stands the baker: a middle-aged man with warm tan skin, a short brown moustache, short wavy dark-brown hair, a cream shirt with the sleeves rolled up, a honey-tan bib apron dusted with flour, midnight-blue trousers. Across the counter stand three customers: nearest the door, the neighbour, an older woman with a chin-length silver-grey bob, small round brown-framed glasses, a soft-blue cardigan over a cream blouse, a calf-length terracotta skirt, a plain cream canvas shopping bag on her arm; beside her the parent, a young woman with medium-brown skin and dark curly hair in a low bun, a terracotta hip-length jacket over a butter-yellow shirt, deep-blue trousers; beside the parent the child, about five, medium-brown skin, short springy dark curls, a sky-blue jumper over a cream shirt, honey-ochre trousers. Two baked oval loaves with scored tops rest side by side on the cooling rack; a stack of plain cream wrapping paper lies on the counter in front of the baker. Nothing else: no other bread or pastries, no other people.

Each later cell is the cell before it with only the change listed; everyone and everything else stays exactly where it was, seen from the same camera.
- Cell 2: the baker holds one loaf, lifted from the cooling rack; one loaf remains on the rack.
- Cell 3: the loaf lies on a sheet of the wrapping paper on the counter; the baker's hands fold the paper around it.
- Cell 4: the baker holds the paper-wrapped loaf out across the counter; the neighbour's hands take it.
- Cell 5: the neighbour holds the wrapped loaf against her bag; the baker holds the second loaf, lifted from the rack, which is now empty.
- Cell 6: the second loaf lies on a sheet of the wrapping paper on the counter; the baker's hands fold the paper around it.
- Cell 7: the parent holds the second wrapped loaf in both hands; the baker's shoulders droop and his head is lowered.
- Cell 8: the baker's head is up, smiling with wide eyes; the neighbour and the parent smile back at him; each still holds her wrapped loaf.
- Cell 9: the empty bakery, nobody in it, nothing on the counter but the stack of paper.`;
  const file = "T1-grid.png";
  await jobs.image("T1", file, prompt, [], { ...IMAGE, resolution: "4k" });
  const gc = await checkGrid(run.path(file), 8);
  console.log(`T1 grid check: ${gc.rows}×${gc.cols}${gc.equal_cells ? "" : ", unequal"}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
  const drawn = gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3];
  cropCells(run.path(file), drawn[0] * drawn[1], (i) => run.path(`T1-cell${i}.png`), drawn);
  writeFileSync(run.path("T1-prompt.txt"), prompt);
  console.log(`T1: ${run.path(file)} and T1-cell*.png`);
}

// F1: first and last frame of the counter scene. V1: both at once, top row of a 2×2 grid (bottom row the empty room).
// V2 (control): cell 1 of that grid as image 1, the last frame generated from it. Loaves only; same slug as T1.
const SLUG = `A live-action photograph, cinema camera, shallow depth of field, warm practical light. Inside a small neighbourhood bakery at opening time, from one fixed wide camera in the rear customer-side corner: a blue glazed front door at the far left with a chest-height shop sign on it, a wooden sales counter on the left running from near to far, a wooden workbench with a cream flour bowl at the far right under a large front window, a black baking oven and a wire cooling rack against the right wall, cream plaster walls, honey-coloured timber, worn stone floor. Behind the counter stands the baker: a middle-aged man with warm tan skin, a short brown moustache, short wavy dark-brown hair, a cream shirt with the sleeves rolled up, a honey-tan bib apron dusted with flour, midnight-blue trousers. Across the counter stand three customers: nearest the door, the neighbour, an older woman with a chin-length silver-grey bob, small round brown-framed glasses, a soft-blue cardigan over a cream blouse, a calf-length terracotta skirt, a plain cream canvas shopping bag on her arm; beside her the parent, a young woman with medium-brown skin and dark curly hair in a low bun, a terracotta hip-length jacket over a butter-yellow shirt, deep-blue trousers; beside the parent the child, about five, medium-brown skin, short springy dark curls, a sky-blue jumper over a cream shirt, honey-ochre trousers. Two baked oval loaves with scored tops rest side by side on the cooling rack; a stack of plain cream wrapping paper lies on the counter in front of the baker. Nothing else: no other bread or pastries, no other people.`;
const SCENE = `At the counter, the baker wraps a warm loaf in paper and hands it to the neighbour, then wraps the second loaf for the parent. The baker's tired face brightens at their grateful smiles.`;
const END = `the cooling rack is empty; the neighbour holds a paper-wrapped loaf against her bag; the parent holds a paper-wrapped loaf in both hands; the child looks up at the baker; the baker stands upright, head up, smiling with wide eyes; the neighbour and the parent smile back at him. Nothing else changes.`;
async function F1() {
  const v1 = `One image made of 4 equal cells, 2 rows × 2 columns, edge to edge, no gutters, borders, numbers or text. Every cell is a live-action photograph. Cell 1 (top left) is the FIRST frame of a scene and cell 2 (top right) its LAST frame, both from the same fixed camera; cells 3 and 4 are the empty room.

The scene: ${SCENE}

Cell 1, the first frame: ${SLUG}

Cell 2, the last frame: the same room from the same camera, the same four people in the same clothes, standing where they stand. The cooling rack is empty; the neighbour holds a paper-wrapped loaf against her bag; the parent holds a paper-wrapped loaf in both hands; the child looks up at the baker; the baker stands upright, head up, smiling with wide eyes; the neighbour and the parent smile back at him. Nothing else changes.`;
  await jobs.image("F1-v1", "F1-v1-grid.png", v1, [], { ...IMAGE, resolution: "4k" });
  const gc = await checkGrid(run.path("F1-v1-grid.png"), 2);
  console.log(`F1 v1 grid check: ${gc.rows}×${gc.cols} · ${gc.note}`);
  cropCells(run.path("F1-v1-grid.png"), 4, (i) => run.path(`F1-v1-cell${i}.png`), gc.rows && gc.cols ? [gc.rows, gc.cols] : [2, 2]);
  const v2 = `Image 1 is the first frame of a scene. Make its last frame: the same room from the same camera, the same four people in the same clothes, standing where they stand.
The scene: ${SCENE}
What has changed by the last frame: ${END}
Live-action photograph, cinema camera, shallow depth of field. One single frame, no text.`;
  await jobs.image("F1-v2", "F1-v2-last.png", v2, ["F1-v1-cell1.png"]);
  writeFileSync(run.path("F1-prompts.txt"), `V1 (grid)\n${v1}\n\nV2 (image 1 = F1-v1-cell1.png)\n${v2}\n`);
  console.log(`F1: ${run.path("F1-v1-grid.png")}, F1-v1-cell1/2.png, F1-v2-last.png`);
}

// F2: the control on its own. First frame as one single image from the slug; last frame as an edit of it with the end state.
async function F2() {
  const first = `${SLUG} One single frame, no text or labels.`;
  await jobs.image("F2-first", "F2-first.png", first);
  const last = `Image 1 is the first frame of a scene. Make its last frame: the same room from the same camera, the same four people in the same clothes, standing where they stand.
The scene: ${SCENE}
What has changed by the last frame: ${END}
Live-action photograph, cinema camera, shallow depth of field. One single frame, no text.`;
  await jobs.image("F2-last", "F2-last.png", last, ["F2-first.png"]);
  writeFileSync(run.path("F2-prompts.txt"), `FIRST (generator, no inputs)\n${first}\n\nLAST (editor, image 1 = F2-first.png)\n${last}\n`);
  console.log(`F2: ${run.path("F2-first.png")}, F2-last.png`);
}

// G9: the grid fills in between the V2 first and last frames (image 1, image 2); scene text, no bullets.
async function G9() {
  const prompt = `Image 1 is the first frame of a scene and image 2 its last frame: the same room, the same camera, the same four people.
One image made of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text. Every cell is a live-action photograph from the camera of image 1. Cell 1 is image 1 as it is. Cell 9 is image 2 as it is. Cells 2 to 8 are seven moments between them, in order, evenly spaced through the scene, each one step on from the cell before it; the people, their clothes, the room and the camera never change. Nothing appears that is not in image 1 or image 2 except the paper being folded.
The scene: ${SCENE}`;
  await jobs.image("G9", "G9-grid.png", prompt, ["F1-v1-cell1.png", "F1-v2-last.png"], { ...IMAGE, resolution: "4k" });
  const gc = await checkGrid(run.path("G9-grid.png"), 9);
  console.log(`G9 grid check: ${gc.rows}×${gc.cols}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
  cropCells(run.path("G9-grid.png"), 9, (i) => run.path(`G9-cell${i}.png`), gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3]);
  writeFileSync(run.path("G9-prompt.txt"), prompt);
  console.log(`G9: ${run.path("G9-grid.png")} and G9-cell*.png`);
}

// X3: three grid prompts, same scene, one 4k image each.
//   A  text direct to grid: the scene (setting, people, what happens) and "turn it into a grid of 9".
//   B  the scene prompt as cell 1, then one slug per later cell stating that frame in full (who holds what, rack count).
//   C  the first frame given as image 1 (cell 1 = image 1), then eight change instructions; all else the same.
const GRID9 = `One image made of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text. Every cell is a live-action photograph from one fixed camera; the nine cells are consecutive moments of one continuous shot, in reading order.`;
async function X3() {
  const A = `Turn this scene into a grid of 9 consecutive frames: 3 rows × 3 columns, equal cells, edge to edge, no gutters, borders, numbers or text, each cell a live-action photograph from one fixed camera, in reading order.
The scene: ${SLUG} ${SCENE}`;
  const B = `${GRID9}
Cell 1: ${SLUG}
Cell 2: The baker holds one loaf, lifted from the rack; one loaf remains on the rack; the three customers stand across the counter as before.
Cell 3: The loaf lies on a sheet of paper on the counter and the baker folds the paper around it; one loaf on the rack; the customers wait.
Cell 4: The baker holds the wrapped loaf out across the counter and the neighbour takes it with both hands; one loaf on the rack.
Cell 5: The neighbour holds her wrapped loaf against her bag; the baker holds the second loaf, lifted from the rack; the rack is empty.
Cell 6: The second loaf lies on a sheet of paper on the counter and the baker folds the paper around it; the neighbour holds her wrapped loaf; the rack is empty.
Cell 7: The baker holds the second wrapped loaf out across the counter and the parent takes it with both hands; the neighbour holds hers; the rack is empty.
Cell 8: The parent holds her wrapped loaf in both hands; the neighbour holds hers; the baker's shoulders droop and his head is lowered; the rack is empty.
Cell 9: The baker's head is up, smiling with wide eyes; the neighbour and the parent smile back at him, each holding her wrapped loaf; the child looks up at the baker; the rack is empty.`;
  const C = `Image 1 is the first frame of a scene. One image made of 9 equal cells, 3 rows × 3 columns, edge to edge, no gutters, borders, numbers or text; every cell is a live-action photograph from the camera of image 1. Cell 1 is image 1 exactly. Cells 2 to 9 are the next eight keyframes, in reading order. Everything stays exactly the same as image 1 (the room, the camera, the four people, their clothes and their places) except for these changes:
2. The baker has lifted one loaf from the rack and holds it; one loaf remains on the rack.
3. That loaf lies on a sheet of paper on the counter and the baker's hands fold the paper around it.
4. The baker holds the wrapped loaf out across the counter and the neighbour takes it.
5. The neighbour holds her wrapped loaf against her bag; the baker holds the second loaf, lifted from the rack, which is now empty.
6. The second loaf lies on a sheet of paper on the counter and the baker's hands fold the paper around it.
7. The baker holds the second wrapped loaf out across the counter and the parent takes it.
8. The parent holds her wrapped loaf in both hands; the baker's shoulders droop and his head is lowered.
9. The baker's head is up, smiling with wide eyes; the neighbour and the parent smile back at him; the child looks up at him.`;
  // C's first frame: the V2 first frame with the grid's "Cell 1" label cropped off (top 7%, sides 3.5%; still 16:9).
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path("F1-v1-cell1.png"), "-vf", "crop=iw*0.93:ih*0.93:iw*0.035:ih*0.07", run.path("X3-C-first.png")]);
  await Promise.all([
    jobs.image("X3-A", "X3-A-grid.png", A, [], { ...IMAGE, resolution: "4k" }),
    jobs.image("X3-B", "X3-B-grid.png", B, [], { ...IMAGE, resolution: "4k" }),
    jobs.image("X3-C", "X3-C-grid.png", C, ["X3-C-first.png"], { ...IMAGE, resolution: "4k" }),
  ]);
  for (const t of ["A", "B", "C"]) {
    const gc = await checkGrid(run.path(`X3-${t}-grid.png`), 9);
    console.log(`X3 ${t} grid check: ${gc.rows}×${gc.cols}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
    cropCells(run.path(`X3-${t}-grid.png`), 9, (i) => run.path(`X3-${t}-cell${i}.png`), gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3]);
  }
  writeFileSync(run.path("X3-prompts.txt"), `A (text direct to grid, no inputs)\n${A}\n\nB (scene prompt as cell 1, one slug per cell, no inputs)\n${B}\n\nC (image 1 = X3-C-first.png)\n${C}\n`);
  console.log("X3: X3-A-grid.png, X3-B-grid.png, X3-C-grid.png and cells");
}

// X4: only the scene description (the story's own lines), no slug of room or people, and "make a grid of 9".
async function X4() {
  const prompt = `Turn this scene into a grid of 9 consecutive frames: 3 rows × 3 columns, equal cells, edge to edge, no gutters, borders, numbers or text, each cell a live-action photograph from one fixed camera, in reading order.
The scene: At the counter of a small neighbourhood bakery at opening time, the baker wraps a warm loaf in paper and hands it to an older neighbour, then wraps the second loaf for a young parent whose small child watches. The baker's tired face brightens at their grateful smiles.`;
  await jobs.image("X4", "X4-grid.png", prompt, [], { ...IMAGE, resolution: "4k" });
  const gc = await checkGrid(run.path("X4-grid.png"), 9);
  console.log(`X4 grid check: ${gc.rows}×${gc.cols}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
  cropCells(run.path("X4-grid.png"), 9, (i) => run.path(`X4-cell${i}.png`), gc.rows && gc.cols ? [gc.rows, gc.cols] : [3, 3]);
  writeFileSync(run.path("X4-prompt.txt"), prompt);
  console.log("X4: X4-grid.png and cells");
}

const tests = { S1, G5, G5b, T1, F1, F2, G9, X3, X4 };
for (const t of process.argv.slice(2)) { if (!tests[t]) throw new Error(`no test ${t}`); console.log(`== ${t}`); await tests[t](); }
run.save();
