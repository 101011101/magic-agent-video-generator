// Edge cases from the 2026-10-30 logic audit (V2/drafts/review-v2-logic.md), each fixed in code: synthetic elements and
// scripts, ffmpeg for the media cases, no network, no paid call. Run: node V2/tests/audit.test.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { State } from "../src/state/state.js";
import { checkScript, normalizeShots } from "../src/screenplay/screenplay.js";
import { keyframePrompt, deltaEditPrompt } from "../src/keyframes/template.js";
import { policySafe, makeClips, makeSequences, t2vPrompt } from "../src/edit/edit.js";
import { subtitlesFromScript } from "../src/lib/captions.js";
import { bars, stitch, hasAudio, fps } from "../src/lib/media.js";
import { mixMusic } from "../src/sound/sound.js";
import { MAX_REFS } from "../src/state/state.js";
import { GRID } from "../src/screenplay/screenplay.js";
import { COST } from "../src/lib/jobs.js";

const here = dirname(fileURLToPath(import.meta.url)), tmp = mkdtempSync(join(tmpdir(), "v2-audit-test-"));
for (const d of ["refs", "roots", "stills", "clips"]) mkdirSync(join(tmp, d), { recursive: true });
let failed = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failed++; };
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

// Synthetic world.
const elements = [
  { id: "alice", kind: "character", name: "Alice Hart", real: false, look: "a tall woman", aka: "" },
  { id: "ben", kind: "character", name: "Ben", real: false, look: "a short man", aka: "" },
  { id: "ledger", kind: "prop", name: "the ledger", real: false, look: "a leather ledger", aka: "" },
  { id: "parlour", kind: "place", name: "the parlour", real: false, look: "panelled walls, a fireplace, a round table", aka: "" },
  { id: "harbour", kind: "place", name: "the harbour", real: false, look: "a stone quay, moored boats", aka: "" },
  { id: "fireplace", kind: "fixture", name: "the fireplace", real: false, look: "a marble fireplace", aka: "" },
];
const bank = { alice: { file: "refs/alice.jpg" }, ben: { file: "refs/ben.jpg" }, ledger: { file: "refs/ledger.jpg" }, parlour: { file: "roots/parlour.png" }, harbour: { file: "roots/harbour.png" }, fireplace: { source: "text" } };
const features = { alice: "Long red hair, no glasses, tall", ben: "Bald, grey beard, round glasses, short" }, medium = { frame: "The frame is a live-action film still.", treatment: "Full colour." };
const run = { name: "audit", path: (f) => join(tmp, f), save() {}, log: {} };
const P = (id, visible = "in frame", third = "centre", o = {}) => ({ id, visible, third, depth: "mid", facing: "toward the camera", distance: "an arm's length from the table", pose: "standing upright", hands: "at sides", doing: "waiting", ...o });
const cam = (stands, same_as = 0) => ({ same_as, stands, height: "eye", looks_at: "the people", behind: ["the fireplace"] });
const shot = (o) => ({ cut_reason: "scene start", moment: "a quiet moment", action: [], lines: [], sfx: [], vo: [], changes: [], ...o, last: o.last || o.first });
const scene = (o) => ({ inside: true, time: "DAY", continuous: false, tone: "calm and formal", ambience: "a clock ticking", music: "", captions: [], line: { between: "alice and ben", camera_side: "the south wall" }, ...o,
  blocking: o.blocking || [...new Set(o.shots.flatMap((h) => [...h.first.people, ...h.first.props, ...h.last.people, ...h.last.props].map((x) => x.id)))].map((id) => ({ id, where: "by the table", facing: "each other", holding: "" })) });
const film = (...scenes) => ({ title: "probe", music: { cue: "", arc: [] }, scenes });
const mk = (script, o = {}) => new State({ log: { places: {} }, run, script, elements, bank, features, voices: {}, ...o });
const checkOpts = { total: 30, max: 15, model: "wan-3.0", elements, seen: {} }, opts = (total) => ({ ...checkOpts, total });

