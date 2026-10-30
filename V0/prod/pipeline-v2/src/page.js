// Run page: final video, measures, bible references, then each scene shot by shot with its prompts.
import { existsSync } from "node:fs";
import { join } from "node:path";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderPage(log, runDir) {
  const has = (f) => existsSync(join(runDir, f));
  const shot = Object.fromEntries(log.plan.shots.map((s) => [s.id, s]));
  const m = log.measures;
  const joins = m ? `<table><tr><th>Join</th><th>Link</th><th>Seam similarity</th><th>Frame jump (normal ≈ ${m.median_jump})</th></tr>${m.joins.map((j) =>
    `<tr><td>${esc(j.from)} → ${esc(j.to)}</td><td>${j.link}</td><td>${j.seam_ssim}</td><td>${j.jump}</td></tr>`).join("")}</table>` : "";
  const refs = log.plan.bible.filter((b) => has(`refs/${b.name}.png`)).map((b) =>
    `<figure><img src="refs/${b.name}.png"><figcaption><b>${esc(b.name)}</b> (${b.kind}) ${esc(b.look)}</figcaption></figure>`).join("");
  const scenes = (log.scenes || []).map((ids, k) => `<h2>Scene ${k + 1} · ${esc(shot[ids[0]].location)}</h2>` + ids.map((id, i) => {
    const s = shot[id], frame = log.jobs?.[`frame:${id}`];
    return `<div class="shot"><h3>${esc(id)} · ${s.link}${s.link === "cut" ? "" : " (from the real last frame)"} · ${s.seconds}s · chunks ${s.chunks.join(", ")}</h3><div class="two">
      ${(() => { const rep = log.jobs?.[`repair:${id}`], carry = log.carry?.[id];
        if (i === 0) return `<div>${has(`${id}-start.png`) ? `<img src="${id}-start.png">` : ""}<p class="lab">Start frame${frame?.context ? ` (built from: ${frame.context.base ? `last frame of ${esc(frame.context.base)}` : "text"}${frame.context.merge.map((m) => ` + ${esc(m.names.join(", "))} from ${esc(m.id)}`).join("")}${frame.context.fresh.length ? ` + new: ${frame.context.fresh.map(esc).join(", ")}` : ""}${frame.refs?.length ? ` + sheets: ${frame.refs.map(esc).join(", ")}` : ""})` : frame?.refs?.length ? ` (refs: ${frame.refs.map(esc).join(", ")})` : " (text only)"}${frame?.checks?.length > 1 ? ` · retried: ${esc(frame.checks[0].problem)}` : ""}</p><p>${esc(s.start_frame)}</p></div>`;
        if (rep && carry?.missing?.length) return `<div><img src="${id}-start.png"><p class="lab">Repaired start frame: ${esc(rep.missing.join(", "))} missing from the last frame of ${esc(ids[i - 1])}</p><p>${esc(carry.start_frame)}</p></div>`;
        return `<div>${has(`${ids[i - 1]}-last.png`) ? `<img src="${ids[i - 1]}-last.png">` : ""}<p class="lab">Start frame = last frame of ${esc(ids[i - 1])}</p></div>`; })()}
      <div>${has(`${id}.mp4`) ? `<video src="${id}.mp4" controls muted loop playsinline></video>` : "<p class='soft'>not generated</p>"}
      <p class="lab">Video prompt</p><p>${esc(s.action)} ${esc(s.camera)}</p>${m?.clips[id] ? `<p class="soft">first frame vs start: ${m.clips[id].first_vs_start}</p>` : ""}</div></div>
      ${has(`${id}-strip.jpg`) ? `<img src="${id}-strip.jpg">` : ""}</div>`;
  }).join("")).join("");
  const rest = log.plan.shots.filter((s) => !(log.scenes || []).flat().includes(s.id));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pipeline v2 Run</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1100px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:30px}h2{font-weight:normal;font-size:24px;border-top:1px solid var(--line);padding-top:20px;margin-top:40px}h3{font-weight:normal;color:var(--soft);font-size:16px;margin:22px 0 6px}.soft{color:var(--soft)}.lab{font-variant:small-caps;color:var(--soft);margin:6px 0 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}img,video{width:100%;display:block;border:1px solid var(--line)}.refs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}figure{margin:0}figcaption{font-size:13px;color:var(--soft)}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;font-weight:normal}pre{white-space:pre-wrap;font-size:12px}@media(max-width:760px){.two{grid-template-columns:1fr}}</style></head><body><main>
<h1>${esc(log.case.title)} · pipeline v2</h1><p class="soft">${esc(log.case.request)}</p>
<p class="soft">Shot list → bible references → cut frames (from references) → clips (wan-3.0, start frame only) → native 30 fps stitch. ${log.total_credits ?? "?"} credits · ${(log.scenes || []).length} scenes · ${(log.scenes || []).flat().length} clips · style: ${esc(log.plan.style)}</p>
${has("final.mp4") ? `<video src="final.mp4" controls playsinline></video>` : ""}${joins}
${log.errors?.length ? `<pre>${esc(JSON.stringify(log.errors, null, 1))}</pre>` : ""}
${refs ? `<h2>Bible references</h2><div class="refs">${refs}</div>` : ""}${scenes}
${rest.length ? `<h2>Planned, not run (${rest.length} shots)</h2><table>${rest.map((s) => `<tr><td>${esc(s.id)}</td><td>${s.link}</td><td>${esc(s.location)}</td><td>${esc(s.action)}</td></tr>`).join("")}</table>` : ""}
</main></body></html>`;
}
