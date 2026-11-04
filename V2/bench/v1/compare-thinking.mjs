// Where does a failure come from: how hard the agent thinks, or something else? For each still-failing item, four plans
// for the same final sheet: the plan that ran; the current planner at low effort (as shipped); the same planner at high
// effort; and an expert plan (Claude, maximum effort, from think/out/<id>.json, written after looking at the files). One
// blind judge scores each on the same rubric (plan-ab.mjs). Nothing runs; no credits.
// Usage: node V2/bench/v1/compare-thinking.mjs --think <dir with out/> [--run latest] [--plans-only]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { plan, price } from "../../backend/agent/plan.js";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { catalogueText } from "../../backend/agent/catalogue.js";
const HERE = dirname(fileURLToPath(import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = join(HERE, "results", arg("--run", "latest")), THINK = arg("--think"), PLANS_ONLY = process.argv.includes("--plans-only");
const fail = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8")).filter((g) => !g.pass);
const show = (p) => !p ? "(no plan)" : p.refuse ? `REFUSE: ${p.refuse}` : !p.steps?.length ? `NO STEPS; says: ${p.say || ""}${p.questions_left?.length ? `; asks: ${p.questions_left.join(" / ")}` : ""}` : p.steps.map((s, i) => `${i + 1}. ${s.tool}${s.model ? ` (${s.model})` : ""} [${(s.inputs || []).join(", ")}] → ${s.produces}: ${s.params?.prompt_or_change || ""}${s.params?.extra ? ` | ${s.params.extra}` : ""}${s.params?.aspect ? ` | ${s.params.aspect}` : ""}${s.params?.seconds ? ` | ${s.params.seconds}s` : ""}${s.params?.lettering ? " | lettering" : ""}${s.params?.fidelity ? " | fidelity" : ""}`).join("\n");
const SCORE = S.obj({ chain_sound: S.bool, best_tools: S.bool, inputs_sound: S.bool, must_haves_covered: S.int, would_meet: S.int, issues: S.str });
const ctx = (r) => `REQUEST (all turns): ${r.turns.map((t, i) => `[${i + 1}] ${t.text}${t.materials?.length ? ` [attached: ${t.materials.join(", ")}]` : ""}${(t.dialog || []).map((d) => ` / asked: ${d.agent} / answered: ${d.user}`).join("")}`).join("\n")}
MUST-HAVES (${r.item.must_haves.length}): ${r.item.must_haves.map((m, i) => `${i + 1}) ${m}`).join(" ")}
EXPECTED: asks ${r.item.expect?.asks || "-"}; refuse ${!!r.item.expect?.refuse}; beyond free ${r.item.expect?.beyond_free || "no"}
${readFileSync(join(THINK, "system.md"), "utf8").split("## The planner")[0]}
TOOLS: ${catalogueText()}`;
const judge = (r, p) => jsonCall({ name: "bench-v1-plan-judge-3", effort: "medium", schema: SCORE, prompt: `Review an AI media agent's PLAN (nothing has run) for this request, as a careful producer who knows these free models and this harness.\n${ctx(r)}\nTHE PLAN:\n${show(p)}\nGive: chain_sound, best_tools, inputs_sound, must_haves_covered (how many the plan would deliver if the models do their job), would_meet (1-5), issues (one or two lines).` });
const rows = [], queue = [...fail]; let done = 0;
await Promise.all(Array.from({ length: 6 }, async () => { for (let g; (g = queue.shift()); ) { try {
  const r = JSON.parse(readFileSync(join(DIR, `${g.id}.json`), "utf8")), last = r.turns.at(-1), sheet = last.sheet;
  const materials = [...new Set(r.turns.flatMap((t) => t.materials || []))], session = r.turns.slice(0, -1).flatMap((t) => (t.plan?.steps || []).map((s) => ({ label: s.produces, kind: "asset" })));
  const P = { ran: last.plan || null };
  if (sheet) { process.env.PLAN_EFFORT = "low"; P.low = await plan({ sheet, materials, session, tier: "free" }); process.env.PLAN_EFFORT = "high"; P.high = await plan({ sheet, materials, session, tier: "free" }); }
  const ex = THINK && existsSync(join(THINK, "out", `${g.id}.json`)) ? JSON.parse(readFileSync(join(THINK, "out", `${g.id}.json`), "utf8")) : null;
  if (ex?.your_plan) { const yp = ex.your_plan; P.expert = price({ shape: "tree", say: yp.say || "", refuse: yp.refuse || "", questions_left: yp.questions_left || [], steps: (yp.steps || []).map((s) => ({ ...s, inputs: s.inputs || [], params: { seconds: 0, aspect: "", resolution: "", prompt_or_change: "", extra: "", lettering: false, fidelity: false, ...(s.params || {}) } })) }, "free"); }
  const J = {}; if (!PLANS_ONLY) for (const [k, p] of Object.entries(P)) if (p) J[k] = await judge(r, p);
  rows.push({ id: g.id, group: g.group, score: g.score, expert: ex ? { root_cause: ex.root_cause, contributing: ex.contributing, grader_right: ex.grader_right, agent_vs_you: ex.agent_vs_you, fix: ex.fix, would_pass: ex.would_pass } : null, plans: Object.fromEntries(Object.entries(P).map(([k, p]) => [k, p ? { tools: (p.steps || []).map((s) => `${s.tool}${s.model && s.model !== "code" ? `(${s.model})` : ""}`), text: show(p), credits: p.estimate_credits } : null])), judge: J });
} catch (e) { console.error(g.id, String(e.message || e).slice(0, 200)); } if (++done % 10 === 0) console.log(`${done}/${fail.length}`); } }));
rows.sort((a, b) => a.id.localeCompare(b.id)); writeFileSync(join(DIR, "compare-thinking.json"), JSON.stringify(rows, null, 2));
if (!PLANS_ONLY) { const keys = ["ran", "low", "high", "expert"]; for (const k of keys) { const a = rows.filter((x) => x.judge[k]); if (!a.length) continue; const f = (fn) => Math.round((100 * a.filter(fn).length) / a.length); console.log(`${k.padEnd(7)} n=${a.length} · chain sound ${f((x) => x.judge[k].chain_sound)}% · best tools ${f((x) => x.judge[k].best_tools)}% · inputs ${f((x) => x.judge[k].inputs_sound)}% · would-meet ${(a.reduce((n, x) => n + x.judge[k].would_meet, 0) / a.length).toFixed(2)} · credits ${Math.round(a.reduce((n, x) => n + (x.plans[k]?.credits || 0), 0) / a.length)}/item`); }
  const rc = {}; for (const x of rows) if (x.expert) rc[x.expert.root_cause] = (rc[x.expert.root_cause] || 0) + 1; console.log("expert root causes:", JSON.stringify(rc)); }
