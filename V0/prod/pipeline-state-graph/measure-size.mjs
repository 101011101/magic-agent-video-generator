// Apparent size of a small prop vs its scale partner, per frame: the prop's longest extent and the partner's height as
// percent of frame height (vision call, cached), and their ratio against the real ratio (7 cm / 168 cm = 0.042).
// Usage: node current/prod/pipeline-state-graph/measure-size.mjs <runDir> [prop] [partner]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { visionCallImages } from "../pipeline-v2/src/vision.js";
import { retry } from "./src/net.js";
import { cm } from "./src/prompts.js";

const [runDir, prop = "shell", partner = "keeper"] = process.argv.slice(2);
const log = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")), ents = Object.fromEntries(log.timeline.entities.map((e) => [e.id, e]));
const real = cm(ents[prop].size) / cm(ents[partner].size);
const schema = { type: "object", additionalProperties: false, required: ["prop_present", "partner_present", "prop_pct", "partner_pct", "same_depth", "note"], properties: {
  prop_present: { type: "boolean" }, partner_present: { type: "boolean" }, prop_pct: { type: "number" }, partner_pct: { type: "number" }, same_depth: { type: "boolean" }, note: { type: "string" } } };
const text = `Measure in this frame. ${prop} = ${ents[prop].look} ${partner} = ${ents[partner].look}
prop_pct = the longest extent of ${prop} as a percent of the frame height (0 if absent). partner_pct = the visible height of ${partner} as a percent of the frame height (full standing height if standing; if kneeling or cropped, estimate the standing height the figure would have at that distance). same_depth = ${prop} and ${partner} are at roughly the same distance from the camera (within a factor of 2). note = a few words.`;
const rows = [];
for (const n of log.beats_run) {
  for (const role of ["start", "last"]) {
    const f = `b${n}-${role}.png`; if (!existsSync(join(runDir, f))) continue;
    const r = await retry(() => visionCallImages("sgsize", schema, text, [join(runDir, f)]), { label: f });
    const ratio = r.prop_present && r.partner_present && r.partner_pct > 0 ? r.prop_pct / r.partner_pct : null;
    rows.push({ beat: n, role, file: f, ...r, ratio: ratio == null ? null : +ratio.toFixed(3), x_real: ratio == null ? null : +(ratio / real).toFixed(1) });
  }
}
const valid = rows.filter((r) => r.x_real != null && r.same_depth);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const out = { run: log.run, prop, partner, real_ratio: +real.toFixed(4), frames: rows, summary: { frames_measured: valid.length, median_x_real: med(valid.map((r) => r.x_real)), max_x_real: Math.max(...valid.map((r) => r.x_real)), within_2x: valid.filter((r) => r.x_real <= 2).length } };
writeFileSync(join(runDir, `size-${prop}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary), "\n" + rows.map((r) => `${r.file}: ${r.prop_pct}% / ${r.partner_pct}% → ${r.x_real ?? "-"}× real${r.same_depth ? "" : " (different depth)"} ${r.note}`).join("\n"));
