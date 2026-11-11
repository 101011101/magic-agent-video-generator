// One page for a dense bench item: a row per run (service, result, generation, time, cost), the input (brief and attachments), the
// pipeline of each run (every tool call in order with what it was given and what came back, what it asked and what the user
// answered, then the reply), and the output of every run that made a file, beside a checklist of what was wanted and what came out.
// A run is one record written by bench/mcp/run.mjs (the Magic Hour MCP) or bench/mcp/competitors/run.mjs (another service), so one
// page can hold several runs of one service, or the same item on several services.
// Numbers are read from the run records or measured with ffprobe. The checklist is read from <id>.checks.json beside the record:
// { by, outcome?, checks: [{ want, got, result: "yes" | "partly" | "no" }] }; outcome "parts" marks a run that handed over pieces and no finished file.
// Optional beside the record: <id>.notes.json (an array of lines shown under the pipeline) and <id>.files.json ({ file name: caption },
// for a run that kept a step beside the delivered file: the first file is the delivered one, and only its frames are shown).
// The folder is self-contained: inputs and outputs are copied beside index.html, with a summary.json for the index page.
// Usage: node V2/bench/mcp/dense/page.mjs --out <dir> [--title "…"] [--turns N] [--nav A1,A2,…] <record.json> [<record.json> …]
//          --turns N   count only the first N messages of each run (leaves off a follow-up message that made nothing new)
//          --nav LIST  the item folders, in order, for the bar at the top (arrows to cycle, a button for each item and the index)
//        node V2/bench/mcp/dense/page.mjs --index <dir> [--title "…"]     one table over every <dir>/*/summary.json
//        V2/bench/mcp/dense/pages.sh rebuilds every page and the index.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), FIX = join(V2, "bench/v1/fixtures");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const num = (n) => Number(n).toLocaleString("en-US");
const src = (f) => esc(encodeURI(f));
const RESULT = { delivered: ["Delivered", "ok"], cannot: ["Declined", "bad"], refusal: ["Refused", "bad"], question: ["Still asking", "mid"], approval: ["Still asking", "mid"], nofile: ["No file", "bad"], novideo: ["No video", "bad"], parts: ["Parts only", "mid"], error: ["Error", "bad"] };
const DONE = { yes: ["Yes", "ok"], partly: ["Partly", "mid"], no: ["No", "bad"] };
const result = (r) => { const [label, cls] = RESULT[r.kind] || [r.kind, "mid"]; return `<span class="${cls}">${label}</span>${r.nudged && r.kind === "delivered" ? ` <span class="mut">after a nudge</span>` : ""}`; };
const CSS = `:root{color-scheme:light dark;--mut:#6b655c;--line:#e4ded3;--ok:#1d7a3d;--mid:#9a6b00;--bad:#b3261e}@media(prefers-color-scheme:dark){:root{--mut:#a39c90;--line:#2d2922;--ok:#5ac07b;--mid:#e0b24a;--bad:#f0756c}}
body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:940px;margin:0 auto;padding:28px 16px 48px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:34px 0 10px}p{margin:0}a{color:inherit}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px}nav a{min-width:38px;padding:5px 11px;border:1px solid var(--line);border-radius:7px;text-align:center;text-decoration:none;font-size:13.5px}nav a:hover{border-color:var(--mut)}nav a.on{background:CanvasText;color:Canvas;border-color:CanvasText}
.mut,figcaption,th,summary{color:var(--mut);font-size:12.5px;font-weight:400}h1+.mut{margin-bottom:18px}table+.mut{margin-top:8px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:7px 16px 7px 0;border-bottom:1px solid var(--line);vertical-align:top}.n{text-align:right;white-space:nowrap;padding:7px 0 7px 16px}.n+td,.n+th{padding-left:20px}.nw{white-space:nowrap}
.ok{color:var(--ok)}.mid{color:var(--mid)}.bad{color:var(--bad)}td.ok,td.mid,td.bad,td>span:not(.mut),b+span{font-weight:600;white-space:nowrap}
ol{margin:4px 0 16px;padding-left:22px;font-size:14px}.notes{margin:-8px 0 18px 22px}li{margin:4px 0;overflow-wrap:anywhere}code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace}summary{cursor:pointer}.pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13.5px;margin:6px 0 10px;padding-left:12px;border-left:2px solid var(--line)}
.in,.out{display:grid;gap:24px;align-items:start}.in{grid-template-columns:1fr auto}.out{grid-template-columns:260px 1fr;margin:8px 0 0}.out.wide{grid-template-columns:1fr}.out.wide video{max-width:640px}.brief{white-space:pre-wrap}.out+p,.frames+p+p{margin-top:26px}
.pics{display:flex;gap:8px}.pics img,.pics video{height:150px;border-radius:6px;display:block}figure{margin:0}video,figure img{width:100%;border-radius:8px;display:block}audio{width:100%}
.frames{display:grid;grid-template-columns:repeat(16,1fr);gap:3px;margin:20px 0 6px}.frames.wide{grid-template-columns:repeat(8,1fr)}.frames img{width:100%;display:block;border-radius:2px}
@media(max-width:720px){.in,.out{grid-template-columns:1fr}.out video{max-width:260px}.frames{grid-template-columns:repeat(8,1fr)}.frames.wide{grid-template-columns:repeat(4,1fr)}table{display:block;overflow-x:auto}}`;
const head = (t) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t)}</title>\n<style>${CSS}</style>\n`;
// The bar at the top of every page: an arrow each way to cycle through the items (wrapping round; the left and right arrow keys do
// the same), and a button for the index and for each item. ids: the item folders in order; cur: this page's folder, or null on the
// index; base: "" from the index, "../" from an item page.
const nav = (ids, cur, base) => {
  if (!ids.length) return "";
  const href = (id) => `${base}${src(id)}/index.html`, i = ids.indexOf(cur), n = ids.length, prev = ids[(i < 0 ? n - 1 : i + n - 1) % n], next = ids[(i + 1) % n];
  return `<nav><a id="prev" href="${href(prev)}" aria-label="Previous item">←</a><a href="${base}index.html"${cur ? "" : ' class="on"'}>All</a>${ids.map((id) => `<a href="${href(id)}"${id === cur ? ' class="on"' : ""}>${esc(id)}</a>`).join("")}<a id="next" href="${href(next)}" aria-label="Next item">→</a></nav>
