// Which free image model letters best: the same designed-lettering asks (a logo, a poster, a thumbnail, a meme on the
// user's photo) on flux-2-klein and qwen-image-2.1, so the catalogue's note on text is measured, not assumed.
// The image endpoint takes only 1:1, 16:9 and 9:16 (4:5 is refused), so the poster is asked tall. Writes V2/runs/probe-lettering/<model>-<case>.png. Usage: CLEANED_CAP=… node V2/bench/v1/probe-lettering.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Jobs } from "../../backend/lib/jobs.js";
import { RUNS } from "../../backend/lib/env.js";
const HERE = dirname(fileURLToPath(import.meta.url)), dir = join(RUNS, "probe-lettering"); mkdirSync(dir, { recursive: true });
const logFile = join(dir, "run.json"), run = { name: "probe-lettering", path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {}, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
const cat = join(HERE, "fixtures", "cat-surprised.jpg"); if (existsSync(cat)) copyFileSync(cat, join(dir, "cat.jpg"));
const CASES = [
  { id: "logo", aspect: "1:1", prompt: "A clean flat vector logo on a pure white background: a small orange wrench icon above the word \"KwickFixx\" in bold black sans-serif lettering, spelled exactly K-w-i-c-k-F-i-x-x. Nothing else." },
  { id: "poster", aspect: "9:16", prompt: "A minimalist black-and-cream printmaking poster. Large headline \"Printmakers' Open Studio\", below it \"9 October 2027\", then \"11:00–17:00\". Clean typography, generous margins, a simple linocut leaf motif." },
  { id: "thumbnail", aspect: "16:9", prompt: "A YouTube gaming thumbnail: a shocked young man's face on the right, and huge bold yellow words \"ONE LIFE ONLY\" with a thick black outline on the left, dark purple background." },
  ...(existsSync(join(dir, "cat.jpg")) ? [{ id: "meme", aspect: "1:1", input: "cat.jpg", prompt: "Make this photo a classic meme: top text \"WHEN YOU THINK IT'S FRIDAY\" and bottom text \"BUT IT'S ONLY TUESDAY\" in big white Impact capitals with a black outline. Keep the cat photo unchanged." }] : []),
];
const MODELS = ["flux-2-klein", "qwen-image-2.1"];
const jobs = new Jobs(run);
await Promise.all(MODELS.flatMap((m) => CASES.map(async (c) => {
  const f = `${m}-${c.id}.png`;
  try { const j = await jobs.image(`${m}-${c.id}`, f, c.prompt, c.input ? [c.input] : [], { model: m, resolution: "640px", aspect_ratio: c.aspect }); console.log(`${f}: ${j.credits} credits`); }
  catch (e) { console.log(`${f}: FAILED ${String(e.message || e).slice(0, 160)}`); }
})));
run.save(); console.log(`spent ${jobs.spent()}`);
