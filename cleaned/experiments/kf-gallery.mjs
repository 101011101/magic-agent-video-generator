// Keyframes only: one large picture per keyframe in script order, its gate verdict, every attempt on disk as thumbnails
// (click to swap), and for the attempt shown the INPUT that made it: the images sent, in order, and the prompt, both taken
// from the job record of that exact file. Usage: node cleaned/experiments/kf-gallery.mjs --label vanderbilt6 --kf kf2
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt6"), kf = opt("--kf", "kf2");
const dir = join(RUNS, `exp-${label}`), L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), K = L.kf?.[kf];
if (!K?.plan) { console.error(`no plan for ${kf}`); process.exit(1); }
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const name = (id) => L.elements.find((e) => e.id === id)?.name || id;
// What a run-relative input file is: a bank plate or portrait, or an earlier still.
const kindOf = (f) => { const b = Object.entries(L.bank).find(([, v]) => v.file === f); if (b) return `${L.elements.find((e) => e.id === b[0])?.kind === "place" ? "plate" : "portrait"} · ${name(b[0])}`; const m = f.match(/stills\/(s\d+-\d+)/); return m ? `earlier still · ${m[1]}` : f; };
// The job record of each painted file: the exact prompt and inputs that made it.
const jobOf = (file) => Object.values(L.jobs || {}).find((j) => j.file === file);
const attempts = (id) => { const d = join(dir, kf, "stills"); return existsSync(d) ? readdirSync(d).filter((f) => (f.startsWith(`${id}.`) || f.startsWith(`${id}-`)) && f.endsWith(".png")).sort().map((f) => `${kf}/stills/${f}`) : []; };
const rows = K.plan.stills.map((s) => {
  const p = K.painted?.[s.id], used = p?.file || null, all = attempts(s.id);
  const verdict = !p ? "not painted yet" : p.bad ? `flagged · ${p.check?.room && !p.check.room.ok ? `room: ${p.check.room.note || ""}` : p.check?.note || ""}` : `ok${p.accepted ? " · accepted" : ""}${p.rechecked ? " · re-judged" : ""}`;
  const inputs = Object.fromEntries(all.map((f) => { const j = jobOf(f); return [f, j ? { images: (j.inputs || []).map((x) => ({ file: x, kind: kindOf(x), src: existsSync(join(dir, x)) ? `../${x}` : null })), prompt: j.prompt || "" } : { images: [], prompt: "(no job record)" }]; }));
  return { id: s.id, sub: `shot ${s.shot} · ${s.size} · ${s.uses.join(", ")} · painted from ${s.envKind}${s.env ? ` ${s.env}` : ""}`, used, all, verdict, bad: !!p?.bad, inputs };
});
const html = `<!doctype html><meta charset="utf-8"><title>${esc(label)} · keyframes</title>
<style>
body{margin:0;padding:28px 32px;background:#0f0f0f;color:#e8e8e8;font:14px/1.45 -apple-system,system-ui,sans-serif}
h1{font:600 18px ui-monospace,monospace;margin:0 0 6px}.note{color:#777;font:12px ui-monospace,monospace;margin:0 0 26px}
.kf{margin:0 0 54px;max-width:1500px;display:grid;grid-template-columns:minmax(0,62%) minmax(0,38%);gap:18px}
.head{grid-column:1/3;display:flex;align-items:baseline;gap:16px;margin:0 0 2px}.head b{font:700 16px ui-monospace,monospace}.head .sub{color:#9a9a9a;font:12px ui-monospace,monospace}
.verdict{font:12px ui-monospace,monospace;color:#7fd;margin-left:auto}.verdict.bad{color:#ff7a86}
.main{background:#000;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:200px}
.main img{width:100%;display:block}.main .missing{color:#666;font:13px ui-monospace,monospace;padding:60px}
.atts{display:flex;gap:12px;margin:8px 0 0;align-items:flex-start}.atts .al{font:11px ui-monospace,monospace;color:#888;padding-top:28px}
.att{display:flex;flex-direction:column;align-items:center;gap:4px}.att img{height:72px;border:2px solid transparent;border-radius:3px;cursor:pointer;opacity:.7}.att img.on{border-color:#0a58ca;opacity:1}
.att .cap{font:11px ui-monospace,monospace;color:#888}.att.used .cap{font-weight:800;color:#fff;font-size:12px}.att.used .cap::after{content:" · USED"}
.input{background:#161616;border:1px solid #262626;border-radius:6px;padding:12px 14px;overflow:auto;max-height:720px}
.input h3{font:700 11px ui-monospace,monospace;letter-spacing:.1em;color:#8ab4ff;margin:0 0 8px}
.imgs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.im{width:126px}.im img{width:126px;height:71px;object-fit:cover;border-radius:3px;border:1px solid #333;display:block}
.im .il{font:600 10.5px ui-monospace,monospace;color:#cfd8ff;margin:0 0 3px}.im .if{font:10px ui-monospace,monospace;color:#777;word-break:break-all;margin-top:2px}
pre{white-space:pre-wrap;margin:0;font:11.5px/1.5 ui-monospace,monospace;color:#ddd}
</style>
<h1>${esc(L.script?.title || label)} · keyframes · ${kf.toUpperCase()}</h1>
<p class="note">in script order · the large picture is the one the film uses · click another attempt to see it and the input that made it</p>
${rows.map((r, i) => `<section class="kf" id="${esc(r.id)}"><div class="head"><b>${esc(r.id)}</b><span class="sub">${esc(r.sub)}</span><span class="verdict${r.bad ? " bad" : ""}">${esc(r.verdict)}</span></div>
<div><div class="main">${r.used ? `<img id="img${i}" src="../${r.used}">` : `<span class="missing">${r.verdict}</span>`}</div>
${r.all.length ? `<div class="atts"><span class="al">attempts</span>${r.all.map((a) => `<div class="att${a === r.used ? " used" : ""}"><img src="../${a}" class="${a === r.used ? "on" : ""}" title="${esc(a.split("/").pop())}" data-f="${esc(a)}" onclick="swap(${i},this)"><span class="cap">${esc(a.split("/").pop())}</span></div>`).join("")}</div>` : ""}</div>
<div class="input" id="in${i}"></div>
</section>`).join("")}
<script>
const ROWS = ${JSON.stringify(rows.map((r) => ({ used: r.used, inputs: r.inputs })))};
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
function showInput(i, f) { const d = ROWS[i].inputs[f]; const el = document.getElementById("in" + i); if (!d) { el.innerHTML = ""; return; }
  el.innerHTML = '<h3>INPUT · ' + esc(f.split("/").pop()) + (f === ROWS[i].used ? ' · USED' : '') + '</h3><div class="imgs">' + d.images.map((im, j) => '<div class="im"><div class="il">image ' + (j + 1) + ' · ' + esc(im.kind) + '</div>' + (im.src ? '<img src="' + im.src + '">' : '') + '<div class="if">' + esc(im.file) + '</div></div>').join("") + '</div><h3>PROMPT</h3><pre>' + esc(d.prompt) + '</pre>'; }
function swap(i, el) { const m = document.getElementById("img" + i); if (m) m.src = el.src; el.closest("section").querySelectorAll(".atts img").forEach((x) => x.classList.toggle("on", x === el)); showInput(i, el.dataset.f); }
ROWS.forEach((r, i) => { if (r.used) showInput(i, r.used); });
</script>`;
mkdirSync(join(dir, "keyframes"), { recursive: true });
writeFileSync(join(dir, "keyframes", "index.html"), html);
console.log(`${join(dir, "keyframes", "index.html")}: ${rows.length} keyframes (${rows.filter((r) => r.used).length} painted)`);
