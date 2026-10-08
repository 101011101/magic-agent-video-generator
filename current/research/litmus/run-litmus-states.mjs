// Litmus D: a scene-state document with @labels drives the frames. 45 s = 9 scenes of 5 s.
// Labels → one clean reference each. Cut: fresh start frame from references. Every scene: generated end frame
// (edit of its start frame + labelled references), wan-3.0 start+end clip, last 3 frames trimmed (end snap),
// a continuous scene starts from the real trimmed last frame. Native 30 fps stitch.
// --context (test E): a label seen before is taken from the last real frame that showed it (scale and context), not from an
// isolated reference. A cut to a place seen before transforms that place's last frame. Only characters get a clean sheet
// (identity anchor). Scenes run in order.
//   Since F/G: the context rule picks, for each cut, the VERIFIED earlier frame with the most wanted labels (same location
//   first, then most labels, then most recent) and transforms it; missing labels are merged from their last verified frame.
//   A frame enters the history only with the labels a vision check confirms in it ("last known stable" asset).
// --chain generated (test F): the next scene starts from the previous GENERATED end frame, not the video's last frame.
//   The image chain runs first; then all clips run in parallel; clips are not trimmed.
// --typed: typed scene-state doc (v8: atoms per asset, part_of) + the state store (prod/pipeline-v2/src/state.js): every
//   frame is recorded with observed typed attributes, a pairwise same-asset check against the last stable instance, and
//   source pointers. Cuts pick their base with store.rank; an unstable frame is retried once with its differences.
//   Writes state.json and state.html (asset lineage).
// --test X · --request "…" (story = request) · --seconds N --count K · --doc-from test-E (reuse that doc)
// Usage: node current/research/litmus/run-litmus-states.mjs [--context] [--chain generated] [--test F] [--doc-only]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { REPO } from "../../prod/state-manager/src/paths.js";
import { jsonCall } from "../../prod/state-manager/src/llm.js";
import { runJob, download, uploadFile } from "../../prod/state-manager/src/magichour.js";
import { firstFrame, lastFrame, ssim } from "../../prod/state-manager/src/continuity.js";
import { checkFrame } from "../../prod/pipeline-v2/src/vision.js";
import { StateStore, ATOMS } from "../../prod/pipeline-v2/src/state.js";
import { renderState } from "../../prod/pipeline-v2/src/state-page.js";
import { copyFileSync, rmSync } from "node:fs";

const argv = process.argv.slice(2), opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const TYPED = argv.includes("--typed"), CONTEXT = TYPED || argv.includes("--context"), GENERATED = opt("--chain", "real") === "generated";
const TEST = opt("--test", CONTEXT ? "E" : "D"), REQUEST = opt("--request", null), DOC_FROM = opt("--doc-from", null);
const SECONDS = opt("--seconds", "45"), COUNT = opt("--count", "9");
const DIR = dirname(fileURLToPath(import.meta.url)), out = join(DIR, `test-${TEST}`);
mkdirSync(join(out, "refs"), { recursive: true });
const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
const VIDEO = { model: "wan-3.0", resolution: "720p", audio: false, end_seconds: 5 };
const TRIM = 3;
const c = JSON.parse(readFileSync(join(REPO, "current/tests/state-manager/cases.json"), "utf8")).cases.find((x) => x.id === "p4-lighthouse");
const request = REQUEST || c.request, story = REQUEST || readFileSync(join(REPO, c.story_path), "utf8");
const logPath = join(out, "result.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { jobs: {} };
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));

// 1. Scene-state document (1 LLM call).
const str = { type: "string" }, labels = { type: "array", items: str };
const typedAssets = { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "attrs"], properties: { label: str,
  attrs: { type: "array", items: { type: "object", additionalProperties: false, required: ["atom", "value"], properties: { atom: { type: "string", enum: ATOMS }, value: str } } } } } };
const state = TYPED ? { type: "object", additionalProperties: false, required: ["visible", "description", "assets"], properties: { visible: labels, description: str, assets: typedAssets } }
  : { type: "object", additionalProperties: false, required: ["visible", "description"], properties: { visible: labels, description: str } };
