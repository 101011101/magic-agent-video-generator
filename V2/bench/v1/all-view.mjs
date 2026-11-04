// One page for the fixed items: the final output of each, the first one for comparison, where it stands and why, and
// links to the detailed pages. Writes results/all/index.html. Usage: node V2/bench/v1/all-view.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), R = join(HERE, "results");
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const G = (run, id) => JSON.parse(readFileSync(join(R, run, `${id}.grade.json`), "utf8"));
const m = (p, alpha) => /\.mp4$/.test(p) ? `<video class="zm" src="/${p}" controls preload="metadata"></video>` : /\.(mp3|wav)$/.test(p) ? `<audio src="/${p}" controls></audio>` : `<img class="zm${alpha ? " chk" : ""}" src="/${p}" alt="">`;
const ROWS = [
  ["A03d", "real-1", "real-7", "fixed", "Long exact address: qwen letters the short lines, and code sets the address exactly. The read-back now tells ' from ’."],
  ["A06c", "real-1", "real-6", "fixed", "Transparent logo: the AI cutter deleted the name. Now the plain background is keyed out by code and the letter edges are cleaned.", true],
  ["A06d", "real-1", "real-5", "fixed", "The palette never reached the planner (our hand-off dropped the user's words). It does now, and pre-flight checks it."],
  ["B10c", "real-1", "real-5", "fixed", "The test was wrong (asked 16:9 of a 5:3 photo with no cropping)."],
  ["C14b", "real-1", "real-12", "fixed", "Head swap (your choice): she is recognisably the portrait woman, curly hair included; the man is put back from the original by code. Before: our code swapped every face, then face swap changed only her inner face. The tests now ask for recognisable, with the hair allowed to come along.", false, "real-5", "Face swap (inner face only)"],
  ["C17a", "real-1", "real-5", "fixed", "The voice ignored 8 seconds. It now fits the asked length. The video has sound (unmute the player)."],
  ["C17b", "real-1", "real-10", "fixed", "The same voice-length cause as C17a; rerun after the fix: 8 s with speech."],
  ["C16c", "real-1", "latest", "accepted", "You said the agent's storybook version is fine. Two eyes in one picture; the grader also dropped the first picture (grader bug, T-057)."],
  ["B07a", "real-1", "latest", "limit", "qwen recolours well but redraws the frame. No free path gives a realistic recolour and a pixel-exact background (alternatives on the fixes page)."],
  ["C15a", "real-1", "real-11", "fixed", "Character replace: she is recognisably the portrait woman, and the scene, motion and sound stay; her hair and clothes come from the portrait. Face swap (right) kept her own look. The test now asks for recognisable.", false, "real-10", "Face swap (inner face only)"],
  ["C15c", "real-1", "real-11", "accepted", "You said it looks fine. The woman is replaced well (character replace). The agent used face swap for the man, so he doesn't take on the older portrait's look. Asking \"which man?\" is now allowed: the clip has two men."],
];
const tag = { fixed: ["Fixed", "ok"], accepted: ["Accepted", "ok"], limit: ["Model limit", "warn"], "trade-off": ["Trade-off", "warn"], partly: ["Partly", "bad"] };
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Fixes Overview</title>
<style>:root{--bg:#f5f4f0;--card:#fff;--fg:#1d1d1f;--mut:#6b6b70;--rule:#e1dfd8;--ok:#2d8f52;--bad:#c9412f;--warn:#b07a0c;--acc:#3651c9;--soft:#efede7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,system-ui,sans-serif;max-width:1240px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0}.sub{color:var(--mut);margin:4px 0 14px}.links{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.links a{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:6px 12px;color:var(--acc);text-decoration:none;font-weight:600}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px}.kpis div{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:8px 14px;color:var(--mut);font-size:12px}.kpis b{display:block;font-size:22px;color:var(--fg)}
article{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 16px;margin:12px 0;display:grid;grid-template-columns:200px minmax(0,1fr) minmax(0,1fr);gap:14px}article.three{grid-template-columns:200px repeat(3,minmax(0,1fr))}@media(max-width:860px){article,article.three{grid-template-columns:1fr}}
.id{font:600 12px ui-monospace,monospace;color:var(--mut)}h2{font-size:15px;margin:2px 0 6px}.t{display:inline-block;font-size:12px;font-weight:600;border-radius:6px;padding:1px 8px}.t.ok{background:color-mix(in srgb,var(--ok) 18%,transparent)}.t.warn{background:color-mix(in srgb,var(--warn) 22%,transparent)}.t.bad{background:color-mix(in srgb,var(--bad) 20%,transparent)}
.sc{font-size:13px;color:var(--mut);margin:6px 0}.sc b{color:var(--fg)}.why{font-size:13px;margin:6px 0 0}
.lbl{font:600 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:0 0 4px}.media{display:flex;flex-wrap:wrap;gap:6px}.media img,.media video{max-width:100%;max-height:220px;border-radius:8px;background:#000}.media img{max-width:min(100%,200px)}.media audio{width:100%}.none{color:var(--mut);font-style:italic}
img.chk{background:repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/16px 16px!important}.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9}#lb[hidden]{display:none}#lb img,#lb video{max-width:94vw;max-height:90vh}</style>
<h1>Fixes overview</h1>
<p class="sub">Bench v1, the items you asked about · the first run next to the latest, free tier · 2026-11-01. Click any picture or video to enlarge.</p>
<div class="kpis"><div><b>${ROWS.filter((r) => r[3] === "fixed").length}</b>fixed</div><div><b>${ROWS.filter((r) => r[3] === "accepted").length}</b>accepted as is</div><div><b>${ROWS.filter((r) => ["limit", "trade-off"].includes(r[3])).length}</b>model limit or trade-off</div><div><b>${ROWS.filter((r) => r[3] === "partly").length}</b>still partly failing</div><div><b>${JSON.parse(readFileSync(join(R, "latest", "grades.json"), "utf8")).filter((g) => g.pass).length} / 105</b>rerun set passing (was 38)</div></div>
<nav class="links"><a href="/fixes-1/">Before and after, with every tool call</a><a href="/c-manual/">Faces and characters, by hand</a><a href="/latest/">The whole bench (Agent vs Claude tab)</a></nav>
${ROWS.map(([id, b, a, st, why, alpha, alt, altName]) => { const gb = G(b, id), ga = G(a, id), gx = alt ? G(alt, id) : null; return `<article class="${gx ? "three" : ""}"><div><span class="id">${id}</span><h2>${esc(ga.title)}</h2><span class="t ${tag[st][1]}">${tag[st][0]}</span><p class="sc">score <b>${gb.score}</b> → <b>${ga.score}</b>${ga.pass ? " (pass)" : ""}</p><p class="why">${esc(why)}</p></div>
<div><p class="lbl">First run</p><div class="media">${(gb.outputs || []).map((p) => m(p, alpha)).join("") || '<span class="none">nothing made</span>'}</div></div>
<div><p class="lbl">Now${gx ? ` · score ${ga.score}` : ""}</p><div class="media">${(ga.outputs || []).map((p) => m(p, alpha)).join("") || '<span class="none">nothing made</span>'}</div></div>${gx ? `<div><p class="lbl">Or: ${esc(altName)} · score ${gx.score}</p><div class="media">${(gx.outputs || []).map((p) => m(p, alpha)).join("")}</div></div>` : ""}</article>`; }).join("")}
<div id="lb" hidden></div>
<script>const lb=document.getElementById("lb");document.addEventListener("click",e=>{if(e.target.closest("#lb")){lb.hidden=true;lb.innerHTML="";return}const z=e.target.closest(".zm");if(!z||(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40))return;e.preventDefault();const c=z.cloneNode();c.className="";if(c.tagName==="VIDEO"){c.controls=true;c.autoplay=true}lb.innerHTML="";lb.appendChild(c);lb.hidden=false});document.addEventListener("keydown",e=>{if(e.key==="Escape"){lb.hidden=true;lb.innerHTML=""}});</script>`;
mkdirSync(join(R, "all"), { recursive: true }); writeFileSync(join(R, "all", "index.html"), html); console.log("→ results/all/index.html");
