// Seeds and grids only, the minimal way: reuse a run's story, cast, specs, layout and storyboard; regenerate the seed assets
// (one sheet per character, one plate per place) with the medium as the noun of the prompt, then one grid per scene whose prompt
// is: the images named, cell 1 in full, every later cell only its change. The state manager (code) picks the images: the plate,
// the latest frame of the place, a sheet for anyone not in that frame, the last frame showing a prop the state frame lacks.
// Usage: CLEANED_CAP=… node cleaned/regrid.mjs --from custom-bakery-real --label bakery-v2
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RUNS } from "./src/env.js";
import { jsonCall, S, usage } from "./src/llm.js";
import { Jobs, IMAGE } from "./src/jobs.js";
import { cropCells, checkCellsRoom, layout } from "./src/grid.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "custom-bakery-real"), label = opt("--label", "bakery-v2"), name = `custom-${label}`, dir = join(RUNS, name);
for (const d of ["", "roots", "frames", "grids"]) mkdirSync(join(dir, d), { recursive: true });
const src = JSON.parse(readFileSync(join(RUNS, from, "run.json"), "utf8")), logFile = join(dir, "run.json");
const run = { name, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
Object.assign(run.log, { name, from, started_at: new Date().toISOString() });
const jobs = new Jobs(run), L = run.log, say = (m) => console.log(m), t0 = Date.now();

// Cast, props and places from the source run (its id table and specs).
const T = src.ids.table, by = Object.fromEntries(T.map((t) => [t.id, t]));
const ent = Object.fromEntries(src.asset_specs.map((a) => ({ ...a, inside: (() => { const t = by[a.id]; const c = t && t.kind !== "character" && t.inside && t.inside !== "none" ? by[t.inside] : null; return c?.role === "asset" ? c.id : ""; })() })).map((a) => [a.id, a]));
const nm = (id) => ent[id]?.name || by[id]?.name || id, isChar = (id) => ent[id]?.kind === "character";
const sp = src.screenplay, board = src.board, envs = src.seed_plan.places;

// 1. The medium, once, as noun phrases every prompt can start with.
if (!L.medium?.cell) L.medium = await jsonCall({ name: "medium", effort: "low", schema: S.obj({ person: S.str, object: S.str, place: S.str, cell: S.str, frame: S.str }),
  prompt: `From this visual style line, write the MEDIUM as noun phrases a prompt can start with, nothing about scenes, colours or light:
person: a full-length picture of one person in this medium ("A studio photograph of a real person", "A watercolour character design");
object: the same for one object; place: the same for an empty place, ending in "of" ("A photograph of", "A watercolour painting of");
cell: what one still frame of the story IS, as a noun phrase, never "footage" or "film" ("a live-action photograph", "a watercolour painting");
frame: one closing sentence for a story frame naming the medium and camera or materials ("Live-action photograph, cinema camera, shallow depth of field.").
Style: ${src.story.style}` });
say(`medium: ${JSON.stringify(L.medium)}`);

// 2. Scenes: runs of consecutive panels in one environment (as scenes.mjs splits them).
const scenes = [];
board.forEach((b, i) => {
  const heading = `${sp.scenes[i].inside ? "INT." : "EXT."} ${sp.scenes[i].place} — ${sp.scenes[i].time}`;
  let cur = null;
  b.panels.forEach((p) => {
    const env = p.environment || b.environment;
    if (!cur || cur.env !== env) { cur = { k: scenes.length + 1, env, heading, panels: [] }; scenes.push(cur); }
    cur.panels.push({ n: cur.panels.length + 1, action: p.action, elements: [...new Set(p.elements)].filter((id) => ent[id]), enters: (p.enters || []).filter((e) => ent[e.id]), leaves: (p.leaves || []).filter((id) => ent[id]) });
  });
});
const chars = [...new Set(scenes.flatMap((s) => s.panels.flatMap((p) => p.elements)))].filter(isChar), places = envs.filter((e) => scenes.some((s) => s.env === e.id));
say(`${scenes.length} grids, ${chars.length} sheets (${chars.map(nm).join(", ")}), ${places.length} plates (${places.map((p) => p.id).join(", ")})`);

// 3. Sheets: medium as the noun; one check that asks about the medium; one retry worded as what to show, not what went wrong.
const sheetPrompt = (a, fix = "") => `${L.medium.person}, full length. The ${a.kind === "character" ? "person" : "subject"}: ${a.spec} ${a.height || ""}
Standing, front view, neutral pose, arms relaxed, whole figure visible head to feet.
Plain light-grey seamless studio backdrop, soft even light, nothing else in the picture; no text.${fix ? `\n${fix}` : ""}`;
const checkSheet = (file, a) => jsonCall({ name: "sheet-check", effort: "medium", images: [file], schema: S.obj({ medium_ok: S.bool, single_subject: S.bool, major: S.bool, fix: S.str }),
  prompt: `This should be: ${L.medium.person}, full length, of ${a.name}: ${a.spec}
medium_ok: it is exactly that medium (for a photograph: a real person, not a render, figurine, illustration or doll).
single_subject: one subject shown once, nothing else (a studio floor shadow is fine).
major: a difference that changes who this is: build, main colours, a signature item, a later story state. Small differences are not major.
fix: if anything is off, ONE sentence saying what the picture must show instead (positive wording, no mention of this picture); else "".` });
L.sheets ??= {};
await Promise.all(chars.map(async (id) => {
  if (L.sheets[id]?.ok) return;
  const a = ent[id]; let fix = "", best = null;
  for (let t = 1; t <= 2; t++) {
    const file = t === 1 ? `roots/${id}.png` : `roots/${id}-t${t}.png`;
    await jobs.image(t === 1 ? `root-${id}` : `root-${id}-t${t}`, file, sheetPrompt(a, fix));
    const c = await checkSheet(run.path(file), a), ok = c.medium_ok && c.single_subject && !c.major;
    say(`  sheet ${id} try ${t}: ${ok ? "ok" : `${!c.medium_ok ? "wrong medium; " : ""}${!c.single_subject ? "not single; " : ""}${c.major ? "major; " : ""}${c.fix}`}`);
    if (!best || ok) best = { file, ok, chk: c, t };
    if (ok) break; fix = c.fix;
  }
  L.sheets[id] = best; run.save();
}));

// 4. Plates: medium as the noun; key marks only (no sub-parts, no open areas); doors; one check on the key marks.
// Top-level marks only (no sub-parts like a handle or a surface, no open areas): what the plate must show and what is checked.
const keyMarks = (p) => p.marks.filter((m) => !m.area && !m.id.includes("."));
const placeName = Object.fromEntries(envs.map((e) => { const i = board.findIndex((b) => (b.environment === e.id) || b.panels.some((p) => p.environment === e.id)); return [e.id, i >= 0 ? sp.scenes[i].place : e.id.replace(/-/g, " ")]; }));
const platePrompt = (p, fix = "") => `${L.medium.place} ${placeName[p.id]}, empty of people and animals, one single image. ${p.look}
Camera: ${p.camera}
${keyMarks(p).map((m) => `- ${m.name}: ${m.essential || m.where}`).join("\n")}
${p.doors.map((d) => `- ${p.marks.find((m) => m.id === d.mark)?.name || d.mark}: ${d.swing}`).join("\n")}
Light: ${p.light} No text or labels; one single image.${fix ? `\n${fix}` : ""}`;
const checkPlate = (file, p) => jsonCall({ name: "plate-check", effort: "medium", images: [file], schema: S.obj({ marks: S.obj(Object.fromEntries(keyMarks(p).map((m) => [m.id, S.bool]))), medium_ok: S.bool, impossible: S.bool, fix: S.str }),
  prompt: `An empty place, meant to be: ${L.medium.place} … Camera: ${p.camera}
For each mark, true if it is clearly in the picture where stated:\n${keyMarks(p).map((m) => `- ${m.id}: ${m.name} — ${m.essential || m.where}`).join("\n")}
medium_ok: it is exactly that medium. impossible: something physically impossible (a door that cannot open, floating or overlapping furniture).
fix: if anything is off, ONE sentence saying what the picture must show instead (positive wording); else "".` });
L.plates ??= {};
await Promise.all(places.map(async (p) => {
  if (L.plates[p.id]?.ok) return;
  let fix = "", best = null;
  for (let t = 1; t <= 2; t++) {
    const file = t === 1 ? `roots/${p.id}.png` : `roots/${p.id}-t${t}.png`;
    await jobs.image(t === 1 ? `root-${p.id}` : `root-${p.id}-t${t}`, file, platePrompt(p, fix));
    const c = await checkPlate(run.path(file), p), missing = Object.entries(c.marks).filter(([, v]) => !v).map(([k]) => k), ok = c.medium_ok && !c.impossible && !missing.length;
    say(`  plate ${p.id} try ${t}: ${ok ? "ok" : `${missing.length ? `missing ${missing.join(", ")}; ` : ""}${!c.medium_ok ? "wrong medium; " : ""}${c.impossible ? "impossible; " : ""}${c.fix}`}`);
    if (!best || ok || missing.length < (best.missing?.length ?? 99)) best = { file, ok, chk: c, missing, t };
    if (ok) break; fix = c.fix;
  }
  L.plates[p.id] = best; run.save();
}));

// 5. Grids. State manager: rows of (file, place, present) per cell; the latest row of a place is its state.
const frames = L.frames ??= [];
const latestAt = (env) => frames.filter((f) => f.location === env).at(-1) || null, lastSeen = (id) => frames.filter((f) => f.present.includes(id)).at(-1) || null;
const gridCheck = (file, n) => jsonCall({ name: "grid-layout", effort: "low", images: [file], schema: S.obj({ rows: S.int, cols: S.int, empty_cells: S.arr(S.int), medium_ok: S.bool, note: S.str }),
  prompt: `This image is a grid of story frames. rows, cols: how many rows and columns of panels it has. empty_cells: the panel numbers (reading order, from 1) that show the empty place with nobody in them. medium_ok: every panel is ${L.medium.cell} (for a photograph: real people and things, not a drawing, painting or render). note: short.` });
function gridPrompt(s, imgs, state) {
  const n = s.panels.length, [rows, cols] = layout(n), N = rows * cols;
  const named = imgs.map((im, i) => `Image ${i + 1} ${im.text}`).join(" ");
  const p1 = s.panels[0], placed = p1.elements.filter((id) => !(ent[id].inside && p1.elements.includes(ent[id].inside)));
  const full = placed.map((id) => { const e = p1.enters.find((x) => x.id === id); return e ? `${nm(id)} ${e.where}${e.doing ? `, ${e.doing}` : ""}` : state && state.present.includes(id) ? `${nm(id)} as in image 2` : nm(id); });
  const later = s.panels.slice(1).map((p) => `${p.n}. ${p.action}${p.enters.length ? ` ${p.enters.map((e) => `${nm(e.id)} enters ${e.where}${e.doing ? `, ${e.doing}` : ""}.`).join(" ")}` : ""}${p.leaves.length ? ` ${p.leaves.map((id) => `${nm(id)} is no longer in the picture.`).join(" ")}` : ""}`);
  return `One image made of ${N} equal cells, ${rows} rows × ${cols} columns, edge to edge, no gutters, borders, numbers or text. Every cell is ${L.medium.cell}. Cells 1 to ${n} are ${n} consecutive moments of one continuous shot, in reading order${N > n ? `; cells ${n + 1} to ${N} are the empty place of image 1` : ""}.
${named}
Cell 1, in full: ${p1.action} ${full.join("; ")}. Nothing else is added: no extra people, animals, food or objects beyond those named; everything else is exactly as in image 1${state ? " and image 2" : ""}.
Each later cell is the cell before it with ONLY the change named; everyone and everything else stays exactly where it was.
${later.join("\n")}
${L.medium.frame}`;
}
for (const s of scenes) {
  if (L.grids?.[s.k]?.done) continue;
  const plate = L.plates[s.env], state = latestAt(s.env), inScene = [...new Set(s.panels.flatMap((p) => p.elements))];
  const imgs = [{ file: plate.file, text: `is ${placeName[s.env]} (${s.heading}); every cell is this room from exactly this camera.` }];
  if (state) imgs.push({ file: state.file, text: `is this room as it was last seen; cell 1 starts from it (what is open, what lies where).` });
  const needSheet = inScene.filter((id) => isChar(id) && !(state && state.present.includes(id)));
  for (const id of needSheet) imgs.push({ file: L.sheets[id].file, text: `is ${nm(id)}: same face, hair and clothes in every cell; the pose and grey background of that image do not apply.` });
  const props = inScene.filter((id) => !isChar(id) && !(state && state.present.includes(id)) && !(ent[id].inside && inScene.includes(ent[id].inside)));
  const byFrame = new Map();
  // A prop's reference frame only counts in the same environment (grid 2 of bakery-v2 got the street shot as the dough's reference).
  const seenHere = (id) => { const f = lastSeen(id); return f && f.location === s.env ? f : null; };
  for (const id of props) { const f = seenHere(id); if (f) byFrame.set(f.file, [...(byFrame.get(f.file) || []), id]); }
  for (const [file, ids] of byFrame) imgs.push({ file, text: `shows ${ids.map(nm).join(" and ")} as ${ids.length > 1 ? "they are" : "it is"} now.` });
  const fresh = props.filter((id) => !seenHere(id));
  let gp = gridPrompt(s, imgs, state);
  if (fresh.length) gp = gp.replace("\nEach later cell", `\nNew things, described once: ${fresh.map((id) => `${nm(id)}: ${ent[id].spec.split(/(?<=\.)\s/)[0]}`).join(" ")}\nEach later cell`);
  say(`grid ${s.k} (${s.heading}): ${s.panels.length} cells · images: plate${state ? ", state" : ""}${needSheet.length ? `, sheets ${needSheet.map(nm).join("/")}` : ""}${byFrame.size ? `, ${byFrame.size} prop frame(s)` : ""}${fresh.length ? ` · text: ${fresh.map(nm).join(", ")}` : ""}`);
  const inputs = imgs.map((im) => im.file);
  let file, gc, cells, room;
  for (let attempt = 1; attempt <= 2; attempt++) {
    file = `grids/scene-${s.k}${attempt === 2 ? "-a2" : ""}.png`;
    try { await jobs.image(`grid-s${s.k}${attempt === 2 ? "-a2" : ""}`, file, gp, inputs, { ...IMAGE, resolution: "4k" }); }
    catch (e) { if (!/timed out/.test(e.message)) throw e; say("  4k timed out; 2k"); await jobs.image(`grid-s${s.k}${attempt === 2 ? "-a2" : ""}-2k`, file, gp, inputs, { ...IMAGE, resolution: "2k" }); }
    gc = await gridCheck(run.path(file), s.panels.length);
    const drawn = gc.rows && gc.cols && gc.rows * gc.cols >= s.panels.length ? [gc.rows, gc.cols] : layout(s.panels.length), total = drawn[0] * drawn[1];
    const all = cropCells(run.path(file), total, (i) => run.path(`grids/s${s.k}-cell${i}.png`), drawn);
    const empty = new Set(gc.empty_cells), order = [...Array(total).keys()].filter((i) => !empty.has(i + 1)).slice(0, s.panels.length);
    const use = order.length === s.panels.length ? order : [...Array(s.panels.length).keys()];
    cells = use.map((ci, i) => { const f = run.path(`frames/s${s.k}-p${i + 1}.png`); execFileSync("cp", [all[ci], f]); return f; });
    say(`  layout ${gc.rows}×${gc.cols}, empty ${gc.empty_cells.join(",") || "none"} · ${gc.note}`);
    room = await checkCellsRoom(cells, run.path(plate.file));
    const off = room.filter((c) => !c.same_room || !c.same_camera);
    say(`  room: ${off.length ? off.map((c) => `cell ${c.cell} ${!c.same_room ? "other room" : "other camera"}`).join("; ") : "every cell the same room and camera"}${gc.medium_ok === false ? " · WRONG MEDIUM" : ""}`);
    if ((!off.length && gc.medium_ok !== false) || attempt === 2) break;
    if (gc.medium_ok === false) gp = gp.replace(`Every cell is ${L.medium.cell}.`, `Every cell is ${L.medium.cell}: real, photographic, not a drawing, painting or render.`);
    if (off.length) gp += `\nEvery cell shows the room of image 1 from the camera of image 1: the same walls, furniture and framing; no close-ups, no other angles.`;
  }
  s.panels.forEach((p, i) => frames.push({ id: `s${s.k}-p${p.n}`, file: `frames/s${s.k}-p${p.n}.png`, location: s.env, present: [...p.elements], scene: s.k, panel: p.n }));
  (L.grids ??= {})[s.k] = { file, prompt: gp, inputs, layout: [gc.rows, gc.cols], empty: gc.empty_cells, room, heading: s.heading, panels: s.panels.map((p) => p.action), done: true }; run.save();
}
L.summary = { credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save();
say(`done: ${JSON.stringify(L.summary)}`);
