// Shots, not keyframes: the screenplay gets time; every shot is at most MAX seconds, and when a shot's time is up a CUT is made
// (a new framing in the same environment). One text-to-video clip per shot with named references: @env (the place's plate or
// Commons picture for the first shot there; the previous shot's last frame after that, so the environment carries its state),
// one @id per character present (the bank, so identity never comes from a video), and the shot's text (framing, action, lines).
// The state manager checks that every element a shot names is declared in the bank; undeclared ones are reported.
// Usage: CLEANED_CAP=… node cleaned/experiments/fact-shots.mjs --label vanderbilt2 [--max 10] [--total 30] [--model wan-3.0] [--plan-only]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";
import { Jobs, VIDEO } from "../src/jobs.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const label = opt("--label", "vanderbilt2"), MAX = Number(opt("--max", 10)), TOTAL = Number(opt("--total", 30)), model = opt("--model", "wan-3.0"), planOnly = args.includes("--plan-only");
const dir = join(RUNS, `exp-${label}`); mkdirSync(join(dir, "shots"), { recursive: true });
const run = { name: `exp-${label}`, path: (f) => join(dir, f), log: JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) };
run.save = () => writeFileSync(join(dir, "run.json"), JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), sp = L.screenplay, els = L.elements, byId = Object.fromEntries(els.map((e) => [e.id, e]));
const say = (m) => console.log(m);
// wan accepts 2–10, 15, 20, 25, 30 seconds; other models have their own lists. Round a shot's seconds to the nearest allowed.
const ALLOWED = { "wan-3.0": [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], "seedance-2.5": [4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30], "veo3.1": [4, 6, 8, 16, 24, 32] };
const snap = (s) => (ALLOWED[model] || ALLOWED["wan-3.0"]).reduce((b, v) => (Math.abs(v - s) < Math.abs(b - s) ? v : b));

