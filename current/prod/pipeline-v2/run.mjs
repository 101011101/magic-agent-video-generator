// Pipeline v2: story → chunks (creative director) → shot list → bible references → cut frames → clips → stitch.
// Litmus rules: one action per clip, no end frames, a continuous shot starts from the real last frame,
// a cut starts from a fresh frame built from the clean bible references (never from the previous frame).
// Usage: node current/prod/pipeline-v2/run.mjs --case p4-lighthouse [--scenes 4] [--label x] [--plan-only]
//   --from <label>        start from a copy of another run (its plan and media); jobs re-run only when their inputs change
//   --relook A,B          rewrite these bible looks with kind and real size (1 LLM call); dependent refs, frames, clips re-run
//   --retake 16:2         take 2 of shot 16's clip (best-of-N by hand)
//   --context             a cut frame transforms the earlier frame with the most wanted elements (same place first) and merges
//                         the missing ones from the frames where they last appeared; only characters get a clean sheet
//   --estimate            print the jobs that would run and their credits; spend nothing
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { REPO } from "../state-manager/src/paths.js";
import { usage } from "../state-manager/src/llm.js";
import { runJob, download, uploadFile } from "../state-manager/src/magichour.js";
import { firstFrame, lastFrame, ssim } from "../state-manager/src/continuity.js";
import { planShots, scenesOf, TEMPLATE } from "./src/shots.js";
import { renderPage } from "./src/page.js";
import { renderText } from "./src/text.js";
import { copyFileSync } from "node:fs";
import { relook, fixtures } from "./src/relook.js";
import { checkFrame, checkCarry } from "./src/vision.js";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const caseId = opt("--case", "p4-lighthouse"), maxScenes = Number(opt("--scenes", 0)), label = opt("--label", "v1");
const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
const VIDEO = { model: "wan-3.0", resolution: "720p", audio: false };

const c = JSON.parse(readFileSync(join(REPO, "current/tests/state-manager/cases.json"), "utf8")).cases.find((x) => x.id === caseId);
const read = (p) => readFileSync(join(REPO, p), "utf8");
const story = read(c.story_path), chunks = read(c.chunks_path);
const runDir = join(REPO, "current/tests/pipeline-v2/runs", `${caseId}-${label}`);
const from = opt("--from", null), estimate = args.includes("--estimate"), CONTEXT = args.includes("--context");
const relookNames = opt("--relook", "").split(",").filter(Boolean);
const takes = Object.fromEntries(opt("--retake", "").split(",").filter(Boolean).map((t) => t.split(":")).map(([id, n]) => [id, Number(n)]));
if (from && !existsSync(join(runDir, "run.json"))) {
  cpSync(join(REPO, "current/tests/pipeline-v2/runs", `${caseId}-${from}`), runDir, { recursive: true });
  for (const f of ["final.mp4", "index.html"]) rmSync(join(runDir, f), { force: true });
}
mkdirSync(join(runDir, "refs"), { recursive: true });
// Uploads: the case gives a text description only. Until a real asset pack exists, a stand-in photo is generated once per case
// (shared folder, so other systems in the benchmark get the same file) and used exactly like a real upload.
const uploadDir = join(REPO, "current/tests/pipeline-v2/uploads", caseId);
const uploads = c.uploads && !/^none/i.test(c.uploads.trim()) ? ["u1"] : [];
if (uploads.length && !existsSync(join(uploadDir, "u1.png")) && !args.includes("--estimate")) {
  mkdirSync(uploadDir, { recursive: true });
  const body = { name: `${caseId} stand-in upload`, image_count: 1, ...IMAGE, style: { prompt: `An ordinary real photograph, as a user would upload it: ${c.uploads}` } };
  const r = await runJob("/v1/ai-image-generator", body, "image");
  await download(r.downloads[0], join(uploadDir, "u1.png"));
  writeFileSync(join(uploadDir, "u1.json"), JSON.stringify({ standin: true, description: c.uploads, request: body, credits: r.credits }, null, 2));
  console.log(`  stand-in upload u1: ${r.credits} credits`);
}
mkdirSync(join(runDir, "uploads"), { recursive: true });
for (const u of uploads) if (existsSync(join(uploadDir, `${u}.png`))) copyFileSync(join(uploadDir, `${u}.png`), join(runDir, `uploads/${u}.png`));
const logPath = join(runDir, "run.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { case: c, template: TEMPLATE, models: { IMAGE, VIDEO }, jobs: {} };
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));

