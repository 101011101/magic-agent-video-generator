// The benchmark runner, dry: every case through the agent with the proxy user, no tool called; the transcripts and
// the checks to V2/bench/results/<stamp>/ (one JSON per case, one index.html). Usage:
//   node V2/bench/run.mjs [--case id[,id…]] [--group extraction|source|tools] [--tier free] [--out <dir>]
//   node V2/bench/run.mjs --rescore <results dir>   re-scores the saved transcripts with the current checks and cases;
//                                                   no model call, no run: the way to see what a scoring change does
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCase, check } from "../backend/agent/agent.mjs";
import { page } from "./page.js";
import { simulate } from "../backend/agent/simulate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RESCORE = arg("--rescore");
if (RESCORE) {
  const byId = Object.fromEntries(readdirSync(join(HERE, "cases")).filter((f) => f.endsWith(".json")).map((f) => { const c = JSON.parse(readFileSync(join(HERE, "cases", f), "utf8")); return [c.id, c]; }));
  const rows = []; let before = 0, after = 0, n = 0;
  for (const f of readdirSync(RESCORE).filter((x) => x.endsWith(".json")).sort()) {
    const t = JSON.parse(readFileSync(join(RESCORE, f), "utf8")); const c = byId[t.id]; if (!c || t.error) { rows.push(t); continue; }
    const old = (t.checks || []).filter((x) => x.pass).length; before += old; n += (t.checks || []).length;
    t.checks = check(c, t); const now = t.checks.filter((x) => x.pass).length; after += now;
    writeFileSync(join(RESCORE, f), JSON.stringify(t, null, 2)); rows.push(t);
    console.log(`${t.id.padEnd(32)} ${old}/${(t.checks || []).length} → ${now}/${t.checks.length}${t.checks.filter((x) => !x.pass).length ? "  failing: " + t.checks.filter((x) => !x.pass).map((x) => x.name).join("; ") : ""}`);
  }
  const total = rows.flatMap((r) => r.checks || []);
  writeFileSync(join(RESCORE, "index.html"), page(rows, { tier: rows[0]?.tier || "free", stamp: `${RESCORE.split("/").pop()} (rescored)` }));
  console.log(`\nrescored: ${before} passing before (${n} checks) → ${total.filter((x) => x.pass).length}/${total.length} now · ${RESCORE}/index.html`);
  process.exit(0);
}
const only = (arg("--case", "") || "").split(",").filter(Boolean), group = arg("--group"), tier = arg("--tier", "free"), SIM = process.argv.includes("--simulate");
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2");
const out = arg("--out", join(HERE, "results", stamp)); mkdirSync(out, { recursive: true });

const cases = readdirSync(join(HERE, "cases")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(HERE, "cases", f), "utf8")))
  .filter((c) => (!only.length || only.includes(c.id)) && (!group || c.group === group));

// Cases with `after` run on the session the earlier case produced: its planned outputs become session assets.
const sessions = {};
const order = [...cases.filter((c) => !c.after), ...cases.filter((c) => c.after)];
const results = [];
for (const c of order) {
  const session = c.after ? sessions[c.after] || [] : [];
  process.stdout.write(`${c.id} … `);
  try {
    const t = await runCase(c, { tier, session });
    if (SIM && t.plan) { const d = join(out, "sim", c.id); simulate(t.plan, d); for (const st of t.plan.steps) st.output = `sim/${c.id}/${st.output}`; }
    results.push(t);
    sessions[c.id] = (t.plan?.steps || []).map((s) => ({ label: s.produces, kind: s.produces.match(/\.(mp4|mov)$/) ? "clip" : s.produces.match(/\.(mp3|wav)$/) ? "sound" : "picture", from: s.tool }));
    const pass = t.checks.filter((x) => x.pass).length;
    console.log(`${pass}/${t.checks.length} ${t.plan ? `→ ${t.plan.steps.map((s) => s.tool).join(" → ")} (${t.plan.estimate_credits} cr)` : "unresolved"}`);
    writeFileSync(join(out, `${c.id}.json`), JSON.stringify(t, null, 2));
  } catch (e) { console.log(`ERROR ${e.message}`); results.push({ id: c.id, group: c.group, brief: c.brief, error: e.message, messages: [], rounds: [], checks: [] }); }
}
writeFileSync(join(out, "index.html"), page(results, { tier, stamp }));
const total = results.flatMap((r) => r.checks), ok = total.filter((x) => x.pass).length;
console.log(`\n${ok}/${total.length} checks pass · ${out}/index.html`);
