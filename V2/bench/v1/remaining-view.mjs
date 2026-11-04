// The items still failing on the latest bench, grouped by where they broke (the expert audit), each with its output,
// what the judge missed, the expert's diagnosis and fix, whether today's fixes already cover it (a rerun would show), a
// note box and an "explain" mark (saved to results/remaining/notes.json through serve.mjs). Usage: node V2/bench/v1/remaining-view.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), L = join(HERE, "results", "latest"), OUT = join(HERE, "results", "remaining");
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const m = (p) => /\.mp4$/.test(p) ? `<video class="zm" src="/${p}" controls preload="metadata"></video>` : /\.(mp3|wav)$/.test(p) ? `<audio src="/${p}" controls></audio>` : /\.(png|jpe?g)$/.test(p) ? `<img class="zm" src="/${p}" alt="">` : /\.(txt|srt|md)$/.test(p) && existsSync(join(HERE, "..", "..", p)) ? `<pre>${esc(readFileSync(join(HERE, "..", "..", p), "utf8").slice(0, 600))}</pre>` : `<code>${esc(p.split("/").pop())}</code>`;
const fails = JSON.parse(readFileSync(join(L, "grades.json"), "utf8")).filter((g) => !g.pass);
const GROUP = [
  ["harness", "Our code between steps", "the plan was reasonable; our code did the wrong thing"],
  ["agent-reasoning", "The agent's plan", "the planner's logic was wrong"],
  ["wrong-tool", "Wrong tool", "a better tool existed"],
  ["missing-tool", "No tool for it", "nothing in the catalogue can do it"],
  ["grader", "The grader", "the output may be fine; the check is wrong"],
  ["model-limit", "Model limit", "the plan and code were right; the free model fell short"],
  ["spec", "The test", "the test asks for the wrong thing"],
];
// what today's fixes already cover, by what the expert's fix names (a rerun shows whether it holds)
const DONE = [[/voice[^.]*(seconds|length)|pace|fit the (asked )?length/i, "voice length"], [/text-overlay[^.]*(colou?r|box|font|size|align)/i, "text-overlay styling"], [/read-?back|fixText|stray/i, "lettering read-back"], [/sheet|quote|palette|never (saw|shown)/i, "the user's words reach the planner"], [/face_swap_mode|all-faces|individual/i, "one-face swaps"], [/background-remove|transparent|alpha/i, "transparency"], [/trim[^.]*range|\b0-5\b/i, "trim ranges"], [/deliverable|earlier turn/i, null], [/assemble/i, null]];
const covered = (e) => { if (!e) return []; const t = `${e.fix} ${e.agent_vs_you}`; return [...new Set(DONE.filter(([re, n]) => n && re.test(t)).map(([, n]) => n))]; };
const needs = (e) => { if (!e) return []; const t = `${e.fix} ${e.agent_vs_you}`; return [[/assemble/i, "assemble: timing, dissolves, fit, voice-over mix"], [/caption/i, "captions styling"], [/deliverable|earlier turn|feeds/i, "grader: count every deliverable"], [/transcri|speech heard|invent/i, "grader: speech check from audio"], [/conform|overshoot|minimax.*long/i, "conform clip length"], [/probe|has audio|silent/i, "audio probe tool"], [/translat|dub/i, "translation"]].filter(([re]) => re.test(t)).map(([, n]) => n); };
const video = (r) => r.turns.some((t) => (t.plan?.steps || []).some((s) => /video|clip|talking|lip|assemble|captions|music|voice|trim/.test(s.tool)));
const card = (g) => { const r = JSON.parse(readFileSync(join(L, `${g.id}.json`), "utf8")), e = existsSync(join(L, "expert", `${g.id}.json`)) ? JSON.parse(readFileSync(join(L, "expert", `${g.id}.json`), "utf8")) : null, j = g.judge || g.reply || {};
  const cov = covered(e), nd = needs(e), chain = r.turns.map((t) => (t.plan?.steps || []).map((s, i) => `${s.tool}${t.ran?.[i]?.state && t.ran[i].state !== "done" ? ` (${t.ran[i].state})` : ""}`).join(" → ")).filter(Boolean).join(" | ");
  return `<article id="${g.id}" data-c="${esc(e?.root_cause || "none")}" data-v="${video(r) ? 1 : 0}" data-r="${cov.length && !nd.length ? 1 : 0}"><header><span class="id">${g.id}</span><h3>${esc(g.title)}</h3><span class="sc">${g.score}</span><span class="cr">${g.spent || 0} cr last time</span><button class="xp" data-x="${g.id}">Explain this</button></header>
<p class="ask">${esc(r.turns.map((t) => t.text).join(" / "))}</p>${chain ? `<p class="chain">${esc(chain)}</p>` : '<p class="chain">no tool calls</p>'}
<div class="body"><div class="media">${(g.outputs || []).map(m).join("") || '<span class="none">nothing made</span>'}</div><div class="txt">
<p class="jd"><b>Judge:</b> ${esc(j.summary || (g.checks || []).filter((c) => !c.pass).map((c) => c.name).join(", "))}</p>
${(j.must_haves || []).filter((x) => x.met !== "yes").map((x) => `<p class="miss">✗ ${esc(x.item)}<small>${esc(x.why)}</small></p>`).join("")}
${e ? `<details><summary>Where it broke and the fix (expert audit, before today's fixes)</summary><p>${esc(e.agent_vs_you)}</p><p class="fix"><b>Fix:</b> ${esc(e.fix)}</p></details>` : ""}
<p class="st">${cov.length ? `<span class="t ok">covered by today's fixes: ${esc(cov.join(", "))}</span>` : ""}${nd.length ? `<span class="t bad">still needs: ${esc(nd.join("; "))}</span>` : ""}${!cov.length && !nd.length ? `<span class="t warn">needs a look</span>` : ""}</p>
<div class="mynote" data-id="${g.id}"><textarea rows="2" placeholder="Your note: what's wrong, what should happen"></textarea><span class="saved"></span></div></div></div></article>`; };
const by = {}; for (const g of fails) { const e = existsSync(join(L, "expert", `${g.id}.json`)) ? JSON.parse(readFileSync(join(L, "expert", `${g.id}.json`), "utf8")) : null; (by[e?.root_cause || "none"] ??= []).push(g); }
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Remaining Failures</title>
<style>:root{--bg:#f5f4f0;--card:#fff;--fg:#1d1d1f;--mut:#6b6b70;--rule:#e1dfd8;--ok:#2d8f52;--bad:#c9412f;--warn:#b07a0c;--acc:#3651c9;--soft:#efede7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,system-ui,sans-serif;max-width:1240px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0}.sub{color:var(--mut);margin:4px 0 14px}h2{font-size:17px;margin:26px 0 4px}h2 small{font-weight:400;color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:6px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:3}button{font:inherit;border:1px solid var(--rule);background:var(--card);color:var(--fg);border-radius:6px;padding:3px 10px;cursor:pointer}button.on{background:var(--acc);color:#fff;border-color:var(--acc)}#n{color:var(--mut);align-self:center;margin-left:6px}
article{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 16px;margin:10px 0}article header{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.id{font:600 12px ui-monospace,monospace;color:var(--mut)}h3{margin:0;font-size:15px;flex:1}.sc{font-weight:700;color:var(--bad)}.cr{font-size:12px;color:var(--mut)}
.ask{color:var(--mut);font-size:13px;margin:4px 0}.chain{font:12px ui-monospace,monospace;color:var(--mut);margin:2px 0 8px}.body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:14px}@media(max-width:800px){.body{grid-template-columns:1fr}}
.media{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start}.media img,.media video{max-width:100%;max-height:230px;border-radius:8px;background:#000}.media img{max-width:min(100%,220px)}.media audio{width:100%}pre{white-space:pre-wrap;font-size:12px;background:var(--soft);padding:8px;border-radius:8px;max-height:180px;overflow:auto;margin:0;width:100%}.none{color:var(--mut);font-style:italic}
.jd{margin:0 0 6px}.miss{font-size:13px;margin:3px 0}.miss small{display:block;color:var(--mut)}details{margin:6px 0;font-size:13px}summary{cursor:pointer;color:var(--acc)}.fix{background:var(--soft);border-radius:8px;padding:6px 8px}
.t{display:inline-block;font-size:12px;border-radius:6px;padding:1px 8px;margin:2px 4px 2px 0}.t.ok{background:color-mix(in srgb,var(--ok) 18%,transparent)}.t.bad{background:color-mix(in srgb,var(--bad) 18%,transparent)}.t.warn{background:color-mix(in srgb,var(--warn) 22%,transparent)}
.mynote textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--rule);border-radius:8px;padding:6px 8px;background:var(--soft);color:var(--fg);margin-top:6px}.saved{font-size:12px;color:var(--mut)}.xp{font-size:12px}.xp.on{background:var(--warn);border-color:var(--warn);color:#fff}article.explain{border-color:var(--warn)}
.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9}#lb[hidden]{display:none}#lb img,#lb video{max-width:94vw;max-height:90vh}</style>
<h1>Remaining failures</h1>
<p class="sub">${fails.length} of the 105 rerun items still fail (46 pass). They're grouped by where the expert audit found each one broke. That audit was done before today's fixes, so items marked "covered" may already pass on a rerun. Notes and "Explain this" marks are saved.</p>
<div class="bar"><button data-f="" class="on">All ${fails.length}</button>${GROUP.filter(([k]) => by[k]).map(([k, n]) => `<button data-f="${k}">${n} ${by[k].length}</button>`).join("")}<span style="width:10px"></span><button data-k="v0">Not video ${fails.filter((g) => !video(JSON.parse(readFileSync(join(L, `${g.id}.json`), "utf8")))).length}</button><button data-k="v1">Video</button><button data-k="r1">Covered, needs a rerun</button><button data-k="x">Marked to explain <b id="xn"></b></button><span id="n"></span></div>
${GROUP.filter(([k]) => by[k]).map(([k, n, d]) => `<section data-g="${k}"><h2>${n} <small>${by[k].length} · ${d}</small></h2>${by[k].sort((a, b) => a.id.localeCompare(b.id)).map(card).join("")}</section>`).join("")}
<div id="lb" hidden></div>
<script>let F="",K="",NOTES={};const arts=[...document.querySelectorAll("article")];
function apply(){let n=0;for(const a of arts){const s=(!F||a.dataset.c===F)&&(!K||(K==="v0"&&a.dataset.v==="0")||(K==="v1"&&a.dataset.v==="1")||(K==="r1"&&a.dataset.r==="1")||(K==="x"&&a.classList.contains("explain")));a.hidden=!s;n+=s}document.querySelectorAll("section").forEach(s=>s.hidden=![...s.querySelectorAll("article")].some(a=>!a.hidden));document.getElementById("n").textContent=n+" shown";document.getElementById("xn").textContent=Object.values(NOTES).filter(v=>v.explain).length||""}
const lb=document.getElementById("lb");
document.addEventListener("click",e=>{if(e.target.closest("#lb")){lb.hidden=true;lb.innerHTML="";return}const z=e.target.closest(".zm");if(z&&!(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40)){e.preventDefault();const c=z.cloneNode();c.className="";if(c.tagName==="VIDEO"){c.controls=true;c.autoplay=true}lb.innerHTML="";lb.appendChild(c);lb.hidden=false;return}
const b=e.target.closest("button");if(!b)return;if("f" in b.dataset){F=b.dataset.f;document.querySelectorAll("[data-f]").forEach(x=>x.classList.toggle("on",x===b))}if(b.dataset.k){K=K===b.dataset.k?"":b.dataset.k;document.querySelectorAll("[data-k]").forEach(x=>x.classList.toggle("on",x.dataset.k===K))}
if(b.dataset.x){const id=b.dataset.x;NOTES[id]={...(NOTES[id]||{}),explain:!NOTES[id]?.explain};showX(id);post(id)}apply()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){lb.hidden=true;lb.innerHTML=""}});
function showX(id){const a=document.getElementById(id);const on=!!NOTES[id]?.explain;a.classList.toggle("explain",on);const b=a.querySelector(".xp");b.classList.toggle("on",on);b.textContent=on?"Marked to explain":"Explain this"}
const T={};function post(id){const v=NOTES[id]||{};clearTimeout(T[id]);T[id]=setTimeout(()=>fetch("notes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,text:v.text||"",tags:[],at:new Date().toISOString(),explain:!!v.explain})}).then(r=>{const s=document.querySelector('.mynote[data-id="'+id+'"] .saved');if(s)s.textContent=r.ok?"saved":"not saved"}).catch(()=>{}),500)}
document.querySelectorAll(".mynote textarea").forEach(t=>t.addEventListener("input",()=>{const id=t.closest(".mynote").dataset.id;NOTES[id]={...(NOTES[id]||{}),text:t.value};post(id)}));
fetch("notes").then(r=>r.json()).then(n=>{NOTES=n||{};for(const [id,v] of Object.entries(NOTES)){const box=document.querySelector('.mynote[data-id="'+id+'"] textarea');if(box&&v.text)box.value=v.text;if(document.getElementById(id))showX(id)}apply()}).catch(()=>apply());
apply();</script>`;
mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, "index.html"), html); console.log(`→ ${OUT}/index.html (${fails.length} items)`);
