// A page of N clips side by side for one sequence, ours and the MCP's, with scores. Usage:
// node V3/compose/quad.mjs --scores <dir with scores.json> --out <file.html> --title "…" [--v3 name=label …] [--mcp name=<record.json> …] [--ref name=<image> …]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { V3 } from "./paths.mjs";
import { V2 } from "../../V2/backend/lib/env.js";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const sdir = resolve(opt("--scores")), sc = JSON.parse(readFileSync(join(sdir, "scores.json"), "utf8")), out = resolve(opt("--out")), od = dirname(out), title = opt("--title", "comparison");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = (v) => `<span class="b ${v === "yes" ? "ok" : v === "partly" ? "mid" : "bad"}">${esc(v)}</span>`;
const kv = (p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; };
const cols = {};
for (const p of all("--v3")) { const [name, label] = kv(p), d = join(V3, "runs", label), r = JSON.parse(readFileSync(join(d, "compose.json"), "utf8")), best = r.attempts.find((a) => a.key === r.outputs?.chosen) || r.attempts.at(-1);
  cols[name] = { who: "V3", how: `${best.start_frame ? "image-to-video from the premade still" : "text-to-video"} · ${best.model} · ${r.attempts.length} attempt${r.attempts.length > 1 ? "s" : ""} · ${r.credits} credits`, prompt: best.prompt, transcript: best.transcript, page: relative(od, join(d, "index.html")) }; }
for (const p of all("--mcp")) { const [name, file] = kv(p), r = JSON.parse(readFileSync(resolve(file), "utf8")), t = r.turns[0], calls = t.calls.filter((c) => /^(edit_image|generate_image|create_video_from_text|create_video_from_image)$/.test(c.name)).map((c) => ({ name: c.name, a: typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments }));
  const v = calls.find((c) => /video/.test(c.name));
  cols[name] = { who: "MCP", how: `${calls.map((c) => c.name.replace(/_/g, " ")).join(" → ")} · ${v?.a.model} · audio ${v?.a.audio ? "on" : "off"} · ${r.spent} credits · ${r.seconds} s`, prompt: calls.map((c) => `[${c.name} · ${c.a.model}]\n${c.a.style?.prompt || ""}`).join("\n\n"), attached: t.materials || [], text: t.agent }; }
const refs = Object.fromEntries(all("--ref").map(kv));
const names = Object.keys(sc.clips);
const col = (n) => { const c = cols[n] || {}, s = sc.scores[n]; return `<div class="col"><h2>${esc(n)} <span class="score">${s?.score ?? "—"}</span></h2><p class="mut">${esc(c.who || "")} · ${esc(c.how || "")}</p>
${refs[n] ? `<p class="mut">reference given:</p><img class="ref" src="${esc(relative(od, resolve(refs[n])))}">` : c.attached?.length ? `<p class="mut">attached: ${esc(c.attached.join(", "))}</p>` : `<p class="mut">no reference</p>`}
<video controls preload="metadata" src="${esc(relative(od, sc.clips[n]))}"></video>
<div class="frames">${sc.frames[n].map((f, i) => `<figure><img src="${esc(relative(od, join(sdir, f)))}" loading="lazy"><figcaption>${2 * i + 1} s</figcaption></figure>`).join("")}</div>
<p>${esc(s?.summary || "")}</p><table>${(s?.must_haves || []).map((m) => `<tr><td>${badge(m.met)}</td><td class="mut">${esc(m.item.slice(0, 70))}… ${esc(m.why)}</td></tr>`).join("")}</table>
${c.transcript ? `<p class="mut">heard: ${c.transcript.map((g) => `[${g.from}–${g.to} s] ${esc(g.text)}`).join(" ")}</p>` : ""}
<details><summary>prompt${c.who === "MCP" ? "s it wrote" : " sent"}</summary><pre>${esc(c.prompt || "")}</pre></details>${c.page ? `<p><a href="${esc(c.page)}">full run page</a></p>` : ""}</div>`; };
const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--ok:#1d7a3d;--bad:#b3261e;--mid:#9a6b00;--card:#fff;--acc:#2f5d8a}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--bad:#f0756c;--mid:#e0b24a;--card:#1d1a15;--acc:#8ab4e8;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14.5px/1.5 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1700px;margin-inline:auto}
h1{font-size:21px;margin:0 0 6px}h2{font-size:16px;margin:0 0 4px}.score{float:right;color:var(--acc);font-size:22px}.mut{color:var(--mut);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;margin-top:12px}.col{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;min-width:0}
video{width:100%;border-radius:8px;background:#000}.ref{width:100%;border-radius:6px;border:1px solid var(--line)}.frames{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px}figure{margin:0}figure img{width:100%;border-radius:4px;border:1px solid var(--line)}figcaption{font-size:10.5px;color:var(--mut)}
.b{display:inline-block;padding:0 7px;border-radius:999px;font-size:11px;font-weight:600;color:#fff}.b.ok{background:var(--ok)}.b.bad{background:var(--bad)}.b.mid{background:var(--mid)}
table{border-collapse:collapse;width:100%;font-size:12.5px}td{border-bottom:1px solid var(--line);padding:3px 5px;vertical-align:top}pre{white-space:pre-wrap;font-size:11.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;max-height:360px;overflow:auto}
.verdict{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-top:10px}</style>
<h1>${esc(title)}</h1><p class="mut">${esc(JSON.parse(readFileSync(resolve(opt("--item")), "utf8")).turns[0].text)}</p>
${Object.keys(sc.pairs).length ? `<div class="verdict"><b>Pairwise</b>${Object.entries(sc.pairs).map(([k, p]) => `<br>${esc(k.replace(",", " vs "))}: <b>${esc(p.winner_side)}</b> (${esc(p.strength)}; ${esc(p.first)} shown first) · ${esc(p.why)}`).join("")}</div>` : ""}
<div class="grid">${names.map(col).join("")}</div>`;
writeFileSync(out, html); console.log(`wrote ${out}`);
