// The pipeline: natural language → story → assets → screenplay → state manager → keyframes → (paint) → (clips, film).
// Stops at --until (default: keyframes, i.e. every keyframe prompt assembled, nothing painted). Gates flag and never
// remake: a flagged still stops the build before clips, a flagged clip before the stitch; --retry ids remakes named items
// (and what was built on a retried still), --accept ids keeps them, --recheck ids runs the gates again on them.
// Usage: CLEANED_CAP=… node V2/src/pipeline.mjs --brief "…" --label vanderbilt [--reuse cleaned/runs/exp-vanderbilt2]
//        [--until story|assets|screenplay|state|keyframes|paint|film] [--total 30] [--max 15] [--model wan-3.0]
//        [--still nano-banana-pro] [--map new-id=old-id,…] [--no-generate] [--crop-direct 0.5] [--retry s1-3,clip-2] [--accept s1-3] [--recheck s1-3] [--dry: no paid call, each would-be job listed with its cost] [--clips pinned|start|t2v|seq] [--max-seq 15: seconds per sequence] [--seq-across: a sequence may run across scenes] [--speed-up 1.4: fast sequences rendered longer and played faster] [--voice-refs: t2v and seq speak in the bank voices] [--only clip-7,clip-8] [--retry root-<id> | --accept root-<id> for a flagged sheet] [--reactions] [--parallel N: clips at a time, default all at once] [--no-subtitles]
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "./lib/env.js";
import { usage } from "./lib/llm.js";
import { Jobs, COST } from "./lib/jobs.js";
import { runStory } from "./story/story.js";
import { runAssets } from "./assets/assets.js";
import { writeScript, checkScript, scriptText, normalizeShots, reviseScript, fillAttachments } from "./screenplay/screenplay.js";
import { bars } from "./lib/media.js";
import { State } from "./state/state.js";
import { planKeyframes, paintKeyframes } from "./keyframes/keyframes.js";
import { makeClips, makeSequences, stitchFilm } from "./edit/edit.js";
import { GRID } from "./screenplay/screenplay.js";
import { narrationTrack, mixNarration, musicBed, mixMusic } from "./sound/sound.js";
import { subtitlesFromScript } from "./lib/captions.js";
import { writeResults } from "./results.js";
import { writeFilmPage } from "./film-page.js";

const args = process.argv.slice(2), opt = (k, d) => { if (!args.includes(k)) return d; const v = args[args.indexOf(k) + 1]; if (v === undefined || v.startsWith("--")) { console.error(`${k} needs a value`); process.exit(2); } return v; }, list = (k) => (opt(k, "") || "").split(",").filter(Boolean);
const num = (k, d) => { const v = Number(opt(k, d)); if (!Number.isFinite(v)) { console.error(`${k} must be a number (got "${opt(k, d)}")`); process.exit(2); } return v; };
const brief = opt("--brief", "An interesting true fact about Cornelius Vanderbilt, as a 30-second live-action film."), label = opt("--label", "vanderbilt");
const UNTIL = opt("--until", "keyframes"), ORDER = ["story", "assets", "screenplay", "state", "keyframes", "paint", "film"], upto = (st) => ORDER.indexOf(st) <= ORDER.indexOf(UNTIL);
if (!ORDER.includes(UNTIL)) { console.error(`--until must be one of ${ORDER.join(", ")} (got "${UNTIL}")`); process.exit(2); }
const TOTAL = num("--total", 30), MAX = num("--max", 15), model = opt("--model", "wan-3.0"), STILL = opt("--still", "nano-banana-pro"), PAR = Math.max(0, Math.round(num("--parallel", 0)));   // 0 = every clip at once (Magic Hour publishes no concurrency cap; the credit guard reserves jobs in flight)
const reuse = opt("--reuse", null), MAP = Object.fromEntries(list("--map").map((x) => x.split("="))), GENERATE = !args.includes("--no-generate"), RETRY = list("--retry"), ACCEPT = list("--accept"), RECHECK = list("--recheck"), REACTIONS = args.includes("--reactions"), SUBS = !args.includes("--no-subtitles"), CROP_DIRECT = num("--crop-direct", 0.5), DRY = args.includes("--dry"), CLIPS = opt("--clips", "pinned"), ONLY = list("--only"), VOICE_REFS = args.includes("--voice-refs");
if (!["pinned", "start", "t2v", "seq"].includes(CLIPS)) { console.error(`--clips must be pinned, start, t2v or seq (got "${CLIPS}")`); process.exit(2); }
const MAX_SEQ = num("--max-seq", 15), SEQ_ACROSS = args.includes("--seq-across"), SPEED_UP = num("--speed-up", 1);

