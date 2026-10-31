// The agent, dry: the conversation and the plan, no tool is called. One turn = fill the sheet; if questions remain,
// ask and stop; else plan, price, and show. `runCase` drives a benchmark case with a proxy user who answers from the
// case's answer sheet. `node V2/backend/agent/agent.mjs --brief "…" [--materials a.jpg,b.png] [--tier free]` runs one
// message and prints the questions or the plan; the benchmark runner is V2/bench/run.mjs.
import { fillSheet, asked, THRESHOLD } from "./sheet.js";
import { plan } from "./plan.js";
import { jsonCall, S } from "../lib/llm.js";

const MAX_ROUNDS = 3;

// One turn: returns {sheet, questions} or {sheet, plan}.
export async function turn({ messages, materials = [], attached = null, session = [], tier = "free", goalHint = null, liberty = false }) {
  const sheet = await fillSheet({ messages, materials, attached, session, goalHint, liberty });
  if (sheet.questions.length) return { sheet, questions: sheet.questions };
  const p = await plan({ sheet, materials, session, tier });
  return { sheet, plan: p };
}

// The proxy user: answers only what is asked, from the answer sheet, in one short message; "your call" when the sheet
// has nothing for it. Never volunteers a field that was not asked.
export async function proxyUser({ answerSheet, questions, brief }) {
  const out = await jsonCall({ name: "agent-proxy-user", effort: "low", schema: S.obj({ reply: S.str }), prompt: `You are playing a USER of a media-making agent. You already wrote this request: "${brief}". The agent now asks you questions. Answer ONLY what is asked, in one short natural message, using ONLY the answer sheet below. If the sheet has no value for a question (null or missing), say "your call" for that one. Do not add anything that was not asked. Do not restate the request.
ANSWER SHEET: ${JSON.stringify(answerSheet)}
QUESTIONS:
${asked(questions)}` });
  return out.reply;
}

// Drive one benchmark case to its plan. Returns the transcript: messages, the sheet per round, the plan, the checks.
export async function runCase(c, { tier = c.tier || "free", session = [] } = {}) {
  const messages = [{ who: "user", text: c.brief }];
  const materials = c.materials || [];
  const rounds = [];
  let result = null, goalHint = null;
  for (let r = 0; r < MAX_ROUNDS; r++) {
    result = await turn({ messages, materials, session, tier, goalHint });
    rounds.push({ sheet: result.sheet, questions: result.questions || [] });
    if (!result.questions) break;
    goalHint = result.sheet.goal.value;
    const q = asked(result.questions); messages.push({ who: "agent", text: q });
    const a = await proxyUser({ answerSheet: c.answer_sheet, questions: result.questions, brief: c.brief }); messages.push({ who: "user", text: a });
  }
  const t = { id: c.id, group: c.group, brief: c.brief, materials, messages, rounds, sheet: result.sheet, plan: result.plan || null, unresolved: !!result.questions };
  t.checks = check(c, t);
  return t;
}

