// Keyframes as a slideshow: one slide per keyframe in script order, each showing the KF variants side by side (painted still,
// or a placeholder until it is painted), then one slide per clip with the videos. Keys: ← → flip, 1 / 2 show one variant,
// 0 both, P prompt. Usage: node V1/experiments/kf-slides.mjs --label vanderbilt6 --kf kf1,kf2 → runs/exp-<label>/slides/index.html
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt6"), kfs = opt("--kf", "kf1,kf2").split(",");
const dir = join(RUNS, `exp-${label}`), L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const K = Object.fromEntries(kfs.map((k) => [k, L.kf?.[k]]));
for (const k of kfs) if (!K[k]?.plan) { console.error(`no plan for ${k} in ${label}`); process.exit(1); }
const stills = K[kfs[0]].plan.stills, clips = K[kfs[0]].plan.clips;
const file = (f) => (f && existsSync(join(dir, f)) ? `../${f}` : null);
const slides = [
  ...stills.map((s) => ({ kind: "still", title: s.id, sub: `shot ${s.shot} · ${s.size} · ${s.uses.join(", ")}`, panels: kfs.map((k) => { const p = K[k].plan.stills.find((x) => x.id === s.id), painted = K[k].painted?.[s.id]; return { kf: k, img: file(painted?.file), bad: !!painted?.bad, prompt: p?.prompt || "" }; }) })),
  ...clips.map((c) => ({ kind: "clip", title: `clip ${c.n}`, sub: `${c.seconds} s · ${c.start} → ${c.end}`, panels: kfs.map((k) => { const m = K[k].made?.[c.n]; return { kf: k, video: file(m?.clip), qa: m?.qa ? `first ${m.qa.first_vs_start} · last ${m.qa.last_vs_end}${m.identity ? ` · identity ${m.identity.ok ? "ok" : "FAIL"}${m.identity.note ? ` (${m.identity.note})` : ""}` : ""}${m.tries > 1 ? ` · try ${m.tries}` : ""}` : "", heard: m?.heard || "", prompt: c.prompt }; }) })),
];
const html = `<!doctype html><meta charset="utf-8"><title>${label} · keyframes</title>
<style>
html,body{margin:0;height:100%;background:#111;color:#eee;font:14px/1.4 -apple-system,system-ui,sans-serif}
#bar{display:flex;align-items:center;gap:18px;padding:10px 16px;background:#1a1a1a;border-bottom:1px solid #2a2a2a}
#bar b{font:600 15px ui-monospace,monospace}#bar .sub{color:#9a9a9a;font:12.5px ui-monospace,monospace}#bar .n{margin-left:auto;color:#9a9a9a;font:12.5px ui-monospace,monospace}
button{background:#2a2a2a;color:#eee;border:1px solid #3a3a3a;border-radius:4px;padding:4px 10px;cursor:pointer;font:12px ui-monospace,monospace}button.on{background:#0a58ca;border-color:#0a58ca}
#stage{display:grid;gap:12px;padding:12px 16px;height:calc(100% - 52px);box-sizing:border-box}
.panel{position:relative;background:#000;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:0}
.panel img,.panel video{max-width:100%;max-height:100%;object-fit:contain;display:block}
.tag{position:absolute;top:8px;left:10px;font:700 12px ui-monospace,monospace;letter-spacing:.08em;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:3px}
.bad{position:absolute;top:8px;right:10px;font:700 12px ui-monospace,monospace;color:#ff5a6a;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:3px}
.qa{position:absolute;bottom:8px;left:10px;font:11px ui-monospace,monospace;color:#ccc;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:3px}
.missing{color:#777;font:13px ui-monospace,monospace}
#prompt{display:none;position:fixed;right:0;top:52px;bottom:0;width:min(560px,48vw);background:#161616;border-left:1px solid #2a2a2a;overflow:auto;padding:14px 16px;box-sizing:border-box}
#prompt pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace;color:#ddd;margin:0 0 18px}#prompt .tag{position:static;display:inline-block;margin:0 0 6px}
.hint{color:#777;font:11.5px ui-monospace,monospace}
</style>
<div id="bar"><button onclick="go(-1)">←</button><button onclick="go(1)">→</button><b id="title"></b><span class="sub" id="sub"></span>
<span class="hint">1 / 2 one variant · 0 both · P prompt</span><button id="pb" onclick="togglePrompt()">prompt</button><span class="n" id="n"></span></div>
<div id="stage"></div><div id="prompt"></div>
<script>
const S = ${JSON.stringify(slides)}; let i = 0, show = 0, prompt = false;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
function render() {
  const s = S[i], panels = show ? s.panels.filter((p, j) => j === show - 1) : s.panels;
  document.getElementById("title").textContent = s.title; document.getElementById("sub").textContent = s.sub; document.getElementById("n").textContent = (i + 1) + " / " + S.length;
  const st = document.getElementById("stage"); st.style.gridTemplateColumns = "repeat(" + panels.length + ",1fr)";
  st.innerHTML = panels.map((p) => '<div class="panel"><span class="tag">' + p.kf.toUpperCase() + '</span>' + (p.bad ? '<span class="bad">check failed</span>' : '') +
    (s.kind === "still" ? (p.img ? '<img src="' + p.img + '">' : '<span class="missing">not painted yet</span>') : (p.video ? '<video controls autoplay muted loop src="' + p.video + '"></video>' : '<span class="missing">not made yet</span>')) +
    (p.qa ? '<span class="qa">' + esc(p.qa) + (p.heard ? ' · heard: ' + esc(p.heard) : '') + '</span>' : '') + '</div>').join("");
  document.getElementById("prompt").innerHTML = panels.map((p) => '<span class="tag">' + p.kf.toUpperCase() + '</span><pre>' + esc(p.prompt) + '</pre>').join("");
  document.getElementById("prompt").style.display = prompt ? "block" : "none"; document.getElementById("pb").className = prompt ? "on" : "";
}
function go(d) { i = (i + d + S.length) % S.length; render(); }
function togglePrompt() { prompt = !prompt; render(); }
document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "1") { show = 1; render(); } else if (e.key === "2") { show = 2; render(); } else if (e.key === "0") { show = 0; render(); } else if (e.key.toLowerCase() === "p") togglePrompt(); });
render();
</script>`;
mkdirSync(join(dir, "slides"), { recursive: true });
writeFileSync(join(dir, "slides", "index.html"), html);
console.log(`${join(dir, "slides", "index.html")}: ${slides.length} slides (${stills.length} keyframes, ${clips.length} clips)`);
