// Prints the conversations of a results folder written by run.mjs: the persona, the opening (what it withheld), every
// exchange, each create call the assistant attempted with its key arguments and the gate's decision, and the final kind.
// For reading a run before trusting it, dry runs above all.
// --full prints the item's whole trace (<id>.trace.json) instead: every model hop with its time and tokens, thoughts, messages,
// tool calls with full arguments and results, gate decisions, the prompt behind each simulated-user line, each classification.
// Usage: node V2/bench/mcp/transcript.mjs --dir V2/bench/v1/results/<dir> [--only A01a,B07a] [--short] [--full [--chars 1500]]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = arg("--dir"); if (!DIR) throw new Error("--dir <results folder>");
const only = (arg("--only", "") || "").split(",").filter(Boolean), SHORT = process.argv.includes("--short"), FULL = process.argv.includes("--full"), CH = Number(arg("--chars", "1500"));
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").replace(/\]\((https?:[^)]*)\)/g, "](link)").replace(/https?:\/\/\S+/g, "<link>"); return s.length > n ? s.slice(0, n) + "…" : s; };
const keyArgs = (a) => { const o = {}; for (const k of ["model", "resolution", "aspect_ratio", "orientation", "start_seconds", "end_seconds", "duration", "audio", "image_count", "scale_factor", "voice", "language", "production", "clip"]) if (a[k] != null) o[k] = a[k]; const p = a.prompt || a.style?.prompt || a.text || a.instructions || a.description; if (p) o.prompt = cut(p, SHORT ? 80 : 240); return JSON.stringify(o); };
const recs = readdirSync(DIR).filter((f) => /^[A-Z]+\d\d[a-z]?\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8"))).filter((r) => !only.length || only.includes(r.id)).sort((a, b) => a.id.localeCompare(b.id));
const ms = (t) => `${String(Math.floor(t / 1000)).padStart(4)}.${String(t % 1000).padStart(3, "0").slice(0, 1)}s`;
function full(r) {
  const f = join(DIR, r.trace_file || `${r.id}.trace.json`); if (!existsSync(f)) return console.log("   (no trace file: this run predates the trace)");
  for (const e of JSON.parse(readFileSync(f, "utf8")).events) {
    const at = ms(e.t);
    switch (e.type) {
      case "item_start": console.log(`   ${at} START  persona ${e.persona}${e.dry ? " · dry" : ""} · ${e.server?.name} ${e.server?.version || ""}${e.local ? " (local build)" : " (hosted)"} · ${e.model} ${e.effort}\n            spec ${JSON.stringify(e.spec)} · expect ${JSON.stringify(e.expect)}`); break;
      case "opening": console.log(`   ${at} OPENING ${e.as_written ? "(as written)" : "(rewritten)"}${e.withheld?.length ? ` · withheld: ${e.withheld.join("; ")}` : ""}${e.extras?.length ? ` · extras: ${e.extras.join(" | ")}` : ""}`); break;
      case "user_message": console.log(`   ${at} USER   [${e.role}${e.round ? ` ${e.round}` : ""}] ${cut(e.text, CH)}${e.materials?.length ? `  [${e.materials.join(", ")}]` : ""}`); break;
      case "proxy": console.log(`   ${at}   proxy ${e.fixed ? "(fixed line)" : `wrote it from a prompt of ${String(e.prompt || "").length} chars (kept in the trace)`}${e.fixed ? "" : ` → ${cut(e.reply, 200)}`}`); break;
      case "llm": console.log(`   ${at} MODEL  hop ${e.id?.slice(-6)} · ${e.ms} ms${e.attempts > 1 ? ` · ${e.attempts} attempts` : ""} · in ${e.usage.input} (cached ${e.usage.cached}) out ${e.usage.output} (reasoning ${e.usage.reasoning}) · items ${(e.items || []).join(",")}`); break;
      case "thought": console.log(`   ${at}   thought ${cut(e.text, CH)}`); break;
      case "said": console.log(`   ${at} SAID   ${cut(e.text, CH)}`); break;
      case "approval_request": console.log(`   ${at}   asks to call ${e.name} ${cut(e.arguments, CH)}`); break;
      case "gate": console.log(`   ${at} GATE   ${e.name} ${e.approve ? `approved${e.est != null ? ` ~${e.est} cr` : ""}` : `REFUSED: ${cut(e.reason, 160)}`}  ${keyArgs(JSON.parse(e.arguments || "{}"))}`); break;
      case "call": console.log(`   ${at} CALL   ${e.name}${e.ms != null ? ` (${e.ms} ms)` : ""} ${cut(e.arguments, CH)}\n            → ${e.refused ? `refused: ${cut(e.refused, 160)}` : e.error ? `ERROR ${cut(e.error, CH)}` : cut(e.output, CH)}`); break;
      case "classify": console.log(`   ${at} KIND   ${e.kind} — ${cut(e.why, 200)}`); break;
      case "turn_end": console.log(`   ${at} TURN   ${e.kind} · ${e.seconds} s · ${e.calls} calls · ${e.refused} refused · ${e.spent} cr${e.still_asking ? " · still asking" : ""}`); break;
      case "error": console.log(`   ${at} ERROR  ${cut(e.message, 400)}`); break;
      case "item_end": console.log(`   ${at} END    ${e.spent} cr · ${e.seconds} s${e.gave_up ? " · user gave up" : ""} · ${e.usage.responses} hops, ${e.usage.input} in / ${e.usage.output} out tokens`); break;
      default: console.log(`   ${at} ${e.type}`);
    }
  }
}
for (const r of recs) {
  console.log(`\n━━ ${r.id} · ${r.item?.title || ""} · persona ${r.persona || "happy"}${r.dry ? " · DRY" : ""} · ${r.spent ?? 0} cr · ${r.seconds ?? "?"} s${r.gave_up ? " · gave up" : ""}${r.error ? ` · ERROR ${cut(r.error, 200)}` : ""}`);
  if (FULL) { full(r); continue; }
  if (r.opening && !r.opening.as_written) console.log(`   opening rewritten · withheld: ${(r.opening.withheld || []).join("; ") || "nothing"}${r.opening.extras?.length ? ` · extras: ${r.opening.extras.length}` : ""}`);
  if (r.change) console.log(`   change: ${r.change.field} ${r.change.from} → ${r.change.to}${r.change.sent ? "" : ` (not sent: ${r.change.skipped || "?"})`}`);
  for (const t of r.turns || []) {
    console.log(`   USER${t.follow_up ? " (follow-up)" : ""}: ${cut(t.text, SHORT ? 160 : 600)}${t.materials?.length ? `  [${t.materials.join(", ")}]` : ""}`);
    for (const d of t.dialog || []) console.log(`   AGENT: ${cut(d.agent, SHORT ? 240 : 900)}\n   USER${d.gave_up ? " (gives up)" : ""}: ${cut(d.user, 300)}`);
    for (const a of t.approvals || []) console.log(`      → ${a.name} ${keyArgs(a.args || {})}  ${a.approve ? `✓${a.est != null ? ` ~${a.est} cr` : ""}` : `✗ ${cut(a.reason, 110)}`}`);
    const free = (t.calls || []).filter((c) => /^(plan_|get_workflow_guide|detect_faces|upload_)/.test(c.name)); if (free.length) console.log(`      free calls: ${free.map((c) => c.name).join(", ")}`);
    console.log(`   AGENT [${t.kind}]: ${cut(t.agent, SHORT ? 240 : 900)}`);
    if (t.ran?.some((s) => s.output)) console.log(`      files: ${t.ran.filter((s) => s.output).map((s) => s.output).join(", ")}`);
  }
}
if (!FULL) {
  const kinds = recs.reduce((a, r) => { const k = r.error ? "error" : r.turns?.at(-1)?.kind || "?"; a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`\n${recs.length} records · final kinds ${JSON.stringify(kinds)} · questions asked ${recs.reduce((a, r) => a + (r.turns || []).reduce((b, t) => b + (t.dialog || []).filter((d) => d.asked?.[0] === "question").length, 0), 0)} · gave up ${recs.filter((r) => r.gave_up).length}`);
}
