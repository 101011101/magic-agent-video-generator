// Pipeline state-graph: one prompt → state timeline (1 LLM call) → deterministic controller (seed-frame edits and merges from
// old frames, verification, versions with pointers) → clips (wan-3.0, start frame only, audio) → seam fix → stitch → cue-sheet
// mix → final.mp4 with sound. Outputs: current/tests/pipeline-state-graph/runs/<case>-<label>/ (final.mp4, index.html, run.json,
// state.json, cues.json, timeline.html).
// Usage: node current/prod/pipeline-state-graph/run.mjs --case p4-lighthouse [--label v1] [--count 9] [--beats 2] [--estimate] [--no-music]
//   --count K   beats in the timeline (K × 5 s);  --beats N   run only the first N beats (probe);  --estimate   list jobs and credits, spend nothing
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { REPO } from "../state-manager/src/paths.js";
import { usage } from "../state-manager/src/llm.js";
import { renderText } from "../pipeline-v2/src/text.js";
import { planTimeline } from "./src/timeline.js";
import { StateGraph } from "./src/graph.js";
import { Jobs, StopError, CAP } from "./src/jobs.js";
import { Controller } from "./src/controller.js";
import { analyze, seamFix, cutClip, stitch, strip, measures, duration } from "./src/clips.js";
import { cueSheet, mixAudio } from "./src/audio.js";
import { renderPage, renderTimeline } from "./src/page.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const caseId = opt("--case", "p4-lighthouse"), label = opt("--label", "v1"), count = Number(opt("--count", 9)), maxBeats = Number(opt("--beats", 0));
const estimate = args.includes("--estimate"), MUSIC = !args.includes("--no-music");
const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
const VIDEO = { model: "wan-3.0", resolution: "720p", audio: true };
const t0 = Date.now();

