// Builds magic-hour-tools.html: every Magic Hour tool with its input and output types.
// Usage: node current/research/build-tools-page.mjs
// Sources: ../tests/fixtures/magic-hour-tools.json (catalog), sources/magic-hour-openapi.json (preset lists).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(DIR, "..", "tests", "fixtures", "magic-hour-tools.json"), "utf8"));
const openapi = JSON.parse(readFileSync(join(DIR, "sources", "magic-hour-openapi.json"), "utf8"));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Preset lists: every enum with more than 8 values on a POST endpoint, except model lists.
const presets = {};
for (const [path, ops] of Object.entries(openapi.paths || {})) {
  const schema = ops.post?.requestBody?.content?.["application/json"]?.schema;
  if (!schema) continue;
  const found = [];
  const walk = (node, name) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.enum) && node.enum.length > 8 && !/(^|\.)model$/.test(name)) found.push({ param: name, values: node.enum });
    for (const [k, v] of Object.entries(node.properties || {})) walk(v, name ? `${name}.${k}` : k);
    if (node.items) walk(node.items, `${name}[]`);
  };
  walk(schema, "");
  if (found.length) presets[`POST ${path}`] = found;
}

// Media types: what flows between tools. Everything else is a setting.
const MEDIA = ["image", "video", "audio", "text"];
function mediaOf(input) {
  const t = input.type.toLowerCase();
  if (t.includes("image") && t.includes("video")) return ["image", "video"];
  if (input.name.includes("youtube_url")) return ["video"];
  if (t.startsWith("image") || t.includes("face") || t.includes("file_path")) return ["image"];
  if (t === "video") return ["video"];
  if (t === "audio") return ["audio"];
  if (t.includes("text")) return ["text"];
  return [];
}
function outputMedia(t) {
  const o = t.output.type.toLowerCase();
  if (o.startsWith("image")) return "image";
  if (o.startsWith("video") || o.startsWith("animation")) return "video";
  if (o.startsWith("audio")) return "audio";
  return "data";
}

const tools = catalog.tools.map((t) => {
  const media = {};
  for (const i of t.inputs) for (const m of mediaOf(i)) media[m] = media[m] === "required" || i.required ? "required" : "optional";
  // "video_source" (file or YouTube) is required even though each source field is optional.
  if (t.inputs.some((i) => i.required && /video_source/.test(i.name))) media.video = "required";
  const settings = t.inputs.filter((i) => mediaOf(i).length === 0);
  return { ...t, media, settings, out: outputMedia(t), presets: presets[t.endpoint] || [] };
});
const effective = tools.reduce((n, t) => n + Math.max(1, ...t.presets.filter((p) => /tool|art_style|camera_effect|template/.test(p.param)).map((p) => p.values.length)), 0);

const mark = (v) => (v === "required" ? "●" : v === "optional" ? "○" : "");
const OUT_LABEL = { video: "Video", image: "Image", audio: "Audio", data: "Utility (data)" };

const matrix = `
<table class="matrix">
  <thead><tr><th>Tool</th>${MEDIA.map((m) => `<th>${m[0].toUpperCase() + m.slice(1)}</th>`).join("")}<th></th><th>Output</th><th>Kind</th></tr></thead>
  <tbody>${["video", "image", "audio", "data"].map((o) => tools.filter((t) => t.out === o).map((t) => `
    <tr><td><a href="#${t.name.replace(/\W+/g, "-")}">${esc(t.name)}</a></td>${MEDIA.map((m) => `<td class="c">${mark(t.media[m])}</td>`).join("")}<td class="c">→</td><td>${esc(t.output.type)}</td><td>${t.category === "generative" ? "generative" : "deterministic"}</td></tr>`).join("")).join("")}
  </tbody>
</table>`;

const byType = (dir) => MEDIA.map((m) => {
  const list = tools.filter((t) => t.media[m]);
  return `<tr><td>${m}</td><td>${list.length}</td><td>${list.map((t) => esc(t.name) + (t.media[m] === "required" ? "" : " (opt.)")).join(", ")}</td></tr>`;
}).join("");
const outTable = ["video", "image", "audio", "data"].map((o) => {
  const list = tools.filter((t) => t.out === o);
  return `<tr><td>${OUT_LABEL[o]}</td><td>${list.length}</td><td>${list.map((t) => esc(t.name)).join(", ")}</td></tr>`;
}).join("");

