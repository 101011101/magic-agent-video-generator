// Builds comparison pages from outputs/<model>/<request>/<step>.md
// Usage: node docs/PRD/test-research/build-html.mjs [--focus | --compare-gpt]
//   (none)         results.html           all approaches, both models
//   --focus        story-to-changes.html  story + change-based chunks, both models
//   --compare-gpt  gpt-chunk-compare.html GPT story, then original vs change-based chunks
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const requests = JSON.parse(readFileSync(join(DIR, "requests.json"), "utf8"));

const MODELS = [
  { dir: "gpt", label: "GPT-6.1 Sol", note: "OpenAI API, effort high" },
  { dir: "claude", label: "Claude Opus 5.5", note: "Claude Code subagent" },
];
const ALL_VARIANTS = [
  { name: "One-shot script", steps: [["v1", null]] },
  { name: "Structured prompt, then script", steps: [["v2a", "Step 1 · Structured prompt"], ["v2b", "Step 2 · Script"]] },
  { name: "Story first, then operational chunks", steps: [["v3a", "Step 1 · Story"], ["v3b", "Step 2 · Operational chunks"]] },
  { name: "Director's shooting script", steps: [["v4", null]] },
  { name: "Story, then change-based chunks", steps: [["v5b", "Step 2 · Change-based chunks (step 1 is the story from approach 3)"]] },
];

const MODE = process.argv.includes("--focus") ? "focus" : process.argv.includes("--compare-gpt") ? "compare" : "all";
const PAGE = {
  all: { out: "results.html", title: "Creative Director Samples", lede: "Six requests, five approaches, two models." },
  focus: { out: "story-to-changes.html", title: "Story to Operational Changes", lede: "Story, then change-based operational chunks. Six requests, two models." },
  compare: { out: "gpt-chunk-compare.html", title: "Original vs Change-Based Chunks", lede: "GPT-6.1 Sol (OpenAI API, effort high). The same story, chunked by the original operational prompt and by the change-based prompt." },
}[MODE];

