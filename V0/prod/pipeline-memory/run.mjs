// Pipeline memory: one prompt → storyboard with typed world state → anchors (identity sheets, in-context scale anchors,
// location plates with fixtures) → per shot: cut start frame from the keyframe memory bank (semantic selection + anchors
// + carried observed state, closed-loop gate) or the real last frame (continuous, trimmed, repaired if entities are
// missing) → wan-3.0 clip with sound cues → observe the last frame into memory, persist state versions → stitch (hold/settle
// trims, xfade on continuous joins) → text layers → audio agent (cue sheet, beds, placeholder score, VO) → judge → page.
// Usage: node current/prod/pipeline-memory/run.mjs --case p4-lighthouse [--clips 9] [--scenes 1] [--label v1] [--estimate] [--remix] [--rejudge] [--xfade 0] [--supervised]
//   --supervised  approve every major step and every paid call in a browser page first (see ../test-machine/README.md)
//   A finished shot is marked done in run.json and replayed on re-runs (its keyframe decision and clip are final; memory is re-read from cache).
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { usage } from "../state-manager/src/llm.js";
import { firstFrame, ssim } from "../state-manager/src/continuity.js";
import { renderText } from "../pipeline-v2/src/text.js";
import { Run, loadCase, ledger, COST, CAP, VIDEO, RUNS as RUNS_DIR } from "./src/common.js";
import { storyboard, scenesOf, byName as entitiesOf } from "./src/storyboard.js";
import { Memory } from "./src/memory.js";
import { anchors, cutKeyframe, repairStart, versionAnchor } from "./src/keyframes.js";
import { motionProfile, settleAtEnd, snapAtEnd, stitch, measureJoins } from "./src/seams.js";
import { renderAudio, cueSheet } from "./src/audio.js";
import { judgeCut, contactSheet } from "./src/judge.js";
import { renderPage } from "./src/page.js";
import { maybeSupervisor, StopRun } from "../test-machine/supervisor.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const caseId = opt("--case", "p4-lighthouse"), label = opt("--label", "v1"), estimate = args.includes("--estimate"), remix = args.includes("--remix"), rejudge = args.includes("--rejudge");
for (const s of [process.stdout, process.stderr]) s.on("error", (e) => { if (e.code !== "EPIPE") throw e; }); // a closed log pipe must not kill a run
const XFADE = Number(opt("--xfade", 0)), maxScenes = Number(opt("--scenes", 0)); // crossfades blur motion (seams.js evidence); trim + hard join by default
const t0 = Date.now();
const c = loadCase(caseId);
const clips = Number(opt("--clips", caseId === "p1-grandma" ? 1 : 9));
const sup = await maybeSupervisor(args, { runDir: join(RUNS_DIR, `${caseId}-${label}`), title: `B · memory bank · ${caseId}-${label}` });
const gate = async (name, about, detail) => (sup ? await sup.step(name, about, detail) : () => {});
const run = new Run({ caseId, label, estimate, sup });
const log = run.log;
log.case = { id: c.id, title: c.title, request: c.request, uploads: c.uploads };
log.models = { IMAGE: "nano-banana-pro 2k", VIDEO, COST, CAP };
const page = () => { try { writeFileSync(run.path("index.html"), renderPage(log, run.dir)); } catch (e) { console.error(`  page: ${e.message}`); } };

// Uploads: the shared stand-in file is used exactly like a real upload.
mkdirSync(run.path("uploads"), { recursive: true });
const uploads = c.uploads && !/^none/i.test(c.uploads.trim()) ? ["u1"] : [];
for (const u of uploads) if (existsSync(join(c.uploadDir, `${u}.png`))) copyFileSync(join(c.uploadDir, `${u}.png`), run.path(`uploads/${u}.png`));

