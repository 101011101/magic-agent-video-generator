// One self-contained review page for a fact-film3 run: the shooting script, the still and clip prompts
// code assembled from it, the code checks, the plan and cost, and the review notes. Nothing is painted
// yet, so there are no pictures; every piece of text is copied verbatim from run.json and review-notes.md.
// Usage: node cleaned/experiments/script-page.mjs --label vanderbilt5 [--date 2026-10-29]
// Reads  runs/exp-<label>/run.json and, if present, runs/exp-<label>/review-notes.md.
// Writes runs/exp-<label>/page-review/index.html.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { RUNS, REPO } from "../src/env.js";

const { values: args } = parseArgs({ options: { label: { type: "string" }, date: { type: "string" }, kf: { type: "string" } } });
if (!args.label) { console.error("usage: node cleaned/experiments/script-page.mjs --label <label> [--kf kf1] [--date YYYY-MM-DD]"); process.exit(1); }
const KFID = args.kf || "";   // a KF variant: its plan comes from run.json kf[<id>].plan and the page goes under <label>/<id>/

const LABEL = args.label, DIR = join(RUNS, `exp-${LABEL}`), KDIR = KFID ? join(DIR, KFID) : DIR, OUT = join(KDIR, "page-review", "index.html");
const RUN = JSON.parse(readFileSync(join(DIR, "run.json"), "utf8"));
const NOTES = existsSync(join(DIR, "review-notes.md")) ? readFileSync(join(DIR, "review-notes.md"), "utf8") : null;
const DATE = args.date || localDate(statSync(join(DIR, "run.json")).mtime);
const STILL_CREDITS = 200, SECOND_CREDITS = 96; // Magic Hour: 200 per still, 96 per second on wan-3.0
const STATUS = "Script and assembled prompts only. Nothing painted, nothing committed.";
const SOURCES = ["shooting-script.txt", KFID ? `${KFID}/frames.txt` : "frames.txt", KFID ? `${KFID}/clips.txt` : "clips.txt", ...(KFID ? [`${KFID}/${KFID}.js`, `${KFID}/README.txt`] : []), "run.json", "review-notes.md"];
const IMAGE_KINDS = { plate: "the place's reference picture", env: "an earlier still of this run", portrait: "the character's bank portrait" };
const PERSON_COLS = ["id", "visible", "third", "depth", "facing", "distance", "pose", "hands"];
const PROP_COLS = ["id", "visible", "where", "condition"];

const { script, script_checks: checks, elements, features = {}, voices = {}, story } = RUN, plan = (KFID && RUN.kf?.[KFID]?.plan) || RUN.plan;
if (!plan) { console.error(`no plan in run.json${KFID ? ` for kf "${KFID}"` : ""}`); process.exit(1); }
const shots = script.scenes.flatMap((sc) => sc.shots);
const total = script.scenes.reduce((n, sc) => n + sc.seconds, 0);

// ---------- helpers ----------
function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const name = (id) => elements.find((e) => e.id === id)?.name ?? id;
const empty = (label = "empty") => `<span class="mut">(${label})</span>`;
const canon = (v) => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k2) => [k2, x[k2]])) : x);
const fmt = (n) => n.toLocaleString("en-US");
const shotLink = (text) => { const m = /shot (\d+)/.exec(text); return m ? `<a href="#shot-${m[1]}">${esc(text)}</a>` : esc(text); };
const stillLink = (id) => `<a href="#still-${esc(id)}"><code>${esc(id)}</code></a>`;

// A table from column headers and rows of pre-escaped cell HTML; `cls` is a per-cell class map, rows[i][j] -> class.
function table(cols, rows, { cls = () => "", rowCls = () => "" } = {}) {
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows.map((r, i) => `<tr${rowCls(i) ? ` class="${rowCls(i)}"` : ""}>${r.map((c, j) => `<td${cls(i, j) ? ` class="${cls(i, j)}"` : ""}>${c}</td>`).join("")}</tr>`).join("\n");
  return `<table><thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody></table>`;
}

