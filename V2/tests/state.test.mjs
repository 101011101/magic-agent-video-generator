// The state manager on a real run record (vanderbilt6): the single pass, the environment rule, the portrait rule, a crop
// box, and the keyframe prompt. No model calls, no credits. Run: node V2/tests/state.test.mjs
import { readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { State } from "../backend/composer/state/state.js";
import { keyframePrompt } from "../backend/composer/keyframes/template.js";
import { checkScript } from "../backend/composer/screenplay/screenplay.js";

const fx = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "vanderbilt6-run.json"), "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "v2-test-")), run = { path: (f) => join(tmp, f), save: () => {} };
const log = { places: fx.places || {} };
const state = new State({ log, run, script: fx.script, elements: fx.elements, bank: fx.bank, features: fx.features, voices: fx.voices });
let fails = 0; const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails++; };

const checks = checkScript(fx.script, { total: 30, max: 15, model: "wan-3.0", elements: fx.elements });
ok(checks.errors.length === 0, `screenplay checks pass (${checks.notes.length} notes)`);
ok(state.stills.length === 5, `5 distinct stills (${state.stills.map((s) => s.id).join(", ")})`);
const by = Object.fromEntries(state.stills.map((s) => [s.id, s]));
ok(by["s1-1"].envKind === "plate", "s1-1 from the plate");
ok(by["s1-2"].envKind === "edit" && by["s1-2"].env === "s1-1", "s1-2 edits s1-1 (same camera)");
ok(by["s1-3"].envKind === "master" && by["s1-3"].env === "s1-2" && by["s1-3"].punchIn, "s1-3 (Lincoln single) is a punch-in from the master s1-2");
ok(by["s1-4"].envKind === "master" && by["s1-4"].env === "s1-2", "s1-4 (Vanderbilt single) from the master, not from the Lincoln single");
ok(by["s1-5"].envKind === "master" && by["s1-5"].env === "s1-2", "s1-5 (three-shot) from the master");
ok(by["s1-3"].prev === "s1-2" && by["s1-4"].prev === "s1-3", "prev = the shot just seen (s1-4 follows the Lincoln single)");
const r3 = state.refs(by["s1-3"]), r5 = state.refs(by["s1-5"]);
ok(r3.length === 3 && r3[1].ref === "portrait:lincoln" && r3[2].ref.startsWith("style:"), `s1-3 gets the master, Lincoln's portrait (framed 3 sizes closer) and the style sheet: ${r3.map((x) => x.ref).join(", ")}`);
ok(r5.length === 3 && r5[1].ref === `prev:${by["s1-5"].prev}` && r5[2].ref.startsWith("style:"), `s1-5 gets the master, the frame just before it (from another camera) and the style sheet, no portraits (everyone is in it at nearly the same size): ${r5.map((x) => x.ref).join(", ")}`);
const box = state.cropFor(by["s1-3"], { lincoln: { x: 72, top: 28, bottom: 96 } });
ok(box && box.w === box.h && box.x + box.w <= 1 && box.y + box.h <= 1, `crop box for the Lincoln single is 16:9 and inside the master: ${JSON.stringify(box)}`);
ok(state.offFrame(by["s1-3"].frame).includes("left"), `off-frame sentence: ${state.offFrame(by["s1-3"].frame)}`);
const p = keyframePrompt({ still: by["s1-3"], state, medium: fx.medium, mode: "paint" });
ok(!/Walls:|Light:|south wall/.test(p.prompt), `the Lincoln single prompt has no room or camera prose (${p.prompt.length} chars; it carries context, memory, references and rules, never the plate description or the camera position)`);
console.log("\n---- s1-3 prompt (paint from the master)\n" + p.prompt);
console.log("\n---- s1-3 prompt (re-render of a crop)\n" + keyframePrompt({ still: by["s1-3"], state, medium: fx.medium, mode: "crop" }).prompt);
console.log("\n---- s1-2 prompt (edit)\n" + keyframePrompt({ still: by["s1-2"], state, medium: fx.medium, mode: "edit" }).prompt);
// T-046, the one rule of dependency. Hard: what was painted into it, recursively, and the clips pinned on those; soft: what
// took it as the frame before or as a portrait, kept and marked.
{
  const d2 = state.dependents("s1-2"), d3 = state.dependents("s1-3"), dp = state.dependents(`root-${by["s1-1"].place}`), dl = state.dependents("lincoln");
  ok(d2.hard.length === 3 && ["s1-3", "s1-4", "s1-5"].every((x) => d2.hard.includes(x)), `s1-2 → hard: the three stills painted from the master (${d2.hard.join(", ")})`);
  const pinned = state.clips.filter((c) => ["s1-2", "s1-3", "s1-4", "s1-5"].includes(c.start) || ["s1-2", "s1-3", "s1-4", "s1-5"].includes(c.end)).map((c) => `clip-${c.n}`);
  ok(JSON.stringify(d2.clips) === JSON.stringify(pinned) && d2.film, `s1-2 → the clips pinned on them (${d2.clips.join(", ")}) and the film`);
  ok(d3.hard.length === 0 && d3.soft.includes("s1-4"), `s1-3 → nothing is painted from it; s1-4 took it as the frame before, soft (${d3.soft.join(", ")})`);
  ok(dp.hard[0] === "s1-1" && dp.hard.length === 5, `the plate → every still of the place, through s1-1 (${dp.hard.join(", ")})`);
  ok(dl.hard.length === 0 && dl.soft.includes("s1-3"), `Lincoln's portrait → soft only: the stills that took it (${dl.soft.join(", ")})`);
}

console.log(`\n${fails ? `${fails} FAILED` : "all passed"}`); process.exit(fails ? 1 : 0);