const dir = join(RUNS, label); for (const d of ["", "refs", "roots", "stills", "clips"]) mkdirSync(join(dir, d), { recursive: true });
const lock = join(dir, ".lock"); if (existsSync(lock)) { const pid = Number(readFileSync(lock, "utf8")); let alive = false; try { process.kill(pid, 0); alive = true; } catch {} if (alive) { console.error(`run "${label}" is already being written by process ${pid}; refusing to start a second one`); process.exit(3); } }
writeFileSync(lock, String(process.pid)); process.on("exit", () => { try { if (existsSync(lock) && readFileSync(lock, "utf8") === String(process.pid)) unlinkSync(lock); } catch {} });
const logFile = join(dir, "run.json"), run = { name: label, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run, { estimate: DRY }), say = (m) => console.log(m), t0 = Date.now();
L.started_at ??= new Date().toISOString();
const finish = (code = 0) => { L.summary = { ...(L.summary || {}), credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000), until: UNTIL }; run.save(); writeResults({ label, L, state, K: L.build || {} }); say(`\nresults: V2/results/${label}/index.html · credits this run ${jobs.spent()}${DRY ? ` · dry run: ${jobs.estimated.reduce((n, e) => n + e.cost, 0)} credits would have been spent on ${jobs.estimated.map((e) => e.key).join(", ") || "nothing"}` : ""} · ${usage.calls} model calls (${usage.cached} cached)`); process.exit(code); };
let state = null;