// The people (or props) of one frame as a table; against `base` (the other frame of the shot), cells that differ
// for the same id are marked .diff and ids absent from the base are marked .new.
function frameTable(items, cols, base) {
  const rows = items.map((it) => cols.map((c) => c === "id" ? `<code>${esc(it[c])}</code>` : esc(it[c])));
  const cls = (i, j) => { const b = base?.find((x) => x.id === items[i].id); return b && canon(b[cols[j]]) !== canon(items[i][cols[j]]) ? "diff" : ""; };
  const rowCls = (i) => base && !base.some((x) => x.id === items[i].id) ? "new" : "";
  return table(cols, rows, { cls, rowCls });
}

function frameHtml(label, frame, base) {
  const extra = label === "LAST FRAME" && canon(frame) === canon(base) ? `<span class="tag">identical to first frame</span>` : "";
  const people = frame.people?.length ? frameTable(frame.people, PERSON_COLS, base?.people) : `<p>${empty("nobody")}</p>`;
  const props = frame.props?.length ? `<div class="sub">props</div>${frameTable(frame.props, PROP_COLS, base?.props)}` : "";
  return `<div class="flabel">${label}${extra}</div>${people}${props}`;
}

const kv = (pairs) => `<dl class="kv">${pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const timeline = (label, items, text) => items.length ? `<div class="flabel">${label}</div><ul class="tl">${items.map((it) => `<li><span class="at">[${esc(it.at)} s]</span>${text(it)}</li>`).join("")}</ul>` : "";

// A tiny Markdown subset: # headings, paragraphs, "- " and "1. " lists, one pipe table, `code`. Text stays verbatim.
function md(src) {
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = []; let para = [], list = null, rows = [];
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const isSep = (line) => cells(line).every((c) => /^:?-+:?$/.test(c));
  const closePara = () => { if (para.length) out.push(`<p>${inline(para.join("\n"))}</p>`); para = []; };
  const closeList = () => { if (list) out.push(`</${list}>`); list = null; };
  const closeTable = () => {
    if (!rows.length) return;
    const header = rows.length > 1 && isSep(rows[1]) ? cells(rows[0]) : null, body = (header ? rows.slice(2) : rows).map(cells);
    out.push(`<table>${header ? `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    rows = [];
  };
  const flush = () => { closePara(); closeList(); closeTable(); };
  for (const line of src.split(/\r?\n/)) {
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flush(); const h = Math.min(m[1].length + 2, 6); out.push(`<h${h}>${inline(m[2])}</h${h}>`); continue; }
    if (/^\s*\|/.test(line)) { closePara(); closeList(); rows.push(line); continue; }
    if ((m = /^\s*(-|\d+\.)\s+(.*)$/.exec(line))) {
      closePara(); closeTable();
      const type = m[1] === "-" ? "ul" : "ol";
      if (list !== type) { closeList(); out.push(`<${type}>`); list = type; }
      out.push(`<li${type === "ol" ? ` value="${parseInt(m[1], 10)}"` : ""}>${inline(m[2])}</li>`);
      continue;
    }
    closeList(); closeTable(); para.push(line);
  }
  flush();
  return out.join("\n");
}

// ---------- sections ----------
const toc = [["notes", "Review notes"], ["checks", "Checks"], ["plan", "Plan and cost"], ["story", "Story"], ["script", "Shooting script"], ["stills", "Still prompts"], ["clips", "Clip prompts"], ["cast", "Cast"], ["sources", "Sources"]];

const header = `<header>
<h1>${esc(script.title.toUpperCase())}</h1>
<p class="meta"><span>${total} s</span><span>run <code>${esc(LABEL)}</code></span>${KFID ? `<span>variant <code>${esc(KFID)}</code>${RUN.kf?.[KFID]?.name ? `: ${esc(RUN.kf[KFID].name)}` : ""}</span>` : ""}<span>${esc(DATE)}</span><span>${script.scenes.length} scene${script.scenes.length === 1 ? "" : "s"}, ${shots.length} shots, ${plan.stills.length} stills, ${plan.clips.length} clips</span></p>
<p class="status">${esc(STATUS)}</p>
</header>`;

const notesSection = `<section id="notes" class="card">
<h2>Review notes</h2>
${NOTES === null ? `<p>${empty("no review-notes.md in this run")}</p>` : `<div class="md">${md(NOTES)}</div>`}
</section>`;

const checksSection = `<section id="checks" class="card">
<h2>Checks</h2>
${!checks.errors.length && !checks.notes.length ? `<p class="ok">all passed</p><p class="mut">0 errors, 0 notes.</p>` : `
<div class="flabel">ERRORS (${checks.errors.length})</div>${checks.errors.length ? `<ul class="err">${checks.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : `<p>${empty("none")}</p>`}
<div class="flabel">NOTES (${checks.notes.length})</div>${checks.notes.length ? `<ul>${checks.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p>${empty("none")}</p>`}`}
</section>`;

const seconds = plan.clips.reduce((n, c) => n + c.seconds, 0), stillCost = plan.stills.length * STILL_CREDITS, clipCost = seconds * SECOND_CREDITS;
const planSection = `<section id="plan" class="card">
<h2>Plan and cost</h2>
<div class="flabel">STILLS (${plan.stills.length})</div>
${table(["still", "scene", "size", "place", "image 1", "used by"], plan.stills.map((s) => [stillLink(s.id), esc(s.scene), esc(s.size), `<code>${esc(s.place)}</code>`, `<code>${esc(s.images[0])}</code>`, s.uses.map(shotLink).join(", ")]))}
<div class="flabel">CLIPS (${plan.clips.length})</div>
${table(["clip", "scene", "seconds", "start still", "end still"], plan.clips.map((c) => [`<a href="#clip-${c.n}">clip ${c.n}</a>`, esc(c.scene), `${esc(c.seconds)} s`, stillLink(c.start), stillLink(c.end)]))}
<div class="flabel">COST</div>
<ul class="cost">
<li>${plan.stills.length} stills × ${STILL_CREDITS} = <b>${fmt(stillCost)}</b> credits</li>
<li>${seconds} s × ${SECOND_CREDITS} = <b>${fmt(clipCost)}</b> credits</li>
<li>total <b>${fmt(stillCost + clipCost)}</b> credits</li>
</ul>
</section>`;

const storySection = `<section id="story" class="card">
<h2>Story</h2>
<details>
<summary>The source story, <i>${esc(story.title)}</i> (${esc(story.story.length)} characters)</summary>
<div class="prose">${esc(story.story)}</div>
</details>
</section>`;

function shotHtml(h) {
  const cam = h.camera;
  return `<article id="shot-${h.n}" class="shot">
<h3>SHOT ${h.n}&ensp;${esc(h.start)}–${esc(h.start + h.seconds)} s&ensp;${esc(h.size)}&ensp;(${esc(h.cut_reason)})</h3>
${kv([["same as", cam.same_as ? shotLink(`shot ${cam.same_as}`) : undefined], ["stands", esc(cam.stands)], ["height", esc(cam.height)], ["looks at", esc(cam.looks_at)], ["behind", cam.behind.length ? cam.behind.map((b) => `<code>${esc(b)}</code>`).join(", ") : empty("nothing named")]])}
${frameHtml("FIRST FRAME", h.first)}
${timeline("ACTION", h.action, (a) => esc(a.text))}
${timeline("LINES", h.lines, (l) => `<span class="who">${esc(l.who.toUpperCase())}:</span> ${esc(l.text)}`)}
${timeline("SFX", h.sfx, (s) => esc(s.text))}
${frameHtml("LAST FRAME", h.last, h.first)}
<div class="flabel">CHANGED</div>${h.changes.length ? `<ul>${h.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p>${empty("none")}</p>`}
</article>`;
}

function sceneHtml(sc) {
  return `<div class="scene">
<h3 class="slug">${esc(sc.n)}. ${sc.inside ? "INT." : "EXT."} ${esc(name(sc.place).toUpperCase())} — ${esc(sc.time)}${sc.continuous ? " — CONTINUOUS" : ""}&ensp;<span class="mut">${esc(sc.start)}–${esc(sc.start + sc.seconds)} s</span></h3>
${kv([["place", `<code>${esc(sc.place)}</code>`], ["continuous", esc(String(sc.continuous))], ["ambience", sc.ambience ? esc(sc.ambience) : empty()], ["music", sc.music ? esc(sc.music) : empty()],
  ["captions", sc.captions.length ? `<ul class="tl">${sc.captions.map((c) => `<li><span class="at">[${esc(c.at)} s]</span><span class="pre">${esc(c.text)}</span></li>`).join("")}</ul>` : empty("none")],
  ["line between", esc(sc.line.between)], ["camera side", esc(sc.line.camera_side)]])}
<div class="flabel">BLOCKING</div>
${table(["id", "where", "facing", "holding"], sc.blocking.map((b) => [`<code>${esc(b.id)}</code>`, esc(b.where), esc(b.facing), b.holding ? esc(b.holding) : empty()]))}
${sc.shots.map(shotHtml).join("\n")}
</div>`;
}

const scriptSection = `<section id="script" class="card">
<h2>Shooting script</h2>
<p class="mut">${esc(script.title.toUpperCase())}&ensp;(${total} s; ${script.scenes.length} scene${script.scenes.length === 1 ? "" : "s"}, ${shots.length} shots). In each LAST FRAME table the cells that differ from the FIRST FRAME for the same id are tinted.</p>
${script.scenes.map(sceneHtml).join("\n")}
</section>`;

function imageLine(ref, i) {
  const [kind, id] = ref.split(/:(.*)/);
  const what = kind === "plate" ? `${IMAGE_KINDS.plate} (${esc(name(id))})` : kind === "env" ? `${IMAGE_KINDS.env} (${stillLink(id)})` : kind === "portrait" ? `${IMAGE_KINDS.portrait} (${esc(name(id))})` : `<span class="mut">(unknown kind)</span>`;
  return `<li><span class="at">image ${i + 1}:</span><code>${esc(ref)}</code> — ${what}</li>`;
}

const stillsSection = `<section id="stills" class="card">
<h2>Still prompts</h2>
<p class="mut">Image 1 is always the environment reference (a plate of the empty place, or an earlier still of this run); images 2 and up are the bank portraits of the people in frame, in that order. Prompts are shown exactly as assembled, line breaks included.</p>
${plan.stills.map((s) => `<article id="still-${esc(s.id)}" class="still">
<h3><code>${esc(s.id)}</code>&ensp;<span class="mut">${esc(s.size)} · scene ${esc(s.scene)} · <code>${esc(s.place)}</code></span></h3>
${kv([["used by", s.uses.map(shotLink).join(", ")], ["images", `<ul class="tl">${s.images.map(imageLine).join("")}</ul>`]])}
<pre>${esc(s.prompt)}</pre>
</article>`).join("\n")}
</section>`;

const clipsSection = `<section id="clips" class="card">
<h2>Clip prompts</h2>
${plan.clips.map((c) => `<article id="clip-${c.n}" class="clip">
<h3>clip ${esc(c.n)} · ${esc(c.seconds)} s · ${stillLink(c.start)} → ${stillLink(c.end)}</h3>
<pre>${esc(c.prompt)}</pre>
</article>`).join("\n")}
</section>`;

const castIds = [...new Set([...elements.filter((e) => e.kind === "character").map((e) => e.id), ...Object.keys(features), ...Object.keys(voices)])];
const castSection = `<section id="cast" class="card">
<h2>Cast</h2>
${table(["id", "name", "features", "voice"], castIds.map((id) => [`<code>${esc(id)}</code>`, esc(name(id)), id in features ? esc(features[id]) : empty("none"), id in voices ? esc(voices[id]) : empty("none")]))}
</section>`;

const sourcesSection = `<section id="sources" class="card">
<h2>Sources</h2>
<ul>${SOURCES.map((f) => `<li><code>${esc(relative(REPO, join(DIR, f)))}</code>${existsSync(join(DIR, f)) ? "" : ` <span class="mut">(missing)</span>`}</li>`).join("")}</ul>
<p class="mut">Page generated by <code>cleaned/experiments/script-page.mjs</code>.</p>
</section>`;

// ---------- page ----------
const css = `
:root{--ink:#1f2328;--mut:#667085;--line:#d9dee5;--bg:#f6f7f9;--card:#fff;--zebra:#f3f5f8;--head:#eceff3;--diff:#fdf1d2;--diffline:#d9a21b;--new:#e5f0fb;--ok:#1b7f3b;--err:#b42318;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}
html{scroll-padding-top:52px}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:1100px;margin:0 auto;padding:0 20px 60px}
nav.toc{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);padding:9px 20px;display:flex;gap:4px 18px;flex-wrap:wrap;font-size:14px}
nav.toc a{color:var(--ink);text-decoration:none}
nav.toc a:hover{text-decoration:underline}
a{color:#1a56a8}
header{padding:22px 0 6px}
header h1{font-size:30px;letter-spacing:.06em;margin:0 0 6px}
.meta{display:flex;gap:18px;flex-wrap:wrap;margin:0;color:var(--mut)}
.status{margin:8px 0 0;font-weight:600}
section.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 20px;margin:16px 0}
h2{font-size:20px;margin:0 0 10px}
h3{font-size:16px;margin:14px 0 6px}
.md h3{font-size:17px;margin:4px 0 8px}
.md h4{font-size:15px;margin:14px 0 4px}
.md ul,.md ol{margin:4px 0 8px;padding-left:24px}
.md li{margin:2px 0}
.md table{width:auto;min-width:320px}
code{font:0.92em var(--mono);background:#f0f2f5;padding:1px 4px;border-radius:3px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#f3f5f8;border:1px solid var(--line);border-radius:6px;padding:10px 12px;font:13px/1.5 var(--mono);margin:8px 0 4px}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0 12px}
th,td{border:1px solid var(--line);padding:5px 8px;vertical-align:top;text-align:left}
th{background:var(--head);font-weight:600}
tbody tr:nth-child(even){background:var(--zebra)}
td.diff{background:var(--diff);box-shadow:inset 3px 0 0 var(--diffline)}
tr.new td{background:var(--new)}
.mut{color:var(--mut)}
.ok{color:var(--ok);font-weight:700;font-size:17px;margin:4px 0}
ul.err li{color:var(--err)}
.pre{white-space:pre-wrap}
.prose{white-space:pre-wrap;max-width:72ch;font-size:15.5px;line-height:1.65;margin:10px 0 4px}
details summary{cursor:pointer}
dl.kv{display:grid;grid-template-columns:max-content 1fr;gap:3px 16px;margin:6px 0 8px}
dl.kv dt{color:var(--mut);font-size:13.5px;padding-top:1px}
dl.kv dd{margin:0}
.flabel{font:600 12px var(--mono);letter-spacing:.08em;color:var(--mut);margin:12px 0 2px}
.sub{font:600 12px var(--mono);color:var(--mut);margin:6px 0 0}
.tag{font:12px var(--mono);letter-spacing:0;color:var(--ink);background:var(--head);border-radius:4px;padding:1px 7px;margin-left:10px;font-weight:500}
ul.tl{list-style:none;padding:0;margin:2px 0 4px}
ul.tl li{padding:2px 0}
.at{font:12.5px var(--mono);color:var(--mut);margin-right:8px}
.who{font-weight:600;letter-spacing:.03em}
.scene{margin-top:8px}
h3.slug{font:600 15px var(--mono);letter-spacing:.02em;margin:10px 0 6px}
article.shot,article.still,article.clip{border:1px solid var(--line);border-left:4px solid #c7ced8;border-radius:6px;padding:10px 16px 12px;margin:14px 0;background:#fcfcfd}
article.shot h3,article.still h3,article.clip h3{font:600 15px var(--mono);letter-spacing:.02em;margin:2px 0 6px}
ul.cost{margin:4px 0;padding-left:22px}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(script.title)} — ${esc(LABEL)} review</title>
<style>${css}</style>
</head>
<body>
<nav class="toc">${toc.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("")}</nav>
<main>
${header}
${notesSection}
${checksSection}
${planSection}
${storySection}
${scriptSection}
${stillsSection}
${clipsSection}
${castSection}
${sourcesSection}
</main>
</body>
</html>
`;

mkdirSync(join(KDIR, "page-review"), { recursive: true });
writeFileSync(OUT, html);
console.log(`${relative(REPO, OUT)}: ${html.length} chars; ${script.scenes.length} scenes, ${shots.length} shots, ${plan.stills.length} stills, ${plan.clips.length} clips${NOTES === null ? "; no review-notes.md" : ""}`);