// 1. Storyboard (kept across re-runs of the same label).
console.log(`${caseId}-${label}: storyboard (${clips} shots)…`);
const plan = log.plan || await storyboard({ request: c.request, uploads: c.uploads, story: c.story, chunks: c.chunks, count: clips });
log.plan = plan;
const allScenes = scenesOf(plan.shots), scenes = maxScenes ? allScenes.slice(0, maxScenes) : allScenes;
log.scenes = scenes.map((s) => s.map((x) => x.id));
const E = entitiesOf(plan);
run.save();
console.log(`  ${plan.shots.length} shots in ${allScenes.length} scenes; running ${scenes.length} scenes (${scenes.flat().length} clips); ${plan.entities.length} entities`);
(await gate("storyboard", `${scenes.flat().length} clips in ${scenes.length} scenes, ${plan.entities.length} entities`, { note: plan.shots.map((x) => `${x.id} [${x.link}] ${x.location}: ${x.action}`).join("\n") }))({ text: "storyboard approved" });

const memory = new Memory(run, plan);
const stamp = () => { log.memory = { entities: memory.entities, bank: memory.bank }; log.total_credits = run.totalCredits(); log.elapsed_s = Math.round((Date.now() - t0) / 1000); log.llm = usage; log.ledger_spent = ledger().spent; run.save(); };

// Expected state at a shot's last frame: the start state with the end changes applied.
const FIELDS = ["position", "holding", "held_by", "placed_on", "condition"];
function endState(shot) {
  const out = shot.start.entities.map((e) => ({ ...e }));
  for (const ch of shot.end.changes) {
    const e = out.find((x) => x.name === ch.name); if (!e) continue;
    const a = ch.attr.toLowerCase().trim(), f = FIELDS.find((k) => a === k || a === k.replace("_", " ") || a === "placement" && k === "placed_on");
    if (f === "position" || f === "condition") e[f] = ch.to;
    else if (f) e[f] = /^(none|nothing|nobody|empty|no\b)/i.test(ch.to) ? null : ch.to;
    else e.condition = `${e.condition}; ${ch.attr}: ${ch.to}`;
  }
  return out;
}
// A post-generation step never kills the run: the error is logged and the page is still written.
async function step(name, fn) { try { await fn(); return true; } catch (e) { console.error(`  ${name}: ${e.message}`); (log.errors ??= []).push({ step: name, error: String(e.message), cause: String(e.cause?.message ?? e.cause ?? "") }); stamp(); page(); return false; } }
// Frame k (0-based) of a video as PNG.
const frameAt = (video, k, out) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vf", `select=eq(n\\,${k})`, "-frames:v", "1", "-update", "1", out]);
const clipPrompt = (shot) => {
  const fx = shot.sound.effects.map((x) => `${x.text} at ${x.at_s}s`).join(", ");
  const motion = shot.link === "continuous" && !/^still/i.test(shot.motion_in) ? `Already in motion: ${shot.motion_in}. ` : "";
  return `${motion}${shot.action} ${shot.camera} Sound: ${shot.sound.ambient}${fx ? `; ${fx}` : ""}. No music, no speech.`;
};

