// Run page for the state-graph pipeline: header, final video, measures, failed checks, beats with lineage and attempts, the state
// graph per entity, the frame graph, the cue sheet, decisions, every API call, beats not run. renderTimeline: the state timeline alone.
import { existsSync } from "node:fs";
import { join } from "node:path";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = (o) => `<pre>${esc(JSON.stringify(o, null, 1))}</pre>`;
const line = (x) => esc(typeof x === "string" ? x : JSON.stringify(x));
const mmss = (s) => s == null ? "?" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const faults = (c) => [...(c?.hard || []).map((x) => `hard: ${line(x)}`), ...(c?.soft || []).map((x) => `soft: ${line(x)}`)];
const outcome = (a, all) => a.accepted ? (a.forced ? ["forced", "accepted (forced)"] : ["ok", a.fallback ? `accepted (fallback seed ${esc(a.seed)})` : "accepted"])
  : ["bad", all.some((b) => b.k > a.k) ? (all.find((b) => b.k > a.k)?.fallback ? "rejected → fell back to another seed" : "rejected → retried") : "rejected"];
const CSS = `:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--ok:#4f7a3a;--bad:#a0402d;--warn:#c27a1e;--card:#fbf7ef}*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1100px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:30px}
h2{font-weight:normal;font-size:24px;border-top:1px solid var(--line);padding-top:20px;margin-top:40px}h3{font-weight:normal;color:var(--soft);font-size:16px;margin:22px 0 6px}
.soft{color:var(--soft)}.small{font-size:13px}.lab{font-variant:small-caps;color:var(--soft);margin:6px 0 0}.red{color:var(--bad)}.green{color:var(--ok)}.orange{color:var(--warn)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}img,video{width:100%;display:block;border:1px solid var(--line)}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}.card{flex:0 0 200px;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--ok);padding:8px;font-size:13px}
.card.bad{border-top-color:var(--bad)}.card.forced{border-top-color:var(--warn)}.card img{margin-bottom:6px}.thumb{max-width:220px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;font-weight:normal;vertical-align:top}tr.cont td{background:#eef0dc}
.wrap{overflow-x:auto}pre{white-space:pre-wrap;font-size:12px;margin:4px 0}details{margin-top:4px}summary{cursor:pointer;color:var(--soft)}
.ver{border-left:3px solid var(--line);padding-left:10px;margin:10px 0}.tl{position:relative;border:1px solid var(--line);background:var(--card);margin:10px 0}
.lane{position:relative;height:30px;border-bottom:1px dashed var(--line)}.lane>span.n{position:absolute;left:4px;top:6px;font-size:11px;color:var(--soft);z-index:1}
.bar{position:absolute;top:4px;height:22px;background:#d9cbb4;border:1px solid var(--soft);font-size:11px;overflow:hidden;white-space:nowrap;padding:2px 4px}.bar.m{background:#e3d4ef}
.flag{position:absolute;top:2px;font-size:10px;white-space:nowrap;border-left:2px solid var(--bad);padding-left:2px}.flag.sfx{border-left-color:var(--ok)}
@media(max-width:760px){.two{grid-template-columns:1fr}}`;
const doc = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

