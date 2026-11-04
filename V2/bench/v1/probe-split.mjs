// The keyframe split on a frame that needs words: klein paints the SCENE prompt (the frame prompt with its lettering taken
// out), qwen letters it, the frame is read. Next to klein-oneshot.png of probe-buildable. Usage: CLEANED_CAP=… node …
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Jobs } from "../../backend/lib/jobs.js";
import { RUNS } from "../../backend/lib/env.js";
import { buildPlan, fixText, misread, strayText } from "../../backend/composer/keyframes/buildable.js";
const dir = join(RUNS, "probe-buildable"), logFile = join(dir, "run.json"), run = { name: "probe-buildable", path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {}, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
const jobs = new Jobs(run), res = "640px";
const prompt = `A live-action photograph of a cosy podcast studio, medium-wide shot. A woman with shoulder-length dark hair in a rust-coloured blouse sits at a walnut table behind a black microphone, talking. On the wall behind her a glowing neon sign reads "ECON TALK". On the table in front of her a small brass desk nameplate reads "Maya Chen". Warm lamplight, bookshelf, amber curtains.`;
const bp = await buildPlan({ prompt, still: "flux-2-klein", tier: "free" });
console.log(`split ${bp.split} · steps ${bp.steps.map((x) => x.op + (x.model ? ":" + x.model : "")).join(" → ")}\nSCENE PROMPT: ${bp.scene}`);
await jobs.image("scene", "split2.png", bp.scene, [], { model: "flux-2-klein", resolution: res, aspect_ratio: "16:9" });
const pre = await strayText({ run, file: "split2.png", words: bp.words }); console.log(`scene reads: ${pre.seen.map((x) => `"${x.text}"`).join(", ") || "nothing"}`);
await fixText({ jobs, run, key: "split2-letter", file: "split2.png", words: bp.words, wrong: bp.words, stray: pre.stray, model: "qwen-image-2.1", res });
const st = await strayText({ run, file: "split2.png", words: bp.words }), wrong = misread(bp.words, st.seen);
console.log(`lettered reads: ${st.seen.map((x) => `"${x.text}"`).join(", ")} · wrong ${wrong.length} · stray ${st.stray.length}`);
run.save(); console.log(`spent ${jobs.spent()}`);
