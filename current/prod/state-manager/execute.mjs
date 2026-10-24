// Executes a solved plan with real Magic Hour calls and ffmpeg joins.
// Usage: node current/prod/state-manager/execute.mjs --case <id> [--segments N] [--standin-uploads] [--dry-run]
//   --segments N        keep only the first N segment groups (stitch inputs)
//   --standin-uploads   generate a synthetic stand-in image for each "given" upload from its text description
//   --dry-run           write prompts and estimated credits; make no Magic Hour calls
//   --reuse a[,b]       reuse outputs of earlier run folders by node id (first folder that has the node wins)
//   --scene-chain       scene mode: a scene = consecutive shots that continue (same location + depends on the previous shot).
//                       Shot 1 of a scene uses the planned start + end frames. Every later shot starts on the REAL last
//                       frame of the previous clip (ffmpeg), and its end frame is an image edit of that real frame.
//                       Shots in one scene run strictly in order; scenes run in parallel. Cuts keep planned frames.
//   --fit-frames        crop each video input image to the output aspect (centre) before upload
//   --max-seconds N     cap every clip at N seconds (test runs); durations snap to what the model accepts
// Env: MH_IMAGE_MODEL, MH_IMAGE_RES, MH_VIDEO_MODEL (no end frame), MH_END_FRAME_MODEL, MH_VIDEO_RES,
//      MH_CHAIN_IMAGE_MODEL / MH_CHAIN_IMAGE_RES (end frames edited from real last frames; default = image model/res).
// After the run, a continuity check (SSIM) is written into run.json and the run page.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { TESTS, REPO } from "./src/paths.js";
import { loadSignatures, REFERENCE_ONLY } from "./src/signatures.js";
import { writePrompt } from "./src/prompts.js";
import { runJob, download, uploadFile } from "./src/magichour.js";
import { condText } from "./src/solver.js";
import { renderRun } from "./src/render-run.js";
import { lastFrame, checkContinuity } from "./src/continuity.js";

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const caseId = opt("--case");
const segLimit = opt("--segments") ? Number(opt("--segments")) : null;
const standin = args.includes("--standin-uploads");
const dry = args.includes("--dry-run");
const framesOnly = args.includes("--frames-only"); // build and check the landmark frame chain; make no videos
const sceneChain = args.includes("--scene-chain");
const fitFrames = args.includes("--fit-frames");
const maxSeconds = opt("--max-seconds") ? Number(opt("--max-seconds")) : null;
const reuseDirs = (opt("--reuse") || "").split(",").filter(Boolean);
const IMAGE_MODEL = process.env.MH_IMAGE_MODEL || "nano-banana-pro";
const IMAGE_RES = process.env.MH_IMAGE_RES || "4k";
const CHAIN_IMAGE_MODEL = process.env.MH_CHAIN_IMAGE_MODEL || IMAGE_MODEL;
const CHAIN_IMAGE_RES = process.env.MH_CHAIN_IMAGE_RES || IMAGE_RES;
const VIDEO_MODEL = process.env.MH_VIDEO_MODEL || "ltx-2.5";
const END_FRAME_MODEL = process.env.MH_END_FRAME_MODEL || "seedance-1.5";
const VIDEO_RES = process.env.MH_VIDEO_RES || "720p";
// Credits per second (OpenAPI/tool catalog); wan-3.0 measured 96 at 720p.
const RATE = { "ltx-2.5": { "480p": 24, "720p": 48, "1080p": 72 }, "seedance-1.5": { "480p": 30, "720p": 60, "1080p": 90 }, "kling-3.0": { "720p": 48, "1080p": 72 },
  "veo3.1-lite": { "720p": 48, "1080p": 72 }, "veo3.1": { "720p": 96, "1080p": 120 }, "wan-3.0": { "720p": 96 }, "gemini-omni-1.1": { "360p": 48, "720p": 144, "1080p": 192 } };
