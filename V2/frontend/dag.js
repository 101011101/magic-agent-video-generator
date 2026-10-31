// The tree as a canvas: nodes placed by dependency depth until the user moves one, then at their own positions; a
// bezier arrow from each producer to each taker; a port on each side. Drag the background to pan, a node to move it,
// from an output port onto a node to wire it; drop a material name onto a node to add it as an input.
// drawDag(container, steps, { media, onSelect(i), label, onConnect(fromName, toIndex), onMove(i, {x,y}) })
function drawDag(root, steps, opts = {}) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const by = {}; steps.forEach((s, i) => (by[s.produces] = i));
  const level = new Array(steps.length).fill(0);
  for (let pass = 0; pass < steps.length; pass++) steps.forEach((s, i) => { const l = s.inputs.map((x) => by[x]).filter((j) => j !== undefined && j !== i).map((j) => level[j] + 1); level[i] = l.length ? Math.max(...l) : 0; });
  const mats = [...new Set(steps.flatMap((s) => s.inputs.filter((x) => by[x] === undefined)))];
  // default positions: columns by depth; materials in column 0 when present
  const COLW = 168, ROWH = 104, PAD = 14, off = mats.length ? 1 : 0; const rows = {};
  const pos = {}; mats.forEach((m, k) => (pos[m] = { x: PAD, y: PAD + k * ROWH }));
  steps.forEach((s, i) => { const c = level[i] + off; rows[c] = (rows[c] || 0); pos[s.produces] = s.pos || { x: PAD + c * COLW, y: PAD + rows[c] * ROWH }; rows[c]++; });
  root.classList.add("dag"); root.innerHTML = "";
  const layer = document.createElement("div"); layer.className = "dag-layer"; root.appendChild(layer);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "dag-arrows"); layer.appendChild(svg);
  const port = (side) => `<i class="port ${side}" data-port="${side}"></i>`;
  const place = (n, name) => { n.style.left = pos[name].x + "px"; n.style.top = pos[name].y + "px"; };
  for (const m of mats) { const n = document.createElement("div"); n.className = "dag-node mat"; n.dataset.name = m; n.draggable = false; const u = opts.media ? opts.media({ produces: m, material: true }) : null; n.innerHTML = `${u ? `<img src="${esc(u)}" alt="">` : ""}<span>${esc(m)}</span>${port("out")}`; place(n, m); layer.appendChild(n); }
  steps.forEach((s, i) => { const n = document.createElement("div"); n.className = "dag-node"; n.dataset.i = i; n.dataset.name = s.produces; n.dataset.s = s.state || ""; const u = opts.media ? opts.media(s) : null; n.innerHTML = `${port("in")}${u ? (/\.(mp4|mov)$/i.test(u) ? `<video src="${esc(u)}" muted></video>` : `<img src="${esc(u)}" alt="">`) : ""}<span>${esc(opts.label ? opts.label(s) : s.tool)}</span><small>${esc(s.produces)}</small>${port("out")}`; n.title = s.why || ""; place(n, s.produces); layer.appendChild(n); });
  const size = () => { let w = 0, h = 0; for (const name in pos) { w = Math.max(w, pos[name].x + 140); h = Math.max(h, pos[name].y + 110); } layer.style.width = w + "px"; layer.style.height = h + "px"; svg.setAttribute("width", w); svg.setAttribute("height", h); };
  const box = (name) => { const n = layer.querySelector(`.dag-node[data-name="${CSS.escape(name)}"]`); if (!n) return null; return { x1: n.offsetLeft, x2: n.offsetLeft + n.offsetWidth, y: n.offsetTop + n.offsetHeight / 2 }; };
  const curve = (a, b) => { const dx = Math.max(24, Math.abs(b.x1 - a.x2) / 2); return `M${a.x2},${a.y} C${a.x2 + dx},${a.y} ${b.x1 - dx},${b.y} ${b.x1},${b.y}`; };
  let live = null;
  const draw = () => { size(); svg.innerHTML = `<defs><marker id="dag-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="currentColor"/></marker></defs>`; for (const s of steps) for (const x of s.inputs) { const a = box(x), b = box(s.produces); if (!a || !b) continue; const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", curve(a, b)); p.setAttribute("marker-end", "url(#dag-arr)"); svg.appendChild(p); } if (live) { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", live); p.setAttribute("class", "live"); svg.appendChild(p); } };
  // pointer: wire from an output port; move a node; pan on the background
  let drag = null;
  root.addEventListener("pointerdown", (e) => {
    const p = e.target.closest(".port.out"), n = e.target.closest(".dag-node");
    if (p && opts.onConnect) { drag = { kind: "wire", from: p.closest(".dag-node").dataset.name }; }
    else if (n && n.dataset.i !== undefined) { drag = { kind: "move", n, name: n.dataset.name, i: Number(n.dataset.i), sx: e.clientX, sy: e.clientY, ox: pos[n.dataset.name].x, oy: pos[n.dataset.name].y, moved: false }; }
    else if (!n) { drag = { kind: "pan", sx: e.clientX, sy: e.clientY, sl: root.scrollLeft, st: root.scrollTop }; root.classList.add("panning"); }
    if (drag) { e.preventDefault(); root.setPointerCapture?.(e.pointerId); }
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (drag.kind === "pan") { root.scrollLeft = drag.sl - (e.clientX - drag.sx); root.scrollTop = drag.st - (e.clientY - drag.sy); return; }
    if (drag.kind === "move") { const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; pos[drag.name] = { x: Math.max(0, drag.ox + dx), y: Math.max(0, drag.oy + dy) }; place(drag.n, drag.name); draw(); return; }
    if (drag.kind === "wire") { const a = box(drag.from); const R = layer.getBoundingClientRect(); live = curve(a, { x1: e.clientX - R.left, y: e.clientY - R.top }); draw(); const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".dag-node"); layer.querySelectorAll(".dag-node").forEach((n) => n.classList.toggle("target", n === t && n.dataset.i !== undefined && n.dataset.name !== drag.from)); }
  });
  root.addEventListener("pointerup", (e) => {
    const d = drag; drag = null; root.classList.remove("panning"); if (!d) return;
    if (d.kind === "wire") { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".dag-node"); live = null; layer.querySelectorAll(".target").forEach((n) => n.classList.remove("target")); draw(); if (t && t.dataset.i !== undefined && t.dataset.name !== d.from) opts.onConnect(d.from, Number(t.dataset.i)); }
    else if (d.kind === "move") { if (d.moved) opts.onMove?.(d.i, pos[d.name]); else opts.onSelect?.(d.i); }
  });
  root.addEventListener("dragover", (e) => { const n = e.target.closest(".dag-node[data-i]"); if (n) { e.preventDefault(); n.classList.add("target"); } });
  root.addEventListener("dragleave", (e) => e.target.closest?.(".dag-node")?.classList.remove("target"));
  root.addEventListener("drop", (e) => { const t = e.target.closest(".dag-node[data-i]"); layer.querySelectorAll(".target").forEach((n) => n.classList.remove("target")); if (!t || !opts.onConnect) return; e.preventDefault(); const name = e.dataTransfer.getData("text/plain"); if (name && name !== t.dataset.name) opts.onConnect(name, Number(t.dataset.i)); });
  requestAnimationFrame(draw); layer.querySelectorAll("img,video").forEach((m) => m.addEventListener("load", draw));
  return { draw, level };
}
const DAG_CSS = `.dag{position:relative;overflow:auto;min-height:150px;max-height:420px;cursor:grab;background:radial-gradient(circle,var(--rule,#e2e2e6) 1px,transparent 1.2px) 0 0/18px 18px;border-radius:12px}.dag.panning{cursor:grabbing}.dag-layer{position:relative;min-width:100%;min-height:100%}
.dag-node{position:absolute;width:112px;border-radius:12px;background:var(--card,#fff);border:2px solid var(--blue,#0a84ff);padding:4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;cursor:pointer;user-select:none;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.dag-node.mat{border-color:var(--rule,#ddd);border-style:dashed;cursor:default}.dag-node[data-s=done]{border-color:var(--ok,#30b350)}.dag-node[data-s=stale],.dag-node[data-s=waiting],.dag-node[data-s=paused]{border-color:var(--warn,#ff9f0a)}.dag-node[data-s=waiting]{border-style:dashed}.dag-node[data-s=running]{box-shadow:0 0 0 3px color-mix(in srgb,var(--blue,#0a84ff) 25%,transparent)}.dag-node[data-s=failed]{border-color:var(--bad,#ff3b30)}.dag-node[data-s=skipped]{opacity:.5;border-color:var(--rule,#ddd)}
.dag-node.on{box-shadow:0 0 0 3px color-mix(in srgb,var(--blue,#0a84ff) 45%,transparent)}.dag-node.target{box-shadow:0 0 0 3px color-mix(in srgb,var(--ok,#30b350) 55%,transparent)}
.dag-node img,.dag-node video{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;background:#fff;pointer-events:none}.dag-node span{font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dag-node small{color:var(--mut,#888);font-size:9.5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dag-node .port{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:var(--card,#fff);border:2px solid var(--mut,#999);transform:translateY(-50%);z-index:2}.dag-node .port.in{left:-7px}.dag-node .port.out{right:-7px;cursor:crosshair}.dag-node .port.out:hover{border-color:var(--blue,#0a84ff);background:var(--blue,#0a84ff)}
.dag-arrows{position:absolute;inset:0;pointer-events:none;color:var(--mut,#999);z-index:0}.dag-arrows path{fill:none;stroke:currentColor;stroke-width:1.5}.dag-arrows path.live{stroke:var(--blue,#0a84ff);stroke-dasharray:5 4}`;
if (typeof module !== "undefined") module.exports = { drawDag, DAG_CSS };