// 1. Shot list (one LLM call, cached).
console.log(`${caseId}: planning shots…`);
// A run keeps its plan (so --from and re-runs reuse it); a new run plans.
const plan = log.plan || await planShots({ request: c.request, uploads: c.uploads, story, chunks });
if (from) log.from = log.from || from;
if (relookNames.length) {
  const looks = await relook({ bible: plan.bible, names: relookNames, story });
  log.relooks = { ...(log.relooks || {}) };
  for (const l of looks) { const b = plan.bible.find((x) => x.name === l.name); if (!log.relooks[l.name]) log.relooks[l.name] = { before: b.look }; log.relooks[l.name].after = l.look; b.look = l.look; }
}
const allScenes = scenesOf(plan.shots);
const scenes = maxScenes ? allScenes.slice(0, maxScenes) : allScenes;
Object.assign(log, { story, chunks, plan, scenes: scenes.map((s) => s.map((x) => x.id)) });
save();
console.log(`  ${plan.shots.length} shots in ${allScenes.length} scenes; running ${scenes.length} scenes (${scenes.flat().length} clips)`);
if (args.includes("--plan-only")) { writeFileSync(join(runDir, "index.html"), renderPage(log, runDir)); process.exit(0); }

// A job's signature = its prompt and settings + the content hashes of its input files.
// It re-runs only when the signature changes. Old jobs without a signature get one from their stored request.
const hashes = {};
const fileHash = (f) => (hashes[f] ??= existsSync(join(runDir, f)) ? createHash("sha256").update(readFileSync(join(runDir, f))).digest("hex").slice(0, 16) : "missing");
const sigOf = (spec, inputs) => createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map(fileHash) })).digest("hex").slice(0, 16);
for (const [key, j] of Object.entries(log.jobs)) {
  if (j.sig) continue;
  const p = j.request?.style?.prompt;
  if (key.startsWith("ref:")) j.sig = sigOf({ prompt: p }, []);
  if (key.startsWith("frame:")) j.sig = sigOf({ prompt: p }, (j.refs || []).map((n) => `refs/${n}.png`));
  if (key.startsWith("clip:")) j.sig = sigOf({ prompt: p, seconds: j.request.end_seconds, take: 1 }, [j.start]);
}
const dirty = new Set(), COST = { image: 200, video: 96 };
let estimated = 0;
async function job(key, file, spec, inputs, fn) {
  const fresh = !inputs.some((f) => dirty.has(f));
  const sig = sigOf(spec, inputs);
  if (fresh && existsSync(join(runDir, file)) && log.jobs[key]?.sig === sig) return file;
  if (estimate) {
    const credits = key.startsWith("clip:") ? COST.video * spec.seconds : COST.image;
    estimated += credits; dirty.add(file); console.log(`  would run ${key} (${credits})`);
    return file;
  }
  const t = await fn();
  delete hashes[file];
  log.jobs[key] = { ...t, output: file, sig: sigOf(spec, inputs) }; save();
  console.log(`  ${key}: ${t.credits} credits, ${t.seconds}s`);
  return file;
}
const upCache = {};
const up = async (file) => (upCache[file] ??= uploadFile(join(runDir, file), "image"));

// 2. Bible references: every character, prop and location seen in 2+ scenes of this run gets one clean image.
// Fixtures (props fixed to one location, 1 LLM call) are drawn into their location's plate instead.
const byName = Object.fromEntries(plan.bible.map((b) => [b.name, b]));
log.fixtures = await fixtures({ bible: plan.bible, story });
const fixturesOf = (loc) => Object.keys(log.fixtures).filter((n) => log.fixtures[n] === loc && byName[n]);
const sceneCount = {};
for (const s of scenes) for (const n of new Set([s[0].location, ...s.flatMap((x) => x.visible)])) sceneCount[n] = (sceneCount[n] || 0) + 1;
// An entity shown by an upload always uses the upload as its reference.
const refNames = Object.keys(sceneCount).filter((n) => byName[n] && (byName[n].upload || sceneCount[n] >= 2) && !log.fixtures[n]
  && (!CONTEXT || byName[n].upload || byName[n].kind === "character"));