<script>addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey||e.altKey||e.target.closest("video,audio,input,textarea,summary"))return;const a=document.getElementById(e.key==="ArrowLeft"?"prev":e.key==="ArrowRight"?"next":"-");if(a)location.href=a.href})</script>\n`;
};

const argv = process.argv.slice(2);
// ---- the index: one row per item and service, from each item folder's summary.json
if (argv.includes("--index")) {
  const dir = resolve(argv[argv.indexOf("--index") + 1]), t = argv.includes("--title") ? argv[argv.indexOf("--title") + 1] : "Benchmark";
  const items = readdirSync(dir).filter((d) => existsSync(join(dir, d, "summary.json"))).sort().map((d) => ({ dir: d, ...JSON.parse(readFileSync(join(dir, d, "summary.json"), "utf8")) }));
  const rows = items.flatMap((s) => s.rows.map((r, k) => `<tr><td>${k ? "" : `<a href="${src(s.dir)}/index.html">${esc(s.id)}</a>`}</td><td>${k ? "" : esc(s.case_name)}</td><td class="nw">${esc(r.service)}${r.runs > 1 ? ` <span class="mut">run ${r.n} of ${r.runs}</span>` : ""}</td><td>${result(r)}</td><td class="nw">${r.generation.map(esc).join("<br>") || "—"}</td><td class="n">${r.seconds} s</td><td class="n">${esc(r.cost)}</td><td class="nw">${r.checks ? `${r.checks.yes} yes · ${r.checks.partly} partly · ${r.checks.no} no` : "—"}</td></tr>`)).join("");
  writeFileSync(join(dir, "index.html"), `${head(t)}<style>body{max-width:1240px}</style>${nav(items.map((s) => s.dir), null, "")}<h1>${esc(t)}</h1><p class="mut">${esc(items[0]?.sub || "")}</p>
