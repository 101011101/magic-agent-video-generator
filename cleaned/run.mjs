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
//   --force-paint  paint even if the plan still breaks a rule or has open questions (normally the run stops before images)
//   --plan-only  stop after the states are solved (editor, ids, blocking, questions): no images
//   --seed-only  stop after the asset bank and the seed plates (page shows sheets and plates)
//   --assets-only  stop after the asset bank (sheets checked one by one and as a set): writes assets.html for review
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RUNS } from "./src/env.js";
import { usage, MODEL } from "./src/llm.js";
import { Jobs, CAP, IMAGE } from "./src/jobs.js";
import { writeWorld, writeStory, block, check } from "./src/sequencer.js";
import { assignIds, classifyIds, linkIds } from "./src/ids.js";
import { reviewStory, questions, answerQuestions } from "./src/editor.js";
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
const firstFrames = args.includes("--first-frames"), assetsOnly = args.includes("--assets-only"), seedOnly = args.includes("--seed-only"), planOnly = args.includes("--plan-only"), planFrom = opt("--plan-from", null);
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
// Tracked assets from the id table. "inside" is resolved to something the state manager tracks: packed in an asset → that
// asset; in a part of an asset (shears on a belt) → that asset; in a fixture (a needle in a sewing basket) → the fixture's place
// (home: there from the place's first frame).
function assetsOf(table) {
  const by = Object.fromEntries(table.map((t) => [t.id, t]));
  return table.filter((t) => t.role === "asset" && t.kind !== "none").map((t) => {
    let c = t.inside && t.inside !== "none" ? by[t.inside] : null, inside = "", home = "";
    if (c?.role === "part" && by[c.parent]?.role === "asset") c = by[c.parent];
    if (c?.role === "asset") inside = c.id; else if (c?.role === "fixture" && c.place !== "none") home = c.place;
    return { id: t.id, name: t.name, kind: t.kind, look: "", inside, home };
  });
}
let plan = run.log.plan ? check(run.log.plan) : null;
const page = () => { if (!estimate && plan) writeFileSync(join(dir, "index.html"), renderPage({ name, prompt, plan, tracker, log: run.log, credits: jobs.spent() })); };
try {
  if (!plan && worldRun) throw new Error("--world reuses an older run's world for its saved plan; new runs use --entities-from");
  if (!plan) {
    // States first: story → ground plans (text) → blocking solved into the state table (with each place's initial contents)
    // → then assets from the solved states: seed sheets only for assets whose first appearance is an entry, and plates painted
    // with their initial contents. Nothing can appear from nowhere: a prop used without being brought in was always there.
    console.log(`${name}: story…`);
    let world, fixtures = [], links = [], sp, blocking;
    if (given) {   // --entities-from / --plan-from: the older world call, no editor
      world = run.log.world ??= await writeWorld(prompt, given);
      sp = run.log.seed_plan ??= await seedPlan(world, world.story); run.save();
      blocking = run.log.blocking ??= await block(world, Object.fromEntries(sp.places.map((p) => [p.id, p]))); run.save();
    } else {
      const st = run.log.story ??= await writeStory(prompt); run.save();
      // E1: the editor reads the story for logic holes right away (minimal edits).
      if (!run.log.edit) { console.log("editor…"); const rv = await reviewStory(st.story); run.log.edit = { original: st.story, review: rv.holes, story: rv.story, rounds: [] }; run.save(); }
      // Solve one story text: I0 ids (pronouns resolved in context) → ground plans → blocking → state manager (code, in block()).
      // Solve one story text. prev: the earlier solve of this story (after an edit). Only what changed is redone: unchanged chunks
      // keep their tags, the ground plans are reused when environments and fixtures are the same, the blocking is patched.
      const solve = async (text, prev = null) => {
        const tagged = await assignIds(text, prev?.ids.table || [], prev?.ids.chunks || []), table = await classifyIds(text, tagged.table), ids = { table, chunks: tagged.chunks, links: await linkIds(text, table) };
        const w = { title: st.title, style: st.style, story: text, story_ids: tagged.chunks.map((c) => c.tagged).join("\n\n"),
          entities: assetsOf(table),
          locations: table.filter((t) => t.role === "place").map((t) => ({ id: t.id, name: t.name, look: "" })) };
        const fx = table.filter((t) => t.role === "fixture" && t.place !== "none"), ls = ids.links.filter((l) => l.belongs);
        const envSig = (t, f) => JSON.stringify([t.filter((x) => x.role === "place").map((x) => x.id).sort(), f.map((x) => `${x.id}@${x.place}`).sort()]);
        const reusePlan = prev && envSig(table, fx) === envSig(prev.ids.table, prev.ids.table.filter((t) => t.role === "fixture" && t.place !== "none"));
        const plan0 = reusePlan ? prev.sp : await seedPlan(w, text, { fixtures: fx, links: ls });
        const bl = await block(w, Object.fromEntries(plan0.places.map((p) => [p.id, p])), prev ? { steps: prev.blocking.steps, story_ids: prev.world.story_ids } : null);
        console.log(`    solved: ${tagged.chunks.filter((c) => prev?.ids.chunks.some((p) => p.text === c.text)).length}/${tagged.chunks.length} chunks reused · ground plans ${reusePlan ? "reused" : "new"} · blocking ${bl.patch ? `patched (${bl.patch.length} op)` : "written"} · ${bl.lint.length} rule(s) broken`);
        return { ids, world: w, sp: plan0, blocking: bl };
      };
      if (!run.log.blocking) {
        // Q: the state manager's findings become questions; the editor answers them all at once; solve again (≤ 2 rounds).
        console.log("ids, ground plans, blocking, state manager…");
        let text = run.log.edit.story, solved = await solve(text);
        const answered = [];
        for (let r = 0; r < 2; r++) {
          const qs = questions({ blocking: solved.blocking, ids: solved.ids, answered });
          console.log(`  question round ${r + 1}: ${qs.length} question(s)${qs.length ? ": " + qs.map((q) => q.key).join(", ") : ""}`);
          if (!qs.length) break;
          const ans = await answerQuestions(text, qs);
          answered.push(...ans.answers.filter((a) => a.kind === "always-there").map((a) => a.key));
          run.log.edit.rounds.push({ questions: qs, answers: ans.answers, before: text, after: ans.story }); run.save();
          text = ans.story; solved = await solve(text, solved);   // same things keep the same ids; only changes are redone
        }
        run.log.edit.story = text;
        run.log.edit.open = questions({ blocking: solved.blocking, ids: solved.ids, answered });
        Object.assign(run.log, { ids: solved.ids, world: solved.world, seed_plan: solved.sp, blocking: solved.blocking }); run.save();
      }
      world = run.log.world; sp = run.log.seed_plan; blocking = run.log.blocking;
      fixtures = run.log.ids.table.filter((t) => t.role === "fixture" && t.place !== "none"); links = run.log.ids.links.filter((l) => l.belongs);
      console.log(`  ${run.log.ids.table.length} ids: ${world.entities.length} assets, ${fixtures.length} fixtures, ${world.locations.length} places, ${links.length} links · open questions: ${run.log.edit.open.length}`);
    }
    if (planOnly) { plan = { ...blocking }; throw Object.assign(new Error("plan only: states solved, no images"), { stop: true }); }
    // Gate: no image is paid for while the plan still breaks a rule or has open questions (custom-rrh4 painted 3,600 credits
    // of sheets and plates from a plan with five). --force-paint overrides.
    const openQs = run.log.edit?.open || [];
    if ((blocking.lint?.length || openQs.length) && !args.includes("--force-paint")) {
      plan = { ...blocking };
      throw Object.assign(new Error(`plan not clean, no images: ${blocking.lint?.length || 0} rule(s) broken, ${openQs.length} open question(s): ${[...(blocking.lint || []), ...openQs.map((q) => q.key)].join("; ")}`), { stop: true });
    }
    // No sheet for assets that first appear as a place's initial contents (painted into its plate) or packed inside another
    // asset (they come with their container: a cake in the basket).
    const initialIds = new Set([...Object.values(blocking.initial || {}).flat(), ...world.entities.filter((e) => e.inside).map((e) => e.id)]);
    console.log(`  initial contents: ${Object.entries(blocking.initial || {}).map(([k, v]) => `${k}: ${v.join(", ") || "—"}`).join(" · ") || "none"}`);
    if (entRun) await makeRoots(world, jobs, tracker, { places: false });   // reused sheets (copied jobs, cached)
    console.log("asset bank (first appearances by entry only)…");
    const redo = opt("--redo-assets", null)?.split(",").filter(Boolean);
    if (redo?.length && run.log.asset_specs) {   // re-spec only these (e.g. a container whose contents were missing)
      const fresh = await specAssets(world, redo);
      run.log.asset_specs = run.log.asset_specs.map((a) => fresh.find((f) => f.id === a.id) || a);
    }
    const specs = run.log.asset_specs ??= await specAssets(world); run.save();
    if (!entRun) {
      const keep = redo ? Object.fromEntries(Object.entries(run.log.assets || {}).filter(([id]) => !redo.includes(id))) : {};
      run.log.assets = await makeAssets(world, specs.filter((a) => !initialIds.has(a.id)), jobs, tracker, { estimate, keep }); run.save();
      if (!estimate) writeFileSync(join(dir, "assets.html"), renderAssets({ name, world, assets: run.log.assets, credits: jobs.spent() }));
      if (assetsOnly) throw Object.assign(new Error("assets only: stopped after the asset bank"), { stop: true });
    }
    console.log("seed plates (with initial contents)…");
    const used = world.locations.filter((l) => blocking.slides.some((x) => x.location === l.id));   // plates only where scenes happen
    const usedMarks = {};
    for (const st of blocking.steps) for (const m of [...st.beats.flatMap((b) => [b.to, b.via]), st.change.mark].filter(Boolean)) (usedMarks[st.place] ??= new Set()).add(m);
    const seed = await makeSeed({ style: world.style, locations: used, seed: JSON.parse(JSON.stringify(sp)), initial: blocking.initial, specs, used: usedMarks }, jobs, tracker, { estimate });
    run.log.seed = seed; run.save();
    plan = { ...blocking, seed };
    if (seedOnly) throw Object.assign(new Error("seed only: stopped after the plates"), { stop: true });
  } else {
    console.log(`${name}: plan from run.json; roots…`);
    await makeRoots(plan, jobs, tracker, { places: !plan.seed });
    if (plan.seed) for (const [id, p] of Object.entries(plan.seed)) tracker.addPlate(id, p.plate, p.contents || []);
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
