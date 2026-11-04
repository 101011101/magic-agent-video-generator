// Builds V4/runs/report.html from the run records. Reads only; writes the one page.
import fs from "node:fs";
import path from "node:path";

const R = "/Users/arviny/Downloads/Code/magic-agent-video-generator";
const OUT = path.join(R, "V4/runs/report.html");
const j = (p) => JSON.parse(fs.readFileSync(path.join(R, p), "utf8"));
const exists = (p) => fs.existsSync(path.join(R, p));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (x) => (x == null || Number.isNaN(x) ? "—" : (Math.round(x * 10) / 10).toLocaleString("en-US"));
const n0 = (x) => (x == null || Number.isNaN(x) ? "—" : Math.round(x).toLocaleString("en-US"));
const mtime = (p) => (exists(p) ? fs.statSync(path.join(R, p)).mtimeMs / 1000 : null);

const SIMPLE = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "V01", "V02"];

// ---------- V4 records ----------
function v4(id) {
  const d = `V4/runs/full-${id}`;
  if (!exists(d + "/run.json")) return { id, missing: true };
  const r = j(d + "/run.json");
  const wall = r.finished && r.at ? (new Date(r.finished) - new Date(r.at)) / 1000 : null;
  const last = r.turns.at(-1);
  const jobs = Object.entries(r.jobs || {}).map(([k, v]) => ({ key: k, model: v.model, credits: v.credits, seconds: v.seconds, inputs: v.inputs || [] }));
  return {
    id, dir: d, brief: r.brief, credits: r.credits, at: r.at, finished: r.finished, wall,
    tool: last.intent.tool, tier: last.intent.tier, params: last.intent.params || [],
    out: r.result?.file || r.result?.film, review: r.result?.review, clips: r.result?.clips, narration: r.result?.narration,
    jobs, calls: r.calls || [], attachments: r.attachments || [], raw: r,
    models: [...new Set(jobs.map((x) => x.model).filter((m) => m && m !== last.intent.tool))].join(" + "),
    jobSeconds: jobs.reduce((a, x) => a + (x.seconds || 0), 0),
  };
}
const V4 = Object.fromEntries([...SIMPLE, "V03", "B01", "B02", "B03", "S10-v1"].map((id) => [id, v4(id)]));

// ---------- MCP records ----------
function parseArgs(a) { if (!a) return {}; if (typeof a === "string") { try { return JSON.parse(a); } catch { return {}; } } return a; }
function mcp(file) {
  if (!exists(file)) return { missing: true, file };
  const r = j(file); const t = r.turns?.[0] || {};
  const calls = (t.calls || []).map((c) => ({ name: c.name, a: parseArgs(c.arguments) }));
  const gen = calls.filter((c) => !/^(wait_|get_|upload|list_|create_project|get_workflow)/.test(c.name));
  const assets = exists(`V2/${r.sessionDir}/assets`) ? fs.readdirSync(path.join(R, "V2", r.sessionDir, "assets")) : [];
  return {
    id: r.item || path.basename(file, ".json"), spent: r.spent, seconds: r.seconds, sessionDir: r.sessionDir, kind: t.kind,
    calls, gen, dialog: t.dialog || [], agent: t.agent || "", assets,
    tools: gen.map((c) => c.name).join(" + ") || "—",
    models: [...new Set(gen.map((c) => c.a.model || c.a.style?.model).filter(Boolean))].join(" + "),
    out: assets.filter((f) => !f.endsWith(".wav")).at(-1) || null,
    rel: (f) => `../../V2/${r.sessionDir}/assets/${f}`,
  };
}
const MCP = {};
for (const id of SIMPLE) MCP[id] = mcp(`V2/bench/v1/results/mcp-v4/M${id}.json`);
MCP.V03 = mcp("V2/bench/v1/results/mcp-v4/MV03.json");
MCP.B02 = mcp("V2/bench/v1/results/mcp-barber/MB02.json");
MCP.B03 = mcp("V2/bench/v1/results/mcp-barber/MB03.json");

const VERD = j("V4/runs/compare-verdicts.json");
const BSC = j("V4/runs/barber-scores.json");
const EVALS = j("V4/runs/transcript-evals.json");
const ITEMS = Object.fromEntries(SIMPLE.map((id) => [id, j(`V4/tests/items/${id}.json`)]));
const DRY = Object.fromEntries(SIMPLE.map((id) => [id, j(`V4/runs/dry-${id}/run.json`)]));
const STORY = j("V4/tests/barber-story.json");

// ---------- tallies ----------
const verdictOf = (id) => (id === "S07" ? { winner_side: "V4", strength: "by default", why: "The MCP has no trim tool and made nothing; it printed an ffmpeg command for the user to run." } : VERD[id]);
const tally = { V4: 0, MCP: 0, tie: 0 };
for (const id of SIMPLE) tally[verdictOf(id).winner_side]++;

const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const v4SimpleCredits = sum(SIMPLE, (id) => (id === "S10" ? V4["S10-v1"] : V4[id]).credits);
const v4SimpleWall = sum(SIMPLE, (id) => (id === "S10" ? V4["S10-v1"] : V4[id]).wall);
const mcpSimpleCredits = sum(SIMPLE, (id) => MCP[id].spent);
const mcpSimpleSeconds = sum(SIMPLE, (id) => MCP[id].seconds);

// V03 timing: run.json has no `finished`; the final pass is `at` → run.json mtime.
const v03Start = Date.parse(V4.V03.at) / 1000;
const v03End = mtime("V4/runs/full-V03/run.json");
const v03FinalPassWall = v03End - v03Start;
const v03Calls = V4.V03.calls;
const v03FirstPassCrash = Date.parse(v03Calls.find((c) => c.error)?.at || 0) / 1000;
const v03FirstPassFirst = Date.parse(v03Calls[0].at) / 1000 - (v03Calls[0].seconds || 0);
const v03FirstPassWall = v03FirstPassCrash - v03FirstPassFirst;
const v03ClipCredits = v03Calls.filter((c) => c.credits).map((c) => `${c.key} ${c.credits}`).join(", ");
const v03CreditsPass1 = 1090, v03CreditsPass2 = V4.V03.credits - 1090;

const barberV4 = V4.B02.credits + V4.B03.credits;
const barberMCP = MCP.B02.spent + MCP.B03.spent;
const barberMCPsec = MCP.B02.seconds + MCP.B03.seconds;
const barberV4wall = V4.B02.wall + V4.B03.wall;

const totalV4 = v4SimpleCredits + V4.S10.credits + V4.V03.credits + V4.B01.credits + barberV4;
const totalMCP = mcpSimpleCredits + MCP.V03.spent + barberMCP;
const totalV4wall = v4SimpleWall + V4.S10.wall + v03FinalPassWall + V4.B01.wall + barberV4wall;
const totalMCPsec = mcpSimpleSeconds + MCP.V03.seconds + barberMCPsec;

