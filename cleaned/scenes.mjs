// Scene pipeline (batched by scene): prompt → story → editor → ids → specs (assets + environment layouts) → screenplay (+ sound)
// → storyboard per scene (parallel) → hard rule (code) → gate → sheets + plates → one GRID image per scene (all its panels in
// one call) → crop → check cells → state table rows. Nothing is painted until the plan is clean.
// Usage: node cleaned/scenes.mjs --prompt "…" --label bakery1 [--plan-only] [--estimate] [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "./src/env.js";
import { jsonCall, S, usage } from "./src/llm.js";
import { Jobs, CAP, IMAGE } from "./src/jobs.js";
import { writeStory } from "./src/sequencer.js";
import { reviewStory } from "./src/editor.js";
import { assignIds, classifyIds, linkIds, mergeIds } from "./src/ids.js";
import { seedPlan, makeSeed, frameStyle } from "./src/seed.js";
import { specAssets, makeAssets } from "./src/assets.js";
import { writeScreenplay, addSound, screenplayText } from "./src/screenplay.js";
import { storyboardScene, checkPanels } from "./src/storyboard.js";
import { Tracker } from "./src/tracker.js";
import { framing } from "./src/clips.js";
import { gridPrompt, cropCells, checkGrid, layout } from "./src/grid.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const prompt = opt("--prompt", null), label = opt("--label", "v1"), planOnly = args.includes("--plan-only"), estimate = args.includes("--estimate"), force = args.includes("--force");
const styleOverride = opt("--style", null), planFrom = opt("--plan-from", null);   // --plan-from: reuse another run's story, ids, specs, screenplay and storyboard; repaint only
if (!prompt) throw new Error("--prompt is required");
const name = `custom-${label}`, dir = join(RUNS, name);
for (const d of ["", "roots", "frames", "grids"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json");
const run = { name, estimate, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => { if (!estimate) writeFileSync(logFile, JSON.stringify(run.log, null, 2)); };
if (planFrom && !run.log.board) { const src = JSON.parse(readFileSync(join(RUNS, planFrom, "run.json"), "utf8")); for (const k of ["story", "edit", "ids", "seed_plan", "asset_specs", "screenplay", "board", "violations"]) run.log[k] = src[k]; run.log.plan_from = planFrom; }
if (styleOverride && run.log.story) { run.log.story.style = styleOverride; run.log.style_medium = null; }
Object.assign(run.log, { name, prompt, models: { image: IMAGE }, cap: CAP, started_at: new Date().toISOString(), errors: [] });
const jobs = new Jobs(run, { estimate }), tracker = new Tracker(run), t0 = Date.now();
const L = run.log, say = (m) => console.log(m);

try {
  // 1. Story and editor.
  say(`${name}: story…`); L.story ??= await writeStory(prompt); run.save();
  if (!L.edit) { say("editor…"); const rv = await reviewStory(L.story.story); L.edit = { original: L.story.story, review: rv.holes, story: rv.story }; run.save(); }
  const text = L.edit.story;
  // 2. Ids.
  if (!L.ids) { say("ids…"); const tg = await assignIds(text), cl = await classifyIds(text, tg.table), mg = await mergeIds(text, cl); L.ids = { table: mg.table, merged: mg.map, chunks: tg.chunks, links: await linkIds(text, mg.table) }; run.save(); }
  const T = L.ids.table, by = Object.fromEntries(T.map((t) => [t.id, t]));
  const assets = T.filter((t) => t.role === "asset" && t.kind !== "none").map((t) => {
    let c = t.kind !== "character" && t.inside && t.inside !== "none" ? by[t.inside] : null, inside = "";
    if (c?.role === "part" && by[c.parent]?.role === "asset") c = by[c.parent];
    if (c?.role === "asset") inside = c.id;
    return { id: t.id, name: t.name, kind: t.kind, look: "", inside };
  });
  const world = { title: L.story.title, style: L.story.style, story: text, entities: assets, locations: T.filter((t) => t.role === "place").map((t) => ({ id: t.id, name: t.name, look: "" })) };
  const fixtures = T.filter((t) => t.role === "fixture" && t.place !== "none"), links = L.ids.links.filter((l) => l.belongs);
  say(`  ${T.length} ids: ${assets.length} assets, ${fixtures.length} fixtures, ${world.locations.length} places, ${links.length} links`);
  // 3. Specs: environments (layouts) and assets.
  say("specs…"); L.seed_plan ??= await seedPlan(world, text, { fixtures, links }); L.asset_specs ??= await specAssets(world); run.save();
  L.style_medium ||= (await jsonCall({ name: "style-medium", effort: "low", schema: S.obj({ medium: S.str }), prompt: `Reduce this visual style line to the MEDIUM only (photographic or illustrated; camera or materials, line work, level of finish), one sentence, no lighting, no colours of specific things, no scene words:\n${world.style}` })).medium; run.save();
  // 4. Screenplay with sound.
  if (!L.screenplay) { say("screenplay…"); const sp = await writeScreenplay(text, assets.filter((a) => a.kind === "character").map((a) => a.name)); L.screenplay = await addSound(sp); writeFileSync(join(dir, "screenplay.txt"), `${sp.title.toUpperCase()}\n\n${screenplayText(sp)}`); run.save(); }
  const sp = L.screenplay, envs = L.seed_plan.places;
  // 5. Storyboard per scene, in parallel; scenes that break the hard rule are redone once.
  if (!L.board) {
    say(`storyboard (${sp.scenes.length} scenes in parallel)…`);
    const ctx = { assets: assets.map((a) => ({ id: a.id, name: a.name })), envs };
    let board = await Promise.all(sp.scenes.map((sc, i) => storyboardScene(sc, i + 1, ctx)));
    let bad = checkPanels(board);
    if (bad.length) board = await Promise.all(board.map(async (b, i) => { const mine = bad.filter((x) => x.startsWith(`scene ${i + 1} `)); return mine.length ? storyboardScene({ ...sp.scenes[i], beats: [...sp.scenes[i].beats, { kind: "action", who: "", text: `(Storyboard note: fix these: ${mine.join("; ")}.)` }] }, i + 1, ctx) : b; }));
    L.board = board; L.violations = checkPanels(board); run.save();
  }
  const board = L.board, ent = Object.fromEntries(assets.map((a) => [a.id, { ...a, ...(L.asset_specs.find((s) => s.id === a.id) || {}) }]));
  const nm = (id) => ent[id]?.name || id;
  // A grid is one run of consecutive panels in one environment (a screenplay scene that cuts between places gives several).
  const scenes = [];
  board.forEach((b, i) => {
    const heading = `${sp.scenes[i].inside ? "INT." : "EXT."} ${sp.scenes[i].place} — ${sp.scenes[i].time}`;
    let cur = null;
    b.panels.forEach((p) => {
      const env = p.environment || b.environment;
      if (!cur || cur.env !== env) { cur = { k: scenes.length + 1, scene: i + 1, env, heading, panels: [] }; scenes.push(cur); }
      cur.panels.push({ n: cur.panels.length + 1, action: p.action, elements: [...new Set(p.elements)].filter((id) => ent[id]), enters: (p.enters || []).filter((e) => ent[e.id]), changes: p.changes || [], leaves: (p.leaves || []).filter((id) => ent[id]), beats: p.beats });
    });
  });
  say(`  ${scenes.reduce((n, s) => n + s.panels.length, 0)} panels in ${scenes.length} scenes (${scenes.map((s) => s.panels.length).join(", ")}) · hard rule: ${L.violations.length ? L.violations.join("; ") : "every element has a source"}`);
  for (const s of scenes) { say(`  grid ${s.k} (scene ${s.scene}) [${s.env}] ${s.heading}`); for (const p of s.panels) say(`    ${p.n}. ${p.action}`); }
  // Seed sheets only where the text cannot give a consistent reference: characters (later also user-specified or linked assets).
  // Props are drawn into their first frame from their spec; a failed first appearance can earn a sheet later.
  const usedEnvs = envs.filter((e) => scenes.some((s) => s.env === e.id)), sheetIds = assets.filter((a) => !a.inside && a.kind === "character" && scenes.some((s) => s.panels.some((p) => p.elements.includes(a.id)))).map((a) => a.id);
  say(`  to paint: ${sheetIds.length} sheets (${sheetIds.map(nm).join(", ")}), ${usedEnvs.length} plates (${usedEnvs.map((e) => e.id).join(", ")}), ${scenes.length} scene grids`);
  say(`  estimate on first tries: sheets ${sheetIds.length * 200} + plates ${usedEnvs.length * 200} + grids ${scenes.length * 400} ≈ ${sheetIds.length * 200 + usedEnvs.length * 200 + scenes.length * 400} credits`);
  if (L.violations.length && !force) throw Object.assign(new Error(`plan not clean: ${L.violations.join("; ")}`), { stop: true });
  if (planOnly) throw Object.assign(new Error("plan only: no images"), { stop: true });

  // 6. Sheets and plates.
  say("sheets…"); L.assets = await makeAssets(world, L.asset_specs.filter((a) => sheetIds.includes(a.id)), jobs, tracker, { estimate, keep: L.assets && !estimate ? Object.fromEntries(Object.entries(L.assets).filter(([id]) => sheetIds.includes(id))) : {} }); run.save();
  // Plate checks: only the fixtures the story names (ids from the id pass) and doors are key; sub-parts (a handle, a sign's
  // status, a counter top) are painted but never fail a plate.
  const usedMarks = Object.fromEntries(usedEnvs.map((e) => [e.id, new Set(fixtures.filter((f) => f.place === e.id).map((f) => f.id))]));
  say("plates…"); L.seed = await makeSeed({ style: world.style, locations: usedEnvs.map((e) => ({ id: e.id, name: e.id, look: e.look })), seed: L.seed_plan, initial: {}, specs: L.asset_specs, used: usedMarks }, jobs, tracker, { estimate }); run.save();
  for (const [id, p] of Object.entries(L.seed)) tracker.addPlate(id, p.plate, []);

  // 7. One grid per scene, in order.
  let slideN = 0;
  for (const s of scenes) {
    const { frame: base } = tracker.baseFor({ location: s.env, n: 100000 });
    const inScene = [...new Set(s.panels.flatMap((p) => p.elements))], entering = inScene.filter((id) => !base.present.includes(id) && !(ent[id].inside && inScene.includes(ent[id].inside)));
    const refs = [];
    for (const id of entering) { const seen = tracker.lastSeen(id, 100000); if (seen) refs.push({ id, kind: ent[id].kind, file: seen.file, from: seen.id }); else if (tracker.roots[id]) refs.push({ id, kind: ent[id].kind, file: tracker.roots[id], from: "sheet" }); else refs.push({ id, kind: ent[id].kind, spec: ent[id].spec, from: "text" }); }
    const gp = gridPrompt({ scene: s, panels: s.panels, env: s.heading, style: L.style_medium, refs: refs.filter((r) => r.file).slice(0, 9), textRefs: refs.filter((r) => !r.file), name: nm });
    const gridFile = `grids/scene-${s.k}.png`;
    say(`scene ${s.k}: grid of ${s.panels.length} (${layout(s.panels.length).join("×")}) from ${base.id} · refs: ${refs.map((r) => `${nm(r.id)}←${r.from === "sheet" ? "sheet" : r.from}`).join(", ") || "none"}`);
    await jobs.image(`grid-s${s.k}`, gridFile, gp, [base.file, ...new Set(refs.filter((r) => r.file).slice(0, 9).map((r) => r.file))], { ...IMAGE, resolution: "4k" });
    if (estimate) { slideN += s.panels.length; continue; }
    const gc = await checkGrid(run.path(gridFile), s.panels.length), [rows, cols] = layout(s.panels.length);
    say(`  grid check: ${gc.rows}×${gc.cols}${gc.equal_cells ? "" : ", unequal cells"}${gc.gutters_or_text ? ", gutters or text" : ""} · ${gc.note}`);
    const cells = cropCells(run.path(gridFile), s.panels.length, (i) => run.path(`frames/s${s.k}-p${i}.png`), gc.rows && gc.cols ? [gc.rows, gc.cols] : null);
    // Cell checks run in parallel (they were a serial minute per grid).
    const checks = await Promise.all(s.panels.map((p) => { const ids = p.elements.filter((id) => !(ent[id].inside && p.elements.includes(ent[id].inside))); return jsonCall({ name: "panel-check", effort: "low", images: [run.path(`frames/s${s.k}-p${p.n}.png`)], schema: S.obj({ counts: S.obj(Object.fromEntries(ids.map((id) => [id, S.int]))), impossible: S.bool, problems: S.str }),
      prompt: `One frame of a story. counts: how many times each appears (0 if not visible):\n${ids.map((id) => `- ${id}: ${nm(id)}`).join("\n")}\nimpossible: true only if something is physically impossible. problems: short, or "".` }).then((r) => ({ ids, r })); }));
    for (const [j, p] of s.panels.entries()) {
      slideN++;
      const file = `frames/s${s.k}-p${p.n}.png`, { ids, r } = checks[j];
      const faults = ids.flatMap((id) => (r.counts[id] === 0 ? [`${nm(id)}: missing`] : r.counts[id] > 1 && ent[id].kind === "character" ? [`${nm(id)}: duplicated`] : [])).concat(r.impossible ? [`impossible: ${r.problems}`] : []);
      say(`    cell ${p.n}: ${faults.length ? faults.join(", ") : "ok"} · ${p.action.slice(0, 80)}`);
      tracker.add({ slide: slideN, scene: s.k, panel: p.n, file, location: s.env, present: [...p.elements], observed: ids.filter((id) => r.counts[id] > 0), base: base.id, refs: refs.map((x) => ({ id: x.id, file: x.file, from: x.from })), op: "edit", hops: (base.hops || 0) + 1, accepted: true, forced: faults.length > 0, grid: gridFile, attempts: [{ a: 1, file, base: base.id, base_file: base.file, add: entering, remove: [], keep: [], change: "", refs: refs.map((x) => ({ id: x.id, file: x.file, from: x.from })), prompt: gp, obs: r, faults: faults.map((f) => ({ id: null, kind: f })), present: p.elements, hops: 1 }] });
    }
  }
} catch (e) { if (!e.stop) L.errors.push(String(e.stack || e)); console.error(`stopped: ${e.message}`); }
L.summary = { scenes: L.board?.length, panels: tracker.frames.filter((f) => f.op === "edit").length, credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) };
run.save(); tracker.save();
if (estimate) console.log(`estimate: ${jobs.estimated.length} paid jobs ≈ ${jobs.estimated.reduce((n, j) => n + j.cost, 0)} credits (grids at 4k may cost more than 200 each)`);
else console.log(`done: ${JSON.stringify(L.summary)}`);
