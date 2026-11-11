// The audit page for a bench run, served by bench/v1/serve.mjs (media from /sessions, notes saved to notes.json).
// Tabs: Overview (pass/fail statistics and every tool's use), Everything, Failed (each tool call with its inputs and
// outputs, and a note box for why it failed). With --compare <run>, every item also shows that run's score and output
// (a rerun against the first run). With --film <run label> a second tab shows that film's pipeline (film-view.mjs).
// Every picture and clip opens full-size with zoom and pan. Usage: node V2/bench/v1/view.mjs [--run real-1] [--compare
// real-1] [--film film-econ-klein-b --film-later film-econ-klein-c --probe probe-buildable]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareTab, COMPARE_CSS } from "./compare-view.mjs";
import { factsText, facts as measure } from "../../backend/agent/facts.js";
import { filmTab } from "./film-view.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..", "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg("--run", "real-1"), DIR = join(HERE, "results", RUN), OUT = join(DIR, "index.html");
const grades = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8"));
const FILM = arg("--film", null), CMP = arg("--compare", null), prev = CMP ? Object.fromEntries(JSON.parse(readFileSync(join(HERE, "results", CMP, "grades.json"), "utf8")).map((g) => [g.id, g])) : {};
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
// a file under V2 (sessions/…) as a played or shown piece of media
const media = (p, small) => {
  if (!p) return "";
  const u = esc("/" + p), f = join(V2, p);
  if (/\.(mp4|mov|webm)$/i.test(p)) return `<video class="zm${small ? " sm" : ""}" src="${u}" controls preload="metadata"></video>`;
  if (/\.(mp3|wav|m4a|aac)$/i.test(p)) return `<audio src="${u}" controls preload="none"></audio>`;
  if (/\.(png|jpe?g|webp|gif)$/i.test(p)) return `<img class="zm${small ? " sm" : ""}" src="${u}" loading="lazy" alt="">`;
  if (/\.(txt|srt|vtt|md|json)$/i.test(p) && existsSync(f)) return `<pre>${esc(readFileSync(f, "utf8").slice(0, 1200))}</pre>`;
  return `<a href="${u}" target="_blank">${esc(p.split("/").pop())}</a>`;
};
const items = grades.map((g) => ({ g, r: JSON.parse(readFileSync(join(DIR, g.id + ".json"), "utf8")) }));
const diag = existsSync(join(DIR, "diagnoses.json")) ? Object.fromEntries(JSON.parse(readFileSync(join(DIR, "diagnoses.json"), "utf8")).map((d) => [d.id, d])) : {};
const CAUSE = { "type-understanding": "misread what kind of thing was wanted", "tool-fit": "right idea, wrong tool for a step", "state-solving": "the chain from what exists to what is wanted is wrong (steps, order, wiring)", "prompt-or-params": "right tools, poor prompt or settings", "model-quality": "plan sound, the model fell short", grader: "output was fine, the grade is wrong", conversation: "asked, refused or answered wrongly" };
const names = Object.fromEntries(items.map(({ r }) => [r.item.group, r.item.group_name]));