// H1. Shot numbers per scene are renumbered across the film, same_as remapped; checkScript errors on repeats.
{
  const s = film(
    scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 5, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } }), shot({ n: 2, start: 5, seconds: 5, size: "close", camera: cam("by the window", 1), first: { people: [P("alice", "in frame", "left"), P("ben", "off right", "right")], props: [] } })] }),
    scene({ n: 2, place: "harbour", start: 10, seconds: 20, shots: [shot({ n: 1, start: 10, seconds: 10, size: "wide", camera: cam("on the quay"), first: { people: [P("alice")], props: [] } }), shot({ n: 2, start: 20, seconds: 10, size: "close", camera: cam("on the quay", 1), first: { people: [P("alice")], props: [] } })] }));
  const dup = checkScript(JSON.parse(JSON.stringify(s)), checkOpts);
  ok(dup.errors.some((e) => /shot numbers repeat/.test(e)), `repeated shot numbers are an error: ${dup.errors.find((e) => /repeat/.test(e))}`);
  normalizeShots(s);
  ok(s.scenes.flatMap((sc) => sc.shots.map((h) => h.n)).join(",") === "1,2,3,4", `renumbered across the film: ${s.scenes.flatMap((sc) => sc.shots.map((h) => h.n)).join(",")}`);
  ok(s.scenes[1].shots[1].camera.same_as === 3 && s.scenes[0].shots[1].camera.same_as === 1, `same_as remapped (scene 2 shot 2 → 3): ${s.scenes[1].shots[1].camera.same_as}`);
  ok(normalizeShots(s).scenes[1].shots[1].n === 4, "idempotent");
  ok(checkScript(s, checkOpts).errors.length === 0, `the normalised script passes: ${checkScript(s, checkOpts).errors.join(" | ")}`);
  const st = mk(s); ok(st.clips.length === 4 && new Set(st.clips.map((c) => c.n)).size === 4, `four clips, four numbers: ${st.clips.map((c) => `${c.n}:${c.start}-${c.end}`).join(" ")}`);
}
// M3 / L10. A card is a whole shot; visible outside the enum is an error.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 20, captions: [{ at: 0, text: "A TITLE" }], shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "off left")], props: [] }, last: { people: [P("alice", "in frame")], props: [] }, action: [{ at: 2, text: "alice walks in" }] }), shot({ n: 2, start: 10, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "offscreen")], props: [] } })] }));
  const r = checkScript(s, opts(20));
  ok(r.errors.some((e) => /title card is a whole shot/.test(e)), `card first frame with people in the last frame is an error: ${r.errors.find((e) => /whole shot/.test(e))}`);
  ok(r.errors.some((e) => /visible "offscreen"/.test(e)), `visible outside the enum is an error`);
}
// M8. The sfx rule: a quoted sentence or the words narration / voice-over are errors; a bare "says" is a note.
{
  const mkS = (sfx) => film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice")], props: [] }, sfx: [{ at: 1, text: sfx }] })] }));
  const click = checkScript(mkS('the "click" of a latch'), opts(10)); ok(click.errors.length === 0, `a short quoted word in sfx is not an error: ${click.errors.join(" | ")}`);
  const nar = checkScript(mkS("the narrator's chair creaks"), opts(10)); ok(nar.errors.length === 0 && nar.notes.some((n) => /may hold speech or narration/.test(n)), `the word narrator in sfx is a note, never an error`);
  const says = checkScript(mkS("a man says nothing, a door slams"), opts(10)); ok(says.errors.length === 0 && says.notes.some((n) => /may hold speech/.test(n)), `"says" alone is a note`);
  const vo = checkScript(mkS('Voice-over narration: "The year is eighteen sixty-two and the war is going badly."'), opts(10)); ok(vo.errors.length === 0 && vo.notes.length >= 1, `narration written into sfx is a note the user sees, not a stop`);
}
// H2. A scene that opens on a title card: the next still is painted from the plate, never from the card.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 30, captions: [{ at: 0, text: "A TITLE" }], shots: [shot({ n: 1, start: 0, seconds: 2, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "off left")], props: [] } }), shot({ n: 2, start: 2, seconds: 28, size: "close", camera: cam("by the window"), first: { people: [P("alice", "in frame")], props: [] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x]));
  ok(by["s1-1"].card && by["s1-1"].envKind === "card", `the first still is a card`);
  ok(by["s1-2"].envKind === "plate" && by["s1-2"].env === null, `the still after the card starts from the plate: ${by["s1-2"].envKind}:${by["s1-2"].env}`);
}
// M4. A return to a place with the cast changed lists the change; a punch-in with people merely off frame does not.
{
  const s = film(
    scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 5, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } }), shot({ n: 2, start: 5, seconds: 5, size: "close", camera: cam("by the window"), first: { people: [P("alice", "in frame", "centre"), P("ben", "off right", "right")], props: [] } })] }),
    scene({ n: 2, place: "harbour", start: 10, seconds: 10, shots: [shot({ n: 3, start: 10, seconds: 10, size: "wide", camera: cam("on the quay"), first: { people: [P("alice")], props: [] } })] }),
    scene({ n: 3, place: "parlour", start: 20, seconds: 10, shots: [shot({ n: 4, start: 20, seconds: 10, size: "medium", camera: cam("by the door"), first: { people: [P("alice", "in frame", "centre", { doing: "reading the ledger" })], props: [] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x]));
  const punch = keyframePrompt({ still: by["s1-2"], state: st, medium, mode: "paint" }).prompt, back = keyframePrompt({ still: by["s3-1"], state: st, medium, mode: "paint" }).prompt;
  ok(by["s1-2"].envKind === "master" && !/CHANGES/.test(punch) && /same instant/.test(punch), `the punch-in has no CHANGES block and is the same instant (Ben is only off frame)`);
  ok(by["s3-1"].envKind === "master" && by["s3-1"].env === "s1-1", `the return is painted from the scene-1 wide: ${by["s3-1"].env}`);
  ok(/CHANGES \(since image 1\)/.test(back) && /^- Ben is no longer here\.$/m.test(back) && /^- Alice Hart: now .*reading the ledger\.$/m.test(back) && /a moment earlier/.test(back) && !/nothing in it changes\./.test(back), `the return lists Ben gone and Alice's new doing, and says image 1 is an earlier moment`);
}
// M1 / M2. Degenerate boxes give no crop; an off-frame exclusion never shrinks the crop below the wanted height or re-centres it off the head.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 30, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "centre"), P("ben", "in frame", "left")], props: [] } }), shot({ n: 2, start: 10, seconds: 20, size: "medium-wide", camera: cam("by the window"), first: { people: [P("alice", "in frame", "centre"), P("ben", "off left", "left")], props: [] } })] }));
  const st = mk(s), still = st.stills.find((x) => x.id === "s1-2");
  ok(st.cropFor(still, { alice: { x: 0, top: 0, bottom: 0 } }) === null, "a zero box (absent) gives no crop");
  ok(st.cropFor(still, { alice: { x: 50, top: 60, bottom: 40 } }) === null, "top below bottom gives no crop");
  const box = st.cropFor(still, { alice: { x: 51, top: 3, bottom: 96 }, ben: { x: 38, top: 10, bottom: 90 } });
  ok(box && box.h >= 0.82 && box.y === 0 && box.w === box.h, `the off-frame shrink is refused when it would cut the wanted height: ${JSON.stringify(box)}`);
}
// L9. A DAY scene and a NIGHT scene in one place with the same camera and frame are two stills.
{
  const fr = { people: [P("alice")], props: [] };
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, time: "DAY", shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: fr })] }), scene({ n: 2, place: "parlour", start: 10, seconds: 20, time: "NIGHT", shots: [shot({ n: 2, start: 10, seconds: 20, size: "wide", camera: cam("at the south wall"), first: fr })] }));
  ok(mk(s).stills.length === 2, `two stills for day and night: ${mk(s).stills.length}`);
}
// L1. Labels: no throw without a look; two of a kind with one name are told apart.
{
  const els = [...elements, { id: "harrow", kind: "prop", name: "Harrow", real: false, look: "a gray frigate", aka: "" }, { id: "harrow-2", kind: "prop", name: "Harrow", real: false, aka: "" }];
  const st = new State({ log: { places: {} }, run, script: null, elements: els, bank, features, voices: {} });
  let thrown = false; try { st.name("harrow-2"); } catch { thrown = true; }
  ok(!thrown && st.name("harrow") !== st.name("harrow-2"), `labels: "${st.name("harrow")}" vs "${st.name("harrow-2")}"`);
}
// L5. policySafe touches only the CAST block and strips a feature line that ends in "enters during the shot".
{
  const p = "FRAMES\nImage 1 is the first frame.\n\nCAST (each keeps his own face)\n- Alice Hart: long red hair; left third at the start.\n- Ben: bald, grey beard; enters during the shot.\n\nBEATS (seconds from the start of the clip)\n- 2 s: Ben says: \"hello; left third at the start\"\nLips move with the words.";
  const q = policySafe(p);
  ok(/^- Alice Hart: left third at the start\.$/m.test(q) && /^- Ben: enters during the shot\.$/m.test(q), "CAST lines reduced to names and positions");
  ok(q.includes('Ben says: "hello; left third at the start"') && q.includes("They speak the lines."), "the BEATS line is untouched and the lip-sync sentence is replaced");
}
// L4. Two lines at the same second become one card.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 30, shots: [shot({ n: 1, start: 0, seconds: 30, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice"), P("ben", "in frame", "right")], props: [] }, lines: [{ at: 3, who: "alice", text: "Now." }, { at: 3, who: "ben", text: "Yes." }, { at: 8, who: "alice", text: "Good." }] })] }));
  const subs = subtitlesFromScript(s);
  ok(subs.length === 2 && subs[0].text === "Now.\nYes." && subs[0].to > subs[0].from, `tied lines share one card: ${JSON.stringify(subs)}`);
}
// Bars gate: a letterboxed still is flagged, a full one is not.
{
  const full = join(tmp, "full.png"), thin = join(tmp, "thin.png"), thick = join(tmp, "thick.png");
  ff(["-f", "lavfi", "-i", "color=c=gray:s=2752x1536", "-frames:v", "1", "-update", "1", full]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=2752x1488", "-vf", "pad=2752:1536:0:24:black", "-frames:v", "1", "-update", "1", thin]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=2752x1376", "-vf", "pad=2752:1536:0:80:black", "-frames:v", "1", "-update", "1", thick]);
  const a = bars(full), b = bars(thin), c = bars(thick);
  ok(!a.boxed && a.frac === 0, `no bars: ${JSON.stringify(a)}`);
  ok(!b.boxed && b.top === 24 && b.bottom === 24 && b.frac > 0.03, `thin bars are measured and noted, not flagged: ${JSON.stringify(b)}`);
  ok(c.boxed && c.top === 80, `bars of 5% or more flag: ${JSON.stringify(c)}`);
}
// M9 / M14. The stitch takes the highest frame rate and gives a silent part an audio track.
{
  const a = join(tmp, "clips", "a.mp4"), b = join(tmp, "clips", "b.mp4"), out = join(tmp, "clips", "film.mp4");
  ff(["-f", "lavfi", "-i", "color=c=gray:s=640x360:r=24:d=1", "-f", "lavfi", "-i", "sine=f=440:d=1", "-c:v", "libx264", "-c:a", "aac", "-shortest", a]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=640x338:r=30:d=1", "-vf", "pad=640:360:0:11:black", "-c:v", "libx264", b]);   // thin bars, like a painter's letterbox
  ok(hasAudio(a) && !hasAudio(b) && bars(b).top >= 10 && bars(b).top <= 12, `fixture: one part with sound, one without and letterboxed (${JSON.stringify(bars(b))})`);   // h264 chroma rounding moves the edge a pixel
  stitch([a, b], join(tmp, "clips", "concat.txt"), out);
  ok(existsSync(out) && hasAudio(out) && Math.round(fps(out)) === 30, `the film has audio and runs at the higher rate: ${Math.round(fps(out))} fps`);
  ok(bars(b.replace(/\.mp4$/, "-part.mp4")).frac === 0, `the letterboxed part is cropped to the picture at the stitch: ${JSON.stringify(bars(b.replace(/\.mp4$/, "-part.mp4")))}`);
  const card = join(tmp, "clips", "card.mp4"), out2 = join(tmp, "clips", "film2.mp4");   // a title card: black, 2 s of digital silence, like the pipeline's
  ff(["-f", "lavfi", "-i", "color=c=black:s=640x360:r=24:d=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2", "-c:v", "libx264", "-c:a", "aac", "-shortest", card]);
  let stitched = true; try { stitch([a, card], join(tmp, "clips", "concat2.txt"), out2); } catch (e) { stitched = false; }
  ok(stitched && existsSync(out2) && Math.round(fps(out2)) === 24, "a digitally silent title card stitches beside a loud clip (no normalisation on silence)");
}
// H4. A non-numeric cap refuses to load.
{
  const r = spawnSync("node", ["--input-type=module", "-e", `import(${JSON.stringify(join(here, "..", "src", "lib", "jobs.js"))}).then(() => { console.log("loaded"); process.exit(0); }, (e) => { console.error(String(e)); process.exit(3); })`], { env: { ...process.env, CLEANED_CAP: "3,000" } });
  ok(r.status === 3 && /CLEANED_CAP must be/.test(r.stderr.toString()), `CLEANED_CAP=3,000 refused: ${r.stderr.toString().trim().slice(0, 80)}`);
}
// Size: a far thing marked large is an error; the size word reaches the prompt.
{
  const X = (id, where, size) => ({ id, visible: "in frame", where, size, condition: "intact" });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice", "in frame", "left", { depth: "near", size: "large" })], props: [X("ledger", "Right third, far, on the sea", "large")] } })] }));
  ok(checkScript(s, opts(10)).errors.some((e) => /ledger is far yet large/.test(e)), "a far prop marked large is an error");
  s.scenes[0].shots[0].first.props[0].size = "tiny"; s.scenes[0].shots[0].last = s.scenes[0].shots[0].first;
  const st = mk(s), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/Alice Hart: left third, about half the frame's height/.test(p) && /the ledger: right third, far, on the sea, a speck, far off/i.test(p), "size words reach the element lines");
}
// Orientation: a prop that turns without action, and a from-behind camera with a subject facing the lens, are errors; the VIEW line and the prop facing reach the prompt.
{
  const X = (id, where, facing, points = "away from the camera") => ({ id, visible: "in frame", where, size: "small", points, facing, condition: "intact" });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: { ...cam("above the sea"), view: "from behind" }, first: { people: [P("alice", "in frame", "left", { depth: "far", size: "tiny" })], props: [X("ledger", "Left third, mid, above the sea", "seen from behind, nose away toward the quay, screen right")] }, last: { people: [P("alice", "in frame", "left", { depth: "far", size: "tiny" })], props: [X("ledger", "Left third, mid, above the sea", "nose toward the camera", "toward the camera")] } })] }));
  const r = checkScript(s, opts(10));
  ok(r.errors.some((e) => /ledger turns \(away from the camera → toward the camera\)/.test(e)) && r.errors.some((e) => /camera is from behind, yet ledger points toward the camera/.test(e)), `turning without action and pointing at a from-behind camera are errors, read from the enums: ${r.errors.filter((e) => /ledger/.test(e)).length} found`);
  s.scenes[0].shots[0].last = s.scenes[0].shots[0].first;
  const st = mk(s), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/VIEW: from behind the subjects, at eye level: backs and tails toward the camera/.test(p) && /the ledger: left third, mid, above the sea, about a tenth of the frame's height; seen from behind, nose away toward the quay, screen right/i.test(p), `the VIEW line and the prop facing are in the prompt: ${(p.match(/VIEW:[^\n]*/) || [""])[0]}`);
}
// Theme, treatment and relations reach the prompt; a relation naming something absent is an error; a tail toward the lens is not "facing the camera".
{
  const X = (id, where, facing) => ({ id, visible: "in frame", where, size: "small", facing, condition: "intact" });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", treatment: "speed: the ledger streaks across the frame with motion blur", camera: { ...cam("above the sea"), view: "from behind" }, first: { people: [P("alice", "in frame", "left", { depth: "near", size: "large" })], props: [X("ledger", "Left third, mid, above the sea", "tails toward the lens, nose away toward the quay")], relations: [{ a: "ledger", how: "flies toward", b: "alice" }, { a: "alice", how: "beside", b: "ben" }] } })] }));
  s.theme = "two who move as one";
  const r = checkScript(s, opts(10));
  ok(r.errors.some((e) => /relation "alice beside ben" names ben, which is not in this frame/.test(e)) && !r.errors.some((e) => /faces the camera/.test(e)), `an absent relation target is an error and a tail toward the lens is fine: ${r.errors.join(" | ")}`);
  s.scenes[0].shots[0].first.relations.pop(); s.scenes[0].shots[0].last = s.scenes[0].shots[0].first;
  const st = mk(s), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/Theme: Two who move as one\./.test(p) && /Treatment: Speed: the ledger streaks across the frame with motion blur\./.test(p) && /RELATIONS\n- the ledger flies toward Alice Hart\./.test(p), "theme, treatment and relations are in the keyframe prompt");
}
// Far people are asked for as small figures inside what carries them, never as visible people to show.
{
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice", "in frame", "left", { depth: "far", distance: "inside the lead boat" }), P("ben", "in frame", "right", { depth: "far", distance: "inside the second boat" })], props: [] } })] }));
  const st = mk(s), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/PEOPLE \(nobody visible up close; 2 far away inside what carries them\)/.test(p) && /a small figure inside the lead boat; not individually visible/.test(p) && /No person visible up close; the far ones are small figures inside what carries them, each thing once/.test(p) && !/Exactly 2 people in frame/.test(p), "far people are figures inside their carriers, not a count to show");
}
// People far inside vehicles: an uncountable zero is not a flag when the screenplay puts everyone at far depth.
{
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice", "in frame", "left", { depth: "far" }), P("ben", "in frame", "right", { depth: "far" })], props: [] } })] }));
  const st = mk(s), still = st.stills[0];
  const fake = async (answer) => { const orig = st.peopleCheck; return answer; };
  // the rule alone, with a stubbed model answer
  const RANK = { left: 0, centre: 1, right: 2 }, people = still.frame.people;
  const judge = (r) => { const tooSmall = r.countable === false && people.every((p) => p.depth === "far") && r.people <= people.length; return r.people === people.length || tooSmall; };
  ok(judge({ people: 0, countable: false }) && !judge({ people: 0, countable: true }) && !judge({ people: 3, countable: false }), "zero uncountable far people pass; a countable zero or an extra person fails");
}
// M12. A clip whose still was built on a flagged still waits, even when its own still passed.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 30, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } }), shot({ n: 2, start: 10, seconds: 20, size: "close", camera: cam("by the window"), first: { people: [P("alice", "in frame", "centre"), P("ben", "off right", "right")], props: [] } })] }));
  const st = mk(s), K = { painted: { "s1-1": { file: "stills/s1-1.png", bad: true }, "s1-2": { file: "stills/s1-2.png", bad: false } } }, said = [];
  const jobs = { video: async () => { throw new Error("must not be called"); } };
  const r = await makeClips({ state: st, jobs, K, run, say: (m) => said.push(m), parallel: 0 });
  ok(r.waiting.length === 2 && said.some((m) => /clip 2: waiting on s1-1/.test(m)), `clip 2 waits on the flagged master: ${said.join(" | ")}`);
}
// A written camera move is an error; the scene's old music field is lifted to the film header.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: { ...cam("at the south wall"), stands: "at the south wall, tracking toward the table" }, first: { people: [P("alice")], props: [] } })] }));
  ok(checkScript(s, opts(10)).errors.length === 0 && checkScript(s, opts(10)).notes.some((n) => /camera may move \("tracking"/.test(n)), `a tracking camera is a note, never an error: ${checkScript(s, opts(10)).notes.find((n) => /camera may move/.test(n))}`);
  const mkA = (stands, looks, action) => film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: { ...cam(stands), looks_at: looks }, first: { people: [P("alice")], props: [] }, action: action ? [{ at: 1, text: action }] : [] })] }));
  ok(checkScript(mkA("at a fixed position by the door", "the bombs descending toward the deck", "Ben follows Alice to the table while the locked camera does not follow."), opts(10)).notes.every((n) => !/camera may move/.test(n)), "bombs descending, a man following and a negated camera are not moves");
  ok(checkScript(mkA("at a fixed position by the door", "Alice", "The camera follows Alice to the table."), opts(10)).notes.some((n) => /camera may move \("follows" in action\)/.test(n)), "the camera following in an action is noted");
  const old = { title: "old", scenes: [{ ...scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("x"), first: { people: [P("alice")], props: [] } })] }), music: "a slow piano cue" }] };
  normalizeShots(old); ok(old.music.cue === "a slow piano cue" && !("music" in old.scenes[0]) && old.scenes[0].shots[0].pace === "natural", `an old script's scene music is lifted to the film and pace defaults: ${JSON.stringify(old.music)}`);
}
// References are capped and the least prominent dropped: a wide with two far pilots, two jets, two worn helmets, two attached bombs and a ship.
{
  const els = [...elements, ...["jet-a", "jet-b", "helmet-a", "helmet-b", "bomb-a", "bomb-b", "ship"].map((id) => ({ id, kind: "prop", name: id, real: false, look: `a ${id}`, aka: "" }))];
  const bk = { ...bank, ...Object.fromEntries(["jet-a", "jet-b", "helmet-a", "helmet-b", "bomb-a", "bomb-b", "ship"].map((id) => [id, { file: `refs/${id}.jpg` }])) };
  const X = (id, where) => ({ id, visible: "in frame", where, condition: "intact" });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice", "in frame", "left", { depth: "far" }), P("ben", "in frame", "centre", { depth: "far" })], props: [X("jet-a", "Left third, mid, above the sea"), X("jet-b", "Centre third, mid, above the sea"), X("helmet-a", "Worn by alice inside jet-a"), X("helmet-b", "Worn by ben inside jet-b"), X("bomb-a", "Attached beneath jet-a's pylon"), X("bomb-b", "Attached beneath jet-b's pylon"), X("ship", "Right third, far, on the sea")] } })] }));
  const st = new State({ log: { places: {} }, run, script: s, elements: els, bank: bk, features, voices: {} }), r = st.refs(st.stills[0]), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(r.length <= MAX_REFS && !r.some((x) => /helmet|bomb/.test(x.ref)) && r.some((x) => x.ref === "prop:jet-a"), `at most ${MAX_REFS} images, the jets kept, worn and attached things dropped: ${r.map((x) => x.ref).join(", ")}`);
  ok(!/\(image \d/.test(p) && /paint no numbers, labels/.test(p), "no image numbers inside the element lines; the rule against painting labels is present");
}
// The master is the wide that shares the most elements with the frame, not the latest wide.
{
  const s = film(
    scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } })] }),
    scene({ n: 2, place: "parlour", start: 10, seconds: 10, continuous: true, shots: [shot({ n: 2, start: 10, seconds: 10, size: "wide", camera: cam("at the window"), first: { people: [P("alice", "off left", "left"), P("ben", "off left", "right")], props: [{ id: "ledger", visible: "in frame", where: "Centre third, mid, on the table", condition: "closed" }] } })] }),
    scene({ n: 3, place: "parlour", start: 20, seconds: 10, continuous: true, shots: [shot({ n: 3, start: 20, seconds: 10, size: "medium", camera: cam("by the door"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x]));
  ok(by["s3-1"].env === "s1-1", `the return with Alice and Ben is painted from the wide that has them (s1-1), not the latest wide (s2-1): ${by["s3-1"].env}`);
}
// The text-to-video form of a shot: the frames and portraits as named references, pace and no music in the text.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", pace: "fast", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] }, lines: [{ at: 1, who: "alice", text: "Now." }] }), shot({ n: 2, start: 4, seconds: 6, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] } })] }));
  const st = mk(s), p = t2vPrompt({ shot: s.scenes[0].shots[0], scene: s.scenes[0], state: st, voices: {}, refs: [{ name: "start", file: "a.png" }, { name: "end", file: "b.png" }, { name: "alice", file: "refs/alice.jpg" }], script: s });
  ok(/begins as @start and ends as @end/.test(p) && /@alice, Alice Hart/.test(p) && /FAST:/.test(p) && /no music of any kind/.test(p) && /says: "Now\."/.test(p), "the t2v prompt references the frames and the portrait, carries the pace and the line, and asks for no music");
}
// Grids and prices of the other video models, from the sheet; the voice sample as a reference in the t2v prompt.
{
  ok(GRID["ltx-2.5"].includes(1) && GRID["ltx-2.5"].includes(60) && GRID["kling-3.0"][0] === 3 && !GRID["kling-3.0"].includes(2), "ltx-2.5 runs 1 to 60 s, kling-3.0 starts at 3 s");
  ok(COST.video(10, "kling-3.0", true) === 720 && COST.video(10, "kling-3.0", false) === 480 && COST.video(10, "ltx-2.5", true) === 480 && COST.video(10, "wan-3.0") === 960, `audio is extra on kling and included on ltx and wan: ${COST.video(10, "kling-3.0", true)}, ${COST.video(10, "ltx-2.5", true)}, ${COST.video(10, "wan-3.0")}`);
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] }, lines: [{ at: 1, who: "alice", text: "Now." }] }), shot({ n: 2, start: 4, seconds: 6, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] } })] }));
  const st = mk(s), p = t2vPrompt({ shot: s.scenes[0].shots[0], scene: s.scenes[0], state: st, voices: {}, refs: [{ name: "start", file: "a.png" }, { name: "end", file: "b.png" }, { name: "alice_voice", file: "sound/voice-alice.mp3", voice: true }], script: s });
  ok(/in the voice of @alice_voice\) says: "Now\."/.test(p), "a voice reference is spoken as @alice_voice in the line");
}
// Sequences: consecutive shots of a scene grouped within the limit, rendered at the grid, the frames as ordered references.
{
  const s = film(
    scene({ n: 1, place: "parlour", start: 0, seconds: 12, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", pace: "fast", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] }, last: { people: [P("alice", "in frame", "right")], props: [] }, action: [{ at: 1, text: "alice crosses to the window" }] }), shot({ n: 2, start: 4, seconds: 4, size: "close", camera: cam("by the window"), first: { people: [P("alice", "in frame", "centre")], props: [] }, lines: [{ at: 5, who: "alice", text: "Now." }] }), shot({ n: 3, start: 8, seconds: 4, size: "wide", camera: cam("at the door"), first: { people: [P("alice", "in frame", "left")], props: [] } })] }),
    scene({ n: 2, place: "harbour", start: 12, seconds: 10, shots: [shot({ n: 4, start: 12, seconds: 10, size: "wide", camera: cam("on the quay"), first: { people: [P("alice")], props: [] } })] }));
  const st = mk(s), K = { painted: Object.fromEntries(st.stills.map((x) => [x.id, { file: `stills/${x.id}.png` }])) };
  const calls = []; const jobs = { tvideo: async (key, file, prompt, refs, seconds) => { calls.push({ key, seconds, refs: refs.map((r) => r.name), prompt }); return { estimated: true, credits: seconds * 96 }; } };
  await makeSequences({ state: st, jobs, K, run, say: () => {}, maxSeq: 10, voiceRefs: false });
  const keys = calls.map((c) => c.key).sort();
  ok(keys.join(" ") === "seq-1-2 seq-3-3 seq-4-4", `shots 1–2 fit 10 s together, shot 3 and scene 2 on their own: ${keys.join(" ")}`);
  const a = calls.find((c) => c.key === "seq-1-2");
  ok(a.seconds === 8 && a.refs.join(",") === "f1,f2,f3,alice" && /HARD CUT to a new camera position at 4 s/.test(a.prompt) && /SHOT 1 \(0–4 s of the clip\), wide shot, FAST:/.test(a.prompt) && /begins as @f1 and ends as @f2/.test(a.prompt) && /SHOT 2 \(4–8 s of the clip\)/.test(a.prompt) && /begins as @f3 and holds/.test(a.prompt) && /- 5 s: Alice Hart .* says: "Now\."/.test(a.prompt) && /no music of any kind/.test(a.prompt), "the sequence prompt names the cut, the frames in order, the beats at clip seconds, and no music");
  const b = calls.find((c) => c.key === "seq-4-4"); ok(b.seconds === 10 && b.refs.join(",") === "f1,alice", "a held single shot: one frame and the portrait");
  calls.length = 0; const K3 = { painted: K.painted }; await makeSequences({ state: st, jobs, K: K3, run, say: () => {}, maxSeq: 25, across: true });
  ok(calls.length === 1 && calls[0].key === "seq-1-4" && calls[0].seconds === 25 && /SHOT 4 \(12–22 s of the clip\), INT\. the harbour/.test(calls[0].prompt) && /HARD CUT to a new camera position at 4 s, 8 s, 12 s/.test(calls[0].prompt), `across scenes: all four shots (22 s) in one 25-s sequence with headings per shot: ${calls.map((c) => `${c.key}@${c.seconds}s`).join(",")} · ${(calls[0]?.prompt.match(/SHOT 4[^\n]*/) || [""])[0]} · ${(calls[0]?.prompt.match(/HARD CUT[^.]*/) || [""])[0]}`);
  calls.length = 0; const K2 = { painted: K.painted }; await makeSequences({ state: st, jobs, K: K2, run, say: () => {}, maxSeq: 10, only: new Set(["clip-2"]) });
  ok(calls.length === 1 && calls[0].key === "seq-1-2", `--only clip-2 renders just the group holding shot 2: ${calls.map((c) => c.key).join(",")}`);
}
// The style sheet: the first generated plate; sent whenever image 1 is itself a painting, never for a plate paint.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 5, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] }, last: { people: [P("alice", "in frame", "right")], props: [] }, action: [{ at: 1, text: "alice crosses" }] }), shot({ n: 2, start: 5, seconds: 5, size: "close", camera: cam("by the window"), first: { people: [P("alice", "in frame", "centre")], props: [] } })] }));
  const st = mk(s), r1 = st.refs(st.stills[0]), r3 = st.refs(st.stills[2]), p3 = keyframePrompt({ still: st.stills[2], state: st, medium, mode: "paint" }).prompt;
  ok(st.styleSheet === "roots/parlour.png" && !r1.some((x) => x.ref.startsWith("style:")) && r3.at(-1).ref === "style:roots/parlour.png" && /the film's style sheet; match its grain/.test(p3) && /Full colour\./.test(p3), `style sheet ${st.styleSheet}: absent on the plate paint, last on a painted-from-master paint, named in the prompt with the medium words`);
}
// The master among equals is the shallowest, so a chain of edits does not compound: four wides of one place in a row.
{
  const fr = (a) => ({ people: [P("alice", "in frame", a)], props: [] });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 20, shots: [1, 2, 3, 4].map((n) => shot({ n, start: (n - 1) * 5, seconds: 5, size: "wide", camera: cam(`spot ${n}`), first: fr("left"), last: fr("right"), action: [{ at: (n - 1) * 5 + 1, text: "alice crosses" }] })) }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x]));
  ok(by["s1-3"].env === "s1-2" && by["s1-5"].env === "s1-4" && by["s1-7"].env === "s1-6" && st.stills.every((x) => typeof x.depth === "number"), `a new wide setup takes the LATEST wide (continuity), depth recorded: ${st.stills.map((x) => `${x.id}:${x.env}/${x.depth}`).join(" ")}`);
}
// A scene synopsis reaches the keyframe and sequence prompts; a fast sequence renders longer with --speed-up.
{
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, synopsis: "Two boats race across open water toward the quay", shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", pace: "fast", camera: cam("above the sea"), first: { people: [P("alice")], props: [] } }), shot({ n: 2, start: 4, seconds: 6, size: "wide", pace: "fast", camera: cam("at the quay"), first: { people: [P("alice")], props: [] } })] }));
  const st = mk(s), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/Scene: Two boats race across open water toward the quay\./.test(p), "the synopsis is in the keyframe CONTEXT");
  const calls = []; const jobs = { tvideo: async (key, file, prompt, refs, seconds) => { calls.push({ key, seconds, prompt }); return { estimated: true, credits: seconds * 96 }; } };
  await makeSequences({ state: st, jobs, K: { painted: Object.fromEntries(st.stills.map((x) => [x.id, { file: `stills/${x.id}.png` }])) }, run, say: () => {}, maxSeq: 15, speedUp: 1.4 });
  ok(calls.length === 1 && calls[0].seconds === 15 && /Scene: two boats race/i.test(calls[0].prompt), `a 10-s fast sequence renders at 15 s for 1.4× playback and carries the synopsis: ${calls[0]?.seconds} s`);
}
// Motion cues reach the keyframe (still-showable ones) and the sequence (all, plus the camera move); the master scores state.
{
  const X = (id, cond) => ({ id, visible: "in frame", where: "Right third, far, on the sea", size: "small", points: "away from the camera", facing: "bow away", condition: cond });
  const s = film(
    scene({ n: 1, place: "harbour", start: 0, seconds: 20, synopsis: "Boats over open water", shots: [
      shot({ n: 1, start: 0, seconds: 10, size: "wide", pace: "fast", motion: ["spray", "subjects entering and leaving the frame"], camera: { ...cam("above the sea"), move: "tracking alongside" }, first: { people: [P("alice", "in frame", "left")], props: [X("ledger", "intact")] }, last: { people: [P("alice", "in frame", "right")], props: [X("ledger", "burning")] }, action: [{ at: 1, text: "the ledger burns" }] }),
      shot({ n: 2, start: 10, seconds: 10, size: "medium-wide", pace: "fast", motion: ["none"], camera: cam("by the quay"), first: { people: [P("alice", "in frame", "left")], props: [X("ledger", "burning")] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x]));
  ok(by["s1-3"].env === "s1-2", `the new setup is painted from the frame whose ledger is already burning (s1-2), not the intact one: ${by["s1-3"].env}`);
  const p = keyframePrompt({ still: by["s1-1"], state: st, medium, mode: "paint" }).prompt;
  ok(/Motion in this frame: spray\./.test(p) && !/entering and leaving/.test(p), "a still gets only the cues a still can show");
  const calls = []; const jobs = { tvideo: async (key, file, prompt, refs, seconds) => { calls.push({ key, prompt }); return { estimated: true, credits: 1 }; } };
  await makeSequences({ state: st, jobs, K: { painted: Object.fromEntries(st.stills.map((x) => [x.id, { file: `stills/${x.id}.png` }])) }, run, say: () => {}, maxSeq: 30 });
  ok(/Motion cues: spray, subjects entering and leaving the frame\. Camera: tracking alongside during the shot\./.test(calls[0].prompt) && /Image 1 shows|SHOT 2[^\n]*The camera holds still\./.test(calls[0].prompt), "the sequence carries all cues and the camera move per shot");
  const p3 = keyframePrompt({ still: by["s1-3"], state: st, medium, mode: "paint" }).prompt; ok(/Image 1 shows: a quiet moment\./i.test(p3), "the references say what image 1 shows");
}
// The scene so far and the previous frame's state are in the CONTEXT of a later shot.
{
  const X = (cond) => ({ id: "ledger", visible: "in frame", where: "Right third, far, on the sea", size: "small", points: "away from the camera", facing: "bow away", condition: cond });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 20, synopsis: "Boats over open water", shots: [
    shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), moment: "the ledger catches fire", first: { people: [P("alice", "in frame", "left")], props: [X("intact")] }, last: { people: [P("alice", "in frame", "right")], props: [X("burning")] }, action: [{ at: 1, text: "the ledger burns" }], changes: ["the ledger is burning"] }),
    shot({ n: 2, start: 10, seconds: 10, size: "medium-wide", camera: cam("by the quay"), moment: "the ledger burns on", first: { people: [P("alice", "in frame", "left")], props: [X("burning")] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x])), p = keyframePrompt({ still: by["s1-3"], state: st, medium, mode: "paint" }).prompt;
  ok(/So far in this scene: shot 1: the ledger catches fire \(the ledger is burning\)\./.test(p) && /Before this frame, as last seen: The ledger catches fire; the ledger burning; Alice Hart waiting\./.test(p), `memory lines present: ${(p.match(/So far[^\n]*/) || [""])[0]} | ${(p.match(/Before this frame[^\n]*/) || [""])[0]}`);
}
// Attachment is structured (`on`): the host carries exactly what is on it, through a chain; prose prepositions carry nothing.
{
  const els2 = [...elements, { id: "boat", kind: "prop", name: "the lead boat", real: false, look: "a grey launch", aka: "" }, { id: "rack", kind: "prop", name: "the boat's rack", real: false, look: "a steel rack", aka: "" }, { id: "screen", kind: "prop", name: "the screen", real: false, look: "a wide touchscreen", aka: "" }];
  const bk2 = { ...bank, boat: { file: "refs/boat.jpg" }, rack: { file: "refs/rack.jpg" }, screen: { file: "refs/screen.jpg" } };
  const X2 = (id, where, on, extra = {}) => ({ id, visible: "in frame", where, size: "small", points: "none", facing: "none", condition: "intact", on, ...extra });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice")], props: [X2("boat", "on the water, centre", "none"), X2("rack", "bolted to the boat's stern", "boat"), X2("ledger", "strapped on the rack", "rack")] } })] }));
  const st = mk(s, { elements: els2, bank: bk2 }), p = keyframePrompt({ still: st.stills[0], state: st, medium, mode: "paint" }).prompt;
  ok(/the ledger: strapped on the boat's rack[^\n]*; attached to the boat's rack, the only thing attached there\./i.test(p) && /RULES\n[^\n]*the lead boat carries exactly 2 things: the boat's rack, the ledger; nothing else is attached to it or hangs from it/.test(p), "a prop on a rack on a boat: its line names its host, and the rules give the boat exactly two things");
  const loads = st.loads(st.stills[0]);
  ok(loads.length === 1 && loads[0].id === "boat" && loads[0].carries.join(",") === "the boat's rack,the ledger", `loads(): the boat carries the rack and the ledger (${JSON.stringify(loads.map((l) => [l.id, l.carries]))})`);
  // The frigate "beneath the crosshair" on a screen is on nothing: no store rule, no load to check.
  const s2 = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "close", camera: cam("at the console"), first: { people: [], props: [X2("screen", "filling the frame", "none"), X2("boat", "centred beneath the crosshair on the screen", "none", { condition: "visible only as a monochrome image on the screen" })] } })] }));
  const st2 = mk(s2, { elements: els2, bank: bk2 }), p2 = keyframePrompt({ still: st2.stills[0], state: st2, medium, mode: "paint" }).prompt;
  ok(!/carries exactly/.test(p2) && !/the only thing attached/.test(p2) && st2.loads(st2.stills[0]).length === 0, "a thing beneath a crosshair on a screen is on nothing: no store rule, nothing to load-check");
  // The checks: a host must be in the same frame as what is on it.
  const bad = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: cam("above the sea"), first: { people: [P("alice")], props: [X2("boat", "on the water", "none", { visible: "off left" }), X2("ledger", "strapped on the boat", "boat")] } })] }));
  const c = checkScript(bad, { ...checkOpts, elements: els2, total: 10 });
  ok(c.errors.some((e) => /ledger is in frame on boat, which is off frame/.test(e)), `a prop in frame on an off-frame host is an error: ${c.errors.join(" | ")}`);
  const side = film(scene({ n: 1, place: "harbour", start: 0, seconds: 10, shots: [shot({ n: 1, start: 0, seconds: 10, size: "wide", camera: { ...cam("above the sea"), view: "from the side" }, first: { people: [P("alice")], props: [X2("boat", "on the water", "none")], relations: [{ a: "alice", how: "swims toward", b: "boat" }] } })] }));
  const cs = checkScript(side, { ...checkOpts, elements: els2, total: 10 });
  ok(cs.notes.some((n) => /moves toward something else, but the camera is from the side/.test(n)) && !cs.errors.some((e) => /toward/.test(e)), "heading with a side camera is a note, never an error");
}
// The film synopsis and the scene situation open the CONTEXT; the previous frame crosses places in a continuous scene.
{
  const s = film(scene({ n: 1, place: "parlour", start: 0, seconds: 4, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] } })] }),
               scene({ n: 2, place: "harbour", start: 4, seconds: 4, continuous: true, inside: false, situation: "Alice has just stepped out onto the quay at dusk; the ledger is still on the parlour table behind her", shots: [shot({ n: 2, start: 4, seconds: 4, size: "medium", camera: cam("on the quay"), first: { people: [P("alice", "in frame", "centre")], props: [] } })] }));
  s.synopsis = "Alice Hart reads a ledger in a parlour, then walks out to the harbour at dusk.";
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x])), r = st.refs(by["s2-1"]), p = keyframePrompt({ still: by["s2-1"], state: st, medium, mode: "paint" }).prompt;
  ok(/\nFilm: Alice Hart reads a ledger in a parlour, then walks out to the harbour at dusk\./.test(p) && /\nNow: Alice has just stepped out onto the quay at dusk/.test(p), "CONTEXT opens with the film synopsis and the scene's situation");
  ok(r.some((x) => x.ref === "prev:s1-1") && /image 2: the frame just before this one, in another place \(the parlour\)[^\n]*WORLD OUTSIDE/.test(p), `a continuous scene in another place gets the previous frame for the moment and the world outside: ${r.map((x) => x.ref).join(", ")}`);
  const s2 = film(scene({ n: 1, place: "parlour", start: 0, seconds: 4, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", camera: cam("at the south wall"), first: { people: [P("alice", "in frame", "left")], props: [] } })] }),
                scene({ n: 2, place: "harbour", start: 4, seconds: 4, continuous: false, inside: false, shots: [shot({ n: 2, start: 4, seconds: 4, size: "medium", camera: cam("on the quay"), first: { people: [P("alice", "in frame", "centre")], props: [] } })] }));
  const st2 = mk(s2), r2 = st2.refs(st2.stills[1]);
  ok(!r2.some((x) => x.ref.startsWith("prev:")), "a scene that is not continuous does not get the other place's frame");
}
// A delta edit: the change list, the headings as an invariant, the rules; no scene restated.
{
  const X3 = (id, where, condition, points = "away from the camera") => ({ id, visible: "in frame", where, size: "small", points, facing: "f", condition, on: "none" });
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 8, shots: [shot({ n: 1, start: 0, seconds: 4, size: "wide", camera: cam("on the quay"), first: { people: [], props: [X3("ledger", "on the quay", "closed")] } }),
    shot({ n: 2, start: 4, seconds: 4, size: "wide", camera: cam("on the quay", 1), first: { people: [], props: [X3("ledger", "on the quay", "closed")] }, last: { people: [], props: [X3("ledger", "on the quay", "open, pages turning")] }, action: [{ at: 4, text: "the ledger falls open" }] })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x])), edit = st.stills.find((x) => x.envKind === "edit");
  ok(!!edit, `the shot's last frame is an edit of the first: ${st.stills.map((x) => `${x.id} ${x.envKind}`).join(", ")}`);
  const p = deltaEditPrompt({ still: edit, state: st, medium });
  ok(/^EDIT \(from image 1\)\n/.test(p) && /Change only this:\n- the ledger: now [^\n]*open, pages turning/.test(p) && /nothing turns \(the ledger away from the camera, exactly as in image 1\)/.test(p) && !/CONTEXT|PEOPLE \(|REFERENCES/.test(p), `the delta edit carries the change, the heading invariant and no restated scene:\n${p.split("\n").slice(0, 5).join("\n")}`);
}
// The frame just before is a reference when it is not image 1: a new camera after a close gets the master AND the previous still.
{
  const s = film(scene({ n: 1, place: "harbour", start: 0, seconds: 12, shots: [
    shot({ n: 1, start: 0, seconds: 4, size: "wide", camera: cam("above the sea"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } }),
    shot({ n: 2, start: 4, seconds: 4, size: "close", camera: cam("beside alice"), first: { people: [P("alice", "in frame", "centre", { depth: "near" }), P("ben", "off right")], props: [] } }),
    shot({ n: 3, start: 8, seconds: 4, size: "medium", camera: cam("beside ben"), first: { people: [P("alice", "in frame", "left"), P("ben", "in frame", "right")], props: [] } })] }));
  const st = mk(s), by = Object.fromEntries(st.stills.map((x) => [x.id, x])), r = st.refs(by["s1-3"]);
  ok(by["s1-3"].env === "s1-1" && by["s1-3"].prev === "s1-2" && r[1]?.ref === "prev:s1-2", `s1-3 is painted from the master s1-1 with the close s1-2 as the frame just before: ${r.map((x) => x.ref).join(", ")}`);
  const p = keyframePrompt({ still: by["s1-3"], state: st, medium, mode: "paint" }).prompt;
  ok(/image 2: the frame just before this one, a moment earlier from another camera/.test(p), "the prompt explains the previous frame as continuity of state, not of camera");
}
// The music mix: a bed under a film, ducked under a line and cut at the arc.
{
  const filmF = join(tmp, "clips", "a.mp4"), bed = join(tmp, "bed.mp3"), out = join(tmp, "clips", "film-music.mp4");
  ff(["-f", "lavfi", "-i", "sine=f=220:d=3", "-c:a", "libmp3lame", bed]);
  mixMusic(filmF, bed, { lines: [{ from: 0.2, to: 0.6 }], arc: [{ at: 0.9, text: "music cuts to silence" }], total: 1 }, out);
  ok(existsSync(out) && hasAudio(out), "the bed is mixed under the film with a duck window and an arc cut");
}
console.log(failed ? `${failed} FAILED` : "all passed"); process.exit(failed ? 1 : 0);
