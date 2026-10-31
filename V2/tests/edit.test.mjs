// The clip prompt and the policy-safe fallback on the vanderbilt6 fixture; the subtitle timing from the screenplay.
// No model calls. Run: node V2/tests/edit.test.mjs
import { readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { State } from "../backend/composer/state/state.js";
import { clipPrompt, policySafe } from "../backend/composer/edit/edit.js";
import { subtitlesFromScript } from "../backend/composer/sound/sound.js";

const fx = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "vanderbilt6-run.json"), "utf8"));
const run = { path: (f) => join(mkdtempSync(join(tmpdir(), "v2-test-")), f), save: () => {} };
const state = new State({ log: { places: fx.places || {} }, run, script: fx.script, elements: fx.elements, bank: fx.bank, features: fx.features, voices: fx.voices });
let fails = 0; const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails++; };
const sc = fx.script.scenes[0], shot2 = sc.shots.find((h) => h.n === 2), p = clipPrompt({ shot: shot2, scene: sc, state, voices: fx.voices });
ok(/^FRAMES/.test(p) && /CAST/.test(p) && /MOMENT/.test(p) && /BEATS/.test(p) && /SOUND/.test(p), "clip 2 prompt has FRAMES, CAST, MOMENT, BEATS, SOUND");
ok(/chinstrap beard/.test(p), "CAST carries Lincoln's feature line");
ok(/says: "Can your steamships/.test(p) && /- 0 s:/.test(p), "the line is a timed beat at 0 s of the clip");
const safe = policySafe(p);
ok(!/chinstrap beard/.test(safe) && /- Abraham Lincoln: centre third at the start\./.test(safe) && !/Lips move/.test(safe), "policy-safe prompt keeps names and positions only");
const subs = subtitlesFromScript(fx.script);
ok(subs.length === 5 && subs[0].from === 4 && subs[0].to > 4 && subs.every((s, i) => !subs[i + 1] || s.to <= subs[i + 1].from), `5 subtitles, timed and non-overlapping: ${subs.map((s) => `${s.from}-${s.to}`).join(", ")}`);
console.log("\n---- clip 2 prompt\n" + p);
console.log(`\n${fails ? `${fails} FAILED` : "all passed"}`); process.exit(fails ? 1 : 0);