const schema = { type: "object", additionalProperties: false, required: ["style", "assets", "scenes"], properties: {
  style: str,
  assets: { type: "array", items: TYPED
    ? { type: "object", additionalProperties: false, required: ["label", "kind", "look", "part_of"], properties: { label: str, kind: { type: "string", enum: ["character", "prop", "location"] }, look: str, part_of: { type: ["string", "null"] } } }
    : { type: "object", additionalProperties: false, required: ["label", "kind", "look"], properties: { label: str, kind: { type: "string", enum: ["character", "prop", "location"] }, look: str } } },
  scenes: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "link", "location", "start", "action", "camera", "end", "same_as"], properties: {
    n: { type: "integer" }, link: { type: "string", enum: ["cut", "continuous"] }, location: str, start: state, action: str, camera: str,
    end: { type: "object", additionalProperties: false, required: TYPED ? ["visible", "changes", "description", "assets"] : ["visible", "changes", "description"], properties: { visible: labels, description: str, ...(TYPED ? { assets: typedAssets } : {}),
      changes: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "property", "from", "to"], properties: { label: str, property: str, from: str, to: str } } } } },
    same_as: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "scene"], properties: { label: str, scene: { type: "integer" } } } },
  } } },
} };
const TEMPLATE = TYPED ? "current/tests/creative-director/templates/v8-scene-states-typed.md" : "current/tests/creative-director/templates/v7-scene-states.md";
const prompt = readFileSync(join(REPO, TEMPLATE), "utf8").replace("{{seconds}}", SECONDS).replace("{{count}}", COUNT)
  .replace("{{request}}", () => request).replace("{{story}}", () => story);
const doc = DOC_FROM ? JSON.parse(readFileSync(join(DIR, DOC_FROM, "result.json"), "utf8")).doc : await jsonCall({ name: TYPED ? "scenestatestyped" : "scenestates", schema, prompt, effort: "medium" });
log.request = request; log.mode = { context: CONTEXT, chain: GENERATED ? "generated end frames" : "real last frames", doc_from: DOC_FROM };
doc.scenes[0].link = "cut";
Object.assign(log, { template: TEMPLATE, doc }); save();
writeFileSync(join(out, "scene-states.md"), [`# Scene states (test ${TEST})\n\n**Request:** ${request}\n\n**Style:** ${doc.style}\n\n**Assets:**`, ...doc.assets.map((a) => `- ${a.label} (${a.kind}): ${a.look}`),
  ...doc.scenes.map((s) => `\n## Scene ${s.n} · ${s.link} · ${s.location}\n- Start (${s.start.visible.join(", ")}): ${s.start.description}\n- Action: ${s.action} ${s.camera}\n- Changes: ${s.end.changes.map((x) => `${x.label} ${x.property}: ${x.from} → ${x.to}`).join("; ")}\n- End (${s.end.visible.join(", ")}): ${s.end.description}\n- Same as: ${s.same_as.map((x) => `${x.label} ← scene ${x.scene || "new"}`).join(", ")}`)].join("\n"));
console.log(`doc: ${doc.assets.length} assets, ${doc.scenes.length} scenes`);
if (process.argv.includes("--doc-only")) process.exit(0);