if (!remix) {
  // Reset the per-run records before the first step that can write to them: anchors now report failures into log.errors,
  // so clearing it after that step would erase the very error the run needs to show.
  log.carry ??= {}; log.trims ??= {}; log.errors = []; log.done ??= {};

  // 2. Anchors.
  (await gate("anchors", "identity sheets, scale anchors and location plates", { note: plan.entities.map((e) => `${e.name} (${e.kind}) size: ${e.size}${e.scale_partner ? ` · scale partner: ${e.scale_partner}` : ""}`).join("\n") }))({});
  // Anchors are the foundation: every later keyframe references them. A failure here is recorded and the page is written
  // (it used to throw straight out of the process, losing the record), and the shots are skipped rather than generated
  // against missing references — that would spend the whole clip budget on frames that cannot be right.
  const anchorsOk = await step("anchors", () => anchors(run, plan, memory));
  if (!anchorsOk) console.error("  anchors failed — skipping the shots; fix the anchor errors in run.json and re-run");
  stamp();

  // 3. Shots in story order (memory conditions each cut on what came before).
  for (const [k, scene] of (anchorsOk ? scenes : []).entries()) {
    let start = null, lastEntry = null;
    for (const [i, shot] of scene.entries()) {
      try {
        const afterShot = await gate(`shot ${shot.id}`, `[${shot.link}] ${shot.location} · ${shot.seconds}s · ${shot.action}`,
          { note: `${shot.start.description}\ncamera: ${shot.camera}\nsound: ${shot.sound.ambient}` });
        // A done shot is replayed: its start decision is final, its clip exists; memory is re-read (vision cached).
        const done = !!log.done[shot.id] && run.has(`${shot.id}.mp4`) && run.has(`${shot.id}-last.png`);
        if (i === 0) {
          const kf = await cutKeyframe(run, plan, memory, shot);
          start = kf.file; lastEntry = kf.entry;
        } else if (done && log.carry[shot.id]?.repaired) {
          start = `${shot.id}-start.png`;
          lastEntry = await memory.record({ file: start, shot, role: "start", expected: shot.start.entities, sources: Object.fromEntries(shot.start.entities.map((e) => [e.name, lastEntry?.id ?? null])) });
        } else {
          const prev = scene[i - 1];
          start = `${prev.id}-last.png`;
          const missing = run.estimate || done ? [] : memory.needed(shot, lastEntry);
          log.carry[shot.id] = { needed: shot.start.entities.map((e) => e.name), missing, repaired: false };
          if (missing.length) {
            start = await repairStart(run, plan, memory, shot, `${prev.id}-last.png`, missing);
            log.carry[shot.id].repaired = true;
            lastEntry = await memory.record({ file: start, shot, role: "start", expected: shot.start.entities, sources: Object.fromEntries(shot.start.entities.map((e) => [e.name, lastEntry?.id ?? null])) });
            console.log(`  ${shot.id}: ${missing.join(", ")} missing from the last frame → repaired start frame`);
          }
        }
        const prompt = clipPrompt(shot);
        const clip = await run.job(`clip:${shot.id}`, `${shot.id}.mp4`, { prompt, seconds: shot.seconds, model: VIDEO }, [start], COST.video_s * shot.seconds,
          // The clip's model follows the shot: its sound cue decides audio, the shot decides length. No end frame.
          () => run.video(`${caseId} ${shot.id}`, prompt, start, shot.seconds, `${shot.id}.mp4`, { audio: !!VIDEO.audio, endFrame: false, seconds: shot.seconds, resolution: VIDEO.resolution || null }));
        if (run.estimate) { if (run.dirty.has(clip)) run.dirty.add(`${shot.id}-last.png`); continue; } // a cached clip keeps its last frame
        // Real last frame = the last frame before the end settle (so the next continuous clip does not start from a frozen pose).
        firstFrame(run.path(clip), run.path(`${shot.id}-first.png`));
        const profile = motionProfile(run.path(clip));
        const tail = Math.max(settleAtEnd(profile), snapAtEnd(profile));
        frameAt(run.path(clip), profile.length - tail, run.path(`${shot.id}-last.png`));
        run.touch(`${shot.id}-first.png`); run.touch(`${shot.id}-last.png`);
        log.trims[shot.id] = { tail, frames: profile.length + 1, median_motion: Number((profile.slice().sort((a, b) => a - b)[profile.length >> 1] || 0).toFixed(2)) };
        contactSheet(run.path(clip), run.path(`${shot.id}-strip.jpg`));
        // Closed loop: observe the real last frame into memory; persisted changes open a new entity version (+ anchor for appearance changes).
        const sources = Object.fromEntries(shot.start.entities.map((e) => [e.name, lastEntry?.id ?? null]));
        lastEntry = await memory.record({ file: `${shot.id}-last.png`, shot, role: "last", expected: endState(shot), sources });
        // A new anchor version only when the entity is seen again later (fixtures carry their state through the bank frames instead).
        const later = (n) => plan.shots.slice(plan.shots.findIndex((x) => x.id === shot.id) + 1).some((x) => x.start.entities.some((e) => e.name === n));
        for (const req of memory.persist(shot)) if (!E[req.name]?.fixture_of && later(req.name) && (req.from_anchor || req.from_frame)) await versionAnchor(run, plan, memory, req);
        log.done[shot.id] = true;
        afterShot({ files: [`${shot.id}.mp4`, `${shot.id}-last.png`] });
        stamp(); page();
      } catch (e) {
        console.error(`  scene ${k + 1} shot ${shot.id}: ${e.message}`);
        log.errors.push({ scene: k + 1, shot: shot.id, error: String(e.message), cause: String(e.cause?.message ?? e.cause ?? ""), at: String(e.stack).split("\n").slice(1, 4).join(" | ") }); stamp();
        if (e instanceof StopRun) { log.stopped = String(e.message); stamp(); page(); console.log(`STOP: ${e.message}`); break; }
        if (/402|budget/.test(String(e))) { page(); process.exit(2); }
        break;
      }
    }
  }
  if (run.estimate) {
    const total = run.estimated.reduce((n, j) => n + j.cost, 0);
    console.log(run.estimated.map((j) => `  would run ${j.key} (${j.cost})`).join("\n"));
    console.log(`estimate: ${total} credits; ledger so far ${ledger().spent} of ${CAP}`);
    process.exit(0);
  }

  // 4. Stitch: trims at continuous joins, xfade on continuous joins, hard cuts; measures before (hard concat) and after.
  await step("stitch", async () => {
  (await gate("stitch", "trims, joins and seam measures", {}))({});
  const ids = scenes.flat().map((s) => s.id).filter((id) => run.has(`${id}.mp4`));
  const links = ids.map((id) => plan.shots.find((s) => s.id === id).link);
  const clipsIn = ids.map((id) => ({ id, file: run.path(`${id}.mp4`), location: plan.shots.find((s) => s.id === id).location }));
  const before = stitch({ runDir: run.dir, clips: clipsIn, links, out: "before.mp4", audio: true, xfadeFrames: 0, trim: false });
  const after = stitch({ runDir: run.dir, clips: clipsIn, links, out: "picture.mp4", audio: true, xfadeFrames: XFADE, trim: true });
  const timeline = after.segments.map((sg, i) => ({ id: sg.id, start_s: sg.start, end_s: i + 1 < after.segments.length ? after.segments[i + 1].start : after.duration, location: clipsIn[i].location }));
  log.stitch = { timeline, duration: after.duration, trims: Object.fromEntries(after.plan.map((p, i) => [ids[i], { head: p.headTrim, tail: p.tailTrim, duplicate: !!p.duplicate, stall: p.stall ?? 0, pick: p.pick ?? 0, fit: p.fit }])),
    config: { xfadeFrames: XFADE, trim: true, rule: "head = best-fitting of the first 6 frames vs the source frame (skips wan's dark frame 0) + stalled frames; tail = settle or end snap; continuous joins only" } };
  log.measures = {
    before: measureJoins({ runDir: run.dir, clips: clipsIn, links, final: "before.mp4" }),
    after: measureJoins({ runDir: run.dir, clips: clipsIn, links, final: "picture.mp4", starts: after.starts, xfade: after.plan.map((p) => p.xfade || 0) }),
  };
  for (const id of ids) (log.measures.clips ??= {})[id] = { first_vs_start: ssim(run.path(`${id}-first.png`), run.path(log.jobs[`clip:${id}`].start), { fit: true }) };
  // Text layers (exact text via headless Chrome).
  if (plan.layers?.length) {
    const luma = (t) => Number((spawnSync("ffmpeg", ["-ss", String(t), "-i", run.path("picture.mp4"), "-frames:v", "1", "-vf", "format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/YAVG=([\d.]+)/) || [])[1] || 0);
    const pngs = plan.layers.map((l, k) => renderText(l, run.path(`text-${k + 1}.html`), run.path(`text-${k + 1}.png`), { dark: luma((l.start_s + l.end_s) / 2) > 150 }));
    const chain = plan.layers.map((l, k) => `[${k + 1}:v]format=rgba,fade=t=in:st=${l.start_s}:d=0.4:alpha=1,fade=t=out:st=${Math.max(l.start_s, l.end_s - 0.4)}:d=0.4:alpha=1[t${k}];[${k === 0 ? "0:v" : `o${k - 1}`}][t${k}]overlay=0:0:shortest=1:enable='between(t,${l.start_s},${l.end_s})'${k === plan.layers.length - 1 ? "[v]" : `[o${k}]`}`).join(";");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", run.path("picture.mp4"), ...pngs.flatMap((p) => ["-loop", "1", "-i", p]), "-filter_complex", chain,
      "-map", "[v]", "-map", "0:a?", "-c:a", "copy", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", run.path("picture-text.mp4")]);
    copyFileSync(run.path("picture-text.mp4"), run.path("picture.mp4"));
  }
  });
  stamp(); page();
}

// 5. Audio agent: cue sheet (cues.json, editable; --remix re-renders from it) → beds → score → VO → mix → final.mp4.
const timeline = log.stitch?.timeline || [];
await step("audio", async () => {
  (await gate("audio", "cue sheet → beds, score, voiceover, mix", {}))({});
  // A fresh run rebuilds cues.json from the plan and timeline; --remix keeps the edited file.
  const audio = await renderAudio(run, { plan, timeline, picture: "picture.mp4", out: "final.mp4", cues: remix ? undefined : cueSheet(plan, timeline, run.path("cues.json")) });
  log.cues = audio.cues;
  log.audio = { beds: audio.beds, score: audio.score, voiceovers: (audio.voiceovers || []).map((v) => v.file), mix: audio.mix?.filter?.slice(0, 2000),
    gaps: ["No music or sound-effect endpoint on this API: the score is an ffmpeg-synthesised placeholder pad driven by the music cues; swap audio/score.wav for a real track and run --remix.",
      "Sound effects are generated inside each clip by wan-3.0 from the clip prompt; the sfx cues mark where they were asked for, they are not separate tracks.",
      ...(plan.audio.voiceover.length ? [] : ["No narration in this story: the TTS path (ai-voice-generator) was not exercised."])] };
});
stamp();

// 6. Judge on the compiled cut (stale when the timeline changed; --rejudge forces it).
const stale = !log.judge || JSON.stringify((log.judge.shots || []).map((s) => s.id)) !== JSON.stringify(timeline.map((t) => t.id));
if (!remix || stale || rejudge) await step("judge", async () => {
  (await gate("judge", "VLM scoring of the compiled cut", {}))({});
  const ids = timeline.map((t) => t.id);
  log.judge = await judgeCut(run, plan, { shots: ids.map((id) => ({ id, clip: `${id}.mp4`, strip: `${id}-strip.jpg`, startFrame: log.jobs[`clip:${id}`]?.start, lastFrame: `${id}-last.png`, link: plan.shots.find((s) => s.id === id).link })) });
});
stamp(); page();
console.log(JSON.stringify({ credits: log.total_credits, ledger: log.ledger_spent, elapsed_s: log.elapsed_s, errors: log.errors, reward: log.judge?.reward, joins: log.measures?.after?.joins }, null, 1));
sup?.finish({ credits: log.total_credits, elapsed_s: log.elapsed_s, reward: log.judge?.reward, stopped: log.stopped });
console.log(`page: ${run.path("index.html")}`);
if (sup) console.log("  test machine still serving; ctrl-c to close.");
