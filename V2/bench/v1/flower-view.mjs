// The flower shop ad two ways: the key-reference pipeline (runs/keyref-1) and the Magic Hour MCP baseline
// (results/mcp-flower): the pathways side by side, every call, the references, the outputs, and one judge on both.
// Writes results/flower-vs-mcp/index.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..", "..");
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const K = JSON.parse(readFileSync(join(V2, "runs/keyref-1/keyref.json"), "utf8")), M = JSON.parse(readFileSync(join(HERE, "results/mcp-flower/I94a.json"), "utf8")), J = JSON.parse(readFileSync(join(V2, "runs/keyref-1/compare/judge.json"), "utf8"));
const mt = M.turns[0], mcpCalls = mt.calls || [];
const refsOf = (n) => (K.outputs?.clips?.[n - 1]?.refs || K.state?.clips?.[n - 1]?.refs || []);
const img = (p, cap) => `<figure><img class="zm" src="/runs/keyref-1/${esc(p)}" alt=""><figcaption>${esc(cap)}</figcaption></figure>`;
const ours = K.tools.map((t, i) => `<li><b>${esc(t.tool)}</b> <span class="mut">${esc(t.model || "")} ${t.credits != null ? `· ${t.credits} cr` : ""}</span>${t.inputs?.length ? `<br><span class="mut">in: ${esc(t.inputs.join(", "))}</span>` : ""}${t.output ? `<br><span class="mut">out: ${esc(t.output)}</span>` : ""}<details><summary>prompt</summary><pre>${esc(t.prompt || "")}</pre></details></li>`).join("");
const vlm = K.vlm.map((v) => `<li><b>${esc(v.stage)}</b> · ${esc(v.about)}<ul>${(v.answers || []).map((a) => `<li class="${a.answer === "yes" ? "ok" : "no"}">${esc(a.q)} <b>${esc(a.answer)}</b> <span class="mut">${esc(a.evidence || "")}</span></li>`).join("")}</ul></li>`).join("");
const mcp = mcpCalls.map((c) => { const a = (() => { try { return typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments || {}; } catch { return { raw: c.arguments }; } })(); return `<li><b>${esc(c.name)}</b>${a.model ? ` <span class="mut">${esc(a.model)} · ${esc(a.resolution || "")} · ${esc(a.end_seconds || "")} s · audio ${esc(a.audio)}</span>` : ""}${a.style?.prompt ? `<details><summary>prompt (${a.style.prompt.length} characters)</summary><pre>${esc(a.style.prompt)}</pre></details>` : `<span class="mut"> ${esc(JSON.stringify(a).slice(0, 160))}</span>`}</li>`; }).join("");
const mh = (r) => r.must_haves.map((m) => `<li class="${m.met === "yes" ? "ok" : m.met === "partly" ? "pt" : "no"}">${esc(m.item)}<small>${esc(m.why)}</small></li>`).join("");
const clipRefs = [1, 2].map((n) => { const c = K.outputs.clips[n - 1] || {}; const rs = K.state.clips?.[n - 1]?.refs || c.refs || []; return `<div class="clip"><h4>Clip ${n} · ${c.seconds || 8} s</h4><div class="refs">${rs.map((r) => img(r.file || r.path || "", `@${r.name}${r.why ? ` · ${r.why}` : ""}`)).join("") || '<span class="mut">see the record</span>'}</div><video class="zm" src="/runs/keyref-1/${esc(c.file)}" controls preload="metadata"></video></div>`; }).join("");
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Flower Ad Pipelines</title>
<style>:root{--bg:#f5f4f0;--card:#fff;--fg:#1d1d1f;--mut:#6b6b70;--rule:#e1dfd8;--ok:#2d8f52;--bad:#c9412f;--warn:#b07a0c;--acc:#3651c9;--soft:#efede7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131315;--card:#1d1d20;--fg:#ececee;--mut:#9c9ca3;--rule:#2f2f34;--ok:#4cc27a;--bad:#ff6b57;--warn:#e0a92e;--acc:#8199ff;--soft:#25252a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,system-ui,sans-serif;max-width:1240px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0}h2{font-size:18px;margin:28px 0 8px}h4{margin:6px 0}.sub{color:var(--mut)}p{max-width:90ch}.mut{color:var(--mut);font-size:12px}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}@media(max-width:860px){.two{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 16px;min-width:0}.card video{width:100%;border-radius:8px;background:#000}.strip{width:100%;border-radius:8px}
.sc{font-size:28px;font-weight:700}.win{color:var(--ok)}ul{padding-left:18px}li{margin:3px 0}li small{display:block;color:var(--mut)}li.ok::marker{content:"✓ ";color:var(--ok)}li.no::marker{content:"✗ ";color:var(--bad)}li.pt::marker{content:"~ ";color:var(--warn)}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px}.flow span{background:var(--soft);border-radius:8px;padding:3px 8px}.flow i{font-style:normal;color:var(--mut)}
.refs{display:flex;flex-wrap:wrap;gap:6px}figure{margin:0;max-width:200px}figure img{max-width:200px;max-height:120px;border-radius:6px;display:block}figcaption{font-size:11px;color:var(--mut)}.clip video{max-width:100%;max-height:220px;margin-top:6px}
details{margin:2px 0}summary{cursor:pointer;color:var(--acc);font-size:12px}pre{white-space:pre-wrap;font-size:12px;background:var(--soft);padding:8px;border-radius:8px;max-height:300px;overflow:auto}
table{border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden}td,th{padding:6px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}th{font-size:12px;color:var(--mut)}.tw{overflow-x:auto}
.zm{cursor:zoom-in}#lb{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9}#lb[hidden]{display:none}#lb img,#lb video{max-width:94vw;max-height:90vh}</style>
<h1>Flower shop ad: two pipelines</h1><p class="sub">${esc(K.brief)}</p>
<div class="tw"><table><tr><th></th><th>Our key-reference pipeline</th><th>Magic Hour MCP (the chat model with the MCP only)</th></tr>
<tr><td>Score (same judge, same must-haves)</td><td><span class="sc">${J.ours.score}</span></td><td><span class="sc ${J.pair.winner_side === "mcp" ? "win" : ""}">${J.mcp.score}</span></td></tr>
<tr><td>Side by side (blind)</td><td colspan="2"><b>${J.pair.winner_side === "mcp" ? "MCP" : J.pair.winner_side === "ours" ? "Ours" : "Tie"}</b> (${esc(J.pair.strength)}): ${esc(J.pair.why)}</td></tr>
<tr><td>Credits</td><td>${K.credits} (4 reference stills 40, 2 clips 384)</td><td>${M.spent} (one clip)</td></tr>
<tr><td>Paid calls</td><td>6: 4 image generations (qwen-image-2.1) + 2 text-to-video (minimax-h3, 8 s each)</td><td>1: one text-to-video (ltx-2.5, 16 s)</td></tr>
<tr><td>Free calls</td><td>11 vision checks, 4 text-model calls (story, screenplay, 2 prompts), ffmpeg</td><td>3: workflow guide, wait, fetch</td></tr>
<tr><td>Sound</td><td>on (model's own: ambience and soft music; two stray words heard)</td><td>off</td></tr>
<tr><td>Time</td><td>about 12 min</td><td>${M.seconds} s</td></tr></table></div>
<h2>The two films</h2>
<div class="two"><div class="card"><h4>Ours: 2 clips joined by the last frame</h4><video class="zm" src="/runs/keyref-1/clips/film.mp4" controls preload="metadata"></video><img class="strip zm" src="/runs/keyref-1/compare/ours-strip.jpg" alt=""><ul>${mh(J.ours)}</ul><p><b>Judge:</b> ${esc(J.ours.summary)}</p></div>
<div class="card"><h4>MCP: 1 generation</h4><video class="zm" src="/sessions/mcp-mf1-I94a/assets/01-create_video_from_text.mp4" controls preload="metadata"></video><img class="strip zm" src="/runs/keyref-1/compare/mcp-strip.jpg" alt=""><ul>${mh(J.mcp)}</ul><p><b>Judge:</b> ${esc(J.mcp.summary)}</p></div></div>
<h2>The pathways</h2>
<div class="two"><div class="card"><h4>Ours</h4><div class="flow"><span>story</span><i>→</i><span>screenplay in 2 clips (checked against the model's limits)</span><i>→</i><span>state manager: which references</span><i>→</i><span>reference stills + vision checks</span><i>→</i><span>clip 1 (t2v + refs)</span><i>→</i><span>last frame checked</span><i>→</i><span>clip 2 (t2v + @previous + @shop)</span><i>→</i><span>join</span></div>
<p><b>References per clip</b></p>${clipRefs}
<details><summary>Every paid and code call</summary><ol>${ours}</ol></details>
<details><summary>The vision checks (questions and answers)</summary><ul>${vlm}</ul></details>
<details><summary>The story and the screenplay</summary><pre>${esc(K.story?.story || "")}\n\n${esc(JSON.stringify(K.screenplay, null, 1))}</pre></details></div>
<div class="card"><h4>MCP</h4><div class="flow"><span>read the workflow guide</span><i>→</i><span>one text-to-video, 16 s, ltx-2.5, no audio, a 4-shot timed prompt</span><i>→</i><span>wait</span><i>→</i><span>fetch</span></div>
<p><b>References:</b> none. The chat model wrote one prose prompt with four timed shots and "same florist, shop and bouquet throughout".</p><ol>${mcp}</ol><p class="mut">Its reply: ${esc((mt.agent || "").split("[Download")[0].slice(0, 300))}</p></div></div>
<h2>What this says</h2>
<p><b>For a 16-second, one-place ad, one generation wins.</b> A single generation keeps the bouquet, the people and the light consistent by itself. Splitting into two 8-second clips gave the model a cut to break continuity across, and the first clip already went wrong inside itself (the floating bouquet). Our structure paid off on the one thing it controls: the shop name is exact in both of our shots, while the MCP's opening sign is misspelled. Its final storefront is correct.</p>
<p><b>What to change on our side:</b></p><ul>
<li>Route by length and constraints first, as T-058 does. A brief that fits one generation (minimax-h3 up to 30 s, ltx-2.5 up to 60 s) with one place and no recurring cast across scenes goes to one text-to-video call. Forcing two clips here was the test's condition, not what the router would choose.</li>
<li>Use key references where they earn their place: an exact sign or product (a reference still of the shop front), the user's own pictures, and pieces longer than one generation.</li>
<li>When a state check fails on the last frame (here: "does Mara hold the bouquet?" got a no), regenerate that clip or pass an earlier, correct frame forward. Don't hand a wrong frame to the next clip.</li>
<li>Fewer beats per clip: three beats in 8 s made the model cut to close-ups and skip the unlocking.</li></ul>
<div id="lb" hidden></div>
<script>const lb=document.getElementById("lb");document.addEventListener("click",e=>{if(e.target.closest("#lb")){lb.hidden=true;lb.innerHTML="";return}const z=e.target.closest(".zm");if(!z||(z.tagName==="VIDEO"&&e.offsetY>z.clientHeight-40))return;e.preventDefault();const c=z.cloneNode();c.className="";if(c.tagName==="VIDEO"){c.controls=true;c.autoplay=true}lb.innerHTML="";lb.appendChild(c);lb.hidden=false});document.addEventListener("keydown",e=>{if(e.key==="Escape"){lb.hidden=true;lb.innerHTML=""}});</script>`;
mkdirSync(join(HERE, "results/flower-vs-mcp"), { recursive: true }); writeFileSync(join(HERE, "results/flower-vs-mcp/index.html"), html); console.log("→ results/flower-vs-mcp/index.html");