const NOTES = {
  "claude/p4-lighthouse/v5b": "Edited by the agent after its first draft: durations totalled about 130 s and were rescaled to 120 s.",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");

function md(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const out = [];
  let para = [];
  let list = null; // "ul" | "ol"
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flushPara(); closeList(); continue; }
    if (/^```/.test(t)) {
      flushPara(); closeList();
      const buf = [];
      while (++i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i]);
      out.push(`<pre>${esc(buf.join("\n"))}</pre>`);
      continue;
    }
    if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      flushPara(); closeList();
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const head = cells(t);
      i++;
      const rows = [];
      while (i + 1 < lines.length && /^\|.*\|$/.test(lines[i + 1].trim())) rows.push(cells(lines[++i]));
      out.push(`<div class="tw"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); out.push(`<h${Math.min(h[1].length + 3, 6)}>${inline(h[2])}</h${Math.min(h[1].length + 3, 6)}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); out.push("<hr>"); continue; }
    const ul = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      const indent = (ul || ol)[1].length;
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li${indent >= 2 ? ' class="sub"' : ""}>${inline((ul || ol)[2])}</li>`);
      continue;
    }
    if (/^>\s?/.test(t)) { flushPara(); closeList(); out.push(`<blockquote>${inline(t.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    closeList();
    para.push(t);
  }
  flushPara(); closeList();
  return out.join("\n");
}

const read = (model, id, step) => {
  const f = join(DIR, "outputs", model, id, `${step}.md`);
  return existsSync(f) ? md(readFileSync(f, "utf8")) : `<p class="pending">Not generated yet.</p>`;
};

const block = (dir, id, step, label) =>
  `${label ? `<p class="step">${label}</p>` : ""}${NOTES[`${dir}/${id}/${step}`] ? `<p class="step">Note: ${NOTES[`${dir}/${id}/${step}`]}</p>` : ""}<div class="out">${read(dir, id, step)}</div>`;

const header = (r) => `
  <h2>${esc(r.title)}</h2>
  <p class="req">“${esc(r.request)}”</p>
  ${r.uploads && r.uploads !== "None." ? `<p class="up">Upload: ${esc(r.uploads)}</p>` : ""}`;

const modelColumns = (r, variants, showHeadings) => variants.map((v, vi) => `
  ${showHeadings ? `<h3>${vi + 1}. ${v.name}</h3>` : ""}
  <div class="cols">
    ${MODELS.map((m) => `
    <div class="col">
      <p class="who">${m.label}</p>
      ${v.steps.map(([step, label]) => block(m.dir, r.id, step, label)).join("")}
    </div>`).join("")}
  </div>`).join("");

const compareColumns = (r) => `
  <p class="who">Story</p>
  ${block("gpt", r.id, "v3a", null)}
  <div class="cols">
    <div class="col"><p class="who">Original operational chunks</p>${block("gpt", r.id, "v3b", null)}</div>
    <div class="col"><p class="who">Change-based operational chunks</p>${block("gpt", r.id, "v5b", null)}</div>
  </div>`;

const sections = requests.map((r) => `
<section id="${r.id}">${header(r)}
  ${MODE === "compare" ? compareColumns(r)
    : MODE === "focus" ? modelColumns(r, [{ steps: [["v3a", "Step 1 · Story"], ["v5b", "Step 2 · Change-based operational chunks"]] }], false)
    : modelColumns(r, ALL_VARIANTS, true)}
</section>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${PAGE.title}</title>
<style>
:root { --bg:#f6f0e4; --ink:#3b2a1e; --soft:#7a5c44; --line:#d9cbb4; --card:#fbf7ef; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 Georgia, "Times New Roman", serif; }
main { max-width:1280px; margin:0 auto; padding:48px 16px 96px; }
h1 { font-weight:normal; font-size:34px; margin:0 0 8px; }
.lede { color:var(--soft); margin:0 0 8px; }
nav { margin:16px 0 40px; color:var(--soft); }
nav a { color:var(--soft); margin-right:16px; }
section { border-top:1px solid var(--line); padding-top:32px; margin-top:48px; }
h2 { font-weight:normal; font-size:26px; margin:0; }
.req { font-style:italic; margin:6px 0; }
.up { color:var(--soft); font-size:14px; margin:0 0 8px; }
h3 { font-weight:normal; font-size:19px; margin:36px 0 12px; color:var(--soft); }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.col { min-width:0; }
.out + .cols { margin-top:24px; }
.who { font-variant:small-caps; letter-spacing:.06em; color:var(--soft); margin:0 0 6px; border-bottom:1px solid var(--line); }
.step { font-size:14px; color:var(--soft); margin:16px 0 4px; }
.out { background:var(--card); border:1px solid var(--line); padding:16px 20px; font-size:15px; overflow-wrap:anywhere; }
.out h4, .out h5, .out h6 { font-size:16px; margin:16px 0 4px; }
.out p { margin:8px 0; }
.out ul, .out ol { padding-left:20px; margin:6px 0; }
.out li.sub { margin-left:18px; }
.out code { font-size:13px; }
.out pre { white-space:pre-wrap; font-size:13px; }
.out hr { border:0; border-top:1px solid var(--line); }
.out blockquote { margin:8px 0; padding-left:12px; border-left:2px solid var(--line); color:var(--soft); }
.tw { overflow-x:auto; }
table { border-collapse:collapse; font-size:13px; margin:8px 0; }
th, td { border:1px solid var(--line); padding:4px 6px; vertical-align:top; text-align:left; }
.pending { color:var(--soft); font-style:italic; }
@media (max-width: 820px) { .cols { grid-template-columns:1fr; } }
</style>
</head>
<body>
<main>
<h1>${PAGE.title}</h1>
<p class="lede">${PAGE.lede}${MODE === "compare" ? "" : ` ${MODELS.map((m) => `${m.label} (${m.note})`).join(" · ")}.`}</p>
<nav>${requests.map((r) => `<a href="#${r.id}">${esc(r.title)}</a>`).join("")}</nav>
${sections}
</main>
</body>
</html>
`;
writeFileSync(join(DIR, PAGE.out), html);
console.log(`Wrote ${PAGE.out}`);
