// Cost estimate for the full runs, from the catalogue and each item's expected tool and parameters. Usage: node V4/tests/estimate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "../agent/catalogue.js";
import { V4 } from "../agent/run.mjs";
const items = readdirSync(join(V4, "tests/items")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(V4, "tests/items", f), "utf8")));
let total = 0, withRetry = 0;
for (const it of items) { const t = TOOLS[it.expect_tool], p = it.expect_params || {}, c = t ? t.cost(p) : 0, extra = it.extra_cost || 0; total += c + extra; withRetry += (c + extra) * (t && /video|image/.test(t.out) ? 2 : 1); console.log(`${it.id.padEnd(5)} ${it.expect_tool.padEnd(24)} ${String(c + extra).padStart(5)}  ${it.title}`); }
console.log(`\ntotal ${total} credits for the whole full suite, one attempt each, no retries · dry runs cost 0 credits`);
