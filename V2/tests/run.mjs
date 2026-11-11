// The test runner: every V2/tests/*.test.mjs in its own process, one line each, one total, exit 1 if any failed.
// Usage: node V2/tests/run.mjs [name …]   (names match the file stem: "execute" runs execute.test.mjs)
// No credits, no model calls: a test that needs a key or the network is a bug in the test.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = readdirSync(HERE).filter((f) => f.endsWith(".test.mjs")).filter((f) => !only.length || only.some((o) => f.startsWith(o))).sort();
const rows = []; let failed = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, f)], { encoding: "utf8", env: { ...process.env, CLEANED_CAP: process.env.CLEANED_CAP || "1000000" } });
  const out = (r.stdout || "") + (r.stderr || "");
  const checks = (out.match(/^\s*(ok|✓)\b/gm) || []).length;   // each test prints one "ok …" line per check
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push({ f, ok, checks, ms: Date.now() - t0, tail: ok ? "" : out.trim().split("\n").slice(-6).join("\n") });
  console.log(`${ok ? "PASS" : "FAIL"}  ${f.padEnd(24)} ${String(checks).padStart(4)} checks  ${String(Date.now() - t0).padStart(6)} ms`);
  if (!ok) console.log(rows.at(-1).tail.replace(/^/gm, "      "));
}
const total = rows.reduce((a, r) => a + r.checks, 0);
console.log(`\n${rows.length - failed}/${rows.length} files pass · ${total} checks`);
process.exit(failed ? 1 : 0);
