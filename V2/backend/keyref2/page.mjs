// The comparison page: the MCP baseline, keyref-1 (two clips) and a keyref2 run, side by side: film, frame strip, judge score
// and must-haves, pairwise result, paid calls and credits, references and why, the prompt, the vision checks; then the
// keyref2 run's continuity map (per chunk: every reference, where it came from, why) and its state timeline.
// Usage: node V2/backend/keyref2/page.mjs keyref2-1 V2/bench/v1/results/keyref2/index.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { V2, RUNS } from "../lib/env.js";

const [label = "keyref2-1", outArg = join(V2, "bench/v1/results/keyref2/index.html")] = process.argv.slice(2), out = resolve(outArg);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const J = JSON.parse(readFileSync(join(RUNS, label, "judge/judge.json"), "utf8"));
const R2 = JSON.parse(readFileSync(join(RUNS, label, "keyref.json"), "utf8")), R1 = JSON.parse(readFileSync(join(RUNS, "keyref-1/keyref.json"), "utf8"));
const M = JSON.parse(readFileSync(join(V2, "bench/v1/results/mcp-flower/I94a.json"), "utf8")), mcall = M.turns[0].calls.find((c) => c.name === "create_video_from_text"), margs = JSON.parse(mcall.arguments);
const u = (p) => `/${p}`;
const img = (src, cap) => `<figure><img loading="lazy" src="${esc(src)}" alt="${esc(cap)}" data-zoom><figcaption>${esc(cap)}</figcaption></figure>`;
const badge = (a) => `<span class="b ${a === "yes" ? "ok" : a === "no" ? "bad" : "mid"}">${esc(a)}</span>`;
const pairFor = (k) => Object.entries(J.pairs).find(([n]) => n.startsWith(`${k} vs`))?.[1];

const vlmTable = (vlm) => vlm.length ? `<details><summary>${vlm.length} vision check${vlm.length === 1 ? "" : "s"} (${vlm.reduce((n, v) => n + v.answers.length, 0)} questions)</summary>${vlm.map((v) => `<div class="vq"><b>${esc(v.stage)}</b> · ${esc(v.about)} ${v.stage === "pick" ? "" : `<span class="b ${v.pass ? "ok" : "bad"}">${v.pass ? "required all yes" : "a required check failed"}</span>`}
  <table><tbody>${v.answers.map((a) => `<tr><td>${esc(a.q)}${a.required === false ? ' <span class="mut">(info)</span>' : ""}</td><td>${badge(a.answer)}</td><td class="mut">${esc(a.evidence)}</td></tr>`).join("")}</tbody></table></div>`).join("")}</details>` : `<p class="mut">No vision checks: the MCP agent looked at nothing after the render (it reported the download link).</p>`;

const cols = [
  { key: "mcp", title: "Magic Hour MCP", sub: "a chat model with only the MCP", film: "sessions/mcp-mf1-I94a/assets/01-create_video_from_text.mp4",
    facts: [["model", `${margs.model}, ${margs.end_seconds} s, ${margs.resolution}, audio ${margs.audio ? "on" : "off"}`], ["paid calls", `1 (create_video_from_text)`], ["credits", M.spent], ["structure", "one generation, four timed shots in one prompt"]],
    refs: `<p class="mut">None: text only.</p>`, prompts: [["the prompt", margs.style.prompt]], vlm: [] },
  { key: "keyref-1", title: "keyref-1 (first try)", sub: "two clips joined by the last frame", film: "runs/keyref-1/clips/film.mp4",
    facts: [["model", `${R1.args.model}, 2 × 8 s, ${R1.args.resolution}, audio ${R1.args.audio ? "on" : "off"}`], ["paid calls", `${R1.calls.filter((c) => c.credits).length} (4 stills, 2 clips)`], ["credits", R1.credits], ["structure", "two generations; clip 2 starts from clip 1's last frame; ffmpeg join"]],
    refs: R1.state.clips.map((c) => `<p><b>clip ${c.n}:</b></p><ul>${c.refs.map((r) => `<li><code>@${esc(r.name)}</code> ← ${esc(r.source || r.file)}: ${esc(r.why)}</li>`).join("")}</ul>`).join(""),
    prompts: R1.state.clips.map((c) => [`clip ${c.n} (${c.prompt_chars} chars)`, c.prompt]), vlm: R1.vlm },
  { key: label, title: `${label} (MCP style)`, sub: "prompt first; one chunk; seeded sign", film: `runs/${label}/${R2.outputs.film}`,
    facts: [["model", `${R2.state.model.name}, ${R2.state.chunks.map((c) => `${c.seconds} s`).join(" + ")}, ${R2.state.model.resolution}, audio ${R2.state.audio.on ? "on" : "off"}`], ["paid calls", `${R2.paid_calls} (${R2.tools.filter((t) => t.credits).map((t) => t.for).join(", ")})`], ["credits", `${R2.credits} (budget ${R2.args.budget}; the sign still was reused, 0)`], ["structure", R2.state.length_plan.why]],
    refs: R2.state.chunks.map((c) => `<p><b>chunk ${c.n}:</b></p><ul>${c.refs.map((r) => `<li><code>@${esc(r.name)}</code> ← ${esc(r.from)}: ${esc(r.why)}</li>`).join("")}${c.notes.map((n) => `<li class="mut">${esc(n)}</li>`).join("")}</ul>`).join(""),
    prompts: R2.state.chunks.flatMap((c) => c.attempts.filter((a) => !a.skipped).map((a) => [`chunk ${c.n}${a.attempt > 1 ? " regeneration" : ""} (${a.prompt_chars} chars)`, a.prompt])), vlm: R2.vlm },
];