const IMAGE_RATE = { "nano-banana-pro": { "1k": 150, "2k": 200, "4k": 250 }, "nano-banana": { "640px": 50, "1k": 50 }, "nano-banana-2": { "1k": 100, "2k": 100 } };
// Allowed durations per model; with an end frame, veo needs <= 8 s.
const DURATIONS = { "seedance-1.5": [4, 12], "kling-3.0": [3, 15], "ltx-2.5": [1, 60], "wan-3.0": [2, 10], "gemini-omni-1.1": [3, 10], "veo3.1": [4, 6, 8], "veo3.1-lite": [4, 6, 8] };
function fitSeconds(model, s) {
  const d = DURATIONS[model]; if (!d) return s;
  if (model.startsWith("veo")) return d.reduce((b, x) => (Math.abs(x - s) < Math.abs(b - s) || (Math.abs(x - s) === Math.abs(b - s) && x < b) ? x : b));
  return Math.min(d[1], Math.max(d[0], s));
}

const result = JSON.parse(readFileSync(join(TESTS, "out", `${caseId}.json`), "utf8"));
const sigs = loadSignatures();
const requests = [...JSON.parse(readFileSync(join(REPO, "current/tests/creative-director/requests.json"), "utf8")), ...JSON.parse(readFileSync(join(REPO, "current/tests/creative-director/requests-logo.json"), "utf8"))];
const request = requests.find((r) => r.id === caseId);
// Every run gets its own folder, so a dry run never overwrites a real one.
const label = opt("--label") || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = join(TESTS, "runs", `${caseId}-${dry ? "dry-" : ""}${framesOnly ? "frames-" : ""}${label}`);
if (existsSync(join(runDir, "run.json")) && !dry) throw new Error(`run folder ${runDir} already has a run; pick another --label`);
mkdirSync(runDir, { recursive: true });
const reused = {};
for (const dir of reuseDirs) {
  const prevRun = JSON.parse(readFileSync(join(TESTS, "runs", dir, "run.json"), "utf8"));
  for (const [id, r] of Object.entries(prevRun.records)) if (!reused[id] && r.file && existsSync(join(TESTS, "runs", dir, r.file))) reused[id] = { ...r, from: dir };
}

// ---- Prune the plan: first N segment groups; drop unbound audio tools -----------------------
const nodes = Object.fromEntries(result.plan.nodes.map((n) => [n.id, JSON.parse(JSON.stringify(n))]));
const skipped = [];
for (const n of Object.values(nodes)) {
  if (n.tool === "stitch" && segLimit) { skipped.push(`stitch: kept the first ${segLimit} of ${n.inputs.length} segment groups`); n.inputs = n.inputs.slice(0, segLimit); }
  if (n.tool === "audio_mix_mux") n.inputs = n.inputs.filter((i) => {
    const c = nodes[i.node]; const unbound = ["music_score", "sound_effects"].includes(c?.tool);
    if (unbound) skipped.push(`${c.tool} (${i.slot}): unbound tool, no provider yet; the audio layer is left silent`);
    return !unbound;
  });
}
if (maxSeconds) skipped.push(`test cap: every clip at most ${maxSeconds} s`);

// ---- Shots and scenes -------------------------------------------------------------------------
const slotNode = (n, slot) => n.inputs.find((i) => i.slot === slot)?.node || null;
const stitchNode = Object.values(nodes).find((n) => n.tool === "stitch");
const shotIds = stitchNode ? stitchNode.inputs.map((i) => i.node) : [];
// How each shot's start frame was planned. The solver writes `handoff`; older plans derive it from the frame graph.
// exact / edited = the shot continues the previous one (same scene); return / new = a cut.
const handoffOf = (k) => {
  const v = nodes[shotIds[k]];
  if (v.handoff) return v.handoff;
  if (!k) return "new";
  const p = nodes[shotIds[k - 1]];
  const prevEnd = slotNode(p, "assets.end_image_file_path") || slotNode(p, "assets.image_file_path");
  const start = slotNode(v, "assets.image_file_path");
  if (start === prevEnd) return "exact";
  const s = nodes[start];
  if (s.tool === "AI Image Editor" && slotNode(s, "assets.image_file_paths[0]") === prevEnd && /end of previous scene/.test(s.label)) return "edited";
  return /back at/.test(s.label) ? "return" : "new";
};
const plannedHandoff = shotIds.map((_, k) => handoffOf(k));
const continues = (k) => k > 0 && ["exact", "edited"].includes(plannedHandoff[k]);
const sceneOf = []; shotIds.forEach((_, k) => (sceneOf[k] = k && continues(k) ? sceneOf[k - 1] : (sceneOf[k - 1] ?? -1) + 1));