<table><tr><th>Item</th><th>Case</th><th>Service</th><th>Result</th><th>Generation</th><th class="n">Time</th><th class="n">Cost</th><th>Checklist</th></tr>${rows}</table>
<p class="mut">${items.length} items · ${items.reduce((a, s) => a + s.rows.length, 0)} rows · cost is in each service's own credits or units</p></html>`);
  console.log(`wrote ${join(dir, "index.html")} · ${items.length} items`);
  process.exit(0);
}

const records = []; let OUT = null, title = null, TURNS = Infinity, NAV = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") OUT = resolve(argv[++i]);
  else if (argv[i] === "--title") title = argv[++i];
  else if (argv[i] === "--turns") TURNS = Number(argv[++i]);
  else if (argv[i] === "--nav") NAV = argv[++i].split(",").filter(Boolean);
  else records.push(resolve(argv[i]));
}
if (!OUT || !records.length || !(TURNS >= 1)) { console.error('usage: node page.mjs --out <dir> [--title "…"] [--turns N] [--nav A1,A2,…] <record.json> [<record.json> …]   |   node page.mjs --index <dir> [--title "…"]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const noSig = (s) => String(s ?? "").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "…").replace(/\?X-Goog[^)\s"]*/g, "").replace(/([?&](?:token|sig|signature|X-Amz-[A-Za-z-]+|Expires|Key-Pair-Id|Policy)=)[^&\s")]+/gi, "$1…");   // a signed download link grants access; the page keeps the plain address
// A reply as a chat app shows it: bold and italics rendered, a link as its text and plain URL.
const md = (s) => esc(noSig(s)).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/gm, "$1<i>$2</i>");
const firstLine = (s) => { const l = (noSig(s).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "").split("\n").find((x) => x.trim()) || "").trim(); return l.length > 150 ? `${l.slice(0, 150).replace(/\s+\S*$/, "")}…` : l; };
// A call is read-only when its tool only looks something up: the same split as the two runners, so it never counts as a generation.
const READ_ONLY = /^(get_|list_|search|show_|fetch_|check_|wait_|estimate_|browse|query_|hf_|hub_|inspect_|view_|recommend_|resolve_|verify_)|^(whoami|who_am_i|select_organization|cql|ping|use_previous_output)$/;
const args = (c) => parse(c.arguments) || {};
const isRead = (c) => READ_ONLY.test(c.name) || (c.name === "dynamic_space" && args(c).operation !== "invoke");
const VIDEO = /\.(mp4|mov|webm)$/i, AUDIO = /\.(mp3|wav|m4a)$/i;
const ff = (a) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a]);
function probe(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8" }));
  const v = j.streams.find((s) => s.codec_type === "video");
  return { width: v?.width, height: v?.height, seconds: Number(j.format.duration) };
}

// ---- the input: the first message of the first record (every run of the item starts with the same message)
const first = JSON.parse(readFileSync(records[0], "utf8")), item = first.item, brief = item.turns[0];
const inputs = (brief.materials || []).map((m) => { copyFileSync(join(FIX, m), join(OUT, `in-${m}`)); return { name: m, file: `in-${m}` }; });

