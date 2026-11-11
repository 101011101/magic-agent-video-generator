// The conversation layer of a results folder written by run.mjs (dry or real): what the agent asked, how the user (persona)
// answered, the create call it attempted against the item's spec, and an LLM reading of the transcript against the persona.
// Writes <id>.conv.json and conversation.json into the folder; prints one line per item and the totals.
// Usage: node V2/bench/mcp/conversation.mjs --dir V2/bench/v1/results/<dir> [--only A01a,B07a] [--no-judge]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { PERSONAS, REPLY_ITEMS } from "./personas.mjs";
import { STILLS, VIDEOS } from "../../backend/lib/models.js";
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = arg("--dir"); if (!DIR) throw new Error("--dir <results folder>");
const only = (arg("--only", "") || "").split(",").filter(Boolean), JUDGE = !process.argv.includes("--no-judge");
// The tools the assistant was offered on this side (run.mjs writes tools.json): the judge needs them to tell a true "my tools cannot do that"
// from an invented one (the first sweep's judge called every such statement unsupported because it could not see the tool list).
const toolsFile = join(DIR, "tools.json");
const OFFERED_TOOLS = existsSync(toolsFile) ? (() => { const t = JSON.parse(readFileSync(toolsFile, "utf8")); return (t.tools || []).filter((x) => (t.offered || []).includes(x.name)).map((x) => `${x.name}: ${String(x.description || "").replace(/\s+/g, " ").slice(0, 150)}`); })() : [];
const parse = (s) => { try { return typeof s === "string" ? JSON.parse(s) : s || {}; } catch { return {}; } };
const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const RATIOS = ["16:9", "9:16", "1:1", "4:5"];

// every create call the assistant tried (the approvals carry the gate's decision) and every planning call it made
const attempted = (rec) => (rec.turns || []).flatMap((t, ti) => (t.approvals || []).map((a) => ({ turn: ti, name: a.name, args: a.args || {}, approve: a.approve, reason: a.reason })));
const plans = (rec) => (rec.turns || []).flatMap((t, ti) => (t.calls || []).filter((c) => /^plan_/.test(c.name)).map((c) => ({ turn: ti, name: c.name, args: parse(c.arguments), output: c.output })));
// the other free calls (face detection, last frame, joins...), the last result of each; the workflow guide is documentation
const otherCalls = (rec) => { const by = new Map(); for (const c of (rec.turns || []).flatMap((t) => t.calls || [])) if (!/^plan_|^get_workflow_guide$/.test(c.name)) by.set(c.name, c); return [...by.values()].map((c) => ({ name: c.name, output: c.output, error: c.error })); };
const cut = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n)} …[cut: ${s.length} chars in all]` : s; };
// What the assistant may state as fact: the free plan's price list (models.js) and the limits in the tools' own schemas
// (read from the local build's tools/list on 2026-11-09). The judge called every unverified price "fabricated" without this.
const FREE_STILL_COSTS = Object.entries(STILLS).filter(([, m]) => m.plan === "free").map(([n, m]) => `${n} ${Object.entries(m.cost).map(([r, c]) => `${c} at ${r}`).join(", ")}`).join("; ");
const FREE_VIDEO_RATES = Object.entries(VIDEOS).filter(([, m]) => m.plan === "free").map(([n, m]) => `${n} ${m.rate["480p"]} per second at 480p`).join(", ");
const FACTS = `KNOWN FACTS the assistant may state (the tools' own schemas and the free plan's price list; stating them is NOT fabrication): the free plan makes pictures at 640px and video at 480p, paid models and higher resolutions are refused; free picture models and their credits: ${FREE_STILL_COSTS}; free video models: ${FREE_VIDEO_RATES}; music 1 credit per second, 15 to 300 seconds (a 10-second track is impossible, 15 is the shortest); 2x upscale 25 credits (4x is paid only); face swap in a photo 10; meme 10; background removal 5; headshot 50; generate_image makes only 1:1, 16:9 or 9:16 (4:5 and other shapes only through edit_image); a video runs 1 to 60 seconds depending on the model. A limit or price that is in neither this list nor a tool's reply (a seconds cap on "presenter" or "talking" videos, a licensing or commercial-use rule, a feature said to be unavailable) is fabrication when stated as fact.`;
// what a planning call was given and what it answered: a production's content lives in the plan's story, not in the clip call
const planDigest = (p) => {
  const a = p.args || {}, o = parse(p.output), isObj = o && typeof o === "object" && !Array.isArray(o);
  if (p.name === "plan_video_production") { const st = a.story || {}; return `plan_video_production(story: aspect ${st.aspect}, clips' own sound ${st.audio}, music ${st.music ? `"${cut(st.music, 80)}"` : "none"}, captions ${st.captions}; beats: ${(st.beats || []).map((b) => `${b.seconds}s "${cut(b.text, 160)}"${b.says?.length ? ` narrator says "${cut(b.says.join(" / "), 120)}"` : ""}${b.spoken?.length ? ` spoken "${cut(b.spoken.join(" / "), 120)}"` : ""}`).join(" | ")}) → ${isObj && o.ok ? `plan ok: ${o.seconds} s, ${o.credits} credits, ${(o.clips || []).length} clips` : cut(p.output, 200)}`; }
  if (p.name === "plan_request") return `plan_request(tool ${a.tool}; rows ${(a.params || []).map((r) => `${r.name}=${JSON.stringify(r.value)}/${r.source}`).join(", ")}) → ${isObj && "ready" in o ? (o.ready ? "ready" : `the tool asked for: ${(o.questions || []).map((q) => q.param).join(", ")}`) : cut(p.output, 200)}`;
  return `${p.name} → ${cut(p.output, 200)}`;
};

