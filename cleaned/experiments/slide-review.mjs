// Slide review data for a run: every slide with its kept frame, its base, the sheets passed, who should be in it, and every
// attempt with its faults. Writes <run>/review/{img/*.jpg, data.json}. Usage: node cleaned/experiments/slide-review.mjs custom-rrh2
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";

const name = process.argv[2], dir = join(RUNS, name), out = join(dir, "review"), img = join(out, "img");
mkdirSync(img, { recursive: true });
const log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), t = JSON.parse(readFileSync(join(dir, "tracker.json"), "utf8")), plan = log.plan;
const jpg = (f, w = 720) => { const o = f.replace(/[/]/g, "_").replace(/\.png$/, ".jpg"); if (!existsSync(join(img, o))) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, f), "-vf", `scale=${w}:-2`, "-q:v", "5", join(img, o)]); return `img/${o}`; };
const ent = Object.fromEntries(plan.entities.map((e) => [e.id, { name: e.name, kind: e.kind }]));
const sheets = Object.fromEntries(Object.entries(t.roots).map(([id, f]) => [id, jpg(f, 360)]));
const plates = Object.fromEntries(t.frames.filter((f) => f.op === "plate").map((f) => [f.id, jpg(f.file)]));
const frameFile = Object.fromEntries(t.frames.map((f) => [f.id, f.file]));
const slides = plan.slides.map((s) => {
  const f = t.frames.find((x) => x.slide === s.n);
  if (!f) return { n: s.n, built: false, place: s.location, caption: s.caption, action: s.ste.join(" "), present: s.present };
  return {
    n: s.n, built: true, place: s.location, caption: s.caption, action: s.ste.join(" "), present: s.present, observed: f.present,
    cast: s.cast.map((c) => ({ id: c.id, where: c.where, acting: c.acting })), changed: s.changed, change: s.change,
    forced: f.forced, kept: jpg(f.file), keptFile: f.file, base: f.base, baseImg: f.base.startsWith("plate") ? plates[f.base] : jpg(frameFile[f.base]),
    attempts: f.attempts.map((a) => ({ a: a.a, img: jpg(a.file), file: a.file, base: a.base, baseImg: a.base.startsWith("plate") ? plates[a.base] : jpg(a.base_file),
      add: a.add, remove: a.remove, refs: a.refs.map((r) => r.id), faults: a.faults.map((x) => `${x.id ? ent[x.id].name + ": " : ""}${x.kind}`),
      framing: a.obs?.framing || null, kept: a.file === f.file })),
  };
});
writeFileSync(join(out, "data.json"), JSON.stringify({ name, title: plan.title, entities: ent, sheets, plates, slides }));
console.log(`${slides.filter((s) => s.built).length} slides, ${slides.reduce((n, s) => n + (s.attempts?.length || 0), 0)} attempts → ${out}`);