// ---- the runs
const amount = (b) => (b == null ? null : typeof b.compute_units?.total === "number" ? [b.compute_units.total, "units"] : typeof b.current === "number" ? [b.current, b.unit || "credits"] : typeof b.credits === "number" ? [b.credits, "credits"] : null);
const runs = records.map((path, i) => {
  const n = i + 1, rec = JSON.parse(readFileSync(path, "utf8")), dir = dirname(path), read = (f) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : null);
  const turns = (rec.turns || []).slice(0, TURNS), calls = turns.flatMap((t) => t.calls || []), jobType = {}, meta = read("run.json") || {};
  for (const c of (rec.turns || []).flatMap((t) => t.calls || [])) { const j = parse(c.output || ""); if (j?.id && j.type) jobType[j.id] = j.type; }
  // output files: the session's assets, one entry per distinct file (a later message that re-fetches the same job downloads it again)
  const assets = join(V2, rec.sessionDir || "", "assets"), seen = new Set(), files = [], captions = read(`${rec.id}.files.json`);   // <id>.files.json: { file name: caption }, for a run that kept a step beside the delivered file
  for (const f of rec.sessionDir && existsSync(assets) ? readdirSync(assets).sort() : []) {
    const from = join(assets, f), h = createHash("sha1").update(readFileSync(from)).digest("hex"); if (seen.has(h)) continue; seen.add(h);
    const name = `run${n}-${f}`; copyFileSync(from, join(OUT, name));
    const o = { name, kind: VIDEO.test(f) ? "video" : AUDIO.test(f) ? "audio" : "image", caption: captions?.[f] || null, step: !!captions && files.length > 0, ...probe(from) };
    if (o.kind === "video") {
      o.poster = `${name}.poster.jpg`; ff(["-ss", String(Math.min(1, o.seconds / 2)), "-i", from, "-frames:v", "1", "-q:v", "3", join(OUT, o.poster)]);
      const fdir = `${name}.frames`; rmSync(join(OUT, fdir), { recursive: true, force: true }); mkdirSync(join(OUT, fdir), { recursive: true });
      ff(["-i", from, "-vf", "select='isnan(prev_selected_t)+gte(t-prev_selected_t,1)',scale=240:-2", "-fps_mode", "vfr", "-q:v", "5", join(OUT, fdir, "%03d.jpg")]);   // the frame at 0 s, then one every second
      o.frames = readdirSync(join(OUT, fdir)).filter((x) => x.endsWith(".jpg")).sort().map((x) => `${fdir}/${x}`);
    }
    files.push(o);
  }
  files.sort((a, b) => (a.kind === "image") - (b.kind === "image"));   // the video or audio first, then any picture made on the way
  // the result: delivered needs a file on a competitor run (its reply can say "done" with a link we could not fetch)
  const said = turns.some((t) => t.kind === "delivered") ? "delivered" : turns.at(-1)?.kind, ours = rec.baseline === "mcp";
  const wantsVideo = rec.item?.spec?.kind === "video", noVideo = wantsVideo && files.length > 0 && !files.some((f) => f.kind === "video");   // asked for a video, got only a picture or a sound
  const checks = read(`${rec.id}.checks.json`);   // the person who scored the run may set "outcome": "parts" when the reply handed over pieces and no finished file
  const kind = rec.error && !turns.length ? "error" : checks?.outcome && RESULT[checks.outcome] ? checks.outcome : said === "delivered" && !files.length && !ours ? "nofile" : said === "delivered" && noVideo ? "novideo" : said;
  const credits = turns.reduce((a, t) => a + (t.spent || 0), 0), b0 = amount(meta.balance_before), b1 = amount(meta.balance_after);
  return { n, rec, meta, checks, notes: read(`${rec.id}.notes.json`) || [], turns, calls, files, jobType, kind, service: rec.server || (ours ? "Magic Hour" : rec.baseline || "?"),
    nudged: turns.some((t) => (t.dialog || []).some((d) => d.asked?.[0] === "cannot")), seconds: turns.reduce((a, t) => a + (t.seconds || 0), 0),
    cost: ours ? `${num(credits)} credits` : b0 && b1 ? `${num(b0[0] - b1[0])} ${b0[1]}` : "not shown" };
});
// a label per run: the service, with a run number when one service has several runs on the page
for (const r of runs) { const same = runs.filter((x) => x.service === r.service); r.label = same.length > 1 ? `${r.service} (run ${same.indexOf(r) + 1})` : r.service; }