// Jobs run once; the output file is the cache.
async function job(key, file, fn) {
  if (existsSync(join(out, file)) && log.jobs[key]) return file;
  const t = await fn(); log.jobs[key] = { ...t, output: file }; save();
  console.log(`  ${key}: ${t.credits} credits`);
  return file;
}
const up = (f) => uploadFile(join(out, f), "image");
const asset = Object.fromEntries(doc.assets.map((a) => [a.label, a]));
if (TYPED) rmSync(join(out, "state.json"), { force: true }); // rebuilt each run (vision calls are cached)
const store = TYPED ? new StateStore(out, asset) : null;
const typedOf = (st) => Object.fromEntries(st.visible.filter((l) => asset[l]).map((l) => [l, Object.fromEntries((st.assets || []).find((x) => x.label === l)?.attrs?.map((a) => [a.atom, a.value]) || [])]));
const wantText = (st) => (st.assets || []).filter((x) => x.attrs.length).map((x) => `${x.label}: ${x.attrs.map((a) => `${a.atom} = ${a.value}`).join("; ")}`).join("\n");
// Typed mode: record a generated frame; if a wanted asset is not stable, retry once with the differences spelled out.
async function recordFrame({ key, file, scene, role, st, source, regenerate }) {
  let rec = await store.add({ file, scene: scene.n, role, location: scene.location, expected: typedOf(st), source });
  const bad = (r) => Object.entries(r.assets).filter(([, a]) => !a.stable);
  if (bad(rec).length && regenerate) {
    rec.rejected = true; for (const a of Object.values(rec.assets)) a.stable = false;
    const kept = file.replace(".png", "-a1.png"); copyFileSync(join(out, file), join(out, kept)); rec.file = kept; store.save();
    const fix = bad(rec).map(([l, a]) => `${l}: ${!a.present ? "missing" : [...a.diffs, ...Object.entries(a.matches).filter(([, m]) => !m).map(([k]) => `${k} should be ${a.expected?.[k] || "as in its look"} (is: ${a.observed[k]})`)].join("; ")}`).join("\n");
    console.log(`  ${key}: unstable → retry\n${fix}`);
    await regenerate(`\nFix these problems from the previous attempt:\n${fix}`);
    rec = await store.add({ file, scene: scene.n, role, location: scene.location, expected: typedOf(st), source });
  }
  writeFileSync(join(out, "state.html"), renderState(store, `Litmus ${TEST}`));
  return rec;
}

// 2. References: every label seen in 2+ scenes.
const count = {};
for (const s of doc.scenes) for (const l of new Set([s.location, ...s.start.visible, ...s.end.visible])) count[l] = (count[l] || 0) + 1;
const refs = Object.keys(count).filter((l) => asset[l] && count[l] >= 2 && (!CONTEXT || asset[l].kind === "character"));
const fname = (l) => `refs/${l.replace("@", "")}.png`;
await Promise.all(refs.map((l) => job(`ref:${l}`, fname(l), async () => {
  const a = asset[l];
  const p = a.kind === "character" ? `${doc.style}. Character reference of ${l}: ${a.look}. Full body, front view, neutral pose, plain light grey background.`
    : a.kind === "prop" ? `${doc.style}. Object reference of ${l}: ${a.look}. Plain light grey background.` : `${doc.style}. Location plate of ${l}: ${a.look}. Wide view, no people.`;
  const body = { name: `litmus D ref ${l}`, image_count: 1, ...IMAGE, style: { prompt: p } };
  const r = await runJob("/v1/ai-image-generator", body, "image");
  await download(r.downloads[0], join(out, fname(l)));
  return { request: body, credits: r.credits };
})));
const refList = (ls, offset) => ls.map((l, i) => `image ${i + offset} = ${l} (${asset[l].kind})`).join("; ");
const SINGLE = "One single film frame, not a grid, storyboard or collage; no text, timecodes or signatures.";
const keepRule = "Keep each labelled asset's identity, shape, colour and size exactly as in its reference. Do not copy reference poses, framing or grey backgrounds.";