for (const n of refNames) if (byName[n].upload) copyFileSync(join(runDir, `uploads/${byName[n].upload}.png`), join(runDir, `refs/${n}.png`));
const refPrompt = (b) => b.kind === "character"
  ? `${plan.style}. Character reference sheet of ${b.name}: ${b.look}. Full body, front view, standing, neutral pose, plain light grey background, even soft light.`
  : b.kind === "prop" ? `${plan.style}. Object reference of ${b.name}: ${b.look}. Centred, large in frame, plain light grey background, even soft light.`
  : `${plan.style}. Location plate of ${b.name}: ${b.look}.${fixturesOf(b.name).map((n) => ` It contains ${n}: ${byName[n].look}`).join("")} Wide establishing view, empty, no people.`;
await Promise.all(refNames.filter((n) => !byName[n].upload).map((n) => job(`ref:${n}`, `refs/${n}.png`, { prompt: refPrompt(byName[n]) }, [], async () => {
  const body = { name: `${caseId} ref ${n}`, image_count: 1, ...IMAGE, style: { prompt: refPrompt(byName[n]) } };
  const r = await runJob("/v1/ai-image-generator", body, "image");
  await download(r.downloads[0], join(runDir, `refs/${n}.png`));
  return { endpoint: "/v1/ai-image-generator", request: body, credits: r.credits, seconds: r.seconds };
})));

