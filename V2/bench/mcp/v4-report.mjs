// V4 against the MCP, one page in three parts: (1) the conversation on thirteen vague briefs, what each side asked the user and
// what it then attempted, parameter by parameter against the answer sheet; (2) the zoo ad, both films with the audio transcribed
// and measured, the frames at the same seconds, the frame-to-frame similarity with the joins marked, the end cards, the prompts;
// (3) the same thirteen briefs given in full, both outputs side by side with the calls, the credits and the recorded verdict.
// Reads the V4 runs (V4/runs: dry-*, full-*), the MCP intent and v4 runs (bench/v1/results/mcp-intent, mcp-v4), the V4 items
// and verdicts; copies V4's outputs into V2/sessions/v4-report so bench/v1/serve.mjs can serve them (/sessions/v4-report/…).
// Usage: node V2/bench/mcp/v4-report.mjs [--out V2/bench/v1/results/v4-report]  → http://localhost:4748/v4-report/
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { key } from "../../backend/lib/env.js";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../.."), ROOT = join(V2, ".."), V4 = join(ROOT, "V4"), RUNS = join(V4, "runs"), ITEMS = join(V4, "tests/items");
const MI = join(V2, "bench/v1/results/mcp-intent"), MV = join(V2, "bench/v1/results/mcp-v4"), SESS = join(V2, "sessions"), MEDIA = join(SESS, "v4-report");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", join(V2, "bench/v1/results/v4-report")); mkdirSync(OUT, { recursive: true }); mkdirSync(join(MEDIA, "frames"), { recursive: true }); mkdirSync(join(MEDIA, "zoo"), { recursive: true });
const J = (p) => JSON.parse(readFileSync(p, "utf8")), esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const IDS = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "V01", "V02"];
const n1 = (x) => Number(x).toLocaleString("en-US");

// ---- media helpers (ffmpeg/ffprobe), every derived file cached by name
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const dur = (f) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));
const frameAt = (f, t, out, w = 427) => { if (!existsSync(out)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", `scale=${w}:-1`, "-update", "1", out], { stdio: "ignore" }); return out; };
const rms = (f) => JSON.parse("[" + sh("ffmpeg", ["-v", "error", "-i", f, "-af", "aresample=48000,asetnsamples=n=24000:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"]).split("\n").filter((l) => l.includes("RMS_level=")).map((l) => { const v = l.split("=")[1].trim(); return v === "-inf" ? -90 : Number(v).toFixed(1); }).join(",") + "]");
const ssimCurve = (f) => JSON.parse("[" + sh("ffmpeg", ["-v", "error", "-i", f, "-filter_complex", "[0:v]fps=2,scale=320:-1,format=gray,split[a][b];[b]trim=start=0.5,setpts=PTS-STARTPTS[b2];[a][b2]ssim=stats_file=-", "-f", "null", "-"]).split("\n").map((l) => /All:([0-9.]+)/.exec(l)?.[1]).filter(Boolean).map((v) => Number(v).toFixed(3)).join(",") + "]");
async function transcribe(f, out) {   // whole file, whisper-1 segments for the timeline plus gpt-4o-transcribe's reading
  if (existsSync(out)) return J(out);
  const wav = join(OUT, "t.wav"); execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-vn", "-ac", "1", "-ar", "16000", wav], { stdio: "ignore" });
  const call = async (model, extra) => { const fd = new FormData(); fd.append("model", model); for (const [k, v] of extra) fd.append(k, v); fd.append("file", new Blob([readFileSync(wav)]), "a.wav"); const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: fd }); return r.json(); };
  const w = await call("whisper-1", [["response_format", "verbose_json"], ["timestamp_granularities[]", "segment"]]), g = await call("gpt-4o-transcribe", [["response_format", "json"]]);
  const res = { file: f, language: w.language, duration: w.duration, text4o: g.text, textWhisper: w.text, segments: (w.segments || []).map((s) => ({ start: +s.start.toFixed(2), end: +s.end.toFixed(2), text: s.text.trim() })) };
  writeFileSync(out, JSON.stringify(res, null, 1)); return res;
}

// ---- the records
const items = Object.fromEntries(IDS.map((id) => [id, J(join(ITEMS, `${id}.json`))]));
const dry = (id) => J(join(RUNS, `dry-${id}`, "run.json")), mi = (id) => J(join(MI, `I${id}.json`)), full = (label) => J(join(RUNS, `full-${label}`, "run.json")), mv = (id) => J(join(MV, `M${id}.json`));
const verdicts = J(join(RUNS, "compare-verdicts.json")), evals = J(join(RUNS, "transcript-evals.json"));
const mcpArgs = (c) => (typeof c.arguments === "string" ? JSON.parse(c.arguments) : c.arguments || c.args || {});
const creation = (name) => !/^(get_|wait_|fetch_|list_|upload)/.test(name);

// V4's outputs are copied beside the MCP's sessions so one server serves both
function syncV4(label) {
  const src = join(RUNS, `full-${label}`), dst = join(MEDIA, `full-${label}`); if (!existsSync(src)) return; mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) if (/\.(png|jpg|jpeg|mp4|mp3|json)$/i.test(f) && !existsSync(join(dst, f))) copyFileSync(join(src, f), join(dst, f));
}
for (const id of IDS) syncV4(id); syncV4("S10-v1");
for (const f of ["film-voiced.mp4", "film.mp4", "clip-1.mp4", "clip-2.mp4", "clip-3g.mp4", "clip-4.mp4", "clip-3-still.png", "clip-4-still.png", "narration.mp3"]) if (!existsSync(join(MEDIA, "zoo", f)) && existsSync(join(RUNS, "full-V03", f))) copyFileSync(join(RUNS, "full-V03", f), join(MEDIA, "zoo", f));

