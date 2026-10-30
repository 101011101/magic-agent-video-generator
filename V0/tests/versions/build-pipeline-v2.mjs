// Builds pipeline-v2.html: every pipeline-v2 run (one card per run, newest case first) and the scene-state litmus tests.
// Usage: node current/tests/versions/build-pipeline-v2.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url)), T = join(DIR, ".."), RUNS = join(T, "pipeline-v2/runs");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const same = (a, b) => a && a.seconds === b.seconds && JSON.stringify(a.request) === JSON.stringify(b.request);

const runs = readdirSync(RUNS).filter((d) => existsSync(join(RUNS, d, "run.json")) && !d.includes("-est")).map((d) => ({ d, l: read(join(RUNS, d, "run.json")) }));
const byCase = {};
for (const r of runs) (byCase[r.l.case.id] ??= []).push(r);

const card = ({ d, l }) => {
  const rel = `../pipeline-v2/runs/${d}`, done = existsSync(join(RUNS, d, "final.mp4")) && l.measures;
  const base = l.from ? read(join(RUNS, `${l.case.id}-${l.from}`, "run.json")).jobs : {};
  const credits = Object.entries(l.jobs || {}).filter(([k, j]) => !same(base[k], j)).reduce((n, [, j]) => n + (j.credits || 0), 0);
  const label = d.slice(l.case.id.length + 1);
  if (!done) return `<section><h3>${esc(label)}</h3><p class="soft">Not finished (planned ${l.plan?.shots?.length ?? "?"} shots).</p></section>`;
  const cont = l.measures.joins.filter((j) => j.link === "continuous"), cuts = l.measures.joins.filter((j) => j.link === "cut");
  const rng = (xs, k) => xs.length ? `${Math.min(...xs.map((x) => x[k]))}–${Math.max(...xs.map((x) => x[k]))}` : "–";
  const shots = l.plan.shots.filter((s) => l.scenes.flat().includes(s.id));
  return `<section><h3>${esc(label)}${l.from ? ` <span class="soft">(from ${esc(l.from)})</span>` : ""}</h3>
  <video src="${rel}/final.mp4" controls playsinline preload="metadata"></video>
  <p class="meta">${shots.length} clips · ${l.scenes.length} scenes · ${credits.toLocaleString()} new credits · continuous joins ${cont.length} (similarity ${rng(cont, "seam_ssim")}, jump ${rng(cont, "jump")}) · cuts ${cuts.length} · normal motion ≈ ${l.measures.median_jump} · <a href="${rel}/index.html">run page</a></p>
  ${l.relooks ? `<p class="soft">Relooked: ${Object.keys(l.relooks).map(esc).join(", ")}</p>` : ""}${l.plan.layers?.length ? `<p class="soft">Text layers: ${l.plan.layers.map((x) => `“${esc(x.text)}” ${x.start_s}–${x.end_s}s`).join("; ")}</p>` : ""}
  ${existsSync(join(RUNS, d, "uploads/u1.png")) ? `<p class="soft">Upload u1 (stand-in, generated from the case description): <a href="${rel}/uploads/u1.png">image</a></p>` : ""}
  <details><summary>Shot list</summary><table>${shots.map((s) => `<tr><td>${esc(s.id)}</td><td>${s.link}${s.start_upload ? " (upload)" : ""}</td><td>${esc(s.location)}</td><td>${esc(s.action)} ${esc(s.camera)}</td></tr>`).join("")}</table></details></section>`;
};

const litmus = ["test-D", "test-E"].map((t) => {
  const f = join(T, `../research/litmus/${t}/result.json`), v = join(T, `../research/litmus/${t}/joined.mp4`);
  const title = t === "test-D" ? "Litmus D · scene-state doc, @labels, isolated references, generated end frames" : "Litmus E · as D, frames built from earlier frames (context)";
  if (!existsSync(f) || !existsSync(v) || !read(f).measures) return `<section><h3>${title}</h3><p class="soft">Not finished.</p></section>`;
  const r = read(f), m = r.measures;
  return `<section><h3>${title}</h3><video src="../../research/litmus/${t}/joined.mp4" controls playsinline preload="metadata"></video>
  <p class="meta">45 s · ${r.total_credits.toLocaleString()} credits · <a href="../../research/litmus/${t}/scene-states.md">scene-state doc</a></p>
  <p class="soft">Lands on end frame (raw / after trim): ${Object.entries(m.clips).map(([k, x]) => `${k} ${x.raw_last_vs_end}/${x.kept_last_vs_end}`).join(" · ")}</p>
  <p class="soft">Joins (jump, normal ≈ ${m.median_jump}): ${m.seams.map((x) => `${x.from}→${x.to} ${x.link} ${x.jump}`).join(" · ")}</p>
  ${t === "test-D" ? `<p class="soft">Broken: the style line made the image model draw storyboard grids for 4 cut frames.</p>` : ""}</section>`;
}).join("");

