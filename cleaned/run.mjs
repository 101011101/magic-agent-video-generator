// Pipeline: prompt → world + story (S1) → seed: ground plans and verified plates (S0) → blocking (S1) → roots (S2) →
// per slide: base (S3) → edit (S4) → verify (S5) → slideshow (S6). Stage 2 (--video): one clip per slide → final.mp4.
// Runs saved with the older step script (or the first one-call plan) re-run from their saved plan.
// Usage: node cleaned/run.mjs --case goldilocks [--label v1] [--slides N] [--video] [--clips 2,8] [--estimate]
//   --prompt "…"  use a prompt instead of a case;  --slides N  build only the first N slides;  --estimate  spend nothing
//   --first-frames  build only the first slide of each place (checks the seed: plates and the first state of every place)
//   --video  also make the clips;  --clips 2,8  only these slides' clips (probe; no stitch until every clip exists)
//   --world <run>  reuse that run's world and root images (saved-plan runs only)
//   --entities-from <run>  reuse only that run's characters and props and their sheets; places, seed and story are new
//   --plan-from <run>  reuse that run's world, story and ground plans (not its images); sheets come from the asset bank (A0)
//   --redo-assets a,b  regenerate only these sheets (re-specced); the others are re-checked from their images, no credits
//   --assets-only  stop after the asset bank (sheets checked one by one and as a set): writes assets.html for review
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RUNS } from "./src/env.js";
import { usage, MODEL } from "./src/llm.js";
import { Jobs, CAP, IMAGE } from "./src/jobs.js";
import { writeWorld, block, check } from "./src/sequencer.js";
import { seedPlan, makeSeed } from "./src/seed.js";
import { makeRoots } from "./src/roots.js";
import { specAssets, makeAssets } from "./src/assets.js";
import { renderAssets } from "./src/page.js";
import { Tracker } from "./src/tracker.js";
import { buildSlide } from "./src/builder.js";
import { renderPage } from "./src/page.js";
import { film } from "./src/film.js";
import { renderFilm } from "./src/film-page.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const estimate = args.includes("--estimate"), only = Number(opt("--slides", 0)), VIDEO_ON = args.includes("--video");
const firstFrames = args.includes("--first-frames"), assetsOnly = args.includes("--assets-only"), planFrom = opt("--plan-from", null);
const clipsOnly = opt("--clips", null)?.split(",").map(Number) || null;
const caseId = opt("--case", "custom"), label = opt("--label", "v1");
const prompt = opt("--prompt", null) ?? JSON.parse(readFileSync(join(ROOT, "cases/cases.json"), "utf8")).find((c) => c.id === caseId)?.prompt;
if (!prompt) throw new Error(`no case ${caseId} in cleaned/cases/cases.json and no --prompt`);

