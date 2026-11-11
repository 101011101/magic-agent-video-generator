// V3 film: natural language → STORY (a SETTING block up front, then one paragraph per clip) → each clip is case 1 or case 3, and the
// prompt writer for a clip gets exactly three things: the setting, that clip's paragraph (verbatim), the guide. Nothing is rewritten in between.
// Usage: CLEANED_CAP=… node V3/compose/film.mjs --brief "…" --label <label> [--clips 3] [--dry] [--only 1,2]
//        [--ref <n>:<name>=<file> …]   a reference for clip n (first = the start frame; by hand for now)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { jsonCall, S, MODEL as LLM } from "../../V2/backend/lib/llm.js";
import { videoCost } from "../../V2/backend/lib/models.js";
import { V3 } from "./paths.mjs";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const brief = opt("--brief"), label = opt("--label"), DRY = args.includes("--dry"), CLIPS = opt("--clips") ? Number(opt("--clips")) : null, ONLY = opt("--only") ? opt("--only").split(",").map(Number) : null;
const REFS = {}; for (const r of all("--ref")) { const m = r.match(/^(\d+):(.+)$/); if (!m) { console.error(`--ref wants n:name=file`); process.exit(2); } (REFS[Number(m[1])] ??= []).push(m[2]); }
if (!brief || !label) { console.error("--brief and --label are required"); process.exit(2); }
const dir = join(V3, "runs", label); mkdirSync(dir, { recursive: true });
const recFile = join(dir, "film.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : null;
const rec = { label, pipeline: "V3/compose film (story with a setting block, one paragraph per clip; each clip = case 1 or 3 with setting + paragraph + guide)", brief, at: new Date().toISOString(), dry: DRY, llm_model: LLM, llm: [], steps: [] };
const save = () => writeFileSync(recFile, JSON.stringify(rec, null, 2)), say = (m) => console.log(m);

// ---- 1. the story: a setting block, then one paragraph per clip ---------------------------------------------------------
say("== story");
const STORY = S.obj({ title: S.str, aspect: S.enum(["16:9", "9:16", "1:1"]),
  setting: S.str,
  cast: S.arr(S.obj({ id: S.str, look: S.str })), places: S.arr(S.obj({ id: S.str, look: S.str })),
  clips: S.arr(S.obj({ n: S.int, seconds: S.int, paragraph: S.str, sound: S.enum(["none", "ambient", "music", "narration", "dialogue"]), exact_words: S.arr(S.str), in_this_clip: S.arr(S.str) })) });
const story = old?.story && old.brief === brief ? old.story : await jsonCall({ name: "v3-film-story-v1", effort: "medium", schema: STORY, prompt: `Turn this request into a short film STORY for ${CLIPS ? `exactly ${CLIPS}` : "a few"} clips, each one video generation of 10–20 seconds.
REQUEST: ${brief}

Write it in two parts.
SETTING (120–200 words of prose, placed before the story): the world and time; each place described relationally and concretely (what kind of room, what the windows look onto, the light); each person with a name and two to four visual anchors (hair, one garment, one detail) that a video model can keep; the light and grade of the whole film. The same words are used whenever the person or place appears.
STORY: ${CLIPS || "N"} paragraphs, one per clip, 70–130 words each, in order. Each paragraph is the whole of what happens in that clip and nothing from another clip: the actions in the order they happen with their verbs kept plain ("points", "raises", "lowers"), who does each, any spoken line quoted and short, what is seen and at what scale, how the clip ends (on what image). Use the setting's names and anchors. The paragraphs are fed to the clip maker verbatim, so write them as a person would brief that one clip.
Also return cast and places (id + the same look words as the setting, for making reference pictures), and per clip: seconds, sound (none unless speech or asked), exact_words (strings that must be readable; usually none), in_this_clip (ids of cast and places that appear).` });
rec.story = story; rec.llm.push({ name: "v3-film-story-v1", purpose: "the story: setting block + one paragraph per clip" }); save();
say(`${story.title} · ${story.clips.length} clips · ${story.aspect}\n\nSETTING:\n${story.setting}\n`);
for (const c of story.clips) say(`CLIP ${c.n} (${c.seconds} s, sound ${c.sound}, in it: ${c.in_this_clip.join(", ")}):\n${c.paragraph}\n`);

// ---- 2. each clip: case 1 or case 3; the prompt writer gets setting + paragraph + guide --------------------------------------
rec.clips = old?.clips || {}; rec.routes = [];
for (const c of story.clips) {
  const refs = REFS[c.n] || [], route = refs.length ? "case 3" : "case 1", sub = `${label}-c${c.n}`, subDir = join(V3, "runs", sub);
  rec.routes.push({ n: c.n, route, refs, cost: videoCost(c.seconds, "ltx-2.5", "480p", c.sound !== "none") });
  if (ONLY && !ONLY.includes(c.n)) { say(`clip ${c.n}: ${route}, skipped this time`); continue; }
  mkdirSync(subDir, { recursive: true });
  // the three inputs of the clip maker: the setting, this clip's paragraph, the guide (the guide is added by the runner)
  const clipBrief = `SETTING:\n${story.setting}\n\nCLIP ${c.n} OF ${story.clips.length} (${c.seconds} seconds${c.n < story.clips.length ? `; what happens in clip ${c.n + 1} is not shown here` : ""}):\n${c.paragraph}`;
  const record = { prose: c.paragraph, kind: "fiction", people: story.cast.filter((p) => c.in_this_clip.includes(p.id)).map((p) => `${p.id}: ${p.look}`), place: story.places.filter((p) => c.in_this_clip.includes(p.id)).map((p) => p.look).join("; "), time: "", mood: "", exact_words: c.exact_words, seconds: c.seconds, aspect: story.aspect, sound: c.sound, sound_why: "from the story", progression: [], specific: [], first_frame: "", carried: story.cast.filter((p) => c.in_this_clip.includes(p.id)).map((p) => `${p.id}: ${p.look}`) };
  const sf = join(subDir, "sequence-record.json"); writeFileSync(sf, JSON.stringify(record, null, 2)); writeFileSync(join(subDir, "clip-brief.txt"), clipBrief);
  const cmd = refs.length ? ["V3/compose/case3.mjs", "--plain", "--no-edit", "--brief", clipBrief, "--label", sub, "--story-file", sf, ...refs.flatMap((x) => ["--ref", x])] : ["V3/compose/compose.mjs", "--plain", "--brief", clipBrief, "--label", sub, "--story-file", sf];
  if (DRY) cmd.push("--dry");
  say(`\n== clip ${c.n} → ${route} (${cmd[0]})`);
  const t0 = Date.now(), p = spawnSync("node", cmd, { cwd: join(V3, ".."), stdio: "inherit", env: process.env });
  const out = existsSync(join(subDir, "compose.json")) ? JSON.parse(readFileSync(join(subDir, "compose.json"), "utf8")) : null;
  rec.clips[c.n] = { label: sub, route, exit: p.status, wall: Math.round((Date.now() - t0) / 1000), clip: out?.outputs?.clip ? join("..", sub, out.outputs.clip) : null, credits: out?.credits ?? 0, review_pass: out?.attempts?.find((a) => a.key === out?.outputs?.chosen)?.review?.pass ?? null, page: join("..", sub, "index.html") }; save();
  if (!DRY) spawnSync("node", ["V3/compose/page.mjs", sub], { cwd: join(V3, ".."), stdio: "ignore" });
  if (p.status !== 0 && !DRY) { say(`clip ${c.n} failed (exit ${p.status}); stopping`); break; }
}
const done = story.clips.map((c) => rec.clips[c.n]).filter((c) => c?.clip);
if (!DRY && done.length === story.clips.length) { const list = join(dir, "concat.txt"); writeFileSync(list, done.map((c) => `file '${resolve(dir, c.clip)}'`).join("\n")); execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", join(dir, "film.mp4")]); rec.film = "film.mp4"; }
rec.credits = Object.values(rec.clips).reduce((n, c) => n + (c.credits || 0), 0); rec.estimate = rec.routes.reduce((n, r) => n + r.cost, 0); save();
say(`== ${DRY ? `dry: ${rec.estimate} credits for ${story.clips.length} clips` : `done: ${rec.credits} credits`}; ${recFile}`);
