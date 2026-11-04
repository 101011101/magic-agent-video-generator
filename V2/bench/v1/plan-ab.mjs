// Direct planning vs goals-first planning vs the typed planner (plan2: restricted goal types, quantized tool choice, a code type check), on the plans alone (nothing runs, no credits): for each item, the final
// turn's sheet, materials and session go to plan() both ways; a blind reviewer scores each plan and the plan the real run
// used, and picks the better of the two new ones in shuffled order; code checks count unknown tools, inputs that wire to
// nothing, text-overlay on a designed picture and place used for something not a logo.
// Usage: node V2/bench/v1/plan-ab.mjs [--run real-1] [--only A06b,G35b] [--failed]   → results/<run>/plan-ab.json
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plan } from "../../backend/agent/plan.js";
import { plan2 } from "../../backend/agent/plan2.js";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { catalogueText } from "../../backend/agent/catalogue.js";
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = join(HERE, "results", arg("--run", "real-1")), ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const grades = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8")).filter((g) => (ONLY.length ? ONLY.includes(g.id) : !process.argv.includes("--failed") || !g.pass));
const DESIGN = /logo|poster|flyer|thumbnail|meme|carousel|slide|title card|end card|graphic|before.and.after|side by side/i;
const show = (p) => !p ? "(no plan)" : p.refuse ? `REFUSE: ${p.refuse}` : !p.steps?.length ? `NO STEPS; says: ${p.say}${p.questions_left?.length ? `; asks: ${p.questions_left.join(" / ")}` : ""}` : p.steps.map((s, i) => `${i + 1}. ${s.tool}${s.model ? ` (${s.model})` : ""} [${s.inputs.join(", ")}] → ${s.produces}: ${s.params?.prompt_or_change || ""}${s.params?.extra ? ` | ${s.params.extra}` : ""}${s.params?.aspect ? ` | ${s.params.aspect}` : ""}${s.params?.seconds ? ` | ${s.params.seconds}s` : ""}${s.params?.lettering ? " | lettering" : ""}`).join("\n");
function codeChecks(p, { materials, session, ask }) {
  const st = p?.steps || [], made = new Set(), out = { unknown: 0, unwired: 0, overlay_on_design: 0, place_misuse: 0, steps: st.length };
  for (const s of st) {
    if (s.unknown_tool) out.unknown++;
    for (const x of s.inputs) if (!made.has(x) && !materials.includes(x) && !session.includes(x)) out.unwired++;
    made.add(s.produces);
    if (s.tool === "text-overlay" && DESIGN.test(ask) && !/\.(mp4|mov)$/i.test(s.produces) && !s.inputs.some((x) => /\.(mp4|mov)$/i.test(x))) out.overlay_on_design++;
    if (s.tool === "place" && !/logo|watermark|sticker|badge|icon/i.test(ask)) out.place_misuse++;
  }
  return out;
}
const SCORE = S.obj({ chain_sound: S.bool, best_tools: S.bool, inputs_sound: S.bool, must_haves_covered: S.int, would_meet: S.int, issues: S.str });
const context = (r, g) => `REQUEST (all turns): ${r.turns.map((t, i) => `[${i + 1}] ${t.text}${t.materials?.length ? ` [attached: ${t.materials.join(", ")}]` : ""}${(t.dialog || []).map((d) => ` / asked: ${d.agent} / answered: ${d.user}`).join("")}`).join("\n")}
MUST-HAVES (${r.item.must_haves.length}): ${r.item.must_haves.map((m, i) => `${i + 1}) ${m}`).join(" ")}
EXPECTED: asks ${r.item.expect?.asks || "-"}; refuse ${!!r.item.expect?.refuse}; beyond free ${r.item.expect?.beyond_free || "no"}
FACTS: free stills flux-2-klein (5 cr) or qwen-image-2.1 (10 cr, spells designed lettering exactly) at 640px, generated only 1:1/16:9/9:16 and cut to other sizes by code; video minimax-h3 480p (adds its own speech; dropped unless kept); text-overlay is code that types plain text (exact, undesigned); place is a corner logo/sticker; assemble joins pictures/clips with a sound; crop/trim/frame/voice/write are code.
TOOLS: ${catalogueText()}`;
async function judge(r, g, p) {
  return jsonCall({ name: "bench-v1-plan-judge", effort: "medium", schema: SCORE, prompt: `Review an AI media agent's PLAN (nothing has run) for this request. Judge it as a careful producer would.
${context(r, g)}
THE PLAN:
${show(p)}
Give: chain_sound (the steps, order and wiring get from what exists to every deliverable without losing work), best_tools (each step uses the best available tool), inputs_sound (each step takes the right inputs), must_haves_covered (how many of the must-haves the plan, if the models do their job, would deliver), would_meet (1-5: if run, how likely the result meets the request), issues (one or two lines).` });
}
async function pair(r, g, a, b) {
  const flip = Math.random() < 0.5, [x, y] = flip ? [b, a] : [a, b];
  const v = await jsonCall({ name: "bench-v1-plan-pair", effort: "medium", schema: S.obj({ better: S.enum(["X", "Y", "same"]), why: S.str }), salt: g.id, prompt: `Two PLANS for the same request (nothing has run). Which plan is more likely to give the user what they asked for? "same" only if they are equivalent.
${context(r, g)}
PLAN X:
${show(x)}
PLAN Y:
${show(y)}` });
  return { winner: v.better === "same" ? "same" : (v.better === "X") !== flip ? "direct" : "goals", why: v.why };
}
async function one(g) {
  const r = JSON.parse(readFileSync(join(DIR, g.id + ".json"), "utf8")), last = r.turns.at(-1);
  const materials = [...new Set(r.turns.flatMap((t) => t.materials || []))];
  const session = r.turns.slice(0, -1).flatMap((t) => (t.plan?.steps || []).map((s) => s.produces));
  const ask = r.turns.map((t) => t.text).join(" "), sheet = last.sheet;
  if (!sheet || last.firstQuestions?.length && !last.plan) return null;
  const sessionAssets = session.map((label) => ({ label, kind: "asset" }));
  const DIRECT = process.argv.includes("--direct-only");   // only the current planner against the old plans (after a catalogue or rule change)
  const direct = await plan({ sheet, materials, session: sessionAssets, tier: "free", goals: false });
  const [goalsFirst, typed] = DIRECT ? [direct, direct] : await Promise.all([plan({ sheet, materials, session: sessionAssets, tier: "free", goals: true }), plan2({ sheet, materials, session: sessionAssets, tier: "free" })]);
  const same = { winner: "same", why: "not compared" };
  const [jo, jd, jg, jt, pw, pt] = await Promise.all([last.plan ? judge(r, g, last.plan) : null, judge(r, g, direct), DIRECT ? null : judge(r, g, goalsFirst), DIRECT ? null : judge(r, g, typed), DIRECT ? same : pair(r, g, direct, goalsFirst), DIRECT ? same : pair(r, g, direct, typed)]);
  const ctx = { materials, session, ask };
  return { id: g.id, pass: g.pass, must: r.item.must_haves.length, old: { tools: (last.plan?.steps || []).map((s) => s.tool), judge: jo, code: codeChecks(last.plan, ctx) }, direct: { tools: direct.steps.map((s) => s.tool), plan: direct, judge: jd, code: codeChecks(direct, ctx) }, goals: { tools: goalsFirst.steps.map((s) => s.tool), plan: goalsFirst, judge: jg, code: codeChecks(goalsFirst, ctx) }, typed: { tools: typed.steps.map((s) => s.tool), plan: typed, judge: jt, code: codeChecks(typed, ctx), type_errors: typed.type_errors || [], retried: !!typed.type_retried }, pair: pw, pair_typed: { ...pt, winner: pt.winner === "goals" ? "typed" : pt.winner } };
}
const out = [], queue = [...grades]; let done = 0;
await Promise.all(Array.from({ length: 8 }, async () => { for (let g; (g = queue.shift()); ) { try { const x = await one(g); if (x) out.push(x); } catch (e) { console.error(g.id, String(e.message || e).slice(0, 200)); } if (++done % 20 === 0) console.log(`${done}/${grades.length}`); } }));
out.sort((a, b) => a.id.localeCompare(b.id)); writeFileSync(join(DIR, process.argv.includes("--direct-only") ? "plan-ab-catalogue2.json" : "plan-ab.json"), JSON.stringify(out, null, 2));
const sum = (k, f) => out.reduce((n, x) => n + (x[k]?.judge ? f(x[k]) : 0), 0), nj = (k) => out.filter((x) => x[k]?.judge).length;
const row = (k) => { const n = nj(k); return `${k.padEnd(7)} n=${n} chain ${Math.round((100 * sum(k, (v) => +v.judge.chain_sound)) / n)}% · best tools ${Math.round((100 * sum(k, (v) => +v.judge.best_tools)) / n)}% · inputs ${Math.round((100 * sum(k, (v) => +v.judge.inputs_sound)) / n)}% · must-haves ${Math.round((100 * sum(k, (v) => v.judge.must_haves_covered)) / out.filter((x) => x[k]?.judge).reduce((a, x) => a + x.must, 0))}% · would-meet ${(sum(k, (v) => v.judge.would_meet) / n).toFixed(2)} · unwired ${sum(k, (v) => v.code.unwired)} · overlay-on-design ${sum(k, (v) => v.code.overlay_on_design)} · place-misuse ${sum(k, (v) => v.code.place_misuse)} · steps ${(sum(k, (v) => v.code.steps) / n).toFixed(1)}`; };
const w = (s) => out.filter((x) => x.pair.winner === s).length;
const wt = (s) => out.filter((x) => x.pair_typed.winner === s).length;
console.log(`${out.length} items\n${row("old")}\n${row("direct")}\n${row("goals")}\n${row("typed")}\npairwise: goals-first better ${w("goals")} · direct better ${w("direct")} · same ${w("same")}\npairwise: typed better ${wt("typed")} · direct better ${wt("direct")} · same ${wt("same")}\ntyped: type errors left ${out.reduce((n, x) => n + x.typed.type_errors.length, 0)} · corrected by retry ${out.filter((x) => x.typed.retried && !x.typed.type_errors.length).length}`);
for (const sub of [["failed", (x) => !x.pass], ["passed", (x) => x.pass]]) { const a = out.filter(sub[1]); console.log(`${sub[0]} (${a.length}): would-meet old ${(a.reduce((n, x) => n + (x.old.judge?.would_meet || 0), 0) / a.length).toFixed(2)} · direct ${(a.reduce((n, x) => n + x.direct.judge.would_meet, 0) / a.length).toFixed(2)} · goals ${(a.reduce((n, x) => n + (x.goals.judge || x.direct.judge).would_meet, 0) / a.length).toFixed(2)} · typed ${(a.reduce((n, x) => n + (x.typed.judge || x.direct.judge).would_meet, 0) / a.length).toFixed(2)} · pair typed ${a.filter((x) => x.pair_typed.winner === "typed").length} / direct ${a.filter((x) => x.pair_typed.winner === "direct").length} · pair goals ${a.filter((x) => x.pair.winner === "goals").length} / direct ${a.filter((x) => x.pair.winner === "direct").length}`); }
