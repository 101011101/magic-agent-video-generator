// End to end after the story, nothing hand-written: story + research + asset bank come from a source run; the screenplay, the
// timed shot list, the cast feature lines, every keyframe prompt, every keyframe, every clip and the film are made fresh here.
//   screenplay (fresh) → shot list with time (fresh) → cast-features (one vision call per portrait) → per shot: shot-stills call
//   (start and end prompts with geometry continuity) → stills painted with the portraits attached and checked by feature →
//   image-to-video pinned on both stills → stitch → page.
// Usage: CLEANED_CAP=… node cleaned/experiments/fact-film2.mjs --from vanderbilt2 --label vanderbilt3 [--total 30] [--max 15] [--model wan-3.0] [--still nano-banana-pro]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS, key } from "../src/env.js";
import { jsonCall, S, usage } from "../src/llm.js";
import { Jobs, VIDEO } from "../src/jobs.js";
import { writeScreenplay, screenplayText } from "../src/screenplay.js";
import { check, ssim } from "../src/clips.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "vanderbilt2"), label = opt("--label", "vanderbilt3"), TOTAL = Number(opt("--total", 30)), MAX = Number(opt("--max", 15)), model = opt("--model", "wan-3.0"), STILL = opt("--still", "nano-banana-pro");
const src = JSON.parse(readFileSync(join(RUNS, `exp-${from}`, "run.json"), "utf8"));
const dir = join(RUNS, `exp-${label}`); for (const d of ["", "refs", "roots", "stills", "clips", "page"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json"), run = { name: `exp-${label}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => writeFileSync(logFile, JSON.stringify(run.log, null, 2));
const L = run.log, jobs = new Jobs(run), say = (m) => console.log(m), t0 = Date.now(), salt = label;
// Reused from the source run: brief, research, story, elements, bank (files copied), medium.
for (const k of ["brief", "gate", "research", "story", "elements", "medium"]) L[k] ??= src[k];
L.bank ??= src.bank;
for (const b of Object.values(L.bank)) if (b.file && !existsSync(run.path(b.file))) copyFileSync(join(RUNS, `exp-${from}`, b.file), run.path(b.file));
const els = L.elements, byId = Object.fromEntries(els.map((e) => [e.id, e])), chars = els.filter((e) => e.kind === "character" && L.bank[e.id]?.file);
const tail = `${L.medium.frame} One single frame, no text or captions.`;

// 1. Screenplay, fresh.
if (!L.screenplay) { say("screenplay (fresh)…"); L.screenplay = await writeScreenplay(L.story.story, chars.map((c) => c.name), { salt }); writeFileSync(join(dir, "screenplay.txt"), `${L.screenplay.title.toUpperCase()}\n\n${screenplayText(L.screenplay)}`); run.save(); }
const sp = L.screenplay;

// 2. Shot list with time, fresh.
const SHOT = S.obj({ n: S.int, scene: S.int, start: S.int, seconds: S.int, framing: S.str, cut_reason: S.str, elements: S.arr(S.str), mentions: S.arr(S.str), beats: S.arr(S.int), action: S.str, lines: S.arr(S.obj({ who: S.str, text: S.str })) });
if (!L.shots) {
  say("shot list (fresh)…");
  L.shots = (await jsonCall({ name: "shot-list", effort: "high", salt, schema: S.obj({ shots: S.arr(SHOT) }),
    prompt: `Turn this screenplay into a SHOT LIST for a ${TOTAL}-second live-action film made clip by clip. Rules:
- A shot is one continuous take from one camera, at most ${MAX} seconds and at least 2 seconds per action it contains (a walk-in, a handshake, a spoken line each need about 2-4 seconds; a long line needs its words at 2.5 words a second). When a scene needs longer than ${MAX} seconds, CUT: start a new shot in the same scene with a clearly different framing (a change of shot size, or an angle of 30 degrees or more). Cut where the content turns, not on every line.
- Every scene starts with a new shot. Shots are contiguous: start = the previous shot's start + its seconds; the last ends at ${TOTAL}.
- framing: the shot in camera terms (wide shot of the room from the rear corner; medium two-shot on Lincoln and Vanderbilt in profile). cut_reason: "scene start", "time up", or "new point of interest".
- elements: the ids (from the list below) of every character and prop in the shot. mentions: every other physical thing the shot names (a doorway, a window), plain nouns.
- beats: the beat numbers (within the scene) the shot covers. action: what happens in the shot, present tense, one to three sentences, only what the beats contain. lines: the dialogue spoken in the shot, in order, verbatim.
Declared elements: ${els.map((e) => `${e.id} = ${e.name} (${e.kind}${e.kind === "place" ? `; fixtures: ${e.look}` : ""})`).join("; ")}

Screenplay:
${sp.scenes.map((s, i) => `Scene ${i + 1}: ${s.inside ? "INT." : "EXT."} ${s.place} — ${s.time}\n${s.beats.map((b, j) => `  ${j + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n")}`).join("\n\n")}` })).shots;
  run.save();
}
const shots = L.shots;
const ALLOWED = { "wan-3.0": [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30] }, snap = (s) => (ALLOWED[model] || ALLOWED["wan-3.0"]).reduce((b, v) => (Math.abs(v - s) < Math.abs(b - s) ? v : b));
const vocab = els.flatMap((e) => [e.id, e.name, e.aka || "", ...(e.kind === "place" ? e.look.split(/[,.;]/) : [])]).map((x) => x.toLowerCase().trim()).filter(Boolean);
for (const s of shots) { s.seconds_sent = snap(s.seconds); s.undeclared = (s.mentions || []).filter((m) => { const w = m.toLowerCase().replace(/^(the|a|an)\s+/, ""); return !vocab.some((v) => v.includes(w) || w.includes(v)); }); }
say(`shots: ${shots.map((s) => `#${s.n} s${s.scene} ${s.start}s+${s.seconds}→${s.seconds_sent}s`).join(" · ")}${shots.some((s) => s.undeclared.length) ? ` · undeclared: ${shots.flatMap((s) => s.undeclared).join(", ")}` : ""}`);
run.save();

// 3. Cast feature lines, from the portraits themselves (one vision call each): how each person is named in every prompt.
L.features ??= {};
for (const c of chars) {
  if (L.features[c.id]) continue;
  L.features[c.id] = (await jsonCall({ name: "cast-features", effort: "low", salt, images: [run.path(L.bank[c.id].file)], schema: S.obj({ features: S.str }),
    prompt: `This is the reference picture of ${c.name}. In at most 15 words, the telling features that tell this person from others in the same film (hair colour and style, beard or whiskers or clean-shaven, glasses, build). No clothes, no expression.` })).features;
  say(`  ${c.id}: ${L.features[c.id]}`);
}
run.save();
const who = (ids) => ids.map((id, i) => `Image ${i + 2} is ${byId[id].name} (${L.features[id]}).`).join(" ") + " Same faces and clothes of the period in every frame; the poses and backgrounds of those pictures do not apply.";
// Voice descriptors, from the research's documented looks (one call).
L.voices ??= (await jsonCall({ name: "voice-cast-desc", effort: "low", salt, schema: S.obj(Object.fromEntries(chars.map((c) => [c.id, S.str]))),
  prompt: `For each character, one line describing the voice for a video model to perform (pitch, pace, accent, timbre), from what the record says where it says anything (Lincoln's voice was high and reedy), else plausible for the person's age and origin:\n${chars.map((c) => `- ${c.id}: ${c.name}. ${(L.research?.looks || []).filter((l) => l.thing.toLowerCase().includes(c.name.split(" ").pop().toLowerCase())).map((l) => l.look).join(" ")}`).join("\n")}` }));
run.save();

// 4. Per shot: the stills' prompts (model), the stills (editor + portraits), the checks, the clip.
const STILLS = S.obj({ start_moment: S.str, end_moment: S.str, end_state: S.str, people_start: S.arr(S.str), people_end: S.arr(S.str) });
const checkStill = (file, ids) => jsonCall({ name: "still-check", effort: "low", images: [run.path(file)], schema: S.obj({ people: S.int, sides: S.obj(Object.fromEntries(ids.map((id) => [id, S.enum(["left", "centre", "right", "absent"])]))), note: S.str }),
  prompt: `In this picture: how many people are visible? For each of these, on which third of the frame does the person stand (left, centre, right) or absent:\n${ids.map((id) => `- ${id}: ${L.features[id]}`).join("\n")}\nnote: anything wrong (an extra person, a face that does not match the features), short.` });
L.made ??= {};
const lastEndOf = {};   // place id → { file, state } of the latest shot there
for (const s of shots) {
  if (L.made[s.n]?.clip) { lastEndOf[L.made[s.n].place] = { file: L.made[s.n].end, state: L.made[s.n].end_state }; continue; }
  const sc = sp.scenes[s.scene - 1], place = els.find((e) => e.kind === "place" && e.scenes.includes(s.scene)) || els.find((e) => e.kind === "place");
  const prev = lastEndOf[place.id], present = (s.elements || []).filter((id) => byId[id]?.kind === "character" && L.bank[id]?.file);
  // The still prompts, written by the model from the shot, the previous end state and the rules.
  const st = await jsonCall({ name: "shot-stills", effort: "medium", salt, schema: STILLS,
    prompt: `You write the START and END still of one shot for an image editor. The editor gets a picture of the place (or the previous shot's end frame) as image 1 and the portraits of the people as further images; you write only the MOMENT: who is where and doing what.
Rules: name people by id. State screen position for every person (left third, centre, right third of frame), which way each faces, who is in front of whom, and what furniture or fixture is behind them. The camera stays on one side of the people (never cross the line); nobody changes side of frame between the start and the end of the shot, and the first still of a shot that continues a scene keeps everyone on the same side as the previous end state unless the framing says the angle changes. Nothing is added that the shot does not name; no text, no captions, no titles in the picture. Resting states only (nothing mid-air); hands clasped, held, released: say which.
- start_moment: the first frame of this shot, two or three sentences, in the shot's framing.
- end_moment: the last frame, the resting state after the shot's action and lines; two or three sentences, same framing and camera.
- end_state: one paragraph recording the end for the next shot: each person's screen position and facing, what is held, what is open.
- people_start / people_end: ids visible in each still.

Place: ${place.name}: ${place.look}
People (ids): ${present.map((id) => `${id} = ${byId[id].name}`).join("; ")}
Shot ${s.n} of scene ${s.scene} (${sc.inside ? "INT." : "EXT."} ${sc.place}): framing: ${s.framing}. ${s.seconds_sent} seconds. Action: ${s.action}${s.lines.length ? ` Lines: ${s.lines.map((l) => `${l.who}: "${l.text}"`).join(" ")}` : ""}
${prev ? `Previous shot's end state (same place): ${prev.state}` : "First shot in this place: image 1 will be the empty place."}` });
  const idsStart = st.people_start.filter((id) => L.bank[id]?.file), idsEnd = st.people_end.filter((id) => L.bank[id]?.file);
  const startInputs = [prev ? prev.file : L.bank[place.id].file, ...idsStart.map((id) => L.bank[id].file)];
  const startPrompt = `${prev ? "Image 1 is the end of the previous shot in this place. " : "Image 1 is the empty place. "}${who(idsStart)} ${prev ? "Make the first frame of the next shot from the same instant: the room, light and colours of image 1, in this framing: " : "Put this moment into image 1, keeping its room, camera, light and colours exactly: "}${s.framing}. ${st.start_moment}\n${tail}`;
  const paint = async (id, file, prompt, inputs, ids) => {
    for (let t = 1; t <= 2; t++) {
      const f = t === 1 ? file : file.replace(/\.png$/, `-t${t}.png`);
      await jobs.image(t === 1 ? id : `${id}-t${t}`, f, prompt, inputs, { model: STILL, resolution: "2k", aspect_ratio: "16:9" });
      const c = await checkStill(f, ids), bad = c.people !== ids.length || ids.some((x) => c.sides[x] === "absent");
      say(`  ${id} try ${t}: ${c.people} people · ${ids.map((x) => `${x}:${c.sides[x]}`).join(" ")}${bad ? " · RETRY" : ""} · ${c.note}`);
      if (!bad || t === 2) return { file: f, check: c, tries: t, bad };
    }
  };
  say(`shot ${s.n} (scene ${s.scene}, ${s.seconds_sent}s): ${s.framing.slice(0, 70)}`);
  const start = await paint(`still-${s.n}-start`, `stills/s${s.n}-start.png`, startPrompt, startInputs, idsStart);
  const endPrompt = `Image 1 is the first frame of this shot. ${who(idsEnd)} Edit image 1 into the last frame of the shot, same framing, same camera, same room and light. ${st.end_moment}\n${tail}`;
  const end = await paint(`still-${s.n}-end`, `stills/s${s.n}-end.png`, endPrompt, [start.file, ...idsEnd.map((id) => L.bank[id].file)], idsEnd);
  // The clip, pinned on both stills.
  const cap = (x) => x.replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase()), vdesc = (whoName) => { const c = chars.find((x) => x.name.toUpperCase().includes(whoName.toUpperCase().split(" ").pop())); return c ? L.voices[c.id] : "a natural period voice"; };
  const clipPrompt = `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. ${s.action}${s.lines.length ? ` Spoken in order, lips moving with the words: ${s.lines.map((l) => `${cap(l.who)} (${vdesc(l.who)}) says: "${l.text}"`).join(" ")}` : ""} The people move naturally; nothing appears that is not in the frames. Sound: ${sc.inside ? "a quiet 1860s room" : "a quiet 1860s street, wind, distant hooves"}${s.lines.length ? ", the voices clearly" : ""}; no music, no narration.`;
  const clip = `clips/s${s.n}.mp4`;
  await jobs.video(`clip-${s.n}-${model}`, clip, clipPrompt, start.file, end.file, s.seconds_sent, { ...VIDEO, model, audio: true });
  const qa = check(run.path(clip), { start: run.path(start.file), end: run.path(end.file), path: run.path, key: `s${s.n}` });
  let heard = "";
  if (s.lines.length) { const mp3 = run.path(clip.replace(/\.mp4$/, ".mp3")); execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(clip), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]); const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3"); heard = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((t) => t.text || "").catch(() => ""); }
  say(`  clip: first≈start ${qa.first_vs_start} last≈end ${qa.last_vs_end}${heard ? ` · heard: ${heard}` : ""}`);
  L.made[s.n] = { place: place.id, stills: st, start: start.file, end: end.file, start_prompt: startPrompt, end_prompt: endPrompt, start_inputs: startInputs, start_check: start.check, end_check: end.check, clip, clip_prompt: clipPrompt, qa, heard, end_state: st.end_state }; run.save();
  lastEndOf[place.id] = { file: end.file, state: st.end_state };
}

// 5. Stitch.
const parts = shots.map((s) => { const c = L.made[s.n].clip, p = run.path(c.replace(/\.mp4$/, "-part.mp4")); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", run.path(c), "-vf", "setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p", "-af", "aresample=48000", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", p]); return p; });
writeFileSync(run.path("clips/concat.txt"), parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", run.path("clips/concat.txt"), "-c", "copy", run.path("clips/film.mp4")]);
L.summary = { seconds: shots.reduce((n, s) => n + s.seconds_sent, 0), credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) }; run.save();
say(`film: clips/film.mp4 (${L.summary.seconds} s) · ${JSON.stringify(L.summary)}`);