// ---------- intent test (MCP given the vague briefs) ----------
const INTENT_DIR = "V2/bench/v1/results/mcp-intent";
const intentFiles = exists(INTENT_DIR) ? fs.readdirSync(path.join(R, INTENT_DIR)).filter((f) => /^I.*\.json$/.test(f)) : [];
const INTENT = {};
for (const f of intentFiles) {
  const r = j(`${INTENT_DIR}/${f}`);
  const turns = r.turns || [];
  const attempts = [];
  const dialog = [];
  for (const t of turns) {
    for (const d of [...(t.denied || []), ...(t.approvals || [])]) {
      const a = parseArgs(d.args ?? d.arguments ?? d.call?.arguments ?? d.call?.args);
      attempts.push({ name: d.name || d.tool || d.call?.name, a });
    }
    for (const d of t.dialog || []) dialog.push(d);
  }
  const id = f.replace(/\.json$/, "").replace(/^I/, "").replace(/^M?/, "");
  INTENT[id.replace(/^I/, "")] = { file: f, attempts, dialog, agent: turns.at(-1)?.agent || "", spent: r.spent, raw: r };
}

// expectations derived from the item's answer sheet
const EXPECT = {
  S01: { aspect: ["16:9"] }, S02: { aspect: ["1:1", "4:5"] },
  S03: { aspect: ["3:4", "2:3", "9:16"], words: ["Open Mic Night", "Friday 7pm", "The Blue Door"] },
  S04: { aspect: ["1:1", "4:5"], words: ["20% OFF", "This weekend only"] },
  S05: {}, S06: {}, S07: { range: "0–6" }, S08: {},
  S09: { seconds: 6, sound: "silent" }, S10: { aspect: ["16:9"], seconds: 10, sound: "silent" },
  S11: { aspect: ["16:9"] }, V01: { aspect: ["9:16"], seconds: 10, sound: "on" }, V02: { aspect: ["1:1"], seconds: 6, sound: "silent" },
};
const mark = (ok) => (ok === null ? `<span class="na">n/a</span>` : ok === "part" ? `<span class="mid">partly</span>` : ok ? `<span class="ok">yes</span>` : `<span class="bad">no</span>`);
const wordsIn = (words, text) => (words || []).every((w) => (text || "").includes(w));

function v4Sheet(id) {
  const r = DRY[id]; const p = Object.fromEntries((r.turns.at(-1).intent.params || []).map((x) => [x.name, x]));
  const E = EXPECT[id]; const get = (k) => p[k]?.value;
  const aspect = E.aspect ? (get("aspect") ? E.aspect.includes(get("aspect")) : false) : null;
  const words = E.words ? wordsIn(E.words, get("exact_words")) : null;
  const seconds = E.seconds != null ? Number(get("seconds")) === E.seconds : E.range ? /0.?[–-].?6/.test(get("range") || "") : null;
  const sound = E.sound ? (E.sound === "silent" ? get("sound") === "none" : !!get("sound") && get("sound") !== "none") : null;
  const asked = r.turns.flatMap((t) => (t.asked || []).map((q) => q.question));
  return { aspect, words, seconds, sound, asked, params: r.turns.at(-1).intent.params || [], tool: r.turns.at(-1).intent.tool, messages: r.messages, say: r.turns.at(-1).say, aspectVal: get("aspect") || (E.aspect ? "not in sheet" : "") };
}
function mcpSheet(id) {
  const I = INTENT[id]; if (!I) return null;
  const E = EXPECT[id]; const a = I.attempts[0]?.a || {}; const prompt = a.style?.prompt || a.prompt || "";
  const aspect = E.aspect ? (a.aspect_ratio ? E.aspect.includes(a.aspect_ratio) : false) : null;
  const words = E.words ? wordsIn(E.words, prompt) : null;
  const seconds = E.seconds != null ? Number(a.end_seconds) === E.seconds : E.range ? (I.attempts.length ? /0.?[–-].?6|6 ?s/.test(prompt) : false) : null;
  const sound = E.sound ? (E.sound === "silent" ? a.audio === false : a.audio === true) : null;
  return { aspect, words, seconds, sound, asked: I.dialog.map((d) => d.agent), attempts: I.attempts, dialog: I.dialog, agent: I.agent, a, prompt, tool: I.attempts[0]?.name || "(no call attempted)", aspectVal: a.aspect_ratio || (E.aspect ? "not set" : "") };
}

// ---------- media helpers ----------
const isVid = (f) => /\.mp4$/i.test(f || "");
const media = (src, { w = 320, alt = "" } = {}) => !src ? `<div class="none" style="width:${w}px">no file</div>` :
  isVid(src) ? `<video controls preload="metadata" style="width:${w}px;max-width:100%" src="${esc(src)}"></video>` :
    `<img data-zoom src="${esc(src)}" alt="${esc(alt)}" style="width:${w}px;max-width:100%" loading="lazy">`;
const v4Out = (id) => (V4[id].out ? `${V4[id].dir.replace("V4/runs/", "")}/${V4[id].out}` : null);
const mcpOut = (id) => (MCP[id].out ? MCP[id].rel(MCP[id].out) : null);

const bubbles = (msgs) => `<div class="chat">${msgs.map((m) => `<div class="msg ${m.role === "user" ? "u" : "a"}"><span class="who">${m.role === "user" ? "user (proxy)" : "agent"}</span>${esc(m.text)}</div>`).join("")}</div>`;
const sheetTable = (params) => `<table class="sheet"><tbody>${params.map((p) => `<tr><td class="k">${esc(p.name)}</td><td>${esc(p.value)}</td><td class="src ${esc(p.source)}">${esc(p.source)}</td></tr>`).join("")}</tbody></table>`;

// ---------- HTML ----------
let H = "";
const sec = (id, title, body) => { H += `<section id="${id}"><h2>${title}</h2>${body}</section>`; };

const css = `
:root{--bg:#f7f6f2;--fg:#1b1a17;--mut:#6a665e;--line:#dedad1;--card:#ffffff;--acc:#2b5f8e;--ok:#1b7a3c;--bad:#b02a22;--mid:#8f6400;--hl:#fff6dc;--hlb:#e2c36a;color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14130f;--fg:#ebe6dc;--mut:#a49d91;--line:#2c2922;--card:#1c1a15;--acc:#8db6e6;--ok:#5cc27d;--bad:#f0776d;--mid:#e2b54d;--hl:#2a2410;--hlb:#6e5a1c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14130f;--fg:#ebe6dc;--mut:#a49d91;--line:#2c2922;--card:#1c1a15;--acc:#8db6e6;--ok:#5cc27d;--bad:#f0776d;--mid:#e2b54d;--hl:#2a2410;--hlb:#6e5a1c;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px max(16px,env(safe-area-inset-right)) 60px max(16px,env(safe-area-inset-left))}
main{max-width:1400px;margin:0 auto}h1{font-size:22px;margin:0 0 6px}h2{font-size:18px;margin:38px 0 10px;padding-top:12px;border-top:2px solid var(--line)}h3{font-size:14.5px;margin:18px 0 6px}
p{margin:6px 0;max-width:90ch}.mut{color:var(--mut);font-size:12.5px}a{color:var(--acc)}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}td,th{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600}td.n,th.n{text-align:right}tfoot td{font-weight:600}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.mid{color:var(--mid);font-weight:600}.na{color:var(--mut)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}
.grid{display:grid;gap:12px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:1000px){.g3,.g4{grid-template-columns:1fr 1fr}}@media(max-width:640px){.g2,.g3,.g4{grid-template-columns:1fr}}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(680px,1fr));gap:12px}@media(max-width:720px){.items{grid-template-columns:1fr}}
.pair{display:flex;gap:12px;flex-wrap:wrap}.pair>div{flex:1 1 300px;min-width:0}.pair figcaption,.cap{font-size:12px;color:var(--mut);margin-top:4px}
img,video{display:block;border-radius:6px;background:#000;border:1px solid var(--line)}img[data-zoom]{cursor:zoom-in}.none{display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;border:1px dashed var(--line);border-radius:6px;color:var(--mut);font-size:12px}
.frames{display:flex;gap:6px;flex-wrap:wrap}.frames figure{margin:0}.frames img{width:170px}
.hl{background:var(--hl);border:1px solid var(--hlb)}
.chat{display:flex;flex-direction:column;gap:6px;margin:8px 0}.msg{max-width:78%;padding:7px 11px;border-radius:12px;font-size:13px;position:relative}.msg .who{display:block;font-size:10.5px;color:var(--mut);margin-bottom:2px}.msg.a{align-self:flex-start;background:var(--card);border:1px solid var(--line);border-bottom-left-radius:3px}.msg.u{align-self:flex-end;background:var(--acc);color:#fff;border-bottom-right-radius:3px}.msg.u .who{color:rgba(255,255,255,.75)}
.sheet{font-size:12px}.sheet td.k{color:var(--mut);white-space:nowrap}.sheet td.src{font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--mut)}.sheet td.src.user{color:var(--ok)}.sheet td.src.default{color:var(--mid)}.sheet td.src.missing{color:var(--bad)}
pre{white-space:pre-wrap;font-size:11.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px;max-height:260px;overflow:auto;margin:6px 0}
.pending{border:1px dashed var(--mid);color:var(--mid);padding:8px 12px;border-radius:8px;font-weight:600}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:12px 0}.kpi div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.kpi b{display:block;font-size:20px;font-variant-numeric:tabular-nums}.kpi span{font-size:12px;color:var(--mut)}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:9;cursor:zoom-out}#lb img{max-width:96vw;max-height:92vh;object-fit:contain;border:0}#lb.on{display:flex}
nav.toc{font-size:12.5px;color:var(--mut)}nav.toc a{margin-right:10px}
`;