const col = (c) => {
  const s = J.scores[c.key], p = pairFor(c.key), fr = J.frames[c.key];
  return `<section class="col"><h2>${esc(c.title)}</h2><p class="mut">${esc(c.sub)}</p>
<video src="${esc(u(c.film))}" controls preload="metadata" playsinline></video>
<div class="strip">${fr.map((f, i) => img(u(f), `${1 + 2 * i} s`)).join("")}</div>
<div class="score"><span class="big">${s.score}</span><span class="mut">/100 · flower-judge</span>${c.key === "mcp" ? `<span class="mut"> (first judging: ${J.original?.mcp?.score ?? 88})</span>` : c.key === "keyref-1" ? `<span class="mut"> (first judging: ${J.original?.ours?.score ?? 70})</span>` : ""}</div>
<p>${esc(s.summary)}</p>
<table class="mh"><tbody>${s.must_haves.map((m) => `<tr><td>${badge(m.met)}</td><td><b>${esc(m.item)}</b><br><span class="mut">${esc(m.why)}</span></td></tr>`).join("")}</tbody></table>
${p ? `<div class="pair"><b>Pairwise vs the MCP:</b> ${p.winner_side === c.key ? `<span class="b ok">won</span>` : `<span class="b bad">lost</span>`} (${esc(p.strength)}; shown ${p.first === c.key ? "first" : "second"})<br><span class="mut">${esc(p.why)}</span></div>` : `<div class="pair mut">The baseline both runs are paired against.</div>`}
<h3>Paid calls and credits</h3><table><tbody>${c.facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
<h3>References attached, and why</h3>${c.refs}
<h3>Prompt${c.prompts.length > 1 ? "s" : ""}</h3>${c.prompts.map(([t, pr]) => `<details><summary>${esc(t)}</summary><pre>${esc(pr)}</pre></details>`).join("")}
<h3>Vision checks</h3>${vlmTable(c.vlm)}
</section>`;
};