// the values the user wanted (the item's spec) against the values the attempted calls carry
const wanted = (s) => [...(RATIOS.includes(s.aspect) ? ["aspect"] : []), ...(s.seconds ? ["seconds"] : []), ...(s.kind === "video" && ["required", "none"].includes(s.audio) ? ["audio"] : []), ...(s.exact_text?.length ? ["words"] : [])];
function values(rec) {
  // after the changer's follow-up the spec carries the change, so only the follow-up turn's calls are read against it. In a dry
  // run the assistant has been told its credits are insufficient and attempts nothing after the follow-up, so there the calls
  // before the follow-up are read against the spec as it was (the judge's rerouted_on_change reads the follow-up reply itself).
  const fu = rec.change?.sent ? (rec.turns || []).findIndex((t) => t.follow_up) : -1, pre = fu >= 0 && rec.dry;
  let s = rec.item?.spec || {};
  if (pre) { const c = rec.change; s = { ...s, [c.field === "text" ? "exact_text" : c.field]: c.field === "text" ? s.exact_text.map((t) => (t === c.to ? c.from : t)) : c.from }; }
  const calls = attempted(rec).filter((c) => fu < 0 || (pre ? c.turn < fu : c.turn === fu)), pl = plans(rec).filter((p) => fu < 0 || (pre ? p.turn < fu : p.turn === fu)), out = {};
  if (!calls.length && !pl.length) return Object.fromEntries(wanted(s).map((k) => [k, "not settled"]));
  const all = [...calls.map((c) => c.args), ...pl.map((p) => p.args)];
  const pick = (f) => { for (const a of all) { const v = f(a); if (v != null) return v; } return null; };
  if (RATIOS.includes(s.aspect)) { const got = pick((a) => a.aspect_ratio ?? a.aspect ?? a.story?.aspect ?? a.orientation ?? null); out.aspect = got == null || got === "auto" ? "not settled" : got === s.aspect ? "correct" : `wrong (${got})`; }
  if (s.seconds) { const got = pick((a) => (a.end_seconds != null ? Number(a.end_seconds) - Number(a.start_seconds || 0) : a.duration ?? a.seconds ?? (Array.isArray(a.story?.beats) ? a.story.beats.reduce((x, b) => x + Number(b.seconds || b.duration || 0), 0) || null : null))); out.seconds = got == null ? "not settled" : Math.abs(got - s.seconds) <= Math.max(1, s.seconds * 0.2) ? "correct" : `wrong (${got})`; }
  // a production story's `audio` is the clips' own sound; music under the film, a narrator (says) or spoken lines are sound too
  if (s.kind === "video" && ["required", "none"].includes(s.audio)) { const storySound = (st) => !!(st.audio || st.music || (st.beats || []).some((b) => b.says?.length || b.spoken?.length)); const got = pick((a) => a.audio ?? (a.story ? storySound(a.story) : null)), soundCall = calls.some((c) => /generate_music|create_production_sound/.test(c.name)), want = s.audio === "required"; const has = got == null ? (soundCall ? true : null) : !!got || soundCall; out.audio = has == null ? "not settled" : has === want ? "correct" : want ? "wrong (silent)" : `wrong (${got == null ? "music added" : got})`; }
  // the words are read from the call's text-bearing arguments; a call with none (subtitles, where the server transcribes the clip) settles nothing
  if (s.exact_text?.length) { const textBearing = all.some((a) => a.prompt || a.style?.prompt || a.script || a.text || a.caption || a.title || a.story); const hay = squash(JSON.stringify(all)); const miss = s.exact_text.filter((w) => !hay.includes(squash(w))); out.words = !textBearing ? "not settled" : miss.length ? `wrong (missing: ${miss.join(" | ")})` : "correct"; }
  return out;
}