// ---- statistics
const N = grades.length, pass = grades.filter((g) => g.pass).length, fail = N - pass;
const made = grades.filter((g) => g.checks?.find((c) => c.name === "something was made")?.pass).length;
const mean = (a) => Math.round(a.reduce((s, g) => s + g.score, 0) / (a.length || 1));
const credits = grades.reduce((s, g) => s + (g.spent || 0), 0);
const tags = {}; for (const g of grades) if (!g.pass) for (const t of g.tags || []) tags[t] = (tags[t] || 0) + 1;
const groups = {}; for (const g of grades) (groups[g.group] ??= []).push(g);
const tools = {};
for (const { g, r } of items) for (const t of r.turns) (t.plan?.steps || []).forEach((s, i) => {
  const k = (tools[s.tool] ??= { calls: 0, items: new Set(), failItems: new Set(), errors: 0, credits: 0, models: new Set() });
  k.calls++; k.items.add(g.id); if (!g.pass) k.failItems.add(g.id); if (t.ran?.[i]?.state === "failed") k.errors++; k.credits += t.ran?.[i]?.credits || 0; if (s.model) k.models.add(s.model);
});
const bar = (a, b) => `<span class="bar"><i style="width:${pct(a, b)}%"></i></span>`;
const groupRows = Object.keys(groups).sort().map((k) => { const a = groups[k], p = a.filter((g) => g.pass).length; return `<tr><td>${k} · ${esc(names[k])}</td><td>${a.length}</td><td class="ok">${p}</td><td class="no">${a.length - p}</td><td>${bar(p, a.length)} ${pct(p, a.length)}%</td><td>${mean(a)}</td><td>${a.reduce((s, g) => s + (g.spent || 0), 0).toLocaleString()}</td></tr>`; }).join("");
const toolRows = Object.entries(tools).sort((a, b) => b[1].calls - a[1].calls).map(([k, v]) => { const n = v.items.size, f = v.failItems.size; return `<tr${pct(f, n) >= 80 && n >= 5 ? ' class="hot"' : ""}><td><b>${esc(k)}</b><small>${esc([...v.models].join(", "))}</small></td><td>${v.calls}</td><td>${n}</td><td class="no">${f}</td><td>${bar(f, n)} ${pct(f, n)}%</td><td>${v.errors || ""}</td><td>${v.credits.toLocaleString()}</td></tr>`; }).join("");
const tagRows = Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<tr><td>${esc(t)}</td><td>${n}</td><td>${bar(n, fail)} ${pct(n, fail)}% of failures</td></tr>`).join("");
// text-overlay doing a designed thing: logos, posters, thumbnails, memes, slides, title cards
const DESIGN = /logo|poster|flyer|thumbnail|meme|carousel|slide|title card|end card|lettering|wordmark|headline/i;
const misuse = items.filter(({ r }) => r.turns.some((t) => t.plan?.steps?.some((s) => s.tool === "text-overlay")) && DESIGN.test(r.turns.map((t) => t.text).join(" ")));
const placeMisuse = items.filter(({ r }) => r.turns.some((t) => t.plan?.steps?.some((s) => s.tool === "place")) && !/logo|watermark|sticker|badge|icon/i.test(r.turns.map((t) => t.text).join(" ")));
const D = Object.values(diag), cnt = (f) => D.reduce((m, d) => { for (const k of new Set([].concat(f(d)))) m[k] = (m[k] || 0) + 1; return m; }, {});
const mainC = cnt((d) => d.cause), anyC = cnt((d) => [d.cause, ...(d.also || [])]), wrong = cnt((d) => d.steps.filter((x) => x.verdict === "wrong-tool").map((x) => x.tool));
const diagSec = D.length ? `<h2>Why the plans failed <small>(a reviewer read each failed item's tool calls, inputs and outputs; ${D.length} of ${fail} diagnosed)</small></h2>
<div class="kpis"><div class="no"><b>${D.filter((d) => d.chain_logic === "flawed").length}</b>tool chain flawed</div><div class="no"><b>${D.filter((d) => d.best_tools === "no").length}</b>tools not the best fit</div><div class="no"><b>${D.filter((d) => d.inputs === "flawed").length}</b>inputs flawed</div></div>
<div class="tw"><table><tr><th>Cause</th><th>What it means</th><th>Main cause</th><th>Contributed</th></tr>${Object.keys(CAUSE).map((k) => `<tr><td><b>${k}</b></td><td>${CAUSE[k]}</td><td>${mainC[k] || 0} ${bar(mainC[k] || 0, D.length)}</td><td>${anyC[k] || 0}</td></tr>`).join("")}</table></div>
<p class="hint">Steps judged the wrong tool: ${Object.entries(wrong).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<b>${esc(k)}</b> ${n}`).join(" · ")}</p>` : "";
const P = grades.filter((g) => prev[g.id]), fixed = P.filter((g) => g.pass && !prev[g.id].pass), broke = P.filter((g) => !g.pass && prev[g.id].pass), up = P.filter((g) => g.score > prev[g.id].score).length, down = P.filter((g) => g.score < prev[g.id].score).length;
const cmpSec = P.length ? `<h2>Against ${esc(CMP)} <small>(the same ${P.length} items)</small></h2>
<div class="kpis"><div class="ok"><b>${fixed.length}</b>now pass (were failing)</div><div class="no"><b>${P.filter((g) => !g.pass).length}</b>still failing</div>${broke.length ? `<div class="no"><b>${broke.length}</b>passed before, fail now</div>` : ""}<div><b>${mean(P.map((g) => prev[g.id]))} → ${mean(P)}</b>mean score</div><div><b>${up} ↑ · ${down} ↓</b>items scoring higher · lower</div><div><b>${P.reduce((n, g) => n + (prev[g.id].spent || 0), 0).toLocaleString()} → ${P.reduce((n, g) => n + (g.spent || 0), 0).toLocaleString()}</b>credits</div></div>
<div class="tw"><table><tr><th>Group</th><th>Items</th><th>Pass before</th><th>Pass now</th><th>Mean before → now</th></tr>${Object.keys(groups).sort().map((k) => { const a = groups[k].filter((g) => prev[g.id]); return a.length ? `<tr><td>${k} · ${esc(names[k])}</td><td>${a.length}</td><td>${a.filter((g) => prev[g.id].pass).length}</td><td class="ok">${a.filter((g) => g.pass).length}</td><td>${mean(a.map((g) => prev[g.id]))} → <b>${mean(a)}</b></td></tr>` : ""; }).join("")}</table></div>` : "";
const overview = `<section class="stats">${cmpSec}
<div class="kpis"><div><b>${N}</b>items</div><div class="ok"><b>${pass}</b>passed · ${pct(pass, N)}%</div><div class="no"><b>${fail}</b>failed · ${pct(fail, N)}%</div><div><b>${made}</b>made something</div><div><b>${N - made}</b>made nothing</div><div><b>${mean(grades)}</b>mean score</div><div><b>${credits.toLocaleString()}</b>credits</div></div>
<div class="split"><span class="ok" style="flex:${pass}">${pass} pass</span><span class="no" style="flex:${fail}">${fail} fail</span></div>
<h2>By group</h2><div class="tw"><table><tr><th>Group</th><th>Items</th><th>Pass</th><th>Fail</th><th>Pass rate</th><th>Mean</th><th>Credits</th></tr>${groupRows}</table></div>
<h2>Why the failures failed <small>(an item can carry several)</small></h2><div class="tw"><table>${tagRows}</table></div>
${diagSec}
<h2>Tools used</h2><p class="hint">Each tool the planner put in a tree: calls, items using it, how many of those items failed, and steps that errored. Rows in red: 80% or more of their items failed.</p>
<div class="tw"><table><tr><th>Tool · model</th><th>Calls</th><th>Items</th><th>Failed items</th><th>Fail rate</th><th>Errors</th><th>Credits</th></tr>${toolRows}</table></div>
<h2>Tool choice to look at</h2>
<div class="flag"><p><b>text-overlay (code that types text onto a picture) used for designed lettering</b>: ${misuse.length} items (logos, posters, thumbnails, memes, slides, title cards), ${misuse.filter(({ g }) => !g.pass).length} failed. The image models (image with the words in the prompt, or image-edit to letter an existing picture) are not used for any of them.</p>
<p class="ids">${misuse.map(({ g }) => `<a href="#${g.id}" data-go="${g.id}" class="${g.pass ? "ok" : "no"}">${g.id}</a>`).join(" ")}</p></div>
<div class="flag"><p><b>place (the logo/sticker tool) used for something that is not a logo</b>: ${placeMisuse.length} items, ${placeMisuse.filter(({ g }) => !g.pass).length} failed. For example, a before/after where the "after" photo was put in the corner at 15% wide.</p>
<p class="ids">${placeMisuse.map(({ g }) => `<a href="#${g.id}" data-go="${g.id}" class="${g.pass ? "ok" : "no"}">${g.id}</a>`).join(" ")}</p></div>
</section>`;

// ---- one tool call: the step, what went in, what came out
const PF = existsSync(join(DIR, "preflight.json")) ? JSON.parse(readFileSync(join(DIR, "preflight.json"), "utf8")) : {};
const trace = (r) => { let n = 0; const dv = diag[r.item.id]?.steps || []; return r.turns.map((t, ti) => {
  const steps = t.plan?.steps || []; if (!steps.length) return "";
  const out = Object.fromEntries(steps.map((s, i) => [s.produces, t.ran?.[i]?.output]));
  const src = (name) => out[name] ? `${r.sessionDir}/${out[name]}` : existsSync(join(V2, r.sessionDir, "materials", name)) ? `${r.sessionDir}/materials/${name}` : null;
  return `<ol class="trace">${r.turns.length > 1 ? `<p class="tt">Turn ${ti + 1}</p>` : ""}${steps.map((s, i) => { const ran = t.ran?.[i] || {}; const o = ran.output ? `${r.sessionDir}/${ran.output}` : null;
    const v = dv.find((x) => x.n === ++n); return `<li data-s="${esc(ran.state || "not run")}"><div class="call"><b>${i + 1}. ${esc(s.tool)}</b>${v ? ` <span class="vd ${esc(v.verdict)}">${esc(v.verdict)}</span>` : ""} <span class="mdl">${esc(s.model || "")}${s.resolution ? " " + esc(s.resolution) : ""}</span> <span class="st">${esc(ran.state || "not run")}</span> <span class="cr">${ran.credits ?? s.credits ?? 0} cr${ran.seconds ? ` · ${ran.seconds}s` : ""}</span></div>
${s.params?.aspect || s.params?.seconds ? `<p class="prm"><small>${s.params?.aspect ? `aspect ${esc(s.params.aspect)}` : ""}${s.params?.seconds ? ` · ${s.params.seconds}s` : ""}${s.params?.lettering ? " · lettering" : ""}</small></p>` : ""}<details class="pr"><summary>prompt${s.why ? " and why" : ""}</summary><pre>${esc(s.params?.prompt_or_change || "")}${s.params?.extra ? `\n\n${esc(s.params.extra)}` : ""}${s.why ? `\n\nwhy: ${esc(s.why)}` : ""}</pre></details>
<div class="io"><div><span class="lbl">in</span>${s.inputs.length ? s.inputs.map((x) => `<figure>${src(x) ? media(src(x), true) : ""}<figcaption>${esc(x)}</figcaption></figure>`).join("") : "<em>nothing</em>"}</div><div><span class="lbl">out</span><figure>${o ? media(o, true) : "<em>none</em>"}<figcaption>${esc(s.produces)}</figcaption></figure></div></div>
${(() => { const pf = (ti === r.turns.length - 1 ? PF[r.item.id]?.predicted?.[i] : null) || s; const pr = pf.predicted, me = ran.facts || (o && existsSync(join(V2, o)) ? measure(join(V2, o)) : null); return pr || me ? `<p class="pm">${pr ? `<span><b>on paper</b> ${esc(factsText({ exists: true, ...pr }))}</span>` : ""}${me ? `<span><b>measured</b> ${esc(factsText(me))}</span>` : ""}</p>${(pf.preflight || []).map((x) => `<p class="pfw">pre-flight: ${esc(x)}</p>`).join("")}` : ""; })()}${v?.issue && v.verdict !== "ok" ? `<p class="dissue">${esc(v.issue)}</p>` : ""}${ran.note ? `<p class="note">${esc(ran.note)}</p>` : ""}${ran.error ? `<p class="err">${esc(ran.error)}</p>` : ""}</li>`; }).join("")}${(() => { const pf = ti === r.turns.length - 1 ? (t.plan?.preflight || PF[r.item.id]) : t.plan?.preflight; return `${pf ? `<p class="pfe ${pf.ok ? "ok" : ""}"><b>Pre-flight, before any tool ran:</b> ${pf.ok ? "the chain ends in the right kind, size and length" : esc([...(pf.end || []), ...(pf.steps || [])].join(" · "))}</p>` : ""}${t.goal_check ? `<p class="pfe"><b>After running, against the request:</b> ${esc(t.goal_check.join(" · "))}</p>` : ""}`; })()}</ol>`;
}).join(""); };

const QUICK = ["wrong tool", "planner", "prompt", "model quality", "text / lettering", "sound", "size / length", "grader wrong"];
const card = ({ g, r }) => {
  const turns = r.turns.map((t) => `<div class="turn"><p class="user"><b>User</b> ${esc(t.text)}${t.materials?.length ? ` <span class="mat">+ ${esc(t.materials.join(", "))}</span>` : ""}</p>${(t.dialog || []).map((d) => `<p class="q"><b>Agent asks</b> ${esc(d.agent || "")}</p><p class="user"><b>User</b> ${esc(d.user || "")}</p>`).join("")}<p class="agent"><b>Agent</b> ${esc(t.agent)}</p></div>`).join("");
  const j = g.judge || g.reply || {};
  const faults = (j.faults || []).map((f) => `<li class="${esc(f.severity)}">${esc(f.what)}</li>`).join("");
  const mh = (j.must_haves || []).map((m) => `<li class="${m.met === "yes" ? "ok" : "no"}">${esc(m.item)}<small>${esc(m.why)}</small></li>`).join("");
  const checks = (g.checks || []).map((c) => `<span class="chk ${c.pass ? "ok" : "no"}" title="${esc(JSON.stringify(c.got))}">${esc(c.name)}</span>`).join("");
  const chain = r.turns.flatMap((t) => (t.plan?.steps || []).map((s, i) => `<span data-s="${esc(t.ran?.[i]?.state || "")}">${esc(s.tool)}</span>`)).join(" → ");
  return `<article data-g="${g.group}" data-fx="${prev[g.id] && g.pass && !prev[g.id].pass ? 1 : 0}" data-p="${g.pass ? 1 : 0}" data-s="${g.score}" id="${g.id}"><header><span class="id">${g.id}</span><h3>${esc(g.title)}</h3>${prev[g.id] ? `<span class="was">was ${prev[g.id].score}</span>` : ""}<span class="score ${g.pass ? "pass" : "fail"}">${g.score}</span><button class="xp" data-x="${g.id}" title="Mark it; then ask Claude to explain the marked items">Explain this</button></header>
<p class="tests">${esc(g.case_name)} · ${esc(g.tests)}</p>${turns}${chain ? `<p class="plan">${chain}</p>` : ""}
<div class="out">${(g.outputs || []).map((p) => media(p)).join("") || `<p class="none">Nothing made</p>`}</div>${prev[g.id] ? `<details class="before"><summary>${esc(CMP)}: ${prev[g.id].score}${prev[g.id].pass ? " pass" : " fail"} · ${(prev[g.id].tools || []).join(" → ") || "its output"}</summary><div class="out">${(prev[g.id].outputs || []).map((p) => media(p, true)).join("") || "<p class=\"none\">Nothing made</p>"}</div><p class="sum">${esc((prev[g.id].judge || prev[g.id].reply || {}).summary || "")}</p></details>` : ""}
<div class="checks">${checks}</div>${j.summary ? `<p class="sum">${esc(j.summary)}</p>` : ""}${mh ? `<ul class="mh">${mh}</ul>` : ""}${faults ? `<ul class="faults">${faults}</ul>` : ""}
<p class="meta">${g.spent || 0} credits · ${g.seconds || 0} s${g.tags?.length ? " · " + g.tags.map(esc).join(", ") : ""}</p>
${g.pass || !diag[g.id] ? "" : (() => { const d = diag[g.id]; return `<div class="diag"><b>Diagnosis</b> <span class="cause">${esc(d.cause)}</span>${(d.also || []).filter((x) => x !== d.cause).map((x) => `<span class="cause also">${esc(x)}</span>`).join("")} <span class="v ${d.chain_logic}">chain ${esc(d.chain_logic)}</span><span class="v ${d.best_tools === "yes" ? "sound" : "flawed"}">best tools: ${esc(d.best_tools)}</span><span class="v ${d.inputs}">inputs ${esc(d.inputs)}</span><p>${esc(d.explanation)}</p>${d.missing ? `<p class="miss">Missing: ${esc(d.missing)}</p>` : ""}<p class="better"><b>Better chain</b> ${esc(d.better_chain)}</p></div>`; })()}${g.pass ? "" : `<details class="calls"><summary>Tool calls, inputs and outputs</summary>${trace(r) || "<p><em>No tool calls.</em></p>"}</details>
<div class="mynote" data-id="${g.id}"><b>Why I think it failed</b><div class="quick">${QUICK.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div><textarea rows="3" placeholder="Your note: what went wrong, what should have happened"></textarea><span class="saved"></span></div>`}</article>`;
};

const HAS_CX = existsSync(join(DIR, "compare-thinking.json"));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bench v1 ${esc(RUN)}</title>
<style>:root{--bg:#f6f5f2;--card:#fff;--fg:#1c1c1e;--mut:#6e6e73;--rule:#e2e0da;--ok:#2f9e57;--bad:#d64535;--warn:#c98a10;--acc:#3b5bdb;--soft:#f0eee9}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1e1e21;--fg:#ececee;--mut:#9a9aa0;--rule:#2e2e33;--acc:#7b93ff;--soft:#26262a;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,system-ui,sans-serif;padding:20px max(16px,4vw)}h1{font-size:22px;margin:0 0 2px}.head{color:var(--mut);margin:0}h2{font-size:16px;margin:26px 0 8px}h2 small{font-weight:400;color:var(--mut)}
.tw{overflow-x:auto}table{border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden;min-width:520px}td,th{padding:6px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:middle}th{font-size:12px;color:var(--mut);font-weight:600}td small{display:block;color:var(--mut);font-size:11px}tr.hot td{background:color-mix(in srgb,var(--bad) 9%,transparent)}
.ok{color:var(--ok)}.no{color:var(--bad)}.bar{display:inline-block;width:90px;height:7px;border-radius:4px;background:var(--soft);vertical-align:middle;overflow:hidden}.bar i{display:block;height:100%;background:var(--bad)}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 10px}.kpis div{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:8px 14px;color:var(--mut);font-size:12px}.kpis b{display:block;font-size:22px;color:var(--fg)}.kpis .ok b{color:var(--ok)}.kpis .no b{color:var(--bad)}
.split{display:flex;height:26px;border-radius:8px;overflow:hidden;font-size:12px;font-weight:600;max-width:760px}.split span{display:flex;align-items:center;padding:0 10px;color:#fff}.split .ok{background:var(--ok)}.split .no{background:var(--bad)}
.hint{color:var(--mut);margin:0 0 8px}.flag{background:var(--card);border-left:4px solid var(--warn);border-radius:8px;padding:8px 14px;margin:8px 0;max-width:900px}.flag p{margin:4px 0}.ids a{font:12px ui-monospace,monospace;margin-right:6px;text-decoration:none}
button{font:inherit;border:1px solid var(--rule);background:var(--card);color:var(--fg);border-radius:6px;padding:2px 8px;cursor:pointer}button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--rule);margin:16px 0 0}.tabs button{border:0;border-bottom:3px solid transparent;border-radius:0;background:none;padding:8px 16px;font-weight:600;color:var(--mut)}.tabs button.on{color:var(--fg);border-bottom-color:var(--acc);background:none}.tabs span{font-weight:400;color:var(--mut);margin-left:4px}
.bar2{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 14px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}#n{color:var(--mut);margin-left:6px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:14px}body.failtab main{grid-template-columns:1fr}article{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px;min-width:0}
article header{display:flex;gap:8px;align-items:baseline}.id{font:600 12px ui-monospace,monospace;color:var(--mut)}h3{margin:0;font-size:15px;flex:1}.score{font-weight:700;font-size:18px}.pass{color:var(--ok)}.fail{color:var(--bad)}
.tests{color:var(--mut);font-size:12px;margin:2px 0 8px}.turn p{margin:4px 0}.user b{color:var(--acc)}.agent b{color:var(--ok)}.q b{color:var(--warn)}.mat{color:var(--mut);font-size:12px}
.plan{font:12px ui-monospace,monospace;color:var(--mut)}[data-s=failed]{color:var(--bad)}.out{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.out img,.out video{max-width:100%;max-height:320px;border-radius:8px;background:#000}.out audio{width:100%}pre{white-space:pre-wrap;font-size:12px;background:var(--soft);padding:8px;border-radius:8px;max-height:200px;overflow:auto;margin:0}.none{color:var(--bad)}
.checks{display:flex;flex-wrap:wrap;gap:4px}.chk{font-size:11px;border-radius:5px;padding:1px 6px}.chk.ok{color:inherit;background:color-mix(in srgb,var(--ok) 15%,transparent)}.chk.no{color:inherit;background:color-mix(in srgb,var(--bad) 18%,transparent)}
.sum{font-style:italic;margin:8px 0 4px}ul{margin:4px 0;padding-left:18px}li small{display:block;color:var(--mut);font-size:12px}.mh li.ok{color:inherit}.mh li.ok::marker{content:"✓ ";color:var(--ok)}.mh li.no{color:inherit}.mh li.no::marker{content:"✗ ";color:var(--bad)}.faults li.major{color:var(--bad)}.faults li.minor{color:var(--mut)}.meta{color:var(--mut);font-size:12px;margin:6px 0 0}
details.calls{margin:10px 0;border:1px solid var(--rule);border-radius:10px;padding:6px 10px}details.calls summary{cursor:pointer;font-weight:600}.trace{list-style:none;padding:0;margin:6px 0}.tt{font-weight:600;margin:6px 0}
.trace li{border-left:3px solid var(--rule);padding:6px 0 6px 12px;margin:0 0 10px}.trace li[data-s=done]{border-color:var(--ok)}.trace li[data-s=failed]{border-color:var(--bad)}.call .mdl,.call .cr{color:var(--mut);font-size:12px}.call .st{font-size:11px;border-radius:5px;padding:0 6px;background:var(--soft)}
.prm{margin:4px 0;font-size:13px}.prm small,.why{color:var(--mut);font-size:12px}.why{margin:2px 0}.io{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px}.io>div{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}.lbl{font:600 11px ui-monospace,monospace;color:var(--mut);text-transform:uppercase;padding-top:4px}
figure{margin:0;max-width:240px}figure img.sm,figure video.sm{max-width:240px;max-height:170px;border-radius:6px;background:#000;display:block}figure audio{width:240px}figcaption{font:11px ui-monospace,monospace;color:var(--mut);word-break:break-all}figure pre{max-width:240px;max-height:150px}
.vd{font-size:11px;border-radius:5px;padding:0 6px;background:color-mix(in srgb,var(--bad) 18%,transparent)}.vd.ok{background:color-mix(in srgb,var(--ok) 15%,transparent)}.dissue{font-size:12px;color:var(--bad);margin:4px 0 0}
.diag{margin-top:10px;border:1px solid var(--warn);border-radius:10px;padding:8px 12px}.diag p{margin:6px 0}.cause{font:600 11px ui-monospace,monospace;border-radius:5px;padding:1px 6px;background:color-mix(in srgb,var(--warn) 25%,transparent);margin-right:4px}.cause.also{font-weight:400;background:var(--soft)}.v{font-size:11px;margin-left:6px;color:var(--mut)}.v.flawed{color:var(--bad)}.miss{color:var(--bad);font-size:13px}.better{font-size:13px;background:var(--soft);border-radius:8px;padding:6px 8px}
.was{font-size:12px;color:var(--mut)}.xp{font-size:11px;margin-left:6px}.xp.on{background:var(--warn);border-color:var(--warn);color:#fff}article.explain{border-color:var(--warn);box-shadow:0 0 0 2px color-mix(in srgb,var(--warn) 35%,transparent)}details.before{margin:6px 0;border:1px dashed var(--rule);border-radius:10px;padding:4px 10px}details.before summary{cursor:pointer;color:var(--mut);font-size:12px}
.note{font-size:12px;color:var(--mut);margin:4px 0 0}.pm{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--mut);margin:4px 0 0}.pm b{color:var(--fg);font-weight:600}.pfw{font-size:12px;color:var(--warn);margin:2px 0 0}.pfe{font-size:13px;border-left:3px solid var(--warn);padding:4px 10px;background:var(--soft);border-radius:0 8px 8px 0;margin:6px 0}.pfe.ok{border-color:var(--ok)}.err{font-size:12px;color:var(--bad);margin:4px 0 0}
.mynote{margin-top:10px;background:var(--soft);border-radius:10px;padding:10px}.quick{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.quick button{font-size:12px}.mynote textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--rule);border-radius:8px;padding:6px 8px;background:var(--card);color:var(--fg)}.saved{font-size:12px;color:var(--mut)}article.noted{border-color:var(--acc)}
[data-view]{display:none}body.v-run [data-view=run],body.v-film [data-view=film],body.v-cmp [data-view=cmp]{display:block}
${COMPARE_CSS}
details.ov{margin:10px 0;background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:6px 14px}details.ov>summary{cursor:pointer;font-weight:600;padding:4px 0}.sep{width:12px}
details.pr{margin:4px 0}details.pr>summary{cursor:pointer;color:var(--mut);font-size:12px}details.pr pre{max-height:320px}
.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:50;overflow:hidden;display:flex;align-items:center;justify-content:center}#lb[hidden]{display:none}#lbc{transform-origin:0 0;cursor:grab}#lbc img,#lbc video{max-width:92vw;max-height:88vh;display:block}#lbh{position:fixed;bottom:max(10px,env(safe-area-inset-bottom,0px));left:0;right:0;text-align:center;color:#ccc;font-size:12px;margin:0}
.stage{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;margin:12px 0}.stage header{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.stage h3{flex:none;margin:0}.stage .n{font:700 13px ui-monospace,monospace;background:var(--acc);color:#fff;border-radius:6px;padding:1px 7px}.stage .cr{margin-left:auto;color:var(--mut);font-size:12px}.tools{display:flex;flex-wrap:wrap;gap:4px}
.tl{font:600 11px ui-monospace,monospace;background:color-mix(in srgb,var(--acc) 15%,transparent);border-radius:5px 0 0 5px;padding:2px 6px}.md{font:11px ui-monospace,monospace;background:var(--soft);border-radius:0 5px 5px 0;padding:2px 6px;margin-right:4px}
.fhead{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;margin:12px 0}.fhead h2{margin:0}.fhead p{color:var(--mut);margin:4px 0 8px}figure.big video{max-width:100%;width:720px;max-height:none}
.grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.kf{border-top:1px solid var(--rule);padding:10px 0}.kh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.ck{font-size:12px}.ck.ok{color:var(--ok)}.ck.no{color:var(--bad)}
.io{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ins,.outs{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start}.arr{color:var(--mut);font-size:12px}.later{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-left:2px solid var(--ok);padding-left:8px}
figure img,figure video{max-width:240px;max-height:170px;border-radius:6px;background:#000;display:block}figure.vid video{max-width:360px;max-height:220px}.txt{margin:4px 0;font-size:13px}.flag{color:var(--warn);font-size:12px}.stage table{min-width:0}
@media(max-width:520px){main{grid-template-columns:1fr}}</style>
<h1>Bench v1 · ${esc(RUN)}</h1><p class="head">${N} items · <b>${pass} pass</b> · <b>${fail} fail</b> · mean ${mean(grades)} · ${credits.toLocaleString()} credits · free tier, agent only</p>
<nav class="tabs"><button data-t="run">${CMP ? "Rerun of the failures" : "Bench run"} <span>${N}</span></button>${HAS_CX ? `<button data-t="cmp">Agent vs Claude</button>` : ""}${FILM ? `<button data-t="film">Video pipeline</button>` : ""}<span id="noted" style="align-self:center;color:var(--mut);margin-left:auto;font-size:12px"></span></nav>
<div data-view="run"><details class="ov" open><summary>Overview: pass and fail, ${CMP ? "before and after, " : ""}causes, tools</summary>${overview}</details>
<div class="bar2"><button data-v="all" class="on">All ${N}</button>${P.length ? `<button data-v="fixed">Fixed ${fixed.length}</button>` : ""}<button data-v="fail">${P.length ? "Still failing" : "Failed"} ${fail}</button><span class="sep"></span><button data-f="" class="on">All groups</button>${Object.keys(groups).sort().map((k) => `<button data-f="${k}" title="${esc(names[k])}">${k}</button>`).join("")}<button data-o="score">Worst first</button><button data-nn="1">Without a note</button><button data-xf="1">Marked to explain <b id="xn"></b></button><span id="n"></span></div>
<main>${items.map(card).join("\n")}</main></div>
${HAS_CX ? `<div data-view="cmp">${compareTab({ DIR, items, trace, media, esc })}</div>` : ""}
${FILM ? `<div data-view="film">${filmTab({ V2, label: FILM, later: arg("--film-later", null), probe: arg("--probe", null) })}</div>` : ""}
<div id="lb" hidden><div id="lbc"></div><p id="lbh">scroll to zoom · drag to move · double-click to reset · Esc to close</p></div>
<script>
let G="",T="run",V="all",NN=false,XF=false,NOTES={};const arts=[...document.querySelectorAll("main article")],M=document.querySelector("main");
try{T=localStorage.getItem("tab2")||"run"}catch{}if(!document.querySelector('[data-t="'+T+'"]'))T="run";
function apply(){document.body.className="v-"+T+(V==="fail"?" failtab":"");let n=0;for(const a of arts){const s=(!G||a.dataset.g===G)&&(V!=="fail"||a.dataset.p==="0")&&(V!=="fixed"||a.dataset.fx==="1")&&(!NN||!a.classList.contains("noted"))&&(!XF||a.classList.contains("explain"));a.hidden=!s;n+=s}
document.getElementById("n").textContent=n+" shown";document.querySelectorAll("[data-t]").forEach(x=>x.classList.toggle("on",x.dataset.t===T));document.querySelectorAll("[data-f]").forEach(x=>x.classList.toggle("on",x.dataset.f===G));document.querySelectorAll("[data-v]").forEach(x=>x.classList.toggle("on",x.dataset.v===V));
document.getElementById("xn").textContent=Object.values(NOTES).filter(v=>v.explain).length||"";const k=Object.values(NOTES).filter(v=>v.text||v.tags?.length).length;document.getElementById("noted").textContent=k?k+" notes":""}
document.addEventListener("click",e=>{if(e.target.closest("#lb"))return;const z=e.target.closest(".zm");if(z&&!(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40)){e.preventDefault();openLB(z);return}
const b=e.target.closest("button,[data-go]");if(!b)return;
if("cf" in b.dataset){const c=b.dataset.cf;document.querySelectorAll("[data-cf]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll("article.cx").forEach(a=>a.hidden=!!c&&a.dataset.c!==c);return}
if(b.dataset.go){e.preventDefault();T="run";V="all";G="";apply();document.getElementById(b.dataset.go)?.scrollIntoView({block:"start"});return}
if(b.dataset.t){T=b.dataset.t;try{localStorage.setItem("tab2",T)}catch{}}if(b.dataset.v)V=b.dataset.v;if("f" in b.dataset)G=b.dataset.f;if(b.dataset.nn){NN=!NN;b.classList.toggle("on",NN)}if(b.dataset.xf){XF=!XF;b.classList.toggle("on",XF)}
if(b.dataset.x){const id=b.dataset.x,v=NOTES[id]=NOTES[id]||{};v.explain=!v.explain;showX(id);post(id)}
if(b.dataset.o){b.classList.toggle("on");(b.classList.contains("on")?[...arts].sort((x,y)=>x.dataset.s-y.dataset.s):arts).forEach(a=>M.appendChild(a))}
if(b.dataset.q){b.classList.toggle("on");save(b.closest(".mynote"))}apply()});
// the viewer: any picture or clip full-size; wheel zooms at the pointer, drag pans, double-click resets, Esc closes
const LB=document.getElementById("lb"),LC=document.getElementById("lbc");let sc=1,tx=0,ty=0,drag=null;
function put(){LC.style.transform="translate("+tx+"px,"+ty+"px) scale("+sc+")"}
function openLB(el){LC.innerHTML="";const c=el.tagName==="VIDEO"?Object.assign(document.createElement("video"),{src:el.currentSrc||el.src,controls:true,autoplay:true}):Object.assign(document.createElement("img"),{src:el.currentSrc||el.src});LC.appendChild(c);sc=1;tx=0;ty=0;LB.hidden=false;
const fit=()=>{const r=c.getBoundingClientRect();tx=(innerWidth-r.width)/2;ty=(innerHeight-r.height)/2;LC.style.position="absolute";LC.style.left="0";LC.style.top="0";put()};c.tagName==="IMG"?(c.complete?fit():c.onload=fit):(c.onloadedmetadata=fit)}
function closeLB(){LB.hidden=true;LC.innerHTML=""}
LB.addEventListener("wheel",e=>{e.preventDefault();const k=Math.exp(-e.deltaY*0.0015),ns=Math.min(12,Math.max(0.2,sc*k));tx=e.clientX-(e.clientX-tx)*(ns/sc);ty=e.clientY-(e.clientY-ty)*(ns/sc);sc=ns;put()},{passive:false});
LB.addEventListener("pointerdown",e=>{if(e.target.tagName==="VIDEO"&&e.offsetY>e.target.clientHeight-40)return;if(e.target===LB){closeLB();return}drag={x:e.clientX-tx,y:e.clientY-ty};LB.setPointerCapture(e.pointerId)});
LB.addEventListener("pointermove",e=>{if(!drag)return;tx=e.clientX-drag.x;ty=e.clientY-drag.y;put()});LB.addEventListener("pointerup",()=>drag=null);
LB.addEventListener("dblclick",e=>{sc=1;const c=LC.firstChild;if(c){LC.style.transform="";const r=c.getBoundingClientRect();tx=(innerWidth-r.width)/2;ty=(innerHeight-r.height)/2;put()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!LB.hidden)closeLB()});
// notes and "explain this" marks: saved to the run's notes.json through serve.mjs, where Claude reads them
const timers={};function post(id,box){const v=NOTES[id]||{};v.at=new Date().toISOString();clearTimeout(timers[id]);timers[id]=setTimeout(()=>fetch("notes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,...v})}).then(r=>{if(!r.ok)throw 0;if(box)box.querySelector(".saved").textContent="saved"}).catch(()=>{if(box)box.querySelector(".saved").textContent="not saved: open this page from the bench server";else alertBad()}),300)}
function alertBad(){document.getElementById("noted").textContent="mark not saved: open this page from the bench server"}
function showX(id){const a=document.getElementById(id);if(!a)return;const on=!!NOTES[id]?.explain;a.classList.toggle("explain",on);const b=a.querySelector(".xp");b.classList.toggle("on",on);b.textContent=on?"Marked to explain":"Explain this";apply()}
function save(box){const id=box.dataset.id;NOTES[id]={...(NOTES[id]||{}),text:box.querySelector("textarea").value,tags:[...box.querySelectorAll(".quick .on")].map(x=>x.dataset.q)};mark(box);post(id,box)}
function mark(box){const v=NOTES[box.dataset.id]||{};box.closest("article").classList.toggle("noted",!!(v.text||v.tags?.length));apply()}
document.addEventListener("input",e=>{const box=e.target.closest(".mynote");if(box){box.querySelector(".saved").textContent="…";save(box)}});
fetch("notes").then(r=>r.json()).then(n=>{NOTES=n||{};for(const id in NOTES)if(NOTES[id].explain)showX(id);for(const box of document.querySelectorAll(".mynote")){const v=NOTES[box.dataset.id];if(!v)continue;box.querySelector("textarea").value=v.text||"";box.querySelectorAll(".quick button").forEach(b=>b.classList.toggle("on",(v.tags||[]).includes(b.dataset.q)));mark(box)}}).catch(()=>{});
apply();if(location.hash&&document.getElementById(location.hash.slice(1))){T="run";apply();document.getElementById(location.hash.slice(1)).scrollIntoView()}
</script>`;
writeFileSync(OUT, html); console.log(`view → ${OUT} (${(html.length / 1024).toFixed(0)} KB, ${N} items)`);