// 3. Scenes in parallel; shots inside a scene in order.
function framePrompt(shot, refs) {
  // A relooked entry carries its corrected look (kind and real size) into the frame prompt.
  const list = refs.map((n, i) => `image ${i + 1} = ${n} (${byName[n].kind}${log.relooks?.[n] ? `: ${byName[n].look} Draw it at this real size` : ""})`).join("; ");
  return `${plan.style}. 16:9 film frame. ${shot.start_frame}` + (refs.length
    ? `\nReference images: ${list}. Keep each character's identity, face, hair and clothing and each prop's shape and colour exactly as in its reference; take the location's architecture and landscape from its plate. Do not copy the reference poses, framing or grey backgrounds.` : "");
}
// Context sources, computed from the plan: for each scene's cut frame, the earlier shot whose last frame is the base
// (same location first, then most wanted elements, then most recent) and the shots that supply missing elements.
const order = scenes.flat();
function sourcesOf(k) {
  const shot = scenes[k][0], earlier = scenes.slice(0, k).flat(), wanted = shot.visible.filter((n) => byName[n]);
  let base = null, best = 0;
  earlier.forEach((c, i) => {
    const score = (c.location === shot.location ? 100 : 0) + 10 * wanted.filter((n) => c.visible.includes(n)).length + i / 1000;
    if (score >= 10 && score > best) { best = score; base = c; }
  });
  const missing = wanted.filter((n) => !base?.visible.includes(n));
  const merge = [];
  for (const n of missing) { const c = [...earlier].reverse().find((x) => x.visible.includes(n)); if (c && c !== base) merge.push({ name: n, shot: c }); }
  const files = [...new Set(merge.map((m) => m.shot.id))].slice(0, 3);
  const fresh = missing.filter((n) => !merge.some((m) => m.name === n));
  return { base, merge: files.map((id) => ({ id, names: merge.filter((m) => m.shot.id === id).map((m) => m.name) })), fresh };
}
const sceneOfShot = Object.fromEntries(scenes.flatMap((sc, k) => sc.map((x) => [x.id, k])));
async function contextFrame(shot, k) {
  const src = sourcesOf(k), sheets = shot.visible.filter((n) => refNames.includes(n));
  const inputs = [...(src.base ? [`${src.base.id}-last.png`] : []), ...src.merge.map((m) => `${m.id}-last.png`), ...sheets.map((n) => `refs/${n}.png`)];
  let i = src.base ? 2 : 1;
  const lines = [];
  if (src.base) lines.push(src.base.location === shot.location
    ? `Image 1 is an earlier frame of this same place. Transform it into the new shot. Keep the place, its objects and the real size of everything as in image 1; change only framing, positions, poses, light and time as described.`
    : `Image 1 is an earlier frame that shows ${src.base.visible.filter((n) => shot.visible.includes(n)).join(", ")}. Transform it into the new shot in a new place, ${shot.location}: ${byName[shot.location]?.look || ""} Keep those elements and their real size relative to each other as in image 1; replace the place.`);
  for (const m of src.merge) lines.push(`Image ${i++} is an earlier frame showing ${m.names.join(", ")}: take their look and real size from it and merge them into the new shot; do not copy its framing.`);
  for (const n of sheets) lines.push(`Image ${i++} is the character sheet of ${n}: identity only (face, hair, clothing).`);
  for (const n of src.fresh) lines.push(`New in this shot: ${n}: ${byName[n].look}`);
  const prompt = `${plan.style}. 16:9 film frame. One single frame, not a grid or collage. New shot: ${shot.start_frame}\n${lines.join("\n")}`;
  const want = [...new Set([...shot.visible, ...fixturesOf(shot.location)])].filter((n) => byName[n]).map((n) => byName[n]);
  return job(`frame:${shot.id}`, `${shot.id}-start.png`, { prompt }, inputs, async () => {
    const endpoint = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
    const body = { name: `${caseId} ${shot.id}`, image_count: 1, ...IMAGE, style: { prompt }, ...(inputs.length ? { assets: { image_file_paths: await Promise.all(inputs.map(up)) } } : {}) };
    let credits = 0, seconds = 0; const checks = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const r = await runJob(endpoint, { ...body, name: `${body.name} a${attempt}` }, "image");
      await download(r.downloads[0], join(runDir, `${shot.id}-start.png`));
      credits += r.credits; seconds += r.seconds;
      const check = want.length ? await checkFrame(join(runDir, `${shot.id}-start.png`), want) : { ok: true, problem: "" };
      checks.push(check);
      if (check.ok) break;
      console.log(`  frame:${shot.id} failed check: ${check.problem}`);
    }
    return { endpoint, refs: sheets, context: { base: src.base?.id || null, merge: src.merge, fresh: src.fresh }, inputs, request: body, checks, credits, seconds };
  });
}
async function runScene(scene, k) {
  let start = null;
  for (const [i, shot] of scene.entries()) {
    if (i === 0 && shot.start_upload) {
      // The upload itself is the first frame ("animate this photo").
      copyFileSync(join(runDir, `uploads/${shot.start_upload}.png`), join(runDir, `${shot.id}-start.png`));
      start = `${shot.id}-start.png`;
    } else if (i === 0 && CONTEXT) {
      start = await contextFrame(shot, k);
    } else if (i === 0) {
      const refs = [...shot.visible, shot.location].filter((n) => refNames.includes(n));
      start = await job(`frame:${shot.id}`, `${shot.id}-start.png`, { prompt: framePrompt(shot, refs) }, refs.map((n) => `refs/${n}.png`), async () => {
        const prompt = framePrompt(shot, refs);
        const body = refs.length
          ? { name: `${caseId} ${shot.id}`, image_count: 1, ...IMAGE, style: { prompt }, assets: { image_file_paths: await Promise.all(refs.map((n) => up(`refs/${n}.png`))) } }
          : { name: `${caseId} ${shot.id}`, image_count: 1, ...IMAGE, style: { prompt } };
        const endpoint = refs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
        // Gate: every visible entity present, each character once; one retry.
        const want = [...new Set([...shot.visible, ...fixturesOf(shot.location)])].filter((n) => byName[n]).map((n) => byName[n]);
        let credits = 0, seconds = 0; const checks = [];
        for (let attempt = 1; attempt <= 2; attempt++) {
          const r = await runJob(endpoint, { ...body, name: `${body.name} a${attempt}` }, "image");
          await download(r.downloads[0], join(runDir, `${shot.id}-start.png`));
          credits += r.credits; seconds += r.seconds;
          const check = want.length ? await checkFrame(join(runDir, `${shot.id}-start.png`), want) : { ok: true, problem: "" };
          checks.push(check);
          if (check.ok) break;
          console.log(`  frame:${shot.id} failed check: ${check.problem}`);
        }
        return { endpoint, refs, request: body, checks, credits, seconds };
      });
    }
    // Gate for continuous shots: the characters the action needs must be in the real last frame. If not, repair the frame from the references.
    const chars = shot.visible.filter((n) => byName[n]?.kind === "character");
    if (i > 0 && chars.length && !estimate) {
      const carry = await checkCarry(join(runDir, start), chars.map((n) => byName[n]), shot.action);
      log.carry = { ...(log.carry || {}), [shot.id]: carry };
      if (carry.missing.length) {
        const refs = chars.filter((n) => refNames.includes(n)), prev = start;
        const prompt = `${plan.style}. 16:9 film frame. Image 1 is the current frame: keep its place, camera, light and every object exactly. ${carry.start_frame}` +
          (refs.length ? `\nReference images: ${refs.map((n, k) => `image ${k + 2} = ${n} (character)`).join("; ")}. Keep each character's identity, face, hair and clothing exactly as in its reference. Do not copy the reference poses or grey backgrounds.` : "");
        start = await job(`repair:${shot.id}`, `${shot.id}-start.png`, { prompt }, [prev, ...refs.map((n) => `refs/${n}.png`)], async () => {
          const body = { name: `${caseId} ${shot.id} repair`, image_count: 1, ...IMAGE, style: { prompt }, assets: { image_file_paths: [await up(prev), ...(await Promise.all(refs.map((n) => up(`refs/${n}.png`))))] } };
          const r = await runJob("/v1/ai-image-editor", body, "image");
          await download(r.downloads[0], join(runDir, `${shot.id}-start.png`));
          return { endpoint: "/v1/ai-image-editor", repaired_from: prev, missing: carry.missing, request: body, credits: r.credits, seconds: r.seconds };
        });
        console.log(`  ${shot.id}: ${carry.missing.join(", ")} missing from the last frame → repaired start frame`);
      }
    }
    const take = takes[shot.id] || 1;
    const clip = await job(`clip:${shot.id}`, `${shot.id}.mp4`, { prompt: `${shot.action} ${shot.camera}`, seconds: shot.seconds, take }, [start], async () => {
      const body = { name: `${caseId} ${shot.id}`, ...VIDEO, end_seconds: shot.seconds, style: { prompt: `${shot.action} ${shot.camera}` }, assets: { image_file_path: await up(start) } };
      const r = await runJob("/v1/image-to-video", body, "video", { timeoutS: 2700 });
      await download(r.downloads[0], join(runDir, `${shot.id}.mp4`));
      return { endpoint: "/v1/image-to-video", start, take, request: body, credits: r.credits, seconds: r.seconds };
    });
    if (estimate) { if (dirty.has(clip)) dirty.add(`${shot.id}-last.png`); start = `${shot.id}-last.png`; continue; }
    firstFrame(join(runDir, clip), join(runDir, `${shot.id}-first.png`));
    lastFrame(join(runDir, clip), join(runDir, `${shot.id}-last.png`));
    delete hashes[`${shot.id}-first.png`]; delete hashes[`${shot.id}-last.png`];
    start = `${shot.id}-last.png`; // the next continuous shot starts from the real last frame
  }
}
// Context mode: a scene waits only for the scenes its sources come from.
const running = [];
scenes.forEach((sc, k) => {
  const deps = CONTEXT ? (() => { const src = sourcesOf(k); return [...new Set([src.base?.id, ...src.merge.map((m) => m.id)].filter(Boolean).map((id) => sceneOfShot[id]))]; })() : [];
  running[k] = Promise.all(deps.map((d) => running[d])).then(() => runScene(sc, k));
});
const results = await Promise.allSettled(running);
if (estimate) { console.log(`estimate: ${estimated} credits`); process.exit(0); }
log.errors = results.map((r, i) => r.status === "rejected" && { scene: i + 1, error: String(r.reason) }).filter(Boolean);
save();

