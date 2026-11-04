// V3 clip composition, case 1 (text only): brief → story → route → operational prompt → ltx-2.5 → VLM review (one retry).
// Usage: CLEANED_CAP=… node V3/compose/compose.mjs --brief "…" --label v3-flower-1 [--dry] [--audio on|off]
// Record: V3/runs/<label>/compose.json (every intermediate), clip at V3/runs/<label>/clip-1.mp4. Docs: V3/docs/02-case-1-text-only.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S, usage, MODEL as LLM } from "../../V2/backend/lib/llm.js";
import { videoCost } from "../../V2/backend/lib/models.js";
import { duration } from "../../V2/backend/lib/media.js";
import { frameAt } from "../../V2/backend/keyref2/keyref.js";
import { runStory } from "../../V2/backend/composer/story/story.js";   // the research gate, imported, not edited

export const V3 = join(dirname(fileURLToPath(import.meta.url)), "..");
const GUIDE = readFileSync(join(V3, "compose/guide.md"), "utf8");
const MODEL = "ltx-2.5", VRES = "480p", LIMIT = 2000;

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const brief = opt("--brief"), label = opt("--label"), DRY = args.includes("--dry"), AUDIO_OPT = opt("--audio", null), STORY_FILE = opt("--story-file", null), PLAIN = args.includes("--plain");
if (!brief || !label) { console.error("--brief and --label are required"); process.exit(2); }
const dir = join(V3, "runs", label); mkdirSync(join(dir, "frames"), { recursive: true });
const recFile = join(dir, "compose.json");
const old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};   // a rerun of the same label keeps the paid jobs: the same prompt is not generated (or charged) twice
const rec = { label, pipeline: "V3/compose (case 1, text only)", brief, at: new Date().toISOString(), dry: DRY, llm_model: LLM, llm: [], tools: [], steps: [], jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {}, earlier_run: old.at || null };
const run = { name: `v3-${label}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run, { estimate: DRY });
const say = (m) => console.log(m), llm = (name, purpose) => rec.llm.push({ name, purpose });
const step = (name, data) => { rec.steps.push({ name, at: new Date().toISOString(), ...data }); run.save(); };

// ---- 1. story: natural language → a grounded record (prose + fields). Not a screenplay, no shots. ----
say("== story");
const STORY = S.obj({
  prose: S.str, kind: S.enum(["fiction", "non-fiction"]), needs_research: S.bool, research_why: S.str,
  people: S.arr(S.str), place: S.str, time: S.str, mood: S.str, exact_words: S.arr(S.str),
  seconds: S.int, seconds_why: S.str, aspect: S.enum(["16:9", "9:16", "1:1"]), sound: S.enum(["none", "ambient", "music", "narration", "dialogue"]), sound_why: S.str,
  progression: S.arr(S.str), specific: S.arr(S.str), first_frame: S.str,
});
const storyPrompt = (facts) => `Ground this request into a STORY record for a short video. The story is prose (120–220 words) that says who, where, when, what happens in order, the mood, and how it ends; plus fields. It is not a screenplay: no shots, no camera, no timestamps.
REQUEST: ${brief}
${facts ? `FACTS (checked; use them, do not contradict them):\n${facts}\n` : ""}Fields: kind = fiction or non-fiction (a real place, person, product, event or process). needs_research = true only when non-fiction AND the look or facts of a real thing matter and are not in the request. people = each person with one identifying detail. exact_words = every string that must be readable on screen, verbatim from the request (empty if none). seconds = the duration the request asks for, else the shortest that tells it (≤ 60). aspect from the request's words (widescreen = 16:9, vertical/story/reel = 9:16, square = 1:1), default 16:9. sound: "none" unless the request asks for sound or speech; say why. progression = the request's OWN actions, each as its own line in the request's words and order ("arranges a bouquet" stays "arranges a bouquet", never merged with the next action or softened into a result like "finishes a bouquet"), plus at most two connecting lines; 3–8 lines in all. Never state that something the request shows being done is already done. specific = things that must match a supplied picture or a real likeness (empty here if none supplied). first_frame = a required first frame described, else "".`;
let story = STORY_FILE ? JSON.parse(readFileSync(STORY_FILE, "utf8")) : await jsonCall({ name: "v3-story-v1", effort: "medium", schema: STORY, prompt: storyPrompt(null) }); llm(STORY_FILE ? "(sequence record from the sequencer)" : "v3-story-v1", "the story record from the request");
story.specific ??= []; story.first_frame ??= ""; story.needs_research ??= false; story.research_why ??= ""; story.seconds_why ??= ""; story.exact_words ??= [];
let research = null;
if (story.kind === "non-fiction" && story.needs_research) {
  say(`research gate: ${story.research_why}`);
  const G = rec.gate_log = {};
  await runStory({ brief, log: G, run, say, seconds: story.seconds }); llm("research-gate (V2 composer/story)", "web research for a real thing");
  research = G.research ? { facts: G.research.facts, looks: G.research.looks } : null;
  if (research) { story = await jsonCall({ name: "v3-story-v1", effort: "medium", schema: STORY, prompt: storyPrompt([...research.facts, ...research.looks].map((x) => `- ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n")) }); llm("v3-story-v1", "the story again, with the facts"); }
}
const AUDIO = AUDIO_OPT ? AUDIO_OPT === "on" : story.sound !== "none";
rec.story = story; rec.research = research;
step("story", { summary: `${story.kind}, ${story.seconds} s, ${story.aspect}, sound ${story.sound}${AUDIO_OPT ? ` (forced ${AUDIO_OPT})` : ""}, ${story.exact_words.length} exact string(s)`, story });
say(story.prose);

// ---- 2. route (code): one sequence ≤ 60 s and nothing specific → case 1 ----
const route = story.seconds > 60 ? "case 2 (several sequences)" : story.specific.length || story.first_frame ? "case 3 (a specific thing)" : "case 1 (text only)";
const why = story.seconds > 60 ? `${story.seconds} s is more than one ltx-2.5 call (60 s)` : story.specific.length ? `specific: ${story.specific.join(", ")}` : story.first_frame ? `a first frame is required: ${story.first_frame}` : `${story.seconds} s ≤ 60, nothing specific, no first frame`;
step("route", { route, why, sequence: { from: 0, to: story.seconds, whole_story: true } });
say(`route: ${route} (${why})`);
if (route !== "case 1 (text only)") { say("only case 1 is built; stopping"); rec.stopped = route; run.save(); process.exit(0); }

// ---- 3. the operational prompt: sequence + guide → one paragraph ≤ 2,000 chars, with its beats listed for the review ----
say("== operational prompt");
const PROMPT = S.obj({ prompt: S.str, beats: S.arr(S.obj({ from: S.int, to: S.int, shows: S.str })), shots: S.int, lines: S.arr(S.obj({ from: S.int, to: S.int, speaker: S.str, text: S.str })) });
const writePrompt = async (note) => {
  if (PLAIN) return jsonCall({ name: "v3-prompt-plain-v1", effort: "medium", schema: PROMPT, prompt: `You are writing the prompt for ONE text-to-video generation (model ltx-2.5, ${story.seconds} seconds, ${story.aspect}, audio ${AUDIO ? "on" : "off"}) from a user's brief, the way a careful director would, following the GUIDE. One prose paragraph under ${LIMIT} characters. Decide yourself what belongs in the clip and what does not; the brief says what is not shown. Return the prompt, the beats you wrote (from, to, what each shows in ≤ 12 words), the shot count, and the spoken lines (empty if none).${note ? `\n\n${note}` : ""}

GUIDE:
${GUIDE}

BRIEF:
${brief}` });
  const r = await jsonCall({ name: "v3-prompt-v1", effort: "medium", schema: PROMPT, prompt: `Write the operational prompt for ONE text-to-video generation on ltx-2.5 from the SEQUENCE below, following the GUIDE exactly: one prose paragraph, the slots in the guide's order, under ${LIMIT} characters, covering all ${story.seconds} seconds. Audio is ${AUDIO ? "ON: include the SOUND slot; every spoken line is quoted in the prompt with its time range and who says it, and returned in `lines` (from, to, speaker, text exactly as quoted); sound effects and music are described, not quoted" : "OFF: no sound slot, end the negatives with no voiceover, and return lines as an empty list"}. The beats' actions are the REQUEST's own actions, one beat each, in its order; the sequence adds the who, where and look. A beat is 3–6 seconds: at most ${Math.ceil(story.seconds / 3)} beats for ${story.seconds} seconds. If the sequence carries a BIBLE, each person's or thing's full look appears ONCE, in the CONTINUITY sentence; inside the beats use the name and one anchor only ("Vale, binoculars raised"), never the full description again. Every string in exact_words must appear in the prompt verbatim inside single quotes, once, at the beat where it is seen. Also return the beats you wrote (from, to in seconds; what each shows in ≤ 12 words) and the shot count you stated.${note ? `\n\n${note}` : ""}

GUIDE:
${GUIDE}

REQUEST (the user's words):
${brief}

SEQUENCE (the whole story here):
${JSON.stringify({ prose: story.prose, people: story.people, place: story.place, time: story.time, mood: story.mood, exact_words: story.exact_words, seconds: story.seconds, aspect: story.aspect, sound: AUDIO ? story.sound : "none", progression: story.progression }, null, 1)}` });
  return r;
};
// code checks: the length and the exact words; one rewrite if either fails
const maxBeats = Math.ceil(story.seconds / 3);
const check = (p) => { const miss = story.exact_words.filter((w) => !p.prompt.includes(w)); return { ok: p.prompt.length <= LIMIT && !miss.length && p.beats.length <= maxBeats, chars: p.prompt.length, missing: miss, beats: p.beats.length, max_beats: maxBeats }; };
let op = await writePrompt(null), c = check(op); llm("v3-prompt-v1", "the operational prompt from the sequence and the guide");
rec.prompt_attempts = [{ ...op, check: c }];
if (!c.ok) { op = await writePrompt(`A first draft failed the code check: ${c.chars > LIMIT ? `${c.chars} characters, must be under ${LIMIT}: cut adjectives and repetition, keep every beat and quoted string` : ""}${c.missing.length ? ` missing verbatim: ${c.missing.map((w) => `'${w}'`).join(", ")}` : ""}${c.beats > maxBeats ? ` ${c.beats} beats for ${story.seconds} seconds: merge to at most ${maxBeats} beats of 3–6 seconds each` : ""}.`); c = check(op); llm("v3-prompt-v1", "rewrite after the code check"); rec.prompt_attempts.push({ ...op, check: c }); }
if (!c.ok) { say(`prompt failed the code check twice (${JSON.stringify(c)}); stopping`); rec.stopped = "prompt check"; run.save(); process.exit(1); }
rec.prompt = op;
step("prompt", { chars: op.prompt.length, shots: op.shots, beats: op.beats, check: c, prompt: op.prompt });
say(`${op.prompt.length} chars, ${op.beats.length} beats, ${op.shots} shots\n${op.prompt}`);

// ---- 4 + 5. the clip, then the review on frames; one regeneration with the failures named ----
const VIDEO = { model: MODEL, resolution: VRES, audio: AUDIO, aspect_ratio: story.aspect };
const cost = videoCost(story.seconds, MODEL, VRES, AUDIO);
import { execFileSync } from "node:child_process";
import { key } from "../../V2/backend/lib/env.js";
// whisper-1 with timed segments; a silent or speechless clip returns []
async function transcribe(file) {
  const wav = file.replace(/\.mp4$/, ".wav"); execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", wav]);
  const form = new FormData(); form.append("model", "whisper-1"); form.append("response_format", "verbose_json"); form.append("file", new Blob([readFileSync(wav)]), "a.wav");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((x) => x.json()).catch(() => ({}));
  return (r.segments || []).map((g) => ({ from: Math.round(g.start * 10) / 10, to: Math.round(g.end * 10) / 10, text: g.text.trim() })).filter((g) => g.text);
}
const REVIEW = S.obj({ lines: S.arr(S.obj({ text: S.str, heard: S.str, match: S.enum(["yes", "partly", "no"]), on_time: S.enum(["yes", "no", "unclear"]) })), voices_consistent: S.enum(["yes", "no", "unclear", "n/a"]), beats: S.arr(S.obj({ beat: S.int, subject_present: S.enum(["yes", "no", "unclear"]), action_seen: S.enum(["yes", "no", "unclear"]), evidence: S.str })), exact_words: S.arr(S.obj({ text: S.str, reads: S.str, exact: S.bool })), same_people_and_place: S.enum(["yes", "no", "unclear"]), last_frame_holds: S.enum(["yes", "no", "unclear"]), artifacts: S.arr(S.str), pass: S.bool, failures: S.arr(S.str) });
rec.attempts = [];
let failures = null;
for (let a = 1; a <= 2; a++) {
  const key = a === 1 ? "clip-1" : "clip-1-retry", file = `${key}.mp4`;
  let p = op.prompt;
  if (failures) { const r = await jsonCall({ name: "v3-prompt-fix-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite this video prompt under ${LIMIT} characters keeping its order, every beat, every quoted string and the closing negatives; change only what fixes these failures from a first generation, stated as plain positive sentences inside the beats they concern (never as "do not"): ${failures.join("; ")}.\n\n${p}` }); p = r.prompt; llm("v3-prompt-fix-v1", "the prompt with the review's failures folded in");
    if (p.length > LIMIT) { const c2 = await jsonCall({ name: "v3-prompt-shorten-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite this video prompt under ${LIMIT - 100} characters. Keep its order, every beat and its time range, every quoted string, the sound sentence and the closing negatives; cut adjectives and repetition.\n\n${p}` }); llm("v3-prompt-shorten-v1", "the fixed prompt was over the limit"); p = c2.prompt; }
    if (p.length > LIMIT) { say(`  the fixed prompt is still ${p.length} chars; regenerating with the original prompt`); p = op.prompt; } }
  const att = { attempt: a, key, file, prompt: p, chars: p.length, model: MODEL, resolution: VRES, audio: AUDIO, aspect: story.aspect, seconds: story.seconds, cost, failures_named: failures };
  rec.attempts.push(att); run.save();
  say(`== ${key}: ${MODEL} ${story.seconds} s ${story.aspect} ${VRES} audio ${AUDIO ? "on" : "off"}, ${cost} credits`);
  const t0 = Date.now();
  let j; try { j = await jobs.tvideo(key, file, p, [], story.seconds, VIDEO); } catch (e) { if (a === 1 || !/credit cap/.test(String(e))) throw e; att.skipped = String(e.message); say(`  regeneration skipped: ${att.skipped}`); rec.attempts.pop(); break; }
  att.credits = j.credits || 0; att.cached = !!j.cached; att.wall_seconds = Math.round((Date.now() - t0) / 1000);
  rec.tools.push({ tool: "text-to-video", endpoint: "/v1/text-to-video", ...VIDEO, seconds: story.seconds, prompt: p, credits: att.credits, output: file, wall_seconds: att.wall_seconds });
  if (DRY) { att.estimated = cost; break; }
  // frames: one at each beat's middle, plus first and last
  const dur = duration(run.path(file)); att.rendered = Math.round(dur * 10) / 10;
  const T = op.beats.map((b) => Math.min(Math.round((b.from + b.to) / 2 * 2) / 2, dur - 0.2));
  att.frames = { beats: T.map((t, i) => { const f = `frames/${key}-b${i + 1}-${t}s.jpg`; frameAt(run.path(file), t, run.path(f)); return f; }), first: `frames/${key}-first.jpg`, last: `frames/${key}-last.jpg`, times: T };
  frameAt(run.path(file), 0, run.path(att.frames.first)); frameAt(run.path(file), -0.15, run.path(att.frames.last));
  rec.tools.push({ tool: "ffmpeg", op: `frames of ${key}: first, each beat's middle, last`, inputs: [file], output: [att.frames.first, ...att.frames.beats, att.frames.last], credits: 0 });
  const imgs = [att.frames.first, ...att.frames.beats, att.frames.last].map((f) => run.path(f));
  if (AUDIO) { att.transcript = await transcribe(run.path(file)); rec.tools.push({ tool: "whisper-1", op: `transcript of ${key} with timed segments`, inputs: [file], output: att.transcript, credits: 0 }); say(`  transcript: ${att.transcript.map((g) => `[${g.from}–${g.to}] ${g.text}`).join(" ") || "(no speech)"}`); }
  const soundPart = AUDIO ? `\nSOUND: the clip's speech was transcribed with timestamps (you cannot hear it): ${att.transcript.length ? att.transcript.map((g) => `[${g.from}–${g.to} s] "${g.text}"`).join(" ") : "(no speech transcribed)"}\nLINES ASKED FOR: ${op.lines.map((l) => `${l.from}–${l.to} s ${l.speaker}: "${l.text}"`).join("; ") || "none"}\nFor each line asked for: what was heard for it, match yes/partly/no (the words, not the exact phrasing), and on_time if it falls within about 2 s of its range. voices_consistent: from the transcript alone say "unclear" unless speakers are plainly merged or missing.` : "\nAudio is off: return lines as an empty list and voices_consistent n/a.";
  att.review = await jsonCall({ name: "v3-review-v1", effort: "medium", images: imgs, schema: REVIEW, prompt: `Review a generated ${story.seconds}-second clip against the beats it was asked for.${soundPart} The attached images, in order: image 1 = first frame; images 2–${1 + T.length} = one frame in the middle of each beat (${T.map((t, i) => `beat ${i + 1} at ${t} s`).join(", ")}); image ${2 + T.length} = last frame.
BEATS ASKED FOR:
${op.beats.map((b, i) => `${i + 1}. ${b.from}–${b.to} s: ${b.shows}`).join("\n")}
EXACT WORDS that must be readable somewhere: ${story.exact_words.map((w) => `'${w}'`).join(", ") || "none"}
Per beat: is the stated subject present in its frame, is the stated action seen (yes/no/unclear) with a few words of evidence. For each exact string: transcribe what the lettering reads, letter by letter, and whether it is exact. Then: same people and place across the frames? does the last frame hold a still, readable final image? list visible artifacts (extra limbs, doubled objects, garbled lettering, morphing). pass = every beat's subject present AND every exact string exact AND same people and place; failures = each failed point as one short plain sentence usable in a prompt (empty if pass).` });
  llm("v3-review-v1", `review of ${key} on ${imgs.length} frames`);
  // pass is decided in code, not by the model: every beat's subject present and its action seen (unclear tolerated), every exact string exact, the same people and place, a held last frame
  { const R = att.review, f = [];
    R.beats.forEach((b) => { const bt = op.beats[b.beat - 1]; if (b.subject_present === "no") f.push(`beat ${b.beat} (${bt?.from}–${bt?.to} s) must show ${bt?.shows}`); else if (b.action_seen === "no") f.push(`beat ${b.beat} (${bt?.from}–${bt?.to} s) must visibly show the action: ${bt?.shows} (seen instead: ${b.evidence})`); });
    R.exact_words.forEach((w) => { if (!w.exact) f.push(`the lettering must read exactly '${w.text}' (it read "${w.reads}")`); });
    if (R.same_people_and_place === "no") f.push("the same people and place in every shot");
    if (R.last_frame_holds === "no") f.push("the final two seconds hold one still, readable image of the place with no new action");
    if (AUDIO) { if (op.lines.length && !att.transcript.length) f.push("the spoken lines must be audible: no speech was heard at all"); R.lines.forEach((l) => { if (l.match === "no") f.push(`the line "${l.text}" must be spoken clearly (heard: "${l.heard || "nothing"}")`); }); }
    R.model_pass = R.pass; R.pass = f.length === 0; R.failures = f; }
  step(`review ${key}`, { pass: att.review.pass, failures: att.review.failures, frames: att.frames });
  say(`  ${key}: ${att.rendered} s rendered in ${att.wall_seconds} s, ${att.credits} credits; review ${att.review.pass ? "PASS" : `FAIL: ${att.review.failures.join("; ")}`}`);
  if (att.review.pass) break;
  failures = att.review.failures;
}
const made = rec.attempts.filter((x) => x.review), best = made.find((x) => x.review.pass) || made.reduce((b, x) => (x.review.beats.filter((q) => q.subject_present === "yes").length > b.review.beats.filter((q) => q.subject_present === "yes").length ? x : b), made[0]);
if (best) {
  rec.outputs = { clip: best.file, chosen: best.key, state: [{ clip: best.file, seconds: best.rendered, people: story.people, place: story.place, time: story.time, mood: story.mood, words_seen: best.review.exact_words, last_frame: best.frames.last }] };
  step("return", { clip: best.file, review_pass: best.review.pass, credits: rec.attempts.reduce((n, x) => n + (x.credits || 0), 0) });
}
rec.credits = rec.attempts.reduce((n, x) => n + (x.credits || 0), 0); rec.estimate = DRY ? cost : undefined; rec.llm_usage = { ...usage }; rec.finished = new Date().toISOString();
run.save();
say(`== done: ${rec.credits} credits, ${rec.llm.length} LLM calls; ${recFile}`);