// ---- the basic checks, no judge: what a user would call an obvious fail. Each is true/false with the evidence beside it.
const norm = (s) => String(s ?? "").toLowerCase().replace(/\]\(https?:[^)]*\)/g, "]").replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9? ]/g, " ").replace(/\s+/g, " ").trim();
const questionsIn = (text) => String(text ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.endsWith("?") || s.endsWith("?**") || s.endsWith("?*"));
const GIVES_UP_ON_ASKING = /\b(you pick|your call|you choose|you decide|up to you|whatever|idk|i don'?t care|don'?t care|surprise me|just make it|go ahead|stop asking)\b/i;
function basic(rec, m) {
  const turns = rec.turns || [], dialog = turns.flatMap((t) => t.dialog || []), spent = rec.spent || 0;
  const agentMsgs = turns.flatMap((t) => [...(t.dialog || []).map((d) => d.agent), t.agent]).filter(Boolean);
  const qs = agentMsgs.flatMap(questionsIn).map(norm), counts = {}; for (const q of qs) counts[q] = (counts[q] || 0) + 1;
  const repeated = Object.entries(counts).filter(([, n]) => n >= 2).map(([q, n]) => `${n}× "${q.slice(0, 100)}"`);
  // a question put again after the user had already said "you pick" / "your call" / "idk": the delegation was not taken
  const ex = turns.flatMap((t) => [...(t.dialog || []), { agent: t.agent, user: null }]);   // every assistant message with the user's answer to it (the last has none)
  let ignored = 0; for (let i = 0; i < ex.length - 1; i++) if (ex[i].user && GIVES_UP_ON_ASKING.test(ex[i].user)) { const before = new Set(questionsIn(ex[i].agent).map(norm)); if (questionsIn(ex[i + 1].agent).map(norm).some((q) => before.has(q))) ignored++; }
  const replyItem = REPLY_ITEMS.has(rec.id) || ["none", "text"].includes(rec.item?.spec?.kind) || !!rec.item?.expect?.refuse;
  const stuck = !!rec.gave_up && ["question", "approval"].includes(turns.at(-1)?.kind);
  return {
    ran_to_the_end: !rec.error,                                                              // the conversation finished (no fault of the harness or the server)
    answered_every_message: turns.every((t) => !!t.agent && t.agent.trim().length > 0),       // the assistant said something to each message
    attempted_or_planned: replyItem ? "n/a" : m.attempted.length > 0 || m.planned.length > 0, // a create call was tried, or a plan was made (the reply is the result for reply items)
    no_loop: !Object.values(counts).some((n) => n >= 3), repeated_questions: repeated, put_twice_or_more: repeated.length,   // a loop = the same question three times; a question put twice is usually the unanswered half of a list, so it is only counted
    took_the_delegation: ignored === 0, delegation_ignored: ignored,                         // "you pick" was followed by the same question again
    not_stuck: !stuck,                                                                        // still asking after the user gave up
    questions_per_message_max: Math.max(0, ...agentMsgs.map((t) => questionsIn(t).length)),  // many questions at once overwhelm the lost user
    no_spend_in_dry: rec.dry ? spent === 0 : "n/a",                                           // a dry run must charge nothing
    no_server_fault: !m.infra,
  };
}

