// Film page (film.html): final.mp4 with the caption of the clip that is playing, a chapter strip (⟶ connected, ✂ cut),
// and every clip with its keyframes and QA. Relative paths only.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderFilm({ name, plan, film, credits }) {
  const cap = Object.fromEntries(plan.slides.map((s) => [s.n, s.caption]));
  const ch = (film.chapters || []).map((c) => ({ ...c, cap: cap[c.n] }));
  const q = (v) => (v == null ? "—" : v.toFixed(3));
  const flag = (v) => (v != null && v < 0.9 ? ' class="low"' : "");
  const rows = film.clips.map((c) => `<tr><td><button data-n="${c.n}">${c.n}</button></td><td>${c.type === "connected" ? `⟶ ${c.next}` : "✂"}</td>
    <td${flag(c.qa?.first_vs_start)}>${q(c.qa?.first_vs_start)}</td><td${flag(c.qa?.last_vs_end)}>${q(c.qa?.last_vs_end)}</td><td${flag(c.qa?.last_vs_start)}>${q(c.qa?.last_vs_start)}</td>
    <td class="p">${esc(c.prompt)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.title)} film</title>
<style>
:root{--bg:#fafaf8;--fg:#1b1b1b;--mut:#6b6b6b;--line:#e2e2dc;--ok:#1f7a3a;--bad:#b3261e;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--mut:#9a9a9a;--line:#2c2c2c;--ok:#5bc27a;--bad:#ff7b72;--card:#1d1d1d}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif} main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0} h2{font-size:17px;margin:28px 0 8px} .meta{color:var(--mut);font-size:13px}
video{width:100%;border-radius:8px;background:#000;display:block} #cap{font-size:18px;min-height:2.8em;margin:10px 0 6px}
.strip{display:flex;height:28px;border-radius:6px;overflow:hidden;border:1px solid var(--line);cursor:pointer}
.strip div{flex:1;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--mut);border-left:1px solid var(--line);background:var(--card)}
.strip div:first-child{border-left:0} .strip div.on{background:var(--fg);color:var(--bg)} .strip div.con{border-left:1px dashed var(--ok)} .strip div.cut{border-left:2px solid var(--bad)}
table{border-collapse:collapse;font-size:13px;width:100%;display:block;overflow-x:auto} td,th{border:1px solid var(--line);padding:4px 8px;vertical-align:top} td.p{min-width:320px} td.low{color:var(--bad);font-weight:600}
button{font:inherit;padding:0 8px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:4px;cursor:pointer}
</style></head><body><main>
<h1>${esc(plan.title)}</h1>
<p class="meta">${esc(name)} · ${film.clips.length} clips × ${film.seconds} s · ${esc(film.model.model)} ${esc(film.model.resolution)} · ${credits} credits total (slides + clips) · <a href="index.html">slideshow and lineage</a></p>
${film.final ? `<video id="v" src="${esc(film.final)}" controls></video>` : `<p>final.mp4 not stitched yet: ${film.clips.length} of ${film.links.length} clips exist.</p>`}
<p id="cap"></p>
<div class="strip" id="strip">${ch.map((c, i) => `<div data-i="${i}" class="${i === 0 ? "" : ch[i - 1].type === "connected" ? "con" : "cut"}" title="clip ${c.n}">${c.n}</div>`).join("")}</div>
<p class="meta">Seam before a box: dashed green = connected (the clip ended on this slide's frame), solid red = cut.</p>
<h2>Clips</h2>
<p class="meta">SSIM, grayscale 640×360 (1 = identical; red under 0.9). "last ≈ start" on a cut clip measures how far the unpinned clip drifted from its own keyframe.</p>
<table><tr><th>clip</th><th>link</th><th>first ≈ start</th><th>last ≈ end</th><th>last ≈ start</th><th>motion prompt</th></tr>${rows}</table>
</main><script>
const C=${JSON.stringify(ch)};const v=document.getElementById("v"),cap=document.getElementById("cap"),strip=document.getElementById("strip");
function at(t){let i=0;for(let k=0;k<C.length;k++)if(t>=C[k].at)i=k;return i}
function paint(){if(!v||!C.length)return;const i=at(v.currentTime);cap.textContent=C[i].cap;[...strip.children].forEach((d,k)=>d.classList.toggle("on",k===i));}
if(v){v.addEventListener("timeupdate",paint);v.addEventListener("loadedmetadata",paint);}
strip.onclick=(e)=>{const i=e.target.dataset.i;if(v&&i!=null){v.currentTime=C[i].at+0.01;v.play();}};
document.querySelectorAll("button[data-n]").forEach((b)=>b.onclick=()=>{const i=C.findIndex((c)=>c.n==b.dataset.n);if(v&&i>=0){v.currentTime=C[i].at+0.01;v.play();window.scrollTo(0,0);}});
</script></body></html>`;
}