// ---- what the answer sheet implies, so each side's call can be marked against it
const ASPECT = [[/tiktok|reels?\b|\bstory\b|stories|vertical|portrait|shorts?\b/i, "9:16"], [/\ba4\b|print|flyer/i, "3:4"], [/wide|banner|youtube|landscape|widescreen/i, "16:9"], [/instagram feed|\bfeed\b|square|instagram post/i, "1:1"], [/linkedin|facebook/i, "16:9"]];
const wantAspect = (where = "") => { for (const [re, v] of ASPECT) if (re.test(where)) return v; return null; };
const wantSound = (s = "") => (!s ? null : /silent|no sound|none/i.test(s) ? "none" : /voice|narrat/i.test(s) ? "narration" : /music/i.test(s) ? "music" : /ambient|wave|sound/i.test(s) ? "ambient" : s);
const wantSeconds = (s = "") => { const m = /(\d+)/.exec(s); return m ? Number(m[1]) : null; };
const wantWords = (s = "") => (s ? s.split(/\s*·\s*/).map((w) => w.replace(/^['"]|['"]$/g, "").trim()).filter(Boolean) : []);
const tallish = (a) => ["9:16", "3:4", "4:5", "2:3"].includes(a), wideish = (a) => ["16:9", "4:3", "3:2"].includes(a);
function want(it) { const a = it.answers || {}; return { aspect: wantAspect(a.where || ""), where: a.where || "", seconds: wantSeconds(a.length || ""), sound: wantSound(a.sound || ""), words: wantWords(a.words || ""), rest: Object.fromEntries(Object.entries(a).filter(([k]) => !["where", "length", "sound", "words"].includes(k))) }; }
const MARK = { ok: "✓", bad: "✗", part: "~", na: "–" };
function markAspect(w, got) { if (!w) return got ? "na" : "na"; if (!got || got === "auto" || got === "own") return "bad"; if (got === w) return "ok"; if ((tallish(w) && tallish(got)) || (wideish(w) && wideish(got))) return "part"; return "bad"; }
function markSeconds(w, got) { if (w == null) return "na"; if (got == null) return "bad"; return Number(got) === w ? "ok" : "bad"; }
function markSound(w, got) { if (!w) return "na"; if (got == null) return "bad"; const g = String(got); if (w === "none") return g === "none" || g === "false" ? "ok" : "bad"; return g === "none" || g === "false" ? "bad" : "ok"; }
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
function markWords(w, text) { if (!w.length) return "na"; const t = norm(text); const hit = w.filter((x) => t.includes(norm(x))).length; return hit === w.length ? "ok" : hit ? "part" : "bad"; }

// ---- part 1: the conversation
const EDIT_TOOLS = new Set(["edit_image", "adjust_image", "swap_face_in_photo", "create_video_from_image", "trim_video", "extend_video"]);
function conversation(id) {
  const it = items[id], W = want(it), d = dry(id), m = mi(id), T = m.turns[0], last = d.turns.at(-1)?.intent || {}, P = Object.fromEntries((last.params || []).map((p) => [p.name, p]));
  // V4's thread and sheet
  const v4Msgs = (d.messages || []).map((x) => ({ role: x.role, text: x.text })); if (last.say && last.ready) v4Msgs.push({ role: "assistant", text: last.say, closing: true });
  const v4Asked = d.turns.flatMap((t) => (t.asked || []).map((q) => ({ ...q, n: t.n })));
  const v4 = { tool: last.tool, expected: it.expect_tool, asked: v4Asked, msgs: v4Msgs, sheet: last.params || [], ev: evals[`dry-${id}`], aspect: P.aspect?.value || (EDIT_TOOLS.has(last.tool) ? "own" : null), seconds: P.seconds?.value ?? null, sound: P.sound?.value ?? null, words: P.exact_words?.value ?? "", say: last.say };
  // the MCP's thread and attempted call
  const att = (T.approvals || [])[0], a = att ? att.args || {} : null;
  const mcpMsgs = [{ role: "user", text: T.text + (T.materials?.length ? `  [attached: ${T.materials.join(", ")}]` : "") }];
  for (const x of T.dialog || []) { mcpMsgs.push({ role: "assistant", text: x.agent }); mcpMsgs.push({ role: "user", text: x.user }); }
  if (T.agent) mcpMsgs.push({ role: "assistant", text: T.agent, closing: true });
  const mcp = { tool: att ? att.name : (T.calls || []).filter((c) => creation(c.name)).map((c) => c.name)[0] || null, asked: (T.dialog || []).filter((x) => (x.asked || []).includes("question")), msgs: mcpMsgs, args: a, aspect: a ? a.aspect_ratio || (a.assets ? "own" : null) : null, seconds: a ? a.end_seconds ?? null : null, sound: a ? (a.audio === undefined ? null : a.audio ? "on" : "none") : null, words: a?.style?.prompt || "", kind: T.kind, calls: (T.calls || []).map((c) => c.name) };
  const marks = (s) => ({ aspect: markAspect(W.aspect, s.aspect), seconds: markSeconds(W.seconds, s.seconds), sound: markSound(W.sound, s.sound), words: markWords(W.words, s.words) });
  return { id, it, W, v4, mcp, m4: marks(v4), mm: marks(mcp) };
}
const CONV = IDS.map(conversation);

const bubble = (x) => `<div class="m ${x.role}${x.closing ? " closing" : ""}">${esc(x.text)}</div>`;
const thread = (msgs) => `<div class="chat">${msgs.map(bubble).join("")}</div>`;
const mk = (k) => `<span class="mk ${k}">${MARK[k]}</span>`;
const show = (v) => (v == null || v === "" ? "<span class=mut>–</span>" : esc(v === "own" ? "the picture's own shape" : v));
function paramTable(W, s, mks) {
  const rows = [["where / shape", W.aspect ? `${esc(W.where)} → ${W.aspect}` : W.where ? esc(W.where) : "<span class=mut>not in the sheet</span>", show(s.aspect), mks.aspect], ["length", W.seconds != null ? `${W.seconds} s` : "<span class=mut>not in the sheet</span>", s.seconds != null ? `${esc(s.seconds)} s` : show(null), mks.seconds], ["sound", W.sound || "<span class=mut>not in the sheet</span>", show(s.sound === "on" ? "audio on" : s.sound), mks.sound], ["words", W.words.length ? esc(W.words.join(" · ")) : "<span class=mut>none asked for</span>", W.words.length ? (mks.words === "ok" ? "all present" : mks.words === "part" ? "some present" : "absent or its own") : show(null), mks.words]];
  return `<table class="pt"><tr><th></th><th>the user's answer</th><th>what it ended with</th><th></th></tr>${rows.map(([k, w, g, m]) => `<tr><td>${k}</td><td>${w}</td><td>${g}</td><td>${mk(m)}</td></tr>`).join("")}</table>`;
}
const badCount = (mks) => Object.values(mks).filter((m) => m === "bad").length, partCount = (mks) => Object.values(mks).filter((m) => m === "part").length;
const convSummary = `<table class="sum"><tr><th>item</th><th>the vague brief</th><th>MCP asked</th><th>V4 asked</th><th>MCP ended on</th><th>V4 ended on</th><th>misses MCP</th><th>misses V4</th></tr>${CONV.map((c) => `<tr><td><a href="#c-${c.id}">${c.id}</a></td><td>${esc(c.it.vague)}</td><td>${c.mcp.asked.length ? `<b>yes</b>: ${esc(c.mcp.asked.map((x) => x.agent.split("\n")[0]).join(" / ")).slice(0, 140)}` : "no"}</td><td>${c.v4.asked.length ? `<b>yes</b>: ${esc(c.v4.asked.map((q) => q.param).join(", "))}` : "no"}</td><td>${esc(c.mcp.tool || "no call")}${c.mcp.args ? ` <span class=mut>${esc([c.mcp.args.model, c.mcp.args.aspect_ratio, c.mcp.args.end_seconds ? c.mcp.args.end_seconds + " s" : "", c.mcp.args.audio === undefined ? "" : c.mcp.args.audio ? "audio on" : "silent"].filter(Boolean).join(" · "))}</span>` : ""}</td><td>${esc(c.v4.tool)}${c.v4.tool !== c.v4.expected ? ` <span class="mk bad">expected ${esc(c.v4.expected)}</span>` : ""}</td><td>${badCount(c.mm) || partCount(c.mm) ? `${badCount(c.mm)}${partCount(c.mm) ? ` (+${partCount(c.mm)} near)` : ""}` : "<span class=mut>0</span>"}</td><td>${badCount(c.m4) || partCount(c.m4) ? `${badCount(c.m4)}${partCount(c.m4) ? ` (+${partCount(c.m4)} near)` : ""}` : "<span class=mut>0</span>"}</td></tr>`).join("")}</table>`;
const askedMcp = CONV.filter((c) => c.mcp.asked.length).length, askedV4 = CONV.filter((c) => c.v4.asked.length).length, missMcp = CONV.reduce((a, c) => a + badCount(c.mm), 0), missV4 = CONV.reduce((a, c) => a + badCount(c.m4), 0);
const convCards = CONV.map((c) => `<section class="item" id="c-${c.id}"><h3>${c.id} · ${esc(c.it.title)} <span class="mut">· ${esc(c.it.group)}${c.it.materials?.length ? ` · attached: ${esc(c.it.materials.join(", "))}` : ""}</span></h3>
<div class="brief"><b>The user's first message:</b> ${esc(c.it.vague)}<br><b>What the user actually wanted (the answer sheet the proxy answered from):</b> ${esc(Object.entries(c.it.answers || {}).map(([k, v]) => `${k}: ${v}`).join(" · "))}</div>
<div class="row">
<div class="side"><h4>MCP <span class="mut">· ${c.mcp.asked.length ? `asked ${c.mcp.asked.length} question${c.mcp.asked.length > 1 ? "s" : ""}` : "asked nothing"} · then ${c.mcp.tool ? `attempted <b>${esc(c.mcp.tool)}</b>` : "made no call"}${c.mcp.calls.length ? ` · read ${esc(c.mcp.calls.filter((x) => !creation(x)).join(", "))}` : ""}</span></h4>${thread(c.mcp.msgs)}
${c.mcp.args ? paramTable(c.W, c.mcp, c.mm) : `<div class="mut">no call to check against the sheet</div>`}
${c.mcp.args ? `<details><summary>the attempted call, as the gate saw it</summary><pre>${esc(JSON.stringify(c.mcp.args, null, 1))}</pre></details>` : ""}</div>
<div class="side"><h4>V4 <span class="mut">· ${c.v4.asked.length ? `asked ${c.v4.asked.length} question${c.v4.asked.length > 1 ? "s" : ""} (${esc(c.v4.asked.map((q) => q.param).join(", "))})` : "asked nothing"} · ended on <b>${esc(c.v4.tool)}</b>${c.v4.tool !== c.v4.expected ? ` <span class="mk bad">expected ${esc(c.v4.expected)}</span>` : ""}</span></h4>${thread(c.v4.msgs)}
${paramTable(c.W, c.v4, c.m4)}
<details><summary>the sheet V4 ended with: every parameter and where its value came from</summary><table class="sheet"><tr><th>parameter</th><th>value</th><th>source</th><th>from</th></tr>${c.v4.sheet.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.value)}</td><td><span class="src ${esc(p.source)}">${esc(p.source)}</span></td><td class="mut">${esc(p.from)}</td></tr>`).join("")}</table></details>
${c.v4.ev ? `<div class="mut ev">V4's own transcript evaluator (an LLM reading the thread): <b>${esc(c.v4.ev.verdict)}</b> · asked only what was missing: ${esc(c.v4.ev.asked_only_missing)} · fabricated: ${esc(c.v4.ev.fabricated)} · ${esc(c.v4.ev.note)}</div>` : ""}</div>
</div></section>`).join("");

// V4's other dry runs, which have no MCP intent counterpart on this page
const extras = readdirSync(RUNS).filter((d) => /^dry-(D\d\d|E\d\d|P\d\d|R\d\d|B\d\d|V03)$/.test(d)).sort().map((d) => { const r = J(join(RUNS, d, "run.json")), id = d.slice(4), it = existsSync(join(ITEMS, `${id}.json`)) ? J(join(ITEMS, `${id}.json`)) : {}; const last = r.turns.at(-1)?.intent || {}; return `<tr><td>${esc(id)}</td><td>${esc(it.title || "")}</td><td>${esc(r.brief)}</td><td>${esc(r.turns.flatMap((t) => (t.asked || []).map((q) => q.param)).join(", ") || "nothing")}</td><td>${esc(last.tool)}${it.expect_tool && it.expect_tool !== last.tool ? ` <span class="mk bad">expected ${esc(it.expect_tool)}</span>` : ""}</td></tr>`; });

// ---- part 2: the zoo
const Z = full("V03"), ZM = mv("V03"), ZT = ZM.turns[0], zooMcpFile = join(SESS, ZM.session, "assets", "01-create_video_from_text.mp4"), zooV4File = join(MEDIA, "zoo", "film-voiced.mp4");
const zooMcpUrl = `/sessions/${ZM.session}/assets/01-create_video_from_text.mp4`, zooV4Url = `/sessions/v4-report/zoo/film-voiced.mp4`;
const measuresFile = join(OUT, "zoo-measures.json"), measures = existsSync(measuresFile) ? J(measuresFile) : { mcp: { rms: rms(zooMcpFile), ssim: ssimCurve(zooMcpFile), dur: dur(zooMcpFile) }, v4: { rms: rms(zooV4File), ssim: ssimCurve(zooV4File), dur: dur(zooV4File) } };
writeFileSync(measuresFile, JSON.stringify(measures));
const trMcp = await transcribe(zooMcpFile, join(OUT, "audio-mcp.json")), trV4 = await transcribe(zooV4File, join(OUT, "audio-v4.json"));
const TIMES = [0.5, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 44.5];
for (const t of TIMES) { frameAt(zooMcpFile, t, join(MEDIA, "frames", `mcp-${t}.jpg`)); frameAt(zooV4File, t, join(MEDIA, "frames", `v4-${t}.jpg`)); }
frameAt(zooMcpFile, 42, join(MEDIA, "frames", "mcp-card.jpg"), 854); frameAt(zooV4File, 42, join(MEDIA, "frames", "v4-card.jpg"), 854);
const mcpCalls = ZT.calls.filter((c) => c.name === "create_video_from_text").map((c) => ({ args: mcpArgs(c), error: c.error ? JSON.parse(c.error).content?.[0]?.text || c.error : null }));
const speechSec = (tr) => tr.segments.reduce((a, s) => a + (s.end - s.start), 0), lastSpeech = (tr) => Math.max(0, ...tr.segments.map((s) => s.end));
// an SVG timeline: the loudness per half second as an area, the transcribed speech as bars over it
function audioSvg(tr, r, total) {
  const Wd = 900, H = 96, x = (t) => 40 + (t / total) * (Wd - 50), y = (db) => 86 - Math.max(0, Math.min(1, (db + 45) / 45)) * 56;
  const area = `M${x(0)},86 ` + r.map((db, i) => `L${x(i * 0.5)},${y(db)}`).join(" ") + ` L${x(r.length * 0.5)},86 Z`;
  const bars = tr.segments.map((s) => `<rect x="${x(s.start)}" y="8" width="${Math.max(2, x(s.end) - x(s.start))}" height="12" rx="2" class="sp"><title>${esc(s.start)}–${esc(s.end)} s: ${esc(s.text)}</title></rect>`).join("");
  const ticks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((t) => `<line x1="${x(t)}" y1="86" x2="${x(t)}" y2="90" class="tick"/><text x="${x(t)}" y="95" class="tl">${t}</text>`).join("");
  return `<svg viewBox="0 0 ${Wd} 100" class="chart"><text x="2" y="18" class="lbl">speech</text><text x="2" y="60" class="lbl">loudness</text><path d="${area}" class="rms"/>${bars}<line x1="40" y1="86" x2="${Wd - 8}" y2="86" class="axis"/>${ticks}</svg>`;
}
function ssimSvg(curve, total, joins, planned) {
  const Wd = 900, H = 100, x = (t) => 40 + (t / total) * (Wd - 50), y = (v) => 86 - v * 72;
  const line = curve.map((v, i) => `${i ? "L" : "M"}${x(i * 0.5 + 0.25)},${y(v)}`).join(" ");
  const jl = joins.map((t) => `<line x1="${x(t)}" y1="10" x2="${x(t)}" y2="86" class="join"/><text x="${x(t) + 3}" y="20" class="tl">join ${t} s</text>`).join("");
  const pl = planned.map((t) => `<line x1="${x(t)}" y1="10" x2="${x(t)}" y2="86" class="planned"/><text x="${x(t) + 3}" y="20" class="tl">prompt: cut at ${t} s</text>`).join("");
  const ticks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((t) => `<line x1="${x(t)}" y1="86" x2="${x(t)}" y2="90" class="tick"/><text x="${x(t)}" y="95" class="tl">${t}</text>`).join("");
  return `<svg viewBox="0 0 ${Wd} ${H}" class="chart"><text x="2" y="18" class="lbl">1.0</text><text x="2" y="86" class="lbl">0</text><line x1="40" y1="14" x2="${Wd - 8}" y2="14" class="grid"/><line x1="40" y1="50" x2="${Wd - 8}" y2="50" class="grid"/>${pl}${jl}<path d="${line}" class="ssim"/><line x1="40" y1="86" x2="${Wd - 8}" y2="86" class="axis"/>${ticks}</svg>`;
}
const zClips = Z.result?.clips || [], zNar = Z.result?.narration || {}, zCredits = Z.calls.reduce((a, c) => a + (c.credits || 0), 0), zShown = zClips.reduce((a, c) => a + (c.credits || 0), 0) + 10;
const frameStrip = `<div class="strip"><table><tr><th></th>${TIMES.map((t) => `<th>${t} s</th>`).join("")}</tr><tr><th>MCP</th>${TIMES.map((t) => `<td><a href="/sessions/v4-report/frames/mcp-${t}.jpg" target="_blank"><img src="/sessions/v4-report/frames/mcp-${t}.jpg" alt=""></a></td>`).join("")}</tr><tr><th>V4</th>${TIMES.map((t) => `<td><a href="/sessions/v4-report/frames/v4-${t}.jpg" target="_blank"><img src="/sessions/v4-report/frames/v4-${t}.jpg" alt=""></a></td>`).join("")}</tr></table></div>`;
const zoo = `<section class="stage" id="zoo"><h2>2 · The zoo ad: one 45-second generation against four generations joined</h2>
<div class="brief"><b>The brief (given in full to both):</b> ${esc(Z.brief)}</div>
<div class="row">
<div class="side"><h4>MCP <span class="mut">· one create_video_from_text call · ltx-2.5 · 45 s · 480p · audio on · ${n1(ZM.spent)} credits · ${ZM.seconds} s wall time</span></h4>
<video class="v" src="${zooMcpUrl}" controls preload="metadata"></video>
<p><b>How it was made.</b> The chat model wrote one prompt with a timeline (lions 0–12 s, penguins 12–24 s, giraffes 24–36 s, card 36–45 s), the narration quoted inside it, and the exact card lines. Its first call was refused by the API (${esc(mcpCalls[0]?.error || "prompt over 2,000 characters")}); it shortened the prompt and called again. The video model composed the scenes, the dissolves between them, the music and the voice in one pass. Nothing was checked afterwards: it told the user to review the voice-over and the card lettering itself.</p>
<p><b>The sound, transcribed.</b> Speech from ${trMcp.segments[0]?.start ?? 0} s to ${lastSpeech(trMcp)} s (${speechSec(trMcp).toFixed(1)} s of speech in 45): <i>“${esc(trMcp.text4o)}”</i>. After that, music and ambience only: the narration the prompt wrote for 36–45 s was never spoken.</p>
${audioSvg(trMcp, measures.mcp.rms, 45)}
</div>
<div class="side"><h4>V4 <span class="mut">· story → 4 clips (15 + 15 + 10 + 5 s) on ltx-2.5 → join → voice by TTS mixed under · ${n1(zShown)} credits for the cut shown, ${n1(zCredits)} on the label</span></h4>
<video class="v" src="${zooV4Url}" controls preload="metadata"></video>
<p><b>How it was made.</b> The intent sheet took every parameter from the brief (no question asked). A story stage wrote a setting and one paragraph per clip; the clips were grouped into calls by place: lions 15 s, penguins 15 s, giraffe 10 s, each a text-to-video call with the model's audio off; the end card was painted as a still on qwen-image-2.1 (10 credits) and animated 5 s from that still; the four clips were joined by code and a ${esc(zNar.voice)} TTS voice-over of ${zNar.seconds} s was mixed under. Each clip was reviewed by a vision model (clip 1: a dissolve inside the clip at 8 s flagged; clip 4: the push-in stronger than asked). The label also paid for a superseded giraffe clip made from a still (360) and an unintended regeneration of clip 1 (360).</p>
<p><b>The sound, transcribed.</b> Speech from ${trV4.segments[0]?.start ?? 0} s to ${lastSpeech(trV4)} s (${speechSec(trV4).toFixed(1)} s of speech in 45): <i>“${esc(trV4.text4o)}”</i>. The script is V4's own, written at the story stage; the clips themselves are silent.</p>
${audioSvg(trV4, measures.v4.rms, 45)}
</div></div>
<h3>The same seconds, both films</h3>
<p class="mut">A frame every three seconds from each film, at the same times. Both films have three scene changes. The MCP's are dissolves the video model made on its own inside the one generation: lions to penguins at about 17 s, penguins to giraffe at 27–28 s (both scenes on screen at once), giraffe to the card from 34 to 36 s; the prompt had asked for clean cuts at 12, 24 and 36. V4's are hard joins made by code at 15, 30 and 40 s. Within a scene both are one continuous take.</p>
${frameStrip}
<h3>Frame-to-frame similarity (SSIM between frames half a second apart; a cut is a dip to near zero, a static card is near one)</h3>
<div class="row"><div class="side"><h4>MCP</h4>${ssimSvg(measures.mcp.ssim, 45, [], [12, 24, 36])}<p class="mut">No dip reaches zero: every scene change is a dissolve, so neighbouring frames stay alike through it. The low run at 27–33 s is the penguin-to-giraffe dissolve followed by a fast camera move on the giraffe; the grey dotted lines are where the prompt asked for cuts. From 36 s the card is still (near 1.0). The lion scene (0–15 s) runs at 0.4–0.5: a slow continuous push-in.</p></div>
<div class="side"><h4>V4</h4>${ssimSvg(measures.v4.ssim, 45, [15, 30, 40], [])}<p class="mut">The three code joins are the dips at 15, 30 and 40 s. The dip at 8 s inside clip 1 is the dissolve the reviewer flagged (the model cut from the wide meadow to the close-up on its own). The penguin and giraffe clips run low (0.1–0.4) because the camera moves and the animals fill the frame.</p></div></div>
<h3>The end card: the brief asked for exactly “Ridgeview Zoo” and “Open daily 9–5 · Kids under 5 free”, green and gold, a simple antelope mark</h3>
<div class="row"><div class="side"><h4>MCP <span class="mut">· frame at 42 s</span></h4><a href="/sessions/v4-report/frames/mcp-card.jpg" target="_blank"><img class="card" src="/sessions/v4-report/frames/mcp-card.jpg" alt=""></a><p class="mut">Reads “Rigedvew Zoo”, a second line “Opdeiiew Zo”, then “Open daily · Kids under 5 ⟨glyph⟩ free”; a walking giraffe as the mark; green and gold. Lettering generated inside the video model.</p></div>
<div class="side"><h4>V4 <span class="mut">· frame at 42 s</span></h4><a href="/sessions/v4-report/frames/v4-card.jpg" target="_blank"><img class="card" src="/sessions/v4-report/frames/v4-card.jpg" alt=""></a><p class="mut">Reads “Ridgeview Zoo” and “Open daily 9–5 · Kids under 5 free” exactly; an antelope mark; green on cream with a gold rule. Painted as a still on qwen-image-2.1, then animated from that still with the lettering locked.</p></div></div>
<details><summary>The MCP's prompts: the one refused for length (${mcpCalls[0]?.args?.style?.prompt?.length || "?"} characters) and the one that ran (${mcpCalls[1]?.args?.style?.prompt?.length || "?"})</summary>${mcpCalls.map((c, i) => `<h4>call ${i + 1}${c.error ? ` · refused: ${esc(c.error)}` : " · ran, 1,080 credits"}</h4><pre>${esc(JSON.stringify({ ...c.args, style: undefined }, null, 1))}</pre><pre>${esc(c.args.style?.prompt)}</pre>`).join("")}<h4>what it told the user</h4><pre>${esc(ZT.agent)}</pre></details>
<details><summary>V4's story, its four clip prompts, the narration script and its reviews</summary><h4>setting (from the story stage)</h4><pre>${esc(Z.story?.setting)}</pre>${zClips.map((c) => `<h4>clip ${c.n} · ${c.seconds} s · ${esc(c.model)} · ${esc(c.kind)} · ${c.credits} credits · reference: ${esc(c.reference)}${c.reference_used?.file ? ` (${esc(c.reference_used.file)})` : ""}</h4><pre>${esc(c.prompt)}</pre>${c.review ? `<div class="mut">review: ${c.review.pass ? "pass" : "fail"} · ${esc(c.review.artefacts)}${c.review.fix ? ` · fix: ${esc(c.review.fix)}` : ""}</div>` : ""}`).join("")}<h4>narration · ${esc(zNar.voice)} · ${zNar.seconds} s</h4><pre>${esc(zNar.script)}</pre><div class="grid four">${["clip-1", "clip-2", "clip-3g", "clip-4"].map((f, i) => `<div class="cell"><div class="mut">clip ${i + 1}</div><video class="v" src="/sessions/v4-report/zoo/${f}.mp4" controls preload="metadata"></video></div>`).join("")}</div></details>
</section>`;

// ---- part 3: the basics
function basics(id) {
  const it = items[id], f = full(id), m = mv(id), T = m.turns[0], v = verdicts[id];
  const v4File = f.result?.file, v4Url = v4File ? `/sessions/v4-report/full-${id}/${v4File}` : null, v4Tool = f.turns.at(-1)?.intent?.tool, job = Object.values(f.jobs || {})[0];
  const inputs = existsSync(join(MEDIA, `full-${id}`)) ? readdirSync(join(MEDIA, `full-${id}`)).filter((x) => x.startsWith("in-")) : [];
  const assetsDir = join(SESS, m.session, "assets"), mAssets = existsSync(assetsDir) ? readdirSync(assetsDir).filter((x) => /\.(png|jpg|jpeg|mp4)$/i.test(x)).sort() : [];
  const mCalls = T.calls.filter((c) => creation(c.name)).map((c) => { const a = mcpArgs(c); return { name: c.name, model: a.model, aspect: a.aspect_ratio, seconds: a.end_seconds, audio: a.audio, prompt: a.style?.prompt || a.prompt || "", error: !!c.error }; });
  const media = (url, file, tag) => (/\.mp4$/i.test(file) ? `<video class="v" src="${url}" controls preload="metadata"></video>${frames3(url, file, tag)}` : `<a href="${url}" target="_blank"><img class="out" src="${url}" alt=""></a>`);
  function frames3(url, file, tag) { const abs = url.startsWith("/sessions/") ? join(SESS, url.slice("/sessions/".length)) : null; if (!abs || !existsSync(abs)) return ""; const d = dur(abs), ts = [0.5, d / 2, Math.max(0.6, d - 0.4)]; return `<div class="f3">${ts.map((t, i) => { const out = join(MEDIA, "frames", `${tag}-${i}.jpg`); frameAt(abs, t, out, 320); return `<a href="/sessions/v4-report/frames/${tag}-${i}.jpg" target="_blank"><img src="/sessions/v4-report/frames/${tag}-${i}.jpg" alt=""></a>`; }).join("")}</div>`; }
  const extra = id === "S10" && existsSync(join(RUNS, "full-S10-v1", "run.json")) ? (() => { const f1 = full("S10-v1"); return `<div class="mut" style="margin-top:8px"><b>V4's first run</b> (the one the verdict judged): ${esc(f1.turns.at(-1)?.intent?.tool)} on ${esc(Object.values(f1.jobs)[0]?.model)} from the car photo as the start frame · ${f1.credits} credits</div>${media(`/sessions/v4-report/full-S10-v1/${f1.result.file}`, f1.result.file, "v4-S10v1")}<div class="mut">The run above it is the rerun under the two-reference rule: minimax-h3 with the car and the bridge as named references.</div>`; })() : "";
  return `<section class="item" id="b-${id}"><h3>${id} · ${esc(it.title)} <span class="mut">· ${v ? `verdict: <b>${esc(v.winner_side)}</b> (${esc(v.strength)})` : "no verdict"}</span></h3>
<div class="brief"><b>The brief:</b> ${esc(it.full)}${inputs.length ? `<div class="ins">${inputs.map((x) => `<a href="/sessions/v4-report/full-${id}/${x}" target="_blank"><img src="/sessions/v4-report/full-${id}/${x}" alt=""></a>`).join("")}<span class="mut">attached</span></div>` : ""}</div>
<div class="row">
<div class="side"><h4>MCP <span class="mut">· ${mCalls.length ? esc(mCalls.map((c) => `${c.name}${c.model ? ` (${c.model}${c.aspect ? `, ${c.aspect}` : ""}${c.seconds ? `, ${c.seconds} s` : ""}${c.audio === undefined ? "" : c.audio ? ", audio on" : ", silent"})` : ""}${c.error ? " ✗" : ""}`).join(" → ")) : "no creation call"} · ${m.spent} credits</span></h4>
${mAssets.length ? mAssets.map((x, i) => media(`/sessions/${m.session}/assets/${x}`, x, `mcp-${id}-${i}`)).join("") : `<div class="none">nothing made</div><pre>${esc(T.agent)}</pre>`}
${mCalls.length ? `<details><summary>its prompt${mCalls.length > 1 ? "s" : ""}</summary>${mCalls.map((c) => `<h4>${esc(c.name)}</h4><pre>${esc(c.prompt)}</pre>`).join("")}</details>` : ""}</div>
<div class="side"><h4>V4 <span class="mut">· ${esc(v4Tool)}${job ? ` (${esc(job.model)}${job.endpoint ? `, ${esc(job.endpoint.replace("/v1/", ""))}` : ""})` : f.result?.credits === 0 ? " (ffmpeg)" : ""} · ${f.credits} credits</span></h4>
${v4Url ? media(v4Url, v4File, `v4-${id}`) : `<div class="none">nothing made</div>`}
${f.result?.review ? `<div class="mut ev">V4's reviewer: <b>${f.result.review.pass ? "pass" : "fail"}</b> · ${esc(f.result.review.artefacts || "")}${f.result.review.lettering && f.result.review.lettering !== "None." ? ` · reads: ${esc(f.result.review.lettering)}` : ""}${f.result.review.fix ? ` · fix: ${esc(f.result.review.fix)}` : ""}</div>` : ""}
${f.result?.prompt || job?.prompt ? `<details><summary>its prompt</summary><pre>${esc(f.result?.prompt || job?.prompt)}</pre></details>` : ""}${extra}</div>
</div>
${v ? `<div class="verdict"><b>Recorded verdict: ${esc(v.winner_side)}</b> (${esc(v.strength)}; ${v.first === "A" ? "V4" : "MCP"} was shown first) · <span class="mut">${esc(v.why)}</span></div>` : ""}
</section>`;
}
const BAS = IDS.map(basics);
const tally = { V4: 0, MCP: 0, tie: 0 }; for (const id of IDS) { const v = verdicts[id]; if (v) tally[v.winner_side] = (tally[v.winner_side] || 0) + 1; }
const basSummary = `<table class="sum"><tr><th>item</th><th>brief</th><th>MCP</th><th>credits</th><th>V4</th><th>credits</th><th>verdict</th></tr>${IDS.map((id) => { const it = items[id], f = full(id), m = mv(id), v = verdicts[id], mc = m.turns[0].calls.filter((c) => creation(c.name)).map((c) => { const a = mcpArgs(c); return `${c.name}${a.model ? ` (${a.model})` : ""}`; }); const job = Object.values(f.jobs || {})[0]; return `<tr><td><a href="#b-${id}">${id}</a></td><td>${esc(it.title)}</td><td>${esc(mc.join(" → ") || "nothing made")}</td><td>${m.spent}</td><td>${esc(f.turns.at(-1)?.intent?.tool)}${job ? ` (${esc(job.model)})` : ""}</td><td>${f.credits}</td><td>${v ? `${esc(v.winner_side)} <span class=mut>(${esc(v.strength)})</span>` : "–"}</td></tr>`; }).join("")}</table>`;

// ---- part 4: stage 1, existing assets: every file each side made, and the other session's intention judge per point
const S1 = ["D01", "D02", "D06", "D07", "D08", "E01"], S1_EXTRA = { D08: ["D08-v2"] }, MS1 = join(V2, "bench/v1/results/mcp-stage1");
const judge = existsSync(join(RUNS, "judge-stage1.json")) ? J(join(RUNS, "judge-stage1.json")) : {};
const s1Items = Object.fromEntries(S1.filter((id) => existsSync(join(ITEMS, `${id}.json`))).map((id) => [id, J(join(ITEMS, `${id}.json`))]));
for (const id of S1) syncV4(id); for (const x of Object.values(S1_EXTRA).flat()) syncV4(x);
const dim = (abs) => { try { return sh("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", abs]).trim().split("\n")[0].replace(",", "×"); } catch { return ""; } };
const secs = (abs) => { try { return `${dur(abs).toFixed(1)} s`; } catch { return ""; } };
const mediaEl = (url, file) => (/\.mp4$/i.test(file) ? `<video class="v" src="${url}" controls preload="metadata"></video>` : `<a href="${url}" target="_blank"><img class="out" src="${url}" alt=""></a>`);
const v4Files = (label) => { const d = join(MEDIA, `full-${label}`); return existsSync(d) ? readdirSync(d).filter((f) => /\.(png|jpg|jpeg|mp4)$/i.test(f) && !/^in-|^peek|\.card\.png$/.test(f)).sort() : []; };
const inputsOf = (label) => { const d = join(MEDIA, `full-${label}`); return existsSync(d) ? readdirSync(d).filter((f) => /^in-.*\.(png|jpg|jpeg|mp4)$/i.test(f)) : []; };
function v4Side(label, title) {
  const f = full(label), files = v4Files(label), delivered = f.result?.file, tool = f.turns.at(-1)?.intent?.tool, look = (f.turns.at(-1)?.intent?.params || []).find((p) => p.name === "look");
  const steps = (f.result?.campaign || []).map((s) => `${s.n}. ${s.tool} → ${s.file} (${s.credits} cr)`).join(" · ");
  return `<div class="side"><h4>${esc(title)} <span class="mut">· ${esc(tool)}${steps ? ` · ${esc(steps)}` : ""}${f.result?.strategy ? ` · strategy: ${esc(f.result.strategy)}` : ""} · ${f.credits} credits · ${new Date(f.at).toISOString().replace("T", " ").slice(0, 16)} UTC</span></h4>
${look ? `<div class="mut">look: ${esc(look.value)} <span class="src ${esc(look.source)}">${esc(look.source)}</span> ${esc(look.from)}</div>` : ""}
<div class="files">${files.map((x) => { const abs = join(MEDIA, `full-${label}`, x); return `<div class="file"><div class="mut">${esc(x)}${x === delivered ? " · <b>delivered</b>" : ""} · ${dim(abs)}${/\.mp4$/i.test(x) ? ` · ${secs(abs)}` : ""}</div>${mediaEl(`/sessions/v4-report/full-${label}/${x}`, x)}</div>`; }).join("") || "<div class=none>nothing made</div>"}</div>
${Object.values(f.jobs || {}).length ? `<details><summary>its prompts</summary>${Object.entries(f.jobs).map(([k, v]) => `<h4>${esc(k)} · ${esc(v.model)} · ${v.credits} cr</h4><pre>${esc(v.prompt)}</pre>`).join("")}</details>` : ""}</div>`;
}
function mcpSide(id) {
  const p = join(MS1, `M${id}.json`); if (!existsSync(p)) return `<div class="side"><h4>MCP</h4><div class="none">no MCP run</div></div>`;
  const m = J(p), T = m.turns[0], dir = join(SESS, m.session, "assets"), assets = existsSync(dir) ? readdirSync(dir).filter((x) => /\.(png|jpg|jpeg|mp4)$/i.test(x)).sort() : [];
  const calls = T.calls.filter((c) => creation(c.name)).map((c) => { const a = mcpArgs(c); return `${c.name}${a.model ? ` (${a.model}${a.aspect_ratio ? `, ${a.aspect_ratio}` : ""})` : ""}${c.error ? " ✗" : ""}`; });
  return `<div class="side"><h4>MCP <span class="mut">· ${calls.length ? esc(calls.join(" → ")) : "no creation call"} · ${m.spent} credits</span></h4>
<div class="files">${assets.map((x) => { const abs = join(dir, x); return `<div class="file"><div class="mut">${esc(x)} · ${dim(abs)}${/\.mp4$/i.test(x) ? ` · ${secs(abs)}` : ""}</div>${mediaEl(`/sessions/${m.session}/assets/${x}`, x)}</div>`; }).join("") || `<div class="none">nothing made</div><pre>${esc((T.agent || "").slice(0, 1500))}</pre>`}</div>
${calls.length ? `<details><summary>its prompt${calls.length > 1 ? "s" : ""}</summary>${T.calls.filter((c) => creation(c.name)).map((c) => { const a = mcpArgs(c); return `<h4>${esc(c.name)}</h4><pre>${esc(a.style?.prompt || a.prompt || JSON.stringify(a, null, 1))}</pre>`; }).join("")}</details>` : ""}</div>`;
}
function judgeBlock(id) {
  const j = judge[id]; if (!j) return "";
  const row = (side) => (j[side]?.results || []).map((r) => `<tr><td>${mk(r.met === "yes" ? "ok" : r.met === "partly" ? "part" : r.met === "no" ? "bad" : "na")} ${esc(r.met)}</td><td>${esc(r.point)}</td><td class="mut">${esc(r.evidence)}</td></tr>`).join("");
  return `<details><summary>the other session's intention judge: MCP ${j.mcp?.overall ?? "–"} · V4 ${j.v4?.overall ?? "–"} (${j.checklist.points.length} points written from the user's words)</summary><div class="row"><div class="side"><h4>MCP · ${j.mcp?.overall ?? "–"}</h4><table class="pt">${row("mcp")}</table></div><div class="side"><h4>V4 · ${j.v4?.overall ?? "–"}</h4><table class="pt">${row("v4")}</table></div></div></details>`;
}
const S1_NOTE = {
  D01: "Measured with ffprobe, both outputs are exactly 5.000 s (the judge marked the trim point n/a from stills). The MCP's only route was a regenerating video edit; no frame of its clip carries the caption. V4 cut with ffmpeg and overlaid the words by code.",
  D07: "Both sides ran the brief above: the whole poster kept with padding, no cropping, no regeneration. V4's first run padded with ffmpeg for 0 credits; the revised resize rule (a vision model picks crop, pad or reflow) chose reflow, which re-composes on the free image editor at 10 credits a shape: the square is a faithful re-layout, the 9:16 is the poster between dark bars, the 16:9 is redrawn canyon art with the words kept. The item's text was then rewritten (at 01:26, after the run at 01:08) to ask for the opposite, each size filling its frame with no bars, and the intention judge at 01:32 wrote its checklist from the rewritten text; its 68 docks V4 for the bars and the padding the run was asked for. Neither side has run the rewritten brief. The MCP refused and offered a script.",
  D08: "Neither brief says anything about the look. V4's sheet filled look as a default, 'clean, bold, high-contrast typography, simple readable layout', and its image guide wrote a typeset page with no illustration: the plainness is V4's, not the user's. The other session changed both rules two minutes after this run (a poster must be designed, not typeset; a default look may never be 'clean, simple, readable'); the rerun below is the same brief under the changed rules. The MCP designed both deliverables on its own.",
};
const stage1 = `<section class="stage" id="stage1"><h2>4 · Stage 1, existing assets: every file each side made</h2>
<p>The other session's stage-1 items (V4/runs/full-D*, full-E01; the MCP arm in results/mcp-stage1) with every output file shown, not one per item, and its intention judge's points under each pair. MCP on the left, V4 on the right.</p>
${S1.filter((id) => s1Items[id] && existsSync(join(RUNS, `full-${id}`, "run.json"))).map((id) => { const it = s1Items[id], ins = inputsOf(id), extras = (S1_EXTRA[id] || []).filter((x) => existsSync(join(RUNS, `full-${x}`, "run.json"))), ran = full(id).brief; return `<section class="item" id="s1-${id}"><h3>${id} · ${esc(it.title)}</h3>
<div class="brief"><b>The brief, as both sides ran it:</b> ${esc(ran)}${it.full !== ran ? `<br><b>The item's text now reads:</b> ${esc(it.full)} <span class="mut">(rewritten after the run; the intention judge's checklist came from this text)</span>` : ""}${ins.length ? `<div class="ins">${ins.map((x) => (/\.mp4$/i.test(x) ? `<video class="in" src="/sessions/v4-report/full-${id}/${x}" controls preload="metadata"></video>` : `<a href="/sessions/v4-report/full-${id}/${x}" target="_blank"><img src="/sessions/v4-report/full-${id}/${x}" alt=""></a>`)).join("")}<span class="mut">attached</span></div>` : ""}</div>
${S1_NOTE[id] ? `<p class="note">${esc(S1_NOTE[id])}</p>` : ""}
<div class="row">${mcpSide(id)}${v4Side(id, "V4")}</div>
${extras.map((x) => `<div class="row"><div class="side"><h4>MCP <span class="mut">· unchanged, above</span></h4></div>${v4Side(x, `V4 rerun · ${x}`)}</div>`).join("")}
${judgeBlock(id)}</section>`; }).join("")}
</section>`;

// ---- the page
const TITLE = "V4 against the MCP: the conversation, the zoo, the basics";
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(TITLE)}</title><style>
body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:0;background:#f5f5f4;color:#222}header{background:#fff;border-bottom:1px solid #ddd;padding:12px 18px}h1{font-size:19px;margin:0 0 4px}h2{font-size:17px;margin:0 0 8px}h3{font-size:14px;margin:12px 0 6px}h4{font-size:13px;margin:8px 0 4px}
main{padding:8px 18px;max-width:1700px;margin:0 auto}.stage{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:12px 0}.item{border-top:1px solid #e5e5e5;padding:8px 0 4px}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:900px){.row{grid-template-columns:1fr}}.side{min-width:0}
pre{white-space:pre-wrap;background:#fafaf9;padding:8px;font-size:12px;margin:4px 0;border-radius:6px;max-height:420px;overflow:auto}video.v{width:100%;max-height:360px;background:#000;border:1px solid #ddd}img.out{max-width:100%;max-height:360px;border:1px solid #ddd;display:block}img.card{width:100%;border:1px solid #ddd;display:block}
table{border-collapse:collapse;font-size:13px;margin:6px 0}td,th{border:1px solid #ddd;padding:3px 8px;vertical-align:top;text-align:left}.sum th,.sum td{font-size:12.5px}.mut{color:#777;font-size:12px}.brief{background:#fafaf9;border-left:3px solid #ccc;padding:6px 10px;margin:6px 0}details{font-size:13px;margin:4px 0}summary{cursor:pointer;color:#444}
.chat{display:flex;flex-direction:column;gap:5px;margin:6px 0}.m{max-width:88%;padding:7px 11px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap}.m.user{align-self:flex-end;background:#2f5d8a;color:#fff;border-bottom-right-radius:4px}.m.assistant{align-self:flex-start;background:#e8eef5;border-bottom-left-radius:4px}.m.closing{border:1px dashed #9ab;background:#f3f6f9}
.pt{width:100%}.pt td:first-child{color:#555;width:90px}.mk{display:inline-block;min-width:16px;text-align:center;font-weight:700;border-radius:4px;padding:0 4px}.mk.ok{color:#166534;background:#dcfce7}.mk.bad{color:#991b1b;background:#fee2e2}.mk.part{color:#92400e;background:#fef3c7}.mk.na{color:#999}
.src{padding:0 6px;border-radius:9px;font-size:11px}.src.user{background:#dcfce7;color:#166534}.src.derived{background:#dbeafe;color:#1e40af}.src.default{background:#fef3c7;color:#92400e}.src.missing{background:#fee2e2;color:#991b1b}.ev{margin-top:6px}
.chart{width:100%;height:auto;display:block;background:#fff;border:1px solid #eee;border-radius:6px;margin:4px 0}.chart .rms{fill:#cbd5e1;stroke:none}.chart .sp{fill:#2f5d8a}.chart .axis{stroke:#999;stroke-width:1}.chart .tick{stroke:#999}.chart .tl{font-size:10px;fill:#666}.chart .lbl{font-size:10px;fill:#888}.chart .grid{stroke:#eee}.chart .ssim{fill:none;stroke:#2f5d8a;stroke-width:1.5}.chart .join{stroke:#b91c1c;stroke-width:1.5;stroke-dasharray:4 3}.chart .planned{stroke:#999;stroke-dasharray:2 3}
.strip{overflow-x:auto}.strip table{border:0}.strip td,.strip th{border:0;padding:2px;font-size:11px;color:#666;text-align:center}.strip img{width:150px;display:block;border:1px solid #ddd}.f3{display:flex;gap:4px;margin:4px 0}.f3 img{width:32%;border:1px solid #ddd}.ins{margin-top:6px}.ins img{height:70px;border:1px solid #ddd;margin-right:6px;vertical-align:middle}
.verdict{border-top:1px dashed #ddd;margin-top:6px;padding-top:4px;font-size:13px}.none{color:#999;font-style:italic;padding:12px;border:1px dashed #ccc;border-radius:6px}.grid.four{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.cell{min-width:0}.kpi{display:flex;flex-wrap:wrap;gap:14px;margin:6px 0}.kpi div{background:#fafaf9;border:1px solid #e5e5e5;border-radius:6px;padding:6px 10px;font-size:13px}.kpi b{font-size:16px}
nav a{margin-right:14px}.files{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.file{min-width:180px;max-width:48%}.file img.out{max-height:320px}.file video.v{max-height:260px;min-width:280px}.ins video.in{height:90px;border:1px solid #ddd;margin-right:6px;vertical-align:middle;background:#000}.note{background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;margin:6px 0;font-size:13px}
</style></head><body><header><h1>${esc(TITLE)}</h1><div class="mut">MCP on the left of every pair, V4 on the right. MCP = the agent's chat model with Magic Hour's 44 MCP tools and nothing else, the free plan emulated by an approval gate, the same proxy user answering from the same answer sheet (bench/mcp/run.mjs: mcp-intent, mcp-v4). V4 = the small agent in V4/: an intent sheet with a source for every parameter, plain questions for what is missing, code guards, one call, a vision review (V4/runs: dry-*, full-*). Built by bench/mcp/v4-report.mjs on ${new Date().toISOString().slice(0, 10)}.</div>
<nav><a href="#conv">1 · the conversation</a><a href="#zoo">2 · the zoo ad</a><a href="#basics">3 · the thirteen basics</a><a href="#stage1">4 · stage 1, existing assets</a></nav></header><main>

<section class="stage" id="conv"><h2>1 · The conversation: thirteen vague briefs, the same proxy user, the same answers available to both</h2>
<p>Each brief is deliberately vague ("make a poster for our open mic night"). The proxy user holds an answer sheet (the words, where it will be shown, how long, what sound) and answers only what it is asked. The MCP side ran with the gate at 0 credits, so its <b>attempted call</b> is the record of what it would have made; V4's dry run ends in its sheet and the tool it would call. Neither spent credits here. The table marks each side's result against the sheet: ${mk("ok")} matches what the user wanted, ${mk("bad")} a guess that missed (or a value never asked for), ${mk("part")} near (tall but not A4's 3:4), ${mk("na")} the sheet had nothing to say.</p>
<div class="kpi"><div>asked the user something<br><b>MCP ${askedMcp} of 13</b> · <b>V4 ${askedV4} of 13</b></div><div>parameters that ended wrong against the sheet<br><b>MCP ${missMcp}</b> · <b>V4 ${missV4}</b></div><div>V4 ended on the expected tool<br><b>${CONV.filter((c) => c.v4.tool === c.v4.expected).length} of 13</b></div><div>on the 152 micro items (bench v1, where 153 of 163 items expect no question)<br><b>MCP asked on 14 items, the V2 agent on 1</b></div></div>
<p><b>Does the MCP ask?</b> Sometimes, on its own judgement: here on 3 of 13 (the poster's words, how to trim, which face goes where), each a good question. Where it did not ask it guessed: a 1:1 product shot for a user who wanted a wide banner, 5-second clips where the user wanted 6 and 10, a landscape clip with sound for a TikTok user, its own sale copy. V4 asks by rule: a parameter the tool needs and the brief does not give is <i>missing</i> and becomes a plain question (at most three a turn), so it asked on 9 of 13. Its misses are the mirror image: an edit or an animation has no shape field in its sheet, so it never learns the banner is wide (S01), the LinkedIn post is landscape (S11), the Instagram post is square (V02), and on S01 neither side asked what the change should be: the MCP planned an ivory 1:1 shot, V4 a white-background polish, while the user wanted marble, soft studio light and a wide banner.</p>
${convSummary}
${convCards}
<details><summary>V4's other dry runs (no MCP counterpart on this page): what it asked and where it ended</summary><table class="sum"><tr><th>item</th><th>title</th><th>the vague brief</th><th>asked</th><th>ended on</th></tr>${extras.join("")}</table></details>
</section>

${zoo}

<section class="stage" id="basics"><h2>3 · The thirteen basics, given in full: both outputs side by side</h2>
<p>The same thirteen briefs written out completely (no back-and-forth). V4 spent ${IDS.reduce((a, id) => a + (full(id).credits || 0), 0)} credits from the ledger, the MCP ${IDS.reduce((a, id) => a + (mv(id).spent || 0), 0)} from the account. The verdict column is the recorded pairwise vision judge (V4/runs/compare-verdicts.json, random order): <b>V4 ${tally.V4} · MCP ${tally.MCP} · tie ${tally.tie}</b>; S07 has no verdict because the MCP made nothing (no trim tool). Look at each pair and say which to fix.</p>
${basSummary}
${BAS.join("")}
</section>
${stage1}
</main></body></html>`;
writeFileSync(join(OUT, "index.html"), html);
console.log(`${OUT}/index.html (${(html.length / 1024).toFixed(0)} KB) → http://localhost:4748/${OUT.split("/").pop()}/`);
console.log(`conversation: MCP asked on ${askedMcp}, V4 on ${askedV4}; misses MCP ${missMcp}, V4 ${missV4}; basics verdicts ${JSON.stringify(tally)}`);
for (const c of CONV) console.log(`${c.id} MCP ${c.mcp.tool || "no call"} ${JSON.stringify(c.mm)} | V4 ${c.v4.tool} ${JSON.stringify(c.m4)}`);
