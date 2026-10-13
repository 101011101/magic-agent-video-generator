// Run page for pipeline-memory: totals, final video, judge, seam measures before/after, each scene shot by shot
// (start frame with its lineage, clip, strip, prompts, checks, carry, judge), audio cue sheet, memory (entity versions,
// instance lineage, keyframe lineage) and every API call. Renders only the fields and files that exist.
import { existsSync } from "node:fs";
import { join } from "node:path";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x, d = 3) => (typeof x === "number" ? String(Math.round(x * 10 ** d) / 10 ** d) : esc(x ?? "–"));
const list = (xs) => (Array.isArray(xs) ? xs : xs ? [xs] : []).map(esc).join(", ");
const TYPE_COLORS = ["#4f7a3a", "#a0402d", "#3d6a8a", "#b0822e", "#7a4f8a", "#5c7a74", "#8a5c3d"];
const DIMS = ["action_adherence", "entity_fidelity", "scale_and_interaction", "spatial_continuity", "visual_quality"];

export function renderPage(log, runDir) {
  const has = (f) => !!f && existsSync(join(runDir, f));
  const img = (f, cls = "") => (has(f) ? `<img src="${esc(f)}" loading="lazy"${cls ? ` class="${cls}"` : ""}>` : "");
  const plan = log.plan || {}, shots = plan.shots || [], scenes = log.scenes || [];
  const shot = Object.fromEntries(shots.map((s) => [s.id, s]));
  const mem = log.memory || {}, bank = mem.bank || [];
  const bankById = Object.fromEntries(bank.map((b) => [b.id, b]));
  const fileOf = (ref) => bankById[ref]?.file || (/\.(png|jpe?g|webp)$/i.test(ref || "") ? ref : null);
  const judgeShot = Object.fromEntries((log.judge?.shots || []).map((j) => [j.id, j]));
  const clips = scenes.flat().length;

  // Totals.
  const tot = [log.total_credits != null && `${log.total_credits} credits`, log.elapsed_s != null && `${Math.round(log.elapsed_s / 60)} min`,
    `${clips} clips`, `${scenes.length} scenes`, log.judge?.reward != null && `reward ${num(log.judge.reward)}`,
    log.llm && `LLM ${log.llm.calls ?? 0} calls (${log.llm.cached ?? 0} cached) · ${log.llm.input_tokens ?? 0} in / ${log.llm.output_tokens ?? 0} out tokens`].filter(Boolean).join(" · ");

  // Judge summary.
  const J = log.judge;
  const judge = J ? `<h2>Judge</h2>${J.film ? `<p><b>Film ${num(J.film.total)}</b>${J.film.best_shot ? ` · best ${esc(J.film.best_shot)}` : ""}${J.film.worst_shot ? ` · worst ${esc(J.film.worst_shot)}` : ""}</p>
    ${J.film.scores ? `<p class="soft">${Object.entries(J.film.scores).map(([k, v]) => `${esc(k.replace(/_/g, " "))} ${num(v)}`).join(" · ")}</p>` : ""}<p>${esc(J.film.summary)}</p>` : ""}
    ${J.shots?.length ? `<div class="scroll"><table><tr><th>Shot</th>${DIMS.map((d) => `<th>${d.replace(/_/g, " ")}</th>`).join("")}<th>Total</th><th>Fault</th><th>End ok</th><th>Persist ok</th></tr>${J.shots.map((j) =>
      `<tr><td>${esc(j.id)}</td>${DIMS.map((d) => `<td>${num(j.scores?.[d])}</td>`).join("")}<td><b>${num(j.total)}</b></td><td>${esc(j.primary_fault)}</td><td>${yn(j.end_state_ok)}</td><td>${yn(j.persisted_ok)}</td></tr>`).join("")}</table></div>` : ""}
    ${J.joins?.length ? `<div class="scroll"><table><tr><th>Join</th><th>Link</th><th>Flags</th><th>Notes</th></tr>${J.joins.map(({ from, to, link, notes, ...f }) =>
      `<tr><td>${esc(from)} → ${esc(to)}</td><td>${esc(link)}</td><td>${Object.entries(f).map(([k, v]) => `${esc(k.replace(/_/g, " "))} ${typeof v === "boolean" ? yn(v) : esc(v)}`).join("<br>")}</td><td>${esc(notes)}</td></tr>`).join("")}</table></div>` : ""}` : "";

  // Seam measures before/after.
  const M = log.measures, mb = M?.before?.joins || [], ma = M?.after?.joins || [];
  const key = (j) => `${j.from}>${j.to}`, after = Object.fromEntries(ma.map((j) => [key(j), j]));
  const trims = log.stitch?.trims || {};
  const seams = (mb.length || ma.length) ? `<h2>Seams</h2><p class="soft">Before = hard concat of the raw clips. After = trimmed and crossfaded (${log.stitch?.config?.xfadeFrames ?? "?"} frames) at continuous joins. Median jump at continuous joins: before ${num(M.before?.median_jump)} · after ${num(M.after?.median_jump)}. Higher similarity, lower jump and dip = smoother.</p>
    <div class="scroll"><table><tr><th>Join</th><th>Link</th><th>Seam similarity<br>before → after</th><th>Jump<br>before → after</th><th>Dip<br>before → after</th><th>Hold / settle frames</th><th>Duplicate</th><th>Trim head / tail</th></tr>${(mb.length ? mb : ma).map((b) => {
      const a = after[key(b)] || {}, t = trims[b.to] || {}, bb = mb.length ? b : {};
      return `<tr class="${b.link === "continuous" ? "" : "soft"}"><td>${esc(b.from)} → ${esc(b.to)}</td><td>${esc(b.link)}</td><td>${num(bb.seam_ssim)} → ${num(a.seam_ssim)}</td><td>${num(bb.jump)} → ${num(a.jump)}</td><td>${num(bb.dip)} → ${num(a.dip)}</td><td>${num(b.hold_frames)} / ${num(b.settle_frames)}</td><td>${yn(b.duplicate)}</td><td>${t.head ?? 0} / ${trims[b.from]?.tail ?? 0}${t.duplicate ? " (dup)" : ""}</td></tr>`;
    }).join("")}</table></div>` : "";

  // Inputs that conditioned a keyframe, as thumbnails with role and why.
  const lineage = (id) => {
    const k = log.keyframes?.[id], sel = k?.selection;
    if (!sel) return "";
    const items = [];
    if (sel.base) items.push({ f: fileOf(sel.base), role: "base", label: sel.base, why: "" });
    for (const e of sel.extra || []) items.push({ f: fileOf(e.id), role: "extra", label: `${e.id}: ${list(e.names)}`, why: e.why });
    for (const a of sel.anchors || []) items.push({ f: a.file, role: "anchor", label: a.name, why: a.why });
    return `<div class="ins">${items.map((x) => `<figure class="in">${img(x.f) || `<div class="ph">${esc(x.label)}</div>`}<figcaption><b>${x.role}</b> ${esc(x.label)}${x.why ? `<br><span class="soft">${esc(x.why)}</span>` : ""}</figcaption></figure>`).join("")}
      ${sel.fresh?.length ? `<figure class="in"><div class="ph">text</div><figcaption><b>fresh</b> ${list(sel.fresh)}</figcaption></figure>` : ""}</div>${sel.why ? `<p class="soft">${esc(sel.why)}</p>` : ""}`;
  };
  const checks = (id) => {
    const cs = log.keyframes?.[id]?.checks || [];
    return cs.length ? `<p class="lab">Checks</p>${cs.map((c) => `<p>attempt ${esc(c.attempt)}: <span class="ok">✓ ${list(c.stable) || "none"}</span>${c.unstable?.length ? ` · <span class="bad">✗ ${c.unstable.map((u) => `${esc(u.name)} (${list(u.diffs)})`).join("; ")}</span>` : ""}${c.artifacts?.length ? ` · artifacts: ${list(c.artifacts)}` : ""}</p>`).join("")}` : "";
  };

  const scenesHtml = scenes.map((ids, n) => `<h2>Scene ${n + 1}${shot[ids[0]] ? ` · ${esc(shot[ids[0]].location)}` : ""}</h2>` + ids.map((id, i) => {
    const s = shot[id] || {}, k = log.keyframes?.[id], carry = log.carry?.[id], j = judgeShot[id], clip = log.jobs?.[`clip:${id}`];
    const cut = s.link !== "continuous";
    const startImg = has(`${id}-start.png`) ? `${id}-start.png` : !cut && has(`${ids[i - 1]}-last.png`) ? `${ids[i - 1]}-last.png` : null;
    const startLab = cut ? "Start frame (keyframe)" : carry?.repaired ? `Repaired start frame (missing from ${esc(ids[i - 1])}: ${list(carry.missing)})` : `Start frame = last frame of ${esc(ids[i - 1])}`;
    return `<div class="shot"><h3>${esc(id)} · ${esc(s.link)} · ${esc(s.seconds)}s${s.chunks ? ` · chunks ${s.chunks.join(", ")}` : ""}</h3><div class="two">
      <div>${img(startImg)}<p class="lab">${startLab}</p>${has(`${id}-start-a1.png`) ? `<details><summary>first attempt</summary>${img(`${id}-start-a1.png`)}</details>` : ""}${lineage(id)}</div>
      <div>${has(`${id}.mp4`) ? `<video src="${esc(id)}.mp4" controls muted loop playsinline></video>` : "<p class='soft'>clip not generated</p>"}
      <p class="lab">Action</p><p>${esc(s.action)} <span class="soft">${esc(s.camera)}${s.motion_in ? ` · in: ${esc(s.motion_in)}` : ""}</span></p>
      ${s.end?.changes?.length ? `<p class="soft">changes: ${s.end.changes.map((c) => `${esc(c.name)}.${esc(c.attr)} ${esc(c.from)} → ${esc(c.to)}`).join("; ")}</p>` : ""}</div></div>
      ${img(`${id}-strip.jpg`)}
      ${k?.prompt ? `<details><summary>Keyframe prompt</summary><pre>${esc(k.prompt)}</pre></details>` : ""}
      ${clip?.request?.style?.prompt ? `<details><summary>Clip prompt</summary><pre>${esc(clip.request.style.prompt)}</pre></details>` : ""}
      ${checks(id)}
      ${carry ? `<p class="lab">Carry</p><p>needed: ${list(carry.needed) || "none"} · <span class="${carry.missing?.length ? "bad" : "ok"}">missing: ${list(carry.missing) || "none"}</span>${carry.repaired ? " · repaired" : ""}</p>` : ""}
      ${j ? `<p class="lab">Judge</p><p><b>${num(j.total)}</b> · ${DIMS.map((d) => `${d.replace(/_/g, " ")} ${num(j.scores?.[d])}`).join(" · ")}${j.primary_fault ? ` · fault: ${esc(j.primary_fault)}` : ""}</p>${j.issues?.length ? `<ul>${(Array.isArray(j.issues) ? j.issues : [j.issues]).map((x) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>` : ""}` : ""}</div>`;
  }).join("")).join("");

  // Audio.
  const cues = log.cues || [], A = log.audio;
  const end = Math.max(1, ...(log.stitch?.timeline || []).map((t) => t.end_s || 0), ...cues.map((c) => Math.max(c.t || 0, c.until || 0)));
  const types = [...new Set(cues.map((c) => c.type))], col = (t) => TYPE_COLORS[types.indexOf(t) % TYPE_COLORS.length];
  const bar = cues.length ? `<div class="tl">${(log.stitch?.timeline || []).map((t) => `<div class="tick" style="left:${(100 * t.start_s) / end}%">${esc(t.id)}</div>`).join("")}
    ${types.map((ty, r) => cues.filter((c) => c.type === ty).map((c) => { const l = (100 * (c.t || 0)) / end, w = c.until != null ? Math.max(0.6, (100 * (c.until - (c.t || 0))) / end) : 0.6;
      return `<div class="cue" title="${esc(`${c.t}s ${c.type}: ${c.text || c.source || ""}`)}" style="left:${l}%;width:${w}%;top:${22 + r * 18}px;background:${col(ty)}"></div>`; }).join("")).join("")}</div>
    <p class="soft">${types.map((t) => `<span class="sw" style="background:${col(t)}"></span>${esc(t)}`).join(" ")} · 0 – ${num(end, 1)} s</p>` : "";
  const audio = (cues.length || A) ? `<h2>Audio</h2>${bar}${cues.length ? `<p class="soft">cues.json in the run folder is editable; run with <code>--remix</code> to re-render the mix without new API calls.</p>
    <div class="scroll"><table><tr><th>#</th><th>t (s)</th><th>Type</th><th>Shot</th><th>Text</th><th>Source</th><th>Gain dB</th><th>Fade s</th><th>Until</th></tr>${cues.map((c) =>
      `<tr><td>${esc(c.n)}</td><td>${num(c.t, 2)}</td><td><span class="sw" style="background:${col(c.type)}"></span>${esc(c.type)}</td><td>${esc(c.shot)}</td><td>${esc(c.text)}</td><td>${esc(c.source)}</td><td>${esc(c.gain_db)}</td><td>${esc(c.fade_s)}</td><td>${esc(c.until)}</td></tr>`).join("")}</table></div>` : ""}
    ${A ? `<p class="soft">beds: ${A.beds?.length ?? 0} · score: ${esc(A.score || "none")} · voiceovers: ${A.voiceovers?.length ?? 0}</p>${A.gaps?.length ? `<p class="lab">Gaps</p><ul>${A.gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}` : ""}` : "";

  // Memory: entities with versions, instance lineage, keyframe lineage.
  const ents = Object.entries(mem.entities || {});
  const memEnt = ents.map(([name, e]) => {
    const xs = bank.filter((b) => b.entities?.[name]).map((b) => ({ b, x: b.entities[name] }));
    const stable = xs.filter(({ x }) => x.stable).length;
    const vers = (e.versions || []).map((v) => `<div class="card ver${v.v === e.current ? " cur" : ""}">${img(v.anchor) || img(`refs/${name}.png`)}<b>v${esc(v.v)}</b>${v.v === e.current ? " (current)" : ""} · since ${esc(v.since)}<br>${esc(v.state)}${v.why ? `<br><span class="soft">${esc(v.why)}</span>` : ""}</div>`).join("");
    const cards = xs.map(({ b, x }) => `<div class="card${x.stable ? "" : " unst"}">${img(b.file)}<b>${esc(b.id)}</b> · ${esc(b.shot)} ${esc(b.role)}${x.version != null ? ` · v${esc(x.version)}` : ""}<br>
      ${x.stable ? "✓ stable" : `✗ ${x.present === false ? "missing" : "unstable"}`}${x.count != null ? ` · count ${esc(x.count)}` : ""}<br>prev → ${esc(x.prev || "none (first)")}<br>source → ${esc(x.source || "text")}
      ${["position", "holding", "held_by", "placed_on", "condition", "size"].filter((a) => x[a] != null).map((a) => `<br><span class="soft">${a}:</span> ${esc(x[a])}`).join("")}${x.look_ok != null ? `<br><span class="soft">look:</span> ${x.look_ok ? "✓" : "✗"}` : ""}
      ${x.diffs?.length ? `<br><span class="bad">diffs: ${list(x.diffs)}</span>` : ""}</div>`).join("");
    return `<h3>${esc(name)} <span class="soft">${esc(e.kind)} · ${stable}/${xs.length} stable</span></h3><p class="soft">${esc(e.look)}${e.size ? ` · ${esc(e.size)}` : ""}</p>
      ${vers ? `<p class="lab">Versions</p><div class="row">${vers}</div>` : ""}${cards ? `<p class="lab">Instances</p><div class="row">${cards}</div>` : ""}`;
  }).join("");
  const kfs = Object.entries(log.keyframes || {});
  const kfTable = kfs.length ? `<h3>Keyframe lineage</h3><div class="scroll"><table><tr><th>Keyframe</th><th>Conditioned by</th><th>Result</th></tr>${kfs.map(([id, k]) =>
    `<tr><td>${esc(id)}</td><td>${lineage(id) || (k.inputs?.length ? `<div class="ins">${k.inputs.map((f) => `<figure class="in">${img(f)}<figcaption>${esc(f)}</figcaption></figure>`).join("")}</div>` : "text only")}</td><td class="res">${img(k.file || `${id}-start.png`)}</td></tr>`).join("")}</table></div>` : "";
  const memory = (ents.length || bank.length || kfs.length) ? `<h2>Memory</h2><p class="soft">Each entity has versions (an anchor image per state) and instances (one per bank frame). Green = stable: present, look matches, same as its last stable instance (prev). source = the bank entry or anchor the frame was built from.${bank.length ? ` Bank: ${bank.length} frames.` : ""}</p>${memEnt}${kfTable}` : "";

  // Anchors (plan entities with reference images).
  const anchors = Object.entries(log.anchors || {}).map(([name, a]) => `<figure>${img(a.file || `refs/${name}.png`)}<figcaption><b>${esc(name)}</b> (${esc(a.kind)}) ${esc(a.why)}</figcaption></figure>`).join("");

  // API calls.
  const jobs = Object.entries(log.jobs || {});
  const calls = jobs.length ? `<h2>API calls (${jobs.length})</h2><div class="scroll"><table><tr><th>Key</th><th>Endpoint</th><th>Model</th><th>Credits</th><th>Seconds</th><th>Request</th></tr>${jobs.map(([k, j]) =>
    `<tr><td>${esc(k)}</td><td>${esc(j.endpoint)}</td><td>${esc(j.request?.model)}</td><td>${esc(j.credits)}</td><td>${esc(j.seconds)}</td><td><details><summary>${esc((j.request?.style?.prompt || j.request?.text || "").slice(0, 60))}…</summary><pre>${esc(JSON.stringify(j.request, null, 1))}</pre>${j.inputs?.length ? `<p class="soft">inputs: ${list(j.inputs)}</p>` : ""}</details></td></tr>`).join("")}</table></div>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pipeline Memory Run</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--ok:#4f7a3a;--bad:#a0402d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1100px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:30px}h2{font-weight:normal;font-size:24px;border-top:1px solid var(--line);padding-top:20px;margin-top:40px}h3{font-weight:normal;color:var(--soft);font-size:16px;margin:22px 0 6px}.soft{color:var(--soft)}.ok{color:var(--ok)}.bad{color:var(--bad)}.lab{font-variant:small-caps;color:var(--soft);margin:6px 0 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}img,video{width:100%;display:block;border:1px solid var(--line)}.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}figure{margin:0}figcaption{font-size:13px;color:var(--soft)}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;font-weight:normal;vertical-align:top}tr.soft td{color:var(--soft)}pre{white-space:pre-wrap;font-size:12px}.scroll{overflow-x:auto;margin:12px 0}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}.card{flex:0 0 220px;background:#fbf7ef;border:1px solid var(--line);border-top:4px solid var(--ok);padding:8px;font-size:13px}.card.unst{border-top-color:var(--bad)}.card.ver{border-top-color:var(--soft)}.card.cur{border-top-color:var(--ink)}.card img{margin-bottom:6px}