const dialogText = (rec) => (rec.turns || []).map((t, k) => `USER (message ${k + 1}${t.follow_up ? ", the follow-up" : ""}): ${t.text}${t.materials?.length ? ` [attached ${t.materials.join(", ")}]` : ""}${(t.dialog || []).map((d) => `\nAGENT: ${cut(d.agent, 2500)}\nUSER${d.gave_up ? " (gives up)" : ""}: ${d.user}`).join("")}\nAGENT (final, ${t.kind}): ${cut(t.agent, 2500)}`).join("\n\n");
// The transcript for the check on the simulated user: lines that are not the simulated user's own writing (the item's later scripted
// messages, the fixed approval line, the nudge, the give-up line) are marked, so they are not judged as if the model had written them.
const userCheckText = (rec, P) => (rec.turns || []).map((t, k) => `USER (message ${k + 1}${k === 0 ? ", the opening" : t.follow_up ? ", the follow-up" : ", scripted by the test"}${k > 0 ? "; NOT written by the simulated user, do not judge it" : ""}): ${t.text}${(t.dialog || []).map((d) => `\nAGENT: ${cut(d.agent, 2000)}\nUSER${d.gave_up ? " (the fixed give-up line; NOT judged)" : d.nudge ? " (a fixed nudge; NOT judged)" : d.asked?.[0] === "approval" && typeof P.approval === "string" && d.user === P.approval ? " (the fixed approval line; NOT judged)" : ""}: ${d.user}`).join("")}\nAGENT (final, ${t.kind}): ${cut(t.agent, 2000)}`).join("\n\n");
const keyArgs = (a) => { const o = {}; for (const k of ["model", "resolution", "aspect_ratio", "end_seconds", "start_seconds", "duration", "audio", "image_count", "clip"]) if (a[k] != null) o[k] = a[k]; if (a.story) o.story = { aspect: a.story.aspect, audio: a.story.audio, beats: Array.isArray(a.story.beats) ? a.story.beats.length : undefined }; if (a.production) o.production = "(the plan's token: the clip's content is in the plan's story)"; const p = a.prompt || a.style?.prompt || a.script; if (p) o.prompt = cut(p, 1500); return JSON.stringify(o); };

