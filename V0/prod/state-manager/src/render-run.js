// Results page for one executed plan: final video first, then every call by execution level.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderRun(run) {
  const media = (r) => !r.file ? "" : r.file.endsWith(".mp4") ? `<video src="${esc(r.file)}" controls muted loop playsinline></video>` : `<img src="${esc(r.file)}" alt="">`;
  const card = (r) => `<div class="card">
    <p><span class="tag">${esc(r.id)}</span> <strong>${esc(r.standin ? "Stand-in upload (synthetic)" : r.tool || r.leaf)}</strong> <span class="soft">${esc(r.label || "")}</span></p>
    ${media(r)}
    ${r.inputs?.length ? `<p class="soft">Inputs: ${r.inputs.map((i) => `${esc(i.slot)} ← ${esc(i.node)}`).join(" · ")}</p>` : ""}
    ${r.prompt ? `<details open><summary>Prompt</summary><p>${esc(r.prompt)}</p></details>` : ""}
    ${r.sets?.length ? `<details><summary>Made true (${r.sets.length})</summary><ul>${r.sets.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>` : ""}
    ${r.passes?.length ? `<details><summary>Kept from inputs (${r.passes.length})</summary><ul>${r.passes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>` : ""}
    ${r.note ? `<p class="soft">${esc(r.note)}</p>` : ""}
    <p class="soft">${r.request?.model ? `model ${esc(r.request.model)} · ` : ""}${r.credits != null ? `${r.credits} credits` : r.estimate ? `≈${r.estimate} credits` : ""}${r.seconds ? ` · ${r.seconds}s` : ""}${r.job ? ` · job ${esc(r.job)}` : ""}</p>
  </div>`;
  const final = run.records[run.root];
  const cont = run.continuity;
  const v = (x) => x == null ? "–" : `<span class="${x < (cont?.threshold?.start ?? 0.8) ? "bad" : "ok"}">${x.toFixed(3)}</span>`;
  const continuity = !cont ? "" : `<h2>Continuity check (SSIM, ${esc(cont.method)}; flag below ${cont.threshold.start} / seam ${cont.threshold.seam})</h2>
<table><tr><th>Shot</th><th>Scene · join</th><th>First frame</th><th>vs start image</th><th>Last frame</th><th>vs end image</th><th>Seam from previous</th></tr>
${cont.clips.map((c, i) => { const ch = run.chain[i] || {}; const seam = cont.seams.find((s) => s.to === c.video);
  return `<tr><td>${i + 1}. ${esc(c.video)}<br><span class="soft">${esc((ch.label || "").replace(/^Segment group \d+: /, ""))}</span></td><td>${ch.scene ?? ""} · ${esc(ch.handoff || "")}</td>
  <td>${c.first ? `<img class="thumb" src="${esc(c.first)}" alt="">` : ""}</td><td>${v(c.start)}</td><td>${c.last ? `<img class="thumb" src="${esc(c.last)}" alt="">` : ""}</td><td>${v(c.end)}</td>
  <td>${seam ? `<span class="${seam.flag ? "bad" : seam.kind === "cut" ? "soft" : "ok"}">${seam.ssim.toFixed(3)}</span>${seam.kind === "cut" ? ' <span class="soft">(cut, not judged)</span>' : ""}` : "–"}${c.flags?.length ? `<br><span class="bad">${c.flags.map(esc).join("<br>")}</span>` : ""}</td></tr>`; }).join("")}
</table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(run.title)} Run</title>
<style>
:root { --bg:#f6f0e4; --ink:#3b2a1e; --soft:#7a5c44; --line:#d9cbb4; --card:#fbf7ef; }
* { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 Georgia, serif; }
main { max-width:1200px; margin:0 auto; padding:40px 16px 80px; } h1 { font-weight:normal; font-size:32px; margin:0 0 6px; }
h2 { font-weight:normal; font-size:20px; color:var(--soft); border-bottom:1px solid var(--line); margin:32px 0 10px; padding-bottom:4px; }
.soft { color:var(--soft); } .req { font-style:italic; } .tag { font-size:12px; color:var(--soft); border:1px solid var(--line); padding:0 4px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }
.card { background:var(--card); border:1px solid var(--line); padding:10px 14px; } .card p { margin:4px 0; font-size:14px; }
img, video { width:100%; display:block; margin:6px 0; border:1px solid var(--line); } .final video { max-width:900px; } .row { border-bottom:1px solid var(--line); padding:8px 0; } .pair { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } .pair p { margin:2px 0; font-size:12px; }
table { border-collapse:collapse; width:100%; font-size:13px; } td, th { border-bottom:1px solid var(--line); padding:4px 6px; text-align:left; vertical-align:top; }
.thumb { width:160px; margin:0; } .bad { color:#a8322a; font-weight:bold; } .ok { color:#2f6b3a; }
@media (max-width:700px) { .thumb { width:80px; } table { font-size:11px; } }
ul { padding-left:18px; margin:4px 0; font-size:13px; } details { font-size:13px; } summary { cursor:pointer; }
</style></head><body><main>
<h1>${esc(run.title)}</h1><p class="req">“${esc(run.request)}”</p>
<p class="soft">${run.dry ? "Dry run (no calls made)" : "Executed with Magic Hour"} · images ${esc(run.models.image)} · video ${esc(run.models.video)} (with end frame: ${esc(run.models.endFrame)}) @ ${esc(run.models.videoRes || "720p")}${run.mode ? ` · mode ${esc(run.mode)}` : ""}${run.models.chainImage ? ` · chained end frames ${esc(run.models.chainImage)}` : ""} · ${run.dry ? `≈${run.estimate}` : run.credits} credits · ${run.wall_s}s wall time${run.failed ? ` · <strong>failed: ${esc(run.failed)}</strong>` : ""}</p>
${run.skipped.length ? `<ul class="soft">${run.skipped.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
${run.standin ? `<p class="soft">The upload was not a real file in the test set, so a synthetic stand-in was generated from its description first.</p>` : ""}
${run.chain?.length ? `<h2>Frame chain (start → end per scene)</h2><div class="chain">${run.chain.map((c, i) => {
    const st = run.records[c.start], en = c.end ? run.records[c.end] : null;
    const prevEnd = i ? (run.chain[i - 1].end || run.chain[i - 1].start) : null;
    return `<div class="row"><p><strong>${i + 1}. ${esc(c.label.replace(/^Segment group \d+: /, ""))}</strong> <span class="soft">${c.handoff === "real last frame" ? "starts on the real last frame of the previous clip" : c.handoff === "cut" ? "cut: new scene" : c.start === prevEnd ? "starts on the previous end frame (exact)" : i ? "start = previous end frame, edited" : "landmark start"}</span></p><div class="pair"><div>${st ? media(st) : ""}<p class="soft">start ${esc(c.start)}</p></div><div>${en ? media(en) : `<p class="soft">no end frame (no changes)</p>`}${en ? `<p class="soft">end ${esc(c.end)}</p>` : ""}</div>${run.records[c.video]?.file ? `<div>${media(run.records[c.video])}<p class="soft">video ${esc(c.video)}</p></div>` : ""}</div></div>`;
  }).join("")}</div>` : ""}
${continuity}
<h2>Final video</h2><div class="final">${final ? media(final) : `<p class="soft">Not produced.</p>`}</div>
${run.levels.map((ids, i) => `<h2>Execution level ${i}</h2><div class="grid">${ids.map((id) => card(run.records[id])).join("")}</div>`).join("")}
</main></body></html>`;
}
