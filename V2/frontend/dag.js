// The tree drawn with arrows: nodes in columns by dependency depth, a bezier arrow from each producer to each taker,
// a connection point on each side of a node. Drag from an output port to another node to point the output into it;
// drop a material name (from the directory) onto a node to add it as an input. Shared by the chat and the bench page.
// drawDag(container, steps, { media(step) → url|null, onSelect(index), label(step), onConnect(fromName, toIndex), columnOf(level) })
function drawDag(root, steps, opts = {}) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const by = {}; steps.forEach((s, i) => (by[s.produces] = i));
  const prod = (s) => s.inputs.map((x) => by[x]).filter((j) => j !== undefined);
  const level = new Array(steps.length).fill(0);
  for (let pass = 0; pass < steps.length; pass++) steps.forEach((s, i) => { const l = prod(s).filter((j) => j !== i).map((j) => level[j] + 1); level[i] = l.length ? Math.max(...l) : 0; });
  const cols = []; steps.forEach((s, i) => (cols[level[i]] ??= []).push(i));
  const mats = [...new Set(steps.flatMap((s) => s.inputs.filter((x) => by[x] === undefined)))];
  root.classList.add("dag"); root.innerHTML = "";
  const wrap = document.createElement("div"); wrap.className = "dag-cols";
  const port = (side) => `<i class="port ${side}" data-port="${side}"></i>`;
  if (mats.length) { const c = document.createElement("div"); c.className = "dag-col mats"; for (const m of mats) { const n = document.createElement("div"); n.className = "dag-node mat"; n.dataset.name = m; n.draggable = true; const u = opts.media ? opts.media({ produces: m, material: true }) : null; n.innerHTML = `${u ? `<img src="${esc(u)}" alt="">` : ""}<span>${esc(m)}</span>${port("out")}`; c.appendChild(n); } wrap.appendChild(c); }
  cols.forEach((col, li) => { const c = document.createElement("div"); c.className = "dag-col"; c.dataset.level = li; for (const i of col) { const s = steps[i]; const n = document.createElement("div"); n.className = "dag-node"; n.dataset.i = i; n.dataset.name = s.produces; n.dataset.s = s.state || ""; const u = opts.media ? opts.media(s) : null; n.innerHTML = `${port("in")}${u ? (/\.(mp4|mov)$/i.test(u) ? `<video src="${esc(u)}" muted></video>` : `<img src="${esc(u)}" alt="">`) : ""}<span>${esc(opts.label ? opts.label(s) : s.tool)}</span><small>${esc(s.produces)}</small>${port("out")}`; n.title = s.why || ""; if (opts.onSelect) n.addEventListener("click", (e) => { if (e.target.closest(".port")) return; opts.onSelect(i); }); c.appendChild(n); } wrap.appendChild(c); });
  root.appendChild(wrap);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "dag-arrows"); root.appendChild(svg);
  const pos = (name) => { const n = root.querySelector(`.dag-node[data-name="${CSS.escape(name)}"]`); if (!n) return null; const R = root.getBoundingClientRect(), b = n.getBoundingClientRect(); return { x1: b.left - R.left + root.scrollLeft, x2: b.right - R.left + root.scrollLeft, y: b.top - R.top + root.scrollTop + b.height / 2 }; };
  const curve = (a, b) => { const dx = Math.max(24, (b.x1 - a.x2) / 2); return `M${a.x2},${a.y} C${a.x2 + dx},${a.y} ${b.x1 - dx},${b.y} ${b.x1},${b.y}`; };
  let live = null;
  const draw = () => {
    svg.setAttribute("width", root.scrollWidth); svg.setAttribute("height", root.scrollHeight); svg.innerHTML = `<defs><marker id="dag-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="currentColor"/></marker></defs>`;
    for (const s of steps) for (const x of s.inputs) { const a = pos(x), b = pos(s.produces); if (!a || !b) continue; const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", curve(a, b)); p.setAttribute("marker-end", "url(#dag-arr)"); svg.appendChild(p); }
    if (live) { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", live); p.setAttribute("class", "live"); svg.appendChild(p); }
  };
  // wiring by hand: drag from an output port, drop on a node
  if (opts.onConnect) {
    let from = null;
    root.addEventListener("pointerdown", (e) => { const p = e.target.closest(".port.out"); if (!p) return; from = p.closest(".dag-node").dataset.name; e.preventDefault(); root.setPointerCapture?.(e.pointerId); });
    root.addEventListener("pointermove", (e) => { if (!from) return; const a = pos(from); const R = root.getBoundingClientRect(); const b = { x1: e.clientX - R.left + root.scrollLeft, y: e.clientY - R.top + root.scrollTop }; live = curve(a, b); draw(); root.querySelectorAll(".dag-node").forEach((n) => n.classList.toggle("target", !!(document.elementFromPoint(e.clientX, e.clientY)?.closest(".dag-node") === n && n.dataset.i !== undefined && n.dataset.name !== from))); });
    root.addEventListener("pointerup", (e) => { if (!from) return; const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".dag-node"); const f = from; from = null; live = null; root.querySelectorAll(".target").forEach((n) => n.classList.remove("target")); draw(); if (t && t.dataset.i !== undefined && t.dataset.name !== f) opts.onConnect(f, Number(t.dataset.i)); });
    root.addEventListener("dragover", (e) => { if (e.target.closest(".dag-node[data-i]")) { e.preventDefault(); e.target.closest(".dag-node").classList.add("target"); } });
    root.addEventListener("dragleave", (e) => e.target.closest?.(".dag-node")?.classList.remove("target"));
    root.addEventListener("drop", (e) => { const t = e.target.closest(".dag-node[data-i]"); root.querySelectorAll(".target").forEach((n) => n.classList.remove("target")); if (!t) return; e.preventDefault(); const name = e.dataTransfer.getData("text/plain"); if (name && name !== t.dataset.name) opts.onConnect(name, Number(t.dataset.i)); });
  }
  requestAnimationFrame(draw); if (window.ResizeObserver) new ResizeObserver(draw).observe(root); root.querySelectorAll("img,video").forEach((m) => m.addEventListener("load", draw));
  return { draw, level, cols };
}
const DAG_CSS = `.dag{position:relative;overflow-x:auto;padding:6px 2px}.dag-cols{display:flex;gap:44px;align-items:flex-start;position:relative;z-index:1}.dag-col{display:flex;flex-direction:column;gap:12px;padding:6px 4px;border-radius:12px}
.dag-node{width:112px;border-radius:12px;background:var(--grey,#eee);border:2px solid var(--blue,#0a84ff);padding:4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;cursor:pointer;position:relative}
.dag-node.mat{border-color:var(--rule,#ddd);border-style:dashed;cursor:grab}.dag-node[data-s=done]{border-color:var(--ok,#30b350)}.dag-node[data-s=stale],.dag-node[data-s=waiting],.dag-node[data-s=paused]{border-color:var(--warn,#ff9f0a)}.dag-node[data-s=waiting]{border-style:dashed}.dag-node[data-s=running]{box-shadow:0 0 0 3px color-mix(in srgb,var(--blue,#0a84ff) 25%,transparent)}.dag-node[data-s=failed]{border-color:var(--bad,#ff3b30)}.dag-node[data-s=skipped]{opacity:.5;border-color:var(--rule,#ddd)}
.dag-node.on{box-shadow:0 0 0 3px color-mix(in srgb,var(--blue,#0a84ff) 45%,transparent)}.dag-node.target{box-shadow:0 0 0 3px color-mix(in srgb,var(--ok,#30b350) 55%,transparent)}
.dag-node img,.dag-node video{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;background:#fff}.dag-node span{font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dag-node small{color:var(--mut,#888);font-size:9.5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dag-node .port{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:var(--card,#fff);border:2px solid var(--mut,#999);transform:translateY(-50%);z-index:2}.dag-node .port.in{left:-7px}.dag-node .port.out{right:-7px;cursor:crosshair}.dag-node .port.out:hover{border-color:var(--blue,#0a84ff);background:var(--blue,#0a84ff)}
.dag-arrows{position:absolute;inset:0;pointer-events:none;color:var(--mut,#999);z-index:0}.dag-arrows path{fill:none;stroke:currentColor;stroke-width:1.5}.dag-arrows path.live{stroke:var(--blue,#0a84ff);stroke-dasharray:5 4}`;
if (typeof module !== "undefined") module.exports = { drawDag, DAG_CSS };