async function score(rec) {
  const it = rec.item || {}, P = PERSONAS[rec.persona || "happy"] || PERSONAS.happy, turns = rec.turns || [];
  const dialog = turns.flatMap((t) => t.dialog || []);
  const m = {
    id: rec.id, persona: rec.persona || "happy", dry: !!rec.dry, error: rec.error || null,
    questions: dialog.filter((d) => d.asked?.[0] === "question").length, approvals_asked: dialog.filter((d) => d.asked?.[0] === "approval").length, gave_up: !!rec.gave_up,
    final_kind: turns.at(-1)?.kind || (rec.error ? "error" : "?"), planned: plans(rec).map((p) => p.name), plan_digest: plans(rec).map(planDigest),
    free_calls: otherCalls(rec).map((c) => `${c.name} → ${c.error ? `ERROR ${cut(c.error, 160)}` : cut(c.output, 200)}`),
    attempted: attempted(rec).map((c) => `${c.name} ${keyArgs(c.args)}${c.approve ? " → approved" : ` → REFUSED by the account gate, which told the assistant: "${c.reason}"`}`), values: values(rec),
    change: rec.change ? { field: rec.change.field, from: rec.change.from, to: rec.change.to, sent: rec.change.sent, skipped: rec.change.skipped } : null,
  };
  // a server or protocol fault (a 401 from the hosted MCP, a 5xx) is the infrastructure's, not the agent's: flagged, not judged
  const infra = turns.flatMap((t) => t.calls || []).find((c) => /mcp_protocol_error|"code":\s*(401|403|5\d\d)\b/.test(String(c.error || ""))); m.infra = infra ? `${infra.name}: ${String(infra.error).slice(0, 160)}` : null;
  m.basic = basic(rec, m);
  m.seconds = rec.seconds ?? null; m.usage = rec.usage || null; m.group = rec.item?.group || null; m.title = rec.item?.title || null;
  m.tool_counts = (rec.turns || []).flatMap((t) => t.calls || []).reduce((a, c) => { a[c.name] = (a[c.name] || 0) + 1; return a; }, {});
  // the simulated user, checked the way the assistant is: did it stay in character, and did it keep to its knowledge bank?
  if (JUDGE && !rec.error && (rec.turns || []).length) {
    const withheld = rec.opening?.withheld || [], extras = rec.opening?.extras || [];
    m.user_check = await jsonCall({ name: "bench-mcp-user-check-v1", effort: "medium", schema: S.obj({
      in_character: S.enum(["yes", "partly", "no"]), answered_what_asked: S.enum(["yes", "partly", "no", "n/a"]),
      invented: S.arr(S.str), added_requirements: S.arr(S.str), leaked_early: S.arr(S.str), note: S.str }),
      prompt: `Check a SIMULATED USER in a benchmark. The user is played by a model from a rule and a knowledge bank. Judge the USER's lines only, not the assistant.
THE RULE FOR THIS USER (${P.label}): ${P.about}
Opening rule: ${P.opening || "writes the request as given"}
Reply rule: ${P.reply}
THE KNOWLEDGE BANK, the only facts the user has: ${JSON.stringify({ request_in_full: it.turns?.[0]?.text, ...(it.answer_sheet || {}) })}
${rec.opening?.as_written && P.opening ? "NOTE: this item's opening is the request AS WRITTEN under every user, on purpose (its test is the reply itself), so do not judge the opening against the opening rule above; judge the replies only.\n" : ""}${withheld.length ? `FACTS THE OPENING LEFT OUT ON PURPOSE (the user may state them only when asked): ${withheld.join(" | ")}` : ""}${extras.length ? `\nSENTENCES THE OPENING ADDED ON PURPOSE (harmless extras): ${extras.join(" | ")}` : ""}
TRANSCRIPT (the first USER line is the opening; judge only the lines the simulated user wrote):
${userCheckText(rec, P)}

Return: in_character (did every USER line fit the rule: the lost user used no technical word and did not volunteer facts; the oversharing user gave extras; the cooperative user answered briefly and only what was asked), answered_what_asked (did each reply answer the question put to it; n/a if there was no reply), invented (facts the user stated that are in neither the bank, the opening, nor the assistant's own suggestion the user agreed to; empty if none), added_requirements (new constraints on the result that are not in the bank; backstory that changes nothing is not one; empty if none), leaked_early (facts the opening left out on purpose that the user volunteered before being asked; empty if none), note (one sentence).` });
  }
  // persona lines measured directly: the tightwad was told a cost before the first approved spend; the impatient was asked more than once
  if (m.persona === "tightwad") { const firstOk = turns.findIndex((t) => (t.approvals || []).some((a) => a.approve)); const texts = turns.slice(0, firstOk < 0 ? turns.length : firstOk + 1).flatMap((t) => [...(t.dialog || []).map((d) => d.agent), t.agent]).join("\n"); m.cost_named = /\b\d+\s*credits?\b/i.test(texts); }
  if (m.persona === "impatient") m.kept_asking = m.questions > 1;
  if (JUDGE && !rec.error && !m.infra) {
    const withheld = rec.opening?.withheld || [];
    m.judge = await jsonCall({ name: "bench-mcp-conv-v1", effort: "medium", schema: S.obj({
      asked_only_missing: S.enum(["yes", "partly", "no", "n/a"]), plain_language: S.enum(["yes", "partly", "no", "n/a"]), accepted_exact_answers: S.enum(["yes", "no", "n/a"]), fabricated: S.enum(["no", "yes"]),
      handled_persona: S.enum(["yes", "partly", "no", "n/a"]), rerouted_on_change: S.enum(["yes", "partly", "no", "n/a"]),
      withheld: S.arr(S.obj({ fact: S.str, outcome: S.enum(["asked", "guessed_right", "guessed_wrong", "missing", "n/a"]) })),
      tone: S.enum(["good", "ok", "poor"]), verdict: S.enum(["pass", "borderline", "fail"]), note: S.str }),
      prompt: `Evaluate the CONVERSATION of a media-making assistant with a simulated user, from the transcript and the calls it attempted. Judge the conversation, not the picture quality.
THE USER is played as: ${P.label}: ${P.about}
WHAT THE USER ACTUALLY WANTED (their knowledge bank; the assistant could only learn these by asking, or hit them by a sensible default): ${JSON.stringify({ request_in_full: it.turns?.[0]?.text, ...(it.answer_sheet || {}) })}
${withheld.length ? `FACTS THE USER'S FIRST MESSAGE LEFT OUT ON PURPOSE: ${withheld.map((w, i) => `${i + 1}. ${w}`).join(" ")}` : "The first message stated the request in full."}
${rec.change ? `THE FOLLOW-UP CHANGE the user asked for after the result: ${rec.change.field} ${rec.change.from} → ${rec.change.to} ("${rec.change.say}"), everything else kept.` : ""}
THE ASSISTANT'S JOB: ask ONLY for what it cannot derive and that changes the result, in plain non-technical words (where it will be posted rather than the aspect ratio), accept exact answers too, never make values up (a detail from an attached picture, from the user's words, or a sensible stated default is NOT made up), re-ask more simply when the user did not understand, stop asking when the user says to, name the cost before spending when the user asks about cost, and on a follow-up change only what was asked.
${rec.dry ? "THIS WAS A DRY RUN: every create call was refused at the gate on purpose, with the message \"insufficient credits\" sent to the assistant, so the assistant could not finish. Its telling the user that credits were insufficient is a faithful report of what it was told, not a fabrication. Judge the questions, the replies and the attempted call, not the ending." : ""}
${FACTS}
${OFFERED_TOOLS.length ? `THE ONLY TOOLS THE ASSISTANT HAD (name: start of its description). A statement that the tools cannot do something is TRUE, not fabrication, when no tool below does it (for example no tool trims, joins, overlays text or mixes music into an existing clip, if none is listed): ${OFFERED_TOOLS.join(" | ")}` : ""}
TRANSCRIPT:
${dialogText(rec)}

CALLS IT ATTEMPTED, in order, each with the gate's decision: ${m.attempted.join(" ; ") || "none"}
${m.plan_digest.length ? `PLANNING CALLS (free, not gated), what the assistant gave them and what they answered; a production clip's content is the plan's story: ${m.plan_digest.join(" ;; ")}` : ""}
${m.free_calls.length ? `OTHER FREE CALLS, the last result of each: ${m.free_calls.join(" ; ")}` : ""}

Return: asked_only_missing (did it ask only for what it could not derive; n/a if it asked nothing and nothing was missing), plain_language (its questions in plain words; n/a if none), accepted_exact_answers, fabricated (it presented as the user's wish, or as a fact, something that is in neither the user's words, the bank, a sensible stated default, nor what a tool told it; a creative detail chosen where the user said "your call" is NOT fabrication, nor is relaying a tool's own demand, limit or price shown in the planning calls above; a text marked [cut] was cut by this transcript, not by the assistant), handled_persona (did it cope with this kind of user: re-asked plainly after "idk", stopped asking for the impatient one, found the facts buried in the ramble, named a cost for the tightwad, changed only the one thing for the changer; n/a for the happy user), rerouted_on_change (n/a without a follow-up), withheld (${withheld.length ? "for EACH fact listed above, in order: asked = it asked and got it; guessed_right = it did not ask but the attempted call has it right; guessed_wrong = it chose otherwise; missing = the attempted call does not carry it and nothing was asked; n/a = a fact the call cannot carry" : "no facts were withheld: return an empty array"}), tone, verdict, note (one sentence).` });
  }
  return m;
}

const recs = readdirSync(DIR).filter((f) => /^[A-Z]+\d\d[a-z]?\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8"))).filter((r) => !only.length || only.includes(r.id)).sort((a, b) => a.id.localeCompare(b.id));
const out = []; const q = [...recs];
await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const r = q.shift(); try { const m = await score(r); writeFileSync(join(DIR, `${r.id}.conv.json`), JSON.stringify(m, null, 2)); out.push(m); } catch (e) { out.push({ id: r.id, error: `conv: ${e.message}` }); } } }));
// --only re-scores some items: they replace their entries in the folder's earlier conversation.json instead of replacing the whole file
if (only.length && existsSync(join(DIR, "conversation.json"))) { const prior = JSON.parse(readFileSync(join(DIR, "conversation.json"), "utf8")).items || [], ids = new Set(out.map((m) => m.id)); out.push(...prior.filter((m) => !ids.has(m.id))); }
out.sort((a, b) => a.id.localeCompare(b.id));
const mark = (v) => (v === "correct" ? "ok" : v === "not settled" ? "-" : "WRONG"), W = { asked: "A", guessed_right: "R", guessed_wrong: "W", missing: "M", "n/a": "·" };
const flags = (m) => { const b = m.basic || {}, u = m.user_check || {}; return [!b.no_loop && "LOOP", b.delegation_ignored > 0 && "DELEGATION-IGNORED", b.not_stuck === false && "STUCK", b.attempted_or_planned === false && "NO-CALL", b.answered_every_message === false && "SILENT-TURN", b.no_spend_in_dry === false && "SPENT-IN-DRY", u.in_character === "no" && "USER-OFF-CHARACTER", u.invented?.length && "USER-INVENTED", u.added_requirements?.length && "USER-ADDED-REQ", u.leaked_early?.length && "USER-LEAKED"].filter(Boolean).map((f) => ` ⚠${f}`).join(""); };
for (const m of out) console.log(`${m.id.padEnd(5)} ${(m.persona || "").padEnd(9)} q${m.questions ?? "?"}${m.gave_up ? " gave-up" : ""} ${String(m.final_kind).padEnd(9)} ${Object.entries(m.values || {}).map(([k, v]) => `${k}:${mark(v)}`).join(" ").padEnd(42)} ${m.judge ? `${m.judge.verdict.padEnd(10)} persona ${m.judge.handled_persona.padEnd(6)} fab ${m.judge.fabricated.padEnd(3)} withheld ${m.judge.withheld.map((w) => W[w.outcome] || "?").join("") || "-"}` : m.infra ? `INFRA ${m.infra.slice(0, 90)}` : m.error ? `ERROR ${m.error.slice(0, 80)}` : ""}${flags(m)}`);
const flat = out.flatMap((m) => Object.values(m.values || {}));
const totals = { items: out.length, errors: out.filter((m) => m.error).length, infra: out.filter((m) => m.infra).length, questions: out.reduce((a, m) => a + (m.questions || 0), 0), items_that_asked: out.filter((m) => m.questions > 0).length, gave_up: out.filter((m) => m.gave_up).length,
  values: { correct: flat.filter((v) => v === "correct").length, wrong: flat.filter((v) => /^wrong/.test(v)).length, not_settled: flat.filter((v) => v === "not settled").length },
  verdicts: out.reduce((a, m) => { if (m.judge) a[m.judge.verdict] = (a[m.judge.verdict] || 0) + 1; return a; }, {}),
  withheld: out.flatMap((m) => m.judge?.withheld || []).reduce((a, w) => { a[w.outcome] = (a[w.outcome] || 0) + 1; return a; }, {}),
  fabricated: out.filter((m) => m.judge?.fabricated === "yes").length,
  basic: { loops: out.filter((m) => m.basic && !m.basic.no_loop).length, put_twice: out.filter((m) => m.basic?.put_twice_or_more > 0).length, delegation_ignored: out.filter((m) => m.basic?.delegation_ignored > 0).length, stuck: out.filter((m) => m.basic?.not_stuck === false).length, no_call: out.filter((m) => m.basic?.attempted_or_planned === false).length, silent_turn: out.filter((m) => m.basic?.answered_every_message === false).length, spent_in_dry: out.filter((m) => m.basic?.no_spend_in_dry === false).length, many_questions_at_once: out.filter((m) => m.basic?.questions_per_message_max >= 3).length },
  user: { judged: out.filter((m) => m.user_check).length, in_character: out.filter((m) => m.user_check?.in_character === "yes").length, off_character: out.filter((m) => m.user_check?.in_character === "no").length, invented: out.filter((m) => m.user_check?.invented?.length).length, added_requirements: out.filter((m) => m.user_check?.added_requirements?.length).length, leaked_early: out.filter((m) => m.user_check?.leaked_early?.length).length } };
writeFileSync(join(DIR, "conversation.json"), JSON.stringify({ at: new Date().toISOString(), totals, items: out }, null, 2));
console.log(`\n${JSON.stringify(totals)}`);
