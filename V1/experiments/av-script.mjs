// The screenplay as a timed AV script: one LLM call assigns seconds to every scene and every beat within a total running time,
// without changing a word of the beats. Prints Time | Video | Audio per row. Usage: node cleaned/experiments/av-script.mjs --from custom-bakery-real --seconds 30
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "custom-bakery-real"), total = Number(opt("--seconds", 30));
const sp = JSON.parse(readFileSync(join(RUNS, from, "run.json"), "utf8")).screenplay;
const listing = sp.scenes.map((s, i) => `Scene ${i + 1}: ${s.inside ? "INT." : "EXT."} ${s.place} — ${s.time}${s.cut ? " (cut)" : ""}\n${s.beats.map((b, j) => `  ${i + 1}.${j + 1} ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n")}`).join("\n\n");
// One required key per scene and per beat: a free array came back empty twice (strict schemas only force what they name).
const SCHEMA = S.obj({ scenes: S.obj(Object.fromEntries(sp.scenes.map((s, i) => [String(i + 1), S.obj({ start: S.int, end: S.int, beats: S.obj(Object.fromEntries(s.beats.map((_, j) => [String(j + 1), S.obj({ at: S.int, seconds: S.int })]))) })]))) });
const r0 = await jsonCall({ name: "av-timing", effort: "medium", schema: SCHEMA,
  prompt: `Assign TIMING to this screenplay for a ${total}-second commercial. Return all ${sp.scenes.length} scenes (scene = its number) and, inside each, all of its beats (beat = its number within the scene).
- scenes: start and end in whole seconds, in order, contiguous (scene 1 starts at 0, each scene starts where the previous ended, the last ends at ${total}).
- beats: "at" = the absolute second the beat starts; "seconds" = how long it lasts: a single quick action 1-2 s, a held image 2-3 s; beats that only describe the state are the scene's opening seconds. The beats of a scene fill that scene exactly.
Do not rewrite or omit any beat; this is a timing table only.

${listing}` });
const r = { scenes: Object.entries(r0.scenes).map(([k, v]) => ({ scene: Number(k), start: v.start, end: v.end, beats: Object.entries(v.beats).map(([b, w]) => ({ beat: Number(b), ...w })) })) };
const rows = [];
for (const [i, s] of sp.scenes.entries()) {
  const t = r.scenes.find((x) => x.scene === i + 1) || r.scenes[i] || { start: 0, end: 0, beats: [] };
  rows.push(`\n${String(t.start).padStart(2, "0")}–${String(t.end).padStart(2, "0")}s  ${i + 1}. ${s.inside ? "INT." : "EXT."} ${s.place.toUpperCase()} — ${s.time.toUpperCase()}   ambience: ${s.ambience}${s.music ? ` · music: ${s.music}` : ""}`);
  for (const [j, b] of s.beats.entries()) {
    const bt = t.beats.find((x) => x.beat === j + 1) || { at: t.start, seconds: 0 };
    rows.push(`  ${String(bt.at).padStart(2, "0")}s +${bt.seconds}  | ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}${b.sfx ? `  | sfx: ${b.sfx}` : ""}`);
  }
}
const text = rows.join("\n");
writeFileSync(join(RUNS, "exp-bakery", `av-script-${total}s.txt`), text);
console.log(text);
