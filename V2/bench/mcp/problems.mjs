// What went wrong in a persona sweep, in one read: faults of the harness, faults of the server, a dry run that charged, then the
// assistant's problems (loops, stuck, "you pick" not taken, no attempt, wrong values, failed verdicts, tool errors) and the
// simulated user's (out of character, invented a fact, added a requirement, volunteered a withheld fact). One line per case with
// the evidence, grouped by kind, per side and persona. Reads conversation.json + the records (run conversation.mjs first).
// Usage: node V2/bench/mcp/problems.mjs [--tag p2-dry] [--personas happy,stupid,dumper] [--md file.md] [--max 40]
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SWEEP } from "./personas.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), RES = join(HERE, "../v1/results");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg("--tag", "p2-dry"), MAX = Number(arg("--max", "40")), PERSONAS = arg("--personas") ? arg("--personas").split(",") : SWEEP, SIDES = ["old", "new"];
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").replace(/https?:\/\/\S+/g, "<link>"); return s.length > n ? s.slice(0, n) + "…" : s; };
const out = []; const say = (s = "") => { out.push(s); console.log(s); };
const lines = {};   // kind → [{side, persona, id, text}]
const add = (kind, side, persona, id, text) => (lines[kind] ||= []).push({ side, persona, id, text });
const toolErrors = {};   // side/persona → tool → message → count
let seen = 0;
for (const P of PERSONAS) for (const side of SIDES) {
  const dir = join(RES, `${TAG}-${side}-${P}`), f = join(dir, "conversation.json"); if (!existsSync(f)) { say(`(no conversation.json for ${side}/${P})`); continue; }
  const c = JSON.parse(readFileSync(f, "utf8")); seen += c.items.length;
  const recs = Object.fromEntries(readdirSync(dir).filter((x) => /^[A-Z]+\d\d[a-z]?\.json$/.test(x)).map((x) => { const r = JSON.parse(readFileSync(join(dir, x), "utf8")); return [r.id, r]; }));
  for (const m of c.items) {
    const r = recs[m.id] || {}, b = m.basic || {}, u = m.user_check || {}, j = m.judge || {};
    if (m.error) add("FAULT · the conversation ended on an error (harness or OpenAI)", side, P, m.id, cut(m.error, 220));
    if (m.infra) add("FAULT · server error inside a tool call", side, P, m.id, cut(m.infra, 220));
    if (b.no_spend_in_dry === false) add("DRY RUN CHARGED CREDITS (must never happen)", side, P, m.id, `${r.spent} credits`);
    if (b.no_loop === false) add("ASSISTANT · asked the same question three times", side, P, m.id, (b.repeated_questions || []).join(" ; "));
    if (b.delegation_ignored > 0) add("ASSISTANT · the user said “you pick”, the assistant asked the same question again", side, P, m.id, `${b.delegation_ignored}×; ${(b.repeated_questions || []).join(" ; ")}`);
    if (b.not_stuck === false) add("ASSISTANT · still asking after the user gave up", side, P, m.id, cut(r.turns?.at(-1)?.agent, 200));
    if (b.attempted_or_planned === false) add("ASSISTANT · no create call tried and no plan made", side, P, m.id, `final: ${m.final_kind}; ${cut(r.turns?.at(-1)?.agent, 180)}`);
    if (b.answered_every_message === false) add("ASSISTANT · a message got no answer", side, P, m.id, "");
    for (const [k, v] of Object.entries(m.values || {})) if (/^wrong/.test(v)) add(`ASSISTANT · the attempted call has the wrong ${k}`, side, P, m.id, `${v}; wanted ${JSON.stringify(r.item?.spec?.[k === "words" ? "exact_text" : k === "audio" ? "audio" : k === "seconds" ? "seconds" : "aspect"])}`);
    if (j.verdict === "fail") add("ASSISTANT · conversation judged FAIL", side, P, m.id, cut(j.note, 260));
    if (j.fabricated === "yes") add("ASSISTANT · stated something that is in no source (judge)", side, P, m.id, cut(j.note, 260));
    if (u.in_character === "no") add("SIMULATED USER · out of character", side, P, m.id, cut(u.note, 240));
    if (u.invented?.length) add("SIMULATED USER · invented a fact not in its bank", side, P, m.id, cut(u.invented.join(" | "), 240));
    if (u.added_requirements?.length) add("SIMULATED USER · added a requirement", side, P, m.id, cut(u.added_requirements.join(" | "), 240));
    if (u.leaked_early?.length) add("SIMULATED USER · volunteered a fact the opening left out", side, P, m.id, cut(u.leaked_early.join(" | "), 240));
    for (const t of r.turns || []) for (const call of t.calls || []) if (call.error) { const k = `${side}/${P}`; ((toolErrors[k] ||= {})[call.name] ||= {})[cut(call.error, 140)] = (((toolErrors[k] ||= {})[call.name] ||= {})[cut(call.error, 140)] || 0) + 1; }
  }
}
say(`# What went wrong · ${TAG} · ${seen} conversations\n`);
const order = Object.keys(lines).sort((a, b) => (/^FAULT|^DRY/.test(a) ? 0 : /^ASSISTANT/.test(a) ? 1 : 2) - (/^FAULT|^DRY/.test(b) ? 0 : /^ASSISTANT/.test(b) ? 1 : 2) || a.localeCompare(b));
if (!order.length) say("Nothing flagged.");
for (const k of order) {
  const L = lines[k], by = {}; for (const x of L) by[`${x.side}/${x.persona}`] = (by[`${x.side}/${x.persona}`] || 0) + 1;
  say(`## ${k} — ${L.length}  (${Object.entries(by).map(([a, n]) => `${a} ${n}`).join(", ")})`);
  for (const x of L.slice(0, MAX)) say(`- ${x.side}/${x.persona} ${x.id}${x.text ? ` — ${x.text}` : ""}`);
  if (L.length > MAX) say(`- … ${L.length - MAX} more (--max ${L.length} to list all)`);
  say();
}
const ek = Object.keys(toolErrors);
if (ek.length) { say("## Tool calls that returned an error (by side/persona, tool, message)"); for (const k of ek) for (const [tool, msgs] of Object.entries(toolErrors[k])) for (const [msg, n] of Object.entries(msgs).sort((a, b) => b[1] - a[1]).slice(0, 5)) say(`- ${k} ${tool} ×${n}: ${msg}`); say(); }
if (arg("--md")) writeFileSync(arg("--md"), out.join("\n"));
