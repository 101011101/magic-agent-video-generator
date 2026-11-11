// One table over a persona sweep: each persona on both sides, from the folders' conversation.json (conversation.mjs output).
// Usage: node V2/bench/mcp/persona-summary.mjs [--tag p2-dry] [--personas happy,stupid,dumper] [--json | --csv file.csv]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SWEEP, REPLY_ITEMS } from "./personas.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), RES = join(HERE, "../v1/results");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg("--tag", "p2-dry"), PERSONAS = (arg("--personas", "") || "").split(",").filter(Boolean).length ? arg("--personas").split(",") : SWEEP, SIDES = ["old", "new"];
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "-");
const rows = [];
for (const P of PERSONAS) for (const side of SIDES) {
  const f = join(RES, `${TAG}-${side}-${P}`, "conversation.json"); if (!existsSync(f)) { rows.push({ persona: P, side, missing: true }); continue; }
  const c = JSON.parse(readFileSync(f, "utf8")), items = c.items.filter((m) => !m.error), judged = items.filter((m) => m.judge);
  const v = c.totals.values || {}, vAll = (v.correct || 0) + (v.wrong || 0) + (v.not_settled || 0), B = c.totals.basic || {}, U = c.totals.user || {};
  const noAttempt = items.filter((m) => !REPLY_ITEMS.has(m.id) && !(m.attempted || []).length && !(m.planned || []).length).length;
  const W = c.totals.withheld || {}, wAll = Object.values(W).reduce((a, b) => a + b, 0) - (W["n/a"] || 0);
  rows.push({
    persona: P, side, items: items.length, lost: c.totals.errors || 0, infra: c.totals.infra || 0,
    questions: c.totals.questions, asked_items: c.totals.items_that_asked, gave_up: c.totals.gave_up, stuck: B.stuck ?? "-", loops: B.loops ?? "-", put_twice: B.put_twice ?? "-", delegation_ignored: B.delegation_ignored ?? "-", no_call: noAttempt, many_q: B.many_questions_at_once ?? "-", spent_in_dry: B.spent_in_dry ?? "-",
    values_ok: pct(v.correct || 0, vAll), values_wrong: pct(v.wrong || 0, vAll), values_unsettled: pct(v.not_settled || 0, vAll),
    pass: pct(c.totals.verdicts?.pass || 0, judged.length), borderline: pct(c.totals.verdicts?.borderline || 0, judged.length), fail: pct(c.totals.verdicts?.fail || 0, judged.length),
    fabricated: pct(c.totals.fabricated || 0, judged.length),
    persona_ok: pct(judged.filter((m) => m.judge.handled_persona === "yes").length, judged.filter((m) => m.judge.handled_persona !== "n/a").length),
    withheld_asked: pct(W.asked || 0, wAll), withheld_guessed_right: pct(W.guessed_right || 0, wAll), withheld_guessed_wrong: pct(W.guessed_wrong || 0, wAll), withheld_missing: pct(W.missing || 0, wAll),
    user_in_character: pct(U.in_character || 0, U.judged || 0), user_invented: U.invented ?? "-", user_added_req: U.added_requirements ?? "-", user_leaked: U.leaked_early ?? "-",
    judged: judged.length,
  });
}
// --csv <file>: one row per conversation across the sweep, for sorting and filtering
if (arg("--csv")) {
  const esc = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ["tag", "side", "persona", "id", "group", "title", "final_kind", "questions", "approvals_asked", "gave_up", "stuck", "loop", "delegation_ignored", "no_call", "max_q_in_message", "values_aspect", "values_seconds", "values_audio", "values_words", "verdict", "handled_persona", "fabricated", "user_in_character", "user_invented", "user_added_req", "user_leaked", "seconds", "hops", "input_tokens", "output_tokens", "reasoning_tokens", "tools", "error", "infra"], lines = [head.join(",")];
  for (const P of PERSONAS) for (const side of SIDES) { const f = join(RES, `${TAG}-${side}-${P}`, "conversation.json"); if (!existsSync(f)) continue;
    for (const m of JSON.parse(readFileSync(f, "utf8")).items) lines.push([TAG, side, P, m.id, m.group, m.title, m.final_kind, m.questions, m.approvals_asked, m.gave_up ? 1 : 0, m.basic?.not_stuck === false ? 1 : 0, m.basic && !m.basic.no_loop ? 1 : 0, m.basic?.delegation_ignored, m.basic?.attempted_or_planned === false ? 1 : 0, m.basic?.questions_per_message_max, m.values?.aspect, m.values?.seconds, m.values?.audio, m.values?.words, m.judge?.verdict, m.judge?.handled_persona, m.judge?.fabricated, m.user_check?.in_character, m.user_check?.invented?.length, m.user_check?.added_requirements?.length, m.user_check?.leaked_early?.length, m.seconds, m.usage?.responses, m.usage?.input, m.usage?.output, m.usage?.reasoning, Object.entries(m.tool_counts || {}).map(([k, v]) => `${k}×${v}`).join(" "), m.error, m.infra].map(esc).join(",")); }
  writeFileSync(arg("--csv"), lines.join("\n")); console.log(`${lines.length - 1} conversations → ${arg("--csv")}`); process.exit(0);
}
if (process.argv.includes("--json")) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
const COLS = ["persona", "side", "items", "lost", "infra", "questions", "asked_items", "gave_up", "stuck", "loops", "put_twice", "delegation_ignored", "no_call", "many_q", "spent_in_dry", "values_ok", "values_wrong", "values_unsettled", "pass", "borderline", "fail", "fabricated", "persona_ok", "withheld_asked", "withheld_guessed_right", "withheld_guessed_wrong", "withheld_missing", "user_in_character", "user_invented", "user_added_req", "user_leaked"];
const SHORT = { items: "n", questions: "q", asked_items: "asked", delegation_ignored: "deleg-ign", put_twice: "asked 2x", no_call: "no-call", many_q: "3+q", spent_in_dry: "spent", values_ok: "val ok", values_wrong: "val wrong", values_unsettled: "val ?", persona_ok: "persona", withheld_asked: "w asked", withheld_guessed_right: "w right", withheld_guessed_wrong: "w wrong", withheld_missing: "w miss", user_in_character: "user ok", user_invented: "u-inv", user_added_req: "u-req", user_leaked: "u-leak" };
const width = Object.fromEntries(COLS.map((k) => [k, Math.max((SHORT[k] || k).length, ...rows.map((r) => String(r[k] ?? "").length))]));
console.log(COLS.map((k) => (SHORT[k] || k).padEnd(width[k])).join("  "));
for (const r of rows) console.log(r.missing ? `${r.persona.padEnd(width.persona)}  ${r.side.padEnd(width.side)}  (no conversation.json)` : COLS.map((k) => String(r[k] ?? "").padEnd(width[k])).join("  "));
console.log(`\n${TAG}: dry sweep. lost = conversations that ended on a fault (OpenAI); infra = a server fault inside a tool call; stuck = still asking after the user gave up; loops = the same question three times; asked 2x = items where some question was put twice (often the unanswered half of a list); deleg-ign = "you pick" answered with the same question; no-call = no create call tried and no plan made (reply items excluded); 3+q = a message with three questions or more; spent = a dry run that charged credits (must be 0); "val" = shape, length, sound and words the attempted call carried vs the spec; "w" = the facts the opening withheld (stupid only); user ok = the simulated user stayed in character; u-inv / u-req / u-leak = items where the simulated user invented a fact, added a requirement, or volunteered a withheld fact.`);