// 4. Stitch: native 30 fps, exact 1280×720, hard joins, no trims.
const ids = scenes.flat().map((s) => s.id).filter((id) => existsSync(join(runDir, `${id}.mp4`)));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...ids.flatMap((id) => ["-i", join(runDir, `${id}.mp4`)]), "-filter_complex",
  ids.map((_, i) => `[${i}:v]scale=1280:720:flags=lanczos,setsar=1,fps=30,format=yuv420p[v${i}]`).join(";") + ";" + ids.map((_, i) => `[v${i}]`).join("") + `concat=n=${ids.length}:v=1:a=0[v]`,
  "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(runDir, plan.layers?.length ? "picture.mp4" : "final.mp4")]);
// Text layers: exact text rendered to transparent PNGs, overlaid with a short fade.
if (plan.layers?.length) {
  // Text colour follows the background: mean brightness of the picture under the layer, at its midpoint.
  const luma = (t) => Number((spawnSync("ffmpeg", ["-ss", String(t), "-i", join(runDir, "picture.mp4"), "-frames:v", "1", "-vf", "format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/YAVG=([\d.]+)/) || [])[1] || 0);
  const pngs = plan.layers.map((l, k) => renderText(l, join(runDir, `text-${k + 1}.html`), join(runDir, `text-${k + 1}.png`), { dark: luma((l.start_s + l.end_s) / 2) > 150 }));
  const chain = plan.layers.map((l, k) => `[${k + 1}:v]format=rgba,fade=t=in:st=${l.start_s}:d=0.4:alpha=1,fade=t=out:st=${Math.max(l.start_s, l.end_s - 0.4)}:d=0.4:alpha=1[t${k}];[${k === 0 ? "0:v" : `o${k - 1}`}][t${k}]overlay=0:0:shortest=1:enable='between(t,${l.start_s},${l.end_s})'${k === plan.layers.length - 1 ? "[v]" : `[o${k}]`}`).join(";");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(runDir, "picture.mp4"), ...pngs.flatMap((p) => ["-loop", "1", "-i", p]), "-filter_complex", chain,
    "-map", "[v]", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(runDir, "final.mp4")]);
}
for (const id of ids) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(runDir, `${id}.mp4`), "-vf", "fps=2,scale=320:-2,tile=5x2", "-frames:v", "1", join(runDir, `${id}-strip.jpg`)]);

