// The supervised-run page: one row per step in order, the pending step opened at the top with Approve / Stop / Approve all,
// and each finished step showing what it produced (image, video, text) and what it cost. Polls /api/state; no dependencies.
export function renderPage(state) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test machine · ${esc(state.title)}</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--card:#fbf7ef;--ok:#4f7a3a;--bad:#a0402d;--wait:#9a7b2f}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1d1813;--ink:#efe4d2;--soft:#b39b80;--line:#4a3d30;--card:#28211a;--ok:#8fbf6f;--bad:#e07a62;--wait:#d8b45e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}h1,h2,h3{font-weight:normal}h1{font-size:24px;margin:0 0 4px}
.soft{color:var(--soft)}.bar{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;margin-bottom:16px;z-index:5}
.card{background:var(--card);border:1px solid var(--line);padding:12px 14px;margin:10px 0}
.pend{border-color:var(--wait);border-width:2px}
.row{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.row b{font-weight:normal}
button{font:15px Georgia,serif;padding:7px 16px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;margin:8px 8px 0 0}
button.go{border-color:var(--ok);color:var(--ok)}button.no{border-color:var(--bad);color:var(--bad)}
pre{white-space:pre-wrap;font:12.5px/1.45 ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--line);padding:8px;max-height:260px;overflow:auto;margin:8px 0}
img,video{max-width:100%;display:block;margin:8px 0;background:#000}.thumbs{display:flex;gap:8px;flex-wrap:wrap}.thumbs img{max-width:220px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.s-done .dot{background:var(--ok)}.s-pending .dot{background:var(--wait)}.s-stopped .dot{background:var(--bad)}.s-running .dot{background:var(--soft)}
table{border-collapse:collapse;width:100%;font-size:13.5px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left}th{font-weight:normal;color:var(--soft)}
</style></head><body><main>
<div class="bar"><h1>Test machine · <span id="title"></span></h1>
<div class="soft" id="head"></div></div>
<div id="pending"></div>
<h2 style="font-size:19px">Steps</h2>
<div id="steps"></div>
<script>
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const media = (f) => "/media/" + encodeURI(f);
function viewer(f){ const e=(f.split(".").pop()||"").toLowerCase();
  if (["png","jpg","jpeg","webp"].includes(e)) return '<img src="'+media(f)+'">';
  if (["mp4","webm"].includes(e)) return '<video controls preload="metadata" src="'+media(f)+'"></video>';
  if (["wav","mp3"].includes(e)) return '<audio controls src="'+media(f)+'"></audio>';
  return '<span class="soft">'+esc(f)+'</span>'; }
function detail(s){
  const d = s.detail || {}; let h = "";
  if (d.prompt) h += "<div class='soft'>prompt</div><pre>"+esc(d.prompt)+"</pre>";
  if (d.inputs && d.inputs.length) h += "<div class='soft'>inputs</div><div class='thumbs'>"+d.inputs.map(viewer).join("")+"</div>";
  const rest = d.spec && Object.fromEntries(Object.entries(d.spec).filter(([,v]) => v !== undefined));
  if (rest && Object.keys(rest).length) h += "<pre>"+esc(JSON.stringify(rest))+"</pre>";
  if (d.note) h += "<pre>"+esc(d.note)+"</pre>";
  return h; }
function result(s){
  const r = s.result; if (!r) return "";
  let h = "<div class='soft'>result"+(r.credits?" · "+r.credits+" credits":"")+(r.seconds?" · "+r.seconds+"s":"")+"</div>";
  for (const f of r.files || []) h += viewer(f);
  if (r.text) h += "<pre>"+esc(r.text)+"</pre>";
  return h; }
async function decide(id, action){
  for (const b of document.querySelectorAll("#pending button")) b.disabled = true;
  await fetch("/api/decide", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({id, action}) });
  tick(); }
async function tick(){
  let st; try { st = await (await fetch("/api/state")).json(); } catch { return; }
  document.getElementById("title").textContent = st.title;
  const done = st.steps.filter(s => s.status === "done").length;
  document.getElementById("head").textContent =
    done + " of " + st.steps.length + " steps done · " + st.credits.spent + " credits spent, " + st.credits.approved + " approved"
    + (st.auto ? " · AUTO-APPROVING" : "") + (st.finished ? " · FINISHED" : "");
  const p = st.steps.find(s => s.status === "pending");
  document.getElementById("pending").innerHTML = p
    ? "<div class='card pend'><div class='row'><b>Waiting: "+esc(p.name)+"</b><span class='soft'>"+esc(p.about||"")+"</span></div>"
      + detail(p)
      + "<button class='go' onclick=\"decide('"+p.id+"','approve')\">Approve</button>"
      + "<button onclick=\"decide('"+p.id+"','auto')\">Approve all remaining</button>"
      + "<button class='no' onclick=\"decide('"+p.id+"','stop')\">Stop the run</button></div>"
    : st.finished ? "<div class='card'><b>Run finished.</b><pre>"+esc(JSON.stringify(st.finished,null,1))+"</pre></div>"
    : "<div class='card soft'>Working…</div>";
  document.getElementById("steps").innerHTML = st.steps.slice().reverse().map(s =>
    "<div class='card s-"+s.status+"'><div class='row'><span class='dot'></span><b>"+esc(s.name)+"</b>"
    + "<span class='soft'>"+esc(s.kind)+(s.cost?" · "+s.cost+" credits":"")+" · "+esc(s.status)+(s.decided?" ("+esc(s.decided)+")":"")+"</span></div>"
    + "<div class='soft'>"+esc(s.about||"")+"</div>" + (s.status==="pending"?"":detail(s)) + result(s) + "</div>").join("");
}
tick(); setInterval(tick, 1000);
</script></main></body></html>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