// ---- rendering
// What a creation call was given, under whichever names the service uses: the model (or template, or Space), size, length, prompt.
const longest = (o) => { let best = ""; const walk = (x) => { if (typeof x === "string") { if (x.length > best.length && !/^(https?:|data:)\S+$/.test(x)) best = x; } else if (x && typeof x === "object") Object.values(x).forEach(walk); }; walk(o); return best; };
function given(c) {
  const a = args(c), p = typeof a.parameters === "string" ? parse(a.parameters) || {} : a.parameters || {}, f = { ...p, ...(a.input && typeof a.input === "object" ? a.input : {}), ...a };
  const model = a.model || (a.model_owner ? `${a.model_owner}/${a.model_name}` : null) || a.space_name || (c.name === "run_template" ? a.name : null) || (a.version ? String(a.version).replace(/:[0-9a-f]{16,}$/i, "") : null) || null;
  const s = f.end_seconds !== undefined ? Number(f.end_seconds) - Number(f.start_seconds || 0) : f.duration ?? f.seconds ?? f.duration_seconds;
  const prompt = a.style?.prompt || f.prompt || (isRead(c) ? "" : longest({ p, i: a.input, o: a.input_overrides }));
  return { model, resolution: f.resolution || null, aspect: f.aspect_ratio || f.ratio || f.orientation || null, seconds: s !== undefined && s !== null && s !== "" ? `${s} s` : null,
    audio: f.audio === undefined && f.generate_audio === undefined ? null : `audio ${(f.audio ?? f.generate_audio) ? "on" : "off"}`, refs: Array.isArray(a.references) && a.references.length ? `references: ${a.references.map((r) => r.name).join(", ")}` : null, prompt: prompt.length > 60 ? prompt : "" };
}
// A creation call failed when the server answered with an error, or with words that say the request was not accepted. A call that
// only timed out may still have started its job, so it does not count as failed.
const timedOut = (c) => /timed out/i.test(c.error || "");
const failed = (c) => (c.error ? !timedOut(c) : /^\W*(error|invalid|unable|failed|warning)\b|could not be applied|cannot be routed|returned no result|validation error/i.test((c.output || "").slice(0, 400)));
const gens = (run) => [...new Set(run.calls.filter((c) => !isRead(c) && !failed(c)).map((c) => {   // model · type · resolution · length asked, one per distinct creation call that went through
  const g = given(c), j = parse(c.output || "") || {};
  return [g.model, run.jobType[j.id] ? run.jobType[j.id].toLowerCase().replace(/_/g, "-") : g.model && /^create_(models_)?predictions$/.test(c.name) ? null : c.name, g.resolution, g.seconds].filter(Boolean).join(" · ");
}))];
const row = (run) => `<tr><td class="nw">${esc(run.label)}</td><td>${result(run)}</td><td class="nw">${gens(run).map(esc).join("<br>") || "—"}</td><td class="n">${run.seconds} s</td><td class="n">${esc(run.cost)}</td></tr>`;
// The pipeline: one line per tool call (what it was given, what came back), what it said mid-way and what the user answered, then
// the reply. Repeats of the same look-up are folded into one line; the prompt a creation call carried and the full texts are folded away.
const came = (c) => {
  if (c.error) {   // a protocol error carries { code, message }; a tool error carries the API's reply as text inside content[0]
    const e = parse(c.error), text = e?.message || e?.content?.[0]?.text || String(c.error);
    if (/timed out/i.test(text)) return { bad: true, text: `timed out${e?.code ? ` (${e.code})` : ""}` };
    const m = text.match(/'message': '([^']+)'/) || text.match(/"message":\s*"([^"]+)"/), http = text.match(/HTTP error (\d+)/);
    return { bad: true, text: noSig(`error${http ? ` ${http[1]}` : ""}: ${(m ? m[1] : text).slice(0, 160)}`) };
  }
  const out = c.output || "", j = parse(out);
  if (j?.workflow) return { text: `guide “${j.title || j.workflow}”${j.creation_tool ? `, points to ${j.creation_tool}` : ""}` };
  if (j?.error) return { bad: true, text: `error: ${typeof j.error === "string" ? j.error : j.error.message || JSON.stringify(j.error)}`.slice(0, 200) };
  if (typeof j?.status === "string") return { text: `${j.status}${j.downloads?.length ? `, ${j.downloads.length} download` : ""}` };
  if (j?.id && j.credits_charged !== undefined) return { text: `job created, ${num(j.credits_charged)} credits` };
  if (j && typeof j === "object") return { text: typeof j.job?.status === "string" ? j.job.status : "ok" };   // other structured data: the page does not print raw JSON
  const line = noSig(typeof j === "string" ? j : out).replace(/https?:\/\/\S+/g, "(link)").replace(/\b[A-Za-z0-9_-]{24,}\b/g, "…").replace(/\s+/g, " ").trim(), cut = line.length > 130 ? `${line.slice(0, 130).replace(/\s+\S*$/, "")}…` : line;
  return { bad: failed(c), text: cut || "ok" };
};
const SAID = { question: "It asked", approval: "It asked to go ahead", cannot: "It said it cannot", pending: "It said the file was not ready" };
const fold = (label, body) => `<details><summary>${label}</summary><p class="pre">${body}</p></details>`;
const callLine = (c, times) => {
  const g = given(c), r = came(c), what = isRead(c) ? [args(c).workflow, args(c).operation, g.model].filter(Boolean).join(" ") : [g.model, g.resolution, g.aspect, g.seconds, g.audio, g.refs].filter(Boolean).join(", ");
  return `<li><code>${esc(c.name)}</code>${times > 1 ? ` ×${times}` : ""}${what ? ` <span class="mut">${esc(what)}</span>` : ""} → <span${r.bad ? ' class="bad"' : ""}>${esc(r.text)}</span>${!isRead(c) && g.prompt ? fold("Prompt it wrote", esc(g.prompt)) : ""}</li>`;
};
const saidLines = (d) => [`<li>${SAID[d.asked?.[0]] || "It said"} → ${esc(firstLine(d.agent))}${fold("Full message", md(d.agent))}</li>`, `<li>User → ${esc(d.user)}</li>`];
const pipeline = (run) => `<p><b>${esc(run.label)}</b> ${result(run)}</p><ol>${run.turns.flatMap((T, ti) => {
  const D = (T.dialog || []).map((d) => ({ ...d, at: d.calls_before ?? T.calls.length })), lines = [];   // an older record has no position: its exchanges go after the calls
  T.calls.forEach((c, k) => {
    lines.push(...D.filter((d) => d.at === k).flatMap(saidLines));
    const nx = T.calls[k + 1], folds = nx && isRead(c) && isRead(nx) && nx.name === c.name && !D.some((d) => d.at === k + 1);   // fold a look-up into the next identical one
    if (folds) { nx._times = (c._times || 1) + 1; return; }
    lines.push(callLine(c, c._times || 1));
  });
  return [...(ti > 0 ? [`<li>User → ${esc(T.text)}</li>`] : []), ...lines, ...D.filter((d) => d.at >= T.calls.length).flatMap(saidLines),
    ...((T.denied || []).length ? [`<li class="bad">Refused by the free-plan gate: ${esc([...new Set(T.denied)].join("; ").slice(0, 400))}</li>`] : []),
    `<li>Reply → ${esc(firstLine(T.agent))}${fold("Full reply", md(T.agent))}</li>`];
}).join("")}${run.rec.error ? `<li class="bad">Run error: ${esc(run.rec.error.slice(0, 300))}</li>` : ""}</ol>${run.notes.length ? `<p class="mut notes">${run.notes.map((t) => `Note: ${esc(t)}`).join("<br>")}</p>` : ""}`;
const fileHtml = (f) => f.kind === "video" ? `<figure><video controls preload="metadata" poster="${src(f.poster)}" src="${src(f.name)}"></video><figcaption>${f.caption ? `${esc(f.caption)} · ` : ""}${f.width}×${f.height} · ${f.seconds.toFixed(1)} s</figcaption></figure>`
  : f.kind === "audio" ? `<figure><audio controls src="${src(f.name)}"></audio><figcaption>${f.seconds.toFixed(1)} s</figcaption></figure>` : `<figure><img src="${src(f.name)}" alt=""><figcaption>${f.width}×${f.height}</figcaption></figure>`;