if (sceneChain) {
  // Rewire every continuing shot: start = real last frame of the previous clip; end = edit of that real frame.
  const condId = (c) => `${c.subject}.${c.atom}`;
  const bindingKind = Object.fromEntries(result.spec.bindings.map((b) => [b.name, b.kind]));
  const refOf = {}; // entity -> clean reference node in the plan
  for (const x of Object.values(nodes)) { const e = x.refFor || (x.label || "").match(/^Clean reference for (.+?), isolated/)?.[1]; if (e && !refOf[e]) refOf[e] = x.id; }
  for (const [k, vid] of shotIds.entries()) {
    if (!continues(k)) continue;
    const v = nodes[vid], prevVid = shotIds[k - 1];
    const p = nodes[prevVid];
    const prevEnd = slotNode(p, "assets.end_image_file_path") || slotNode(p, "assets.image_file_path");
    const start = slotNode(v, "assets.image_file_path"), end = slotNode(v, "assets.end_image_file_path");
    const lastId = `${prevVid}-last`;
    nodes[lastId] = { id: lastId, type: "tool", tool: "Last frame", label: `the real last frame of the previous shot's video (${prevVid}: ${p.label.replace(/^Segment group \d+: /, "")})`, inputs: [{ slot: "video", node: prevVid }] };
    // The planned start may flip a few conditions off the previous end frame; those flips move into this end-frame edit.
    const startEdit = start !== prevEnd ? nodes[start] : null;
    const plannedEnd = end ? nodes[end] : null;
    let endId = null;
    if (startEdit || plannedEnd) {
      const base = plannedEnd || startEdit;
      endId = `${base.id}c`;
      const endSets = plannedEnd?.sets || [];
      const sets = [...(startEdit?.sets || []).filter((c) => !endSets.some((e) => condId(e) === condId(c))), ...endSets];
      // The real last frame may not show every character or product (one walked out of frame), so each one the end frame
      // shows enters through its clean reference from the plan; identity is never re-invented from text.
      const shown = [...new Set((base.goalConds || []).filter((c) => REFERENCE_ONLY.has(c.atom) && ["character", "product"].includes(bindingKind[c.subject])).map((c) => c.subject))];
      const refs = [...new Set([...(startEdit?.inputs || []), ...(plannedEnd?.inputs || [])].filter((i) => i.slot === "assets.image_file_paths[1..]").map((i) => i.node).concat(shown.map((e) => refOf[e]).filter(Boolean)))];
      const refPasses = (base.goalConds || []).filter((c) => REFERENCE_ONLY.has(c.atom) && shown.includes(c.subject) && refOf[c.subject]).map((c) => ({ cond: c, slot: "assets.image_file_paths[1..]" }));
      nodes[endId] = { ...base, id: endId, label: `End of ${v.label} = real last frame of ${prevVid} + changes`, sets, strip: [...new Set([...(startEdit?.strip || []), ...(plannedEnd?.strip || [])])],
        passes: [...(base.passes || []).filter((p2) => (p2.slot === "assets.image_file_paths[0]" ? !sets.some((c) => condId(c) === condId(p2.cond)) : true) && !refPasses.some((r) => condId(r.cond) === condId(p2.cond))), ...refPasses],
        chained: true, inputs: [...base.inputs.filter((i) => i.slot === "style.prompt"), { slot: "assets.image_file_paths[0]", node: lastId }, ...refs.map((r) => ({ slot: "assets.image_file_paths[1..]", node: r }))] };
    }
    v.inputs = [...v.inputs.filter((i) => !i.slot.startsWith("assets.")), { slot: "assets.image_file_path", node: lastId }, ...(endId ? [{ slot: "assets.end_image_file_path", node: endId }] : [])];
  }
}