// keyref2: the continuity map and the timeline (theory vs fact)
const st = R2.state, bank = st.bank, ss = st.seed_sources;
const cmap = st.chunks.map((c) => `<div class="card"><h3>Chunk ${c.n} · ${c.from}–${c.to} s of the piece (${c.seconds} s)</h3>
<table><thead><tr><th>reference</th><th>picture</th><th>from</th><th>why</th></tr></thead><tbody>${c.refs.map((r) => `<tr><td><code>@${esc(r.name)}</code></td><td style="width:140px">${img(u(`runs/${label}/${r.file}`), r.file)}</td><td>${esc(r.from)}</td><td>${esc(r.why)}</td></tr>`).join("")}
${c.notes.map((n) => `<tr><td colspan="4" class="mut">${esc(n)}</td></tr>`).join("")}</tbody></table>
<h4>Timeline: what the prose puts at each beat, and what the frame at that second shows</h4>
<div class="tw"><table><thead><tr><th>beat</th><th>checked at</th><th>frame</th><th>prose</th><th>expected → found</th></tr></thead><tbody>${c.timeline.map((b) => `<tr><td>${b.from}–${b.to} s</td><td>${b.t} s</td><td style="width:140px">${b.actual ? img(u(`runs/${label}/${Object.values(b.actual)[0]?.frame}`), `${b.t} s`) : ""}</td><td>${esc(b.text)}</td><td>${b.entities.map((id) => `<code>@${esc(id)}</code> ${b.actual ? badge(b.actual[id]?.answer) : "—"}${b.actual?.[id]?.evidence ? ` <span class="mut">${esc(b.actual[id].evidence)}</span>` : ""}`).join("<br>")}</td></tr>`).join("")}</tbody></table></div>
${(() => { const a = c.attempts.find((x) => x.key === c.chosen); return a?.frames ? `<div class="pairimg">${img(u(`runs/${label}/${a.frames.first}`), "first frame")}${img(u(`runs/${label}/${a.frames.last}`), "last frame")}</div>` : ""; })()}
${c.attempts.map((a) => `<p><b>${esc(a.key)}</b>: ${a.skipped ? `<span class="b bad">skipped</span> ${esc(a.skipped)}` : `${a.credits} credits; required checks ${a.check?.pass ? '<span class="b ok">all yes</span>' : '<span class="b bad">failed</span>'}`}${a.retry_reason ? `<br><span class="mut">${esc(a.retry_reason)}</span>` : ""}</p>`).join("")}</div>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flower ad: MCP vs keyref</title>
<style>
:root{--bg:#f7f5f1;--fg:#1d1c1a;--mut:#6b675f;--card:#fff;--line:#e3ded5;--acc:#2f6b4f;--ok:#2f7d4a;--bad:#b23b2e;--mid:#9a7a1c;--code:#f0ece4}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#151514;--fg:#ecebe7;--mut:#a29e95;--card:#1f1f1d;--line:#34332f;--acc:#7cc4a0;--ok:#6cc58a;--bad:#ef7d6f;--mid:#e0c060;--code:#262624}}
:root[data-theme=dark]{--bg:#151514;--fg:#ecebe7;--mut:#a29e95;--card:#1f1f1d;--line:#34332f;--acc:#7cc4a0;--ok:#6cc58a;--bad:#ef7d6f;--mid:#e0c060;--code:#262624}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1500px;margin:0 auto;padding:24px 16px 80px}h1{font-size:25px;margin:0 0 6px}h2{font-size:18px;margin:0}h3{font-size:14.5px;margin:18px 0 6px}h4{font-size:13.5px;margin:14px 0 4px}
.mut{color:var(--mut)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:12px 0}
.cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}@media (max-width:1000px){.cols{grid-template-columns:minmax(0,1fr)}}
.col{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0}
video{width:100%;border-radius:6px;background:#000;display:block;margin:8px 0}
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.pairimg{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:520px}
figure{margin:0}figure img{width:100%;display:block;border-radius:4px;cursor:zoom-in}figcaption{font-size:11px;color:var(--mut)}
.score{margin:10px 0 4px}.big{font-size:32px;font-weight:700;color:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;padding:5px 6px;border-bottom:1px solid var(--line)}th{color:var(--mut);font-weight:600}
.tw{overflow-x:auto}.b{display:inline-block;font-size:11.5px;padding:0 7px;border-radius:9px;border:1px solid currentColor;white-space:nowrap}.b.ok{color:var(--ok)}.b.bad{color:var(--bad)}.b.mid{color:var(--mid)}
.pair{margin:10px 0;padding:8px 10px;border-left:3px solid var(--acc);background:var(--code);border-radius:4px;font-size:13.5px}
details{margin:6px 0}summary{cursor:pointer;color:var(--acc)}pre{white-space:pre-wrap;background:var(--code);padding:10px;border-radius:6px;font-size:12.5px}
code{background:var(--code);padding:0 4px;border-radius:4px;overflow-wrap:anywhere}body{overflow-wrap:break-word}ul{padding-left:18px;margin:4px 0}.vq{margin:8px 0}
.lede{max-width:900px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:9;padding:16px}#lb.on{display:flex}#lb img{max-width:100%;max-height:100%;border-radius:6px}
</style></head><body><main>
<h1>Petal &amp; Stem, three ways</h1>
<p class="lede mut">The same brief: “${esc(R2.brief)}” Scores come from one judge, replicated for all three: 8 frames at 1, 3, …, 15 s, the must-haves of <code>bench/mcp/flower/items/I94a.json</code>, <code>flower-judge</code> (effort medium); pairwise <code>flower-pair</code> against the MCP's film, in random order. (The first judging gave the MCP 88 and keyref-1 70; this replica gives ${J.scores.mcp.score} and ${J.scores["keyref-1"].score}.)</p>
<div class="cols">${cols.map(col).join("")}</div>

<h2 style="margin-top:34px">${esc(label)}: how context is carried (the continuity map)</h2>
<div class="card"><b>Length plan.</b> ${esc(st.length_plan.why)}. <b>Model.</b> ${esc(st.model.why)}. <b>Audio.</b> ${esc(st.audio.why)}.</div>
<div class="card"><b>Research gate</b> (composer/story): ${R2.gate.fiction ? "fiction" : "nonfiction"}, research ${R2.gate.needs_research ? "needed" : "not needed"}: ${esc(R2.gate.why)}
<table><thead><tr><th>seed source</th><th>used?</th><th>why / what</th></tr></thead><tbody>
<tr><td>(1) the user's materials</td><td>${ss.user_materials.used ? badge("yes") : badge("no")}</td><td>${esc(ss.user_materials.why || JSON.stringify(ss.user_materials.items))}</td></tr>
<tr><td>(2) found real-world photos (Wikimedia Commons + vision pick, composer/assets)</td><td>${ss.found_photos.used ? badge("yes") : badge("no")}</td><td>${esc(ss.found_photos.why)}${ss.found_photos.items ? Object.entries(ss.found_photos.items).map(([k, v]) => `<br><code>@${esc(k)}</code>: ${v.page ? `<a href="${esc(v.page)}">${esc(v.title)}</a> · licence ${esc(v.license)}` : esc(v.why)}`).join("") : ""}</td></tr>
<tr><td>(3) a made still (qwen-image-2.1), for exact things that cannot be found</td><td>${ss.made_stills.used ? badge("yes") : badge("no")}</td><td>${Object.entries(bank).map(([k, b]) => `<code>@${esc(k)}</code>: ${esc(b.source)}. Why: ${esc(b.why)}`).join("<br>") || esc(ss.made_stills.why)}</td></tr>
</tbody></table></div>
<div class="card"><b>Elements</b><div class="tw"><table><thead><tr><th>element</th><th>kind</th><th>description</th><th>seed</th></tr></thead><tbody>${st.elements.map((e) => `<tr><td><code>@${esc(e.id)}</code></td><td>${esc(e.kind)}${e.exact_text.length ? `<br>exact: ${e.exact_text.map((t) => `“${esc(t)}”`).join(", ")}` : ""}</td><td>${esc(e.description)}</td><td>${e.seed.needed ? badge("yes") : badge("no")} ${esc(e.seed.why)}</td></tr>`).join("")}</tbody></table></div></div>
${cmap}
<div class="card"><b>State rules</b><ul>${st.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<p class="mut">This run has one chunk, so no reference came from an earlier frame: the map shows only the seed. With more than one chunk, each later chunk lists <code>@previous</code> (which frame, and whether the last frame passed) and every entity found in earlier frames (which chunk, which second, why).</p></div>
<p class="mut">Records: <code>V2/runs/${esc(label)}/keyref.json</code>, <code>V2/runs/${esc(label)}/judge/judge.json</code>, <code>V2/runs/keyref-1/keyref.json</code>, <code>V2/bench/v1/results/mcp-flower/I94a.json</code>. Pipeline: <code>V2/backend/keyref2/</code>.</p>
</main><div id="lb"></div>
<script>
const lb=document.getElementById('lb');
document.addEventListener('click',e=>{const t=e.target.closest('[data-zoom]');if(t&&!lb.contains(t)){const c=t.cloneNode();c.removeAttribute('data-zoom');lb.innerHTML='';lb.appendChild(c);lb.classList.add('on');}else if(lb.classList.contains('on')&&(e.target===lb||lb.contains(e.target))){lb.classList.remove('on');lb.innerHTML='';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){lb.classList.remove('on');lb.innerHTML='';}});
</script></body></html>`;
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html); console.log(`wrote ${out}`);
