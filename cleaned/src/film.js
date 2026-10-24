// Stage 2: one clip per slide. A connected slide's clip ends on the next slide's frame (start + end frame); a cut slide's
// clip has a start frame only. Motion prompt from the frames (V2), clip job (V3), first/last SSIM check (V4), stitch (V5).
import { mkdirSync, existsSync } from "node:fs";
import { links } from "./links.js";
import { direct } from "./motion.js";
import { check, stitch } from "./clips.js";
import { COST, VIDEO } from "./jobs.js";
import { duration } from "./clips.js";

export const SECONDS = 5;

export async function film({ plan, tracker, jobs, run, only = null }) {
  mkdirSync(run.path("clips"), { recursive: true });
  const L = links(plan, tracker), out = [];
  for (const l of L) {
    if (only && !only.includes(l.n)) continue;
    const slide = plan.slides.find((s) => s.n === l.n), next = plan.slides.find((s) => s.n === l.next);
    const start = tracker.bySlide(l.n).file, end = l.type === "connected" ? tracker.bySlide(l.next).file : null;
    const m = run.estimate ? { prompt: "(estimate)", camera: "static", risk: "" } : await direct(slide, next, { start: run.path(start), end: end && run.path(end), seconds: SECONDS });
    const prompt = `${m.prompt} Camera: ${m.camera}.`, key = `clip-${l.n}`, file = `clips/${key}.mp4`;
    console.log(`clip ${l.n} [${l.type}${end ? ` → slide ${l.next}` : ""}]: ${m.prompt}`);
    await jobs.video(key, file, prompt, start, end, SECONDS);
    const qa = run.estimate || !existsSync(run.path(file)) ? null : check(run.path(file), { start: run.path(start), end: end && run.path(end), path: run.path, key });
    if (qa) console.log(`  first≈start ${qa.first_vs_start}${end ? `, last≈end ${qa.last_vs_end}` : `, last≈start ${qa.last_vs_start}`}, ${qa.seconds}s`);
    out.push({ ...l, start, end, file, prompt, motion: m, qa, model: VIDEO.model, cost: COST.video(SECONDS) });
  }
  run.log.film = { clips: out, links: L, model: VIDEO, seconds: SECONDS };
  // Stitch only a complete film: every slide has its clip.
  if (!run.estimate && L.every((l) => existsSync(run.path(`clips/clip-${l.n}.mp4`)))) {
    const clips = L.map((l, i) => ({ file: `clips/clip-${l.n}.mp4`, trimFirst: i > 0 && L[i - 1].type === "connected" }));
    run.log.film.final = stitch(clips, "final.mp4", run.path);
    run.log.film.chapters = chapters(L, out, run.path);
    console.log(`film: final.mp4 (${L.length} clips)`);
  }
  run.save();
  return run.log.film;
}

// Start time of each clip in final.mp4 (a clip after a connected seam lost its first frame at 24 fps).
function chapters(L, out, path) {
  let t = 0;
  return L.map((l, i) => {
    const d = duration(path(`clips/clip-${l.n}.mp4`)) - (i > 0 && L[i - 1].type === "connected" ? 1 / 24 : 0), at = t;
    t += d;
    return { n: l.n, at: Math.round(at * 100) / 100, type: l.type };
  });
}
