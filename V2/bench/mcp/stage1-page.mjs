// Stage 1 (existing assets) as one sendable page: the key numbers on top (pass rate at the user's 90% rule, points met, average
// score, credits), a summary table, then every item with every output file of both sides embedded (images as data URIs, three
// frames per video), the brief each side ran, and the intention judge's checklist with both sides' marks. Reads the other
// session's V4 runs (V4/runs/full-*), its judge cache (V4/runs/judge-stage1.json), the MCP stage-1 records
// (bench/v1/results/mcp-stage1); scores the D08 rerun (full-D08-v2) with the same judge prompt and caches it here.
// Usage: node V2/bench/mcp/stage1-page.mjs [--out V2/bench/v1/results/stage1-report] [--also V4/runs/judge-stage1.html]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../backend/lib/llm.js";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../.."), ROOT = join(V2, ".."), V4 = join(ROOT, "V4"), RUNS = join(V4, "runs"), ITEMS = join(V4, "tests/items");
const MS1 = join(V2, "bench/v1/results/mcp-stage1"), SESS = join(V2, "sessions"), TMP = join(SESS, "v4-report", "stage1-tmp");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", join(V2, "bench/v1/results/stage1-report")), ALSO = arg("--also", join(RUNS, "judge-stage1.html")); mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const J = (p) => JSON.parse(readFileSync(p, "utf8")), esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const dur = (f) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));
const dim = (f) => { try { return sh("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).trim().split("\n")[0].replace(",", "×"); } catch { return ""; } };
const IDS = ["D01", "D02", "D06", "D07", "D08", "E01"], CURRENT = { D08: "D08-v2" };   // the run that stands for the item now
const isVid = (f) => /\.mp4$/i.test(f);

// ---- embedding: every picture becomes a downsized JPEG data URI, every video three frames
function jpg(src, maxW, tag, t = null) {
  const out = join(TMP, `${tag}.jpg`);
  if (!existsSync(out)) execFileSync("ffmpeg", ["-v", "error", "-y", ...(t != null ? ["-ss", String(t)] : []), "-i", src, ...(t != null ? ["-frames:v", "1", "-update", "1"] : []), "-vf", `scale='min(${maxW},iw)':-2`, "-q:v", "5", out], { stdio: "ignore" });
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
}
const img = (src, maxW, tag, cls = "out") => `<img class="${cls}" src="${jpg(src, maxW, tag)}" alt="">`;
function video(src, tag) { const d = dur(src), ts = [0.5, d / 2, Math.max(0.6, d - 0.4)]; return `<div class="frames">${ts.map((t, i) => `<img src="${jpg(src, 420, `${tag}-f${i}`, t)}" alt=""><span>${t.toFixed(1)} s</span>`).join("")}</div>`; }
const fileBlock = (src, label, tag) => `<div class="file"><div class="cap">${esc(label)} · ${dim(src)}${isVid(src) ? ` · ${dur(src).toFixed(1)} s` : ""}</div>${isVid(src) ? video(src, tag) : img(src, 720, tag)}</div>`;

// ---- the records
const items = Object.fromEntries(IDS.map((id) => [id, J(join(ITEMS, `${id}.json`))]));
const full = (label) => J(join(RUNS, `full-${label}`, "run.json"));
const v4Files = (label) => readdirSync(join(RUNS, `full-${label}`)).filter((f) => /\.(png|jpg|jpeg|mp4)$/i.test(f) && !/^in-|^peek|\.card\.png$/.test(f)).sort().map((f) => join(RUNS, `full-${label}`, f));
const v4Inputs = (label) => readdirSync(join(RUNS, `full-${label}`)).filter((f) => /^in-.*\.(png|jpg|jpeg|mp4)$/i.test(f)).sort().map((f) => join(RUNS, `full-${label}`, f));
const mcpOf = (id) => { const m = J(join(MS1, `M${id}.json`)), T = m.turns[0], dir = join(SESS, m.session, "assets"), files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|mp4)$/i.test(f)).sort().map((f) => join(dir, f)) : []; const said = (T.agent || "").replace(/\]\(https?:[^)]*\)/g, "]"); return { m, T, files, said, spent: m.spent, calls: T.calls.filter((c) => !/^(get_|wait_|fetch_|list_|upload)/.test(c.name)).map((c) => { const a = typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments || {}; return `${c.name}${a.model ? ` (${a.model}${a.aspect_ratio ? `, ${a.aspect_ratio}` : ""})` : ""}${c.error ? " ✗" : ""}`; }) }; };
const judge = J(join(RUNS, "judge-stage1.json")), extraFile = join(OUT, "judge-extra.json"), extra = existsSync(extraFile) ? J(extraFile) : {};

