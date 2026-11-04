// This round: the four items fixed (G35a, D20d, D23b, H41a) before and after, and the Banff chase film made with the
// composer's direct route (story → one text-to-video generation). Writes results/round-2/index.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), R = join(HERE, "results"), V2 = join(HERE, "..", "..");
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const G = (run, id) => JSON.parse(readFileSync(join(R, run, `${id}.grade.json`), "utf8"));
const m = (p) => /\.mp4$/.test(p) ? `<video class="zm" src="/${p}" controls preload="metadata"></video>` : `<img class="zm" src="/${p}" alt="">`;
const L = JSON.parse(readFileSync(join(V2, "runs", "banff-chase", "run.json"), "utf8")), d = L.build.direct, made = L.build.made["1"];
const ITEMS = [
  ["G35a", "real-1", "real-13", "Our code: compose read \"labels: Before, After\" as one label and put it on the left photo. That was fixed earlier, and G35b passed with the same code, but G35a had never been rerun."],
  ["D20d", "real-1", "real-13", "Our code: assemble always filled the frame and cropped, and silently ignored \"keep each whole photo, blurred background\". It now keeps every whole picture on a blurred copy of itself (fit: contain), by default too when a picture's shape is far from the frame's. The grader also \"heard\" speech in silence; it now reports a near-silent track as silent. Not a job for the film pipeline: the user's own photos shown as they are."],
  ["D23b", "real-1", "real-14", "Not text over-use: a code overlay is the right tool for a name caption on generated footage. The footage prompt said \"clear space for a lower third\", and the video model painted a fake TV banner with garbled words. Earlier patches didn't cover it. Code now removes such phrases from generation prompts and says \"no text, logos, banners\" instead. The overlay's dark backing was then lost to a bug of mine (the colour in capitals); fixed."],
  ["H41a", "real-1", "real-13", "Same as D20d: the two phone screenshots were cropped to their middle third by assemble; now they're shown whole. The grader read \"うんうん\" in the instrumental beat as speech; fixed. Right not to use the film pipeline: the user supplied the screens and wants them shown, so it's an assembled ad with music and an end card. The planner now has a rule for film pipeline vs tools."],
];
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Round Two Results</title>
<style>:root{--bg:#f5f4f0;--card:#fff;--fg:#1d1d1f;--mut:#6b6b70;--rule:#e1dfd8;--ok:#2d8f52;--bad:#c9412f;--acc:#3651c9;--soft:#efede7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--acc:#8199ff;--soft:#25252a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--acc:#8199ff;--soft:#25252a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,system-ui,sans-serif;max-width:1200px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0}h2{font-size:18px;margin:28px 0 8px}.sub{color:var(--mut);margin:4px 0 14px}p{max-width:85ch}
.film{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px 16px}.film video{width:100%;max-width:860px;border-radius:10px;background:#000;display:block}.film img{max-width:100%;border-radius:8px;margin-top:10px}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0;font-size:13px}.flow span{background:var(--soft);border-radius:8px;padding:4px 10px}.flow i{color:var(--mut);font-style:normal}
ul.req{margin:4px 0;padding-left:20px}details{margin:8px 0}summary{cursor:pointer;color:var(--acc)}pre{white-space:pre-wrap;font-size:12px;background:var(--soft);padding:10px;border-radius:8px}
article{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 16px;margin:12px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr);gap:14px}@media(max-width:860px){article{grid-template-columns:1fr}}
.id{font:600 12px ui-monospace,monospace;color:var(--mut)}h3{font-size:15px;margin:0 0 4px}.lbl{font:600 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:0 0 4px}.media img,.media video{max-width:100%;max-height:240px;border-radius:8px;background:#000}.sc{font-weight:700}.ok{color:var(--ok)}.no{color:var(--bad)}
.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9}#lb[hidden]{display:none}#lb img,#lb video{max-width:94vw;max-height:90vh}</style>
<h1>Round two</h1><p class="sub">Four items fixed, and one new film on the composer's direct route · free tier · 2026-11-01</p>
<h2>The Banff chase (new film)</h2>
<div class="film"><video src="/runs/banff-chase/clips/film.mp4" controls preload="metadata"></video>
<div class="flow"><span>brief</span><i>→</i><span>story (research: 8 facts, 6 looks of Banff)</span><i>→</i><span>route: direct (1 place, 1 scene, no recurring cast)</span><i>→</i><span>one 20 s text-to-video, minimax-h3 480p, with audio</span><i>→</i><span>film</span></div>
<p><b>${esc(L.story?.title || "")}</b> · ${d.seconds} s · 1 generation · ${made.rendered} s rendered · 480 credits · no keyframes, no stills, no references needed (text only, one place)</p>
<p>The requirements the planner held to, in the brief's own words:</p><ul class="req">${(d.requirements || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<details><summary>The prompt sent to the video model (${made.prompt.length} characters, timed beats)</summary><pre>${esc(made.prompt)}</pre></details>
<details><summary>The story stage's text</summary><pre>${esc(L.story?.story || "")}</pre></details>
<img class="zm" src="/runs/banff-chase/clips/frames.jpg" alt="frames every 2.5 s">
<p><b>How it reads:</b> the mountains are there throughout: snow peaks over a turquoise lake and lodgepole pines, then a winding road under cliffs. The graphite car hunts the red one the whole way. One continuous generation means there are no cuts to break continuity. The sound is the model's own (about −24 dB on average).</p>
<p><b>Where your key-references idea comes in:</b> this brief is text only and stays in one place, so it's case 1: one generation, no references. With the user's pictures (a car, a face) it's case 2: the same call with those pictures attached. Only a long piece with recurring people across places is case 3: per chunk of the screenplay, the references are the place's plate, the people's sheets and the previous chunk's last frame, with no painted keyframes. Cases 1 and 2 are built (T-058, by the other session). Case 3 is written up but not built yet.</p></div>
<h2>The four items</h2>
${ITEMS.map(([id, b, a, why]) => { const gb = G(b, id), ga = G(a, id); return `<article><div><span class="id">${id}</span><h3>${esc(ga.title)}</h3><p>score <span class="sc no">${gb.score}</span> → <span class="sc ${ga.pass ? "ok" : "no"}">${ga.score}</span></p><p class="lbl">Before</p><div class="media">${(gb.outputs || []).map(m).join("")}</div></div><div><p class="lbl">Now</p><div class="media">${(ga.outputs || []).map(m).join("")}</div></div><div><p class="lbl">What it was</p><p>${esc(why)}</p></div></article>`; }).join("")}
<div id="lb" hidden></div>
<script>const lb=document.getElementById("lb");document.addEventListener("click",e=>{if(e.target.closest("#lb")){lb.hidden=true;lb.innerHTML="";return}const z=e.target.closest(".zm");if(!z||(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40))return;e.preventDefault();const c=z.cloneNode();c.className="";if(c.tagName==="VIDEO"){c.controls=true;c.autoplay=true}lb.innerHTML="";lb.appendChild(c);lb.hidden=false});document.addEventListener("keydown",e=>{if(e.key==="Escape"){lb.hidden=true;lb.innerHTML=""}});</script>`;
mkdirSync(join(R, "round-2"), { recursive: true }); writeFileSync(join(R, "round-2", "index.html"), html); console.log("→ results/round-2/index.html");
