// I0 test on a run's story: id table, coverage, id'd copy, physical links. LLM only. Usage: node cleaned/experiments/ids-test.mjs custom-rrh3
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { assignIds, linkIds } from "../src/ids.js";

const name = process.argv[2], story = JSON.parse(readFileSync(join(RUNS, name, "run.json"), "utf8")).world.story;
const ids = await assignIds(story), links = await linkIds(story, ids.table);
writeFileSync(join(RUNS, name, "ids.json"), JSON.stringify({ ...ids, links }, null, 2));
console.log("ID TABLE");
for (const t of ids.table) console.log(`  ${t.id.padEnd(18)} ${t.kind.padEnd(10)} ${t.name}${t.aliases.length ? `  ← ${t.aliases.join(", ")}` : ""}`);
console.log("\nUNTAGGED after coverage:", ids.chunks.flatMap((c) => c.untagged).join("; ") || "none");
console.log("\nID'D COPY (first chunks)\n" + ids.chunks.slice(0, 2).map((c) => c.tagged).join("\n\n"));
console.log("\nLINKS");
for (const l of links) console.log(`  ${l.belongs ? "✓" : "✗"} ${l.a} ${l.relation} ${l.b}${l.belongs ? ` — ${l.constraint}` : ` (rejected: ${l.evidence || "no support"})`}`);