// 3. Scenes: chains of continuous scenes run in order; chains run in parallel.
const chains = [];
for (const s of doc.scenes) (s.link === "cut" ? chains.push([s]) : chains.at(-1).push(s));
async function edit(key, file, text, inputs) {
  return job(key, file, async () => {
    const body = { name: `litmus ${TEST} ${key}`, image_count: 1, ...IMAGE, style: { prompt: text }, assets: { image_file_paths: await Promise.all(inputs.map(up)) } };
    const r = await runJob("/v1/ai-image-editor", body, "image");
    await download(r.downloads[0], join(out, file));
    return { request: body, inputs, credits: r.credits };
  });
}
async function runChain(chain) {
  let start, startRec = null;
  for (const s of chain) {
    const id = `s${s.n}`;
    if (s.link === "cut") {
      const ls = [...new Set([...s.start.visible, s.location])].filter((l) => refs.includes(l));
      const text = `${doc.style}. 16:9 film frame. ${SINGLE} ${s.start.description}` + (ls.length ? `\nReference images: ${refList(ls, 1)}. ${keepRule}` : "");
      if (TYPED) {
        const c = await contextStartTyped(s, id);
        const gen = (extra = "", retry = false) => c.inputs.length ? edit(`start:${id}${retry ? ":retry" : ""}`, `${id}-start.png`, c.prompt + extra, c.inputs)
          : job(`start:${id}${retry ? ":retry" : ""}`, `${id}-start.png`, async () => {
            const body = { name: `litmus ${TEST} start ${id}`, image_count: 1, ...IMAGE, style: { prompt: c.prompt + extra } };
            const r = await runJob("/v1/ai-image-generator", body, "image");
            await download(r.downloads[0], join(out, `${id}-start.png`));
            return { request: body, credits: r.credits };
          });
        start = await gen();
        startRec = await recordFrame({ key: `start:${id}`, file: start, scene: s, role: "start", st: s.start, source: c.source, regenerate: (fix) => gen(fix, true) });
      } else if (CONTEXT) start = await contextStart(s, id);
      else start = ls.length ? await edit(`start:${id}`, `${id}-start.png`, text, ls.map(fname))
        : await job(`start:${id}`, `${id}-start.png`, async () => {
          const body = { name: `litmus D start ${id}`, image_count: 1, ...IMAGE, style: { prompt: text } };
          const r = await runJob("/v1/ai-image-generator", body, "image");
          await download(r.downloads[0], join(out, `${id}-start.png`));
          return { request: body, credits: r.credits };
        });
    }
    // End frame: an edit of the start frame that applies the listed changes.
    const ls = s.end.visible.filter((l) => refs.includes(l));
    const entering = s.end.visible.filter((l) => !s.start.visible.includes(l) && asset[l]);
    const extra = TYPED ? [...new Set(entering.map((l) => store.lastStable(l)?.file).filter(Boolean))]
      : CONTEXT ? [...new Set(s.end.visible.filter((l) => !s.start.visible.includes(l) && lastStable(l)).map((l) => lastStable(l).file))] : [];
    const changes = s.end.changes.map((x) => `${x.label} ${x.property}: ${x.from} → ${x.to}`).join("; ");
    const endText = `${doc.style}. ${SINGLE} Image 1 is the first frame of a 5-second shot. Make its last frame: the same place, camera, framing and light, with only these changes: ${changes}. Last frame: ${s.end.description}` +
      (ls.length ? `\nReference images: ${refList(ls, 2)}. ${keepRule}` : "") +
      (extra.length ? `\nImages ${ls.length + 2}–${ls.length + 1 + extra.length} are earlier frames that show the assets entering this shot; take their look and real size from there.` : "");
    const endFull = endText + (TYPED && wantText(s.end) ? `\nWanted state of each asset in the last frame:\n${wantText(s.end)}` : "");
    const end = await edit(`end:${id}`, `${id}-end.png`, endFull, [start, ...ls.map(fname), ...extra]);
    const endRec = TYPED ? await recordFrame({ key: `end:${id}`, file: end, scene: s, role: "end", st: s.end,
      source: Object.fromEntries(s.end.visible.filter((l) => asset[l]).map((l) => [l, entering.includes(l) ? store.lastStable(l)?.id || null : startRec?.id || null])),
      regenerate: (fix) => edit(`end:${id}:retry`, `${id}-end.png`, endFull + fix, [start, ...ls.map(fname), ...extra]) }) : null;
    const clipStart = start;
    const makeClip = () => job(`clip:${id}`, `${id}.mp4`, async () => {
      const body = { name: `litmus ${TEST} ${id}`, ...VIDEO, style: { prompt: `${s.action} ${s.camera}` }, assets: { image_file_path: await up(clipStart), end_image_file_path: await up(end) } };
      const r = await runJob("/v1/image-to-video", body, "video", { timeoutS: 2700 });
      await download(r.downloads[0], join(out, `${id}.mp4`));
      return { request: body, start: clipStart, end, credits: r.credits };
    });
    if (GENERATED) {
      // F: the next scene starts from this generated end frame; the clip is made later, in parallel.
      pendingClips.push(makeClip().then((clip) => finishClip(id, clip, 0)));
      start = end; startRec = endRec;
      if (!TYPED) await remember(s, end);
      continue;
    }
    const clip = await makeClip();
    // Trim the end snap; the next continuous scene starts from the real last kept frame.
    finishClip(id, clip, TRIM);
    start = `${id}-last.png`;
    if (TYPED) startRec = await store.add({ file: start, scene: s.n, role: "last", location: s.location, expected: typedOf(s.end), source: Object.fromEntries(s.end.visible.filter((l) => asset[l]).map((l) => [l, endRec.id])) });
    else if (CONTEXT) await remember(s, start);
  }
}
const pendingClips = [];
function finishClip(id, clip, trim) {
  const n = frames(join(out, clip));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(out, clip), "-vf", `trim=end_frame=${n - trim},setpts=PTS-STARTPTS,scale=1280:720:flags=lanczos,setsar=1,format=yuv420p`, "-c:v", "libx264", "-crf", "16", join(out, `${id}-trim.mp4`)]);
  firstFrame(join(out, clip), join(out, `${id}-first.png`));
  lastFrame(join(out, clip), join(out, `${id}-last-raw.png`));
  lastFrame(join(out, `${id}-trim.mp4`), join(out, `${id}-last.png`));
}
// History of verified frames: { file, scene, location, labels confirmed by a vision check }.
const history = [];
async function remember(s, file) {
  const claimed = [...new Set(s.end.visible.filter((l) => asset[l] && l !== s.location))];
  const check = claimed.length ? await checkFrame(join(out, file), claimed.map((l) => ({ name: l, kind: asset[l].kind, look: asset[l].look }))) : { counts: [] };
  const labels = claimed.filter((l) => (check.counts.find((c) => c.name === l)?.count || 0) >= 1);
  history.push({ file, scene: s.n, location: s.location, labels: [...labels, s.location] }); // the place is part of the frame's state too
  (log.history ??= []).push({ file, scene: s.n, location: s.location, claimed, confirmed: labels }); save();
}
const lastStable = (l) => [...history].reverse().find((h) => h.labels.includes(l));
// Context mode: the base is the verified frame with the most wanted labels (same location first, then most labels, then
// most recent). It is transformed into the new shot; labels it lacks are merged from their last verified frame.
async function contextStart(s, id) {
  const wanted = [...new Set(s.start.visible.filter((l) => asset[l] && l !== s.location))];
  let base = null, best = 0;
  history.forEach((h, i) => {
    const score = (h.location === s.location ? 100 : 0) + 10 * wanted.filter((l) => h.labels.includes(l)).length + i / 1000;
    if (score >= 10 && score > best) { best = score; base = h; }
  });
  const missing = wanted.filter((l) => !base?.labels.includes(l));
  const merge = [];
  for (const l of missing) { const h = lastStable(l); if (h && h !== base) (merge.find((m) => m.h === h) || merge[merge.push({ h, labels: [] }) - 1]).labels.push(l); }
  const fresh = missing.filter((l) => !merge.some((m) => m.labels.includes(l)));
  const sheets = s.start.visible.filter((l) => refs.includes(l));
  const inputs = [...(base ? [base.file] : []), ...merge.slice(0, 3).map((m) => m.h.file), ...sheets.map(fname)];
  let k = base ? 2 : 1;
  const lines = [];
  if (base && base.location === s.location) lines.push(`Image 1 is an earlier frame of this same place (${s.location}, scene ${base.scene}). Transform it into the new shot below. Keep the place, its objects and the real size of everything as in image 1; change only framing, positions, poses, light and time as described.`);
  else if (base) lines.push(`Image 1 is an earlier frame (scene ${base.scene}) that shows ${base.labels.filter((l) => wanted.includes(l)).join(", ")}. Transform it into the new shot in a different place, ${s.location}: ${asset[s.location]?.look || ""} Keep ${base.labels.filter((l) => wanted.includes(l)).join(", ")} exactly: same shape, design, colours, details and real size relative to each other. Replace everything else (place, light, weather, time) as described.`);
  for (const m of merge.slice(0, 3)) lines.push(`Image ${k++} is an earlier frame (scene ${m.h.scene}) showing ${m.labels.join(", ")}: take their exact look and real size from it and merge them into the new shot; do not copy its framing.`);
  for (const l of sheets) lines.push(`Image ${k++} is the character sheet of ${l}: identity only (face, hair, clothing).`);
  for (const l of fresh) lines.push(`New in this shot: ${l}: ${asset[l].look}`);
  (log.context ??= {})[id] = { base: base ? { scene: base.scene, file: base.file } : null, merge: merge.map((m) => ({ scene: m.h.scene, labels: m.labels })), fresh, sheets }; save();
  const text = `${doc.style}. 16:9 film frame. ${SINGLE} New shot: ${s.start.description}\n${lines.join("\n")}`;
  if (inputs.length) return edit(`start:${id}`, `${id}-start.png`, text, inputs);
  return job(`start:${id}`, `${id}-start.png`, async () => {
    const body = { name: `litmus ${TEST} start ${id}`, image_count: 1, ...IMAGE, style: { prompt: text } };
    const r = await runJob("/v1/ai-image-generator", body, "image");
    await download(r.downloads[0], join(out, `${id}-start.png`));
    return { request: body, credits: r.credits };
  });
}
// Typed context: base = store.rank (same location, stable wanted labels, matched typed attributes, recency). Labels the
// base lacks come from their last stable instance; a label with no instance but a stable parent (part_of) gets the parent's frame.
async function contextStartTyped(s, id) {
  const want = { location: s.location, assets: typedOf(s.start) };
  const wanted = Object.keys(want.assets).filter((l) => l !== s.location);
  const { base, scored } = await store.rank(want);
  const missing = wanted.filter((l) => !base?.assets[l]?.stable);
  const merge = [], parentOf = {};
  for (const l of missing) {
    let r = store.lastStable(l);
    if (!r && asset[l].part_of && store.lastStable(asset[l].part_of)) { r = store.lastStable(asset[l].part_of); parentOf[l] = asset[l].part_of; }
    if (r && r !== base) (merge.find((m) => m.r === r) || merge[merge.push({ r, labels: [] }) - 1]).labels.push(l);
  }
  const used = merge.slice(0, 3), fresh = missing.filter((l) => !used.some((m) => m.labels.includes(l)));
  const sheets = s.start.visible.filter((l) => refs.includes(l));
  const inputs = [...(base ? [base.file] : []), ...used.map((m) => m.r.file), ...sheets.map(fname)];
  const keep = base ? wanted.filter((l) => base.assets[l]?.stable) : [];
  const lines = [];
  let k = base ? 2 : 1;
  if (base && base.location === s.location) lines.push(`Image 1 is an earlier frame of this same place (${s.location}, scene ${base.scene}). Transform it into the new shot. Keep the place, its objects and the real size of everything as in image 1; change only framing, positions, poses, light and time as described.`);
  else if (base) lines.push(`Image 1 is an earlier frame (scene ${base.scene}) that shows ${keep.join(", ")}. Transform it into the new shot in a different place, ${s.location}: ${asset[s.location]?.look || ""} Keep ${keep.join(", ")} exactly: same shape, design, colours, details and real size. Replace everything else (place, light, weather, time) as described.`);
  for (const m of used) lines.push(`Image ${k++} is an earlier frame (scene ${m.r.scene}) showing ${m.labels.map((l) => parentOf[l] ? `${parentOf[l]}; ${l} is part of ${parentOf[l]}, so match its design, colours and materials` : l).join(", ")}: take their exact look and real size from it and merge them into the new shot; do not copy its framing.`);
  for (const l of sheets) lines.push(`Image ${k++} is the character sheet of ${l}: identity only (face, hair, clothing).`);
  for (const l of fresh) lines.push(`New in this shot: ${l}: ${asset[l].look}`);
  const source = {};
  for (const l of keep) source[l] = base.id;
  for (const m of used) for (const l of m.labels) source[l] = m.r.id;
  (log.context ??= {})[id] = { base: base?.id || null, scored, merge: used.map((m) => ({ record: m.r.id, labels: m.labels })), fresh, sheets }; save();
  const prompt = `${doc.style}. 16:9 film frame. ${SINGLE} New shot: ${s.start.description}\n${lines.join("\n")}${wantText(s.start) ? `\nWanted state of each asset:\n${wantText(s.start)}` : ""}`;
  return { prompt, inputs, source };
}
function frames(f) { return Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f]).toString().trim()); }
function jumps(f) { return [...spawnSync("ffmpeg", ["-i", f, "-vf", "scale=320:180,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" }).stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1])); }
const res = [];
if (CONTEXT) for (const ch of chains) { try { await runChain(ch); res.push({ status: "fulfilled" }); } catch (e) { res.push({ status: "rejected", reason: e }); console.log(String(e)); } }
else res.push(...(await Promise.allSettled(chains.map(runChain))));
res.push(...(await Promise.allSettled(pendingClips)));
log.errors = res.filter((r) => r.status === "rejected").map((r) => String(r.reason)); save();

