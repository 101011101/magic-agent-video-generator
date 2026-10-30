// Seedream test: one scene, three kinds of call.
//   1. script  (LLM)    a very short action scene in 2 clips; every physical thing it names gets an id and a spec; a presence
//                       table says which ids are in which clip and what each clip must show; a video prompt per clip using @ids.
//   2. sheets  (image)  one reference sheet per element, made before any clip.
//   3. clips   (video)  text-to-video (seedance-2.0) per clip, references = that clip's elements only; clip 2 also gets clip 1's
//                       hand-off frame as @last_frame.
// Usage: node seedream-test/run.mjs --label <name> [--step script|sheets|clips|all] [--model seedance-2.0] [--res 480p] [--seconds 8]
// Resumable: anything already in runs/<label>/run.json is reused. Does not touch V1/ (imports only).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../V1/src/llm.js";
import { runJob, download, upload } from "../V1/src/magichour.js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const label = arg("label", "t1"), step = arg("step", "all");
const VIDEO = { model: arg("model", "seedance-2.0"), resolution: arg("res", "480p"), aspect_ratio: "16:9", audio: false }, SECONDS = Number(arg("seconds", 8));
const DIR = join(dirname(fileURLToPath(import.meta.url)), "runs", label); mkdirSync(DIR, { recursive: true });
const RUN = join(DIR, "run.json"), run = existsSync(RUN) ? JSON.parse(readFileSync(RUN, "utf8")) : { label, video: VIDEO, seconds: SECONDS, jobs: [] };
const save = () => writeFileSync(RUN, JSON.stringify(run, null, 2));
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const STYLE = "Live-action photograph, cinema camera, 35mm film look, natural light, light film grain";

// ---- 1. script -------------------------------------------------------------------------------------------------------
const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const SCRIPT = S.obj({
  title: S.str,
  script: S.str,
  elements: S.arr(S.obj({ id: ID, kind: S.enum(["character", "prop", "place"]), name: S.str, spec: S.str })),
  clips: S.arr(S.obj({
    n: S.int, text: S.str,
    present: S.arr(ID), introduced: S.arr(ID),
    must_show: S.arr(S.str),
    end_state: S.str,
    prompt: S.str,
  })),
});
if (!run.script && ["script", "all"].includes(step)) {
  console.log("1. script …");
  run.script = await jsonCall({ name: "seedream-script", schema: SCRIPT, effort: "high", prompt: `Write a very short, physical, action-heavy live-action scene for a 1930s pulp-adventure film, played by ONE original fictional
adventurer who must not resemble any real actor (say so in the spec, and give him distinct features). Exactly two clips of ${SECONDS} seconds
each, back to back in real time, one continuous scene. The scene must contain ALL of these so we can test continuity:
- a thing REVEALED TWICE: first it emerges from somewhere (out of the ground, out of a wall, out of water), he pockets it in a
  pouch or satchel, and later in clip 2 he takes it OUT of the pouch and we see it again;
- the adventurer gets BURIED or pinned (rubble, sand, a collapsing floor) and digs or pulls himself free;
- a TRANSITION BETWEEN TWO ROOMS or spaces through a doorway, passage or gap, so clip 2 ends in a different place than clip 1 starts;
- the adventurer stays IN FRAME at the very end of clip 1 (the last frame of clip 1 is the first frame of clip 2, so he must be
  visible there, mid-action).
Rules for elements: every PHYSICAL thing the script names (the adventurer, each prop, each room or place, parts like a stone
door) gets an id. Only drawable things (no dust, sound, light, feelings). At most 8 elements. For each, spec = 2-4 sentences a
painter can follow exactly: for the character, face, skin, hair, build, every garment with colour, the satchel; for a prop, shape,
material, colour, size in hands; for a place, the walls, floor, light sources, fixed furniture, the doorway. Describe the START
look only (never a later state).
script: the scene in plain prose, 120-180 words, with a blank line between clip 1 and clip 2, naming elements by their names.
clips: for each clip: present = every element id visible at any point in it; introduced = ids seen for the first time in this
clip; must_show = 3-5 checkable facts a viewer can verify (e.g. "the idol rises out of the sand", "he is buried to the chest");
end_state = one sentence of where everyone and everything is at the last frame; prompt = the video-generation prompt for this
clip, 80-140 words, present tense, concrete physical action in order, fixed or slowly moving camera, naming every element with
@id (e.g. "@hero drags @idol from the sand and pushes it into @satchel"). Clip 2's prompt must begin by saying that it starts
exactly from @last_frame (the last frame of clip 1) and continue the action without a cut.
Style of the film: ${STYLE}.` });
  save();
}
if (!run.script) { console.log("no script yet"); process.exit(0); }
console.log(`script: "${run.script.title}", ${run.script.elements.length} elements, ${run.script.clips.length} clips`);