// 1. Story.
say(`== story`); await runStory({ brief, log: L, run, say, seconds: TOTAL, reuse });
if (!upto("assets")) finish();
// 2. Assets.
say(`== assets`); const assets = await runAssets({ log: L, run, jobs, say, reuse, map: MAP, generate: GENERATE, retry: RETRY.filter((x) => x.startsWith("root-")).map((x) => x.slice(5)), accept: ACCEPT.filter((x) => x.startsWith("root-")).map((x) => x.slice(5)) });
if (assets.flagged?.length) finish(2);
if (!upto("screenplay")) finish();
// 3. The state manager's place table, then the screenplay staged around it, then the checks.
state = new State({ log: L, run, elements: L.elements, bank: L.bank, features: L.features, voices: L.voices, reactions: REACTIONS });
await state.describePlaces();
say(`== screenplay`);
if (!L.script) { say("writing…"); L.script = await writeScript({ story: L.story.story, elements: L.elements, total: TOTAL, max: MAX, model, salt: label, seen: L.places, kind: L.story.kind || "drama" }); run.save(); }
L.script = normalizeShots(L.script);   // film-wide shot numbers, also for a script written before this rule
if (L.script.scenes.some((sc) => sc.shots.some((h) => ["first", "last"].some((w) => h[w].props.some((p) => p.on === undefined))))) { say("filling what each prop is attached to (`on`), one text call; the stills' keys do not change"); L.script = await fillAttachments({ script: L.script, elements: L.elements, salt: label }); run.save(); }
let checks = checkScript(L.script, { total: TOTAL, max: MAX, model, elements: L.elements, seen: L.places, kind: L.story.kind || "drama" });
for (let round = 1; checks.errors.length && round <= 2; round++) {   // the writer fixes its own errors, twice at most; text only
  say(`screenplay check found ${checks.errors.length} error(s); asking the writer to correct them (round ${round}):\n  ${checks.errors.join("\n  ")}`);
  L.script = await reviseScript({ script: L.script, errors: checks.errors, elements: L.elements, total: TOTAL, max: MAX, model, salt: label, seen: L.places, kind: L.story.kind || "drama", round });
  checks = checkScript(L.script, { total: TOTAL, max: MAX, model, elements: L.elements, seen: L.places, kind: L.story.kind || "drama" }); L.script_revisions = round; run.save();
}
const text = scriptText(L.script, L.elements, { total: TOTAL }); writeFileSync(run.path("screenplay.txt"), text); say(text);
L.script_checks = checks; run.save();
say(`checks: ${checks.errors.length ? `ERRORS\n  ${checks.errors.join("\n  ")}` : "timing on the grid, every element in every frame, thirds consistent, beats inside their shots"}${checks.notes.length ? `\nnotes:\n  ${checks.notes.join("\n  ")}` : ""}`);
if (checks.errors.length) { say("the screenplay has errors; stopping"); finish(1); }
if (!upto("state")) finish();
// 4. State: the single pass.
state.setScript(L.script); state.save();
say(`== state: ${state.stills.length} stills (${state.stills.map((s) => `${s.id} ${s.envKind}${s.env ? `:${s.env}` : ""}${s.punchIn ? " punch-in" : ""}`).join(" · ")}), ${state.clips.length} clips; places described: ${Object.keys(L.places).join(", ") || "none"}`);
if (!upto("keyframes")) finish();
// 5. Keyframe prompts.
L.build ??= {}; const K = L.build;
K.plan = planKeyframes(state, L.medium);
writeFileSync(run.path("keyframes.txt"), K.plan.map((p) => `${p.id}  mode: ${p.mode}${p.punchIn ? " (punch-in: crop of the master when painted)" : ""}  images: ${p.images.join(", ")}\n${p.prompt}\n${p.cropPrompt ? `\n[if painted from the crop]\n${p.cropPrompt}\n` : ""}`).join("\n"));
const secs = state.clips.reduce((n, c) => n + c.seconds, 0);
say(`== keyframes: ${K.plan.length} prompts in keyframes.txt · if all painted ${K.plan.length * COST.image} credits; clips ${secs} s = ${COST.video(secs, model)} on ${model}`);
run.save();
if (!upto("paint")) finish();
// 6. Paint, with --retry / --accept / --recheck applied first.
K.painted ??= {}; K.attempts ??= {}; K.made ??= {};
const dependents = (id) => state.stills.filter((x) => x.env === id).flatMap((x) => [x.id, ...dependents(x.id)]);
const known = (id) => id.startsWith("clip-") ? state.clips.some((c) => `clip-${c.n}` === id) : id.startsWith("root-") || id.startsWith("seq-") ? true : !!state.still(id);
for (const id of [...RETRY, ...ACCEPT, ...RECHECK]) if (!known(id)) say(`  ${id}: no such still or clip in this run (stills ${state.stills.map((s) => s.id).join(", ")}; clips 1–${state.clips.length})`);
for (const id of RETRY) {
  if (id.startsWith("seq-")) { const k = id.slice(4); if (K.sequences?.[k]) { (K.attempts[id] ??= []).push(K.sequences[k]); for (const n of K.sequences[k].shots || []) delete K.made[n]; delete K.sequences[k]; } continue; }
  if (id.startsWith("clip-")) { const n = Number(id.slice(5)), vkey = model === "wan-3.0" ? CLIPS : `${CLIPS}@${model}`; if (K.made[n]) { (K.attempts[id] ??= []).push(K.made[n]); delete K.made[n]; } if (K.variants?.[n]?.[vkey]) delete K.variants[n][vkey]; continue; }
  for (const d of [id, ...dependents(id)]) { if (K.painted[d]) { (K.attempts[d] ??= []).push(K.painted[d]); delete K.painted[d]; } for (const c of state.clips) if ((c.start === d || c.end === d) && K.made[c.n]) { (K.attempts[`clip-${c.n}`] ??= []).push(K.made[c.n]); delete K.made[c.n]; } }
}
for (const id of ACCEPT) { if (id.startsWith("seq-")) { const s = K.sequences?.[id.slice(4)]; if (s?.identity) { s.identity.ok = true; s.accepted = true; for (const n of s.shots || []) if (K.made[n]?.identity) K.made[n].identity.ok = true; } } else if (id.startsWith("clip-")) { const m = K.made[Number(id.slice(5))]; if (m?.identity) { m.identity.ok = true; m.accepted = true; } } else if (K.painted[id]) { K.painted[id].bad = false; K.painted[id].accepted = true; if (L.stills?.[id]) L.stills[id].gate = "accepted"; } }
for (const id of RECHECK) {   // the same gates as at paint time: none for a card, no room gate for a crop, the room gate against the still's own image 1
  if (id.startsWith("clip-")) {   // the clip gate again on the frames already on disk, no render
    const n = Number(id.slice(5)), m = K.made[n], c = state.clips.find((x) => x.n === n); if (!m?.clip || !c) continue;
    const sc = state.script.scenes.find((x) => x.n === c.scene), shot = sc.shots.find((h) => h.n === n), base = m.clip.replace(/\.mp4$/, "");
    const ff = []; for (let i = 1; existsSync(run.path(`${base}-f${String(i).padStart(2, "0")}.jpg`)); i++) ff.push(`${base}-f${String(i).padStart(2, "0")}.jpg`);
    m.identity = await state.clipCheck(ff, shot, c.seconds); m.rechecked = true; delete m.accepted;
    say(`  recheck clip ${n}: identity ${m.identity.ok ? "ok" : `FLAGGED${m.identity.badFrames?.length ? ` frames ${m.identity.badFrames.join(",")}` : ""}`} · ${m.identity.note}`); continue;
  }
  const s = state.still(id), p = K.painted[id]; if (!s || !p) continue;
  if (p.card) { p.bad = false; p.rechecked = true; say(`  recheck ${id}: a title card by code, nothing to check`); continue; }
  const c = await state.peopleCheck(p.file, s.frame.people.filter((x) => x.visible === "in frame")), lb = bars(run.path(p.file));
  const room = p.cropped ? { ok: true, note: p.prompt ? "painted from a crop of the master" : "crop used directly" } : await state.roomCheck(p.file, s.place, state.expectedFor(s), s.env && K.painted[s.env] ? K.painted[s.env].file : null);
  if (lb.frac >= 0.005) c.note = `${c.note} · black bars: ${lb.top} px top, ${lb.bottom} px bottom, ${lb.left} px left, ${lb.right} px right${lb.boxed ? "" : " (cropped at the stitch)"}`;
  const style = p.cropped && !p.prompt ? { ok: true, note: "crop" } : await state.styleCheck(p.file); if (!style.ok) c.note = `${c.note} · STYLE drift: ${(style.drift || []).join(", ") || style.note}`;
  const load = p.cropped ? { ok: true, note: "crop of the master" } : await state.loadCheck(p.file, state.loads(s)); if (!load.ok) c.note = `${c.note} · LOAD: ${load.extra.join(", ")} carr${load.extra.length === 1 ? "ies" : "y"} more than the screenplay puts on it: ${load.note}`;
  p.check = { ...c, room, bars: lb, style, load }; p.bad = !c.ok || !room.ok || lb.boxed || !style.ok || !load.ok; p.rechecked = true; delete p.accepted;
  if (L.stills?.[id]) L.stills[id].gate = p.bad ? "flagged" : "ok";
  say(`  recheck ${id}: people ${c.ok ? "ok" : "FLAGGED"} · room ${room.ok ? "ok" : "FLAGGED"}${lb.boxed ? " · black bars FLAGGED" : ""} · style ${style.ok ? "ok" : "FLAGGED"} · load ${load.ok ? "ok" : "FLAGGED"} · ${c.note} ${room.note || ""}`);
}
run.save();
say(`== paint`);
const painted = await paintKeyframes({ state, jobs, medium: L.medium, K, run, say, still: STILL, cropDirect: CROP_DIRECT });
const stale = state.stills.filter((s) => K.painted[s.id]?.stale).map((s) => s.id);
if (stale.length) say(`STALE (the plan changed under these ids; their frames are kept as they are): ${stale.join(", ")} · --retry them to repaint`);
if (painted.flagged.length || painted.waiting.length) {
  if (painted.flagged.length) say(`\nREVIEW (stills): ${painted.flagged.map((s) => `${s.id}: ${K.painted[s.id].check.note || ""} ${K.painted[s.id].check.room?.ok === false ? `room: ${K.painted[s.id].check.room.note || ""}` : ""}`.trim()).join(" | ")}`);
  if (painted.waiting.length) say(`not painted yet (${DRY ? "dry run" : "built on a flagged still"}): ${painted.waiting.map((s) => s.id).join(", ")}`);
  if (painted.flagged.length) say(`look in the results page, then rerun with --retry <ids> or --accept <ids> (${painted.flagged.map((s) => s.id).join(",")})`); finish(2);
}
if (!upto("film")) finish();
// 7. Clips and the film.
say(`== clips`);
const clips = CLIPS === "seq" ? await makeSequences({ state, jobs, K, run, say, model, parallel: PAR, maxSeq: MAX_SEQ, voiceRefs: VOICE_REFS, grid: GRID[model] || GRID["wan-3.0"], only: ONLY.length ? new Set(ONLY) : null, across: SEQ_ACROSS, speedUp: SPEED_UP }) : await makeClips({ state, jobs, K, run, say, model, parallel: PAR, mode: CLIPS, only: ONLY.length ? new Set(ONLY) : null, voiceRefs: VOICE_REFS });
if (ONLY.length) { say(`only ${ONLY.join(", ")} asked for; not stitching`); finish(0); }
if (clips.failed.length || clips.flagged.length || clips.waiting.length) {
  const nameOf = (c) => (c.shots ? `sequence ${c.shots[0]}-${c.shots.at(-1)}` : `clip ${c.n}`), idOf = (c) => (c.shots ? `seq-${c.shots[0]}-${c.shots.at(-1)}` : `clip-${c.n}`);
  if (clips.failed.length) say(`FAILED: ${clips.failed.map((c) => `${nameOf(c)}: ${c.error || K.made[c.n]?.error}`).join(" | ")}`);
  if (clips.flagged.length) say(`REVIEW (clips): ${clips.flagged.map((c) => `${nameOf(c)}: ${(c.identity || K.made[c.n]?.identity)?.note}`).join(" | ")}`);
  if (clips.waiting?.length) say(`waiting: ${clips.waiting.length} not rendered yet`);
  say(`not stitched; rerun with --retry ${[...clips.failed, ...clips.flagged].map(idOf).join(",")} or --accept ${clips.flagged.map(idOf).join(",")}`); finish(2);
}
K.film = stitchFilm({ state, K, run, subtitles: SUBS });
mkdirSync(run.path("sound"), { recursive: true });
const vo = await narrationTrack({ script: L.script, run, bank: L.bank }); if (vo.length) { mixNarration(run.path(K.film), vo.map((v) => ({ ...v, file: run.path(v.file) })), run.path("clips/film-narrated.mp4")); K.film = "clips/film-narrated.mp4"; K.narration = vo; say(`narration: ${vo.length} lines mixed under the film`); }
if (L.script.music?.cue) {   // the film's one music bed, generated once, mixed under everything, ducked under the lines, cut where the arc says
  const bed = await musicBed({ script: L.script, run, jobs, seconds: secs });
  if (bed.estimated) say(`music bed: would be generated (${secs} s, ${bed.credits} credits); dry run`);
  else { mixMusic(run.path(K.film), run.path(bed.file), { lines: subtitlesFromScript(L.script), arc: L.script.music.arc, total: secs }, run.path("clips/film-music.mp4")); K.film = "clips/film-music.mp4"; K.music = { file: bed.file, cue: L.script.music.cue, arc: L.script.music.arc }; say(`music: the bed (${secs} s) mixed under the film`); }
}
say(`film: runs/${label}/${K.film} (${secs} s)`); run.save(); say(`finished product: ${writeFilmPage(label)}`);
finish();
