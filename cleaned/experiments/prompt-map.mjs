// Prompt map: every LLM instruction template extracted from the source (by the call's name), plus the exact prompts that were
// sent for paid image and video jobs in a run (recorded in run.json). Writes docs/prompts/index.html with a diagram and one
// expandable card per stage. Usage: node cleaned/experiments/prompt-map.mjs custom-bakery1
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, RUNS } from "../src/env.js";

// Scan a template literal starting at its opening backtick; handle ${ … } with nested templates. Returns the raw text.
function template(src, open) {
  let i = open + 1; const stack = ["tpl"];
  while (i < src.length && stack.length) {
    const c = src[i], mode = stack.at(-1);
    if (mode === "tpl") { if (c === "\\") i++; else if (c === "`") stack.pop(); else if (c === "$" && src[i + 1] === "{") { stack.push("expr"); i++; } }
    else if (mode === "expr") { if (c === "`") stack.push("tpl"); else if (c === "{") stack.push("brace"); else if (c === "}") stack.pop(); else if (c === '"' || c === "'") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } } }
    else if (mode === "brace") { if (c === "{") stack.push("brace"); else if (c === "}") stack.pop(); }
    i++;
  }
  return src.slice(open + 1, i - 1);
}
// Every `jsonCall({ name: "x" … prompt: `…` })` and every `name: "x"` whose prompt is passed via a variable (storyboard, grid).
function extract(file) {
  const src = readFileSync(file, "utf8"), out = [];
  for (const m of src.matchAll(/name: "([\w-]+)"/g)) {
    const from = m.index, seg = src.slice(from, from + 6000), p = seg.indexOf("prompt:");
    if (p < 0) continue;
    const after = seg.slice(p + 7).trimStart();
    if (after.startsWith("`")) out.push({ name: m[1], file: file.split("/").slice(-2).join("/"), text: template(seg, p + 7 + (seg.slice(p + 7).length - after.length)) });
    else out.push({ name: m[1], file: file.split("/").slice(-2).join("/"), text: `(prompt built by ${after.split(/[\s,})]/)[0]})` });
  }
  return out;
}
// A prompt builder: `function f(…) { … return \`…\` }` or `const f = (…) => \`…\``; the template is the first backtick after its
// return (function form) or after its arrow (arrow form).
const exportedTemplates = (file, fn) => { const src = readFileSync(file, "utf8"); let i = src.indexOf(`function ${fn}(`); if (i >= 0) return template(src, src.indexOf("`", src.indexOf("return", i))); i = src.indexOf(`${fn} = (`); if (i < 0) return null; return template(src, src.indexOf("`", src.indexOf("=>", i))); };

const name = process.argv[2] || "custom-bakery1", run = JSON.parse(readFileSync(join(RUNS, name, "run.json"), "utf8"));
const srcDir = join(ROOT, "src"), all = readdirSync(srcDir).filter((f) => f.endsWith(".js")).flatMap((f) => extract(join(srcDir, f)));
const T = Object.fromEntries(all.map((t) => [t.name, t]));
const builders = { storyboard: exportedTemplates(join(srcDir, "storyboard.js"), "storyboardPrompt"), grid: exportedTemplates(join(srcDir, "grid.js"), "gridPrompt"), plate: exportedTemplates(join(srcDir, "seed.js"), "platePrompt"), sheet: exportedTemplates(join(srcDir, "assets.js"), "sheetPrompt") };
const jobs = run.jobs || {}, J = (re) => Object.entries(jobs).find(([k]) => re.test(k))?.[1]?.prompt || null;
const video = JSON.parse(readFileSync(join(RUNS, name, "run.json"), "utf8")).video?.[3]?.clips?.[0]?.prompt || null;

