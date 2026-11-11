// A page for one autonomous MCP run: every turn, what the chat model said, every call with its arguments (prompts in full) and
// result, and every file it produced, playable. Usage: node V3/compose/mcp-run-page.mjs <results/mcp-x/ID.json> <out.html>
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { V2 } from "../../V2/backend/lib/env.js";
const [recPath, outPath] = process.argv.slice(2).map((p) => resolve(p)), r = JSON.parse(readFileSync(recPath, "utf8")), od = dirname(outPath);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = (v) => JSON.stringify(v, (k, x) => (typeof x === "string" && /X-Goog-Signature|^https?:\/\/videos\.magichour/.test(x) ? x.replace(/\?.*$/, "").replace(/^.*\//, "…/") : x), 1);
const sess = join(V2, r.sessionDir), assets = existsSync(join(sess, "assets")) ? readdirSync(join(sess, "assets")).sort() : [];
let n = 0;
const turns = r.turns.map((t, i) => `<h2>Turn ${i + 1}</h2><p><b>User:</b> ${esc(t.text)}${t.materials?.length ? ` <span class="mut">(attached: ${esc(t.materials.join(", "))})</span>` : ""}</p>
${(t.dialog || []).map((d) => `<p class="mut"><b>${esc(d.role || d.who || "")}:</b> ${esc(d.text || d.content || JSON.stringify(d))}</p>`).join("")}
<ol class="calls">${t.calls.map((c) => { n++; const a = typeof c.arguments === "string" ? (() => { try { return JSON.parse(c.arguments); } catch { return c.arguments; } })() : c.arguments; const prompt = a?.style?.prompt; const rest = a && typeof a === "object" ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== "style")) : a;
  return `<li><b>${esc(c.name)}</b>${c.error ? ` <span class="bad">error</span>` : ""}<details><summary>arguments${prompt ? ` · prompt ${prompt.length} chars` : ""}</summary>${prompt ? `<pre class="p">${esc(prompt)}</pre>` : ""}<pre>${esc(strip(rest))}</pre></details>${c.output ? `<details><summary>result</summary><pre>${esc(typeof c.output === "string" ? c.output.replace(/\?X-Goog[^"'\s]*/g, "") : strip(c.output))}</pre></details>` : ""}${c.error ? `<pre class="bad">${esc(typeof c.error === "string" ? c.error : JSON.stringify(c.error)).slice(0, 600)}</pre>` : ""}</li>`; }).join("")}</ol>
${t.denied?.length ? `<p class="bad">refused by the free-plan gate: ${esc(JSON.stringify(t.denied)).slice(0, 400)}</p>` : ""}
<p><b>Assistant:</b></p><pre>${esc((t.agent || "").replace(/\?X-Goog[^)\s]*/g, ""))}</pre>`).join("");
const files = assets.map((f) => `<figure>${/\.mp4$/.test(f) ? `<video controls preload="metadata" src="${esc(relative(od, join(sess, "assets", f)))}"></video>` : `<img src="${esc(relative(od, join(sess, "assets", f)))}">`}<figcaption>${esc(f)}</figcaption></figure>`).join("");
const FIX = join(V2, "bench/v1/fixtures");
const refs = (r.turns[0].materials || []).map((m) => `<figure><img src="${esc(relative(od, join(FIX, m)))}"><figcaption>${esc(m)}</figcaption></figure>`).join("");
const html = `<!doctype html><meta charset="utf-8"><title>MCP run · ${esc(r.id)}</title>
<style>:root{--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#e4ded3;--card:#fff;--bad:#b3261e}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--bad:#f0756c;color-scheme:dark}}:root[data-theme=dark]{--bg:#15130f;--fg:#ece7de;--mut:#a39c90;--line:#2d2922;--card:#1d1a15;--bad:#f0756c;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14.5px/1.5 -apple-system,Inter,system-ui,sans-serif;margin:0;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1100px;margin-inline:auto}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;border-top:1px solid var(--line);padding-top:10px}.mut{color:var(--mut)}.bad{color:var(--bad)}
pre{white-space:pre-wrap;font-size:12px;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px;max-height:420px;overflow:auto}pre.p{font-size:13px}
.files{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}figure{margin:0}video,figure img{width:100%;border-radius:8px;background:#000}figcaption{font-size:12px;color:var(--mut)}ol.calls li{margin:6px 0}</style>
<h1>MCP run · ${esc(r.id)} · ${esc(r.item?.title || "")}</h1>
<p class="mut">${esc(r.started || "")} · ${r.spent ?? "?"} credits · ${r.seconds ?? "?"} s end to end · ${n} calls · ${assets.length} file(s) produced · ${esc(r.sessionDir)}</p>
${refs ? `<h2>What it was given</h2><p class="mut">attached to the message as uploaded files; the model saw each picture and its file name</p><div class="files">${refs}</div>` : ""}
<h2>What it produced</h2><div class="files">${files || "<p class=mut>nothing</p>"}</div>
${turns}`;
writeFileSync(outPath, html); console.log(`wrote ${outPath}`);
