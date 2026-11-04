// A keyframe that needs words, three ways: klein in one shot; klein told to paint the sign blank (it painted "ECCON TALK"
// anyway, which is why the stage reads and fixes instead of splitting in advance) then fixed on qwen; and qwen in one shot.
// Each is read; a wrong one gets the stage's one fix. Writes V2/runs/probe-buildable/*.png. Usage: CLEANED_CAP=… node …/probe-buildable.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Jobs } from "../../backend/lib/jobs.js";
import { RUNS } from "../../backend/lib/env.js";
import { buildPlan, fixText, misread, strayText, letterModel } from "../../backend/composer/keyframes/buildable.js";
const dir = join(RUNS, "probe-buildable"); mkdirSync(dir, { recursive: true });
const logFile = join(dir, "run.json"), run = { name: "probe-buildable", path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {}, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
const jobs = new Jobs(run), res = "640px", img = (model) => ({ model, resolution: res, aspect_ratio: "16:9" });
const prompt = `A live-action photograph of a cosy podcast studio, medium-wide shot. A woman with shoulder-length dark hair in a rust-coloured blouse sits at a walnut table behind a black microphone, talking. On the wall behind her a glowing neon sign reads "ECON TALK". On the table in front of her a small brass desk nameplate reads "Maya Chen". Warm lamplight, bookshelf, amber curtains.`;
const bp = await buildPlan({ prompt, still: "flux-2-klein", tier: "free" });
console.log(`plan: words ${bp.words.map((w) => `"${w.text}" (${w.where})`).join(", ")} · steps ${bp.steps.map((x) => `${x.op}:${x.model}`).join(" → ")} · model proposed ${bp.proposed.map((x) => `${x.op}:${x.model}`).join(" → ")}`);
await jobs.image("klein-oneshot", "klein-oneshot.png", prompt, [], img("flux-2-klein"));
await jobs.image("split", "split.png", `${prompt}\nPaint the sign and the nameplate BLANK: no letters anywhere.`, [], img("flux-2-klein"));
for (const f of ["klein-oneshot.png", "split.png"]) { const st = await strayText({ run, file: f, words: bp.words }), wrong = misread(bp.words, st.seen); if (wrong.length || st.stray.length) { await fixText({ jobs, run, key: f.replace(".png", ""), file: f, words: bp.words, wrong, stray: st.stray, model: letterModel("flux-2-klein", "free"), res }); console.log(`${f}: fixed (${wrong.map((w) => w.text).join(", ")}${st.stray.length ? `; stray ${st.stray.map((x) => x.text).join(", ")}` : ""})`); } else console.log(`${f}: read correctly, no fix`); }
await jobs.image("qwen-oneshot", "qwen-oneshot.png", prompt, [], img("qwen-image-2.1"));
for (const f of ["klein-oneshot.png", "split.png", "qwen-oneshot.png"]) { const t = await strayText({ run, file: f, words: bp.words }); console.log(`${f}: reads ${t.seen.map((x) => `"${x.text}"`).join(", ") || "nothing"}${t.stray.length ? ` · stray ${t.stray.map((x) => `"${x.text}"`).join(", ")}` : ""}`); }
run.save(); console.log(`spent ${jobs.spent()}`);