const card = (t) => `
<details id="${t.name.replace(/\W+/g, "-")}">
  <summary><strong>${esc(t.name)}</strong> <span class="sig">${MEDIA.filter((m) => t.media[m]).map((m) => (t.media[m] === "required" ? m : `${m}?`)).join(" + ") || "settings only"} → ${esc(t.output.type)}</span></summary>
  <p>${esc(t.purpose)} <span class="soft">${esc(t.endpoint)} · ${esc(t.category)}</span></p>
  <table><thead><tr><th>Input</th><th>Type</th><th>Req.</th><th>Constraints</th></tr></thead><tbody>
    ${t.inputs.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${i.required ? "yes" : ""}</td><td>${esc(i.constraints)}</td></tr>`).join("")}
  </tbody></table>
  <p><strong>Output:</strong> ${esc(t.output.type)}${t.output.format ? ` — ${esc(t.output.format)}` : ""}</p>
  <p><strong>Keeps:</strong> ${t.maintains.map((m) => `${esc(m.property)}${m.basis === "inferred" ? " <span class=\"soft\">(inferred)</span>" : ""}`).join("; ") || "—"}</p>
  <p><strong>Changes:</strong> ${t.mutates.map((m) => `${esc(m.property)}${m.basis === "inferred" ? " <span class=\"soft\">(inferred)</span>" : ""}`).join("; ") || "—"}</p>
  ${t.models?.length ? `<p><strong>Models:</strong> ${t.models.map(esc).join(", ")}</p>` : ""}
  ${t.presets.map((p) => `<details class="inner"><summary>${esc(p.param)} — ${p.values.length} presets</summary><p class="list">${p.values.map(esc).join(" · ")}</p></details>`).join("")}
  <p><strong>Cost:</strong> ${esc(t.cost)}</p>
  ${t.failure_modes?.length ? `<p><strong>Known limits:</strong> ${t.failure_modes.map(esc).join("; ")}</p>` : ""}
  <p class="soft"><a href="${esc(t.source_url)}">Source</a></p>
</details>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Magic Hour Tool Offering</title>
<style>
:root { --bg:#f6f0e4; --ink:#3b2a1e; --soft:#7a5c44; --line:#d9cbb4; --card:#fbf7ef; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 Georgia, "Times New Roman", serif; }
main { max-width:1100px; margin:0 auto; padding:48px 16px 96px; }
h1 { font-weight:normal; font-size:34px; margin:0 0 8px; }
h2 { font-weight:normal; font-size:24px; margin:48px 0 12px; border-top:1px solid var(--line); padding-top:24px; }
.soft, .lede { color:var(--soft); }
a { color:var(--ink); }
table { border-collapse:collapse; width:100%; font-size:14px; margin:8px 0; }
th, td { border-bottom:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; }
th { font-weight:normal; color:var(--soft); }
.matrix td.c { text-align:center; width:56px; }
.tw { overflow-x:auto; }
details { background:var(--card); border:1px solid var(--line); padding:10px 16px; margin:8px 0; }
details.inner { background:transparent; border:0; border-top:1px solid var(--line); padding:6px 0; margin:6px 0; }
summary { cursor:pointer; }
.sig { color:var(--soft); font-size:14px; margin-left:8px; }
.list { font-size:13px; }
ul { padding-left:20px; }
</style></head>
<body><main>
<h1>Magic Hour Tool Offering</h1>
<p class="lede">${tools.length} endpoints (${tools.filter((t) => t.category === "generative").length} generative, ${tools.filter((t) => t.category !== "generative").length} deterministic). With presets as separate tools, about ${effective} effective tools. Source: Magic Hour OpenAPI spec and docs, accessed ${esc(catalog.accessed)}.</p>

<h2>Inputs and outputs</h2>
<p class="soft">● required · ○ optional. Text means a prompt or script. Settings (enums, numbers, booleans) are not shown here.</p>
<div class="tw">${matrix}</div>

<h2>By input type</h2>
<div class="tw"><table><thead><tr><th>Input</th><th>Tools</th><th>Which</th></tr></thead><tbody>${byType()}</tbody></table></div>

<h2>By output type</h2>
<div class="tw"><table><thead><tr><th>Output</th><th>Tools</th><th>Which</th></tr></thead><tbody>${outTable}</tbody></table></div>

<h2>Not in the public API</h2>
<ul>
  <li>In the web app only (names appear in the API's project types): voice changer, video upscaler, video colorizer, image expander, music and sound effects.</li>
  <li>Not offered by Magic Hour: compositing (fade, move, scale, text and logo overlay, transitions) and timeline operations (trim, crop, reformat, stitch, audio mix).</li>
</ul>

<h2>Tools</h2>
${["video", "image", "audio", "data"].map((o) => `<h3 class="soft">${OUT_LABEL[o]} output</h3>${tools.filter((t) => t.out === o).map(card).join("")}`).join("")}
</main></body></html>
`;
writeFileSync(join(DIR, "magic-hour-tools.html"), html);
console.log(`Wrote magic-hour-tools.html: ${tools.length} tools, ${Object.keys(presets).length} endpoints with presets, ~${effective} effective tools`);