const stages = [
  { id: "S1", title: "Story", kind: "LLM", model: "gpt-6.1-sol, high", tpl: T.story?.text, note: "The creative director: title, style line, prose." },
  { id: "E1", title: "Editor review", kind: "LLM", model: "gpt-6.1-sol, high", tpl: T["edit-review"]?.text, note: "Logic holes only; minimal edits." },
  { id: "I1", title: "ID tagging (per chunk)", kind: "LLM", model: "gpt-6.1-sol, medium", tpl: T["ids-tag"]?.text, note: "Every mention → one id, in context, carrying the table so far." },
  { id: "I2", title: "ID coverage (leftovers only)", kind: "LLM after a parser", model: "gpt-6.1-sol, low", tpl: T["ids-coverage"]?.text, note: "A text parser lists untagged nouns first; the model decides which refer to things." },
  { id: "I3", title: "ID classify", kind: "LLM", model: "gpt-6.1-sol, medium", tpl: T["ids-classify"]?.text, note: "asset / fixture / place / part / none; inside-of." },
  { id: "I4", title: "ID merge", kind: "LLM", model: "gpt-6.1-sol, low", tpl: T["ids-merge"]?.text, note: "Two ids for one thing or place." },
  { id: "I5", title: "Links: propose, then check", kind: "LLM ×2", model: "gpt-6.1-sol", tpl: [T["ids-link-propose"]?.text, T["ids-link-check"]?.text].join("\n\n— then, per pair —\n\n"), note: "Physical connections (a door seen inside and out)." },
  { id: "A1", title: "Environment specs (layout)", kind: "LLM", model: "gpt-6.1-sol, high", tpl: T["seed-plan"]?.text, note: "Marks, essentials, door swing, per place." },
  { id: "A2", title: "Asset specs", kind: "LLM", model: "gpt-6.1-sol, high", tpl: T["asset-spec"]?.text, note: "Each tracked asset described against the set." },
  { id: "A3", title: "Style → medium", kind: "LLM", model: "gpt-6.1-sol, low", tpl: T["style-medium"]?.text, note: "The style line reduced to the medium for edits." },
  { id: "P1", title: "Screenplay", kind: "LLM", model: "gpt-6.1-sol, high", tpl: T.screenplay?.text, note: "Scenes of visual action lines and dialogue." },
  { id: "P2", title: "Sound notes", kind: "LLM", model: "gpt-6.1-sol, medium", tpl: T["screenplay-sound"]?.text, note: "Ambience, music, effects; text unchanged." },
  { id: "B1", title: "Storyboard (per scene, parallel)", kind: "LLM", model: "gpt-6.1-sol, medium", tpl: builders.storyboard, note: "Panels = keyframes: action, elements, enters, changes, leaves, introductions." },
  { id: "G1", title: "Sheet (image)", kind: "IMAGE", model: "nano-banana-pro, 2k", tpl: builders.sheet, sent: J(/^root-baker$/), note: "One subject on a plain backdrop." },
  { id: "G2", title: "Sheet check / set check", kind: "VISION", model: "gpt-6.1-sol", tpl: [T["asset-check"]?.text, T["asset-set"]?.text].join("\n\n— set check —\n\n"), note: "Single subject, backdrop, spec; then style and scale across the set." },
  { id: "G3", title: "Plate (image)", kind: "IMAGE", model: "nano-banana-pro, 2k", tpl: builders.plate, sent: J(/^root-shop$/), note: "The empty place from its layout." },
  { id: "G4", title: "Plate check", kind: "VISION", model: "gpt-6.1-sol", tpl: T["seed-observe"]?.text, note: "One question per key mark; door swing; quality." },
  { id: "G5", title: "Scene grid (image)", kind: "IMAGE", model: "nano-banana-pro, 4k", tpl: builders.grid, sent: J(/^grid-s3$/), note: "All of a scene's panels as cells of one image." },
  { id: "G6", title: "Grid checks", kind: "VISION", model: "gpt-6.1-sol", tpl: [T["grid-check"]?.text, T["grid-room-check"]?.text, T["cell-occupied"]?.text].join("\n\n—\n\n"), note: "Layout drawn; same room and camera per cell; occupied cells." },
  { id: "G7", title: "Cell check", kind: "VISION", model: "gpt-6.1-sol, low", tpl: readFileSync(join(ROOT, "scenes.mjs"), "utf8").match(/prompt: `One frame of a story[^`]*`/)?.[0]?.slice(8), note: "Counts per tracked element; impossible?" },
  { id: "V1", title: "Clip (video)", kind: "VIDEO", model: "wan-3.0, 720p, audio on", tpl: readFileSync(join(ROOT, "scene-video.mjs"), "utf8").match(/const prompt = `[^`]*`/)?.[0]?.slice(15), sent: video, note: "Start frame → end frame, 5 s, sound from the screenplay." },
];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const card = (s) => `<section class="card" id="${s.id}"><div class="h"><span class="id">${s.id}</span><h3>${esc(s.title)}</h3><span class="chip k-${s.kind.split(" ")[0]}">${esc(s.kind)}</span><span class="mini">${esc(s.model)}</span></div><p class="mini">${esc(s.note)}</p>
<details open><summary>Instruction template (from the source; <code>\${…}</code> are filled in by code)</summary><pre>${esc(s.tpl || "(not found)")}</pre></details>
${s.sent ? `<details><summary>Exactly as sent in run ${esc(name)}</summary><pre>${esc(s.sent)}</pre></details>` : ""}</section>`;
const html = `<title>Pipeline Prompts</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f4f5f2;--panel:#fff;--fg:#1c211e;--mut:#5f6863;--line:#dbe0dc;--accent:#2d6a4f;--llm:#8a4b00;--llm-bg:#fbecd6;--img:#6b3fa0;--img-bg:#ece3f7;--vis:#1f5f6b;--vis-bg:#dcecef;--mono:ui-monospace,Menlo,monospace}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e;--accent:#7cc9a3;--llm:#f0b45c;--llm-bg:#3a2c14;--img:#c7a6f0;--img-bg:#2c2140;--vis:#7cc3cf;--vis-bg:#17303a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#111412;--panel:#191d1a;--fg:#e5eae6;--mut:#98a29c;--line:#2b322e;--accent:#7cc9a3;--llm:#f0b45c;--llm-bg:#3a2c14;--img:#c7a6f0;--img-bg:#2c2140;--vis:#7cc3cf;--vis-bg:#17303a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding-block:22px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:14px}
h1{font-size:22px;margin:0}h3{font-size:15px;margin:0}.mini{color:var(--mut);font-size:12.5px;margin:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:8px;min-width:0;scroll-margin-top:12px}
.h{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.id{font:600 12px var(--mono);color:var(--accent)}
.chip{font:600 11px var(--mono);padding:2px 8px;border-radius:999px}.k-LLM{color:var(--llm);background:var(--llm-bg)}.k-IMAGE,.k-VIDEO{color:var(--img);background:var(--img-bg)}.k-VISION{color:var(--vis);background:var(--vis-bg)}
pre{white-space:pre-wrap;font:11.5px/1.5 var(--mono);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px;margin:0;max-height:420px;overflow:auto}
details summary{cursor:pointer;font-size:12.5px;color:var(--mut)}.chart{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px}
</style>
<main>
<header><h1>Pipeline prompts, stage by stage</h1><p class="mini">Each box in the diagram is one card below (click a box's id). Templates are extracted from the code; "exactly as sent" is the recorded prompt of a paid job in run ${esc(name)}.</p></header>
<div class="chart"><pre class="mermaid">
flowchart TD
  P([prompt]) --> S1[S1 Story] --> E1[E1 Editor review] --> I1[I1 ID tagging] --> I2[I2 ID coverage] --> I3[I3 ID classify] --> I4[I4 ID merge] --> I5[I5 Links]
  I5 --> A1[A1 Environment specs] & A2[A2 Asset specs] & A3[A3 Style to medium]
  E1 --> P1[P1 Screenplay] --> P2[P2 Sound notes]
  A1 --> B1[B1 Storyboard per scene]
  P2 --> B1
  B1 --> SM{{State manager: code, no prompt}}
  A2 --> G1[G1 Sheet image] --> G2[G2 Sheet checks]
  A1 --> G3[G3 Plate image] --> G4[G4 Plate check]
  SM --> G5[G5 Scene grid image]
  G2 --> G5
  G4 --> G5
  G5 --> G6[G6 Grid checks] --> G7[G7 Cell check] --> V1[V1 Clip video]
  click S1 "#S1"
  click E1 "#E1"
  click I1 "#I1"
  click I2 "#I2"
  click I3 "#I3"
  click I4 "#I4"
  click I5 "#I5"
  click A1 "#A1"
  click A2 "#A2"
  click A3 "#A3"
  click P1 "#P1"
  click P2 "#P2"
  click B1 "#B1"
  click G1 "#G1"
  click G2 "#G2"
  click G3 "#G3"
  click G4 "#G4"
  click G5 "#G5"
  click G6 "#G6"
  click G7 "#G7"
  click V1 "#V1"
</pre></div>
${stages.map(card).join("\n")}
</main>`;
mkdirSync(join(ROOT, "docs", "prompts"), { recursive: true });
writeFileSync(join(ROOT, "docs", "prompts", "index.html"), html);
console.log(`${stages.length} stages · templates found: ${stages.filter((s) => s.tpl).length} · sent examples: ${stages.filter((s) => s.sent).length}`);
