// Write the screenplay for a run's edited story and save it (run.json → screenplay; <run>/screenplay.txt). LLM only.
// Usage: node cleaned/experiments/screenplay-run.mjs custom-rrh4
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { writeScreenplay, screenplayText } from "../src/screenplay.js";

const name = process.argv[2], f = join(RUNS, name, "run.json"), r = JSON.parse(readFileSync(f, "utf8"));
const story = r.edit?.story || r.story?.story || r.world.story;
const names = (r.ids?.table || []).filter((t) => t.role === "asset" && t.kind === "character").map((t) => t.name);
const t0 = Date.now(), sp = await writeScreenplay(story, names);
r.screenplay = sp; writeFileSync(f, JSON.stringify(r, null, 2));
writeFileSync(join(RUNS, name, "screenplay.txt"), `${sp.title.toUpperCase()}\n\n${screenplayText(sp)}`);
console.log(`${sp.scenes.length} scenes, ${sp.scenes.reduce((n, s) => n + s.beats.length, 0)} beats, ${Math.round((Date.now() - t0) / 1000)} s`);