// the D08 rerun, scored with the other session's own check prompt and the same checklist (cached here)
const CHECK = S.obj({ results: S.arr(S.obj({ point: S.str, met: S.enum(["yes", "partly", "no", "n/a"]), evidence: S.str })), overall: S.int });
async function score(id, label) {
  if (extra[label]) return extra[label];
  const pts = judge[id].checklist.points, files = v4Files(label), it = items[id];
  const imgs = files.flatMap((f) => (isVid(f) ? [0.5, dur(f) / 2, dur(f) - 0.4].map((t, i) => { const o = join(TMP, `j-${label}-${basename(f)}-${i}.jpg`); if (!existsSync(o)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", f, "-frames:v", "1", "-update", "1", o], { stdio: "ignore" }); return o; }) : [f])).slice(0, 12);
  const r = await jsonCall({ name: "v4-intent-check-v2", effort: "medium", images: imgs, schema: CHECK, prompt: `The ${imgs.length} image(s) are the finished output, several files, made for this request: "${it.full}".
For each point of the user's intention below, say whether the output meets it (use the measured facts above for sound and transitions instead of n/a) (yes / partly / no; n/a only if it cannot be judged from pictures, e.g. sound) with a few words of evidence. Then overall 0–100: how far this output is what this user wanted.
POINTS:\n${pts.map((p, i) => `${i + 1}. ${p.point}`).join("\n")}` });
  extra[label] = r; writeFileSync(extraFile, JSON.stringify(extra, null, 1)); return r;
}

// ---- measured corrections the judge could not make from stills (the user's rule: a point you cannot see is passed when measured)
function measured(id, side, results, files) {
  return results.map((r) => { if (r.met !== "n/a") return r;
    if (/\b5 seconds\b/i.test(r.point) && files.some(isVid)) { const d = dur(files.find(isVid)); const ok = Math.abs(d - 5) < 0.1; return { ...r, met: ok ? "yes" : "no", evidence: `measured with ffprobe: ${d.toFixed(3)} s` }; }
    return r; });
}
const share = (results) => { const c = { yes: 0, partly: 0, no: 0 }; for (const r of results) if (c[r.met] != null) c[r.met]++; const n = c.yes + c.partly + c.no; return { ...c, n, pct: n ? Math.round(((c.yes + 0.5 * c.partly) / n) * 100) : 0 }; };
const PASS = 90;

// ---- per item
const rows = [];
for (const id of IDS) {
  const it = items[id], label = CURRENT[id] || id, f = full(label), fOld = CURRENT[id] ? full(id) : null, files = v4Files(label), ins = v4Inputs(id), M = mcpOf(id), pts = judge[id].checklist.points;
  const v4r = CURRENT[id] ? await score(id, label) : judge[id].v4, mcpr = judge[id].mcp;
  const v4res = measured(id, "v4", v4r.results, files), mcpres = measured(id, "mcp", mcpr.results, M.files), sv = share(v4res), sm = share(mcpres);
  const tool = f.turns.at(-1)?.intent?.tool, steps = (f.result?.campaign || []).map((s) => `${s.tool} (${s.credits} cr)`).join(" → ");
  rows.push({ id, it, f, fOld, label, files, ins, M, pts, v4r, mcpr, v4res, mcpres, sv, sm, tool, steps });
}
const tot = (side) => { const xs = rows.map((r) => (side === "v4" ? { s: r.sv, overall: r.v4r.overall, credits: r.f.credits || 0, made: r.files.length > 0 } : { s: r.sm, overall: r.mcpr.overall, credits: r.M.spent || 0, made: r.M.files.length > 0 })); const yes = xs.reduce((a, x) => a + x.s.yes, 0), partly = xs.reduce((a, x) => a + x.s.partly, 0), no = xs.reduce((a, x) => a + x.s.no, 0); return { pass: xs.filter((x) => x.s.pct >= PASS).length, pts: Math.round(xs.reduce((a, x) => a + x.s.pct, 0) / xs.length), score: Math.round(xs.reduce((a, x) => a + x.overall, 0) / xs.length), credits: xs.reduce((a, x) => a + x.credits, 0), made: xs.filter((x) => x.made).length, yes, partly, no }; };
const TV = tot("v4"), TM = tot("mcp"), N = rows.length;
const kpi = (title, t) => `<div class="kpi"><h3>${title}</h3><div class="big">${t.pass} of ${N}</div><div class="lbl">items passing (≥ ${PASS}% of the user's points met)</div><div class="line"><span><b>${t.pts}%</b> points met on average</span><span><b>${t.score}</b> average judge score</span></div><div class="line"><span><b>${t.credits}</b> credits in all, <b>${Math.round(t.credits / N)}</b> per item</span><span><b>${t.made} of ${N}</b> made something</span></div><div class="line mut">${t.yes} yes · ${t.partly} partly · ${t.no} no across ${t.yes + t.partly + t.no} points</div></div>`;
const mk = (m) => `<span class="b ${m === "yes" ? "ok" : m === "partly" ? "mid" : m === "no" ? "bad" : "na"}">${esc(m)}</span>`;
const passTag = (s) => `<span class="pass ${s.pct >= PASS ? "ok" : "bad"}">${s.pct >= PASS ? "pass" : "fail"} · ${s.pct}%</span>`;
const NOTES = {
  D01: "Both outputs measure exactly 5.000 s, so the trim point the judge could not see is passed for both. The MCP's only route was a regenerating video edit and no frame carries the caption; V4 cut with ffmpeg and overlaid the words by code.",
  D07: "Both sides ran the brief shown (the whole poster kept with padding, no regeneration). V4's rule chose reflow on the free image editor: the square is a faithful re-layout, the 9:16 sits between dark bars, the 16:9 is redrawn canyon art with the words kept. The item's text was rewritten after the run to ask for each size to fill its frame with no bars, and the judge's checklist came from that text, so its marks dock V4 for the padding the run was asked for. The MCP refused and offered a script.",
  D08: "The first run's poster was a typeset page: the sheet's default look was 'clean, bold, high-contrast typography', which neither brief asked for. The rule was changed the same hour (a poster must be designed, never a 'clean, simple' default) and the item rerun; the rerun is what is scored here, the first run is kept below it.",
};
const summary = `<table class="sum"><tr><th>item</th><th>brief</th><th>V4</th><th>score</th><th>credits</th><th>MCP</th><th>score</th><th>credits</th></tr>${rows.map((r) => `<tr><td><a href="#${r.id}">${r.id}</a></td><td>${esc(r.it.title)}</td><td>${passTag(r.sv)}</td><td>${r.v4r.overall}</td><td>${r.f.credits || 0}</td><td>${r.M.files.length ? passTag(r.sm) : `<span class="pass bad">refused · 0%</span>`}</td><td>${r.mcpr.overall}</td><td>${r.M.spent || 0}</td></tr>`).join("")}</table>`;
const itemHtml = rows.map((r) => `<section class="item" id="${r.id}"><h2>${r.id} · ${esc(r.it.title)} <span class="tags">V4 ${passTag(r.sv)} MCP ${r.M.files.length ? passTag(r.sm) : `<span class="pass bad">refused</span>`}</span></h2>
<div class="brief"><b>The brief, as both sides ran it:</b> ${esc(r.f.brief)}${r.it.full !== r.f.brief ? `<br><b>The item's text now reads:</b> ${esc(r.it.full)} <span class="mut">(rewritten after the run; the checklist below came from this text)</span>` : ""}${r.ins.length ? `<div class="ins">${r.ins.map((x, i) => (isVid(x) ? `<img src="${jpg(x, 240, `${r.id}-in${i}`, 0.5)}" alt="">` : `<img src="${jpg(x, 240, `${r.id}-in${i}`)}" alt="">`)).join("")}<span class="mut">supplied</span></div>` : ""}</div>
${NOTES[r.id] ? `<p class="note">${esc(NOTES[r.id])}</p>` : ""}
<div class="two">
<div class="side"><h3>V4 <span class="mut">· ${esc(r.tool)}${r.steps ? ` · ${esc(r.steps)}` : ""}${r.f.result?.strategy ? ` · strategy: ${esc(r.f.result.strategy)}` : ""} · ${r.f.credits || 0} credits · judge ${r.v4r.overall}</span></h3><div class="files">${r.files.map((x, i) => fileBlock(x, basename(x) + (basename(x) === r.f.result?.file ? " · delivered" : ""), `${r.label}-${i}`)).join("") || "<div class=none>nothing made</div>"}</div>
${r.fOld ? `<details><summary>the first run, before the design rule (${r.fOld.credits} credits, judge ${judge[r.id].v4.overall})</summary><div class="files">${v4Files(r.id).map((x, i) => fileBlock(x, basename(x), `${r.id}-old-${i}`)).join("")}</div></details>` : ""}</div>
<div class="side"><h3>MCP <span class="mut">· ${r.M.calls.length ? esc(r.M.calls.join(" → ")) : "no creation call"} · ${r.M.spent || 0} credits · judge ${r.mcpr.overall}</span></h3><div class="files">${r.M.files.map((x, i) => fileBlock(x, basename(x), `${r.id}-mcp-${i}`)).join("") || `<div class="none">nothing made</div><div class="said">${esc(r.M.said.slice(0, 700))}${r.M.said.length > 700 ? " …" : ""}</div>`}</div></div>
</div>
<table class="pts"><tr><th>the user's intention (from their own words)</th><th>from</th><th>V4</th><th>MCP</th></tr>${r.pts.map((p, i) => `<tr><td>${esc(p.point)}</td><td class="mut">${esc(p.from)}</td><td>${mk(r.v4res[i]?.met)} <span class="mut">${esc(r.v4res[i]?.evidence)}</span></td><td>${mk(r.mcpres[i]?.met)} <span class="mut">${esc(r.mcpres[i]?.evidence)}</span></td></tr>`).join("")}</table>
</section>`).join("");

const TITLE = "Stage 1, existing assets: V4 against the Magic Hour MCP";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(TITLE)}</title><style>
:root{--bg:#f6f5f2;--fg:#1c1a17;--mut:#6f6a62;--line:#e3dfd7;--card:#fff;--ok:#1d7a3d;--bad:#b3261e;--mid:#9a6b00;--na:#8a8a8a;--acc:#2f5d8a}
body{background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,"Segoe UI",Inter,system-ui,sans-serif;margin:0;padding:24px 20px;max-width:1280px;margin-inline:auto}
h1{font-size:24px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:17px;margin:0 0 6px}h3{font-size:14px;margin:0 0 6px}.mut{color:var(--mut);font-size:12.5px;font-weight:400}.sub{color:var(--mut);font-size:13px;margin:0 0 14px}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}.kpi h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0 0 4px}.big{font-size:34px;font-weight:700;line-height:1.1}.lbl{color:var(--mut);font-size:12.5px;margin-bottom:8px}.line{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;margin:3px 0}
table{border-collapse:collapse;width:100%;font-size:13px;background:var(--card)}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px}.sum{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:10px 0 18px}
.item{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:16px 0}.tags{font-size:12px;font-weight:400;margin-left:8px}.brief{background:var(--bg);border-left:3px solid #cfc9bf;padding:8px 12px;margin:8px 0;font-size:13.5px}.note{background:#fff8e6;border-left:3px solid #e0a800;padding:8px 12px;margin:8px 0;font-size:13px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:10px 0}@media(max-width:860px){.two,.kpis{grid-template-columns:1fr}}.side{min-width:0}.files{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.file{min-width:160px;max-width:100%}.cap{color:var(--mut);font-size:11.5px;margin-bottom:3px}img.out{max-width:100%;max-height:360px;border:1px solid var(--line);border-radius:6px;display:block}.frames{display:flex;gap:6px}.frames img{width:32%;max-width:300px;border:1px solid var(--line);border-radius:6px}.frames span{display:none}.ins{margin-top:6px}.ins img{height:80px;border:1px solid var(--line);border-radius:4px;margin-right:6px;vertical-align:middle}
.none{color:var(--mut);font-style:italic;padding:10px;border:1px dashed #ccc;border-radius:6px}.said{white-space:pre-wrap;font-size:12px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;margin-top:6px;max-height:260px;overflow:auto}
.b{display:inline-block;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:600;color:#fff;margin-right:4px}.b.ok{background:var(--ok)}.b.bad{background:var(--bad)}.b.mid{background:var(--mid)}.b.na{background:var(--na)}.pass{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:600;color:#fff}.pass.ok{background:var(--ok)}.pass.bad{background:var(--bad)}
.pts td:first-child{width:36%}details{margin:8px 0;font-size:13px}summary{cursor:pointer;color:var(--acc)}footer{color:var(--mut);font-size:12px;margin:20px 0}
</style></head><body>
<h1>${esc(TITLE)}</h1>
<p class="sub">Six briefs that start from the user's own files (a clip to trim and caption, two clips to join, a photo to warm, a poster to resize, a poster to make, four clips to edit with music and a title), given in full to both: V4, the small agent (intent sheet, code tools, one call, a review), and the Magic Hour MCP in a chat client with the free plan as a gate. An LLM wrote each user's intention as a checklist from the user's own words; a vision judge checked every output against every point. Pass = at least ${PASS}% of the points met (yes counts 1, partly ½). Built ${new Date().toISOString().slice(0, 10)}.</p>
<div class="kpis">${kpi("V4", TV)}${kpi("MCP", TM)}</div>
${summary}
${itemHtml}
<footer>Scores and point marks are the recorded judge's (V4/runs/judge-stage1.json), except: the D08 rerun scored with the same judge prompt and checklist; D01's trim point measured with ffprobe where the judge could only say n/a. Every output file of both sides is shown; videos as three frames each. Credits are Magic Hour credits at free-plan models. Page by V2/bench/mcp/stage1-page.mjs.</footer>
</body></html>`;
writeFileSync(join(OUT, "index.html"), html); if (ALSO) writeFileSync(ALSO, html);
console.log(`${OUT}/index.html (${(html.length / 1024 / 1024).toFixed(2)} MB)${ALSO ? ` and ${ALSO}` : ""}`);
console.log(`V4: pass ${TV.pass}/${N}, points ${TV.pts}%, score ${TV.score}, credits ${TV.credits} · MCP: pass ${TM.pass}/${N}, points ${TM.pts}%, score ${TM.score}, credits ${TM.credits}`);
for (const r of rows) console.log(`${r.id}: V4 ${r.sv.pct}% (${r.v4r.overall}) ${r.f.credits || 0} cr · MCP ${r.sm.pct}% (${r.mcpr.overall}) ${r.M.spent || 0} cr`);