// ---- 2. sheets -------------------------------------------------------------------------------------------------------
const sheetPrompt = (e) => e.kind === "place"
  ? `${STYLE}. An empty location plate: ${e.name}. ${e.spec} Wide shot from a fixed camera at eye height, no people, no animals, no text.`
  : `${STYLE}. Reference sheet of ONE ${e.kind === "prop" ? "object" : "character"}: ${e.name}. ${e.spec}
${e.kind === "prop" ? "The object alone, centred, whole, seen slightly from above." : "Full body, front view, standing in a neutral pose, arms relaxed, whole figure visible head to feet."}
Plain light-grey backdrop (seamless studio paper) and nothing else: no scenery, no other people or objects, no frame or border, no text or labels.`;
run.sheets ??= {};
if (["sheets", "all"].includes(step)) {
  for (const e of run.script.elements) {
    if (run.sheets[e.id]) continue;
    const file = `sheet-${e.id}.png`, body = { name: `${label} sheet ${e.id}`, image_count: 1, model: "nano-banana-pro", resolution: "2k", aspect_ratio: e.kind === "place" ? "16:9" : "1:1", style: { prompt: sheetPrompt(e) } };
    console.log(`2. sheet ${e.id} …`);
    const r = await runJob("/v1/ai-image-generator", body, { kind: "image" });
    await download(r.url, join(DIR, file));
    run.sheets[e.id] = { file, prompt: body.style.prompt, credits: r.credits, wall_seconds: r.seconds }; run.jobs.push({ step: "sheet", id: e.id, credits: r.credits }); save();
  }
}

// ---- 3. clips --------------------------------------------------------------------------------------------------------
run.clips ??= {};
if (["clips", "all"].includes(step)) {
  const uploaded = {};
  const up = async (file) => (uploaded[file] ??= await upload(join(DIR, file)));
  for (const c of run.script.clips) {
    if (run.clips[c.n]) continue;
    const missing = c.present.filter((id) => !run.sheets[id]);
    if (missing.length) throw new Error(`clip ${c.n}: no sheet for ${missing.join(", ")}`);
    const refs = [];
    for (const id of c.present) refs.push({ name: id.replace(/-/g, "_"), file_path: await up(run.sheets[id].file) });
    // The prompt may only reference what the presence table says is in this clip (the API rejects an @name with no reference).
    // Any other @id becomes the element's plain name; @last_frame is allowed from clip 2 on.
    const demoted = [];
    let prompt = c.prompt.replace(/@([a-z0-9_-]+)/g, (m, id) => {
      if (id === "last_frame" && c.n > 1) return m;
      if (c.present.includes(id)) return `@${id.replace(/-/g, "_")}`;
      demoted.push(id); return (run.script.elements.find((e) => e.id === id)?.name || id).toLowerCase();
    });
    if (demoted.length) console.log(`   clip ${c.n}: not in its column, named in plain words: ${demoted.join(", ")}`);
    if (c.n > 1) {
      const prev = run.clips[c.n - 1];
      if (!prev) throw new Error(`clip ${c.n}: clip ${c.n - 1} missing`);
      // The hand-off frame goes up as a 1280x720 JPEG (a 478-px-high PNG straight from the clip failed with invalid_input).
      const ref = prev.last.replace(/\.png$/, "-ref.jpg");
      if (!existsSync(join(DIR, ref))) ff(["-i", join(DIR, prev.last), "-vf", "scale=1280:720", "-q:v", "2", join(DIR, ref)]);
      refs.push({ name: "last_frame", file_path: await up(ref) });
    }
    if (refs.length > 10) throw new Error(`clip ${c.n}: ${refs.length} references, max 10`);
    const body = { name: `${label} clip ${c.n}`, ...VIDEO, end_seconds: SECONDS, style: { prompt }, references: refs };
    console.log(`3. clip ${c.n}: ${VIDEO.model} ${VIDEO.resolution} ${SECONDS}s, ${refs.length} references (${refs.map((r) => r.name).join(", ")}) …`);
    const r = await runJob("/v1/text-to-video", body, { kind: "video" });
    const file = `clip${c.n}.mp4`; await download(r.url, join(DIR, file));
    const N = Number(JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames,width,height", "-of", "json", join(DIR, file)]).toString()).streams[0].nb_read_frames);
    ff(["-i", join(DIR, file), "-frames:v", "1", join(DIR, `clip${c.n}-first.png`)]);
    ff(["-i", join(DIR, file), "-vf", `select=eq(n\\,${N - 3})`, "-fps_mode", "passthrough", "-frames:v", "1", join(DIR, `clip${c.n}-last.png`)]);
    ff(["-i", join(DIR, file), "-vf", `fps=2,scale=480:-2,tile=4x${Math.ceil(SECONDS * 2 / 4)}`, "-frames:v", "1", join(DIR, `clip${c.n}-strip.jpg`)]);
    run.clips[c.n] = { file, last: `clip${c.n}-last.png`, request: body, demoted, references: refs.map((r) => r.name), credits: r.credits, wall_seconds: r.seconds, frames: N, handoff_frame: N - 3 };
    run.jobs.push({ step: "clip", id: c.n, credits: r.credits }); save();
  }
  const clips = run.script.clips.map((c) => run.clips[c.n]).filter(Boolean);
  if (clips.length === run.script.clips.length) ff([...clips.flatMap((c) => ["-i", join(DIR, c.file)]), "-filter_complex", `${clips.map((_, i) => `[${i}:v]`).join("")}concat=n=${clips.length}:v=1:a=0[v]`, "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", join(DIR, "joined.mp4")]);
}
run.total_credits = run.jobs.reduce((n, j) => n + (j.credits || 0), 0); save();
console.log(`done: ${run.total_credits} credits`);
