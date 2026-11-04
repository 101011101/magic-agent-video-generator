// V3 case 2: several sequences. Not a video maker: a splitter that writes one story with a BIBLE (fixed descriptors for every
// person, place, object and the ship), cuts it into sequences, routes each to case 1 (text only) or case 3 (seeded from a
// hand-picked reference: the state manager assumed perfect), runs them in dependency order, and joins the clips.
// Usage: CLEANED_CAP=… node V3/compose/case2.mjs --brief "…" --label v3-ship-1 [--dry] [--clips 3]
//        [--ref <n>:<name>=<file>  …]   a reference for sequence n (first one = identity seed); given by hand after earlier clips exist
//        [--only 1,2]                 run only these sequences this time (the rest are planned and skipped)
// Record: V3/runs/<label>/sequence.json; each clip in V3/runs/<label>-s<n>/; the joined film at V3/runs/<label>/film.mp4
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { jsonCall, S, MODEL as LLM } from "../../V2/backend/lib/llm.js";
import { videoCost } from "../../V2/backend/lib/models.js";
import { V3 } from "./paths.mjs";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const brief = opt("--brief"), label = opt("--label"), DRY = args.includes("--dry"), CLIPS = opt("--clips") ? Number(opt("--clips")) : null, ONLY = opt("--only") ? opt("--only").split(",").map(Number) : null;
const REFS = {}; for (const r of all("--ref")) { const m = r.match(/^(\d+):(.+)$/); if (!m) { console.error(`--ref wants n:name=file (got ${r})`); process.exit(2); } (REFS[Number(m[1])] ??= []).push(m[2]); }
if (!brief || !label) { console.error("--brief and --label are required"); process.exit(2); }
const dir = join(V3, "runs", label); mkdirSync(dir, { recursive: true });
const recFile = join(dir, "sequence.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : null;
const rec = { label, pipeline: "V3/compose case 2 (several sequences; references picked by hand, the state manager assumed perfect)", brief, at: new Date().toISOString(), dry: DRY, llm_model: LLM, llm: [], steps: [] };
const save = () => writeFileSync(recFile, JSON.stringify(rec, null, 2)), say = (m) => console.log(m);

// ---- 1. one story, one bible, the sequences ---------------------------------------------------------------------------
say("== story, bible, sequences");
const SEQ = S.obj({ n: S.int, title: S.str, seconds: S.int, brief: S.str, prose: S.str, place: S.str, time: S.str, mood: S.str, people: S.arr(S.str), exact_words: S.arr(S.str), sound: S.enum(["none", "ambient", "music", "narration", "dialogue"]), sound_why: S.str, progression: S.arr(S.str),
  carries: S.arr(S.obj({ from_sequence: S.int, what: S.str, how: S.enum(["same place and people (new scene there)", "same object seen again", "direct continuation of the last frame"]) })), new_scene: S.bool, first_frame: S.str });
const PLAN = S.obj({ title: S.str, story: S.str, aspect: S.enum(["16:9", "9:16", "1:1"]), total_seconds: S.int,
  bible: S.obj({ people: S.arr(S.obj({ id: S.str, look: S.str })), places: S.arr(S.obj({ id: S.str, look: S.str })), objects: S.arr(S.obj({ id: S.str, look: S.str })), light_and_grade: S.str }), sequences: S.arr(SEQ) });
const plan = old?.plan && old.brief === brief ? old.plan : await jsonCall({ name: "v3-sequencer-v1", effort: "medium", schema: PLAN, prompt: `Plan a short film from this request as SEQUENCES, each one clip from one video generation (≤ 60 s; use the request's clip count if it gives one${CLIPS ? `; it is ${CLIPS} here` : ""}).
REQUEST: ${brief}

First write the STORY (120–250 words, prose: who, where, what happens in order, how it ends). Then the BIBLE: every person, place and object that appears in more than one sequence gets an id and a LOOK of 2–4 concrete visual anchors (hair, one garment, one detail; for a ship its class, colour, one distinctive feature; for a room its layout, materials, light), plus one line of light and grade for the whole film. The same words will be pasted into every sequence's prompt, so choose anchors a video model can render and keep.
Then the SEQUENCES, in order. Each: seconds (typically 10–20); brief = ONE plain paragraph (90–160 words) written the way a person briefs a video maker for THIS clip alone, and the only text the clip's prompt will be written from: the setting first and relationally ("inside the Resolute's bridge: a narrow steel room, slanted front windows overlooking a cold grey sea"), each person present named with their bible look in prose, the actions in order with any spoken line quoted, where distant things are seen and at what scale, the light, and a last sentence saying this is clip n of N and what is NOT shown here (it belongs to the next clip); prose (60–120 words, the same events as story prose), place/time/mood, people (bible looks verbatim), exact_words (strings that must be readable; usually none), sound and why, progression (the request's own actions for this clip, one per line), carries (what comes from an earlier sequence and how: the same place and people as a new scene there; the same object seen again, e.g. on a screen; or a direct continuation of the last frame), new_scene (true unless it continues the previous clip's last frame), first_frame (one or two sentences: the first image of this clip, concretely, naming the carried people/objects).` });
if (plan.sequences.some((q) => !q.brief)) {   // a plan made before briefs existed: write the per-clip briefs for the same cast and sequences
  const bb = await jsonCall({ name: "v3-sequence-briefs-v1", effort: "medium", schema: S.obj({ briefs: S.arr(S.obj({ n: S.int, brief: S.str })) }), prompt: `For each sequence below write ONE plain paragraph (90–160 words) the way a person briefs a video maker for THAT clip alone; it will be the only text the clip's prompt is written from. Setting first and relationally ("inside the Resolute's bridge: a narrow steel room, slanted front windows overlooking a cold grey sea"); each person present named with their bible look in prose; the actions in order with any spoken line quoted (short, distinct lines, one per moment); where distant things are seen and at what scale; the light; and a last sentence saying this is clip n of ${plan.sequences.length} and what is NOT shown here because it belongs to the next clip.
BIBLE: ${JSON.stringify(plan.bible)}
SEQUENCES: ${JSON.stringify(plan.sequences.map((q) => ({ n: q.n, title: q.title, seconds: q.seconds, prose: q.prose, people: q.people, sound: q.sound, carries: q.carries })))}` });
  for (const b of bb.briefs) { const q = plan.sequences.find((x) => x.n === b.n); if (q) q.brief = b.brief; }
  rec.llm.push({ name: "v3-sequence-briefs-v1", purpose: "plain briefs for an existing plan" });
}
rec.plan = plan; rec.llm.push({ name: "v3-sequencer-v1", purpose: "the story, the bible and the sequences" }); save();
say(`${plan.title}: ${plan.sequences.length} sequences, ${plan.total_seconds} s, ${plan.aspect}\n${plan.story}\nBIBLE: ${JSON.stringify(plan.bible)}`);

// ---- 2. route each sequence (code) --------------------------------------------------------------------------------------
const bibleText = `BIBLE (use these words for these things, every time): ${[...plan.bible.people, ...plan.bible.places, ...plan.bible.objects].map((b) => `${b.id} = ${b.look}`).join("; ")}. Light and grade: ${plan.bible.light_and_grade}.`;
rec.routes = plan.sequences.map((q) => {
  const refs = REFS[q.n] || [];
  const needs = q.carries.length > 0;
  const route = refs.length ? "case 3 (seeded from the hand-picked reference)" : needs ? "case 1 with the bible's words (no reference given yet)" : "case 1 (text only)";
  const why = refs.length ? `references given for sequence ${q.n}: ${refs.join(", ")}` : needs ? `carries ${q.carries.map((c) => `${c.what} from sequence ${c.from_sequence} (${c.how})`).join("; ")}, but no reference was given, so the bible's words carry it` : "first appearance of everything";
  return { n: q.n, route, why, refs, carries: q.carries, seconds: q.seconds, cost: videoCost(q.seconds, "ltx-2.5", "480p", q.sound !== "none") + (refs.length ? 10 : 0) };
});
rec.estimate = { clips: rec.routes.map((r) => ({ n: r.n, seconds: r.seconds, cost: r.cost })), total: rec.routes.reduce((n, r) => n + r.cost, 0), with_one_retry_each: rec.routes.reduce((n, r) => n + r.cost + videoCost(r.seconds, "ltx-2.5", "480p", true), 0) };
save();
for (const r of rec.routes) say(`sequence ${r.n}: ${r.route} · ${r.why} · ~${r.cost} credits`);
say(`estimate: ${rec.estimate.total} credits (${rec.estimate.with_one_retry_each} with one retry each)`);

// ---- 3. run each sequence through its case, in order ---------------------------------------------------------------------
rec.clips = old?.clips || {};
for (const q of plan.sequences) {
  const r = rec.routes.find((x) => x.n === q.n), sub = `${label}-s${q.n}`, subDir = join(V3, "runs", sub);
  if (ONLY && !ONLY.includes(q.n)) { say(`sequence ${q.n}: skipped this time (--only ${ONLY.join(",")})`); continue; }
  mkdirSync(subDir, { recursive: true });
  const mine = [...plan.bible.people, ...plan.bible.places, ...plan.bible.objects].filter((b) => { const needle = b.id.replace(/_/g, " ").toLowerCase(), hay = `${q.prose} ${q.people.join(" ")} ${q.place} ${q.first_frame} ${q.carries.map((c) => c.what).join(" ")}`.toLowerCase(); return hay.includes(needle) || hay.includes(b.id) || b.look.split(",")[0] && hay.includes(b.look.split(",")[0].toLowerCase().replace(/^an? /, "")); });
  const myBible = `BIBLE for this clip only (use these words for these things; nothing else from the film is in this clip): ${mine.map((b) => `${b.id} = ${b.look}`).join("; ")}. Light and grade: ${plan.bible.light_and_grade}. This is clip ${q.n} of ${plan.sequences.length} of "${plan.title}"${q.n < plan.sequences.length ? `; what happens in clip ${q.n + 1} ("${plan.sequences[q.n]?.title}") is NOT shown here` : ""}.`;
  const record = { prose: `${q.prose}\n\n${myBible}`, kind: "fiction", needs_research: false, research_why: "", people: q.people, place: q.place, time: q.time, mood: q.mood, exact_words: q.exact_words, seconds: q.seconds, seconds_why: "from the sequence plan", aspect: plan.aspect, sound: q.sound, sound_why: q.sound_why, progression: q.progression, specific: [], first_frame: r.refs.length ? q.first_frame : "", carried: q.carries.map((c) => c.what) };
  const sf = join(subDir, "sequence-record.json"); writeFileSync(sf, JSON.stringify(record, null, 2));
  const seqBrief = q.brief || `${q.title}: ${q.prose} (${myBible})`;   // the plain brief is the whole input of the last step, as with the MCP
  const cmd = r.refs.length ? ["V3/compose/case3.mjs", "--brief", seqBrief, "--label", sub, "--story-file", sf, "--plain", ...r.refs.flatMap((x) => ["--ref", x])] : ["V3/compose/compose.mjs", "--brief", seqBrief, "--label", sub, "--story-file", sf, "--plain"];
  if (DRY) cmd.push("--dry");
  say(`\n== sequence ${q.n} → ${cmd[0]} (${sub})`);
  const t0 = Date.now(), p = spawnSync("node", cmd, { cwd: V3 + "/..", stdio: "inherit", env: process.env });
  const out = existsSync(join(subDir, "compose.json")) ? JSON.parse(readFileSync(join(subDir, "compose.json"), "utf8")) : null;
  rec.clips[q.n] = { label: sub, runner: cmd[0], exit: p.status, seconds_wall: Math.round((Date.now() - t0) / 1000), clip: out?.outputs?.clip ? join("..", sub, out.outputs.clip) : null, credits: out?.credits ?? 0, review_pass: out?.attempts?.find((a) => a.key === out?.outputs?.chosen)?.review?.pass ?? null, last_frame: out?.outputs?.state?.[0]?.last_frame ? join("..", sub, out.outputs.state[0].last_frame) : null, page: join("..", sub, "index.html") };
  save();
  if (!DRY) spawnSync("node", ["V3/compose/page.mjs", sub], { cwd: V3 + "/..", stdio: "ignore" });
  if (p.status !== 0 && !DRY) { say(`sequence ${q.n} failed (exit ${p.status}); stopping here`); break; }
}

// ---- 4. join (a plain cut between clips; the loop's assemble tool does more) --------------------------------------------
const done = plan.sequences.map((q) => rec.clips[q.n]).filter((c) => c?.clip);
if (!DRY && done.length === plan.sequences.length) {
  const list = join(dir, "concat.txt"); writeFileSync(list, done.map((c) => `file '${resolve(dir, c.clip)}'`).join("\n"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", join(dir, "film.mp4")]);
  rec.film = "film.mp4"; say(`== film: ${join(dir, "film.mp4")}`);
}
rec.credits = Object.values(rec.clips).reduce((n, c) => n + (c.credits || 0), 0); rec.finished = new Date().toISOString(); save();
say(`== done: ${rec.credits} credits; ${recFile}`);
