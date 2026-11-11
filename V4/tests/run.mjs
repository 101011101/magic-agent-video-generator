// Run the V4 test items. Modes: --dry (vague brief + answer sheet; plus the strange-answer script and the direction-change
// script when the item has them; no credits) and --full (the full brief, no back-and-forth; credits).
// Usage: CLEANED_CAP=… node V4/tests/run.mjs --dry|--full [--only S01,V02] → V4/runs/<mode>-<id>[-strange|-turn]/run.json
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { converse, V4 } from "../agent/run.mjs";
const args = process.argv.slice(2), MODE = args.includes("--full") ? "full" : "dry", only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const items = readdirSync(join(V4, "tests/items")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(V4, "tests/items", f), "utf8"))).filter((it) => !only || only.includes(it.id));
const FIX = join(V4, "..", "V2/bench/v1/fixtures");
for (const it of items) { try {
  const materials = (it.materials || []).map((m) => join(FIX, m));
  const say = (m) => console.log(`[${it.id}] ${m}`);
  if (MODE === "dry") {
    const a = await converse({ brief: it.vague, materials, label: `dry-${it.id}`, answers: it.answers || {}, DRY: true, say });
    const toolOk = a.turns.at(-1)?.intent?.tool === it.expect_tool;
    console.log(`[${it.id}] sheet: ${a.turns.length} turn(s) · tool ${a.turns.at(-1)?.intent?.tool} ${toolOk ? "✓" : `✗ (expected ${it.expect_tool})`} · asked: ${a.turns.flatMap((t) => t.asked.map((q) => q.param)).join(", ") || "nothing"}`);
    if (it.strange) { const s = await converse({ brief: it.vague, materials, label: `dry-${it.id}-strange`, answers: it.answers || {}, script: it.strange, DRY: true, say, maxTurns: 6 }); console.log(`[${it.id}] strange: ${s.turns.length} turn(s) · tool ${s.turns.at(-1)?.intent?.tool} · outcome ${s.turns.at(-1)?.outcome || "still asking"}`); }
    if (it.turn) { const t = await converse({ brief: it.vague, materials, label: `dry-${it.id}-turn`, answers: it.answers || {}, script: it.turn.script, DRY: true, say }); const last = t.turns.at(-1)?.intent; console.log(`[${it.id}] direction change: tool ${last?.tool} ${last?.tool === it.turn.expect_tool ? "✓" : `✗ (expected ${it.turn.expect_tool})`} · flagged ${t.turns.some((x) => x.intent.direction_changed) ? "yes" : "no"}`); }
  } else {
    const f = await converse({ brief: it.full, materials, label: `full-${it.id}`, answers: it.answers || {}, DRY: false, say, maxTurns: 3 });
    console.log(`[${it.id}] full: ${f.turns.length} turn(s) · tool ${f.turns.at(-1)?.intent?.tool} · ${f.credits} credits · ${f.result?.file || f.result?.film || f.turns.at(-1)?.outcome}`);
  }
} catch (e) { console.log(`[${it.id}] CRASHED: ${String(e.message || e).slice(0, 300)}`); } }