const c = JSON.parse(readFileSync(join(REPO, "current/tests/state-manager/cases.json"), "utf8")).cases.find((x) => x.id === caseId);
const read = (p) => readFileSync(join(REPO, p), "utf8");
const story = read(c.story_path), chunks = read(c.chunks_path);
const runDir = join(REPO, "current/tests/pipeline-state-graph/runs", `${caseId}-${label}`);
mkdirSync(join(runDir, "uploads"), { recursive: true });
const logPath = join(runDir, "run.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { run: `${caseId}-${label}`, case: c, jobs: {}, calls: [] };
Object.assign(log, { models: { IMAGE, VIDEO }, cap: CAP, beats: {}, errors: [], stopped: null, started_at: new Date().toISOString() });
const jobs = new Jobs(runDir, log, { estimate });
// Uploads: the shared stand-in files of the benchmark (one real photo per case), used exactly like a real upload.
const uploadDir = join(REPO, "current/tests/pipeline-v2/uploads", caseId), uploads = {};
for (const u of ["u1", "u2", "u3"]) if (existsSync(join(uploadDir, `${u}.png`))) { copyFileSync(join(uploadDir, `${u}.png`), join(runDir, `uploads/${u}.png`)); uploads[u] = `uploads/${u}.png`; }

// 1. State timeline (one LLM call, kept by the run).
console.log(`${caseId}: state timeline…`);
const timeline = log.timeline || await planTimeline({ request: c.request, uploads: c.uploads, story, chunks, count, seconds: count * 5 });
log.timeline = timeline; log.story = story; log.chunks = chunks;
const beats = maxBeats ? timeline.beats.slice(0, maxBeats) : timeline.beats;
log.beats_run = beats.map((b) => b.n); if (!estimate) jobs.save();
writeFileSync(join(runDir, "timeline.html"), renderTimeline(timeline));
console.log(`  ${timeline.entities.length} entities, ${timeline.beats.length} beats; running ${beats.length}`);

// 2. The graph is rebuilt every run from the timeline (versions) and the controller's records (vision checks are cached).
if (!estimate) rmSync(join(runDir, "state.json"), { force: true });
const graph = new StateGraph(estimate ? mkdtempSync(join(tmpdir(), "sg-")) : runDir, timeline);
const cues0 = cueSheet(timeline, timeline.beats.map((b) => ({ beat: b.n, id: `b${b.n}`, file: "", seconds: 5, link: b.link, location: b.location })));
for (const k in cues0.clip_sound) cues0.clip_sound[k] = cues0.clip_sound[k].replace(/;?\s*mixed inaudibly/gi, "");
const ctl = new Controller({ runDir, graph, jobs, log, timeline, IMAGE, VIDEO, clipSound: cues0.clip_sound });

// 3. Beats in order: every cut can seed from every earlier frame, including the real last frames of earlier clips.
const done = [];
try {
  await ctl.registerUploads(uploads);
  let prev = null;
  for (const b of beats) { prev = await ctl.runBeat(b, prev); done.push({ beat: b, ...prev }); }
} catch (e) {
  if (e instanceof StopError) { log.stopped = String(e.message); console.log(`STOP: ${e.message}`); }
  else { log.errors.push({ beat: beats[done.length]?.n, error: String(e.stack || e) }); console.log(String(e.stack || e)); }
}
if (estimate) { console.log(`estimate: ${jobs.estimated} credits for ${jobs.calls.length} jobs (retries not counted; +200 per retried frame)`); process.exit(0); }
jobs.save();

// 4. Seam fix and stitch. A clip that continues from the previous one drops its dark duplicate first frame(s) and gets a luma ramp.
const analyses = {}, parts = [];
try {
for (const [i, d] of done.entries()) {
  if (!existsSync(join(runDir, d.clip))) continue;
  const id = `b${d.beat.n}`, raw = analyze(join(runDir, d.clip));
  const continuous = d.beat.link === "continuous" && i > 0;
  const fix = continuous ? seamFix(raw) : { drop: 1, offsets: [] }; // every clip loses its dark frame 0
  cutClip(join(runDir, d.clip), join(runDir, `${id}-cut.mp4`), fix);
  strip(join(runDir, d.clip), join(runDir, `${id}-strip.jpg`));
  analyses[id] = { raw, fix, after: analyze(join(runDir, `${id}-cut.mp4`)) };
  parts.push({ beat: d.beat.n, id, file: `${id}-cut.mp4`, seconds: duration(join(runDir, `${id}-cut.mp4`)), link: d.beat.link, location: d.beat.location, start: d.start });
  log.beats[d.beat.n].seam_fix = fix;
}
if (parts.length) {
  stitch(runDir, parts, "picture.mp4");
  const cues = cueSheet(timeline, parts);
  log.cues = cues; writeFileSync(join(runDir, "cues.json"), JSON.stringify(cues, null, 2));
  const mixed = timeline.layers?.length ? "mixed.mp4" : "final.mp4";
  try { log.audio_mix = mixAudio(runDir, parts, cues, join(runDir, "picture.mp4"), join(runDir, mixed), { music: MUSIC }); }
  catch (e) { log.errors.push({ stage: "mix", error: String(e) }); copyFileSync(join(runDir, "picture.mp4"), join(runDir, mixed)); }
  // Exact text layers: rendered by headless Chrome, laid over with ffmpeg; text colour by the luma under the layer.
  if (timeline.layers?.length) {
    const luma = (t) => Number((spawnSync("ffmpeg", ["-ss", String(t), "-i", join(runDir, mixed), "-frames:v", "1", "-vf", "format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/YAVG=([\d.]+)/) || [])[1] || 0);
    const pngs = timeline.layers.map((l, k) => renderText(l, join(runDir, `text-${k + 1}.html`), join(runDir, `text-${k + 1}.png`), { dark: luma((l.start_s + l.end_s) / 2) > 150 }));
    const chain = timeline.layers.map((l, k) => `[${k + 1}:v]format=rgba,fade=t=in:st=${l.start_s}:d=0.4:alpha=1,fade=t=out:st=${Math.max(l.start_s, l.end_s - 0.4)}:d=0.4:alpha=1[t${k}];[${k === 0 ? "0:v" : `o${k - 1}`}][t${k}]overlay=0:0:shortest=1:enable='between(t,${l.start_s},${l.end_s})'${k === timeline.layers.length - 1 ? "[v]" : `[o${k}]`}`).join(";");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(runDir, mixed), ...pngs.flatMap((p) => ["-loop", "1", "-i", p]), "-filter_complex", chain, "-map", "[v]", "-map", "0:a?", "-c:a", "copy", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", join(runDir, "final.mp4")]);
  }
  // 5. Measures: seam SSIM, raw jump, and the compensated S / V / L at every join, before and after the fix.
  log.measures = measures(runDir, parts, "final.mp4", analyses);
}
} catch (e) { log.errors.push({ stage: "post", error: String(e.stack || e) }); console.log(String(e.stack || e)); }
log.total_credits = jobs.spent(); log.llm = usage; log.time_s = Math.round((Date.now() - t0) / 1000);
log.credits_all_runs = jobs.ledger().total;
jobs.save();
writeFileSync(join(runDir, "index.html"), renderPage(log, graph, runDir));
console.log(JSON.stringify({ credits: log.total_credits, all_runs: log.credits_all_runs, time_s: log.time_s, stopped: log.stopped, errors: log.errors, joins: log.measures?.joins }, null, 1));
console.log(`page: ${join(runDir, "index.html")}`);
