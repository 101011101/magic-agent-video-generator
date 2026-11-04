// Two runs of the same screenplay side by side: V2/results/compare-<a>-vs-<b>/index.html. One row per still (left run A,
// right run B, each with its gate verdict, attempt count and the model that made it), then the films if both exist, then
// the credits. Made for the model comparison (qwen against nano on the topgun5 screenplay); works for any two labels.
// Usage: node V2/backend/composer/compare.js <labelA> <labelB>
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RESULTS, RUNS } from "../lib/env.js";
import { normalizeShots } from "./screenplay/screenplay.js";

const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function load(label) {
  const dir = join(RUNS, label), L = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
  L.script = normalizeShots(L.script);
  const attempts = (id) => existsSync(join(dir, "stills")) ? readdirSync(join(dir, "stills")).filter((f) => (f.startsWith(`${id}.`) || f.startsWith(`${id}-`)) && f.endsWith(".png") && !/-crop\.png$|-text\.png$/.test(f)).length : 0;
  return { label, dir, L, K: L.build || {}, attempts, rel: (f) => `../../runs/${label}/${f}`, credits: (L.calls || []).reduce((n, c) => n + (c.credits || 0), 0) };
}

export function writeComparePage(a, b) {
  const A = load(a), B = load(b), out = join(RESULTS, `compare-${a}-vs-${b}`);
  mkdirSync(out, { recursive: true });
  const ids = [...new Set([...Object.keys(A.K.painted || {}), ...Object.keys(B.K.painted || {}), ...(A.K.plan || []).map((p) => p.id)])].sort((x, y) => { const [sx, nx] = x.slice(1).split("-").map(Number), [sy, ny] = y.slice(1).split("-").map(Number); return sx - sy || nx - ny; });
  const stillOf = (R, id) => R.L.stills?.[id] || null;
  const verdict = (R, id) => { const p = R.K.painted?.[id]; if (!p) return { cls: "mut", text: "not painted" }; if (p.card) return { cls: "ok", text: "title card" }; const c = p.check || {}, bad = []; if (c.ok === false) bad.push("people"); if (c.room?.ok === false) bad.push("room"); if (c.bars?.boxed) bad.push("bars"); if (c.style?.ok === false) bad.push("style"); if (c.load?.ok === false) bad.push("load"); if (c.geo?.ok === false) bad.push("geometry"); return p.bad ? { cls: "bad", text: `flagged: ${bad.join(", ")}` } : { cls: "ok", text: `pass${p.accepted ? " (accepted)" : ""}${p.cropped && !p.prompt ? " · crop" : ""}` }; };
  const cell = (R, id) => { const p = R.K.painted?.[id], v = verdict(R, id), n = R.attempts(id), model = R.L.models?.still || "?"; const note = p?.check ? [p.check.note, p.check.room?.ok === false ? `room: ${p.check.room.note}` : "", p.check.load?.ok === false ? `load: ${p.check.load.note}` : ""].filter(Boolean).join(" · ") : ""; return `<td><div class="meta"><span class="${v.cls}">${esc(v.text)}</span><span class="mut">${esc(model)}${n > 1 ? ` · ${n} attempts` : ""}</span></div>${p?.file ? `<img src="${R.rel(p.file)}" loading="lazy">` : `<div class="missing">not painted</div>`}${note ? `<div class="note">${esc(note)}</div>` : ""}</td>`; };
  const shotOf = (id) => { const s = stillOf(A, id) || stillOf(B, id); return s ? `${s.size || ""}${s.uses ? ` · ${s.uses.join(", ")}` : ""}` : ""; };
  const rows = ids.map((id) => `<tr><th><b>${esc(id)}</b><div class="mut">${esc(shotOf(id))}</div></th>${cell(A, id)}${cell(B, id)}</tr>`);
  const film = (R) => R.K.film && existsSync(join(R.dir, R.K.film)) ? `<video controls preload="metadata" src="${R.rel(R.K.film)}"></video>` : `<div class="missing">film not stitched</div>`;
  const head = (R) => `<th><div class="run">${esc(R.label)}</div><div class="mut">${esc(R.L.models ? `${R.L.models.still} @${R.L.models.res} · ${R.L.models.video} @${R.L.models.vres}` : "")}</div><div class="mut">${R.credits} credits · ${Object.values(R.K.painted || {}).filter((p) => p.file && !p.card).length} stills painted · ${Object.values(R.K.painted || {}).filter((p) => p.bad).length} flagged</div></th>`;
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(a)} vs ${esc(b)}</title><style>
body{margin:0;padding:28px 32px;background:#0b0b0b;color:#eaeaea;font:14px/1.5 -apple-system,system-ui,sans-serif}
h1{font:700 22px ui-monospace,monospace;margin:0 0 4px}.sub{color:#8a8a8a;font:12px ui-monospace,monospace;margin:0 0 22px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{vertical-align:top;padding:10px 8px;border-top:1px solid #222;text-align:left}
th:first-child{width:120px;font:12.5px ui-monospace,monospace;color:#bbb}th b{font-size:15px;color:#fff}.run{font:700 15px ui-monospace,monospace;color:#8ab4ff}
td img,td video{width:100%;border-radius:6px;display:block;background:#000}.meta{display:flex;justify-content:space-between;font:12px ui-monospace,monospace;margin:0 0 6px}
.mut{color:#777;font:11.5px ui-monospace,monospace}.ok{color:#7fd}.bad{color:#ff7a86}.note{font:11.5px ui-monospace,monospace;color:#aaa;margin-top:6px}
.missing{color:#666;font:12px ui-monospace,monospace;padding:46px;background:#000;border-radius:6px;text-align:center}
</style>
<h1>${esc(a)} vs ${esc(b)}</h1><p class="sub">${esc(A.L.story?.title || "")} · the same screenplay${A.L.script_from || B.L.script_from ? ` (from ${esc(A.L.script_from || B.L.script_from)})` : ""} on two model profiles · page written ${new Date().toISOString().slice(0, 16).replace("T", " ")}</p>
<table><tr><th>still</th>${head(A)}${head(B)}</tr>${rows.join("\n")}
<tr><th><b>film</b></th><td>${film(A)}</td><td>${film(B)}</td></tr></table>`;
  writeFileSync(join(out, "index.html"), html);
  return join(out, "index.html");
}

if (process.argv[1] && process.argv[1].endsWith("compare.js")) { const [a, b] = process.argv.slice(2); if (!a || !b) { console.error("usage: node V2/backend/composer/compare.js <labelA> <labelB>"); process.exit(2); } console.log(writeComparePage(a, b)); }
