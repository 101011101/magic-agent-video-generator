// The hyper-specific screenplay (a shooting script): one call turns the story into timed scenes and shots where every shot
// states its camera, and a START state and an END state for every element in it: third of frame, depth, facing, distance
// to whom, pose, hands. Keyframe prompts become a transcription of these states; clips take the beats and lines.
// Only declared elements (the bank) may appear. Text only. Usage: node V1/experiments/fact-script.mjs --from vanderbilt2 --label vanderbilt4 [--total 30] [--max 15]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "vanderbilt2"), label = opt("--label", "vanderbilt4"), TOTAL = Number(opt("--total", 30)), MAX = Number(opt("--max", 15));
const src = JSON.parse(readFileSync(join(RUNS, `exp-${from}`, "run.json"), "utf8"));
const dir = join(RUNS, `exp-${label}`); mkdirSync(dir, { recursive: true });
const logFile = join(dir, "run.json"), run = { name: `exp-${label}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const L = run.log;
for (const k of ["brief", "research", "story", "elements", "bank", "medium"]) L[k] ??= src[k];
const els = L.elements, chars = els.filter((e) => e.kind === "character"), props = els.filter((e) => e.kind === "prop"), places = els.filter((e) => e.kind === "place"), fixtures = els.filter((e) => e.kind === "fixture");
const ID = S.enum([...chars, ...props].map((e) => e.id)), PLACE = S.enum(places.map((e) => e.id));

const STATE = S.obj({ id: ID, third: S.enum(["left", "centre", "right"]), depth: S.enum(["near", "mid", "far"]), facing: S.str, distance: S.str, pose: S.str, hands: S.str });
const SHOT = S.obj({ n: S.int, start: S.int, seconds: S.int, size: S.enum(["wide", "medium-wide", "medium", "medium-close", "close"]), camera: S.str, cut_reason: S.str,
  start_state: S.arr(STATE), action: S.arr(S.obj({ at: S.int, text: S.str })), lines: S.arr(S.obj({ at: S.int, who: ID, text: S.str })), end_state: S.arr(STATE), transformations: S.arr(S.str), sfx: S.arr(S.obj({ at: S.int, text: S.str })) });
const SCENE = S.obj({ n: S.int, inside: S.bool, place: PLACE, time: S.str, start: S.int, seconds: S.int, ambience: S.str, music: S.str, captions: S.arr(S.obj({ at: S.int, text: S.str })), shots: S.arr(SHOT) });

if (!L.script) {
  console.log("shooting script…");
  L.script = await jsonCall({ name: "shooting-script", effort: "high", salt: label, schema: S.obj({ title: S.str, scenes: S.arr(SCENE) }),
    prompt: `Turn this story into a SHOOTING SCRIPT for a ${TOTAL}-second live-action film: scenes, then shots, then for every shot the exact START state and END state of every element in it. A later stage paints the start and end of each shot as stills from these states and makes the clip between them, so the states must be complete and unambiguous.

Elements (use ONLY these ids; nothing else may appear):
- characters: ${chars.map((e) => `${e.id} = ${e.name}`).join("; ")}
- props: ${props.map((e) => `${e.id} = ${e.name}`).join("; ") || "none"}
- places: ${places.map((e) => `${e.id} = ${e.name}; fixtures: ${e.look}`).join(" | ")}
- fixtures you may name in camera and facing text: ${fixtures.map((e) => `${e.id} = ${e.name}`).join("; ") || "none"}

Rules:
- Scenes: one place and one stretch of time each; start and seconds contiguous over the film, the last ending at ${TOTAL}. ambience: the background sound; music: a cue or "". captions: on-screen text with its time (titles and captions are overlays, never part of a picture).
- Shots: one continuous take from one camera, at most ${MAX} seconds; at least 2 seconds per action, lines at 2.5 words per second; cut only where the content turns, with a real change of size or angle (30 degrees or more). camera: where it stands in the place (which fixtures are behind the people), what it looks at, and which side of the people it is on; the camera never crosses to the other side of the people within a scene. cut_reason: scene start / time up / new point of interest.
- States: for EVERY element in the shot, at the start and at the end: third of frame (left, centre, right), depth (near, mid, far), facing (toward whom or which fixture), distance ("an arm's length from lincoln", "a pace behind vanderbilt", "at the doorway, a room's width from lincoln"), pose (standing, turned, head up, smiling, etc.), hands (clasped with X / at sides / holding Y / empty). Between start and end nobody changes third unless an action moves them, and the end state says where they stopped. The first shot of a scene that continues a previous shot keeps everyone's side of frame unless the camera text says the angle changes.
- action: what happens, with the second it starts; lines: the dialogue, each line with its second and speaker id. The story reports what was said ("Lincoln asks whether…"); write it as SPOKEN lines in the speaker's own words, faithful to the record, and quote directly where the story quotes. Captions are only for the title, the date and the source note, never for conversation. sfx: sounds with their second. transformations: what is different at the end from the start, one phrase each.
- Only the events the story contains: no invented business, no handshakes or gestures the story does not mention. "Nothing else may appear" applies to people and props; each place keeps its own fixtures and furniture as declared.

Story:
${L.story.story}`});
  run.save();
}
// Render as text for review.
const sc = L.script, name = (id) => els.find((e) => e.id === id)?.name || id;
const st = (s) => s.map((x) => `      ${x.id}: ${x.third} third, ${x.depth}; facing ${x.facing}; ${x.distance}; ${x.pose}; hands ${x.hands}`).join("\n");
const text = [`${sc.title.toUpperCase()}  (${TOTAL} s)`, ...sc.scenes.map((s) => [`\n${s.n}. ${s.inside ? "INT." : "EXT."} ${name(s.place).toUpperCase()} — ${s.time.toUpperCase()}   ${s.start}–${s.start + s.seconds} s`, `   ambience: ${s.ambience}${s.music ? `   music: ${s.music}` : ""}`, ...(s.captions.length ? [`   captions: ${s.captions.map((c) => `[${c.at}s] "${c.text}"`).join("  ")}`] : []),
  ...s.shots.map((h) => [`\n   SHOT ${h.n}  ${h.start}–${h.start + h.seconds} s  ${h.size}  (${h.cut_reason})`, `   camera: ${h.camera}`, `   START`, st(h.start_state), ...(h.action.length ? [`   ACTION`, ...h.action.map((a) => `      [${a.at}s] ${a.text}`)] : []), ...(h.lines.length ? [`   LINES`, ...h.lines.map((l) => `      [${l.at}s] ${name(l.who).toUpperCase()}: "${l.text}"`)] : []), ...(h.sfx.length ? [`   SFX  ${h.sfx.map((x) => `[${x.at}s] ${x.text}`).join("  ")}`] : []), `   END`, st(h.end_state), ...(h.transformations.length ? [`   changed: ${h.transformations.join("; ")}`] : [])].join("\n"))].join("\n"))].join("\n");
writeFileSync(join(dir, "shooting-script.txt"), text);
console.log(text);
// Checks (code): ids declared (schema enforces), timing contiguous, shots within MAX, thirds unchanged without an action.
const bad = [];
let t = 0; for (const s of sc.scenes) { if (s.start !== t) bad.push(`scene ${s.n} starts at ${s.start}, expected ${t}`); let u = s.start; for (const h of s.shots) { if (h.start !== u) bad.push(`shot ${h.n} starts at ${h.start}, expected ${u}`); if (h.seconds > MAX) bad.push(`shot ${h.n} is ${h.seconds} s > ${MAX}`); u += h.seconds; for (const a of h.start_state) { const b = h.end_state.find((x) => x.id === a.id); if (b && b.third !== a.third && !h.action.length) bad.push(`shot ${h.n}: ${a.id} changes third with no action`); } } if (u !== s.start + s.seconds) bad.push(`scene ${s.n} shots sum to ${u - s.start}, scene says ${s.seconds}`); t = s.start + s.seconds; }
if (t !== TOTAL) bad.push(`film ends at ${t}, expected ${TOTAL}`);
console.log(`\nchecks: ${bad.length ? bad.join("; ") : "timing contiguous, shots within limits, ids declared, thirds consistent"}`);
L.script_checks = bad; run.save();
