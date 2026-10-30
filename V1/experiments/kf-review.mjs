// Review slideshow: one slide per keyframe (then per clip). Left: the keyframe (or the clip), with every attempt on disk
// below it. Right: the references that were sent, as thumbnails in image order, and the prompt exactly as sent, chunk by
// chunk. Keys: ← → flip, 1 / 2 switch variant, A cycle attempts. Usage: node cleaned/experiments/kf-review.mjs --label vanderbilt6 --kf kf2[,kf1]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt6"), kfs = opt("--kf", "kf2").split(",");
const dir = join(RUNS, `exp-${label}`), L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const MODS = Object.fromEntries(await Promise.all(kfs.map(async (k) => [k, (await import(`../src/kf/${k}.js`)).KF])));
const K = Object.fromEntries(kfs.map((k) => [k, L.kf?.[k]]));
for (const k of kfs) if (!K[k]?.plan) { console.error(`no plan for ${k} in ${label}`); process.exit(1); }
const els = L.elements, name = (id) => els.find((e) => e.id === id)?.name || id;
const rel = (f) => (f && existsSync(join(dir, f)) ? `../${f}` : null);
const CLIP_SOURCES = { FRAMES: "the two stills, pinned", CAST: "cast feature lines + thirds from the frames", MOMENT: "shot.moment + scene.tone (+ the last frame's doing)", BEATS: "shot.action + lines (voice from the cast stage) + sfx", PEOPLE: "count of people in the frames", SOUND: "scene.ambience + scene.music" };
const chunks = (prompt) => prompt.split(/\n\n+/).map((b) => { const [head, ...rest] = b.split("\n"); return { head, body: rest.join("\n") }; });
const attempts = (k, id) => { const d = join(dir, k, "stills"); return existsSync(d) ? readdirSync(d).filter((f) => f.startsWith(`${id}.`) || f.startsWith(`${id}-`)).filter((f) => f.endsWith(".png")).sort().map((f) => `../${k}/stills/${f}`) : []; };
const refImage = (ref, k) => { const [kind, id] = ref.split(":"); const file = kind === "env" ? K[k].painted?.[id]?.file : L.bank[id]?.file; return { label: kind === "plate" ? `plate · ${name(id)}` : kind === "env" ? `previous still · ${id}` : `portrait · ${name(id)}`, src: rel(file), file: file || ref }; };
const slides = [];
for (const s of K[kfs[0]].plan.stills) slides.push({ kind: "still", id: s.id, sub: `shot ${s.shot} · ${s.size} · ${s.uses.join(", ")}`, v: Object.fromEntries(kfs.map((k) => { const p = K[k].plan.stills.find((x) => x.id === s.id), painted = K[k].painted?.[s.id]; return [k, { main: rel(painted?.file), attempts: attempts(k, s.id), current: painted?.file ? `../${painted.file}` : null, gate: painted ? (painted.bad ? `flagged: ${painted.check?.note || ""} ${painted.check?.room && !painted.check.room.ok ? `room: ${painted.check.room.note || ""} ${painted.check.room.added?.length ? `added ${painted.check.room.added.join(", ")}` : ""}` : ""}`.trim() : `ok${painted.check?.room ? " · room ok" : ""}${painted.accepted ? " (accepted)" : ""}`) : "not painted", refs: (p?.images || []).map((r) => refImage(r, k)), chunks: chunks(p?.prompt || ""), sources: MODS[k].sources || {} }]; })) });
for (const c of K[kfs[0]].plan.clips) slides.push({ kind: "clip", id: `clip ${c.n}`, sub: `${c.seconds} s · ${c.start} → ${c.end}`, v: Object.fromEntries(kfs.map((k) => { const m = K[k].made?.[c.n]; return [k, { main: rel(m?.clip), attempts: [], gate: m ? (m.identity ? (m.identity.ok ? `identity ok${m.accepted ? " (accepted)" : ""}` : `flagged: ${m.identity.note || ""}`) : (m.error ? `failed: ${m.error.slice(0, 120)}` : "")) + (m?.qa ? ` · first ${m.qa.first_vs_start} · last ${m.qa.last_vs_end}` : "") + (m?.heard ? ` · heard: ${m.heard}` : "") : "not made", refs: [{ label: `image 1 · start still · ${c.start}`, src: rel(K[k].painted?.[c.start]?.file), file: K[k].painted?.[c.start]?.file || "" }, { label: `image 2 · end still · ${c.end}`, src: rel(K[k].painted?.[c.end]?.file), file: K[k].painted?.[c.end]?.file || "" }], chunks: chunks(m?.prompt || c.prompt), sources: CLIP_SOURCES }]; })) });
const html = `<!doctype html><meta charset="utf-8"><title>${label} · review</title>
<style>
html,body{margin:0;height:100%;background:#111;color:#e8e8e8;font:13.5px/1.45 -apple-system,system-ui,sans-serif;overflow:hidden}
#bar{display:flex;align-items:center;gap:14px;padding:9px 16px;background:#1a1a1a;border-bottom:1px solid #2a2a2a;height:34px}
#bar b{font:600 15px ui-monospace,monospace}.sub{color:#9a9a9a;font:12px ui-monospace,monospace}.gate{font:12px ui-monospace,monospace;color:#7fd;}.gate.bad{color:#ff7a86}.n{margin-left:auto;color:#9a9a9a;font:12px ui-monospace,monospace}
button{background:#2a2a2a;color:#eee;border:1px solid #3a3a3a;border-radius:4px;padding:3px 10px;cursor:pointer;font:12px ui-monospace,monospace}button.on{background:#0a58ca;border-color:#0a58ca}
#main{display:grid;grid-template-columns:58% 42%;height:calc(100% - 53px)}
#left{background:#000;display:flex;flex-direction:column;min-height:0}
#view{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;position:relative}
#view img,#view video{max-width:100%;max-height:100%;object-fit:contain;display:block}
#view .missing{color:#777;font:13px ui-monospace,monospace}
#attempts{display:flex;gap:8px;padding:8px 10px;background:#0a0a0a;border-top:1px solid #222;overflow-x:auto}
#attempts img{height:64px;border:2px solid transparent;border-radius:3px;cursor:pointer;opacity:.7}#attempts img.on{border-color:#0a58ca;opacity:1}
#attempts .al{font:10.5px ui-monospace,monospace;color:#888;align-self:center;white-space:nowrap}
#right{overflow:auto;padding:14px 18px;border-left:1px solid #2a2a2a}
h3{font:700 11px ui-monospace,monospace;letter-spacing:.1em;color:#8ab4ff;margin:0 0 8px}
#refs{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}
.ref{width:150px}.ref img{width:150px;height:85px;object-fit:cover;border-radius:3px;border:1px solid #333;display:block}
.ref .rl{font:600 10.5px ui-monospace,monospace;color:#cfd8ff;margin:0 0 3px}.ref .rf{font:10px ui-monospace,monospace;color:#777;word-break:break-all;margin-top:2px}
.ref .missing{width:150px;height:85px;border:1px dashed #444;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#666;font-size:10.5px}
.chunk{border-left:3px solid #2b3a5c;padding:3px 0 3px 10px;margin:0 0 10px}
.chead{display:flex;justify-content:space-between;gap:10px;margin:0 0 2px}.cl{font:700 11px ui-monospace,monospace;letter-spacing:.06em;color:#8ab4ff}.cs{font:10.5px ui-monospace,monospace;color:#777;text-align:right}
pre{white-space:pre-wrap;margin:0;font:12px/1.5 ui-monospace,monospace;color:#ddd}
.hint{color:#666;font:11px ui-monospace,monospace}
</style>
<div id="bar"><button onclick="go(-1)">←</button><button onclick="go(1)">→</button><b id="title"></b><span class="sub" id="sub"></span><span class="gate" id="gate"></span>
<span class="hint">${kfs.length > 1 ? "1 / 2 variant · " : ""}A attempts · ← →</span><span id="vbtns"></span><span class="n" id="n"></span></div>
<div id="main"><div id="left"><div id="view"></div><div id="attempts"></div></div><div id="right"></div></div>
<script>
const S = ${JSON.stringify(slides)}, KFS = ${JSON.stringify(kfs)}; let i = 0, v = 0, att = -1;
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
function render() {
  const s = S[i], k = KFS[v], d = s.v[k];
  document.getElementById("title").textContent = s.id; document.getElementById("sub").textContent = s.sub;
  const g = document.getElementById("gate"); g.textContent = d.gate || ""; g.className = "gate" + (/flagged|failed/.test(d.gate || "") ? " bad" : "");
  document.getElementById("n").textContent = (i + 1) + " / " + S.length + (KFS.length > 1 ? " · " + k.toUpperCase() : "");
  document.getElementById("vbtns").innerHTML = KFS.length > 1 ? KFS.map((x, j) => '<button class="' + (j === v ? "on" : "") + '" onclick="setv(' + j + ')">' + x.toUpperCase() + '</button>').join(" ") : "";
  const shown = att >= 0 && d.attempts[att] ? d.attempts[att] : (d.current || d.main);
  document.getElementById("view").innerHTML = s.kind === "still" ? (shown ? '<img src="' + shown + '">' : '<span class="missing">not painted yet</span>') : (d.main ? '<video controls autoplay muted loop src="' + d.main + '"></video>' : '<span class="missing">not made yet</span>');
  document.getElementById("attempts").innerHTML = d.attempts.length > 1 ? '<span class="al">attempts</span>' + d.attempts.map((a, j) => '<img src="' + a + '" class="' + (a === shown ? "on" : "") + '" title="' + esc(a.split("/").pop()) + '" onclick="att=' + j + ';render()">').join("") + '<span class="al">' + esc((shown || "").split("/").pop()) + (shown === d.current ? " · used" : "") + '</span>' : "";
  document.getElementById("right").innerHTML = '<h3>REFERENCES SENT</h3><div id="refs">' + d.refs.map((r) => '<div class="ref"><div class="rl">' + esc(r.label) + '</div>' + (r.src ? '<img src="' + r.src + '">' : '<div class="missing">missing</div>') + '<div class="rf">' + esc(r.file) + '</div></div>').join("") + '</div><h3>PROMPT SENT</h3>' +
    d.chunks.map((c) => '<div class="chunk"><div class="chead"><span class="cl">' + esc(c.head) + '</span><span class="cs">' + esc(d.sources[c.head.replace(/\\s*\\(.*$/, "")] || "") + '</span></div><pre>' + esc(c.body) + '</pre></div>').join("");
}
function go(dd) { i = (i + dd + S.length) % S.length; att = -1; render(); }
function setv(j) { v = j; att = -1; render(); }
document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "1" && KFS[0]) setv(0); else if (e.key === "2" && KFS[1]) setv(1); else if (e.key.toLowerCase() === "a") { const d = S[i].v[KFS[v]]; if (d.attempts.length) { att = (att + 1) % d.attempts.length; render(); } } });
render();
</script>`;
mkdirSync(join(dir, "review"), { recursive: true });
writeFileSync(join(dir, "review", "index.html"), html);
console.log(`${join(dir, "review", "index.html")}: ${slides.length} slides for ${kfs.join(", ")}`);
