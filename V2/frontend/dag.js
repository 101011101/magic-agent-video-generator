// The tree drawn with arrows: nodes in columns by dependency depth, a bezier arrow from each producer to each taker.
// Shared by the chat (frontend/index.html) and the bench page (bench/page.js embeds this file). No dependencies.
// drawDag(container, steps, { media(step) → url|null, onSelect(index), label(step) })
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
  if (mats.length) { const c = document.createElement("div"); c.className = "dag-col"; for (const m of mats) { const n = document.createElement("div"); n.className = "dag-node mat"; n.dataset.name = m; const u = opts.media ? opts.media({ produces: m, material: true }) : null; n.innerHTML = `${u ? `<img src="${esc(u)}" alt="">` : ""}<span>${esc(m)}</span>`; c.appendChild(n); } wrap.appendChild(c); }
  cols.forEach((col) => { const c = document.createElement("div"); c.className = "dag-col"; for (const i of col) { const s = steps[i]; const n = document.createElement("div"); n.className = "dag-node"; n.dataset.i = i; n.dataset.name = s.produces; n.dataset.s = s.state || ""; const u = opts.media ? opts.media(s) : null; n.innerHTML = `${u ? (/\.(mp4|mov)$/i.test(u) ? `<video src="${esc(u)}" muted></video>` : `<img src="${esc(u)}" alt="">`) : ""}<span>${esc(opts.label ? opts.label(s) : s.tool)}</span><small>${esc(s.produces)}</small>`; n.title = s.why || ""; if (opts.onSelect) n.addEventListener("click", () => opts.onSelect(i)); c.appendChild(n); } wrap.appendChild(c); });
  root.appendChild(wrap);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "dag-arrows"); root.appendChild(svg);
  const draw = () => {
    const R = root.getBoundingClientRect(); svg.setAttribute("width", root.scrollWidth); svg.setAttribute("height", root.scrollHeight); svg.innerHTML = `<defs><marker id="dag-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="currentColor"/></marker></defs>`;
    const box = (name) => { const n = root.querySelector(`.dag-node[data-name="${CSS.escape(name)}"]`); if (!n) return null; const b = n.getBoundingClientRect(); return { x1: b.left - R.left + root.scrollLeft, x2: b.right - R.left + root.scrollLeft, y: b.top - R.top + root.scrollTop + b.height / 2 }; };
    for (const s of steps) for (const x of s.inputs) { const a = box(x), b = box(s.produces); if (!a || !b) continue; const dx = Math.max(24, (b.x1 - a.x2) / 2); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", `M${a.x2},${a.y} C${a.x2 + dx},${a.y} ${b.x1 - dx},${b.y} ${b.x1},${b.y}`); p.setAttribute("marker-end", "url(#dag-arr)"); svg.appendChild(p); }
  };
  requestAnimationFrame(draw); if (window.ResizeObserver) new ResizeObserver(draw).observe(root); root.querySelectorAll("img,video").forEach((m) => m.addEventListener("load", draw));
  return { draw };
}
const DAG_CSS = `.dag{position:relative;overflow-x:auto;padding:6px 2px}.dag-cols{display:flex;gap:44px;align-items:flex-start;position:relative;z-index:1}.dag-col{display:flex;flex-direction:column;gap:12px}
.dag-node{width:112px;border-radius:12px;background:var(--grey,#eee);border:2px solid var(--blue,#0a84ff);padding:4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;cursor:pointer;position:relative}
.dag-node.mat{border-color:var(--rule,#ddd);border-style:dashed;cursor:default}.dag-node[data-s=done]{border-color:var(--ok,#30b350)}.dag-node[data-s=stale]{border-color:var(--warn,#ff9f0a)}.dag-node[data-s=skipped]{opacity:.5;border-color:var(--rule,#ddd)}
.dag-node img,.dag-node video{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;background:#fff}.dag-node span{font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dag-node small{color:var(--mut,#888);font-size:9.5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dag-arrows{position:absolute;inset:0;pointer-events:none;color:var(--mut,#999);z-index:0}.dag-arrows path{fill:none;stroke:currentColor;stroke-width:1.5}`;
if (typeof module !== "undefined") module.exports = { drawDag, DAG_CSS };
