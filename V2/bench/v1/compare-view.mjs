// The "Agent vs Claude" tab: where each still-failing item broke in the pipeline, the four plans side by side (what ran,
// the agent at low and high effort, Claude at max effort), the judge's scores, and the run's tool calls with every input
// and output. Reads results/<run>/compare-thinking.json and results/<run>/expert/<id>.json (compare-thinking.mjs).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STAGES = [
  { k: "spec", name: "Bench test", what: "the test itself asks for the wrong thing" },
  { k: "sheet", name: "Sheet", who: "LLM", what: "reads the message into fields; code turns unknown fields into questions" },
  { k: "agent-reasoning", name: "Planner", who: "LLM", what: "one call writes the tree: tools, inputs, prompts, params" },
  { k: "wrong-tool", name: "Tool pick", who: "LLM", what: "a better tool existed in the catalogue" },
  { k: "missing-tool", name: "Catalogue", who: "us", what: "no tool can do the step" },
  { k: "harness", name: "Executor", who: "our code", what: "runs each step; crop/pad, lettering read-back, mixing, the code tools" },
  { k: "model-limit", name: "Model", who: "Magic Hour", what: "plan and code right; the free model fell short" },
  { k: "grader", name: "Grader", who: "our bench", what: "the output was fine; the check was wrong" },
];
// which piece of our code the expert's fix names first
const PARTS = [["sheet → planner hand-off", /sheet|quote|sheetText|never (saw|shown)|palette/i], ["lettering read-back", /read-?back|fixText|misread|stray/i], ["assemble", /assemble/i], ["text-overlay", /text-overlay/i], ["voice", /\bvoice\b/i], ["captions", /caption/i], ["face-swap", /face-swap|face swap/i], ["crop / pad / finish", /\bcrop|\bpad\b|finish\(/i], ["clip length", /conform|overshoot|length/i], ["image-to-video", /image-to-video/i], ["deliverables", /deliverable/i], ["transcriber", /transcri/i], ["planner rules", /planner|rule|catalogue/i]];
const part = (e) => { const t = `${e.fix} ${e.agent_vs_you}`; let best = null; for (const [n, re] of PARTS) { const m = t.search(re); if (m >= 0 && (!best || m < best[1])) best = [n, m]; } return best?.[0] || "other"; };

export function compareTab({ DIR, items, trace, media, esc }) {
  const f = join(DIR, "compare-thinking.json"); if (!existsSync(f)) return "<p>No comparison yet: run compare-thinking.mjs.</p>";
  const rows = JSON.parse(readFileSync(f, "utf8")), byId = Object.fromEntries(items.map((x) => [x.g.id, x]));
  const ex = Object.fromEntries(rows.map((r) => [r.id, existsSync(join(DIR, "expert", r.id + ".json")) ? JSON.parse(readFileSync(join(DIR, "expert", r.id + ".json"), "utf8")) : null]));
  const K = [["ran", "What ran"], ["low", "Agent · low effort"], ["high", "Agent · high effort"], ["expert", "Claude · max effort"]];
  const avg = (a, k, fn) => { const b = a.filter((r) => r.judge[k]); return b.length ? b.reduce((s, r) => s + fn(r.judge[k]), 0) / b.length : 0; };
  const pc = (a, k, key) => Math.round(100 * avg(a, k, (j) => (j[key] ? 1 : 0)));
  const scoreRows = K.map(([k, n]) => `<tr${k === "expert" ? ' class="me"' : ""}><td>${n}</td><td>${pc(rows, k, "chain_sound")}%</td><td>${pc(rows, k, "best_tools")}%</td><td>${pc(rows, k, "inputs_sound")}%</td><td><b>${avg(rows, k, (j) => j.would_meet).toFixed(2)}</b></td></tr>`).join("");
  const cause = {}; for (const r of rows) if (ex[r.id]) (cause[ex[r.id].root_cause] ??= []).push(r);
  const gapRows = STAGES.filter((s) => cause[s.k]).map((s) => { const a = cause[s.k]; return `<tr><td>${esc(s.name)} <small>${esc(s.k)}</small></td><td>${a.length}</td>${K.map(([k]) => `<td${k === "expert" ? ' class="me"' : ""}>${avg(a, k, (j) => j.would_meet).toFixed(2)}</td>`).join("")}</tr>`; }).join("");
  const parts = {}; for (const r of rows) { const e = ex[r.id]; if (e?.root_cause === "harness") (parts[part(e)] ??= []).push(r.id); }
  const PFJ = existsSync(join(DIR, "preflight.json")) ? JSON.parse(readFileSync(join(DIR, "preflight.json"), "utf8")) : {};
  const pfHit = rows.filter((r) => PFJ[r.id] && !PFJ[r.id].ok), pfBy = {}; for (const r of pfHit) { const c = ex[r.id]?.root_cause || "?"; pfBy[c] = (pfBy[c] || 0) + 1; }
  const N = rows.length, mx = Math.max(...Object.values(cause).map((a) => a.length));
  const flow = STAGES.filter((s) => s.k !== "wrong-tool" && s.k !== "spec").map((s) => { const n = (cause[s.k] || []).length + (s.k === "agent-reasoning" ? (cause["wrong-tool"] || []).length : 0); return `<div class="stg" style="--h:${n / mx}"><b>${esc(s.name)}</b><small>${esc(s.who || "")}</small><span class="cnt">${n}</span><p>${esc(s.what)}</p></div>`; }).join('<i class="ar">→</i>');
  let w = { exp: 0, ran: 0, tie: 0 }; for (const r of rows) if (r.judge.ran && r.judge.expert) { const d = r.judge.expert.would_meet - r.judge.ran.would_meet; d > 0 ? w.exp++ : d < 0 ? w.ran++ : w.tie++; }
  const wp = {}; for (const e of Object.values(ex)) if (e) wp[e.would_pass] = (wp[e.would_pass] || 0) + 1;
  const stepList = (p) => !p ? "<p><em>no plan</em></p>" : p.refuse ? `<p><b>Refuses:</b> ${esc(p.refuse)}</p>` : `${p.say ? `<p class="say">${esc(p.say)}</p>` : ""}${p.questions_left?.length ? `<p class="say"><b>Asks:</b> ${esc(p.questions_left.join(" / "))}</p>` : ""}<ol class="xs">${(p.steps || []).map((s) => `<li><b>${esc(s.tool)}</b> <span class="mdl">${esc([(s.inputs || []).join(", ") || "nothing", "→", s.produces].join(" "))}</span>${s.params?.aspect ? ` <small>${esc(s.params.aspect)}</small>` : ""}${s.params?.seconds ? ` <small>${s.params.seconds}s</small>` : ""}${s.params?.lettering ? " <small>lettering</small>" : ""}<details class="pr"><summary>prompt and why</summary><pre>${esc(s.params?.prompt_or_change || "")}${s.params?.extra ? "\n\n" + esc(s.params.extra) : ""}${s.why ? "\n\nwhy: " + esc(s.why) : ""}</pre></details></li>`).join("")}</ol>`;
  const txtPlan = (p) => !p ? "<p><em>no plan</em></p>" : `<p class="mdl">${esc(p.tools.join(" → ") || "no steps")}</p><details class="pr"><summary>the steps and prompts</summary><pre>${esc(p.text)}</pre></details>`;
  const card = (r) => {
    const e = ex[r.id], it = byId[r.id], st = STAGES.find((s) => s.k === e?.root_cause);
    const jt = `<div class="tw"><table class="jt"><tr><th></th>${K.map(([k, n]) => `<th${k === "expert" ? ' class="me"' : ""}>${n}</th>`).join("")}</tr>${[["tools", (j, k) => esc(r.plans[k]?.tools.join(" → ") || "—")], ["chain sound", (j) => (j.chain_sound ? "✓" : "✗")], ["best tools", (j) => (j.best_tools ? "✓" : "✗")], ["inputs right", (j) => (j.inputs_sound ? "✓" : "✗")], ["would meet (1–5)", (j) => `<b>${j.would_meet}</b>`], ["judge's issue", (j) => `<small>${esc(j.issues)}</small>`]].map(([n, fn]) => `<tr><td>${n}</td>${K.map(([k]) => `<td${k === "expert" ? ' class="me"' : ""}>${r.judge[k] ? fn(r.judge[k], k) : "—"}</td>`).join("")}</tr>`).join("")}</table></div>`;
    return `<article class="cx" data-c="${esc(e?.root_cause || "")}" id="cx-${r.id}"><header><span class="id">${r.id}</span><h3>${esc(it?.g.title || "")}</h3><span class="score fail">${r.score}</span></header>
<p class="tests">${esc(it?.r.turns.map((t) => t.text).join(" / ") || "")}</p>
<p><span class="stchip">broke at: ${esc(st?.name || e?.root_cause || "?")}</span>${e?.root_cause === "harness" ? ` <span class="cause">${esc(part(e))}</span>` : ""}${(e?.contributing || []).map((c) => ` <span class="cause also">+ ${esc(c)}</span>`).join("")}${e ? ` <span class="v">Claude's fix would pass: ${esc(e.would_pass)}</span>` : ""}</p>
<div class="out">${(it?.g.outputs || []).map((p) => media(p, true)).join("") || '<p class="none">Nothing made</p>'}</div>
${e ? `<div class="diag"><b>What went wrong (Claude, after looking at the files)</b><p>${esc(e.agent_vs_you)}</p><details class="pr"><summary>evidence from the files</summary><pre>${esc(e.evidence)}</pre></details><p class="better"><b>Fix</b> ${esc(e.fix)}</p></div>` : ""}
${PFJ[r.id] ? `<p class="pfe ${PFJ[r.id].ok ? "ok" : ""}"><b>Pre-flight on this plan:</b> ${PFJ[r.id].ok ? "nothing found on paper" : esc([...PFJ[r.id].end, ...PFJ[r.id].steps].join(" · "))}</p>` : ""}${jt}
<details class="calls"><summary>The pipeline that ran: every tool call with its inputs and outputs</summary>${it ? trace(it.r) || "<p><em>No tool calls.</em></p>" : ""}</details>
<details class="calls"><summary>Claude's plan (max effort, written, not run)</summary>${stepList(e?.your_plan)}</details>
<details class="calls"><summary>The agent's plans today (low and high effort, not run)</summary><p><b>Low</b></p>${txtPlan(r.plans.low)}<p><b>High</b></p>${txtPlan(r.plans.high)}</details></article>`;
  };
  const harnessRows = Object.entries(parts).sort((a, b) => b[1].length - a[1].length).map(([n, ids]) => `<tr><td>${esc(n)}</td><td>${ids.length}</td><td class="ids">${ids.map((id) => `<a href="#cx-${id}">${id}</a>`).join(" ")}</td></tr>`).join("");
  return `<section class="rep">
<h2>In short</h2>
<ul class="short">
<li><b>What's bad:</b> ${N} items still fail. About ${Math.round((100 * ((cause.harness?.length || 0) + (cause["agent-reasoning"]?.length || 0))) / N)}% of them fail in two places: our executor code (${cause.harness?.length || 0}) and the planner's reasoning (${cause["agent-reasoning"]?.length || 0}). Only ${cause["model-limit"]?.length || 0} are the free models' fault, and ${(cause.grader?.length || 0) + (cause.spec?.length || 0)} aren't real failures (grader or test wrong).</li>
<li><b>When the plan was fine but our code broke it</b> (${cause.harness?.length || 0} items), the plan that ran already scored ${avg(cause.harness || [], "ran", (j) => j.would_meet).toFixed(2)} of 5. Claude's plan scored no better (${avg(cause.harness || [], "expert", (j) => j.would_meet).toFixed(2)}). Thinking harder can't fix these; the code has to.</li>
<li><b>When the agent's reasoning was wrong</b> (${cause["agent-reasoning"]?.length || 0} items), Claude is clearly better: ${avg(cause["agent-reasoning"] || [], "expert", (j) => j.would_meet).toFixed(2)} vs ${avg(cause["agent-reasoning"] || [], "ran", (j) => j.would_meet).toFixed(2)} for what ran. The agent at high effort only reached ${avg(cause["agent-reasoning"] || [], "high", (j) => j.would_meet).toFixed(2)}. The gap is knowledge, not effort: Claude opened the materials and knew what our code does with each setting.</li>
<li><b>Across all ${N} items, Claude did better, not dramatically:</b> ${avg(rows, "expert", (j) => j.would_meet).toFixed(2)} vs ${avg(rows, "ran", (j) => j.would_meet).toFixed(2)}. Its plan was better on ${w.exp}, the same on ${w.tie}, and worse on ${w.ran}. Claude expects ${(wp.yes || 0) + (wp.likely || 0)} of ${N} to pass once its named fix is in (${wp.yes || 0} certain, ${wp.likely || 0} likely, ${wp.unlikely || 0} unlikely).</li>
</ul>
<h2>Where in the pipeline each failure happened <small>(the expert's root cause per item; bar height is the count)</small></h2>
<div class="flow">${flow}</div>
<p class="hint">Plus ${(cause.spec || []).length} where the bench test itself was wrong. The planner box includes ${(cause["wrong-tool"] || []).length} wrong-tool picks.</p>
<h2>Would a check before running have caught it? <small>(the plan traced on paper: each tool's effect on kind, size, length, sound and transparency from the materials' measured facts, plus the user's colours and quoted words reaching a prompt; no model calls)</small></h2>
<p>Pre-flight flags <b>${pfHit.length} of ${Object.keys(PFJ).length}</b> failed plans before any tool runs (${Object.entries(pfBy).map(([k, n]) => `${esc(k)} ${n}`).join(", ")}). The other failures are about content, not types: garbled letters, a warped car, a face that drifts. A type check can't see those; the facts after each step, and a vision question where needed, can.</p>
<p class="ids">${pfHit.map((r) => `<a href="#cx-${r.id}">${r.id}</a>`).join(" ")}</p>
<h2>Inside the executor: which piece of our code <small>(${cause.harness?.length || 0} items; the part the expert's fix names first)</small></h2>
<div class="tw"><table><tr><th>Part</th><th>Items</th><th>Which</th></tr>${harnessRows}</table></div>
<h2>Plans compared <small>(one blind judge, same rubric; plans only, nothing re-run)</small></h2>
<div class="tw"><table><tr><th>Plan</th><th>Chain sound</th><th>Best tools</th><th>Inputs right</th><th>Would meet (1–5)</th></tr>${scoreRows}</table></div>
<h3 class="sub">By where it broke <small>(would-meet, 1–5)</small></h3>
<div class="tw"><table><tr><th>Broke at</th><th>Items</th>${K.map(([k, n]) => `<th${k === "expert" ? ' class="me"' : ""}>${n}</th>`).join("")}</tr>${gapRows}</table></div>
<h2>How the harness works, and is it too restrictive?</h2>
<div class="arch">
<ol>
<li><b>Sheet (LLM).</b> One call reads the conversation into a fixed set of fields for the goal (size, style, words, length…). Each field is stated, inferred or unknown. <b>Code</b> turns unknown or low-confidence fields into questions, up to 4. This is the only place the agent is challenged structurally.</li>
<li><b>Planner (LLM).</b> One call gets the sheet, the material <i>file names</i>, the session's assets and the tool catalogue. It writes the whole tree: each step's tool, inputs, output name, prompt and a free-text "extra".</li>
<li><b>price / guard (code).</b> Picks the model per step (qwen for lettering or faithful edits), then patches a few known mistakes (transparency, a missing style).</li>
<li><b>Executor (code).</b> Runs the steps in order. It checks only that each input exists. Then it post-processes: crop or pad to the aspect, drop clip audio, read the lettering back and fix it once.</li>
</ol>
<p><b>Not too restrictive; too trusting.</b> The agent is asked what to do, and the tree is run as written. Nothing pushes back on it:</p>
<ul>
<li>A setting a tool can't do is <b>silently ignored</b>, and the step still reports "done". Examples: "dissolve" or "5 s then 3 s" to assemble, "navy, left-aligned" to text-overlay, "8 seconds" to voice.</li>
<li>The agent never <b>sees the materials</b>, only their names. It can't know a clip is silent or where a speaker changes.</li>
<li>Outputs aren't checked against what the step was for, except lettering. A wrong picture flows into the next step.</li>
<li>Until today, the planner didn't receive the user's own style and palette words (fixed).</li>
</ul>
<p>Where it <i>is</i> restrictive, it's a few absolute planner rules. For example, "never a picture plus a text-overlay for the same design" stopped the right split on a flyer with a long address (A03d). As asked, I'm not adding gates now; this page shows which stage broke so we can decide later.</p>
</div>
<h2>Every item <small>(${N} still failing)</small></h2>
<div class="bar2 cxf"><button data-cf="" class="on">All</button>${STAGES.filter((s) => cause[s.k]).map((s) => `<button data-cf="${s.k}">${esc(s.name)} ${cause[s.k].length}</button>`).join("")}</div>
<div class="cxs">${rows.map(card).join("\n")}</div></section>`;
}

export const COMPARE_CSS = `.rep h2{margin-top:22px}.short li{margin:6px 0;max-width:900px}.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}.stg{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:8px 10px;width:150px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:2px}.stg::before{content:"";position:absolute;left:0;right:0;bottom:0;height:calc(var(--h)*100%);background:color-mix(in srgb,var(--bad) 16%,transparent);z-index:0}.stg>*{position:relative}.stg small{color:var(--mut);font-size:11px}.stg .cnt{font-size:24px;font-weight:700}.stg p{font-size:11px;color:var(--mut);margin:0}.ar{align-self:center;color:var(--mut);font-style:normal}
.me{background:color-mix(in srgb,var(--acc) 10%,transparent)}.jt td,.jt th{font-size:12px;vertical-align:top;max-width:220px}.arch{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:8px 16px;max-width:940px}.arch li{margin:5px 0}
.cxs{display:grid;grid-template-columns:1fr;gap:14px}.stchip{font:600 12px ui-monospace,monospace;border-radius:5px;padding:1px 8px;background:color-mix(in srgb,var(--bad) 18%,transparent)}.say{font-size:13px;margin:4px 0}.xs{padding-left:20px}.xs li{margin:4px 0}h3.sub{font-size:14px;margin:14px 0 6px}.cx .out img,.cx .out video{max-height:200px}`;