export function renderPage(log, graph, runDir) {
  const has = (f) => f && existsSync(join(runDir, f));
  const img = (f, cls = "") => has(f) ? `<img src="${esc(f)}" loading="lazy"${cls ? ` class="${cls}"` : ""}>` : "";
  const beats = log.timeline?.beats || [], run = log.beats_run || [], m = log.measures, frames = graph?.frames || [];
  const fr = (id) => frames.find((f) => f.id === id);
  const fdesc = (id) => { const f = fr(id); return f ? `${esc(id)} (beat ${f.beat}, ${esc(f.role)})` : esc(id); };
  const llm = log.llm || {};

  // 1. header
  const head = `<h1>${esc(log.case?.title)} · pipeline state-graph</h1><p class="soft">${esc(log.case?.request)}</p>
<p class="soft">models: ${Object.entries(log.models || {}).map(([k, v]) => `${esc(k)} ${esc(typeof v === "string" ? v : JSON.stringify(v))}`).join(" · ")}<br>
${log.total_credits ?? "?"} credits · wall ${mmss(log.time_s)} · beats ${run.length}/${beats.length} run · LLM ${llm.calls ?? 0} calls (${llm.cached ?? 0} cached), ${llm.input_tokens ?? 0} in / ${llm.output_tokens ?? 0} out tokens</p>
${log.stopped ? `<p class="red">stopped: ${esc(log.stopped)}</p>` : ""}${log.errors?.length ? `<table>${log.errors.map((e) => `<tr><td class="red">beat ${esc(e.beat)}</td><td>${esc(e.error)}</td></tr>`).join("")}</table>` : ""}`;

  // 2. final video
  const vid = has("final.mp4") ? `<video src="final.mp4" controls playsinline></video>` : has("picture.mp4") ? `<video src="picture.mp4" controls playsinline></video><p class="soft small">picture only (no final mix)</p>` : `<p class="soft">no video yet</p>`;

  // 3. measures
  const clips = Object.entries(m?.clips || {});
  const pf = (j) => j.pass == null ? "" : j.pass ? '<span class="green">pass</span>' : '<span class="red">fail</span>';
  const meas = m ? `<h2>Measures</h2><div class="wrap"><table><tr><th>Join</th><th>Link</th><th>Seam SSIM</th><th>Jump (median ${m.median_jump})</th><th>S</th><th>V (before)</th><th>L (before)</th><th>Dropped</th><th>Seam</th></tr>${(m.joins || []).map((j) =>
    `<tr${j.link === "continuous" ? ' class="cont"' : ""}><td>${esc(j.from)} → ${esc(j.to)}</td><td>${esc(j.link)}</td><td>${j.seam_ssim ?? ""}</td><td>${j.jump ?? ""}</td><td${j.link === "continuous" && j.S < 0.6 ? ' class="red"' : ""}>${j.S ?? ""}</td><td${j.link === "continuous" && (j.V < 0.8 || j.V > 1.25) ? ' class="red"' : ""}>${j.V ?? ""} <span class="soft">(${j.before?.V ?? ""})</span></td><td${j.link === "continuous" && j.L >= 1 ? ' class="red"' : ""}>${j.L ?? ""} <span class="soft">(${j.before?.L ?? ""})</span></td><td>${j.dropped ?? ""}</td><td>${pf(j)}</td></tr>`).join("")}</table></div>
${clips.length ? `<div class="wrap"><table class="small"><tr><th>Clip</th><th>First vs start</th><th>Frames</th><th>Ramp frames</th><th>Head speed</th><th>Tail speed</th><th>End snap</th><th>Frame 0 luma</th><th>Dropped</th><th>Luma offsets</th></tr>${clips.map(([id, c]) => `<tr><td>${esc(id)}</td><td>${c.first_vs_start ?? ""}</td><td>${c.frames ?? ""}</td><td>${c.ramp_frames ?? ""}</td><td>${c.head_speed ?? ""}</td><td>${c.tail_speed ?? ""}</td><td>${c.end_snap ?? ""}</td><td>${c.frame0_luma_offset ?? ""}</td><td>${c.dropped ?? ""}</td><td>${esc((c.luma_offsets || []).join(", "))}</td></tr>`).join("")}</table></div>` : ""}
<p class="soft small">seam SSIM: similarity of the last frame before the join and the first frame after it (1 = same image). jump: raw pixel change across the join in the final cut; large at a cut by design.<br>
S: brightness-compensated step across the join / median step of both clips (clean 0.7–1.3; below 0.5 = a stall frame). V: speed of the first 10 frames after the join / speed of the last 10 before it (clean 0.8–1.25; below = motion reset). L: |luma step at the join| + |luma ramp over the next 5 frames| (clean below 1.0). Values in brackets are before the seam fix (raw clips).<br>
ramp frames: frames until the clip reaches 0.7× its median speed. head / tail speed: first / last 10 frames vs the clip median. end snap: largest of the last 2 steps vs median (freeze-then-snap shows as a large value). frame 0 luma: how much darker the clip's first frame is than its own level. dropped: head frames removed at a continuous join; luma offsets: added to the first kept frames.</p>` : "";

  // 4. failed checks
  const failed = run.flatMap((n) => (log.beats?.[n]?.attempts || []).filter((a) => faults(a.checks).length).map((a) => ({ n, a, all: log.beats[n].attempts })));
  const fails = `<h2>Failed checks</h2>${failed.length ? `<table>${failed.map(({ n, a, all }) => { const [c, t] = outcome(a, all);
    return `<tr><td>beat ${n}</td><td>attempt ${a.k}</td><td>${faults(a.checks).join("<br>")}</td><td class="${c === "ok" ? "green" : c === "forced" ? "red" : "orange"}">${t}</td></tr>`; }).join("")}</table>` : `<p class="soft">No failed checks.</p>`}`;

  // 5. beats
  const ent = (e) => `<b>${esc(e.id)}</b>: ${esc(e.wardrobe)} / ${esc(e.pose)} / ${esc(e.position)} / with ${esc((e.interacting_with || []).join(", ") || "none")} / ${esc(e.condition)} / ${esc(e.lighting)}`;
  const beatHtml = run.map((n) => {
    const b = beats.find((x) => x.n === n) || {}, L = log.beats?.[n] || {}, p = L.plan, last = fr(L.last_frame);
    const lin = p ? `${p.seed ? `seeded from ${fdesc(p.seed)}` : "no seed (fresh)"} — ${esc(p.why)}${p.merges?.length ? `<br>merged: ${p.merges.map((x) => `${esc((x.ids || []).join(", "))} from ${fdesc(x.frame)}`).join(" + ")}` : ""}${p.fresh?.length ? `<br>new: ${esc(p.fresh.join(", "))}` : ""}` : "";
    const carry = L.carry ? `<p class="lab">continuous start: the real last frame of beat ${n - 1}${L.carry.missing?.length ? ` · missing ${esc(L.carry.missing.join(", "))}${L.carry.repaired ? " → repaired" : " → not repaired"}` : ""}</p>` : "";
    const atts = (L.attempts || []).map((a) => { const [c, t] = outcome(a, L.attempts);
      return `<div class="card ${c === "ok" ? "" : c}">${img(a.file)}attempt ${a.k}${a.seed ? ` · seed ${esc(a.seed)}` : ""}${a.frame ? ` · ${esc(a.frame)}` : ""}<br><span class="${c === "ok" ? "green" : c === "forced" ? "orange" : "red"}">${a.accepted ? (a.forced ? "accepted (forced)" : "accepted") : "rejected"}</span>
${faults(a.checks).map((x) => `<br><span class="soft">${x}</span>`).join("")}<details><summary>prompt</summary>${esc(a.prompt)}<br><span class="soft">inputs: ${esc((a.inputs || []).join(", ") || "none")}</span></details></div>`; }).join("");
    const shows = last?.shows ? Object.entries(last.shows).map(([id, s]) => `${esc(id)}: ${s.ok ? '<span class="green">ok</span>' : `<span class="red">${esc((s.problems || []).join("; ") || "not ok")}</span>`}`).join(" · ") : "";
    return `<h3>Beat ${n} · ${esc(b.link)} · ${esc(b.location)} · ${esc(b.time)}, ${esc(b.weather)}</h3><p>${esc(b.action)} <span class="soft">${esc(b.camera)}</span></p><div class="two">
<div>${img(L.start_file)}${carry}<p class="soft small">${lin}</p><details><summary>wanted state</summary><p class="small">${(b.start?.entities || []).map(ent).join("<br>")}</p></details></div>
<div>${has(L.clip) ? `<video src="${esc(L.clip)}" controls playsinline></video>` : `<p class="soft">no clip</p>`}<p class="soft small">${esc(L.video_prompt)}</p></div></div>
${atts ? `<div class="row">${atts}</div>` : ""}${img(`b${n}-strip.jpg`)}
${L.last_file ? `<div class="two"><div>${img(L.last_file, "thumb")}</div><p class="small">last frame ${esc(L.last_frame)}${shows ? `<br>${shows}` : ""}</p></div>` : ""}`;
  }).join("");

  // 6. state graph and lineage
  const lin = graph?.lineage ? graph.lineage() : {};
  const lineage = Object.entries(lin).map(([id, e]) => `<h3><b>${esc(id)}</b> <span class="soft">${esc(e.kind)} · ${esc(e.size)}</span></h3><p class="soft small">${esc(e.look)}</p>${(e.versions || []).map((v) =>
    `<div class="ver"><p class="small">v${v.v}${v.continues ? ` ← continues ${esc(v.continues)}` : ""} · since beat ${esc(v.since_beat)}${v.cause ? ` · ${esc(v.cause)}` : ""}<br><span class="soft">${esc(v.wardrobe)} · ${esc(v.condition)}</span></p>
<div class="row">${(v.frames || []).map((f) => `<div class="card ${f.ok ? "" : "bad"}">${img(f.file)}<b>${esc(f.id)}</b> · beat ${esc(f.beat)} ${esc(f.role)}${f.accepted ? "" : " (rejected)"}<br>${f.ok ? '<span class="green">ok</span>' : `<span class="red">${esc((f.problems || []).join("; "))}</span>`}
${f.seed ? `<br>seed ← ${esc(f.seed)}` : ""}${f.merged?.length ? `<br>merged ← ${esc(f.merged.join(", "))}` : ""}</div>`).join("")}</div></div>`).join("")}`).join("");
  const fgraph = frames.map((f) => `${esc(f.id)} (beat ${esc(f.beat)} ${esc(f.role)}) ← ${f.seed ? `seed ${esc(f.seed)}` : "no seed"}${f.merged?.length ? ` + merged ${esc(f.merged.join(", "))}` : ""} · ${esc(f.op)} · ${f.accepted ? (f.forced ? "forced" : "accepted") : "rejected"}`).join("\n");

  // 7. cue sheet
  const cues = log.cues || {}, total = Math.max(1, ...[...(cues.beds || []), ...(cues.music || [])].map((x) => x.end_s || 0));
  const pct = (s) => `${(100 * (s || 0) / total).toFixed(2)}%`;
  const barL = (x, cls, label) => `<div class="bar ${cls}" style="left:${pct(x.start_s)};width:${pct((x.end_s || 0) - (x.start_s || 0))}" title="${esc(label)}">${esc(label)}</div>`;
  const flag = (at, cls, label) => `<span class="flag ${cls}" style="left:${pct(at)}" title="${esc(label)}">${esc(label)}</span>`;
  const tl = (cues.beds || cues.music) ? `<div class="tl"><div class="lane"><span class="n">beds</span>${(cues.beds || []).map((b) => barL(b, "", `${b.location} ${b.ambience}`)).join("")}</div>
<div class="lane"><span class="n">music</span>${(cues.music || []).map((c) => barL(c, "m", c.cue)).join("")}</div>
<div class="lane"><span class="n">events</span>${(cues.music || []).flatMap((c) => (c.events || []).map((e) => flag(e.at_s, "", `${e.event} ${c.cue}`))).join("")}</div>
<div class="lane"><span class="n">sfx</span>${(cues.sfx || []).map((s) => flag(s.at_s, "sfx", s.sound)).join("")}</div></div><p class="soft small">0 s — ${total} s</p>` : "";
  const cueHtml = log.cues ? `<h2>Cue sheet</h2>${tl}<div class="wrap"><table class="small"><tr><th>Bed</th><th>Location</th><th>Time, weather</th><th>Ambience</th><th>s</th><th>Beats</th></tr>${(cues.beds || []).map((b) => `<tr><td>${esc(b.id)}</td><td>${esc(b.location)}</td><td>${esc(b.time)}, ${esc(b.weather)}</td><td>${esc(b.ambience)}</td><td>${b.start_s}–${b.end_s}</td><td>${esc((b.beats || []).join(", "))}</td></tr>`).join("")}</table>
<table class="small"><tr><th>Music cue</th><th>s</th><th>Beats</th><th>Events</th></tr>${(cues.music || []).map((c) => `<tr><td>${esc(c.cue)}</td><td>${c.start_s}–${c.end_s}</td><td>${esc((c.beats || []).join(", "))}</td><td>${(c.events || []).map((e) => `${esc(e.event)} @ ${e.at_s}s (beat ${esc(e.beat)})`).join("<br>")}</td></tr>`).join("")}</table>
<table class="small"><tr><th>SFX beat</th><th>At</th><th>Entity</th><th>Change</th><th>Sound</th></tr>${(cues.sfx || []).map((s) => `<tr><td>${esc(s.beat)}</td><td>${s.at_s}s</td><td>${esc(s.entity)}</td><td>${esc(s.change)}</td><td>${esc(s.sound)}</td></tr>`).join("")}</table>
<table class="small"><tr><th>Clip</th><th>Clip sound</th></tr>${Object.entries(cues.clip_sound || {}).map(([n, s]) => `<tr><td>beat ${esc(n)}</td><td>${esc(s)}</td></tr>`).join("")}</table></div>
${cues.notes?.length ? `<ul class="small">${cues.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${log.audio_mix ? `<details><summary>audio mix</summary>${js(log.audio_mix)}</details>` : ""}` : "";

  // 8. decisions, 9. calls and jobs, 10. not run
  const decs = (graph?.decisions || []).map(({ at, beat, kind, ...rest }) => `<tr><td>${esc(String(at || "").slice(11, 19))}</td><td>${esc(beat)}</td><td>${esc(kind)}</td><td><details><summary>${esc(JSON.stringify(rest).slice(0, 80))}</summary>${js(rest)}</details></td></tr>`).join("");
  const calls = log.calls || [], byEp = {};
  for (const c of calls) byEp[c.endpoint] = (byEp[c.endpoint] || 0) + (c.credits || 0);
  const callHtml = `<h2>API calls (${calls.length})</h2><div class="wrap"><table class="small"><tr><th>Key</th><th>Endpoint</th><th>Credits</th><th>s</th><th>At</th></tr>${calls.map((c) => `<tr><td>${esc(c.key)}</td><td>${esc(c.endpoint)}</td><td>${c.credits ?? ""}</td><td>${c.seconds ?? ""}</td><td>${esc(c.at)}${c.error ? `<br><span class="red">${esc(c.error)}</span>` : ""}</td></tr>`).join("")}
${Object.entries(byEp).map(([ep, cr]) => `<tr><th>total</th><th>${esc(ep)}</th><th>${cr}</th><th></th><th></th></tr>`).join("")}</table></div>
${Object.entries(log.jobs || {}).map(([k, j]) => `<details><summary>${esc(k)} · ${esc(j.endpoint)} · ${j.credits ?? "?"} credits · ${j.wall_s ?? j.seconds ?? "?"} s</summary><p class="small">inputs: ${esc(JSON.stringify(j.inputs ?? null))} · output: ${esc(JSON.stringify(j.output ?? null))} · at ${esc(j.at)}</p>${js(j.request)}</details>`).join("")}`;
  const rest = beats.filter((b) => !run.includes(b.n));
  return doc(`${log.case?.title || "Run"} · state-graph`, `${head}${vid}${meas}${fails}<h2>Beats</h2>${beatHtml}
<h2>State graph and lineage</h2>${lineage}<h3>Frame graph</h3><pre>${fgraph}</pre>${cueHtml}
<h2>Decisions (${graph?.decisions?.length || 0})</h2><div class="wrap"><table class="small"><tr><th>Time</th><th>Beat</th><th>Kind</th><th>Details</th></tr>${decs}</table></div>${callHtml}
${rest.length ? `<h2>Planned, not run (${rest.length} beats)</h2><table class="small">${rest.map((b) => `<tr><td>${b.n}</td><td>${esc(b.link)}</td><td>${esc(b.location)}</td><td>${esc(b.action)}</td></tr>`).join("")}</table>` : ""}`);
}

export function renderTimeline(t) {
  const st = (fs) => (fs?.entities || []).map((e) => `<b>${esc(e.id)}</b>: ${esc(e.wardrobe)} / ${esc(e.pose)} / ${esc(e.position)} / with ${esc((e.interacting_with || []).join(", ") || "none")} / ${esc(e.condition)} / ${esc(e.lighting)}`).join("<br>");
  const ents = `<table class="small"><tr><th>Id</th><th>Kind</th><th>Look</th><th>Size</th><th>Upload</th></tr>${(t.entities || []).map((e) => `<tr><td>${esc(e.id)}</td><td>${esc(e.kind)}</td><td>${esc(e.look)}</td><td>${esc(e.size)}</td><td>${esc(e.upload ?? "")}</td></tr>`).join("")}</table>`;
  const beats = (t.beats || []).map((b) => `<h3>Beat ${b.n} · ${esc(b.link)} · ${b.seconds}s · ${esc(b.location)} · ${esc(b.time)}, ${esc(b.weather)}</h3><p>${esc(b.action)} <span class="soft">${esc(b.camera)}</span></p>
<div class="two small"><div><p class="lab">start · ${esc(b.start?.framing)}</p><p>${esc(b.start?.description)}</p>${st(b.start)}</div><div><p class="lab">end · ${esc(b.end?.framing)}</p><p>${esc(b.end?.description)}</p>${st(b.end)}</div></div>
${b.changes?.length ? `<p class="small">changes: ${b.changes.map((c) => `${esc(c.id)}.${esc(c.attr)}: ${esc(c.from)} → ${esc(c.to)} <span class="${c.carry === "forward" ? "orange" : "soft"}">[${esc(c.carry)}]</span> ♪ ${esc(c.sound)}`).join("<br>")}</p>` : ""}
<p class="soft small">${b.continues?.length ? `continues: ${b.continues.map((c) => `${esc(c.id)} ← beat ${c.from_beat}`).join(", ")} · ` : ""}ambience: ${esc(b.ambience)} · music: ${esc(b.music?.cue)} (${esc(b.music?.event)})</p>`).join("");
  return doc("State Timeline", `<h1>State timeline</h1><p class="soft">${esc(t.style)}</p><h2>Entities</h2>${ents}<h2>Beats (${(t.beats || []).length})</h2>${beats}
${t.layers?.length ? `<h2>Text layers</h2><table class="small">${t.layers.map((l) => `<tr><td>${esc(l.text)}</td><td>${l.start_s}–${l.end_s}s</td><td>${esc(l.position)}</td></tr>`).join("")}</table>` : ""}`);
}
