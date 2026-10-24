// E1 Verifier sensitivity (LLM only, no image credits). Re-asks the slide 9 and 11 checks on frames whose truth we know,
// varying the model, the effort, and whether the prompt asks about framing and physical sense. Each cell runs N times
// (a salt in the prompt defeats the cache) to show how noisy the verdict is.
// Usage: node cleaned/experiments/verifier.mjs [--models gpt-6.1-sol,claude-fable-5-1] [--n 3]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const MODELS = opt("--models", "gpt-6.1-sol").split(","), N = Number(opt("--n", 3)), EFFORTS = opt("--efforts", "low,high").split(",");
const dir = join(RUNS, "custom-rrh1"), plan = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")).plan;
const slide = (n) => plan.slides.find((s) => s.n === n);

// Ground truth, read by eye: which frames are wrong and how.
const CASES = [
  { id: "s9-a1", file: "frames/s9-a1.png", slide: 9, truth: { wolf_wrong_end: true, border_lost: false } },
  { id: "s9-a2", file: "frames/s9-a2.png", slide: 9, truth: { wolf_wrong_end: false, border_lost: false } },
  { id: "s9-a3", file: "frames/s9-a3.png", slide: 9, truth: { wolf_wrong_end: true, border_lost: false } },
  { id: "s11-a2", file: "frames/s11-a2.png", slide: 11, truth: { wolf_wrong_end: true, border_lost: true }, prev: "frames/s10-a2.png" },
];

const BASE = (s) => `This is a frame from an illustrated story. It should show: ${s.shows}
For The Wolf: does the position match "${s.cast.find((c) => c.id === "wolf").where}" (same side, same item)?`;
const RICH = (s, prev) => `${BASE(s)}
Also judge physical sense: a bed has a head end (headboard, pillow) and a foot end. Is anyone lying with the head at the foot end,
or is a body part where the body could not be (a tail outside the covers at the far end, a body through furniture)?${prev ? `
Image 2 is the previous frame of the same shot. Is the framing the same (same zoom, same crop, same painted border or none)?` : ""}`;
const SCHEMA = S.obj({ wolf_where_ok: S.bool, wolf_head_at_foot_end: S.bool, framing_changed: S.bool, note: S.str });

const rows = [];
for (const model of MODELS) for (const effort of EFFORTS) for (const variant of ["base", "rich"]) for (const c of CASES) for (let i = 0; i < N; i++) {
  const s = slide(c.slide), images = [join(dir, c.file), ...(variant === "rich" && c.prev ? [join(dir, c.prev)] : [])];
  const prompt = `${variant === "base" ? BASE(s) : RICH(s, c.prev)}\nAnswer wolf_head_at_foot_end and framing_changed as false if you were not asked. (run ${i})`;
  try {
    const r = await jsonCall({ name: "exp-verify", schema: SCHEMA, prompt, images, effort, model });
    rows.push({ model, effort, variant, case: c.id, i, ...r, truth: c.truth });
    console.log(`${model} ${effort} ${variant} ${c.id} #${i}: where_ok=${r.wolf_where_ok} head_at_foot=${r.wolf_head_at_foot_end} framing_changed=${r.framing_changed}`);
  } catch (e) { console.log(`${model} ${effort} ${variant} ${c.id} #${i}: ERROR ${String(e.message).slice(0, 160)}`); rows.push({ model, effort, variant, case: c.id, i, error: String(e.message) }); }
}
writeFileSync(join(RUNS, "exp-verifier.json"), JSON.stringify(rows, null, 2));

// Score: a "catch" is the verdict that matches the truth. Wrong end → where_ok false (base) or head_at_foot true (rich).
const score = {};
for (const r of rows.filter((r) => !r.error)) {
  const k = `${r.model} | ${r.effort} | ${r.variant}`, t = (score[k] ??= { end: [0, 0], frame: [0, 0] });
  const said = r.variant === "rich" ? r.wolf_head_at_foot_end || !r.wolf_where_ok : !r.wolf_where_ok;
  t.end[0] += said === r.truth.wolf_wrong_end ? 1 : 0; t.end[1]++;
  if (r.variant === "rich" && r.case === "s11-a2") { t.frame[0] += r.framing_changed ? 1 : 0; t.frame[1]++; }
}
console.log("\nmodel | effort | prompt → bed-end verdict correct, framing change caught");
for (const [k, t] of Object.entries(score)) console.log(`${k} → ${t.end[0]}/${t.end[1]}${t.frame[1] ? `, ${t.frame[0]}/${t.frame[1]}` : ""}`);
