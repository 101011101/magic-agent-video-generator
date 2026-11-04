// The page of a key-references run: brief, story, batches, state table, references per clip, vision Q&A, prompts, every
// tool call, the clips and the film, the continuity strip, and a short read. Usage: node page.mjs <label> <out.html>
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNS } from "../lib/env.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function writePage(rec, out) {
  const L = rec.label, url = (f) => `/runs/${L}/${f}`, img = (f, cap = "") => `<figure><img loading="lazy" src="${url(f)}" alt="${esc(cap)}" data-zoom><figcaption>${esc(cap)}</figcaption></figure>`;
  const vid = (f, cap = "") => `<figure><video src="${url(f)}" controls preload="metadata" playsinline data-zoom></video><figcaption>${esc(cap)}</figcaption></figure>`;
  const sp = rec.screenplay, st = rec.state, outs = rec.outputs?.clips || [], read = existsSync(join(RUNS, L, "read.json")) ? JSON.parse(readFileSync(join(RUNS, L, "read.json"), "utf8")) : null;
  const badge = (a) => `<span class="b ${a === "yes" ? "ok" : a === "no" ? "bad" : "mid"}">${esc(a)}</span>`;
  const vlmBlock = (v) => `<div class="card vlm"><div class="vh"><b>${esc(v.stage)}</b> · ${esc(v.about)} ${v.stage === "pick" ? "" : `<span class="b ${v.pass ? "ok" : "bad"}">${v.pass ? "all yes" : "not all yes"}</span>`}</div>
    <div class="thumbs sm">${v.images.map((f, i) => img(f, v.labels?.[i] || "")).join("")}</div>
    <table><thead><tr><th>question</th><th>answer</th><th>what the model saw</th></tr></thead><tbody>${v.answers.map((a) => `<tr><td>${esc(a.q)}</td><td>${badge(a.answer)}</td><td>${esc(a.evidence)}</td></tr>`).join("")}</tbody></table></div>`;
  const toolCount = rec.tools.reduce((m, t) => ((m[t.tool] = (m[t.tool] || 0) + 1), m), {}); toolCount["vision (yes/no questions)"] = rec.vlm.length; toolCount["LLM text"] = rec.llm.length;
  const paid = rec.tools.filter((t) => t.credits || t.tool !== "ffmpeg");
  const strip = outs.length > 1 ? outs.slice(1).map((m, i) => { const p = outs[i]; return `<h3>clip ${p.n} → clip ${m.n}</h3><div class="strip">${p.closing.map((f, j) => img(f, `clip ${p.n} at ${p.closeT[j]} s`)).join("")}<div class="cut">cut</div>${m.opening.map((f, j) => img(f, `clip ${m.n} at ${m.openT[j]} s`)).join("")}</div><p class="note">SSIM of clip ${p.n}'s last frame against clip ${m.n}'s first frame: <b>${m.ssim_join ?? "—"}</b> (1 = identical; the stitch does no blending).</p>`; }).join("") : "<p>Only one clip was made.</p>";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Key references test</title>