// The checks against the case's expectations: questions, tools, references, money. Each is {name, pass, got}.
export function check(c, t) {
  const e = c.expect || {}, out = [];
  const askedFields = t.rounds.flatMap((r) => r.questions.map((q) => q.field));
  const tools = t.plan ? t.plan.steps.map((s) => s.tool) : [];
  const add = (name, pass, got) => out.push({ name, pass: !!pass, got });
  if (e.questions) add("questions exactly " + JSON.stringify(e.questions), JSON.stringify(askedFields) === JSON.stringify(e.questions), askedFields);
  if (e.questions_max != null) add(`questions ≤ ${e.questions_max}`, askedFields.length <= e.questions_max, askedFields);
  if (e.questions_min != null) add(`questions ≥ ${e.questions_min}`, askedFields.length >= e.questions_min, askedFields);
  if (e.questions_required) for (const f of e.questions_required) add(`asks ${f}`, askedFields.includes(f), askedFields);
  if (e.questions_required_any) add(`asks one of ${e.questions_required_any.join("/")}`, e.questions_required_any.some((f) => askedFields.includes(f)), askedFields);
  if (e.questions_allowed) add(`asks only ${e.questions_allowed.join("/")}`, askedFields.every((f) => e.questions_allowed.includes(f)), askedFields);
  if (e.never_ask) for (const f of e.never_ask) add(`never asks ${f}`, !askedFields.includes(f), askedFields);
  // The answer sheet's names map onto the tree's: output → goal, aspect → platform (the aspect follows from it).
  const field = (f) => f === "output" ? { field: "goal", ...t.sheet.goal } : t.sheet.fields.find((y) => y.field === (f === "aspect" ? "platform" : f));
  if (e.sheet_stated) for (const f of e.sheet_stated) { const x = field(f); add(`${f} stated`, x && (x.source === "stated" || x.source === "session"), x?.source); }
  if (e.sheet_inferred_min) for (const f of e.sheet_inferred_min) { const x = field(f); add(`${f} inferred or stated, not asked`, x && x.source !== "unknown" && x.source !== "not_applicable" && !askedFields.includes(f === "aspect" ? "platform" : f), x?.source); }
  if (e.sheet_direction) { const x = t.sheet.fields.find((y) => y.field === "direction"); add(`direction = ${e.sheet_direction}`, x?.value === e.sheet_direction, x?.value); }
  if (e.shape) add(`shape ${e.shape}`, t.plan?.shape === e.shape, t.plan?.shape);
  if (e.nodes_min != null) add(`nodes ≥ ${e.nodes_min}`, tools.length >= e.nodes_min, tools.length);
  if (e.compose) { const by = new Set((t.plan?.steps || []).map((s) => s.produces)); add("a compose takes ≥ 2 made nodes", (t.plan?.steps || []).some((s) => s.inputs.filter((x) => by.has(x)).length >= 2), (t.plan?.steps || []).map((s) => s.inputs.filter((x) => by.has(x)).length)); }
  if (e.tools) add("tools " + e.tools.join(" → "), JSON.stringify(tools) === JSON.stringify(e.tools), tools);
  if (e.tools_any) add("tools one of " + e.tools_any.map((a) => a.join("→")).join(" | "), e.tools_any.some((a) => JSON.stringify(a) === JSON.stringify(tools.filter((x) => !(e.tools_optional || []).includes(x)))), tools);
  if (e.tools_forbidden) for (const f of e.tools_forbidden) add(`never ${f}`, !tools.includes(f), tools);
  if (e.calls_max != null) add(`calls ≤ ${e.calls_max}`, tools.length <= e.calls_max, tools.length);
  if (e.credits_max != null && t.plan) add(`estimate ≤ ${e.credits_max}`, t.plan.estimate_credits <= e.credits_max, t.plan.estimate_credits);
  if (e.refers_to) add(`refers to ${e.refers_to}`, t.sheet.refers_to === e.refers_to || (t.plan && t.plan.steps.some((s) => s.inputs.includes(e.refers_to))), t.sheet.refers_to);
  if (e.mode) { const d = t.sheet.fields.find((y) => y.field === "direction"); add(`mode ${e.mode} (not checked dry)`, true, d?.value); }
  if (e.tier_move) add("names a paid model and waits", !!(t.plan && t.plan.tier_move), t.plan?.tier_move);
  if (e.paid != null || e.paid_before_answers != null || e.paid_before_yes != null) add("nothing paid (dry)", true, 0);
  if (e.asks_for_materials === false) add("does not ask for materials", !askedFields.includes("materials"), askedFields);
  if (t.unresolved) add("resolved within 3 rounds", false, "still asking");
  return out;
}

// CLI: one message.
if (process.argv[1] && process.argv[1].endsWith("agent.mjs")) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const brief = arg("--brief"); if (!brief) { console.error('usage: node V2/backend/agent/agent.mjs --brief "…" [--materials a.jpg,b.png] [--tier free]'); process.exit(1); }
  const r = await turn({ messages: [{ who: "user", text: brief }], materials: (arg("--materials", "") || "").split(",").filter(Boolean), tier: arg("--tier", "free") });
  console.log(`goal: ${r.sheet.goal.value} (${r.sheet.goal.source}, ${r.sheet.goal.confidence})`);
  for (const f of r.sheet.fields) if (f.source !== "not_applicable") console.log(`  ${f.field}: ${f.value || "—"}  [${f.source}${f.source === "inferred" ? ` ${f.confidence}` : ""}]${f.quote ? `  "${f.quote}"` : ""}`);
  if (r.questions) { console.log(`\nQUESTIONS (threshold ${THRESHOLD}):\n${asked(r.questions)}`); }
  else { console.log(`\nPLAN: ${r.plan.current_state} → ${r.plan.desired_state}`); for (const s of r.plan.steps) console.log(`  ${s.group} / ${s.tool} [${s.model}${s.resolution ? ` ${s.resolution}` : ""}] ${s.inputs.join(", ")} → ${s.produces}  (${s.credits} cr) ${s.params.prompt_or_change}`); console.log(`  estimate ${r.plan.estimate_credits} credits${r.plan.tier_move ? `; needs beyond free: ${r.plan.tier_move.why}` : ""}${r.plan.refuse ? `; REFUSE: ${r.plan.refuse}` : ""}`); }
}