// 5. Measures: start-frame match per clip, seam similarity and frame jump at each join (normal motion ≈ median jump).
const shotById = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
const diffs = spawnSync("ffmpeg", ["-i", join(runDir, "final.mp4"), "-vf", "scale=320:180,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const d = [...String(diffs).matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const sorted = [...d].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] || 0;
const frames = ids.map((id) => Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", join(runDir, `${id}.mp4`)]).toString().trim()));
let at = 0;
log.measures = { median_jump: Number(median.toFixed(2)), joins: [], clips: {} };
for (const [i, id] of ids.entries()) {
  const startFile = log.jobs[`clip:${id}`].start;
  log.measures.clips[id] = { first_vs_start: ssim(join(runDir, `${id}-first.png`), join(runDir, startFile), { fit: true }), frames: frames[i] };
  at += frames[i];
  if (i < ids.length - 1) log.measures.joins.push({ from: id, to: ids[i + 1], link: shotById[ids[i + 1]].link,
    seam_ssim: ssim(join(runDir, `${id}-last.png`), join(runDir, `${ids[i + 1]}-first.png`)), jump: Number((d[at - 1] ?? 0).toFixed(1)) });
}
log.total_credits = Object.values(log.jobs).reduce((n, j) => n + (j.credits || 0), 0);
log.llm = usage;
save();
writeFileSync(join(runDir, "index.html"), renderPage(log, runDir));
console.log(JSON.stringify({ credits: log.total_credits, errors: log.errors, measures: log.measures }, null, 1));
console.log(`page: ${join(runDir, "index.html")}`);
