// Is it the tool? The edits that failed on flux-2-klein (a navy car came out teal, a clean-up removed a faucet, a
// headshot lost the smile) with the same prompts on qwen-image-2.1. Writes V2/runs/probe-edits/. Usage: CLEANED_CAP=… node …
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { Jobs } from "../../backend/lib/jobs.js";
import { RUNS, V2 } from "../../backend/lib/env.js";
const dir = join(RUNS, "probe-edits"); mkdirSync(dir, { recursive: true });
const logFile = join(dir, "run.json"), run = { name: "probe-edits", path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {}, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
const jobs = new Jobs(run), plan = (id) => JSON.parse(readFileSync(join(V2, "sessions", `b2-${id}`, "session.json"), "utf8")).turns.at(-1).plan.steps[0];
for (const [id, src] of [["B07a", "car-red.jpg"], ["B08c", "kitchen-before.jpg"], ["A05d", "two-friends.jpg"]]) {
  copyFileSync(join(V2, "sessions", `b2-${id}`, "materials", src), join(dir, `${id}-${src}`));
  const j = await jobs.image(`${id}-qwen`, `${id}-qwen.png`, plan(id).params.prompt_or_change, [`${id}-${src}`], { model: "qwen-image-2.1", resolution: "640px" });
  console.log(`${id}: ${j.credits} credits`);
}
run.save(); console.log(`spent ${jobs.spent()}`);
