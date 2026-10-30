// Runs the full pipeline on the test cases and writes JSON results plus the HTML report.
// Usage: node current/prod/state-manager/run.mjs [--only <case id>]
// Steps: 1 creative director story · 2 change-based operational chunks · 3 state spec (atoms, bindings, groupings)
//        4 solver epochs · 5 final tool-call plan (execution order + tree).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO, TESTS } from "./src/paths.js";
import { loadSignatures } from "./src/signatures.js";
import { atomize } from "./src/atomize.js";
import { solve } from "./src/solver.js";
import { makeJudge } from "./src/judge.js";
import { usage } from "./src/llm.js";
import { renderReport } from "./src/render.js";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const cases = JSON.parse(readFileSync(join(TESTS, "cases.json"), "utf8")).cases.filter((c) => !only || c.id === only);
const sigs = loadSignatures();
mkdirSync(join(TESTS, "out"), { recursive: true });

const results = [];
for (const c of cases) {
  const read = (p) => readFileSync(join(REPO, p), "utf8");
  const story = read(c.story_path), chunks = read(c.chunks_path);
  console.log(`${c.id}: atomizing…`);
  const spec = await atomize({ request: c.request, uploads: c.uploads, story, chunks, atoms: sigs.atoms });
  const judge = makeJudge();
  const solver = solve({ spec, sigs, judge });
  let plan;
  for (let round = 1; round <= 4; round++) {
    solver.reset(); solver.prepare();
    if (!judge.pending() || round === 4) { plan = solver.finish(); break; }
    console.log(`  soft-credit round ${round}: ${judge.pending()} questions`);
    await judge.run();
  }
  const result = { ...c, story, chunks, spec, top: solver.top, plan, judge: judge.log };
  writeFileSync(join(TESTS, "out", `${c.id}.json`), JSON.stringify(result, null, 2));
  const tools = plan.nodes.filter((n) => n.type === "tool").length;
  const unsolved = plan.nodes.filter((n) => n.type === "unsolved").length;
  console.log(`  ${tools} tool calls, ${plan.schedule.length - 1} execution levels, ${unsolved} unsolved`);
  results.push(result);
}

if (!only) {
  writeFileSync(join(TESTS, "state-manager.html"), renderReport(results, sigs));
  console.log(`Wrote current/tests/state-manager/state-manager.html`);
}
console.log("LLM usage:", usage);