<style>
:root{--bg:#f7f5f1;--fg:#1d1c1a;--mut:#6b675f;--card:#fff;--line:#e3ded5;--acc:#2f6b4f;--ok:#2f7d4a;--bad:#b23b2e;--mid:#9a7a1c;--code:#f0ece4}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#151514;--fg:#ecebe7;--mut:#a29e95;--card:#1f1f1d;--line:#34332f;--acc:#7cc4a0;--ok:#6cc58a;--bad:#ef7d6f;--mid:#e0c060;--code:#262624}}
:root[data-theme=dark]{--bg:#151514;--fg:#ecebe7;--mut:#a29e95;--card:#1f1f1d;--line:#34332f;--acc:#7cc4a0;--ok:#6cc58a;--bad:#ef7d6f;--mid:#e0c060;--code:#262624}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:36px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}h3{font-size:15px;margin:18px 0 8px}
.mut,.note{color:var(--mut)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:10px 0}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
figure{margin:0}figure img,figure video{width:100%;border-radius:6px;display:block;cursor:zoom-in;background:#000}figcaption{font-size:12px;color:var(--mut);margin-top:3px}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.thumbs.sm{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.strip{display:grid;grid-template-columns:repeat(3,1fr) 34px repeat(3,1fr);gap:6px;align-items:center}.cut{writing-mode:vertical-rl;text-align:center;color:var(--acc);font-weight:600}
@media (max-width:640px){.strip{grid-template-columns:repeat(3,1fr)}.cut{writing-mode:horizontal-tb;grid-column:1/-1}}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:8px}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}th{color:var(--mut);font-weight:600}
.tw{overflow-x:auto}.b{display:inline-block;font-size:12px;padding:1px 7px;border-radius:9px;border:1px solid currentColor}.b.ok{color:var(--ok)}.b.bad{color:var(--bad)}.b.mid{color:var(--mid)}
details{margin:8px 0}summary{cursor:pointer;color:var(--acc)}pre{white-space:pre-wrap;background:var(--code);padding:10px;border-radius:6px;font-size:13px}
.ref{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:start;margin:8px 0}@media (max-width:640px){.ref{grid-template-columns:1fr}}
code{background:var(--code);padding:0 4px;border-radius:4px}ul{padding-left:20px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:9;padding:16px}#lb.on{display:flex}#lb img,#lb video{max-width:100%;max-height:100%;border-radius:6px}
</style></head><body><main>
<h1>Key references, not keyframes</h1>
<p class="mut">A separate test pipeline (<code>V2/backend/keyref/</code>, T-058 case 3): the video model composes each clip; it is fed only the key references (the place, the product) and, for every clip after the first, the previous clip's last frame. Run <code>${esc(L)}</code> · ${esc(rec.args.model)} ${esc(rec.args.resolution)} · ${rec.args.clips} clips forced · audio ${rec.args.audio ? "on" : "off"} · <b>${rec.credits} credits</b>${rec.stopped ? ` · <span class="b bad">stopped: ${esc(rec.stopped)}</span>` : ""}</p>

${read ? `<h2>The read</h2><div class="card">${read.map((p) => `<p>${p}</p>`).join("")}</div>` : ""}

<h2>The film</h2>
<div class="grid2">${rec.outputs?.film ? vid(rec.outputs.film, `stitched film, ${rec.outputs.film_seconds} s (ffmpeg)`) : "<p>No film (stopped before the stitch).</p>"}${outs.map((m) => vid(m.file, `clip ${m.n}: ${m.rendered} s, ${m.credits} credits`)).join("")}</div>

<h2>Brief</h2><div class="card">${esc(rec.brief)}</div>

<h2>Story</h2><div class="card"><b>${esc(rec.story?.title)}</b> <span class="mut">(${esc(rec.story?.kind)}, ${esc(rec.mode)})</span><p class="mut">${esc(rec.story?.style)}</p>${esc(rec.story?.story).split(/\n+/).map((p) => `<p>${p}</p>`).join("")}</div>

<h2>Screenplay: ${sp.clips.length} clip batches</h2>
<p class="mut">Each batch is one text-to-video call; ${esc(rec.args.model)} carries up to ${30} s a call. Look sentence used in every prompt: <i>${esc(sp.look)}</i></p>
<div class="grid2">${sp.clips.map((c) => { const bc = rec.batch_checks?.find((b) => b.clip === c.n); return `<div class="card"><h3>Clip ${c.n} · ${c.seconds} s ${bc ? `<span class="b ${bc.ok ? "ok" : "bad"}">${bc.ok ? "the call can carry it" : "too much for one call"}</span>` : ""}</h3><p>${esc(c.summary)}</p>
<table><tbody>${c.beats.map((b) => `<tr><td style="white-space:nowrap">${esc(b.t)}</td><td>${esc(b.action)}</td></tr>`).join("")}</tbody></table>
<p><b>On screen:</b> ${c.on_screen.map((x) => `<code>${esc(x)}</code>`).join(" ")}</p>
<p><b>Spoken:</b> ${c.spoken.length ? c.spoken.map((s) => `${esc(s.who)}: “${esc(s.words)}”`).join("; ") : "nobody speaks"} · <b>Sound:</b> ${esc(c.sound)}</p>
<p><b>Continuity (carried from the previous clip):</b></p>${c.continuity.length ? `<ul>${c.continuity.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="mut">none (first clip)</p>`}
<p><b>Ends on:</b> ${esc(c.ends_on)}</p>
${bc ? `<details><summary>carry checks</summary><ul>${bc.checks.map((x) => `<li>${x.ok ? "✓" : "✗"} ${esc(x.check)}</li>`).join("")}</ul></details>` : ""}</div>`; }).join("")}</div>

<h2>State manager</h2>
<div class="card"><b>Rules</b><ul>${st.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>
<div class="tw"><table><thead><tr><th>element</th><th>kind</th><th>look</th><th>in clips</th><th>state per clip</th><th>reference still?</th></tr></thead><tbody>
${st.elements.map((e) => `<tr><td><code>@${esc(e.id)}</code><br>${esc(e.name)}</td><td>${esc(e.kind)}</td><td>${esc(e.look)}${e.lettering.length ? `<br><b>lettering:</b> ${e.lettering.map((s) => `“${esc(s)}”`).join(", ")}` : ""}</td><td>${e.clips.join(", ")}</td><td>${Object.entries(e.states).map(([k, s]) => `<b>${k}:</b> ${esc(s)}`).join("<br>")}</td><td>${e.needs_reference ? `<span class="b ok">yes</span>` : `<span class="b mid">no</span>`} ${esc(e.why)}</td></tr>`).join("")}
</tbody></table></div>

<h2>References sent, per clip</h2>
${st.clips.map((c) => `<div class="card"><h3>Clip ${c.n} · ${c.refs.length} reference${c.refs.length === 1 ? "" : "s"}</h3>
${c.refs.map((r) => `<div class="ref">${img(r.file, `@${r.name}`)}<div><b><code>@${esc(r.name)}</code></b> <span class="mut">${esc(r.file)}</span><br><b>role:</b> ${esc(r.role)}<br><b>why:</b> ${esc(r.why)}<br><b>source:</b> ${esc(r.source)}</div></div>`).join("")}
<p><b>State decisions:</b></p><ul>${c.decisions.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
<details><summary>prompt (${c.prompt_chars} characters)</summary><pre>${esc(c.prompt)}</pre></details></div>`).join("")}

<h2>Vision checks (specific yes/no questions only)</h2>
<p class="mut">Each reference before it is sent; each last frame against what the next clip must continue; each clip's opening against @previous and its continuity list; each clip against its references and the frame it must end on.</p>
${rec.vlm.map(vlmBlock).join("")}

<h2>Continuity strip</h2>${strip}

<h2>Tools</h2>
<div class="card">${Object.entries(toolCount).map(([k, v]) => `<b>${esc(k)}</b>: ${v}`).join(" · ")} · <b>credits</b>: ${rec.credits}</div>
<div class="tw"><table><thead><tr><th>#</th><th>tool</th><th>model</th><th>for</th><th>inputs</th><th>credits</th><th>output</th></tr></thead><tbody>
${rec.tools.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.tool)}${t.endpoint ? `<br><span class="mut">${esc(t.endpoint)}</span>` : ""}</td><td>${esc(t.model || "—")}${t.resolution ? ` @${esc(t.resolution)}` : ""}${t.seconds ? `, ${t.seconds} s` : ""}${t.audio != null ? `, audio ${t.audio ? "on" : "off"}` : ""}</td><td>${esc(t.for || t.op || "")}${t.prompt ? `<details><summary>prompt</summary><pre>${esc(t.prompt)}</pre></details>` : ""}</td><td>${(t.inputs || []).map((x) => esc(x)).join("<br>") || "—"}</td><td>${t.credits}${t.cached ? " (cached)" : ""}</td><td>${Array.isArray(t.output) ? `${t.output.length} files` : esc(t.output)}</td></tr>`).join("")}
</tbody></table></div>
<details><summary>LLM text calls (${rec.llm.length})</summary><ul>${rec.llm.map((l) => `<li><code>${esc(l.name)}</code> · ${esc(l.purpose)} · ${esc(l.model)}</li>`).join("")}</ul></details>
<p class="mut">Record: <code>V2/runs/${esc(L)}/keyref.json</code></p>
</main><div id="lb"></div>
<script>
const lb=document.getElementById('lb');
document.addEventListener('click',e=>{const t=e.target.closest('[data-zoom]');if(t&&!lb.contains(t)){if(t.tagName==='VIDEO'&&e.offsetY>t.clientHeight-40)return;e.preventDefault();const c=t.cloneNode();c.removeAttribute('data-zoom');if(c.tagName==='VIDEO'){c.controls=true;c.autoplay=true;}lb.innerHTML='';lb.appendChild(c);lb.classList.add('on');}else if(e.target===lb){lb.classList.remove('on');lb.innerHTML='';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){lb.classList.remove('on');lb.innerHTML='';}});
</script></body></html>`;
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const [label, out] = process.argv.slice(2); writePage(JSON.parse(readFileSync(join(RUNS, label, "keyref.json"), "utf8")), out); console.log(`wrote ${out}`); }