// Old repo results (benchmark run 2026-10-07 through its REST API, no code changes, no voice key).
const OLD = {
  "p4-lighthouse": { file: "lighthouse.mp4", meta: "No file · failed twice in planning (\"Draft plan repair budget exhausted\") · 0 credits",
    notes: ["Classified the short film as a UGC product ad; its plan checker rejected the scenes before any media was made."] },
  "p2-bakery": { file: "bakery.mp4", meta: "20 s · 9:16 720p · 4 shots · 1,160 credits · 658 s · 4 operator messages",
    notes: ["nano-banana-2-lite stills + minimax-h3 clips with native ambience.", "Text not exact: the end card is painted into the image as a window sign (\"Sweet Crumbs / — Open 7am–3pm — / 12 Elm St.\"), and the push-in crops \"Sweet\".", "Blocked twice on the missing voice key until told to use native scene audio."] },
  "p1-grandma": { file: "grandma.mp4", meta: "5 s · 9:16 720p · 1 shot · 290 credits (+530 wasted on a failed first attempt) · 119 s · 1 operator message",
    notes: ["Ignored the attached photo at first and asked which image to animate.", "Redraws the photo as a 9:16 keyframe before animating, so identity is close but not the original photo."] },
};
const order = ["p4-lighthouse", "p1-grandma", "p2-bakery"];
const cases = [...order.filter((k) => byCase[k]), ...Object.keys(byCase).filter((k) => !order.includes(k))].map((k) => {
  const rs = byCase[k].sort((a, b) => a.d.localeCompare(b.d)), c = rs[0].l.case;
  const old = OLD[k];
  const oldCard = old ? `<section><h3>Old repo (archived) <span class="soft">baseline</span></h3>${existsSync(join(T, `benchmarks/runs/archived/${old.file}`)) ? `<video src="../benchmarks/runs/archived/${old.file}" controls playsinline preload="metadata"></video>` : ""}
    <p class="meta">${esc(old.meta)}</p><ul>${old.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : "";
  return `<h2>${esc(c.title)}</h2><div class="req">“${esc(c.request)}”</div>${c.uploads && !/^none/i.test(c.uploads) ? `<p class="soft">Upload: ${esc(c.uploads)}</p>` : ""}${rs.map(card).join("")}${oldCard}`;
}).join("");

writeFileSync(join(DIR, "pipeline-v2.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pipeline v2 Results</title>
<style>:root{--bg:#f6f0e4;--ink:#3b2a1e;--soft:#7a5c44;--line:#d9cbb4;--card:#fbf7ef}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Georgia,serif}main{max-width:1000px;margin:0 auto;padding:40px 16px 80px}h1{font-weight:normal;font-size:32px;margin:0 0 8px}h2{font-weight:normal;font-size:24px;border-top:1px solid var(--line);padding-top:22px;margin-top:44px}h3{font-weight:normal;font-size:18px;margin:0 0 10px}.req{font-size:18px;background:var(--card);border-left:3px solid var(--soft);padding:12px 16px;margin:14px 0}section{background:var(--card);border:1px solid var(--line);padding:16px;margin:16px 0}video{width:100%;display:block;background:#000}.soft,.meta{color:var(--soft);font-size:14px}a{color:var(--soft)}table{border-collapse:collapse;width:100%;font-size:13px}td{border-bottom:1px solid var(--line);padding:4px 6px;vertical-align:top}</style></head><body><main>
<h1>Pipeline v2 · results</h1><p class="soft">Shot planner → bible (relook, fixtures) → references → cut frames with a vision check → clips from start frames only (wan-3.0) → continuous shots from the real last frame → native 30 fps stitch → exact text layers. <a href="lighthouse.html">All lighthouse versions</a></p>
${cases}<h2>Scene-state litmus tests</h2>${litmus}</main></body></html>`);
console.log("wrote current/tests/versions/pipeline-v2.html");