.ins{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.in{flex:0 0 120px}.ph{height:68px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--soft);text-align:center;padding:4px}td.res{width:200px}
.tl{position:relative;height:${22 + Math.max(1, types.length) * 18 + 4}px;background:#fbf7ef;border:1px solid var(--line);margin:10px 0 4px;overflow:hidden}.tick{position:absolute;top:0;bottom:0;border-left:1px solid var(--line);font-size:11px;color:var(--soft);padding-left:3px}.cue{position:absolute;height:12px;border-radius:2px;opacity:.85}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 8px}
@media(max-width:760px){.two{grid-template-columns:1fr}td.res{width:120px}.in{flex-basis:96px}}</style></head><body><main>
<h1>${esc(log.case?.title || log.case?.id || "Run")} · pipeline memory</h1>${log.case?.request ? `<p class="soft">${esc(log.case.request)}</p>` : ""}
<p class="soft">Storyboard (typed entities, start/end state per shot) → anchors per entity version → cut keyframes conditioned on the memory bank and anchors, checked per entity → clips (wan-3.0) → carry check and repair at continuous joins → trim + crossfade stitch → cue-sheet audio mix → judge.</p>
<p><b>${tot}</b>${plan.style ? `<br><span class="soft">style: ${esc(plan.style)}</span>` : ""}</p>
${has("final.mp4") ? `<video src="final.mp4" controls playsinline></video>` : has("picture.mp4") ? `<video src="picture.mp4" controls playsinline></video><p class="soft">picture only (no audio mix)</p>` : ""}
${log.errors?.length ? `<pre class="bad">${esc(JSON.stringify(log.errors, null, 1))}</pre>` : ""}
${judge}${seams}${anchors ? `<h2>Anchors</h2><div class="refs">${anchors}</div>` : ""}${scenesHtml}${audio}${memory}${calls}
</main></body></html>`;
}

function yn(v) { return v == null ? "–" : v ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; }
