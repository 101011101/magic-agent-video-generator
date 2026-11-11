// Side-by-side page for a stage of the comprehensive suite: per item, V4's result (tool, credits, output, what it asked) vs the MCP's
// (calls, credits, output or its refusal text). Usage: node V4/tests/stage-page.mjs --ids D01,D02,... --mcp V2/bench/v1/results/mcp-stage1 --out V4/runs/stage1.html --title "…"
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { V2 } from "../../V2/backend/lib/env.js";
import { V4 } from "../agent/run.mjs";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ids = opt("--ids").split(","), MCP = resolve(opt("--mcp")), OUT = resolve(opt("--out")), od = join(OUT, ".."), title = opt("--title", "stage"), RUNS = join(V4, "runs");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const media = (p) => !p ? "<div class=mut>no output</div>" : /\.mp4$/i.test(p) ? `<video controls preload="metadata" src="${esc(relative(od, p))}"></video>` : /\.mp3$/i.test(p) ? `<audio controls src="${esc(relative(od, p))}"></audio>` : `<img src="${esc(relative(od, p))}" data-zoom>`;
const rows = [];
for (const id of ids) {
  const item = JSON.parse(readFileSync(join(V4, "tests/items", `${id}.json`), "utf8"));
  const vp = join(RUNS, `full-${id}`, "run.json"), v = existsSync(vp) ? JSON.parse(readFileSync(vp, "utf8")) : null, res = v?.result || {}, it = v?.turns?.at(-1)?.intent;
  const vfiles = [];
  if (res.campaign) { const last = [...res.campaign].reverse().find((c) => c.file); if (last) { const sub = JSON.parse(readFileSync(vp, "utf8")); vfiles.push({ cap: "", p: join(RUNS, `full-${id}`, last.file) }); const d = `d${last.n}-`; for (const f of readdirSync(join(RUNS, `full-${id}`)).filter((x) => x.startsWith(d) && /^d\d+-(resize|crop|reflow)-/.test(x) && x !== last.file)) vfiles.push({ cap: f.replace(/^d\d+-/, ""), p: join(RUNS, `full-${id}`, f) }); } }
  else if (res.files) for (const f of res.files) vfiles.push({ cap: f.aspect, p: join(RUNS, `full-${id}`, f.file) });
  else if (res.file || res.film) vfiles.push({ cap: "", p: join(RUNS, `full-${id}`, res.film || res.file) });
  const vIn = (v?.attachments || []).map((a) => `<img class="in" src="${esc(relative(od, join(RUNS, `full-${id}`, a.file)))}" title="${esc(a.name)}">`).join("");
  const mp = join(MCP, `M${id}.json`), m = existsSync(mp) ? JSON.parse(readFileSync(mp, "utf8")) : null, t = m?.turns?.[0];
  const mcalls = (t?.calls || []).filter((c) => !/^(get_workflow_guide|wait_|get_|fetch_)/.test(c.name)).map((c) => { const a = typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments; return `${c.name}${a?.model ? ` (${a.model})` : ""}`; });
  const sess = m ? join(V2, m.sessionDir, "assets") : null, mfiles = sess && existsSync(sess) ? readdirSync(sess).filter((f) => /\.(mp4|png|jpg|mp3)$/i.test(f) && !/muted/.test(f)).sort().map((f) => join(sess, f)) : [];
  const said = (t?.agent || "").replace(/\?X-Goog[^)\s]*/g, "").replace(/\]\(https?:[^)]*\)/g, "]");
  rows.push(`<div class="row"><div class="head"><b>${esc(id)} · ${esc(item.title)}</b><div class="mut">${esc(item.full)}</div></div>
<div class="side"><h3>V4 <span class="mut">${esc(it?.tool || "—")}${res.campaign ? ` → ${res.campaign.map((c) => c.tool).join(" → ")}` : ""} · ${v?.credits ?? "—"} cr · asked: ${esc((v?.turns || []).flatMap((x) => x.asked.map((q) => q.param)).join(", ") || "nothing")}</span></h3>${vfiles.length ? vfiles.map((f) => `<figure>${media(f.p)}${f.cap ? `<figcaption>${esc(f.cap)}</figcaption>` : ""}</figure>`).join("") : "<div class=mut>no output</div>"}${res.strategy ? `<p class="mut">${esc(res.strategy)}: ${esc(res.why)}</p>` : ""}${res.overlaid ? `<p class="mut">lettering overlaid: ${esc(res.overlaid.why)}</p>` : ""}</div>
<div class="side"><h3>MCP <span class="mut">${esc(mcalls.join(" → ") || "no creation call")} · ${m?.spent ?? "—"} cr · ${m?.seconds ?? "—"} s</span></h3>${mfiles.length ? mfiles.map((p) => `<figure>${media(p)}<figcaption>${esc(p.split("/").pop())}</figcaption></figure>`).join("") : `<div class="said"><b>made nothing; it said:</b><br>${esc(said.slice(0, 700))}</div>`}</div></div>`);
}
const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--card:#fff;--acc:#2f5d8a}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:22px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1500px;margin-inline:auto}h1{font-size:21px;margin:0 0 8px}h3{font-size:13.5px;margin:0 0 6px}.mut{color:var(--mut);font-size:12.5px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:12px 0}.head{grid-column:1/-1}.side{min-width:0}figure{margin:0 0 6px}figure img,figure video{width:100%;max-height:340px;object-fit:contain;background:#000;border-radius:6px}figcaption{font-size:11px;color:var(--mut)}.ins{display:flex;gap:4px;margin-bottom:6px}.ins img{width:60px;height:60px;object-fit:cover;border-radius:4px}.said{font-size:12.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;white-space:pre-wrap}img[data-zoom]{cursor:zoom-in}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:9;cursor:zoom-out}#lb img{max-width:96vw;max-height:92vh;object-fit:contain}#lb.on{display:flex}</style>
<h1>${esc(title)}</h1>${rows.join("")}<div id="lb"><img></div><script>const lb=document.getElementById('lb'),li=lb.querySelector('img');document.querySelectorAll('img[data-zoom]').forEach(i=>i.addEventListener('click',()=>{li.src=i.src;lb.classList.add('on')}));lb.addEventListener('click',()=>lb.classList.remove('on'));document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('on')});</script>`;
writeFileSync(OUT, html); console.log(`wrote ${OUT}`);
