// S6 Slideshow page: slides in order (arrow keys), lineage per slide, presence matrix, roots. Relative paths only.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderPage({ name, prompt, plan, tracker, log, credits }) {
  const slides = plan.slides.map((s) => ({ s, f: tracker.bySlide(s.n) })).filter((x) => x.f);
  const ent = Object.fromEntries(plan.entities.map((e) => [e.id, e]));
  const img = (file, cls = "") => `<img class="${cls}" src="${esc(file)}" loading="lazy" alt="">`;
  const lineage = slides.map(({ s, f }) => `
  <section class="lin" id="lin-${s.n}">
    <h3>Slide ${s.n} · ${esc(plan.locations.find((l) => l.id === s.location)?.name)} ${f.forced ? '<span class="bad">forced</span>' : '<span class="ok">pass</span>'} <small>hops ${f.hops} · ${esc(f.base_why)}</small></h3>
    <p class="cap">${esc(s.caption)}</p>
    <p class="meta">present: ${s.present.map((id) => esc(ent[id].name)).join(", ") || "—"}${s.change ? ` · change: ${esc(s.change)}` : ""}${s.continues ? " · continues" : ""}</p>
    ${f.attempts.map((a) => `
    <div class="att">
      <div class="row">
        <figure>${img(a.base_file, "th")}<figcaption>base ${esc(a.base)}</figcaption></figure>
        ${a.refs.map((r) => `<figure>${img(r.file, "th")}<figcaption>ref ${esc(ent[r.id].name)}</figcaption></figure>`).join("")}
        <span class="arrow">→</span>
        <figure>${img(a.file, "mid")}<figcaption>try ${a.a}: ${a.faults.length ? `<span class="bad">${esc(a.faults.map((x) => `${x.id ? ent[x.id].name + " " : ""}${x.kind}`).join(", "))}</span>` : '<span class="ok">pass</span>'}</figcaption></figure>
      </div>
      <details><summary>prompt · observation</summary><pre>${esc(a.prompt)}</pre><pre>${esc(JSON.stringify(a.obs, null, 1))}</pre></details>
    </div>`).join("")}
  </section>`).join("");
  const matrix = `<table><tr><th>slide</th><th>location</th>${plan.entities.map((e) => `<th>${esc(e.name)}</th>`).join("")}<th>hops</th></tr>
    ${slides.map(({ s, f }) => `<tr><td><a href="#lin-${s.n}">${s.n}</a></td><td>${esc(s.location)}</td>${plan.entities.map((e) => { const w = s.present.includes(e.id), o = f.present.includes(e.id); return `<td class="${w === o ? "" : "badc"}">${o ? "●" : w ? "✕" : ""}</td>`; }).join("")}<td>${f.hops}</td></tr>`).join("")}</table>
    <p class="meta">● observed present · ✕ wanted but not observed · red cell = observation differs from the plan</p>`;
  const roots = [...plan.entities.map((e) => [e.name, tracker.roots[e.id]]), ...plan.locations.map((l) => [l.name, tracker.frames.find((f) => f.op === "plate" && f.location === l.id)?.file])]
    .map(([n, f]) => `<figure>${img(f, "mid")}<figcaption>${esc(n)}</figcaption></figure>`).join("");
  const passed = slides.filter((x) => !x.f.forced).length, first = slides.filter((x) => x.f.attempts.length === 1 && !x.f.forced).length;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.title)} slideshow</title>
<style>
:root{--bg:#fafaf8;--fg:#1b1b1b;--mut:#6b6b6b;--line:#e2e2dc;--ok:#1f7a3a;--bad:#b3261e;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--mut:#9a9a9a;--line:#2c2c2c;--ok:#5bc27a;--bad:#ff7b72;--card:#1d1d1d}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0} h2{font-size:17px;margin:32px 0 8px;border-top:1px solid var(--line);padding-top:16px} h3{font-size:15px;margin:0 0 4px}
.meta,small,figcaption{color:var(--mut);font-size:13px} .ok{color:var(--ok)} .bad{color:var(--bad)} .badc{background:color-mix(in srgb,var(--bad) 20%,transparent)}
.stage{position:relative;background:#000;border-radius:8px;overflow:hidden} .stage img{width:100%;display:block;aspect-ratio:16/9;object-fit:contain}
.bar{display:flex;gap:8px;align-items:center;margin:8px 0} .bar button{font:inherit;padding:4px 12px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;cursor:pointer}
.capbig{font-size:17px;margin:6px 0 0} .dots{display:flex;gap:4px;flex-wrap:wrap} .dots span{width:10px;height:10px;border-radius:50%;background:var(--line);cursor:pointer} .dots span.on{background:var(--fg)}
.lin{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin:12px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap} figure{margin:0} .th{width:120px;border-radius:4px} .mid{width:260px;max-width:100%;border-radius:4px} .arrow{font-size:22px;color:var(--mut)}
.grid{display:flex;gap:12px;flex-wrap:wrap} pre{white-space:pre-wrap;font-size:12px;background:var(--bg);padding:8px;border-radius:4px;overflow-x:auto}
table{border-collapse:collapse;font-size:13px;display:block;overflow-x:auto} td,th{border:1px solid var(--line);padding:3px 8px;text-align:center}
</style></head><body><main>
<h1>${esc(plan.title)}</h1>
<p class="meta">${esc(name)} · prompt: “${esc(prompt)}” · ${slides.length}/${plan.slides.length} slides · ${passed} passed (${first} first try) · ${credits} credits</p>
<div class="stage"><img id="cur" alt=""></div>
<div class="bar"><button id="prev">←</button><button id="next">→</button><span id="num" class="meta"></span><div class="dots" id="dots"></div></div>
<p class="capbig" id="cap"></p><p class="meta" id="sub"></p>
<h2>Lineage</h2>${lineage}
<h2>Presence (observed)</h2>${matrix}
<h2>Roots</h2><div class="grid">${roots}</div>
<p class="meta">style: ${esc(plan.style)}</p>
</main><script>
const S=${JSON.stringify(slides.map(({ s, f }) => ({ n: s.n, file: f.file, cap: s.caption, sub: `${s.location}${f.forced ? " · forced" : ""}` })))};
let i=0;const $=(x)=>document.getElementById(x);
$("dots").innerHTML=S.map((_,k)=>'<span data-k="'+k+'"></span>').join("");
function show(k){i=(k+S.length)%S.length;const s=S[i];$("cur").src=s.file;$("cap").textContent=s.cap;$("sub").textContent=s.sub;$("num").textContent="slide "+s.n+" / "+S.length;[...$("dots").children].forEach((d,j)=>d.className=j===i?"on":"");}
$("prev").onclick=()=>show(i-1);$("next").onclick=()=>show(i+1);$("dots").onclick=(e)=>e.target.dataset.k&&show(+e.target.dataset.k);
addEventListener("keydown",(e)=>{if(e.key==="ArrowRight")show(i+1);if(e.key==="ArrowLeft")show(i-1);});
if(S.length)show(0);
</script></body></html>`;
}