// 4. Stitch trimmed clips, measure.
const ids = doc.scenes.map((s) => `s${s.n}`).filter((id) => existsSync(join(out, `${id}-trim.mp4`)));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...ids.flatMap((id) => ["-i", join(out, `${id}-trim.mp4`)]), "-filter_complex",
  ids.map((_, i) => `[${i}:v]fps=30[v${i}]`).join(";") + ";" + ids.map((_, i) => `[v${i}]`).join("") + `concat=n=${ids.length}:v=1:a=0[v]`, "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(out, "joined.mp4")]);
for (const id of ids) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(out, `${id}.mp4`), "-vf", "fps=2,scale=320:-2,tile=5x2", "-frames:v", "1", join(out, `${id}-strip.jpg`)]);
const all = jumps(join(out, "joined.mp4")), med = [...all].sort((a, b) => a - b)[Math.floor(all.length / 2)];
log.measures = { median_jump: +med.toFixed(2), clips: {}, seams: [] };
let at = 0;
for (const [i, id] of ids.entries()) {
  const j = jumps(join(out, `${id}.mp4`)), s = doc.scenes.find((x) => `s${x.n}` === id);
  log.measures.clips[id] = { first_vs_start: ssim(join(out, `${id}-first.png`), join(out, log.jobs[`clip:${id}`].start), { fit: true }),
    raw_last_vs_end: ssim(join(out, `${id}-last-raw.png`), join(out, `${id}-end.png`), { fit: true }), kept_last_vs_end: ssim(join(out, `${id}-last.png`), join(out, `${id}-end.png`), { fit: true }),
    last_jumps: j.slice(-4).map((x) => +x.toFixed(1)) };
  at += frames(join(out, `${id}-trim.mp4`));
  if (i < ids.length - 1) { const nx = doc.scenes.find((x) => `s${x.n}` === ids[i + 1]); log.measures.seams.push({ from: id, to: ids[i + 1], link: nx.link, jump: +(all[at - 1] ?? 0).toFixed(1) }); }
}
log.total_credits = Object.values(log.jobs).reduce((n, j) => n + (j.credits || 0), 0); save();
if (TYPED) writeFileSync(join(out, "state.html"), renderState(store, `Litmus ${TEST}`));
console.log(JSON.stringify({ credits: log.total_credits, errors: log.errors, measures: log.measures }, null, 1));
