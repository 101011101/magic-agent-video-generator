// V4 vs the MCP on the same full briefs: per item, both outputs side by side, what each called, and a pairwise VLM verdict
// (frames for clips). Usage: node V4/tests/compare-mcp.mjs → V4/runs/compare-mcp.html
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { V2 } from "../../V2/backend/lib/env.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { V4 } from "../agent/run.mjs";
const RUNS = join(V4, "runs"), RES = join(V2, "bench/v1/results/mcp-v4"), OUT = join(RUNS, "compare-mcp.html"), od = RUNS, esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const vf = join(RUNS, "compare-verdicts.json"), verdicts = existsSync(vf) ? JSON.parse(readFileSync(vf, "utf8")) : {};
const items = readdirSync(join(V4, "tests/items")).map((f) => JSON.parse(readFileSync(join(V4, "tests/items", f), "utf8"))).filter((it) => it.id !== "V03").sort((a, b) => a.id.localeCompare(b.id));
const frames = (file, tag) => { const out = []; for (const t of [1, 4, 8]) { const f = join(RUNS, "cmp-frames", `${tag}-${t}.jpg`); try { execFileSync("mkdir", ["-p", join(RUNS, "cmp-frames")]); execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-update", "1", f]); out.push(f); } catch {} } return out; };
let ours = 0, theirs = 0, ties = 0; const rows = [];
for (const it of items) {
  const our = JSON.parse(readFileSync(join(RUNS, `full-${it.id}`, "run.json"), "utf8")), ourFile = our.result?.file || our.result?.film, ourPath = ourFile ? join(RUNS, `full-${it.id}`, ourFile) : null;
  const mp = join(RES, `M${it.id}.json`); if (!existsSync(mp)) continue;
  const m = JSON.parse(readFileSync(mp, "utf8")), sess = join(V2, m.sessionDir), mAssets = existsSync(join(sess, "assets")) ? readdirSync(join(sess, "assets")).filter((f) => /\.(png|jpg|mp4)$/i.test(f) && !/muted/.test(f)).sort() : [], mFile = mAssets.at(-1), mPath = mFile ? join(sess, "assets", mFile) : null;
  const mCalls = m.turns[0].calls.filter((c) => !/^(get_workflow_guide|wait_|get_|fetch_)/.test(c.name)).map((c) => { const a = typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments; return `${c.name}${a?.model ? ` (${a.model})` : ""}`; });
  const isVid = (p) => p && /\.mp4$/i.test(p);
  if (!verdicts[it.id] && ourPath && mPath && existsSync(ourPath) && existsSync(mPath)) {
    const A = isVid(ourPath) ? frames(ourPath, `v4-${it.id}`) : [ourPath], B = isVid(mPath) ? frames(mPath, `mcp-${it.id}`) : [mPath];
    const first = Math.random() < 0.5 ? "A" : "B", imgs = first === "A" ? [...A, ...B] : [...B, ...A];
    const r = await jsonCall({ name: "v4-vs-mcp", effort: "medium", images: imgs, schema: S.obj({ winner: S.enum(["first", "second", "tie"]), strength: S.enum(["slight", "clear", "decisive"]), why: S.str }), prompt: `Two results were made for the same request. ${isVid(ourPath) ? `Images 1–${A.length} are frames of the FIRST result and the rest frames of the SECOND.` : "Image 1 is the FIRST result, image 2 the SECOND."}\nREQUEST: ${it.full}\nWhich is the better deliverable for this request (faithful to it, correct words if any, believable, usable)? winner first/second/tie, strength, why in two sentences.` });
    verdicts[it.id] = { ...r, first, winner_side: r.winner === "tie" ? "tie" : (r.winner === "first") === (first === "A") ? "V4" : "MCP" }; writeFileSync(vf, JSON.stringify(verdicts, null, 1));
  }
  const v = verdicts[it.id]; if (v) { if (v.winner_side === "V4") ours++; else if (v.winner_side === "MCP") theirs++; else ties++; }
  const show = (p, base) => !p ? "<div class=mut>no output</div>" : isVid(p) ? `<video controls preload="metadata" src="${esc(relative(od, p))}"></video>` : `<img src="${esc(relative(od, p))}" data-zoom>`;
  rows.push(`<div class="row"><div class="head"><b>${esc(it.id)} · ${esc(it.title)}</b><div class="mut">${esc(it.full)}</div></div>
<div class="side"><h3>V4 <span class="mut">${esc(our.turns.at(-1)?.intent?.tool)} · ${our.credits} cr</span></h3>${show(ourPath)}</div>
<div class="side"><h3>MCP <span class="mut">${esc(mCalls.join(" → ") || "no creation call")} · ${m.spent} cr</span></h3>${show(mPath)}</div>
<div class="verdict">${v ? `<b>${esc(v.winner_side)}</b> (${esc(v.strength)}; ${v.first === "A" ? "V4" : "MCP"} shown first)<br><span class="mut">${esc(v.why)}</span>` : "<span class=mut>no verdict</span>"}</div></div>`);
  console.log(`${it.id}: V4 ${our.turns.at(-1)?.intent?.tool} ${our.credits}cr · MCP ${mCalls.join("→")} ${m.spent}cr · ${v ? `${v.winner_side} (${v.strength})` : "—"}`);
}
const html = `<!doctype html><meta charset="utf-8"><title>V4 vs MCP</title><style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--card:#fff;--acc:#2f5d8a}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:22px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1500px;margin-inline:auto}h1{font-size:21px;margin:0 0 6px}h3{font-size:13.5px;margin:0 0 4px}.mut{color:var(--mut);font-size:12.5px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:12px 0}.head,.verdict{grid-column:1/-1}.side{min-width:0}.side img,.side video{width:100%;max-height:380px;object-fit:contain;background:#000;border-radius:6px;cursor:zoom-in}.verdict{border-top:1px solid var(--line);padding-top:6px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:9;cursor:zoom-out}#lb img{max-width:96vw;max-height:92vh;object-fit:contain}#lb.on{display:flex}</style>
<h1>V4 vs the MCP · the same thirteen full briefs</h1><p>Pairwise VLM verdict per item, shown in random order to the judge: <b>V4 ${ours} · MCP ${theirs} · tie ${ties}</b>. V4 spent ${items.reduce((n, it) => n + (JSON.parse(readFileSync(join(RUNS, `full-${it.id}`, "run.json"), "utf8")).credits || 0), 0)} credits from our ledger; the MCP's credits came from the account. Click images to zoom.</p>${rows.join("")}
<div id="lb"><img></div><script>const lb=document.getElementById('lb'),li=lb.querySelector('img');document.querySelectorAll('img[data-zoom]').forEach(i=>i.addEventListener('click',()=>{li.src=i.src;lb.classList.add('on')}));lb.addEventListener('click',()=>lb.classList.remove('on'));document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('on')});</script>`;
writeFileSync(OUT, html); console.log(`wrote ${OUT}`);
