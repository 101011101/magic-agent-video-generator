// V3 clip composition, case 3 (a specific thing, perfect reference supplied): brief + a reference frame → story → a seed still made
// from the frame (image editor, free model) and checked against it → image-to-video on ltx-2.5 from that still → review + identity check.
// The state manager is assumed perfect: the reference is given on the command line. No references list, no minimax.
// Usage: CLEANED_CAP=… node V3/compose/case3.mjs --brief "…" --ref <frame.jpg> --label v3-flower2-1 [--dry]
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S, usage, MODEL as LLM } from "../../V2/backend/lib/llm.js";
import { videoCost, stillCost } from "../../V2/backend/lib/models.js";
import { duration } from "../../V2/backend/lib/media.js";
import { frameAt } from "../../V2/backend/keyref2/keyref.js";
import { V3 } from "./paths.mjs";

const GUIDE = readFileSync(join(V3, "compose/guide.md"), "utf8");
const MODEL = "ltx-2.5", VRES = "480p", LIMIT = 2000, STILL = { model: "qwen-image-2.1", resolution: "640px", aspect_ratio: "16:9" };
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const REFS = all("--ref").map((r) => { const [name, file] = r.includes("=") ? r.split("=") : ["reference", r]; return { name, file: resolve(file) }; });
const brief = opt("--brief"), label = opt("--label"), REF = REFS[0]?.file, DRY = args.includes("--dry"), AUDIO_OPT = opt("--audio", null), STORY_FILE = opt("--story-file", null), NO_EDIT = args.includes("--no-edit"), PLAIN = args.includes("--plain"), MODE = opt("--mode", "start");   // start = a start frame (ltx-2.5 image-to-video); refs = named references (minimax-h3 text-to-video, @name)
if (!brief || !label || !REF) { console.error("--brief, --ref [name=]file (repeatable) and --label are required"); process.exit(2); }
const dir = join(V3, "runs", label); mkdirSync(join(dir, "frames"), { recursive: true });
const recFile = join(dir, "compose.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};
const rec = { label, pipeline: "V3/compose case 3 (a specific thing; the reference supplied by hand, the state manager assumed perfect)", brief, at: new Date().toISOString(), dry: DRY, llm_model: LLM, llm: [], tools: [], steps: [], jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {} };
const run = { name: `v3-${label}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run, { estimate: DRY }), say = (m) => console.log(m), llm = (name, purpose) => rec.llm.push({ name, purpose });
const step = (name, data) => { rec.steps.push({ name, at: new Date().toISOString(), ...data }); run.save(); };
const refRel = `reference${extname(REF)}`; copyFileSync(REF, run.path(refRel)); rec.reference = { file: refRel, from: REF.replace(`${V3}/`, "V3/"), name: REFS[0].name };
rec.extra_refs = REFS.slice(1).map((r, i) => { const f = `ref-${r.name}${extname(r.file)}`; copyFileSync(r.file, run.path(f)); return { name: r.name, file: f, from: r.file.replace(`${V3}/`, "V3/") }; });

// ---- 0. what the reference shows (the state manager's job, done by a VLM here) ----
say("== reference");
rec.reference.seen = await jsonCall({ name: "v3-ref-seen-v1", effort: "low", images: [REF], schema: S.obj({ people: S.arr(S.obj({ who: S.str, look: S.str })), objects: S.arr(S.obj({ what: S.str, look: S.str })), place: S.str, light: S.str }), prompt: "Describe exactly what this frame shows, for reuse as a reference: each person (who they seem to be, and their look: hair, face, clothing, in a few concrete words), each notable object (a bouquet: the flower colours and the wrapping), the place, the light. Only what is visible." });
llm("v3-ref-seen-v1", "what the reference frame shows");
for (const r of rec.extra_refs) { r.seen = await jsonCall({ name: "v3-ref-seen-v1", effort: "low", images: [run.path(r.file)], schema: S.obj({ summary: S.str }), prompt: `In one sentence of concrete visual detail, what does this frame show (the thing called "${r.name}")? Only what is visible.` }); llm("v3-ref-seen-v1", `what the extra reference "${r.name}" shows`); }
say(JSON.stringify(rec.reference.seen));

// ---- 1. story (as case 1; the reference's people and objects are the fixed descriptors) ----
say("== story");
const STORY = S.obj({ prose: S.str, kind: S.enum(["fiction", "non-fiction"]), people: S.arr(S.str), place: S.str, time: S.str, mood: S.str, exact_words: S.arr(S.str), seconds: S.int, aspect: S.enum(["16:9", "9:16", "1:1"]), sound: S.enum(["none", "ambient", "music", "narration", "dialogue"]), sound_why: S.str, progression: S.arr(S.str), carried: S.arr(S.str), first_frame: S.str });
const story = STORY_FILE ? JSON.parse(readFileSync(resolve(STORY_FILE), "utf8")) : await jsonCall({ name: "v3-story-c3-v1", effort: "medium", schema: STORY, prompt: `Ground this request into a STORY record for one video clip (prose 120–200 words: who, where, when, what happens in order, the mood, how it ends; no shots, no camera). A REFERENCE frame from an earlier clip is supplied and describes people and objects that must look the same here.
REQUEST: ${brief}
REFERENCE SHOWS: ${JSON.stringify(rec.reference.seen)}
Fields: people = each person with the SAME concrete descriptors as the reference where they come from it (hair, clothing), and two or three fixed descriptors for anyone new. carried = the things carried over from the reference that must look identical (e.g. "the woman: dark hair in a low bun, cream jacket", "the bouquet: yellow, magenta, cream and red flowers in pale paper"). progression = the request's own actions, each as its own line in the request's words and order, plus at most two connecting lines. first_frame = the first frame of this clip described concretely in one or two sentences, containing the carried people/objects as they are in the reference and the new place. exact_words = strings that must be readable (usually none). seconds from the request (≤ 60). sound: "none" unless asked. aspect from the request's words, default 16:9.` });
llm("v3-story-c3-v1", "the story with the reference's descriptors fixed");
const AUDIO = AUDIO_OPT ? AUDIO_OPT === "on" : story.sound !== "none";
rec.story = story; step("story", { story }); say(story.prose);
step("route", { route: "case 3 (a specific thing)", why: `carried from the reference: ${story.carried.join("; ")}; first frame required: ${story.first_frame}` });

// ---- 2. the seed still: the first frame of the new scene, edited from the reference so identity is copied, not described ----
say("== seed still");
const STILLP = S.obj({ prompt: S.str });
const CHECK = S.obj({ same_person: S.enum(["yes", "no", "unclear"]), same_bouquet: S.enum(["yes", "no", "unclear"]), new_people_as_described: S.enum(["yes", "no", "unclear"]), scene_as_described: S.enum(["yes", "no", "unclear"]), evidence: S.str });
let still = null, stillNote = null;
const REF_LIST = [{ name: REFS[0].name, file: refRel }, ...rec.extra_refs.map((r) => ({ name: r.name, file: r.file }))];
if (MODE === "refs") { rec.seed_attempts = []; say(`  references mode: ${REF_LIST.map((r) => "@" + r.name).join(" ")} go to minimax-h3 text-to-video; no start frame`); }
else if (NO_EDIT) { still = refRel; rec.seed_attempts = []; say("  the reference is used directly as the start frame (--no-edit: a premade key still)"); }
for (let a = 1; a <= 2 && !NO_EDIT && MODE !== "refs"; a++) {
  const key = a === 1 ? "seed" : "seed-retry", file = `${key}.png`;
  const sp = await jsonCall({ name: "v3-seed-prompt-v1", effort: "medium", schema: STILLP, prompt: `Write ONE image-edit prompt (≤ 600 characters) for an image editor that receives the reference photo as its input image. The output must be the FIRST FRAME of a new scene: "${story.first_frame}". ${rec.extra_refs.length ? `The editor also receives a second input image: ${rec.extra_refs.map((r) => `"${r.name}" (${r.seen?.summary})`).join("; ")}; say where it appears in the frame (e.g. on the bridge screen). ` : ""}Rules: the people and objects carried from the reference keep their exact identity and look (say "the same woman from the input image, same face, hair and jacket" and name the bouquet's colours and wrapping as in the reference); describe the new place, the new person with the fixed descriptors, the light and the framing (a widescreen 16:9 film frame, eye level, medium shot); no text, no watermark.${stillNote ? ` A first attempt failed: ${stillNote}; fix that.` : ""}
CARRIED: ${story.carried.join("; ")}
PEOPLE: ${story.people.join("; ")}
PLACE/TIME/MOOD: ${story.place} / ${story.time} / ${story.mood}` });
  llm("v3-seed-prompt-v1", `the edit prompt for ${key}`);
  const cost = stillCost(STILL.model, STILL.resolution);
  const j = await jobs.image(key, file, sp.prompt, [refRel, ...rec.extra_refs.map((r) => r.file)].slice(0, 2), STILL);   // qwen-image-2.1 takes two input images
  rec.tools.push({ tool: "image-edit", endpoint: "/v1/ai-image-editor", ...STILL, inputs: [refRel], prompt: sp.prompt, credits: j.credits || 0, output: file });
  const att = { attempt: a, key, file, prompt: sp.prompt, credits: j.credits || 0, cost };
  (rec.seed_attempts ??= []).push(att); run.save();
  if (DRY) { still = file; break; }
  att.check = await jsonCall({ name: "v3-seed-check-v1", effort: "medium", images: [REF, run.path(file)], schema: CHECK, prompt: `Image 1 is the reference; image 2 is a generated first frame of a new scene that must carry people and objects over from it. Is the woman in image 2 the same person as in image 1 (face, hair, clothing)? Is the bouquet the same (flower colours, wrapping)? Are the new people as described: ${story.people.join("; ")}? Is the scene as described: ${story.first_frame}? Give evidence in a few words.` });
  llm("v3-seed-check-v1", `${key} against the reference`);
  att.pass = att.check.same_person !== "no" && att.check.same_bouquet !== "no" && att.check.new_people_as_described !== "no" && att.check.scene_as_described !== "no";
  say(`  ${key}: ${att.credits} credits; same person ${att.check.same_person}, same bouquet ${att.check.same_bouquet}, new people ${att.check.new_people_as_described}, scene ${att.check.scene_as_described} → ${att.pass ? "PASS" : "FAIL"} (${att.check.evidence})`);
  if (att.pass) { still = file; break; }
  stillNote = att.check.evidence; if (a === 2) { still = file; say("  using the second still anyway (no third attempt)"); }
}
rec.seed = { file: still, no_edit: NO_EDIT }; step("seed", { still, attempts: rec.seed_attempts, no_edit: NO_EDIT }); run.save();

// ---- 3. the operational prompt, image-to-video shape ----
say("== operational prompt (image-to-video)");
const PROMPT = S.obj({ prompt: S.str, beats: S.arr(S.obj({ from: S.int, to: S.int, shows: S.str })), shots: S.int, lines: S.arr(S.obj({ from: S.int, to: S.int, speaker: S.str, text: S.str })) });
const refSeen = REF_LIST.map((r) => `@${r.name}: ${r.name === REFS[0].name ? JSON.stringify(rec.reference.seen) : rec.extra_refs.find((x) => x.name === r.name)?.seen?.summary}`).join("\n");
const writePrompt = (note) => MODE === "refs" ? jsonCall({ name: "v3-prompt-refs-plain-v1", effort: "medium", schema: PROMPT, prompt: `You are writing the prompt for ONE text-to-video generation with REFERENCE IMAGES (model minimax-h3, ${story.seconds} seconds, ${story.aspect}, audio ${AUDIO ? "on" : "off"}) from a user's brief, the way a careful director would, following the GUIDE. The references are attached by name and MUST be used as @name in the prompt wherever that person appears (first mention with their look, later mentions by @name alone); they are likenesses, not shots to paste in:\n${refSeen}\nOne prose paragraph under ${LIMIT} characters. Decide yourself what belongs in the clip; the brief says what is not shown. Return the prompt, the beats (from, to, what each shows in ≤ 12 words), the shot count, and the spoken lines (empty if none).${note ? `\n\n${note}` : ""}

GUIDE:
${GUIDE}

BRIEF:
${brief}` }) : PLAIN ? jsonCall({ name: "v3-prompt-i2v-plain-v1", effort: "medium", schema: PROMPT, prompt: `You are writing the prompt for ONE image-to-video generation (model ltx-2.5, ${story.seconds} seconds, audio ${AUDIO ? "on" : "off"}) from a user's brief and a supplied START FRAME, the way a careful director would, following the GUIDE's image-to-video section. The start frame shows: ${JSON.stringify(rec.reference.seen)}. One prose paragraph under ${LIMIT} characters: say the image is the starting frame and strict reference, name each person's position in it, then the actions. Decide yourself what belongs in the clip; the brief says what is not shown. Return the prompt, the beats (from, to, what each shows in ≤ 12 words), the shot count, and the spoken lines (empty if none).${note ? `\n\n${note}` : ""}

GUIDE:
${GUIDE}

BRIEF:
${brief}` }) : jsonCall({ name: "v3-prompt-i2v-v1", effort: "medium", schema: PROMPT, prompt: `Write the operational prompt for ONE image-to-video generation on ltx-2.5. The model receives the START FRAME (described below, it is the seed still) and this prompt. Follow the GUIDE's "Image-to-video" and "When people carry the scene" sections: one prose paragraph, under ${LIMIT - 400} characters, covering all ${story.seconds} seconds. The identity is already IN the start frame, so PRESERVE is short: three anchors per carried person (hair, one garment, one detail) and one line per object, said once, never repeated in the beats. The beats are about the people and what passes between them: eye lines, gestures, reactions, the order of a physical action; the REQUEST's own actions, one beat each. One continuous shot with one slow camera move unless the request needs a cut; end on the faces. Audio is ${AUDIO ? "ON" : "OFF: no sound slot, negatives end with no voiceover, lines empty"}. Return the beats and shot count too.${note ? `\n\n${note}` : ""}

GUIDE:
${GUIDE}

START FRAME: ${story.first_frame}
CARRIED (must look identical): ${story.carried.join("; ")}
REQUEST: ${brief}
SEQUENCE: ${JSON.stringify({ prose: story.prose, people: story.people, place: story.place, time: story.time, mood: story.mood, exact_words: story.exact_words, seconds: story.seconds, aspect: story.aspect, sound: AUDIO ? story.sound : "none", progression: story.progression }, null, 1)}` });
let op = await writePrompt(null); llm("v3-prompt-i2v-v1", "the image-to-video prompt");
if (op.prompt.length > LIMIT) { op = await writePrompt(`A first draft was ${op.prompt.length} characters; it must be under ${LIMIT}: cut adjectives and repetition, keep every beat.`); llm("v3-prompt-i2v-v1", "rewrite for length"); }
if (op.prompt.length > LIMIT) { say("prompt over the limit twice; stopping"); rec.stopped = "prompt length"; run.save(); process.exit(1); }
if (MODE === "refs") { const miss = REF_LIST.filter((r) => !op.prompt.includes(`@${r.name}`)); if (miss.length) { op = await writePrompt(`The draft did not use ${miss.map((r) => "@" + r.name).join(", ")}; every reference must appear as @name where that person appears.`); llm("v3-prompt-refs-plain-v1", "rewrite: missing @names"); } }
rec.prompt = op; rec.prompt_attempts = [{ ...op, check: { ok: true, chars: op.prompt.length, missing: [] } }];
step("prompt", { chars: op.prompt.length, shots: op.shots, beats: op.beats, prompt: op.prompt }); say(`${op.prompt.length} chars, ${op.beats.length} beats\n${op.prompt}`);

// ---- 4 + 5. the clip from the still, the review, the identity check ----
const GEN_MODEL = MODE === "refs" ? "minimax-h3" : MODEL;
const VIDEO = { model: GEN_MODEL, resolution: VRES, audio: AUDIO, ...(MODE === "refs" ? { aspect_ratio: story.aspect } : {}) }, cost = videoCost(story.seconds, GEN_MODEL, VRES, AUDIO);
const REVIEW = S.obj({ beats: S.arr(S.obj({ beat: S.int, subject_present: S.enum(["yes", "no", "unclear"]), action_seen: S.enum(["yes", "no", "unclear"]), evidence: S.str })), exact_words: S.arr(S.obj({ text: S.str, reads: S.str, exact: S.bool })), same_people_and_place: S.enum(["yes", "no", "unclear"]), last_frame_holds: S.enum(["yes", "no", "unclear"]), identity: S.arr(S.obj({ carried: S.str, same_as_reference: S.enum(["yes", "no", "unclear"]), evidence: S.str })), artifacts: S.arr(S.str), lines: S.arr(S.obj({ text: S.str, heard: S.str, match: S.enum(["yes", "partly", "no"]), on_time: S.enum(["yes", "no", "unclear"]) })), voices_consistent: S.enum(["yes", "no", "unclear", "n/a"]), pass: S.bool, failures: S.arr(S.str) });
rec.attempts = []; let failures = null;
for (let a = 1; a <= 2; a++) {
  const key = a === 1 ? "clip-2" : "clip-2-retry", file = `${key}.mp4`;
  let p = op.prompt;
  if (failures) { const r = await jsonCall({ name: "v3-prompt-fix-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite this video prompt under ${LIMIT - 100} characters keeping its order, every beat, the PRESERVE sentence and the closing negatives; change only what fixes these failures, stated as plain positive sentences inside the beats they concern: ${failures.join("; ")}.\n\n${p}` }); p = r.prompt; llm("v3-prompt-fix-v1", "failures folded in"); if (p.length > LIMIT) p = op.prompt; }
  const att = { attempt: a, key, file, prompt: p, chars: p.length, model: GEN_MODEL, resolution: VRES, audio: AUDIO, aspect: story.aspect, seconds: story.seconds, cost, start_frame: still, references: MODE === "refs" ? REF_LIST : null, failures_named: failures };
  rec.attempts.push(att); run.save();
  say(`== ${key}: ${GEN_MODEL} ${MODE === "refs" ? `text-to-video with ${REF_LIST.map((r) => "@" + r.name).join(" ")}` : `image-to-video from ${still}`}, ${story.seconds} s ${VRES} audio ${AUDIO ? "on" : "off"}, ${cost} credits`);
  const t0 = Date.now(); let j;
  try { j = MODE === "refs" ? await jobs.tvideo(key, file, p, REF_LIST, story.seconds, VIDEO) : await jobs.video(key, file, p, still, null, story.seconds, VIDEO); } catch (e) { if (a === 1 || !/credit cap/.test(String(e))) throw e; say(`  regeneration skipped: ${e.message}`); rec.attempts.pop(); break; }
  att.credits = j.credits || 0; att.cached = !!j.cached; att.wall_seconds = Math.round((Date.now() - t0) / 1000);
  rec.tools.push(MODE === "refs" ? { tool: "text-to-video", endpoint: "/v1/text-to-video", ...VIDEO, seconds: story.seconds, references: REF_LIST, prompt: p, credits: att.credits, output: file, wall_seconds: att.wall_seconds } : { tool: "image-to-video", endpoint: "/v1/image-to-video", ...VIDEO, seconds: story.seconds, start: still, prompt: p, credits: att.credits, output: file, wall_seconds: att.wall_seconds });
  if (DRY) { att.estimated = cost; break; }
  // minimax-h3 returns a quiet sound bed even with audio off; when the story asks for no sound, the track is removed (the original kept beside it)
  if (!AUDIO) { const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", run.path(file)]).toString(); if (/audio/.test(streams)) { const keep = file.replace(/\.mp4$/, "-with-sound-bed.mp4"); execFileSync("mv", [run.path(file), run.path(keep)]); execFileSync("ffmpeg", ["-v", "error", "-y", "-i", run.path(keep), "-c:v", "copy", "-an", run.path(file)]); att.sound_bed_removed = keep; rec.tools.push({ tool: "ffmpeg", op: `audio was off but ${GEN_MODEL} returned a sound bed; stripped (original kept as ${keep})`, inputs: [keep], output: file, credits: 0 }); say(`  ${GEN_MODEL} returned a sound bed with audio off; removed (kept ${keep})`); } }
  const dur = duration(run.path(file)); att.rendered = Math.round(dur * 10) / 10;
  const T = op.beats.map((b) => Math.min(Math.round((b.from + b.to) / 2 * 2) / 2, dur - 0.2));
  att.frames = { beats: T.map((t, i) => { const f = `frames/${key}-b${i + 1}-${t}s.jpg`; frameAt(run.path(file), t, run.path(f)); return f; }), first: `frames/${key}-first.jpg`, last: `frames/${key}-last.jpg`, times: T };
  frameAt(run.path(file), 0, run.path(att.frames.first)); frameAt(run.path(file), -0.15, run.path(att.frames.last));
  rec.tools.push({ tool: "ffmpeg", op: `frames of ${key}`, inputs: [file], output: [att.frames.first, ...att.frames.beats, att.frames.last], credits: 0 });
  const refImgs = MODE === "refs" ? REF_LIST.map((r) => run.path(r.file)) : [REF];
  const imgs = [...refImgs, ...[att.frames.first, ...att.frames.beats, att.frames.last].map((f) => run.path(f))];
  att.review = await jsonCall({ name: "v3-review-c3-v1", effort: "medium", images: imgs, schema: REVIEW, prompt: `Review a generated ${story.seconds}-second clip. ${refImgs.length === 1 ? "Image 1 is the REFERENCE (not part of this clip)" : `Images 1–${refImgs.length} are the REFERENCES (${REF_LIST.map((r, i) => `image ${i + 1} = @${r.name}`).join(", ")}), not part of this clip`}. Image ${refImgs.length + 1} = this clip's first frame; images ${refImgs.length + 2}–${refImgs.length + 1 + T.length} = one frame in the middle of each beat (${T.map((t, i) => `beat ${i + 1} at ${t} s`).join(", ")}); image ${refImgs.length + 2 + T.length} = last frame.
BEATS ASKED FOR:
${op.beats.map((b, i) => `${i + 1}. ${b.from}–${b.to} s: ${b.shows}`).join("\n")}
CARRIED FROM THE REFERENCE${refImgs.length > 1 ? "S" : ""} (must be the same): ${story.carried.join("; ")}
Per beat: subject present, action seen (yes/no/unclear), evidence. identity: for each carried item, is it the same as in its reference image across the clip's frames (yes/no/unclear) with evidence (face, hair, clothing; flower colours and wrapping). same_people_and_place across the clip's frames; last_frame_holds; artifacts. exact_words: ${story.exact_words.length ? story.exact_words.map((w) => `'${w}'`).join(", ") : "none: return []"}. Audio is ${AUDIO ? "on; lines not checked here: return []" : "off: lines [], voices n/a"}. pass/failures are decided by code; fill them anyway.` });
  llm("v3-review-c3-v1", `review of ${key} with the reference`);
  { const R = att.review, f = [];
    R.beats.forEach((b) => { const bt = op.beats[b.beat - 1]; if (b.subject_present === "no") f.push(`beat ${b.beat} must show ${bt?.shows}`); else if (b.action_seen === "no") f.push(`beat ${b.beat} must visibly show: ${bt?.shows} (seen: ${b.evidence})`); });
    R.identity.forEach((i) => { if (i.same_as_reference === "no") f.push(`${i.carried} must look exactly as in the start frame (${i.evidence})`); });
    if (R.same_people_and_place === "no") f.push("the same people and place in every shot");
    if (R.last_frame_holds === "no") f.push("the final two seconds hold one still image with no new action");
    R.model_pass = R.pass; R.pass = f.length === 0; R.failures = f; }
  step(`review ${key}`, { pass: att.review.pass, failures: att.review.failures, identity: att.review.identity });
  say(`  ${key}: ${att.rendered} s in ${att.wall_seconds} s, ${att.credits} credits; identity ${att.review.identity.map((i) => `${i.carried.split(":")[0]} ${i.same_as_reference}`).join(", ")}; review ${att.review.pass ? "PASS" : `FAIL: ${att.review.failures.join("; ")}`}`);
  if (att.review.pass) break; failures = att.review.failures;
}
const made = rec.attempts.filter((x) => x.review), best = made.find((x) => x.review.pass) || made[0];
if (best) rec.outputs = { clip: best.file, chosen: best.key, seed: still, state: [{ clip: best.file, seconds: best.rendered, people: story.people, place: story.place, time: story.time, mood: story.mood, words_seen: best.review.exact_words, identity: best.review.identity, last_frame: best.frames.last }] };
rec.credits = [...(rec.seed_attempts || []), ...rec.attempts].reduce((n, x) => n + (x.credits || 0), 0); rec.llm_usage = { ...usage }; rec.finished = new Date().toISOString(); run.save();
say(`== done: ${rec.credits} credits; ${recFile}`);