const name = `${caseId}-${label}`, dir = join(RUNS, name);
for (const d of ["", "roots", "frames"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json");
const run = { name, estimate, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => { if (!estimate) writeFileSync(logFile, JSON.stringify(run.log, null, 2)); };
Object.assign(run.log, { name, prompt, models: { llm: MODEL, image: IMAGE }, cap: CAP, started_at: new Date().toISOString(), errors: [] });
const jobs = new Jobs(run, { estimate }), tracker = new Tracker(run);
const t0 = Date.now();

// --world: the other run's world and roots; --entities-from: its characters and props only. Root jobs are copied with their
// signatures, so makeRoots finds them cached and pays nothing.
const worldRun = opt("--world", null), entRun = opt("--entities-from", null);
let given = null;
for (const from of [worldRun, entRun].filter(Boolean)) {
  const src = join(RUNS, from), wl = JSON.parse(readFileSync(join(src, "run.json"), "utf8")), ents = new Set(wl.plan.entities.map((e) => e.id));
  given = from === worldRun ? { title: wl.plan.title, style: wl.plan.style, entities: wl.plan.entities, locations: wl.plan.locations }
    : { style: wl.plan.style, entities: wl.plan.entities };
  for (const [k, j] of Object.entries(wl.jobs)) if (k.startsWith("root-") && (from === worldRun || ents.has(k.slice(5))) && !run.log.jobs?.[k]) {
    copyFileSync(join(src, j.file), join(dir, j.file));
    (run.log.jobs ??= {})[k] = { ...j, from, credits: 0 };
  }
  run.log[from === worldRun ? "world_from" : "entities_from"] = from;
}

if (planFrom && !run.log.world) {
  const pl = JSON.parse(readFileSync(join(RUNS, planFrom, "run.json"), "utf8"));
  Object.assign(run.log, { world: pl.world, seed_plan: pl.seed_plan, plan_from: planFrom });
}
let plan = run.log.plan ? check(run.log.plan) : null;
const page = () => { if (!estimate && plan) writeFileSync(join(dir, "index.html"), renderPage({ name, prompt, plan, tracker, log: run.log, credits: jobs.spent() })); };
try {
  if (!plan && worldRun) throw new Error("--world reuses an older run's world for its saved plan; new runs use --entities-from");
  if (!plan) {
    // Story → seed (ground plans, verified plates; the picture wins) → blocking against the canonical marks.
    console.log(`${name}: story…`);
    const world = run.log.world ??= await writeWorld(prompt, given); run.save();
    console.log("seed plan…");
    const sp = run.log.seed_plan ??= await seedPlan(world, world.story); run.save();
    if (entRun) await makeRoots(world, jobs, tracker, { places: false });   // reused sheets (copied jobs, cached)
    else {
      // A0 asset bank: spec every tracked thing against the others, then a checked sheet each.
      console.log("asset bank…");
      // --redo-assets a,b: re-spec and regenerate only these; every other sheet is re-checked from its existing tries.
      const redo = opt("--redo-assets", null)?.split(",").filter(Boolean);
      if (redo?.length && run.log.asset_specs) {
        const fresh = await specAssets({ ...world, entities: world.entities.filter((e) => redo.includes(e.id)) });
        run.log.asset_specs = run.log.asset_specs.map((a) => fresh.find((f) => f.id === a.id) || a);
      }
      const specs = run.log.asset_specs ??= await specAssets(world); run.save();
      const keep = redo ? Object.fromEntries(Object.entries(run.log.assets || {}).filter(([id]) => !redo.includes(id))) : {};
      run.log.assets = await makeAssets(world, specs, jobs, tracker, { estimate, keep }); run.save();
      if (!estimate) writeFileSync(join(dir, "assets.html"), renderAssets({ name, world, assets: run.log.assets, credits: jobs.spent() }));
      if (assetsOnly) throw Object.assign(new Error("assets only: stopped after the asset bank"), { stop: true });
    }
    console.log("seed plates…");
    const seed = await makeSeed({ style: world.style, locations: world.locations, seed: sp }, jobs, tracker, { estimate });
    run.log.seed = seed; run.save();
    console.log("blocking…");
    plan = await block(world, seed);
    plan.seed = seed;
  } else {
    console.log(`${name}: plan from run.json; roots…`);
    await makeRoots(plan, jobs, tracker, { places: !plan.seed });
    if (plan.seed) for (const [id, p] of Object.entries(plan.seed)) tracker.addPlate(id, p.plate);
  }
  if (plan.lint?.length) console.log(`  rules still broken after one rewrite:\n  - ${plan.lint.join("\n  - ")}`);
  run.log.plan = plan; run.save();
  console.log(`  ${plan.title}: ${plan.entities.length} entities, ${plan.locations.length} locations, ${plan.slides.length} slides`);
  for (const s of plan.slides) console.log(`  ${s.n}. [${s.location}]${s.kind ? ` ${s.kind}` : ""} {${s.present.join(", ")}}${s.continues ? " (continues)" : ""}${s.change ? ` Δ ${s.change}` : ""}${s.ste ? `\n      ${s.ste.join(" ")}` : ""}`);

  const firsts = new Set(plan.locations.map((l) => plan.slides.find((s) => s.location === l.id)?.n).filter(Boolean));
  const todo = firstFrames ? plan.slides.filter((s) => firsts.has(s.n)) : only ? plan.slides.slice(0, only) : plan.slides;
  for (const s of todo) {
    console.log(`slide ${s.n}: ${s.caption}`);
    await buildSlide(s, { plan, tracker, jobs, run });
    page();
  }
  if (VIDEO_ON) {
    console.log("film…");
    const f = await film({ plan, tracker, jobs, run, only: clipsOnly });
    page(); writeFileSync(join(dir, "film.html"), renderFilm({ name, plan, film: f, credits: jobs.spent() }));
  }
} catch (e) { if (!e.stop) run.log.errors.push(String(e.stack || e)); console.error(`stopped: ${e.message}`); }

const frames = tracker.frames.filter((f) => f.op === "edit");
run.log.summary = { slides: frames.length, passed: frames.filter((f) => !f.forced).length, first_try: frames.filter((f) => !f.forced && f.attempts.length === 1).length,
  forced: frames.filter((f) => f.forced).map((f) => f.slide), attempts: frames.reduce((n, f) => n + f.attempts.length, 0), max_hops: Math.max(0, ...frames.map((f) => f.hops)),
  credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) };
run.save(); page();
if (estimate) console.log(`estimate: ${jobs.estimated.length} paid jobs, ${jobs.estimated.reduce((n, j) => n + j.cost, 0)} credits (first tries only; an image retry adds 200)`);
else console.log(`done: ${JSON.stringify(run.log.summary)}\n  ${join(dir, "index.html")}`);