const reach = new Set();
(function walk(id) { if (reach.has(id)) return; reach.add(id); for (const i of nodes[id].inputs || []) walk(i.node); })(result.plan.root);
const level = {};
const lv = (id) => level[id] ?? (level[id] = nodes[id].type === "tool" ? 1 + Math.max(0, ...nodes[id].inputs.map((i) => lv(i.node))) : 0);
[...reach].forEach(lv);
// Phases: (1) every frame in the chain, in dependency order; (2) every video between its frames; (3) joins.
const phaseOf = (id) => { const n = nodes[id]; return n.type === "leaf" || ["AI Image Generator", "AI Image Editor"].includes(n.tool) ? 0 : n.tool === "Image-to-Video" ? 1 : 2; };
const levels = [];
if (sceneChain) {
  // Dependency order only (frames and videos interleave); used for the report.
  for (const l of [...new Set([...reach].map((id) => level[id]))].sort((a, b) => a - b)) levels.push([...reach].filter((id) => level[id] === l));
} else {
  for (const ph of [0, 1, 2]) {
    if (framesOnly && ph > 0) break;
    for (const l of [...new Set([...reach].filter((id) => phaseOf(id) === ph).map((id) => level[id]))].sort((a, b) => a - b))
      levels.push([...reach].filter((id) => phaseOf(id) === ph && level[id] === l));
  }
}