// 1. Headline
{
  const body = `
<p>Two agents given the same briefs and the same attachments on Magic Hour's free tier (480p / 640px). <b>V4</b> is our agentic pipeline (intake sheet, deterministic guards, one call per clip, VLM review, ffmpeg tools, TTS). <b>MCP</b> is a stock GPT chat model (${esc(j("V2/bench/v1/results/mcp-v4/run.json").model || "gpt")}) with only Magic Hour's MCP tools. Everything on this page is computed from the run records; file paths are given so each number can be checked.</p>
<nav class="toc"><a href="#structural">1b structural differences</a><a href="#intent">1 vague user</a><a href="#simple">2 thirteen briefs</a><a href="#s10">3 S10 three ways</a><a href="#zoo">4 the zoo ad</a><a href="#barber">5 the barber</a><a href="#cost">6 time and cost</a><a href="#method">7 method</a></nav>
<div class="kpi">
 <div><b>V4 ${tally.V4} · MCP ${tally.MCP} · tie ${tally.tie}</b><span>13 simple briefs, pairwise VLM verdict, before the S10 fix (V4's five include S07 by default: the MCP cannot trim)</span></div>
 <div><b>S10: fixed</b><span>rerun under the two-reference rule produced the clip the MCP made first time (minimax-h3, car and bridge as named references), 240 cr</span></div>
 <div><b>Zoo ad: V4</b><span>four calls, exact end card, full 39 s narration vs one 45 s call with a garbled card and 9 s of speech</span></div>
 <div><b>Barber: MCP informed 81 vs V4 informed 58</b><span>video-as-reference beat last-frame start; blind arms tied at 38</span></div>
 <div><b>${n0(totalV4)} cr · ${n0(totalV4wall)} s</b><span>V4 credits and wall time across everything on this page (incl. S10 rerun, the zoo's 720 cr overspend, the shared barber seed)</span></div>
 <div><b>${n0(totalMCP)} cr · ${n0(totalMCPsec)} s</b><span>MCP credits (account balance deltas) and wall time end to end incl. its own polling</span></div>
</div>
<table><thead><tr><th>Block</th><th class="n">V4 credits</th><th class="n">V4 wall s</th><th class="n">MCP credits</th><th class="n">MCP wall s</th><th>Verdict</th></tr></thead><tbody>
<tr><td>13 simple briefs (first pass; S10 = start-frame run)</td><td class="n">${n0(v4SimpleCredits)}</td><td class="n">${n0(v4SimpleWall)}</td><td class="n">${n0(mcpSimpleCredits)}</td><td class="n">${n0(mcpSimpleSeconds)}</td><td>V4 ${tally.V4} · MCP ${tally.MCP} · tie ${tally.tie}</td></tr>
<tr><td>S10 rerun, two references</td><td class="n">${n0(V4.S10.credits)}</td><td class="n">${n0(V4.S10.wall)}</td><td class="n">—</td><td class="n">—</td><td>by eye: the car crosses the bridge, same mechanism as the MCP's</td></tr>
<tr><td>Zoo ad (V03)</td><td class="n">${n0(V4.V03.credits)}</td><td class="n">${n0(v03FinalPassWall)}<sup>*</sup></td><td class="n">${n0(MCP.V03.spent)}</td><td class="n">${n0(MCP.V03.seconds)}</td><td>V4 on lettering, narration, three distinct scenes; MCP's lions the better shot</td></tr>
<tr><td>Barber seed (B01, shared by both sides)</td><td class="n">${n0(V4.B01.credits)}</td><td class="n">${n0(V4.B01.wall)}</td><td class="n">—</td><td class="n">—</td><td></td></tr>
<tr><td>Barber continuations (informed + blind)</td><td class="n">${n0(barberV4)}</td><td class="n">${n0(barberV4wall)}</td><td class="n">${n0(barberMCP)}</td><td class="n">${n0(barberMCPsec)}</td><td>informed: MCP 81 / V4 58 · blind: 38 / 38</td></tr>
</tbody><tfoot><tr><td>Total</td><td class="n">${n0(totalV4)}</td><td class="n">${n0(totalV4wall)}</td><td class="n">${n0(totalMCP)}</td><td class="n">${n0(totalMCPsec)}</td><td></td></tr></tfoot></table>
<p class="mut"><sup>*</sup> The zoo's run.json has no <code>finished</code> stamp; ${n0(v03FinalPassWall)} s is the final (four-call) pass from its <code>at</code> to the record's write time. The two earlier passes are not timed end to end in the record (the first crashed on an HTTP 502 at clip 3 after about ${n0(v03FirstPassWall)} s). See section 6.</p>`;
  sec("head", "V4 vs the Magic Hour MCP", body);
  H = H.replace("<h2>V4 vs the Magic Hour MCP</h2>", "<h1>V4 vs the Magic Hour MCP</h1><p class=\"mut\">Generated " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC from V4/runs/full-*/run.json, V4/runs/dry-*/run.json, V2/bench/v1/results/mcp-v4, mcp-barber, mcp-intent, compare-verdicts.json, barber-scores.json.</p>");
}

// 1b. Structural differences
{
  const intentNote = intentFiles.length
    ? `In the MCP intent run (${intentFiles.length} of 13 items recorded) it asked a question in ${Object.values(INTENT).filter((x) => x.dialog.length).length} items and attempted a paid call straight from the one-liner in ${Object.values(INTENT).filter((x) => x.attempts.length && !x.dialog.length).length}.`
    : `The MCP intent run (the same vague briefs, paid calls gated) had not written its records when this page was built; the one MCP conversation on record is the barber, where it asked one question and then went ahead on “your call”.`;
  const rows = [
    ["Anything after the generation: trim, join, overlay, voice, mix",
      `S07 “trim to 6 s”: V4 ran ffmpeg (0 cr, ${n1(V4.S07.wall)} s); the MCP made nothing and printed an ffmpeg command for the user to run. Zoo end card and offer line: ours is a qwen still carried into its own 5 s clip, lettering exact; theirs is asked for “EXACTLY” inside a 45 s video prompt and comes out as “Rigedvew Zoo / Opdeiiew Zo”.`,
      `<a href="#simple">S07 card</a> · <a href="#zoo">end cards at 43 s</a> · <a href="zoo.html">zoo.html</a> · <a href="compare-mcp.html">compare-mcp.html</a>`, "already does", "ok"],
    ["Narration longer than a sentence",
      `Zoo: V4 speaks the whole ${n1(V4.V03.narration?.seconds)} s script as TTS mixed under the joined film; the MCP's single ltx-2.5 call compresses four timed voice-over lines into about 9 s of speech at the start, then silence (transcripts in V4/RESULTS.md and <a href="#zoo">section 4</a>).`,
      `<a href="#zoo">narration transcripts</a> · full-V03/narration.mp3 · V2/sessions/mcp-mv4-MV03/assets`, "already does", "ok"],
    ["Several distinct scenes in order",
      `Zoo: four calls kept lions, penguins, giraffe and card separate; the MCP's one 45 s call double-exposed penguins and a giraffe at 27 s and folded the third scene into the second. The MCP's lions remain the better single shot.`,
      `<a href="#zoo">frames at 3/15/27/40 s</a> · <a href="zoo.html">zoo.html</a>`, "already does", "ok"],
    ["Reading its own output",
      `The MCP cannot extract a frame or look at a result: on the barber it asked the user for a still of the last frame (“I can't extract the attached clip's final frame”), and it never reviews what it delivered (zoo: “I haven't verified the rendered content”). V4 extracts last frames, reviews every clip with a VLM and keeps a per-run state record in run.json (story, each clip's reference, prompt, last frame, review). Honest limit: that record is per run; there is no cross-run memory yet.`,
      `<a href="#barber">barber</a> · V2/bench/v1/results/mcp-barber/MB02.json dialog · full-V03/run.json result.clips`, "already does (per run); cross-run memory not yet", "mid"],
    ["Deterministic edits at 0 credits",
      `S05 “warmer”: both sides sent the photo to qwen-image-2.1 (10 cr each) and both re-rendered the picture rather than adjusting it; V4's own review failed it for that reason even though the verdict went to V4. A tone-only edit should be an ffmpeg colour filter at 0 credits, as the trim already is.`,
      `<a href="#simple">S05 card</a> · V4/RESULTS.md finding 2`, "not yet (a gap on our side too)", "bad"],
    ["Asking before spending",
      `From the dry runs V4 asked “where will it be posted”, “which words, exactly”, “how long”, “silent or with sound” in ${SIMPLE.filter((id) => v4Sheet(id).asked.length).length} of 13 vague briefs, at 0 credits, and its rule forbids drafting copy the user did not give (S03-strange tightened this). ${intentNote}`,
      `<a href="#intent">section 1</a> · <a href="transcripts.html">transcripts.html</a> · V2/bench/v1/results/mcp-intent`, intentFiles.length ? "already does" : "already does (MCP side pending)", "ok"],
  ];
  const body = `<p>On a single generation call the two agents are the same thing: the same model, the same endpoint, one prompt. The places they differ are structural, and these six are where the runs on this page show it.</p>
<table><thead><tr><th style="width:18%">Difference</th><th>What the runs show</th><th style="width:22%">Evidence</th><th style="width:12%">Can be improved by us</th></tr></thead><tbody>
${rows.map(([t, w, e, c, cls]) => `<tr><td><b>${t}</b></td><td>${w}</td><td class="mut">${e}</td><td class="${cls}">${esc(c)}</td></tr>`).join("")}
</tbody></table>`;
  sec("structural", "1b · Where the two differ structurally", body);
}

// 2. Intent / conversational
{
  const pendingAll = intentFiles.length === 0;
  let rows = "", convos = "";
  for (const id of SIMPLE) {
    const it = ITEMS[id]; const v = v4Sheet(id); const m = mcpSheet(id);
    const ev = EVALS[`dry-${id}`];
    rows += `<tr><td><b>${id}</b><br><span class="mut">${esc(it.title)}</span></td>
<td>“${esc(it.vague)}”<br><span class="mut">answers: ${esc(Object.entries(it.answers).map(([k, x]) => `${k}: ${x}`).join(" · "))}</span></td>
<td>${v.asked.length ? v.asked.map((q) => `· ${esc(q)}`).join("<br>") : "<span class=\"mut\">asked nothing</span>"}<br><span class="mut">tool ${esc(v.tool)}${ev ? ` · evaluator: <span class="${ev.verdict === "pass" ? "ok" : ev.verdict === "fail" ? "bad" : "mid"}">${ev.verdict}</span>` : ""}</span></td>
<td>${mark(v.aspect)}<br><span class="mut">${esc(v.aspectVal)}</span></td><td>${mark(v.words)}</td><td>${mark(v.seconds)}</td><td>${mark(v.sound)}</td>
<td>${m ? (m.asked.length ? m.asked.map((q) => `· ${esc(q).slice(0, 300)}`).join("<br>") : "<span class=\"mut\">asked nothing</span>") + `<br><span class="mut">attempted ${esc(m.tool)}${m.a.model ? " · " + esc(m.a.model) : ""}</span>` : `<span class="pending">pending</span>`}</td>
<td>${m ? mark(m.aspect) + `<br><span class="mut">${esc(m.aspectVal)}</span>` : "—"}</td><td>${m ? mark(m.words) : "—"}</td><td>${m ? mark(m.seconds) : "—"}</td><td>${m ? mark(m.sound) : "—"}</td></tr>`;
  }
  const tell = ["S03", "S10", "V01", "S01"];
  for (const id of tell) {
    const it = ITEMS[id]; const v = v4Sheet(id); const m = mcpSheet(id);
    convos += `<div class="card"><h3>${id} · ${esc(it.title)} <span class="mut">(what the user had in mind: ${esc(it.full)})</span></h3>
<div class="grid g2"><div><div class="mut">V4 (dry run, 0 credits) → ${esc(v.tool)}</div>${bubbles(v.messages)}<div class="mut">final sheet</div>${sheetTable(v.params)}${v.say ? `<p class="mut">V4 said: “${esc(v.say)}”</p>` : ""}</div>
<div><div class="mut">MCP (every paid call refused by the gate)</div>${m ? bubbles([{ role: "user", text: it.vague }, ...m.dialog.flatMap((d) => [{ role: "assistant", text: d.agent }, ...(d.user ? [{ role: "user", text: d.user }] : [])])]) +
        (m.attempts.length ? `<div class="mut">attempted call</div><pre>${esc(JSON.stringify({ tool: m.tool, model: m.a.model, aspect_ratio: m.a.aspect_ratio, end_seconds: m.a.end_seconds, audio: m.a.audio, prompt: m.prompt }, null, 1))}</pre>` : `<p class="mut">No call attempted.</p>`) + (m.agent ? `<p class="mut">MCP said: “${esc(m.agent.slice(0, 400))}”</p>` : "")
        : `<div class="pending">pending: V2/bench/v1/results/mcp-intent/I${id}.json not present when this page was built</div>`}</div></div></div>`;
  }
  const body = `
<p>The same thirteen briefs, but given as the vague one-liner a real user types, with a proxy answering the agent's questions from a fixed answer sheet (V4/tests/items/&lt;ID&gt;.json: <code>vague</code>, <code>answers</code>). V4's side is its dry suite (V4/runs/dry-*/run.json: 0 credits, the conversation and the final sheet). The MCP's side is V2/bench/v1/results/mcp-intent/I*.json: the same vague brief and answer sheet, with every paid call refused by a gate (item cap 0) so that the call it <i>attempted</i> is recorded instead. The question: who asked for what it could not know, and whose call matches the answers (aspect from “where will it be posted”, the exact words, the seconds, the sound)?</p>
${pendingAll ? `<div class="pending">MCP intent records: pending. ${INTENT_DIR}/run.json exists (started ${esc(j(INTENT_DIR + "/run.json").at || "")}, model ${esc(j(INTENT_DIR + "/run.json").model || "")}, item cap ${j(INTENT_DIR + "/run.json").item_cap}) but no I*.json files were present when this page was built. V4's column is complete; rebuild the page to fill the MCP columns.</div>` : `<p>${intentFiles.length} of 13 MCP intent records present${intentFiles.length < 13 ? "; the rest are marked pending" : ""}.</p>`}
<h3>Hits and misses</h3>
<p class="mut">Expected values come from the answer sheet: “Instagram feed” → 1:1 (4:5 accepted), “TikTok” → 9:16, “YouTube” / “homepage banner, wide” / “LinkedIn, landscape” → 16:9, “A4 flyers” → 3:4 (2:3 or 9:16 accepted as the nearest tall grid). “n/a” means the answer sheet does not fix that field. For V4, “not in sheet” means the tool's intake sheet has no aspect field at all (edit_image, create_video_from_image): the brief-writer then relies on the attached picture's shape, which is a real gap for S01, S10, S11 and V02 where the user named a destination.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Vague brief and the answer sheet</th><th>V4 asked</th><th>V4 aspect</th><th>words</th><th>seconds</th><th>sound</th><th>MCP asked · attempted</th><th>MCP aspect</th><th>words</th><th>seconds</th><th>sound</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>V4 reading, from the dry suite: it asked in ${SIMPLE.filter((id) => v4Sheet(id).asked.length).length} of 13 items, never more than two turns, and every question maps to a key on the answer sheet (it never asked for something already in the brief). It asked nothing in four (S01, S05, S06, S11): for S05 and S06 the answer sheet had nothing it could not infer; for S01 and S11 it skipped “where will this go” and so lost the 16:9 the user had in mind. On S10 and V02 it asked length and sound but not the destination, and its image-to-video sheet has no aspect field to put the answer in. The transcript evaluator (V4/runs/transcript-evals.json, with the attachment readings supplied) gave the 13 plain dry runs ${SIMPLE.filter((id) => EVALS[`dry-${id}`]?.verdict === "pass").length} pass / ${SIMPLE.filter((id) => EVALS[`dry-${id}`]?.verdict === "fail").length} fail; both fails are a look chosen without asking (S03: “bold, welcoming” when the user would have said “warm, a bit retro”; V01: “naturalistic”), which our rule allows as a stated default and the evaluator does not.</p>
<h3>Four conversations</h3>${convos}
<p class="mut">All nineteen V4 dry transcripts, including the strange-answer and direction-change variants: <a href="transcripts.html">transcripts.html</a>.</p>`;
  sec("intent", "1 · The user is vague but has an intention", body);
}

// 3. Simple items grid
{
  let cards = "";
  for (const id of SIMPLE) {
    const it = ITEMS[id]; const a = id === "S10" ? V4["S10-v1"] : V4[id]; const m = MCP[id]; const vd = verdictOf(id);
    const cls = vd.winner_side === "V4" ? "ok" : vd.winner_side === "MCP" ? "bad" : "mid";
    cards += `<div class="card"><h3 style="margin-top:0">${id} · ${esc(it.title)} <span class="${cls}" style="float:right">${esc(vd.winner_side)}${vd.strength ? ", " + esc(vd.strength) : ""}</span></h3>
<p class="mut">${esc(it.full)}</p>
<div class="pair">
 <div><figure style="margin:0">${media(v4Out(id), { alt: `V4 ${id}` })}<figcaption><b>V4</b> · ${esc(a.tool)}${a.models ? " · " + esc(a.models) : " · ffmpeg"} · ${a.credits} cr · ${n1(a.wall)} s wall (job ${a.jobSeconds} s)${a.review ? ` · VLM review ${a.review.pass ? "<span class=ok>pass</span>" : "<span class=bad>fail</span>"}` : ""}</figcaption></figure></div>
 <div><figure style="margin:0">${media(mcpOut(id), { alt: `MCP ${id}` })}<figcaption><b>MCP</b> · ${esc(m.tools)}${m.models ? " · " + esc(m.models) : ""} · ${m.spent} cr · ${m.seconds} s${m.kind === "cannot" ? " · <span class=bad>made nothing</span>" : ""}</figcaption></figure></div>
</div>
<p class="mut" style="margin-top:8px">${esc(vd.why)}</p></div>`;
  }
  const body = `<p>The full briefs, one attempt each, no retries, both sides on the free tier. V4's S10 shown here is its first run (start frame from the car photo), which is the run the verdicts scored; the rerun is in the next section. Verdicts: a VLM shown the two results in random order (V4/runs/compare-verdicts.json); S07 is V4 by default because the MCP has no trim tool. Full intermediates and prompts: <a href="compare-mcp.html">compare-mcp.html</a>, <a href="outputs.html">outputs.html</a>.</p>
<table><thead><tr><th>Item</th><th>V4 tool</th><th class="n">V4 cr</th><th class="n">V4 s</th><th>MCP tool</th><th class="n">MCP cr</th><th class="n">MCP s</th><th>Verdict</th></tr></thead><tbody>
${SIMPLE.map((id) => { const a = id === "S10" ? V4["S10-v1"] : V4[id]; const m = MCP[id]; const vd = verdictOf(id); return `<tr><td>${id} ${esc(ITEMS[id].title)}</td><td>${esc(a.tool)}${a.models ? ` <span class="mut">${esc(a.models)}</span>` : ""}</td><td class="n">${a.credits}</td><td class="n">${n1(a.wall)}</td><td>${esc(m.tools)}${m.models ? ` <span class="mut">${esc(m.models)}</span>` : ""}</td><td class="n">${m.spent}</td><td class="n">${m.seconds}</td><td class="${vd.winner_side === "V4" ? "ok" : vd.winner_side === "MCP" ? "bad" : "mid"}">${esc(vd.winner_side)}, ${esc(vd.strength)}</td></tr>`; }).join("")}
</tbody><tfoot><tr><td>Total</td><td></td><td class="n">${n0(v4SimpleCredits)}</td><td class="n">${n0(v4SimpleWall)}</td><td></td><td class="n">${n0(mcpSimpleCredits)}</td><td class="n">${n0(mcpSimpleSeconds)}</td><td>V4 ${tally.V4} · MCP ${tally.MCP} · tie ${tally.tie}</td></tr></tfoot></table>
<p>Same tool on nine of thirteen. The items the MCP won were decided by prompts (S02, S03, S06, S11: its image prompts restate the request's nouns first) and one routing choice (S10). V4 won where its prompt or a deterministic tool was the better fit (S04, S05, V01, V02, S07).</p>
<p><b>Equal by construction.</b> On a single-call generation the two sides are the same model and the same call; only the prompt and the routing differ. The MCP's image prompts were judged better on 4 of 13 (S02, S03, S06, S11) and its routing on one (S10, since fixed). We do not claim to beat it on single calls; the differences that matter are the structural ones in <a href="#structural">section 1b</a>.</p>
<div class="items">${cards}</div>`;
  sec("simple", "2 · Thirteen simple briefs", body);
}

// 4. S10 three ways
{
  const v1 = V4["S10-v1"], v2 = V4.S10, m = MCP.S10;
  const body = `<p class="mut">${esc(ITEMS.S10.full)}</p>
<div class="grid g3">
 <div class="card"><h3 style="margin-top:0">First run · start frame</h3>${media("full-S10-v1/clip.mp4", { w: 420 })}<p>${esc(v1.tool)} on ${esc(v1.models)}, the car photo as the start frame, the bridge named in words. ${v1.credits} cr · ${n1(v1.wall)} s wall. <b>The bridge never appears</b>: whatever is in a start frame persists, so the show stand and crowd stayed. VLM review: fail. The one-reference rule's known cost.</p></div>
 <div class="card"><h3 style="margin-top:0">Rerun · two named references</h3>${media("full-S10/clip.mp4", { w: 420 })}<p>${esc(v2.tool)} on ${esc(v2.models)} with <code>@product</code> (car) and <code>@environment</code> (bridge) as named references: “use references as likeness guides, not pasted photos … discard display platform, crowd and original setting.” ${v2.credits} cr · ${n1(v2.wall)} s wall (the minimax job alone ${v2.jobSeconds} s). By eye: the Tourbillon's body, ice-blue and black, crosses the Golden Gate, front three-quarter to rear three-quarter, towers and cables behind. The reviewer still flagged motion (it wants continuous position change past a fixed camera).</p></div>
 <div class="card"><h3 style="margin-top:0">MCP · first try</h3>${media(mcpOut("S10"), { w: 420 })}<p>${esc(m.tools)} on ${esc(m.models)}, <code>@car</code> and <code>@bridge</code> as named references, “no crowds or exhibition platform from the car reference”. ${m.spent} cr · ${m.seconds} s. The clip the verdict called decisive. Our rerun uses the same mechanism; the rule change that allowed it: small tasks may carry two references into a video call (not into an image edit).</p></div>
</div>
<p class="mut">Frames at 0.5 / 3 / 6 / 9.5 s for all three: <a href="s10.html">s10.html</a>.</p>`;
  sec("s10", "3 · S10, the car on the bridge, three ways", body);
}

// 5. Zoo
{
  const v = V4.V03, m = MCP.V03;
  const times = [3, 15, 27, 40];
  const frames = (side) => `<div class="frames">${times.map((t) => `<figure><img data-zoom src="report-frames/zoo-${side}-${t}.jpg" alt="${side} ${t}s" loading="lazy"><figcaption class="cap">${t} s</figcaption></figure>`).join("")}</div>`;
  const clipRows = (v.clips || []).map((c) => `<tr><td>clip ${c.n}</td><td class="n">${c.seconds}</td><td>${esc(c.reference_used ? c.reference_used.kind + " (" + c.reference_used.file + ")" : c.reference)}</td><td>${esc(c.sound)}</td><td class="n">${c.credits}</td><td>${c.review ? (c.review.pass ? "<span class=ok>pass</span>" : "<span class=bad>fail</span>") : "—"}</td><td>${esc(c.file)}</td></tr>`).join("");
  const mcpPrompts = m.gen.map((c) => c.a.style?.prompt || "");
  const body = `<div class="card hl">
<p><b>Brief.</b> ${esc(v.brief)}</p>
<p><b>Why this is the headline example.</b> A 45 s piece with three scenes in a fixed order, a voice-over and an exact end card is where the two designs differ most. V4 wrote a story (setting + one paragraph per clip), grouped the clips into four calls (lions 15 s, penguins 15 s, giraffe 10 s, end card 5 s from a generated still), joined them with ffmpeg and mixed a ${n1(v.narration?.seconds)} s TTS narration under. The MCP made one 45 s ltx-2.5 call with audio on and the narration quoted inside the prompt (its first attempt exceeded the 2,000-character prompt limit and was refused; it shortened and retried, ${m.calls.length} calls in all).</p>
<div class="grid g2">
 <div><h3>V4 · film-voiced.mp4 · 45.2 s</h3>${media("full-V03/film-voiced.mp4", { w: 560 })}<div class="cap">four clips joined, narration mixed under</div>${frames("v4")}</div>
 <div><h3>MCP · one 45 s call · 45.0 s</h3>${media(mcpOut("V03"), { w: 560 })}<div class="cap">single ltx-2.5 generation, audio on</div>${frames("mcp")}</div>
</div>
<h3>End cards (frame at 43 s)</h3>
<div class="pair">
 <div><img data-zoom src="report-frames/zoo-v4-43.jpg" alt="V4 end card" style="width:420px;max-width:100%"><div class="cap">V4: “Ridgeview Zoo”, antelope mark, “Open daily 9–5 · Kids under 5 free”, exact and held for 5 s. The card is its own clip made from a qwen-image-2.1 still (10 cr) as the clip's one reference.</div></div>
 <div><img data-zoom src="report-frames/zoo-mcp-43.jpg" alt="MCP end card" style="width:420px;max-width:100%"><div class="cap">MCP: “Rigedvew Zoo / Opdeiiew Zo”, a walking giraffe for the mark, “Open daily · Kids under 5 ⟨garbled⟩ free”. Lettering asked for “EXACTLY” in the prompt; the video model cannot hold it.</div></div>
</div>
<h3>Narration</h3>
<div class="grid g2">
 <div><p class="mut">V4 · TTS (${esc(v.narration?.voice)}), ${n1(v.narration?.seconds)} s, the whole script, mixed under the film (full-V03/narration.mp3):</p><pre>${esc(v.narration?.script)}</pre></div>
 <div><p class="mut">MCP · what is audible in its film: about 9 s of compressed speech at the start, then nothing (transcription in V4/RESULTS.md):</p><pre>This weekend, make room for wonder. Start your day with lions, meet penguins, at feeding time, and look up at our giraffes. Bring your!</pre><p class="mut">What it asked the model to say, inside the prompt: four voice-over lines timed 0–12, 12–24, 24–36, 36–45 s. ltx-2.5 squeezed them into the first seconds.</p></div>
</div>
<h3>Scene by scene</h3>
<table><thead><tr><th></th><th>V4</th><th>MCP</th></tr></thead><tbody>
<tr><td>Lions</td><td>lion on a sandstone ledge at sunrise, wide and small</td><td>lion and lioness on rocks at golden hour, close: <b>the better shot</b></td></tr>
<tr><td>Penguins</td><td>two penguins at a pool, clean</td><td>penguins with a giraffe superimposed: a double exposure at 27 s (see the frame above)</td></tr>
<tr><td>Giraffe</td><td>giraffe at acacias, its own 10 s clip, review pass</td><td>folded into the penguin shot</td></tr>
<tr><td>End card</td><td>exact, held</td><td>garbled</td></tr>
<tr><td>Voice-over</td><td>${n1(v.narration?.seconds)} s, the whole script</td><td>about 9 s, then silence</td></tr>
</tbody></table>
<h3>Credits and time</h3>
<table><thead><tr><th></th><th class="n">V4</th><th class="n">MCP</th></tr></thead><tbody>
<tr><td>Generation credits in the film as delivered</td><td class="n">${n0(sum(v.clips || [], (c) => c.credits) + 10)} (clips 360 + 360 + 240 + 120, card still 10)</td><td class="n">${n0(m.spent)}</td></tr>
<tr><td>Credits actually spent (ledger)</td><td class="n"><b>${n0(v.credits)}</b> = first cut ${n0(v03CreditsPass1)} (3 × 360 clips + 10 still) + second cut 360 (giraffe 240, card 120) + unintended 360 (clip 1 regenerated)</td><td class="n">${n0(m.spent)} (its first call was refused before spending)</td></tr>
<tr><td>Wall time</td><td class="n">${n0(v03FinalPassWall)} s for the final pass; the first pass ran about ${n0(v03FirstPassWall)} s before an HTTP 502 on clip 3; the second pass is not timed in the record</td><td class="n">${m.seconds} s</td></tr>
</tbody></table>
<p><b>The overspend, stated plainly.</b> The ledger shows ${n0(v.credits)} credits against ${n0(m.spent)} for the MCP. Of ours, ${n0(v03CreditsPass2)} came after the first cut: 360 was the intended second cut (giraffe as its own clip 240, end-card clip 120, plus a 10 cr still) and <b>360 was unintended</b>: the rerun regenerated clip 1 because the clip brief carried “CLIP n OF N” and N had changed from 3 to 4, which changed the prompt and so the job's cache key. The brief no longer carries the total. Calls in the record: ${esc(v03ClipCredits)}.</p>
<table><thead><tr><th>Final cut</th><th class="n">s</th><th>reference</th><th>sound</th><th class="n">cr</th><th>review</th><th>file</th></tr></thead><tbody>${clipRows}</tbody></table>
<p class="mut">Every intermediate, prompt and review for both sides: <a href="zoo.html">zoo.html</a>. The MCP's two prompts (the refused long one and the retry) are in V2/bench/v1/results/mcp-v4/MV03.json; the retry was ${mcpPrompts.at(-1).length} characters.</p>
</div>`;
  sec("zoo", "4 · The zoo ad: stability over 45 seconds", body);
}

// 6. Barber
{
  const arms = [
    { k: "B02", side: "V4", arm: "informed", file: "barber-stitched/v4-informed.mp4", mech: "last frame of the seed extracted by ffmpeg, used as the start frame for ltx-2.5 image-to-video; the lost paragraph in the prompt", rec: V4.B02 },
    { k: "B03", side: "V4", arm: "blind", file: "barber-stitched/v4-blind.mp4", mech: "the same, with a VLM reading of three seed frames proposing the continuation", rec: V4.B03 },
    { k: "MB02", side: "MCP", arm: "informed", file: "barber-stitched/mcp-informed.mp4", mech: "asked for a still of the last frame (“I can't extract the clip's final frame”); on “your call” used minimax-h3 text-to-video with the whole seed video as @original", rec: MCP.B02 },
    { k: "MB03", side: "MCP", arm: "blind", file: "barber-stitched/mcp-blind.mp4", mech: "minimax-h3 with the seed video as @source, “continue whatever action is underway naturally”", rec: MCP.B03 },
  ];
  const fr = (k) => `<div class="frames">${["0.5", "5", "9.5"].map((t) => `<figure><img data-zoom src="barber-${k}-f${t}.jpg" alt="${k} ${t}s" loading="lazy"><figcaption class="cap">${t} s</figcaption></figure>`).join("")}</div>`;
  const body = `<p><b>The story</b> (V4/tests/barber-story.json), two clips. <i>Setting:</i> ${esc(STORY.setting)} <i>Clip 1:</i> ${esc(STORY.clip1)} <i>Clip 2 (the “lost” half):</i> ${esc(STORY.clip2)}</p>
<div class="grid g2"><div class="card"><h3 style="margin-top:0">Seed · B01 · ${V4.B01.credits} cr · ${n1(V4.B01.wall)} s</h3>${media("full-B01/clip.mp4", { w: 480 })}<p class="mut">Clip 1 made by V4 as a 10 s text-to-video on ${esc(V4.B01.models)}. Both sides were then given this clip and asked for the next 10 s: <b>informed</b> (the whole story attached) and <b>blind</b> (the clip only, “continue whatever is happening”).</p></div>
<div class="card"><h3 style="margin-top:0">Scores (V4/runs/barber-scores.json)</h3><table><thead><tr><th>Arm</th><th>Mechanism</th><th class="n">cr</th><th class="n">wall s</th><th>continuity</th><th>follows the paragraph</th><th class="n">score</th></tr></thead><tbody>
${arms.map((a) => `<tr><td>${a.side} ${a.arm}</td><td class="mut">${esc(a.mech)}</td><td class="n">${a.rec.credits ?? a.rec.spent}</td><td class="n">${n1(a.rec.wall ?? a.rec.seconds)}</td><td>${esc(BSC[a.k].continuity)}</td><td>${esc(BSC[a.k].follows_lost_paragraph)}</td><td class="n"><b>${BSC[a.k].score}</b></td></tr>`).join("")}
</tbody></table></div></div>
<h3>The four continuations, stitched to the seed (20 s each)</h3>
<div class="grid g2">${arms.map((a) => `<div class="card"><h3 style="margin-top:0">${a.side} ${a.arm} · score ${BSC[a.k].score}</h3>${media(a.file, { w: 560 })}<p class="mut">${esc(BSC[a.k].what_happens)}</p>${fr(a.k)}</div>`).join("")}</div>
<p><b>Why the MCP's informed arm won.</b> A video reference gives minimax-h3 the motion and the room, not one frozen pose. Our start frame (ltx-2.5 image-to-video from the last frame) locked Dev in the chair and the clip stayed there; the MCP's clip got the cape off, the hand mirror, and Dev turning to the door. Both blind arms reached 38: a continuation nobody described is a continuation of the pose, not of the story, which puts the story at 20–40 points. The MCP could not read the clip and said so (its dialog: “${esc(MCP.B02.dialog[0]?.agent?.slice(0, 220) || "")}…”); our VLM read of the clip was accurate but the start-frame mechanism did not let that reading move the scene on. Consequence: add a video-reference route for “extend this clip” (minimax-h3 with the clip itself as a named reference, ≤ 15 s of it); keep image-to-video for stills.</p>
<p class="mut">Frames and prompts per arm: <a href="barber.html">barber.html</a> · stitched films: <a href="barber-stitched.html">barber-stitched.html</a> · the story page: <a href="barber-story.html">barber-story.html</a>.</p>`;
  sec("barber", "5 · The barber reconnection", body);
}

// 7. Time and cost
{
  const row = (label, a, m, note = "") => `<tr><td>${label}</td><td class="n">${a?.credits ?? "—"}</td><td class="n">${a ? n1(a.wall) : "—"}</td><td class="n">${a ? (a.jobSeconds || 0) : "—"}</td><td class="n">${m?.spent ?? "—"}</td><td class="n">${m?.seconds ?? "—"}</td><td class="mut">${note}</td></tr>`;
  let rows = "";
  for (const id of SIMPLE) rows += row(`${id} ${esc(ITEMS[id].title)}`, id === "S10" ? V4["S10-v1"] : V4[id], MCP[id], id === "S10" ? "V4: first run (start frame)" : id === "S07" ? "MCP made nothing" : "");
  rows += row("S10 rerun (two references)", V4.S10, null, "minimax-h3 job 120 s");
  rows += `<tr><td>V03 zoo ad</td><td class="n">${V4.V03.credits}</td><td class="n">${n0(v03FinalPassWall)}*</td><td class="n">${V4.V03.jobSeconds}</td><td class="n">${MCP.V03.spent}</td><td class="n">${MCP.V03.seconds}</td><td class="mut">* final pass only; V4 job seconds sum every generation call across the three passes</td></tr>`;
  rows += row("B01 barber seed", V4.B01, null, "shared by both sides");
  rows += row("B02 barber informed", V4.B02, MCP.B02, "");
  rows += row("B03 barber blind", V4.B03, MCP.B03, "");
  const body = `<table><thead><tr><th>Item</th><th class="n">V4 credits</th><th class="n">V4 wall s</th><th class="n">V4 job s</th><th class="n">MCP credits</th><th class="n">MCP wall s</th><th></th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td>Total</td><td class="n">${n0(totalV4)}</td><td class="n">${n0(totalV4wall)}</td><td class="n">${n0(sum([...SIMPLE.map((id) => (id === "S10" ? V4["S10-v1"] : V4[id])), V4.S10, V4.V03, V4.B01, V4.B02, V4.B03], (x) => x.jobSeconds))}</td><td class="n">${n0(totalMCP)}</td><td class="n">${n0(totalMCPsec)}</td><td></td></tr></tfoot></table>
<ul>
<li><b>V4 credits</b> are our own ledger (<code>credits</code> in run.json, the sum of the Magic Hour jobs we submitted). <b>MCP credits</b> are <code>spent</code> in the bench record, taken from the account balance before and after each item. The two ledgers were not reconciled against each other; the MCP's 853 on the thirteen briefs vs our 848 differ by S02 (flux-2-klein 5 vs qwen 10) and V02 (its extra edit, 154 vs 144).</li>
<li><b>LLM calls are not credited</b> on either side: V4's intake, story, prompt-writing and VLM review calls, and the MCP's chat model, are outside these numbers.</li>
<li><b>V4 wall</b> is <code>finished − at</code> in run.json and includes the VLM reviews, frame extraction and ffmpeg steps; “job s” is the provider's own time for the generation calls. <b>MCP wall</b> is the bench's end-to-end <code>seconds</code> and includes the model's thinking and its own <code>wait_for_*</code> polling.</li>
<li>On equal tools the two sides take about the same time (S09: ${n1(V4.S09.wall)} vs ${MCP.S09.seconds} s; V01: ${n1(V4.V01.wall)} vs ${MCP.V01.seconds} s). V4 is faster on the ten-credit edits because it does not read a workflow guide first and its review is one call; the MCP is faster where V4's review adds a VLM round on a video.</li>
<li>Zoo: the V4 figure includes the 720 cr second cut of which 360 was an unintended regeneration (section 4). Barber: the 240 cr seed is counted on the V4 side only; the MCP arms consumed it as input.</li>
</ul>`;
  sec("cost", "6 · Time and cost", body);
}

// 8. Method
{
  const body = `<ul>
<li><b>Judge.</b> Pairwise VLM verdict on the thirteen simple items: the two results shown in random order (the <code>first</code> field in compare-verdicts.json records which side was A), asked which better meets the brief, with a strength (slight / clear / decisive). The barber arms were scored 0–100 against the lost paragraph by a VLM given frames at fixed times. The zoo verdict is by eye against the brief's checklist (three animals in order, exact lettering, full narration) plus the frames shown above.</li>
<li><b>Frames</b> are taken at fixed times (0.5/1/5/9 s for clips; 3/15/27/40 s and 43 s for the zoo films; 0.5/5/9.5 s for the barber arms) so that neither side is cherry-picked.</li>
<li><b>Retries off</b> on both sides: one attempt per item (the MCP's own in-session retry after a refused over-long prompt on the zoo is counted as part of its one run, as is the 502 crash and rerun on ours).</li>
<li><b>480p / 640px</b>: both sides on the free tier, same models available (qwen-image-2.1, flux-2-klein, ltx-2.5, minimax-h3, the face swap).</li>
<li><b>What the MCP cannot do at all:</b> trim, cut or join clips, extract a frame, text-to-speech or mix a voice-over, overlay exact text. On S07 it printed an ffmpeg command for the user; on the barber it asked the user for a still of the last frame; on the zoo it had to put the narration inside the video prompt.</li>
<li><b>What V4 cannot yet do:</b> multi-deliverable campaigns (one brief, several assets), video-as-reference continuation (the barber finding; image-to-video from the last frame is the only extend route today), and tone-only edits by a deterministic path (S05 “warmer” was re-rendered by the model; an ffmpeg colour filter would beat it).</li>
<li><b>Where the pipeline changed because of this comparison:</b> small tasks may carry two named references into a video call (S10); the image prompt writer restates the request's nouns and exact words first, then the look; clips are grouped into calls by key idea and an end card is always its own clip from a still; the clip brief no longer carries the clip total (the cache-key bug).</li>
<li><b>Sources:</b> V4/RESULTS.md, general/04-pipeline-design.md, general/01-multi-reference-image-editing.md, general/02-one-reference-rule.md, general/03-free-text-to-image.md.</li>
</ul>`;
  sec("method", "7 · Method notes", body);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V4 vs MCP report</title><style>${css}</style></head>
<body><main>${H}</main>
<div id="lb"><img alt=""></div>
<script>
const lb=document.getElementById('lb'),li=lb.querySelector('img');
document.querySelectorAll('img[data-zoom]').forEach(i=>i.addEventListener('click',()=>{li.src=i.src;lb.classList.add('on')}));
lb.addEventListener('click',()=>lb.classList.remove('on'));document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('on')});
</script></body></html>`;
fs.writeFileSync(OUT, html);

console.log(JSON.stringify({
  out: OUT, intentFiles: intentFiles.length, tally,
  v4Simple: { credits: v4SimpleCredits, wall: +v4SimpleWall.toFixed(1) }, mcpSimple: { credits: mcpSimpleCredits, seconds: mcpSimpleSeconds },
  s10rerun: { credits: V4.S10.credits, wall: V4.S10.wall },
  zoo: { v4: V4.V03.credits, v4FinalPassWall: +v03FinalPassWall.toFixed(0), v4FirstPassWall: +v03FirstPassWall.toFixed(0), mcp: MCP.V03.spent, mcpSeconds: MCP.V03.seconds },
  barber: { seed: V4.B01.credits, v4: barberV4, v4wall: +barberV4wall.toFixed(1), mcp: barberMCP, mcpSeconds: barberMCPsec },
  totals: { v4: totalV4, v4wall: +totalV4wall.toFixed(0), mcp: totalMCP, mcpSeconds: totalMCPsec },
}, null, 1));
