// Results page for the reference + text test: per arm, the inputs it got (pictures and/or texts), what the MCP called, its output(s),
// and a VLM check of each output against the REAL pictures of every element (so text arms are judged on the same likeness scale).
// Usage: node V3/compose/rt3-page.mjs  → V3/runs/reftest-3/index.html (+ checks.json)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { V2 } from "../../V2/backend/lib/env.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { V3 } from "./paths.mjs";
const RES = join(V2, "bench/v1/results/mcp-reftest3"), FIX = join(V2, "bench/v1/fixtures"), OUT = join(V3, "runs/reftest-3"), od = OUT;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const b = (v) => `<span class="b ${v === "yes" ? "ok" : v === "partly" ? "mid" : "bad"}">${esc(v)}</span>`;
const ELEMENTS = { R1: { room: "rt3-classroom.jpg", man: "rt3-vanderbilt.jpg" }, R2: { place: "rt3-goldengate.jpg", car: "rt3-bugatti.jpg" }, R3: { place: "rt3-banff.jpg", man: "rt3-twain.jpg", pot: "rt3-flowerpot.jpg" } };
const checksFile = join(OUT, "checks.json"), checks = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, "utf8")) : {};
const ids = readdirSync(RES).filter((f) => /^R\d[a-d]\.json$/.test(f)).map((f) => f.replace(".json", "")).sort();
const rows = [];
for (const id of ids) {
  const r = JSON.parse(readFileSync(join(RES, `${id}.json`), "utf8")), sess = join(V2, r.sessionDir), assets = existsSync(join(sess, "assets")) ? readdirSync(join(sess, "assets")).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort() : [];
  const el = ELEMENTS[id.slice(0, 2)], refsGiven = r.turns.flatMap((t) => t.materials || []), final = assets.at(-1);
  const calls = r.turns.flatMap((t) => t.calls.filter((c) => /^(edit_image|generate_image)$/.test(c.name)).map((c) => { const a = typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments; return { name: c.name, model: a.model, inputs: (a.assets?.image_file_paths || []).length, prompt: a.style?.prompt || "", err: !!c.error }; }));
  if (final && !checks[id]) {
    const names = Object.keys(el);
    checks[id] = await jsonCall({ name: "v3-rt3-check-v1", effort: "medium", images: [...names.map((n) => join(FIX, el[n])), join(sess, "assets", final)], schema: S.obj({ elements: S.arr(S.obj({ name: S.str, present: S.enum(["yes", "no"]), likeness: S.enum(["yes", "partly", "no"]), evidence: S.str })), coherent: S.enum(["yes", "no"]), extras: S.str }), prompt: `Images 1–${names.length} are the REAL pictures of: ${names.map((n, i) => `image ${i + 1} = the ${n}`).join(", ")}. The last image is a generated picture that was supposed to contain all of them together. For each element: is it present, and how closely does it match the real picture (yes = clearly the same room/person/car/pot; partly = same type but details differ; no = different)? Evidence in a few words. coherent: one believable photograph (yes/no). extras: anything added that should not be there (people, text, duplicated objects), or "none".` });
    writeFileSync(checksFile, JSON.stringify(checks, null, 1));
  }
  const c = checks[id];
  rows.push({ id, title: r.item?.title || id, text: r.turns.map((t) => t.text).join("\n\n— then —\n\n"), refsGiven, calls, assets: assets.map((f) => relative(od, join(sess, "assets", f))), spent: r.spent, seconds: r.seconds, check: c, agent: r.turns.at(-1)?.agent || "" });
  console.log(`${id}: ${r.spent} cr · ${calls.map((x) => `${x.name} ${x.model} ${x.inputs} in`).join(" → ")} · ${c ? c.elements.map((e) => `${e.name} ${e.present}/${e.likeness}`).join(", ") + ` · coherent ${c.coherent} · extras ${c.extras}` : "no output"}`);
}
const fig = (src, cap, cls = "t") => `<figure class="${cls}"><img src="${esc(src)}" data-zoom><figcaption>${esc(cap)}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><title>Reference + text vs reference + reference</title>
<style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--card:#fff;--ok:#1d7a3d;--bad:#b3261e;--mid:#9a6b00;--acc:#2f5d8a}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--acc:#8ab4e8;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--acc:#8ab4e8;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:22px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1750px;margin-inline:auto}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;border-top:1px solid var(--line);padding-top:10px}.mut{color:var(--mut);font-size:12.5px}
.row{display:grid;grid-template-columns:190px 1fr 400px;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0}@media(max-width:1100px){.row{grid-template-columns:1fr}}
.pipe{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ins{display:flex;gap:6px;padding:6px;border:1px dashed var(--line);border-radius:8px;align-items:center}.txt{width:92px;height:92px;border:1px solid var(--line);border-radius:5px;font-size:10px;color:var(--mut);padding:4px;overflow:hidden;line-height:1.2;background:var(--bg)}
figure{margin:0;text-align:center}figure img{border-radius:5px;border:1px solid var(--line);cursor:zoom-in;background:#000;object-fit:cover}.t img{width:92px;height:92px}.mid img{width:180px;height:101px}.out img{width:340px;height:191px;border:2px solid var(--acc)}figcaption{font-size:10.5px;color:var(--mut);margin-top:2px}
.arrow{font-size:11.5px;color:var(--mut);text-align:center;line-height:1.2;min-width:96px}.arrow::after{content:"→";display:block;font-size:20px;color:var(--acc)}
.checks{font-size:12.5px;min-width:0}.b{display:inline-block;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:600;color:#fff}.b.ok{background:var(--ok)}.b.bad{background:var(--bad)}.b.mid{background:var(--mid)}pre{white-space:pre-wrap;font-size:11px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px;max-height:300px;overflow:auto}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:9;cursor:zoom-out}#lb img{max-width:96vw;max-height:92vh;object-fit:contain}#lb.on{display:flex}</style>
<h1>Reference + text vs reference + reference · the MCP, nine arms</h1><p class="mut">Left: the arm. Middle: what the MCP was given (pictures as thumbnails, texts as grey boxes), the calls it made with the model and input count on each arrow, the output framed in blue. Right: a VLM check of the output against the REAL picture of every element, present / likeness, so text arms are judged on the same scale as reference arms. Click any image to zoom.</p>
${["R1", "R2", "R3"].map((g) => `<h2>${{ R1: "Scene 1 · Vanderbilt in the classroom", R2: "Scene 2 · the Bugatti Tourbillon at the Golden Gate", R3: "Scene 3 · Mark Twain and the carved pot overlooking Moraine Lake" }[g]}</h2>` + rows.filter((x) => x.id.startsWith(g)).map((x) => {
  const el = ELEMENTS[g], textEls = Object.entries(el).filter(([, f]) => !x.refsGiven.includes(f)).map(([n]) => n);
  const ins = `<div class="ins">${x.refsGiven.map((f) => fig(relative(od, join(FIX, f)), f.replace("rt3-", "").replace(".jpg", "") + " (picture)")).join("")}${textEls.map((n) => `<div class="txt">${esc(n)} as TEXT<br>${esc(x.text.slice(x.text.indexOf(":") + 1, x.text.indexOf(":") + 160))}…</div>`).join("")}</div>`;
  const pipe = x.calls.map((c, i) => `<div class="arrow">${esc(c.name.replace(/_/g, " "))}<br>${esc(c.model)} · ${c.inputs} in${c.err ? " · error" : ""}</div>${i < x.calls.length - 1 && x.assets[i] ? fig(x.assets[i], `output ${i + 1} (becomes input)`, "mid") : ""}`).join("");
  const out = x.assets.length ? fig(x.assets.at(-1), "output", "out") : `<div class="txt">no output</div>`;
  const chk = x.check ? `${x.check.elements.map((e) => `${esc(e.name)} ${b(e.present)}/${b(e.likeness)} <span class="mut">${esc(e.evidence)}</span>`).join("<br>")}<br>coherent ${b(x.check.coherent)} · extras: ${esc(x.check.extras)}` : "<span class=mut>no output to check</span>";
  return `<div class="row"><div><b>${esc(x.title)}</b><br><span class="mut">${x.spent} credits · ${x.seconds} s</span></div><div class="pipe">${ins}${pipe}${out}</div><div class="checks">${chk}<details><summary>request text</summary><pre>${esc(x.text)}</pre></details><details><summary>the MCP's prompt${x.calls.length > 1 ? "s" : ""}</summary>${x.calls.map((c) => `<pre>[${esc(c.name)} · ${esc(c.model)}]\n${esc(c.prompt)}</pre>`).join("")}</details></div></div>`; }).join("")).join("")}
<div id="lb"><img></div><script>const lb=document.getElementById('lb'),li=lb.querySelector('img');document.querySelectorAll('img[data-zoom]').forEach(i=>i.addEventListener('click',()=>{li.src=i.src;lb.classList.add('on')}));lb.addEventListener('click',()=>lb.classList.remove('on'));document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('on')});</script>`;
writeFileSync(join(OUT, "index.html"), html); console.log(`wrote ${join(OUT, "index.html")}`);