// ---- Helpers --------------------------------------------------------------------------------
const outputs = {}; // node id -> { url, file, kind }
async function urlOf(id) {
  const o = outputs[id];
  if (!o) { if (dry) return `<${id}>`; throw new Error(`no output for ${id}`); }
  if (!o.url) o.url = dry ? `<${id}>` : await uploadFile(o.file, o.kind === "video" ? "video" : "image");
  return o.url;
}
// A video input image, centre-cropped to the output aspect first (with --fit-frames).
async function videoInputUrl(id, aspect) {
  const o = outputs[id];
  if (!fitFrames || dry || !o) return urlOf(id);
  return (o.fitUrl ??= (async () => {
    const [w, h] = aspect === "9:16" ? [9, 16] : aspect === "1:1" ? [1, 1] : [16, 9];
    const out = join(runDir, `${id}-fit.png`);
    if (!existsSync(out)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", o.file, "-vf", `crop='trunc(min(iw,ih*${w}/${h})/2)*2':'trunc(min(ih,iw*${h}/${w})/2)*2'`, out]);
    o.fitFile = out; if (records[id]) records[id].fitFile = `${id}-fit.png`;
    return uploadFile(out, "image");
  })());
}
// Limit concurrent Magic Hour jobs.
let active = 0; const waiters = [];
async function slot(fn) { while (active >= 6) await new Promise((r) => waiters.push(r)); active++; try { return await fn(); } finally { active--; waiters.shift()?.(); } }
const records = {};  // node id -> record for the report
const condVal = (conds, atom) => conds.find((c) => c.atom === atom)?.value;
const describe = (id) => {
  const n = nodes[id];
  if (n.type === "leaf") return n.leaf === "given" ? `the uploaded image (${n.label})` : n.label;
  if (n.tool === "Last frame") return n.label;
  if (n.refFor) return `a clean reference image of ${n.refFor} alone; take only ${n.refFor}'s appearance from it`;
  const ids = [...new Set((n.goalConds || []).filter((c) => c.atom === "identity").map((c) => `${c.subject} (${c.value})`))];
  return `${n.label}${ids.length ? `; shows ${ids.join(", ")}` : ""}`;
};
const aspectOf = (n) => { const a = condVal(n.goalConds || [], "aspect") || result.spec.format.aspect; return /9:16/.test(a) ? "9:16" : /1:1/.test(a) ? "1:1" : "16:9"; };
const durationOf = (n) => { const d = (n.goalConds || []).filter((c) => c.atom === "duration" && c.subject === "format").map((c) => Number(String(c.value).match(/[\d.]+/)?.[0])).filter(Boolean); return d.length ? Math.min(...d) : 5; };

const filmLook = [...new Set(result.spec.bindings.filter((b) => b.kind === "style").map((b) => b.description))].join("; ") || result.spec.segments[0]?.conditions.filter((c) => c.atom === "style").map((c) => c.value).join("; ");
async function promptFor(n, imageInputs) {
  const sig = sigs.byName[n.tool];
  return writePrompt({ tool: n.tool, nature: sig?.nature || "", sets: n.sets, passes: n.passes, inputs: imageInputs.map((i) => ({ slot: i.slot, describe: describe(i.node) })),
    style: condVal(n.goalConds || [], "style"), aspect: aspectOf(n), duration: n.tool === "Image-to-Video" ? durationOf(n) : null, reference: n.refFor || null, strip: n.strip || [], look: filmLook });
}

async function runImage(n, endpoint, body) {
  const rec = records[n.id];
  rec.request = body;
  if (dry) { rec.estimate = IMAGE_RATE[body.model]?.[body.resolution] ?? 150; return; }
  const job = await slot(() => runJob(endpoint, body, "image"));
  const file = await download(job.downloads[0], join(runDir, `${n.id}.png`));
  Object.assign(rec, { job: job.id, credits: job.credits, seconds: job.seconds, file: `${n.id}.png` });
  outputs[n.id] = { url: job.downloads[0], file, kind: "image" };
}

async function execNode(id) {
  const n = nodes[id];
  const rec = (records[id] = { id, type: n.type, tool: n.tool, leaf: n.leaf, label: n.label, level: level[id], sets: (n.sets || []).map(condText), passes: (n.passes || []).map((p) => `${condText(p.cond)} ← ${p.slot}`), inputs: (n.inputs || []).map((i) => ({ slot: i.slot, node: i.node })) });
  // Reuse only an output made from the same inputs (a rewired shot never takes an old clip).
  const sameInputs = (r) => !r.inputs || JSON.stringify(r.inputs.map((i) => `${i.slot}<${i.node}`).sort()) === JSON.stringify((n.inputs || []).map((i) => `${i.slot}<${i.node}`).sort());
  // Joins are free and are always re-made; every tool input must itself be reused (else its content changed).
  const inputsReused = (n.inputs || []).every((i) => nodes[i.node].type === "leaf" || records[i.node]?.reusedFrom);
  if (reused[id] && reused[id].tool === n.tool && !["stitch", "audio_mix_mux"].includes(n.tool) && sameInputs(reused[id]) && inputsReused) {
    const r = reused[id];
    copyFileSync(join(TESTS, "runs", r.from, r.file), join(runDir, r.file));
    Object.assign(rec, { prompt: r.prompt, request: r.request, job: r.job, credits: 0, reusedFrom: `${r.from} (${r.credits} credits there)`, file: r.file });
    outputs[id] = { file: join(runDir, r.file), url: null, kind: r.file.endsWith(".mp4") ? "video" : "image" };
    return;
  }
  if (n.type === "leaf") {
    if (n.leaf === "authored") { rec.note = "prompt text, written when its tool runs"; return; }
    if (n.leaf === "given") {
      if (!standin) throw new Error(`given input ${n.label} needs a real file (use --standin-uploads for a synthetic stand-in)`);
      rec.standin = true; rec.tool = "AI Image Generator"; rec.prompt = `Stand-in for the user's upload: ${request.uploads}`;
      await runImage(n, "/v1/ai-image-generator", { name: `${caseId} ${id} stand-in upload`, image_count: 1, model: IMAGE_MODEL, aspect_ratio: "16:9", resolution: IMAGE_RES, style: { prompt: `A natural, realistic photograph. ${request.uploads.replace(/^One photo:\s*/i, "")}` } });
      return;
    }
    throw new Error(`leaf ${n.leaf} (${n.label}) cannot be executed: it needs the user or research`);
  }
  if (n.tool === "Last frame") {
    rec.note = "ffmpeg: last decoded frame of the previous shot's clip";
    if (dry) return;
    const file = lastFrame(outputs[n.inputs[0].node].file, join(runDir, `${id}.png`));
    Object.assign(rec, { file: `${id}.png`, credits: 0 });
    outputs[id] = { file, kind: "image" };
    return;
  }
  const imageInputs = n.inputs.filter((i) => nodes[i.node].type !== "leaf" || nodes[i.node].leaf !== "authored");
  if (n.tool === "AI Image Generator") {
    rec.prompt = await promptFor(n, []);
    return runImage(n, "/v1/ai-image-generator", { name: `${caseId} ${id}`, image_count: 1, model: IMAGE_MODEL, aspect_ratio: aspectOf(n), resolution: IMAGE_RES, style: { prompt: rec.prompt } });
  }
  if (n.tool === "AI Image Editor") {
    rec.prompt = await promptFor(n, imageInputs);
    const [model, res] = n.chained ? [CHAIN_IMAGE_MODEL, CHAIN_IMAGE_RES] : [IMAGE_MODEL, IMAGE_RES];
    return runImage(n, "/v1/ai-image-editor", { name: `${caseId} ${id}`, image_count: 1, model, aspect_ratio: aspectOf(n), resolution: res, style: { prompt: rec.prompt }, assets: { image_file_paths: dry ? imageInputs.map((i) => `<${i.node}>`) : await Promise.all(imageInputs.map((i) => urlOf(i.node))) } });
  }
  if (n.tool === "Image-to-Video") {
    rec.prompt = await promptFor(n, imageInputs);
    const start = imageInputs.find((i) => i.slot === "assets.image_file_path");
    const end = imageInputs.find((i) => i.slot === "assets.end_image_file_path");
    const model = end ? END_FRAME_MODEL : VIDEO_MODEL;
    let seconds = Math.round(durationOf(n));
    if (maxSeconds) seconds = Math.min(seconds, maxSeconds);
    seconds = fitSeconds(model, seconds);
    const body = { name: `${caseId} ${id}`, end_seconds: seconds, model, resolution: VIDEO_RES, audio: false, style: { prompt: rec.prompt },
      assets: { image_file_path: await videoInputUrl(start.node, aspectOf(n)), ...(end ? { end_image_file_path: await videoInputUrl(end.node, aspectOf(n)) } : {}) } };
    rec.request = body;
    if (dry) { rec.estimate = seconds * (RATE[model]?.[VIDEO_RES] || 60); return; }
    const job = await slot(() => runJob("/v1/image-to-video", body, "video"));
    const file = await download(job.downloads[0], join(runDir, `${id}.mp4`));
    Object.assign(rec, { job: job.id, credits: job.credits, seconds: job.seconds, file: `${id}.mp4` });
    outputs[id] = { url: job.downloads[0], file, kind: "video" };
    return;
  }
  if (n.tool === "stitch" || n.tool === "audio_mix_mux") {
    const vids = n.inputs.map((i) => outputs[i.node]?.file).filter(Boolean);
    rec.note = n.tool === "stitch" ? `ffmpeg: normalize ${vids.length} clips to 1280×720 @24 fps and concatenate` : "ffmpeg: no audio layers bound, video passes through";
    if (dry) return;
    const file = join(runDir, `${id}.mp4`);
    if (vids.length === 1) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", vids[0], "-c", "copy", file]);
    else {
      const inputs = vids.flatMap((v) => ["-i", v]);
      const filt = vids.map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,setsar=1[v${i}]`).join(";") + `;${vids.map((_, i) => `[v${i}]`).join("")}concat=n=${vids.length}:v=1:a=0[out]`;
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filt, "-map", "[out]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", file]);
    }
    Object.assign(rec, { file: `${id}.mp4`, credits: 0 });
    outputs[id] = { file, kind: "video" };
    return;
  }
  throw new Error(`tool ${n.tool} is not wired in the executor yet`);
}

// ---- Run ---------------------------------------------------------------------------------------
const t0 = Date.now();
let failed = null;
if (sceneChain) {
  // Each node starts as soon as its inputs are done: shots inside a scene run in order, scenes run side by side.
  const running = {};
  const exec = (id) => (running[id] ??= (async () => {
    await Promise.all((nodes[id].inputs || []).map((i) => exec(i.node)));
    if (framesOnly && phaseOf(id) > 0 && nodes[id].tool !== "Last frame") return;
    console.log(`run ${id} ${nodes[id].tool || nodes[id].leaf}`);
    await execNode(id);
  })());
  try { await exec(result.plan.root); } catch (e) { failed = e.message; console.error("FAILED:", e.message); }
} else {
  for (const ids of levels) {
    console.log(`${["frames", "videos", "joins"][phaseOf(ids[0])]} · level ${level[ids[0]]}: ${ids.map((id) => `${id} ${nodes[id].tool || nodes[id].leaf}`).join(", ")}`);
    try { await Promise.all(ids.map(execNode)); }
    catch (e) { failed = e.message; console.error("FAILED:", e.message); break; }
  }
}
// The scene chain: for each shot, its start frame and end frame, and how it joins the previous shot.
const chain = shotIds.map((vid, k) => {
  const v = nodes[vid];
  return { label: v.label, video: vid, start: slotNode(v, "assets.image_file_path"), end: slotNode(v, "assets.end_image_file_path"), scene: sceneOf[k] + 1,
    handoff: k === 0 ? "first" : !continues(k) ? "cut" : sceneChain ? "real last frame" : plannedHandoff[k] };
});
let continuity = null;
if (!dry && !framesOnly) {
  try {
    const fileOf = (id) => { const o = outputs[id]; const f = o?.fitFile || o?.file; return f && existsSync(f) ? f : null; };
    continuity = checkContinuity(runDir, chain, fileOf);
  } catch (e) { console.error("continuity check failed:", e.message); }
}
const run = {
  case: caseId, title: request.title, request: request.request, uploads: request.uploads, dry, framesOnly, segments: segLimit, standin, skipped, failed,
  mode: sceneChain ? "scene-chain" : "planned-frames", fitFrames, maxSeconds,
  models: { image: `${IMAGE_MODEL} @ ${IMAGE_RES}`, video: VIDEO_MODEL, endFrame: END_FRAME_MODEL, videoRes: VIDEO_RES, chainImage: sceneChain ? `${CHAIN_IMAGE_MODEL} @ ${CHAIN_IMAGE_RES}` : null }, root: result.plan.root,
  final: records[result.plan.root]?.file || null, wall_s: Math.round((Date.now() - t0) / 1000),
  credits: Object.values(records).reduce((n, r) => n + (r.credits || 0), 0),
  estimate: Object.values(records).reduce((n, r) => n + (r.estimate || 0), 0),
  levels: levels.map((ids) => ids.filter((id) => records[id])).filter((l) => l.length), records, chain, continuity,
};
writeFileSync(join(runDir, "run.json"), JSON.stringify(run, null, 2));
writeFileSync(join(runDir, "index.html"), renderRun(run));
if (continuity) {
  for (const c of continuity.clips) console.log(`clip ${c.video}: start ${c.start ?? "-"} · end ${c.end ?? "-"}${c.flags?.length ? "  FLAG " + c.flags.join("; ") : ""}`);
  for (const s of continuity.seams) console.log(`seam ${s.from}→${s.to} (${s.kind}): ${s.ssim}${s.flag ? "  FLAG" : ""}`);
}
console.log(`${dry ? "Estimated" : "Charged"} credits: ${dry ? run.estimate : run.credits} · wall ${run.wall_s}s · ${failed ? "FAILED" : "done"} → ${join(runDir, "index.html")}`);
