// Stage 1 pipeline: prompt → plan (S1) → roots (S2) → per slide: base (S3) → edit (S4) → verify (S5) → slideshow (S6).
// Usage: node cleaned/run.mjs --case goldilocks [--label v1] [--slides N] [--estimate]
//   --prompt "…"  use a prompt instead of a case;  --slides N  build only the first N slides;  --estimate  spend nothing
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RUNS } from "./src/env.js";
import { usage, MODEL } from "./src/llm.js";
import { Jobs, CAP, IMAGE } from "./src/jobs.js";
import { sequence, check } from "./src/sequencer.js";
import { makeRoots } from "./src/roots.js";
import { Tracker } from "./src/tracker.js";
import { buildSlide } from "./src/builder.js";
import { renderPage } from "./src/page.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const estimate = args.includes("--estimate"), only = Number(opt("--slides", 0));
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

console.log(`${name}: sequencing…`);
const plan = run.log.plan ? check(run.log.plan) : await sequence(prompt);
run.log.plan = plan; run.save();
console.log(`  ${plan.title}: ${plan.entities.length} entities, ${plan.locations.length} locations, ${plan.slides.length} slides`);
for (const s of plan.slides) console.log(`  ${s.n}. [${s.location}] {${s.present.join(", ")}}${s.continues ? " (continues)" : ""}${s.change ? ` Δ ${s.change}` : ""}`);

const page = () => { if (!estimate) writeFileSync(join(dir, "index.html"), renderPage({ name, prompt, plan, tracker, log: run.log, credits: jobs.spent() })); };
try {
  console.log("roots…");
  await makeRoots(plan, jobs, tracker);
  for (const s of (only ? plan.slides.slice(0, only) : plan.slides)) {
    console.log(`slide ${s.n}: ${s.caption}`);
    await buildSlide(s, { plan, tracker, jobs, run });
    page();
  }
} catch (e) { run.log.errors.push(String(e.stack || e)); console.error(`stopped: ${e.message}`); }

const frames = tracker.frames.filter((f) => f.op === "edit");
run.log.summary = { slides: frames.length, passed: frames.filter((f) => !f.forced).length, first_try: frames.filter((f) => !f.forced && f.attempts.length === 1).length,
  forced: frames.filter((f) => f.forced).map((f) => f.slide), attempts: frames.reduce((n, f) => n + f.attempts.length, 0), max_hops: Math.max(0, ...frames.map((f) => f.hops)),
  credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) };
run.save(); page();
if (estimate) console.log(`estimate: ${jobs.estimated.length} image jobs, ${jobs.estimated.reduce((n, j) => n + j.cost, 0)} credits (first tries only; retries add 200 each)`);
else console.log(`done: ${JSON.stringify(run.log.summary)}\n  ${join(dir, "index.html")}`);
