// Renders the pipeline report: one section per case, five steps, each with its input and output.
import { condText } from "./solver.js";
import { REFERENCE_ONLY } from "./signatures.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
function md(src) {
  const out = []; let para = []; let list = false;
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const close = () => { if (list) { out.push("</ul>"); list = false; } };
  for (const line of String(src).split("\n")) {
    const t = line.trim();
    if (!t) { flush(); close(); continue; }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); close(); out.push(`<h5>${inline(h[2])}</h5>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); close(); continue; }
    const li = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (li) { flush(); if (!list) { out.push("<ul>"); list = true; } out.push(`<li${li[1].length >= 2 ? ' class="sub"' : ""}>${inline(li[2])}</li>`); continue; }
    close(); para.push(t);
  }
  flush(); close();
  return out.join("\n");
}
const condRow = (c) => `<tr><td>${esc(c.subject)}</td><td>${esc(c.atom)}</td><td>${c.from != null ? `${esc(c.from)} → <strong>${esc(c.value)}</strong>` : esc(c.value)}</td><td>${c.rigid ? "rigid" : ""}</td></tr>`;
const condTable = (conds) => conds.length ? `<div class="tw"><table><thead><tr><th>Subject</th><th>Atom</th><th>Value</th><th></th></tr></thead><tbody>${conds.map(condRow).join("")}</tbody></table></div>` : `<p class="soft">No conditions.</p>`;
const io = (input, output) => `<div class="io"><div><p class="lab">Input</p>${input}</div><div><p class="lab">Output</p>${output}</div></div>`;
const LEAF = { given: "given input", ask: "ask the user", research: "research", authored: "authored text", generate: "generated" };

function groupings(spec, sigs) {
  const bySubject = new Map();
  for (const s of spec.segments) for (const c of s.conditions) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, new Set());
    bySubject.get(c.subject).add(c.atom);
  }
  for (const l of spec.layers) { if (!bySubject.has(l.subject)) bySubject.set(l.subject, new Set()); bySubject.get(l.subject).add(l.atom); }
  const binding = Object.fromEntries(spec.bindings.map((b) => [b.name, b]));
  const rows = [...bySubject.entries()].map(([subject, atoms]) => {
    const list = [...atoms];
    const tools = sigs.tools.filter((t) => t.kind !== "join").map((t) => {
      const sets = list.filter((a) => (t.makes.has(a) || t.passOrSet.has(a)) && !REFERENCE_ONLY.has(a));
      const passes = list.filter((a) => t.passes[a] || (REFERENCE_ONLY.has(a) && t.passOrSet.has(a)));
      const covered = new Set([...sets, ...passes]);
      return { name: t.name, sets, passes, n: covered.size };
    }).filter((t) => t.n === list.length).sort((a, b) => b.sets.length - a.sets.length).slice(0, 6);
    const b = binding[subject];
    return `<tr><td><strong>${esc(subject)}</strong>${b ? `<br><span class="soft">${esc(b.kind)} · ${b.real ? "real" : "fictional"} · ${esc(b.source)}</span>` : ""}</td><td>${list.map(esc).join(", ")}</td><td>${tools.length ? tools.map((t) => `${esc(t.name)} <span class="soft">(sets ${t.sets.length}, passes ${t.passes.length})</span>`).join("<br>") : `<span class="soft">no single tool covers all of these</span>`}</td></tr>`;
  });
  return `<div class="tw"><table><thead><tr><th>Group (binding)</th><th>Atoms</th><th>Tools with hard credit for every atom in the group</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function nodeCard(n, byId) {
  if (n.type === "leaf") return `<div class="node leaf"><p><span class="tag">${esc(n.id)}</span> <strong>${esc(LEAF[n.leaf] || n.leaf)}</strong> — ${esc(n.label)}</p>${n.conds?.length ? `<details><summary>${n.conds.length} conditions</summary>${condTable(n.conds)}</details>` : ""}</div>`;
  if (n.type === "unsolved") return `<div class="node bad"><p><span class="tag">${esc(n.id)}</span> <strong>unsolved</strong> — ${esc(n.goal?.label)}</p><p class="soft">${esc(n.reason)}</p></div>`;
  const inputs = n.inputs.map((i) => { const c = byId[i.node]; return `<li><code>${esc(i.slot)}</code> ← ${esc(i.node)} ${c ? `(${esc(c.type === "tool" ? c.tool : c.type === "leaf" ? LEAF[c.leaf] || c.leaf : "unsolved")})` : ""}</li>`; }).join("");
  const passes = n.passes.map((p) => `<li>${esc(p.cond.subject)}.${esc(p.cond.atom)} ← <code>${esc(p.slot)}</code>${p.cond.phase ? ` <span class="soft">(${p.cond.phase})</span>` : ""}</li>`).join("");
  const sets = n.sets.map((c) => `<li>${esc(condText(c))}</li>`).join("");
  const soft = n.soft.map((s) => `<li>${esc(condText(s.cond))} <span class="soft">(soft, ${esc(s.confidence)})</span></li>`).join("");
  return `<div class="node tool${n.join ? " join" : ""}"><p><span class="tag">${esc(n.id)}</span> <strong>${esc(n.tool)}</strong> <span class="soft">${n.join ? "join · " : ""}${esc(n.provider || "")}${n.proposed ? " · proposed" : ""}${n.uses > 1 ? ` · shared, used ${n.uses}×` : ""}</span></p>
    <p class="soft">${esc(n.label)}</p>
    <div class="cols3"><div><p class="lab">Inputs</p><ul>${inputs || "<li class=soft>none</li>"}</ul></div>
    <div><p class="lab">Passed through (held)</p><ul>${passes || "<li class=soft>none</li>"}</ul></div>
    <div><p class="lab">Made true by this tool</p><ul>${sets || ""}${soft}${!sets && !soft ? "<li class=soft>none</li>" : ""}</ul></div></div>
    <details><summary>Output state: ${n.goalConds.length} conditions true</summary>${condTable(n.goalConds)}</details></div>`;
}

function tree(id, byId, seen = new Set()) {
  const n = byId[id];
  const name = n.type === "tool" ? `${n.tool}${n.join ? " (join)" : ""}` : n.type === "leaf" ? `${LEAF[n.leaf] || n.leaf}` : "unsolved";
  const label = n.type === "tool" ? n.label : n.type === "leaf" ? n.label : n.goal?.label;
  if (seen.has(id)) return `<li><span class="tag">${id}</span> ${esc(name)} <span class="soft">↗ shared node, shown above</span></li>`;
  seen.add(id);
  const state = n.type === "tool" ? n.goalConds : n.conds || [];
  const kids = n.type === "tool" ? n.inputs.map((i) => `<li class="slot"><code>${esc(i.slot)}</code><ul>${tree(i.node, byId, seen)}</ul></li>`).join("") : "";
  return `<li><details ${n.depth < 2 ? "open" : ""}><summary><span class="tag">${id}</span> <strong class="${n.type}">${esc(name)}</strong> <span class="soft">— ${esc(label)} · ${state.length} conditions</span></summary>${state.length ? `<details class="state"><summary>state</summary>${condTable(state)}</details>` : ""}${kids ? `<ul>${kids}</ul>` : ""}</details></li>`;
}

function caseSection(r, sigs) {
  const { spec, plan } = r;
  const byId = Object.fromEntries(plan.nodes.map((n) => [n.id, n]));
  const tools = plan.nodes.filter((n) => n.type === "tool");
  const unsolved = plan.nodes.filter((n) => n.type === "unsolved");
  const leaves = plan.nodes.filter((n) => n.type === "leaf");

  const step1 = io(`<p class="req">“${esc(r.request)}”</p><p class="soft">Uploads: ${esc(r.uploads)}</p>`, `<p class="soft">Creative director, GPT-6.1 Sol (story prompt, v3a)</p><div class="doc">${md(r.story)}</div>`);
  const step2 = io(`<p class="soft">The story from step 1.</p>`, `<p class="soft">Change-based operational chunks, GPT-6.1 Sol (v5b)</p><details><summary>Show chunks</summary><div class="doc">${md(r.chunks)}</div></details>`);

  const segs = spec.segments.map((s) => `<details><summary><strong>${esc(s.id)}</strong> ${esc(s.name)} <span class="soft">· ${esc(s.type)} · ${s.duration_s} s${s.depends_on.length ? ` · depends on ${s.depends_on.map(esc).join(", ")}` : ""} · ${s.conditions.length} conditions</span></summary><p class="quote">“${esc(s.quote)}”</p>${condTable(s.conditions)}</details>`).join("");
  const groups = r.top.groups.map((g, i) => `<li>Group ${i + 1}: ${g.segmentIds.map(esc).join(" + ")} <span class="soft">(${g.duration} s, ${g.conds.length} conditions)</span></li>`).join("");
  const step3 = io(`<p class="soft">The operational chunks from step 2, the request and the uploads.</p>`, `
    <h4>Bindings</h4><div class="tw"><table><thead><tr><th>Name</th><th>Kind</th><th>Real</th><th>Source</th><th>Description</th></tr></thead><tbody>${spec.bindings.map((b) => `<tr><td><strong>${esc(b.name)}</strong></td><td>${esc(b.kind)}</td><td>${b.real ? "real" : "fictional"}</td><td>${esc(b.source)}${b.upload ? ` (${esc(b.upload)})` : ""}</td><td>${esc(b.description)}</td></tr>`).join("")}</tbody></table></div>
    <h4>Uploads: conditions already true</h4>${spec.uploads.length ? spec.uploads.map((u) => `<details><summary><strong>${esc(u.name)}</strong> (${esc(u.media)}) · ${u.satisfies.length} conditions</summary><p class="soft">${esc(u.description)}</p>${condTable(u.satisfies)}</details>`).join("") : `<p class="soft">No uploads.</p>`}
    <h4>Format</h4><p>${esc(spec.format.media)} · ${esc(spec.format.aspect)} · ${spec.format.total_duration_s} s</p>
    <h4>Segments (atomic conditions per chunk)</h4>${segs}
    <h4>Layers (span time across segments)</h4>${spec.layers.length ? condTable(spec.layers.map((l) => ({ subject: l.subject, atom: l.atom, value: `${l.value} (${l.start_s}–${l.end_s} s)`, from: null, rigid: l.rigid }))) : `<p class="soft">None.</p>`}
    <h4>Segment groups (continuous chunks merge; cuts split)</h4><ul>${groups}</ul>
    <h4>Groupings: which tools match which conditions</h4>${groupings(spec, sigs)}`);

  const epochs = plan.log.map((e) => `<div class="epoch" style="margin-left:${Math.min(e.depth, 8) * 18}px"><p><span class="tag">epoch ${e.depth}</span> <strong>${esc(e.goal.label)}</strong> <span class="soft">(${esc(e.goal.media)}${e.goal.refFor ? `, binding ${esc(e.goal.refFor)}` : ""}, ${e.goal.conds.length} conditions)</span> → <strong>${esc(e.decision)}</strong>${e.costs?.length > 1 ? ` <span class="soft">(cost search: ${e.costs.map((c) => `${esc(c.tool)} = ${c.cost}${c.unsolved ? ` [${c.unsolved} unsolved]` : ""}`).join(" · ")})</span>` : ""}</p>${e.candidates?.length ? `<details><summary>Candidates checked</summary><div class="tw"><table><thead><tr><th>Tool</th><th>All true?</th><th>Sets</th><th>Passes</th><th>Soft</th><th>Uncovered</th></tr></thead><tbody>${e.candidates.map((c) => `<tr><td>${esc(c.tool)}</td><td>${c.ok ? "yes" : "no"}</td><td>${c.sets}</td><td>${c.passes}</td><td>${c.soft}</td><td>${esc([...c.uncovered, ...c.missingSlots.map((m) => `missing input ${m}`)].join("; "))}</td></tr>`).join("")}</tbody></table></div></details>` : ""}<details><summary>Goal conditions</summary><ul>${e.goal.conds.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details></div>`).join("");
  const judge = r.judge.length ? `<h4>Soft-credit judgments (LLM reading each tool's nature)</h4><div class="tw"><table><thead><tr><th>Tool</th><th>Condition</th><th>Can?</th><th>Confidence</th><th>Reason</th></tr></thead><tbody>${r.judge.map((j) => `<tr><td>${esc(j.tool)}</td><td>${esc(j.condition)}</td><td>${j.can ? "yes" : "no"}</td><td>${esc(j.confidence)}</td><td>${esc(j.reason)}</td></tr>`).join("")}</tbody></table></div>` : "";
  const step4 = io(`<p class="soft">The state spec from step 3 (top goal: ${r.top.conds.length} conditions in ${r.top.groups.length} segment groups) and ${sigs.tools.length} tool signatures.</p>`, `${epochs}${judge}`);

  const levels = plan.schedule.map((ids, i) => i === 0 ? "" : `<h4>Execution level ${i}</h4>${ids.map((id) => nodeCard(byId[id], byId)).join("")}`).join("");
  const leafList = leaves.map((n) => nodeCard(n, byId)).join("");
  const step5 = io(`<p class="soft">The solver result from step 4.</p>`, `
    <p><strong>${tools.length}</strong> tool calls in <strong>${plan.schedule.length - 1}</strong> execution levels · <strong>${leaves.length}</strong> leaves (${Object.entries(leaves.reduce((m, n) => ((m[LEAF[n.leaf] || n.leaf] = (m[LEAF[n.leaf] || n.leaf] || 0) + 1), m), {})).map(([k, v]) => `${v} ${k}`).join(", ")}) · <strong>${unsolved.length}</strong> unsolved</p>
    <h4>Tree (root = finished video)</h4><ul class="tree">${plan.root ? tree(plan.root, byId) : ""}</ul>
    <h4>Leaves (execution level 0)</h4>${leafList}
    ${unsolved.length ? `<h4>Unsolved</h4>${unsolved.map((n) => nodeCard(n, byId)).join("")}` : ""}
    ${levels}`);

  return `<section id="${esc(r.id)}">
  <h2>${esc(r.title)}</h2><p class="req">“${esc(r.request)}”</p>
  <p class="soft">${tools.length} tool calls · ${plan.schedule.length - 1} execution levels · ${unsolved.length} unsolved</p>
  <h3>Step 1 · Creative director: story</h3>${step1}
  <h3>Step 2 · Creative director: change-based operational chunks</h3>${step2}
  <h3>Step 3 · State spec: atoms, bindings and groupings</h3>${step3}
  <h3>Step 4 · Solver epochs</h3>${step4}
  <h3>Step 5 · Final solution: tool calls by execution order</h3>${step5}
</section>`;
}

export function renderReport(results, sigs) {
  const summary = results.map((r) => {
    const t = r.plan.nodes.filter((n) => n.type === "tool").length;
    const u = r.plan.nodes.filter((n) => n.type === "unsolved").length;
    const leaves = r.plan.nodes.filter((n) => n.type === "leaf");
    const ask = leaves.filter((n) => n.leaf === "ask" || n.leaf === "research").length;
    return `<tr><td><a href="#${esc(r.id)}">${esc(r.title)}</a></td><td>${r.spec.segments.length}</td><td>${r.top.groups.length}</td><td>${t}</td><td>${r.plan.schedule.length - 1}</td><td>${ask}</td><td>${u}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>State Manager Pipeline</title>
<style>
:root { --bg:#f6f0e4; --ink:#3b2a1e; --soft:#7a5c44; --line:#d9cbb4; --card:#fbf7ef; --bad:#8a3b2a; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 Georgia, "Times New Roman", serif; }
main { max-width:1200px; margin:0 auto; padding:48px 16px 96px; }
h1 { font-weight:normal; font-size:34px; margin:0 0 8px; } h2 { font-weight:normal; font-size:28px; margin:0; }
h3 { font-weight:normal; font-size:20px; margin:32px 0 8px; color:var(--soft); border-bottom:1px solid var(--line); padding-bottom:4px; }
h4 { font-weight:normal; font-size:16px; margin:18px 0 6px; } h5 { font-size:15px; margin:12px 0 4px; }
section { border-top:2px solid var(--line); margin-top:56px; padding-top:28px; }
a { color:var(--ink); } .soft, .lede { color:var(--soft); } .req { font-style:italic; }
.lab { font-variant:small-caps; letter-spacing:.06em; color:var(--soft); margin:0 0 4px; }
.io { display:grid; grid-template-columns:minmax(200px,1fr) 3fr; gap:20px; }
.io > div { min-width:0; } .io > div:last-child { background:var(--card); border:1px solid var(--line); padding:12px 16px; }
.doc { font-size:14px; } .doc ul { padding-left:18px; } li.sub { margin-left:16px; }
.tw { overflow-x:auto; } table { border-collapse:collapse; width:100%; font-size:13px; margin:6px 0; }
th, td { border-bottom:1px solid var(--line); padding:4px 6px; text-align:left; vertical-align:top; } th { font-weight:normal; color:var(--soft); }
details { margin:4px 0; } summary { cursor:pointer; }
.quote { font-style:italic; color:var(--soft); font-size:13px; }
.tag { font-size:12px; color:var(--soft); border:1px solid var(--line); padding:0 4px; }
.epoch { border-left:2px solid var(--line); padding:2px 0 2px 10px; margin-top:6px; }
.node { border:1px solid var(--line); background:var(--bg); padding:8px 12px; margin:8px 0; } .node p { margin:2px 0; }
.node.join { border-style:dashed; } .node.bad { border-color:var(--bad); } .bad strong { color:var(--bad); }
.cols3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; font-size:13px; } .cols3 ul { padding-left:16px; margin:0; }
ul.tree, ul.tree ul { list-style:none; padding-left:18px; border-left:1px dotted var(--line); } ul.tree { border:0; padding-left:0; }
li.slot > code { font-size:12px; color:var(--soft); } strong.unsolved { color:var(--bad); }
@media (max-width: 820px) { .io, .cols3 { grid-template-columns:1fr; } }
</style></head><body><main>
<h1>State Manager Pipeline</h1>
<p class="lede">Natural language → story → change-based operational chunks → true/false conditions → solver epochs → tool-call plan. Tools are assumed to work perfectly. Steps 1–2 reuse the GPT-6.1 Sol creative director samples; step 3 is one GPT-6.1 Sol call per case; steps 4–5 are deterministic code over ${sigs.tools.length} tool signatures (plus LLM soft credit where no tool has hard credit).</p>
<div class="tw"><table><thead><tr><th>Case</th><th>Chunks</th><th>Segment groups</th><th>Tool calls</th><th>Execution levels</th><th>Ask / research leaves</th><th>Unsolved</th></tr></thead><tbody>${summary}</tbody></table></div>
${results.map((r) => caseSection(r, sigs)).join("")}
</main></body></html>`;
}
