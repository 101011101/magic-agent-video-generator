// The benchmark as a page to read before anything runs: every case with what each kind of user types, what they attach, what
// they know when asked, and what is checked on the result. No results on it. Written for the lead's review (2026-11-08).
// Usage: node V2/bench/mcp/benchmark-page.mjs [--out /Users/ray/Coding/magic-hour-mcp/Benchmark/personas]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { PERSONAS, SWEEP } from "./personas.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../.."), FIX = join(V2, "bench/v1/fixtures"), OPEN = join(HERE, "openings");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "/Users/ray/Coding/magic-hour-mcp/Benchmark/personas"); mkdirSync(join(OUT, "thumbs"), { recursive: true });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const items = readdirSync(join(V2, "bench/v1/items")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(V2, "bench/v1/items", f), "utf8"))).sort((a, b) => a.id.localeCompare(b.id));
const ORDER = SWEEP;   // the users that run (personas.mjs): one who gives the right information, one who is lost, one who gives too much
const opening = (p, it) => { const f = join(OPEN, p, `${it.id}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };
// one small picture per attachment: the image itself, or the first frame of a clip; a text attachment is named
function thumb(name) {
  const src = join(FIX, name); if (!existsSync(src)) return `<span class="att">${esc(name)} (missing)</span>`;
  if (/\.(txt|md)$/i.test(name)) return `<span class="att">📄 ${esc(name)}</span>`;
  if (/\.(mp3|wav|m4a)$/i.test(name)) return `<span class="att">🔊 ${esc(name)}</span>`;
  const out = `thumbs/${name.replace(/\.[^.]+$/, "")}.jpg`;
  if (!existsSync(join(OUT, out))) try { execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-frames:v", "1", "-vf", "scale=240:-2", "-q:v", "5", join(OUT, out)]); } catch { return `<span class="att">${esc(name)}</span>`; }
  return `<figure class="att"><img src="${out}" alt=""><figcaption>${esc(name)}${/\.(mp4|mov|webm)$/i.test(name) ? " (clip)" : ""}</figcaption></figure>`;
}
const SHAPE = { "16:9": "widescreen 16:9", "9:16": "vertical 9:16", "1:1": "square 1:1", "4:5": "portrait 4:5", any: "any shape" };
const specLines = (s) => [s.kind === "none" ? "no file: the reply is the result" : s.kind === "text" ? "a text" : `${s.outputs > 1 ? `${s.outputs} ` : "a "}${{ image: "picture", images: "pictures", video: "video", audio: "sound file" }[s.kind] || s.kind}`, s.aspect && s.aspect !== "any" ? SHAPE[s.aspect] : null, s.seconds ? `about ${s.seconds} s` : null, s.audio === "required" ? "with sound" : s.audio === "none" && s.kind === "video" ? "silent" : null, s.exact_text?.length ? `exact text: ${s.exact_text.map((t) => `“${t}”`).join(", ")}` : null].filter(Boolean);
const BASIC = ["a file exists and is the kind asked for, as many as asked for", "shape within 4% of the one asked", "length within 20% or 1.5 s of the one asked", "sound present and audible when asked; silent when asked", "no black frames; the clip moves", "every generated clip is in the final video", "“delivered” is backed by a file; no parts-only ending", "exact words read exactly; no major visible fault; usable as is (vision judge)"];
const groups = [...new Map(items.map((it) => [it.group, it.group_name])).entries()].sort();
const byGroup = (g) => items.filter((it) => it.group === g);
const card = (it) => {
  const ops = ORDER.map((p) => [p, opening(p, it)]);
  return `<article id="${it.id}">
<h3>${esc(it.id)} · ${esc(it.title)}</h3>
<p class="tests">${esc(it.tests)}</p>
${it.turns[0].materials?.length ? `<div class="atts">${it.turns[0].materials.map(thumb).join("")}</div>` : ""}
<table class="ops"><tbody>${ops.map(([p, o]) => { const P = PERSONAS[p]; const text = p === "happy" || !o ? it.turns[0].text : o.text; return `<tr class="op" data-p="${p}"><th>${esc(P.label)}</th><td>${esc(text)}${o && !o.as_written && o.withheld?.length ? `<div class="mut">left out on purpose: ${esc(o.withheld.join("; "))}</div>` : ""}</td></tr>`; }).join("")}</tbody></table>
${it.turns.length > 1 ? `<p><b>Then the user says:</b> ${it.turns.slice(1).map((t) => `“${esc(t.text)}”${t.materials?.length ? ` [${esc(t.materials.join(", "))}]` : ""}`).join(" · ")}</p>` : ""}
<details><summary>What the user knows when asked</summary><dl>${Object.entries(it.answer_sheet).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></details>
<div class="check"><b>Checked on the result:</b> ${specLines(it.spec).map(esc).join(" · ")}${it.expect.asks === "required" ? ` · <i>must ask first: ${esc(it.expect.asks_about)}</i>` : ""}${it.expect.asks === "never" ? " · <i>should not need to ask</i>" : ""}${it.expect.refuse ? " · <i>should refuse</i>" : ""}${it.expect.beyond_free === "yes" ? " · <i>should say it is beyond the free tier</i>" : ""}
<ul>${it.must_haves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
</article>`;
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark: the cases</title>
<style>
:root{--fg:#1b1b1b;--mut:#6b6b6b;--line:#e3e3e3;--bg:#fff;--soft:#f6f6f6}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--fg:#e8e8e8;--mut:#9a9a9a;--line:#333;--bg:#141414;--soft:#1e1e1e}}
body{margin:0 auto;max-width:980px;padding:24px 16px 64px;font:15px/1.45 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg)}
h1{font-size:24px;margin:0 0 8px}h2{font-size:18px;margin:40px 0 8px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:16px;margin:0 0 4px}
.mut{color:var(--mut);font-size:13px}p{margin:6px 0}ul{margin:4px 0 0 18px;padding:0}li{margin:2px 0}
article{padding:14px 0 18px;border-top:1px solid var(--line)}.tests{color:var(--mut);font-size:13px}
.atts{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.att{margin:0;font-size:12px;color:var(--mut)}.att img{display:block;width:120px;height:auto;border-radius:3px}
table.ops{border-collapse:collapse;width:100%;margin:8px 0}table.ops th{text-align:left;vertical-align:top;font-weight:600;font-size:13px;width:150px;padding:4px 8px 4px 0;color:var(--mut)}table.ops td{padding:4px 0;vertical-align:top}
.check{background:var(--soft);padding:8px 10px;border-radius:6px;margin-top:8px}dl{margin:4px 0}dt{font-weight:600;font-size:13px;margin-top:4px}dd{margin:0}
nav{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;z-index:1}nav label{margin-right:10px;white-space:nowrap}nav a{margin-right:8px}
.personas th{text-align:left;vertical-align:top;padding:3px 8px 3px 0;white-space:nowrap}.personas td{padding:3px 0}
</style></head><body>
<h1>The benchmark: ${items.length} cases, each typed by ${ORDER.length} kinds of user</h1>
<p class="mut">What runs before anything is judged. Every case runs on both sides (the current Magic Hour MCP as ChatGPT has it, and the upgraded build) under each of the three users below, dry first (no generation, 0 credits: the questions, the replies and the attempted call are recorded) and then for real. Nothing on this page is a result.</p>
<h2 style="border:0;margin-top:16px">The users</h2>
<p>A simulated user answers the agent from a knowledge bank: the request in full plus the answers under “what the user knows”. The bank is the same for every user; the user changes how the first message is written and how willingly it answers. After three answers the user gives up with one line. The checklist does not change with the user.</p>
<table class="personas"><tbody>${ORDER.map((p) => `<tr><th>${esc(PERSONAS[p].label)}</th><td>${esc(PERSONAS[p].about)}</td></tr>`).join("")}</tbody></table>
<h2 style="border:0">What is checked</h2>
<p><b>The conversation:</b> questions asked and whether each was needed; plain words; exact answers accepted; nothing invented; coped with the kind of user (re-asked in plain words, found the facts buried in the ramble); the attempted call carries the shape, length, sound and words the user wanted. Basic checks on every conversation: it ran to the end; every message got an answer; a create call was tried or a plan made; no question asked three times; “you pick” was taken; not still asking after the user gave up; nothing charged in a dry run; no server fault. The simulated user is checked too: it stayed in character and kept to its knowledge bank.</p><p><b>Kept for analysis:</b> for every conversation, the whole trace: each model step with its time and tokens, the model’s reasoning summaries, every tool call with its full arguments and full answer, the gate’s decision, the prompt behind each line the simulated user wrote, and the server’s tool list as the model saw it.</p>
<p><b>The result:</b> the case's own checklist (below each case), then the same basic checks for every case: ${BASIC.map(esc).join("; ")}.</p>
<p class="mut">Rules: free tier on both sides, the same driver model and the same judge, no retries. Groups: ${groups.map(([g, n]) => `<a href="#g-${g}">${esc(g)}</a> ${esc(n)}`).join(" · ")}.</p>
<nav>Show the first message of: ${["all", ...ORDER].map((p) => `<label><input type="radio" name="p" value="${p}" ${p === "all" ? "checked" : ""}> ${p === "all" ? "every user" : esc(PERSONAS[p].label)}</label>`).join("")}</nav>
${groups.map(([g, n]) => `<h2 id="g-${g}">${esc(g)} · ${esc(n)} <span class="mut">(${byGroup(g).length})</span></h2>${byGroup(g).map(card).join("")}`).join("")}
<p class="mut" style="margin-top:32px">${items.length} cases · ${items.length * ORDER.length} conversations per side per run. Openings written once and kept (V2/bench/mcp/openings); the simulated user's rules in V2/bench/mcp/personas.mjs.</p>
<script>document.querySelectorAll('nav input').forEach(r=>r.addEventListener('change',()=>{const v=document.querySelector('nav input:checked').value;document.querySelectorAll('.op').forEach(tr=>{tr.style.display=(v==='all'||tr.dataset.p===v)?'':'none'})}))</script>
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`${items.length} cases → ${join(OUT, "index.html")} (${Math.round(html.length / 1024)} KB)`);
