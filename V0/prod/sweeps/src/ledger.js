// Sweep spend: its own ledger, same shape and same cap discipline as pipeline-memory's, kept separate because the cap is a
// cumulative lifetime guard. Sharing pipeline-memory's file (22,640 spent) would force MH_CAP past 23,000 to run a 1,195
// sweep, turning a tight guard into a loose one. A separate ledger starts at 0, so the cap can sit just above this run.
// Matches the house pattern: pipeline-memory has ledger.json, pipeline-state-graph has credits.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { REPO } from "../../state-manager/src/paths.js";

export const LEDGER = join(REPO, "current/tests/sweeps/ledger.json");
export const CAP = Number(process.env.MH_CAP || 2000);

export function ledger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { spent: 0, jobs: [] }; }

// Credits promised to calls in flight but not yet written to disk. The sweep is sequential today, but the check-and-reserve
// has no await between its two statements, so the cap still holds if an arm is ever parallelised.
let reserved = 0;
export function check(expect) {
  const l = ledger();
  if (l.spent + reserved + expect > CAP) throw new Error(`budget: ${l.spent} spent + ${reserved} in flight + ${expect} would pass the cap of ${CAP} (raise MH_CAP to run)`);
  reserved += expect;
}
export function release(expect) { reserved -= expect; }
export function spend(entry) {
  const l = ledger(); l.spent += entry.credits || 0;
  l.jobs.push({ at: new Date().toISOString(), ...entry });
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  return l.spent;
}
