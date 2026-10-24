// Builds lighthouse.html: the request, then every lighthouse version in order, with its method, cost and what we measured.
// Usage: node current/tests/versions/build-versions.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url)), T = join(DIR, "..");
const c = JSON.parse(readFileSync(join(T, "state-manager/cases.json"), "utf8")).cases.find((x) => x.id === "p4-lighthouse");
const story = readFileSync(join(T, "../..", c.story_path), "utf8");
const pv = (label) => { const f = join(T, `pipeline-v2/runs/p4-lighthouse-${label}/run.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };

const V = [
  { group: "Pipeline v1 (atomizer + solver + planned start/end frames)" },
  { name: "v1 · first run", video: "../state-manager/runs/p4-lighthouse-v1-broken/n1.mp4", page: "../state-manager/runs/p4-lighthouse-v1-broken/index.html", credits: 1320, len: "20 s, 4 segments",
    how: "nano-banana-2-lite frames · ltx-2.5 and seedance-1.5 (end frames) · 24 fps stitch",
    notes: ["The keeper changes between shots.", "Flicker; only 20 s; story missing; wrong transitions."] },
  { name: "v2 · chained edits", video: "../state-manager/runs/p4-lighthouse-v2-chain/n1.mp4", credits: null, len: "20 s",
    how: "Each frame is an edit of the previous frame (run log lost)", notes: ["Cuts choppy; edited handoffs jump."] },
  { name: "v4 · full film, 4k frames", video: "../state-manager/runs/p4-lighthouse-v4-full-video/n1.mp4", page: "../state-manager/runs/p4-lighthouse-v4-full-video/index.html", credits: 7200, len: "120 s",
    how: "nano-banana-pro 4k frames · ltx-2.5 + seedance-1.5 end frames · 24 fps stitch",
    notes: ["Only 5 of 18 seams were exact handoffs; edited handoffs scored 0.21–0.61.", "Clips miss their end frames (0.33–0.76).", "The keeper becomes a man (n101); two lighthouses; kitchen items outdoors."] },
  { name: "End-frame model test · one segment", grid: [["wan-3.0", "../state-manager/runs/p4-lighthouse-cmp-wan-3.0/n1.mp4"], ["kling-3.0", "../state-manager/runs/p4-lighthouse-cmp-kling-3.0/n1.mp4"], ["veo3.1-lite", "../state-manager/runs/p4-lighthouse-cmp-veo3.1-lite/n1.mp4"], ["gemini-omni-1.1", "../state-manager/runs/p4-lighthouse-cmp-gemini-omni-1.1/n1.mp4"]],
    credits: 768, len: "3–4 s each", how: "Same start and end frames, four end-frame models",
    notes: ["Wan 3.0 hits both frames (0.98–0.99). Kling crossfades. Veo freezes. Gemini Omni misses its frames."] },
  { name: "Scene chain · wan-3.0", video: "../state-manager/runs/p4-lighthouse-chain-wan/n1.mp4", page: "../state-manager/runs/p4-lighthouse-chain-wan/index.html", credits: 726, len: "13 s, 5 segments",
    how: "Continuous shots start from the real last frame; end frames from edits; wan-3.0", notes: [] },
  { name: "Scene chain · test 2", video: "../state-manager/runs/p4-lighthouse-test2-chain/n1.mp4", page: "../state-manager/runs/p4-lighthouse-test2-chain/index.html", credits: 2528, len: "18 s, 6 clips of 3 s",
    how: "Real last frames; wan-3.0 end frames; 24 fps stitch with padding", notes: ["Choppy: 30→24 fps drops 1 frame in 5; each clip freezes, then snaps to its end frame (jumps 18–60)."] },
  { name: "Scene chain · test 2, re-stitched at 30 fps", video: "../state-manager/runs/p4-lighthouse-test2-chain/restitch-30fps.mp4", credits: 0, len: "18 s",
    how: "Same clips; native 30 fps, exact 1280×720, duplicate and snap frames trimmed", notes: ["Fps judder gone. The end-frame snap stays: it is inside each clip."] },
  { group: "Litmus tests (hand-written prompts, no end frames)" },
  { name: "Litmus A · keeper, 2 clips", video: "../../research/litmus/test-A/joined.mp4", page: "../../research/litmus/index.html", credits: 1160, len: "10 s",
    how: "Text-to-image start → wan-3.0 clip → real last frame → clip 2", notes: ["Seam 0.992. Actions followed, identity held."] },
  { name: "Litmus B · city street, 2 clips", video: "../../research/litmus/test-B/joined.mp4", credits: 1160, len: "10 s", how: "Same method, photoreal", notes: ["Seam 0.990."] },
  { name: "Litmus C · 4 continuous clips + a cut", video: "../../research/litmus/test-C/joined.mp4", credits: 1640, len: "25 s",
    how: "4 clips chained from real last frames; cut frame = an edit of the clean start image", notes: ["Continuous joins 0.991–0.992 (jumps 2.2–2.3, normal 1.3).", "Style drifts toward photoreal by clip 4; the shell changes shape."] },
  { name: "Litmus D · 45 s scene-state doc with @labels and generated end frames", video: "../../research/litmus/test-D/joined.mp4", doc: "../../research/litmus/test-D/scene-states.md", litmusD: true, len: "45 s, 9 scenes of 5 s",
    how: "LLM scene-state doc: @labelled assets (one reference each), start state, action, end state with from → to changes, same_as per label. End frame = edit of the start frame + references. wan-3.0 start+end clips, last 3 frames trimmed, continuous scenes start from the real trimmed last frame.",
    notes: ["Broken run: the style line said \"nine consecutive scenes, each lasting 5 seconds\", so the image model drew 3×3 storyboard grids with timecodes for the cut start frames of scenes 2, 4, 7 and 8.", "Every clip lands on its generated end frame (0.989–0.995), but only in the last 2 frames: a snap. After trimming 3 frames, the kept frame matches the end frame only 0.66–0.94.", "Continuous joins from the trimmed real last frame are smooth (jump 1.1–1.2).", "The shell is a large conch again, even with \"4 centimetres\" in its look."] },
  { name: "Litmus E · same as D, frames built from earlier frames (context)", video: "../../research/litmus/test-E/joined.mp4", doc: "../../research/litmus/test-E/scene-states.md", litmusD: "test-E", len: "45 s, 9 scenes of 5 s",
    how: "Same scene-state doc format (style line fixed: look only). A label seen before comes from the last real frame that showed it (scale and context). A cut to a place seen before transforms that place's last frame; a new place merges assets from their last frames. Only characters get a clean sheet (identity). Generated end frames, 3 frames trimmed.",
    notes: ["One consistent world: the same beach, lighthouse and keeper across all 9 scenes; the cottage, path and kitchen are built from earlier frames.", "Clips land on their end frames (0.991–0.995) and keep 0.82–0.99 after the trim; end snaps are small (about 2, except scene 1 at 12).", "Continuous joins 1.0–1.2. The cut s2→s3 transformed the previous frame, so it reads almost as continuous (jump 2.6).", "The shell's first appearance has no earlier frame, so its size comes from the text alone: it is drawn larger than her boot, then carried at that size until it is in her hand."] },
  { group: "Pipeline v2 (shot planner + bible references + litmus executor)" },
  { name: "v2 · run 1, full film", run: "v1", how: "Shot planner (1 LLM call) → bible references → cut frames from references → wan-3.0 clips, start frame only → native 30 fps stitch",
    notes: ["8 continuous joins 0.988–0.996 (jumps 2.2–2.4); 15 clean cuts; no snaps.", "The keeper becomes an old man in shot 16.", "The lamp is a hand lantern; the shell is a large conch."] },
  { name: "v2 · run 2, lamp fix + shot 16 retake", run: "v2", how: "Same plan. Bible relook (1 LLM call) on Lamp; only dependent frames and clips re-run.",
    notes: ["The lamp is still a hand lantern: an object drawn alone on grey has no scale.", "Shot 16 still shows a man: shot 15 ends without the keeper in frame, and the video model invents one.", "Clips 10 and 17 timed out (old clips kept); clip 15 was not re-made (cache bug, fixed)."] },
  { name: "v2 · run 3, shell + fixtures + vision checks", run: "v3", how: "Run 2 + bible relook on Shell (kind and real size) + fixtures drawn into their location plate (1 LLM call) + vision check on each cut frame (retry once) + vision check that a continuous shot's characters are in the last frame (else repair the frame from references).", notes: ["No man in shot 16; the keeper is the same woman in every shot.", "The lamp is a large lamp on a pedestal in the lantern room, still lantern-like, not a lighthouse lens.", "The shell is palm-sized in close shots; the final shot still shows a large spiral.", "The frame check caught shot 19 with two keepers and regenerated it."] },
];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cards = V.map((v) => {
  if (v.group) return `<h2>${esc(v.group)}</h2>`;
  let video = v.video, page = v.page, credits = v.credits, len = v.len, extra = "";
  if (v.litmusD) {
    const t = typeof v.litmusD === "string" ? v.litmusD : "test-D", f = join(T, `../research/litmus/${t}/result.json`);
    if (!existsSync(join(T, `../research/litmus/${t}/joined.mp4`)) || !existsSync(f)) return `<section><h3>${esc(v.name)}</h3><p class="soft">Not finished yet.</p></section>`;
    const r = JSON.parse(readFileSync(f, "utf8")); credits = r.total_credits;
    const m = r.measures;
    extra = `<p class="soft">Lands on end frame (raw last frame / kept frame, 1 = identical): ${Object.entries(m.clips).map(([k, x]) => `${k} ${x.raw_last_vs_end}/${x.kept_last_vs_end}`).join(" · ")}</p>
    <p class="soft">Joins (frame jump, normal ≈ ${m.median_jump}): ${m.seams.map((x) => `${x.from}→${x.to} ${x.link} ${x.jump}`).join(" · ")}</p><p><a href="${v.doc}">scene-state doc</a></p>`;
  }
  if (v.run) {
    const l = pv(v.run);
    if (!l || !existsSync(join(T, `pipeline-v2/runs/p4-lighthouse-${v.run}/final.mp4`))) return `<section><h3>${esc(v.name)}</h3><p class="soft">Not finished yet.</p></section>`;
    video = `../pipeline-v2/runs/p4-lighthouse-${v.run}/final.mp4`; page = `../pipeline-v2/runs/p4-lighthouse-${v.run}/index.html`;
    // A run made --from another counts only the jobs it made itself (new Magic Hour job ids).
    const base = l.from ? pv(l.from).jobs : {};
    const same = (a, b) => a && a.seconds === b.seconds && JSON.stringify(a.request) === JSON.stringify(b.request);
    credits = Object.entries(l.jobs).filter(([k, j]) => !same(base[k], j)).reduce((n, [, j]) => n + (j.credits || 0), 0);
    len = `${l.scenes.flat().length} clips, ${l.scenes.length} scenes`;
    if (l.relooks) extra = Object.entries(l.relooks).map(([k, r]) => `<p class="soft"><b>${esc(k)}</b> before: ${esc(r.before)}<br>after: ${esc(r.after)}</p>`).join("");
  }
  const media = v.grid ? `<div class="grid">${v.grid.map(([n, s]) => `<figure><video src="${s}" controls muted loop playsinline></video><figcaption>${esc(n)}</figcaption></figure>`).join("")}</div>`
    : `<video src="${video}" controls playsinline preload="metadata"></video>`;
  return `<section><h3>${esc(v.name)}</h3>${media}<p class="meta">${esc(len)} · ${credits == null ? "credits unknown" : `${credits.toLocaleString()} credits`}${page ? ` · <a href="${page}">run page</a>` : ""}</p>
  <p>${esc(v.how)}</p>${v.notes.length ? `<ul>${v.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}${extra}</section>`;
}).join("");

writeFileSync(join(DIR, "lighthouse.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lighthouse Versions</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--card:#fbf7ef}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1000px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:32px;margin:0 0 8px}h2{font-weight:normal;font-size:22px;border-top:1px solid var(--line);padding-top:22px;margin-top:44px}h3{font-weight:normal;font-size:19px;margin:0 0 10px}.req{font-size:19px;background:var(--card);border-left:3px solid var(--soft);padding:14px 18px;margin:18px 0}section{background:var(--card);border:1px solid var(--line);padding:16px;margin:18px 0}video{width:100%;display:block;background:#000}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}figcaption,.soft,.meta{color:var(--soft);font-size:14px}a{color:var(--soft)}ul{margin:6px 0;padding-left:20px}details{margin:10px 0}pre{white-space:pre-wrap;font:14px/1.5 Georgia,serif}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main>
<h1>Lighthouse short film · all versions</h1><p class="soft">The same request through each pipeline version, oldest first.</p>
<div class="req">“${esc(c.request)}”</div>
<details><summary>Story written by the creative director (v3a)</summary><pre>${esc(story)}</pre></details>
${cards}</main></body></html>`);
console.log("wrote current/tests/versions/lighthouse.html");