const tally = (c) => (c?.checks?.length ? Object.fromEntries(["yes", "partly", "no"].map((k) => [k, c.checks.filter((x) => x.result === k).length])) : null);
const checklist = (c) => {
  const t = tally(c); if (!t) return "";
  return `<div><table><tr><th>Done</th><th>Wanted</th><th>Got</th></tr>${c.checks.map((x) => `<tr><td class="${DONE[x.result][1]}">${DONE[x.result][0]}</td><td>${esc(x.want)}</td><td>${esc(x.got)}</td></tr>`).join("")}</table>
<p class="mut">${t.yes} yes · ${t.partly} partly · ${t.no} no${c.by ? ` · ${esc(c.by)}` : ""}</p></div>`;
};
// The output: every run that made a file, or, when one service ran several times, its last run with a file.
const withFiles = runs.filter((r) => r.files.length), shown = withFiles.filter((r) => r === withFiles.filter((x) => x.service === r.service).at(-1));
const output = (run) => {
  const v0 = run.files.find((f) => f.kind === "video"), wide = !!v0 && v0.width > v0.height, frames = run.files.filter((f) => !f.step).flatMap((f) => f.frames || []);   // a landscape video sits above its checklist, a tall one beside it
  return `${runs.length > 1 ? `<p><b>${esc(run.label)}</b></p>` : ""}<div class="out${wide ? " wide" : ""}"><div>${run.files.map(fileHtml).join("")}</div>${checklist(run.checks)}</div>
${frames.length ? `<div class="frames${wide ? " wide" : ""}">${frames.map((f) => `<img loading="lazy" src="${src(f)}" alt="">`).join("")}</div><p class="mut">1 frame per second</p>` : ""}`;
};
const T0 = title || `${item.id}: ${item.case_name}`, m0 = runs[0].meta;
const sub = [`Driver ${first.model}`, runs.every((r) => r.service === runs[0].service) && m0.mcp ? `MCP ${m0.mcp.name} ${m0.mcp.version}` : null, new Date(first.started).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })].filter(Boolean).join(" · ");
const pic = (a) => VIDEO.test(a.name) ? `<video controls preload="metadata" src="${src(a.file)}#t=0.1" title="${esc(a.name)}"></video>` : `<a href="${src(a.file)}"><img src="${src(a.file)}" alt="${esc(a.name)}"></a>`;
const html = `${head(T0)}${nav(NAV, basename(OUT), "../")}<h1>${esc(T0)}</h1><p class="mut">${esc(sub)}</p>
<table><tr><th>${runs.some((r) => r.service !== runs[0].service) ? "Service" : "Run"}</th><th>Result</th><th>Generation</th><th class="n">Time</th><th class="n">Cost</th></tr>${runs.map(row).join("")}</table>
<h2>Input</h2><div class="in"><p class="brief">${esc(brief.text)}</p>${inputs.length ? `<p class="pics">${inputs.map(pic).join("")}</p>` : ""}</div>
<h2>Pipeline</h2>${runs.map(pipeline).join("")}
<h2>Output</h2>${shown.length ? shown.map(output).join("\n") : `<p class="mut">No file was made.</p>${checklist(runs.at(-1).checks)}`}</html>`;
writeFileSync(join(OUT, "index.html"), html);
// the index rows: one per service, its last run with a file (else its last run)
const services = [...new Set(runs.map((r) => r.service))];
writeFileSync(join(OUT, "summary.json"), JSON.stringify({ id: basename(OUT), case_name: item.case_name, title: T0, sub: `Driver ${first.model} · ${new Date(first.started).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
  rows: services.map((sv) => { const all = runs.filter((r) => r.service === sv), r = all.filter((x) => x.files.length).at(-1) || all.at(-1); return { service: sv, n: all.indexOf(r) + 1, runs: all.length, kind: r.kind, nudged: r.nudged, generation: gens(r), seconds: r.seconds, cost: r.cost, checks: tally(r.checks) }; }) }, null, 2));
console.log(`wrote ${join(OUT, "index.html")} · ${runs.map((r) => `${r.label}: ${r.kind}${r.nudged ? " (nudged)" : ""}, ${r.calls.length} calls, ${r.seconds} s, ${r.cost}, ${r.files.length} files${r.checks ? `, ${r.checks.checks.length} checks` : ""}`).join(" | ")}`);
