// Slideshow page for a keyframe-chain run: one keyframe per slide with its change, description and lineage (which images
// each edit call took), arrow keys / autoplay, and an Approve / Reject control that POSTs to the run's server.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderSlideshow(log) {
  const pl = log.plan, frames = log.frames || {};
  const slides = pl.keyframes.filter((k) => frames[k.id]?.done).map((k) => {
    const f = frames[k.id];
    const lineage = f.steps.map((s, j) => `<div class="step"><span>call ${j + 1}</span>${s.inputs.length ? s.inputs.map((x) => `<img src="${esc(x)}" title="${esc(x)}">`).join("<b>+</b>") : "<i>text only</i>"}<b>→</b><img src="${esc(s.out)}" title="${esc(s.out)}"></div>`).join("");
    const kept = (f.checks || []).reduce((x, y) => (!x || y.anomalies.length < x.anomalies.length ? y : x), null);
    const checks = (f.checks || []).map((c, j) => `<p class="${c.ok ? "ok" : "bad"}">${f.checks.length > 1 ? (c === kept ? "kept · " : "discarded · ") : ""}attempt ${j + 1}: ${c.ok ? "no anomalies" : c.anomalies.map((a) => `[${esc(a.kind)}] ${esc(a.what)}`).join("<br>")}</p>`).join("");
    const refs = k.refs.map((r) => `<li>${esc(r.id)}: ${esc(r.take)}</li>`).join("");
    return `<section class="slide" data-id="${esc(k.id)}">
  <img class="main" src="${esc(f.file)}">
  <div class="cap"><h2>${esc(k.id)} · ${esc(k.change)}</h2>${f.mode ? `<p class="refs">${esc(f.mode)}${log.tags?.[k.id] ? ` · ${esc(log.tags[k.id].place)} · ${esc(log.tags[k.id].cast.join(", "))}` : ""}</p>` : ""}<p>${esc(k.description)}</p>
  ${refs ? `<p class="refs">refers back to:</p><ul>${refs}</ul>` : ""}
  ${checks}
  <details><summary>lineage · ${f.steps.length} call(s) · ${f.credits} credits</summary>${lineage}</details></div></section>`;
  }).join("\n");
  const total = pl.keyframes.length, ready = Object.values(frames).filter((f) => f.done).length;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keyframe Chain</title>
<style>
:root{--bg:#111;--fg:#eee;--mut:#999;--acc:#e0533d;--ok:#3fa75a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
header{display:flex;gap:12px;align-items:center;padding:10px 16px;flex-wrap:wrap}header h1{font-size:16px;margin:0;flex:1}
button{background:#222;color:var(--fg);border:1px solid #444;border-radius:6px;padding:7px 12px;cursor:pointer;font:inherit}
button.ok{background:var(--ok);border-color:var(--ok)}button.no{background:var(--acc);border-color:var(--acc)}
.slide{display:none;padding:0 16px 16px}.slide.on{display:block}
.main{width:100%;max-height:72vh;object-fit:contain;display:block;background:#000;border-radius:6px}
.cap h2{font-size:17px;margin:12px 0 4px}.cap p{margin:4px 0;color:#ccc}.refs{color:var(--acc)!important;margin-top:8px!important}.ok{color:var(--ok)!important;font-size:13px}.bad{color:#e8a33d!important;font-size:13px}
#audit{padding:0 16px 8px;color:#ccc}#audit li{margin:2px 0}
details{margin-top:8px;color:var(--mut)}.step{display:flex;align-items:center;gap:6px;margin:6px 0;flex-wrap:wrap}.step img{height:60px;border-radius:4px}.step span{width:52px}
footer{padding:12px 16px;border-top:1px solid #333;display:flex;gap:8px;flex-wrap:wrap;align-items:center}footer input{flex:1;min-width:200px;background:#1b1b1b;color:var(--fg);border:1px solid #444;border-radius:6px;padding:7px}
#dots{display:flex;gap:4px;padding:0 16px 8px;flex-wrap:wrap}#dots i{width:22px;height:5px;background:#333;border-radius:3px;cursor:pointer}#dots i.on{background:var(--acc)}
</style></head><body>
<header><h1>${esc(log.case?.title || "")} · keyframe chain · ${ready}/${total} frames · ${log.total_credits ?? 0} credits</h1>
<button onclick="go(-1)">◀</button><span id="n"></span><button onclick="go(1)">▶</button><button id="play" onclick="toggle()">▶ play</button></header>
<div id="dots"></div>
${log.audit?.length ? `<details id="audit"><summary>plan audit: ${log.audit.length} issue(s) fixed before any image</summary><ul>${log.audit.map((a) => `<li><b>${esc(a.id)}</b> ${esc(a.problem)} → ${esc(a.fix)}</li>`).join("")}</ul></details>` : ""}
${pl.characters.some((c) => frames && log.calls?.[`sheet-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`]) ? `<details id="audit"><summary>character sheets</summary><div class="step">${pl.characters.map((c) => `<img style="height:160px" title="${esc(c.name)}" src="sheet-${esc(c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}.png">`).join("")}</div></details>` : ""}
${slides || "<p style='padding:16px'>No frames yet.</p>"}
<footer><input id="note" placeholder="note (what to fix, which frames)"><button class="ok" onclick="send(true)">Approve → make video</button><button class="no" onclick="send(false)">Reject</button><span id="st"></span></footer>
${log.video ? `<div style="padding:16px"><h2>Video</h2><video src="${esc(log.video.file)}" controls style="width:100%;max-height:72vh"></video></div>` : ""}
<script>
const S=[...document.querySelectorAll('.slide')];let i=0,t=null;
const D=document.getElementById('dots');S.forEach((s,k)=>{const d=document.createElement('i');d.onclick=()=>show(k);D.appendChild(d)});
function show(k){if(!S.length)return;i=(k+S.length)%S.length;S.forEach((s,j)=>s.classList.toggle('on',j===i));[...D.children].forEach((d,j)=>d.classList.toggle('on',j===i));document.getElementById('n').textContent=(i+1)+' / '+S.length}
function go(d){show(i+d)}
function toggle(){const b=document.getElementById('play');if(t){clearInterval(t);t=null;b.textContent='▶ play'}else{t=setInterval(()=>go(1),3000);b.textContent='❚❚ pause'}}
document.onkeydown=e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);if(e.key===' '){e.preventDefault();toggle()}};
async function send(ok){const st=document.getElementById('st');try{await fetch('/approval',{method:'POST',body:JSON.stringify({approved:ok,note:document.getElementById('note').value})});st.textContent=ok?'Approved — tell Claude to run the video phase.':'Rejected — saved.'}catch(e){st.textContent='Could not reach the server.'}}
show(0);
</script></body></html>`;
}
