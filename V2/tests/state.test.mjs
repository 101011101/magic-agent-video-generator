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
console.log(`\n${fails ? `${fails} FAILED` : "all passed"}`); process.exit(fails ? 1 : 0);
