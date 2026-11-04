// The C items (faces and characters) run by hand next to what the agent made, with the reason each differs.
// Writes results/c-manual/index.html. Usage: node V2/bench/v1/c-manual-view.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const m = (p) => /\.mp4$/.test(p) ? `<video class="zm" src="/${p}" controls preload="metadata"></video>` : /\.mp3$/.test(p) ? `<audio src="/${p}" controls></audio>` : `<img class="zm" src="/${p}" alt="">`;
const F = "sessions/manual-";
const ROWS = [
  { id: "C15a", ask: "Put the face from this portrait onto the woman in the first 5 seconds of the video. Keep the original sound, framing and everything else.",
    inputs: ["sessions/manual-C15a/materials/talk-one.mp4", "sessions/manual-C15a/materials/portrait-woman.jpg"],
    agent: ["sessions/b9-C15a/assets/tree-1/talk-one-face-replaced-5s.mp4"], agentChain: "trim → face-swap-video (Magic Hour /v1/face-swap) · 150 cr",
    hand: [`${F}C15a/assets/first5-replaced.mp4`], handChain: "trim → character-replace (Magic Hour /v1/character-replace, wan-animate 480p) · 490 cr",
    why: "The face swap did run, every time. It only replaces the inner face (eyes, brows, nose, mouth) and keeps the original hair, head shape and clothes. With a portrait of someone with different hair, the result still reads as the original woman; the judge passed it anyway (a grader miss). Character replace swaps the whole person and keeps the motion and sound. It's what the user means by \"put this person in\". It wasn't wired; it is now, and the planner is told the difference.",
    note: "My hand run cost more than it should: my trim setting was \"0-5\", which trim silently ignored, so 10 s was replaced (490 cr instead of about 245). Trim now reads \"0-5\" too." },
  { id: "C17a", ask: "Make this photo of me talk in an 8-second square video. Say exactly: “Hi everyone! Thanks for stopping by. I can't wait to show you what's new.” Friendly female English voice. No captions.",
    inputs: ["sessions/b5-C17a/materials/portrait-woman.jpg"],
    agent: ["sessions/b5-C17a/assets/tree-1/talking-portrait.mp4", "sessions/b5-C17a/assets/tree-1/speech.mp3"], agentChain: "write → voice (8 s) → talking-photo · 384 cr",
    hand: [], handChain: "not rerun: the agent's version already has the sound",
    why: "This one works. The file has a sound track: speech at a normal level (about −23 to −30 dB) from the start to about 5.5 s, then a short pause to fill 8 s. The mouth moves with it. The speech file is next to the video, so you can play it on its own. If the video plays silent for you, it's the browser's mute on the player; unmute it." },
  { id: "C17b", ask: "Make this photo of me say something about our sale. You write the line—keep it upbeat and don't invent discounts, dates or products. An 8-second square talking video, friendly male English voice, no captions.",
    inputs: ["sessions/manual-C17b/materials/portrait-man.jpg"],
    agent: ["sessions/b2-C17b/assets/tree-1/sale-talking-portrait.mp4"], agentChain: "write → voice → talking-photo · old run, before the voice fix: 4.5 s",
    hand: [`${F}C17b/assets/sale-talking.mp4`, `${F}C17b/assets/sale.mp3`], handChain: "voice (seconds: 8) → talking-photo · 384 cr",
    why: "The same cause as C17a: the voice tool ignored the 8 seconds, so the talking photo came out 4.5 s. That was fixed before, but C17b was never rerun. The hand run is 8 s with speech." },
  { id: "C16c", ask: "Draw a square storybook picture of a little robot courier at a train station: round teal body, one large amber eye, short red boots and a yellow mailbag. Then two more of that exact robot: at a cottage door, and under a giant mushroom in the rain.",
    inputs: [],
    agent: ["sessions/b4-C16c/assets/robot_courier.png", "sessions/b4-C16c/assets/tree-2/robot_cottage_delivery.png", "sessions/b4-C16c/assets/tree-2/robot_mushroom_shelter.png"], agentChain: "image (klein) | then image-edit ×2 (qwen) · 25 cr",
    hand: [`${F}C16c/assets/robot.png`, `${F}C16c/assets/robot-cottage.png`, `${F}C16c/assets/robot-mushroom.png`], handChain: "image (qwen) → image-edit ×2 (qwen), the design restated in every prompt · 30 cr",
    why: "Two causes. (1) The grader only looked at the last message's pictures, so the first robot was \"missing\" (a grader bug, T-057). (2) In the mushroom picture qwen drew two eyes: the edit prompt said \"the exact robot\" but didn't restate \"exactly one eye\". The hand run restates the design in every prompt, and all three keep one eye." },
  { id: "C15c", ask: "Swap both faces in this 10-second office clip: the man's face from the man's portrait, and the woman's from the woman's portrait. Keep their voices and the rest unchanged.",
    inputs: ["sessions/b9-C15c/materials/talk-two.mp4", "sessions/b9-C15c/materials/portrait-man.jpg", "sessions/b9-C15c/materials/portrait-woman.jpg"],
    agent: ["sessions/b9-C15c/assets/tree-2/talk-two-swapped.mp4"], agentChain: "check → face-swap-video, individual faces (2 mapped) · 245 cr",
    hand: [], handChain: "not run: out of credits",
    why: "The mapping was right (left man → man's portrait, woman → woman's portrait), and the swap ran, but it only changes the inner face, as in C15a. The man's portrait is decades older with grey hair, so nothing reads as swapped. Doing it properly means character-replace once per person (it picks the main person, or a point you give it), two passes on 10 s, about 980 cr. The clip also has three people (two men), so asking \"which man?\" was correct, but the test fails any question." },
];
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Faces and Characters</title>
<style>:root{--bg:#f5f4f0;--card:#fff;--fg:#1d1d1f;--mut:#6b6b70;--rule:#e1dfd8;--ok:#2d8f52;--bad:#c9412f;--warn:#b07a0c;--soft:#efede7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--soft:#25252a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--soft:#25252a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,system-ui,sans-serif;max-width:1200px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0}.sub{color:var(--mut)}article{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin:16px 0}h2{font-size:17px;margin:0 0 4px}.ask{color:var(--mut);font-size:13px;margin:0 0 10px;max-width:90ch}
.row{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1fr) minmax(0,1fr);gap:14px}@media(max-width:800px){.row{grid-template-columns:1fr}}
.lbl{font:600 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:0 0 4px}.chain{font:12px ui-monospace,monospace;color:var(--mut);margin:4px 0}
.media{display:flex;flex-wrap:wrap;gap:6px}.media img,.media video{max-width:100%;max-height:240px;border-radius:8px;background:#000}.media img{max-width:min(100%,220px)}.media audio{width:100%}
.why{margin:12px 0 0;max-width:95ch}.note{color:var(--warn);font-size:13px}.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9}#lb[hidden]{display:none}#lb img,#lb video{max-width:94vw;max-height:90vh}
table{border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden}td,th{padding:6px 12px;border-bottom:1px solid var(--rule);text-align:left}th{font-size:12px;color:var(--mut)}.tw{overflow-x:auto}</style>
<h1>Faces and characters (group C), by hand</h1>
<p class="sub">The agent's output next to the same job done by hand-written tool calls (no planner), on the free tier · 2026-11-01. Click any picture or video to enlarge.</p>
<div class="tw"><table><tr><th>Item</th><th>Agent</th><th>By hand</th><th>The cause</th></tr>
<tr><td>C15a</td><td>face barely changed</td><td>works (character-replace)</td><td>wrong tool: face swap keeps hair and head</td></tr>
<tr><td>C17a</td><td>works, with sound</td><td>not needed</td><td>speech is there; check the player isn't muted</td></tr>
<tr><td>C17b</td><td>4.5 s (old run)</td><td>8 s, works</td><td>voice-length bug, fixed earlier but not rerun</td></tr>
<tr><td>C16c</td><td>two eyes in one picture</td><td>one eye in all three</td><td>design not restated in each edit; grader dropped the first picture</td></tr>
<tr><td>C15c</td><td>swap too weak</td><td>not run (credits)</td><td>same as C15a, two people: character-replace ×2</td></tr></table></div>
${ROWS.map((r) => `<article><h2>${r.id}</h2><p class="ask">${esc(r.ask)}</p><div class="row">
<div><p class="lbl">What the user gave</p><div class="media">${r.inputs.map(m).join("") || "<em>nothing</em>"}</div></div>
<div><p class="lbl">The agent</p><p class="chain">${esc(r.agentChain)}</p><div class="media">${r.agent.map(m).join("")}</div></div>
<div><p class="lbl">By hand</p><p class="chain">${esc(r.handChain)}</p><div class="media">${r.hand.map(m).join("") || ""}</div></div></div>
<p class="why">${esc(r.why)}</p>${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}</article>`).join("")}
<div id="lb" hidden></div>
<script>const lb=document.getElementById("lb");document.addEventListener("click",e=>{if(e.target.closest("#lb")){lb.hidden=true;lb.innerHTML="";return}const z=e.target.closest(".zm");if(!z||(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40))return;e.preventDefault();const c=z.cloneNode();c.className="";if(c.tagName==="VIDEO"){c.controls=true;c.autoplay=true}lb.innerHTML="";lb.appendChild(c);lb.hidden=false});document.addEventListener("keydown",e=>{if(e.key==="Escape"){lb.hidden=true;lb.innerHTML=""}});</script>`;
const out = join(HERE, "results", "c-manual"); mkdirSync(out, { recursive: true }); writeFileSync(join(out, "index.html"), html); console.log("→", join(out, "index.html"));
