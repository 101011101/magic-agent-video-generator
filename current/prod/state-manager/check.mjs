// Re-runs the continuity check (SSIM) on an executed run folder. No Magic Hour calls.
// Usage: node current/prod/state-manager/check.mjs <run folder name> [--write]
//   --write   store the result in that run's run.json and index.html (default: print only)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TESTS } from "./src/paths.js";
import { checkContinuity } from "./src/continuity.js";
import { renderRun } from "./src/render-run.js";

const [name] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const write = process.argv.includes("--write");
const dir = join(TESTS, "runs", name);
const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
// Older runs have no handoff in the chain: same start as the previous end = exact, otherwise not judged as a join kind.
const chain = run.chain.map((c, i) => ({ ...c, handoff: c.handoff || (i === 0 ? "first" : c.start === run.chain[i - 1].end ? "exact" : "edited") }));
const file = (id) => { const r = run.records[id]; const f = r?.file && join(dir, r.file); return f && existsSync(f) ? f : null; };
const cont = checkContinuity(write ? dir : join(tmpdir(), `check-${name}`), chain, file);
for (const [i, c] of cont.clips.entries()) {
  const s = cont.seams.find((x) => x.to === c.video);
  console.log(`${i + 1}\t${c.video}\t${chain[i].handoff}\tstart ${c.start ?? "-"}\tend ${c.end ?? "-"}\tseam ${s ? s.ssim : "-"}${c.flags.length || s?.flag ? "\tFLAG" : ""}`);
}
if (write) { run.chain = chain; run.continuity = cont; writeFileSync(join(dir, "run.json"), JSON.stringify(run, null, 2)); writeFileSync(join(dir, "index.html"), renderRun(run)); console.log("written"); }