// 1. Shot list: one call over the whole screenplay, with the running time, the cut rule and the declared elements.
const SHOT = S.obj({ n: S.int, scene: S.int, start: S.int, seconds: S.int, framing: S.str, cut_reason: S.str, elements: S.arr(S.str), mentions: S.arr(S.str), beats: S.arr(S.int), action: S.str, lines: S.arr(S.obj({ who: S.str, text: S.str })) });
if (!L.shots) {
  say("shot list…");
  L.shots = (await jsonCall({ name: "shot-list", effort: "high", schema: S.obj({ shots: S.arr(SHOT) }),
    prompt: `Turn this screenplay into a SHOT LIST for a ${TOTAL}-second live-action film made clip by clip. Rules:
- A shot is one continuous take from one camera, at most ${MAX} seconds. When a scene needs longer, CUT: start a new shot in the same scene with a clearly different framing (a change of shot size or an angle of 30 degrees or more: wide to medium, a two-shot to a single on the speaker, a pan to another part of the room), so the cut reads as a cut and not a jump. Dialogue may continue across a cut.
- Every scene starts with a new shot. Shots are contiguous: start = the previous shot's start + its seconds; the last ends at ${TOTAL}.
- framing: the shot in camera terms (wide shot of the room from the rear corner; medium two-shot on Lincoln and Vanderbilt at the fireplace; pan to the doorway). cut_reason: "scene start", "time up", or "new point of interest".
- elements: the ids (from the list below) of every character and prop in the shot. mentions: every other physical thing the shot's action or framing names (a desk, a doorway, a window) as plain nouns, so they can be checked against the declared fixtures.
- beats: the screenplay beat numbers the shot covers (scene.beat as "beat" numbers within the scene). action: what happens in the shot, present tense, one to three sentences, only what the beats contain. lines: the dialogue spoken in the shot, in order, verbatim.
Declared elements: ${els.map((e) => `${e.id} = ${e.name} (${e.kind}${e.kind === "place" ? `; fixtures: ${e.look}` : ""})`).join("; ")}

Screenplay:
${sp.scenes.map((s, i) => `Scene ${i + 1}: ${s.inside ? "INT." : "EXT."} ${s.place} — ${s.time}\n${s.beats.map((b, j) => `  ${j + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n")}`).join("\n\n")}` })).shots;
  run.save();
}
const shots = L.shots;
// 2. The state manager's check: every element and mention a shot names must be declared (an id, a name, or a word of a place's
// fixtures line); the rest is reported as undeclared.
const vocab = els.flatMap((e) => [e.id, e.name, e.aka || "", ...(e.kind === "place" ? e.look.split(/[,.;]/) : [])]).map((x) => x.toLowerCase().trim()).filter(Boolean);
const declared = (m) => { const w = m.toLowerCase().replace(/^(the|a|an)\s+/, ""); return vocab.some((v) => v.includes(w) || w.includes(v)); };
for (const s of shots) { s.seconds_sent = snap(s.seconds); s.undeclared = (s.mentions || []).filter((m) => !declared(m)); s.unknown_ids = (s.elements || []).filter((id) => !byId[id]); }
say(`shots: ${shots.length} · ${shots.map((s) => `#${s.n} s${s.scene} ${s.start}s+${s.seconds}→${s.seconds_sent} ${s.cut_reason}`).join(" · ")}`);
for (const s of shots) if (s.undeclared.length || s.unknown_ids.length) say(`  shot ${s.n}: undeclared ${JSON.stringify(s.undeclared)} unknown ids ${JSON.stringify(s.unknown_ids)}`);
run.save();
if (planOnly) { console.log(JSON.stringify(shots, null, 1)); process.exit(0); }

// 3. One clip per shot. @env: the place's bank picture for the first shot in it, else the previous shot's last frame (same place).
const VOICE = { "ABRAHAM LINCOLN": "a high, reedy tenor, slow and deliberate, with a Kentucky accent", "CORNELIUS VANDERBILT": "a loud, gruff, blunt voice, rough-edged, with an old New York accent", "EDWIN M. STANTON": "a firm, clipped baritone" };
const cap = (s) => s.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
async function transcribe(file) {
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3"));
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((t) => t.text || JSON.stringify(t).slice(0, 200)).catch((e) => String(e));
}
const lastFrameOf = {};   // place id → file of the latest shot's last frame there (the environment's state)
L.shot_clips ??= {};
for (const s of shots) {
  const sc = sp.scenes[s.scene - 1], place = els.find((e) => e.kind === "place" && e.scenes.includes(s.scene)) || els.find((e) => e.kind === "place");
  const envFile = lastFrameOf[place.id] || L.bank[place.id].file, envIsPrev = !!lastFrameOf[place.id];
  const chars = (s.elements || []).filter((id) => byId[id]?.kind === "character" && L.bank[id]?.file);
  const refs = [{ name: "env", file: envFile }, ...chars.map((id) => ({ name: id, file: L.bank[id].file }))];
  const ambience = sc.inside ? "a quiet 1860s room" : "a quiet 1860s street, wind, distant hooves";
  const prompt = `One continuous shot of ${s.seconds_sent} seconds, ${s.framing}. @env is this place${envIsPrev ? " as it was at the end of the previous shot: the same room, same furniture, same light; this shot is a new angle on it" : ""}. ${chars.map((id) => `@${id} is ${byId[id].name}`).join("; ")}${chars.length ? "; keep their faces and clothes exactly." : ""}
${s.action}${s.lines.length ? `\nSpoken, in order, lips moving with the words: ${s.lines.map((l) => `${cap(l.who)} (${VOICE[l.who.toUpperCase()] || "a natural period voice"}) says: "${l.text}"`).join(" ")}` : ""}
The camera holds its framing; the people move naturally. Nothing appears that is not in the references or named here; no text or captions. Sound: ${ambience}${s.lines.length ? ", the voices clearly" : ""}; no music, no narration.`;
  const file = `shots/shot-${s.n}.mp4`;
  say(`shot ${s.n} (scene ${s.scene}, ${s.seconds_sent}s, ${s.framing.slice(0, 60)}) · refs ${refs.map((r) => "@" + r.name).join(" ")}${envIsPrev ? " (env = previous last frame)" : ""}`);
  await jobs.tvideo(`shot-${s.n}-${model}`, file, prompt, refs, s.seconds_sent, { ...VIDEO, model, audio: true });
  const last = `shots/shot-${s.n}-last.png`; execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-sseof", "-0.1", "-i", run.path(file), "-frames:v", "1", run.path(last)]);
  lastFrameOf[place.id] = last;
  const heard = s.lines.length ? await transcribe(file) : "";
  if (heard) say(`  heard: ${heard}`);
  L.shot_clips[s.n] = { file, prompt, refs: refs.map((r) => ({ name: r.name, file: r.file })), seconds: s.seconds_sent, heard, last }; run.save();
}
// 4. Stitch, keeping each clip's audio.
const parts = shots.map((s) => { const c = L.shot_clips[s.n], p = run.path(c.file.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(c.file), "-vf", "setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p", "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
const list = run.path("shots/concat.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", run.path("shots/film.mp4")]);
L.shot_film = { file: "shots/film.mp4", seconds: shots.reduce((n, s) => n + s.seconds_sent, 0), credits: jobs.spent() }; run.save();
say(`film: shots/film.mp4 (${L.shot_film.seconds} s) · ${jobs.spent()} credits in this run so far`);
