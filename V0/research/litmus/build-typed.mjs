// Builds typed.html: the typed-state litmus runs (F, CAR, G) with video, credits, per-scene frames and state verdicts.
// Usage: node current/research/litmus/build-typed.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TESTS = [
  { id: "CAR", title: "Car ad · desert → Tokyo drift", note: "Same car across a cut to a new place." },
  { id: "G", title: "Car ad · car + keychain", note: "Two stable assets: the car outside, the keychain inside the cabin (part_of car)." },
  { id: "F", title: "Lighthouse · generated end frames chained", note: "Each scene starts from the previous scene's generated end frame." },
];
const FINDINGS = {
  CAR: ["Every record stable: car and both locations pass invariant and pairwise checks."],
  G: ["Car and keychain stable in all 4 scenes.", "The Tokyo keychain is the same keychain on the same seat fitting as in the desert; only the light changes."],
  F: ["Shell size fixed: palm-sized in every scene.", "Keeper and shell stable after one retry where flagged.",
    "Beach lighthouse drifts: missing in scene 2, smaller in scene 4, a cottage is added in scene 5. The store flagged each case; the retry accepted the frame after one attempt.",
    "Fix: when a location is not stable, rebuild from the last stable location record instead of accepting the frame.",
    "The 9 scenes stop at home at night; the storm and relight are not in this test."],
};

const card = (rec, sc) => {
  const bad = Object.entries(rec.assets).filter(([, a]) => !a.stable);
  const flags = bad.map(([l, a]) => `<li>${esc(l)}: ${esc([...(a.present ? [] : ["absent"]), ...(a.diffs || []), ...Object.entries(a.matches || {}).filter(([, v]) => !v).map(([k]) => `${k} ≠ expected (${a.observed?.[k] ?? "?"})`)].join("; ") || "not stable")}</li>`).join("");
  const ok = Object.entries(rec.assets).filter(([, a]) => a.stable).map(([l]) => l);
  return `<figure class="${rec.rejected ? "rej" : bad.length ? "warn" : "ok"}"><img src="test-${sc}/${esc(rec.file)}" loading="lazy">
<figcaption><b>${rec.id}</b> · ${esc(rec.role)}${rec.rejected ? " · <span class=bad>rejected, retried</span>" : ""}<br><span class=okc>✓ ${esc(ok.join(", ") || "none")}</span>${flags ? `<ul>${flags}</ul>` : ""}</figcaption></figure>`;
};

const sections = TESTS.map((t) => {
  const d = join(DIR, `test-${t.id}`);
  if (!existsSync(join(d, "result.json"))) return "";
  const r = JSON.parse(readFileSync(join(d, "result.json"), "utf8")), st = JSON.parse(readFileSync(join(d, "state.json"), "utf8"));
  const credits = Object.values(r.jobs).reduce((a, j) => a + (j.credits || 0), 0);
  const recs = st.records, stable = recs.filter((x) => !x.rejected && Object.values(x.assets).every((a) => a.stable)).length;
  const scenes = r.doc.scenes.map((s) => {
    const rs = recs.filter((x) => x.scene === s.n);
    return `<div class="scene"><h3>Scene ${s.n} <span class=soft>· ${esc(s.link)} · ${esc(s.location)}</span></h3><p>${esc(s.action)} <span class=soft>${esc(s.camera)}</span></p>
${s.end.changes.length ? `<p class=soft>Changes: ${esc(s.end.changes.map((c) => `${c.label} ${c.property}: ${c.from} → ${c.to}`).join("; "))}</p>` : ""}<div class="row">${rs.map((x) => card(x, t.id)).join("")}</div></div>`;
  }).join("");
  return `<section id="${t.id}"><h2>Litmus ${t.id} · ${esc(t.title)}</h2><p class=soft>${esc(t.note)}</p>
<p class="req">“${esc(r.request)}”</p>
<div class="stats"><span><b>${credits.toLocaleString()}</b> credits</span><span><b>${r.doc.scenes.length}</b> scenes</span><span><b>${stable}/${recs.length}</b> frames fully stable</span><span>chain: ${esc(r.mode.chain)}</span><span>median frame jump <b>${r.measures?.median_jump ?? "–"}</b></span></div>
<video controls preload="metadata" src="test-${t.id}/joined.mp4"></video>
<ul class="find">${(FINDINGS[t.id] || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<p><a href="test-${t.id}/state.html">Asset lineage page →</a> · <a href="test-${t.id}/scene-states.md">typed scene-state doc</a></p>${scenes}</section>`;
}).join("");

writeFileSync(join(DIR, "typed.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Typed State Litmus</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--ok:#4f7a3a;--bad:#a0402d;--warn:#c08a2a;--card:#fbf7ef}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1d1813;--ink:#efe4d2;--soft:#b39b80;--line:#4a3d30;--card:#28211a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif}main{max-width:1200px;margin:0 auto;padding:32px 16px 80px}
h1,h2,h3{font-weight:normal}h2{font-size:26px;border-top:1px solid var(--line);padding-top:24px;margin-top:48px}h3{font-size:17px;margin:24px 0 2px}.soft{color:var(--soft)}
nav a{margin-right:16px;color:var(--ink)}a{color:var(--ink)}.req{font-style:italic;border-left:3px solid var(--line);padding-left:12px}
.stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin:12px 0}video{width:100%;max-width:960px;display:block;background:#000;margin:12px 0}
.find li{margin:2px 0}.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}figure{flex:0 0 240px;margin:0;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--ok);padding:8px;font-size:12.5px}
figure.warn{border-top-color:var(--warn)}figure.rej{border-top-color:var(--bad);opacity:.75}figure img{width:100%;display:block;margin-bottom:6px}figure ul{margin:4px 0 0;padding-left:16px;color:var(--bad)}.bad{color:var(--bad)}.okc{color:var(--ok)}</style></head>
<body><main><h1>Typed state litmus · F, CAR, G</h1><p class=soft>Every frame is checked against the typed state store. Green = all assets stable · amber = some asset not stable · red = rejected and retried. ✓ lists the stable assets; red lines say what broke.</p>
<nav>${TESTS.map((t) => `<a href="#${t.id}">${t.id}</a>`).join("")}</nav>${sections}</main></body></html>`);
console.log("wrote", join(DIR, "typed.html"));
