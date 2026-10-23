// Panels pipeline (draft v3): approved screenplay (with sound) → storyboard panels (one LLM call per scene, in parallel) → the
// one hard rule (every element has a source, code) → keyframes, each an edit of the latest frame of its environment with only
// what changes; entering elements come from the latest frame that shows them, else their sheet, else their text spec.
// Retries only for real breaks: missing or duplicated character, element not removed, impossible picture, not a single frame,
// re-painted frame (framing gate, code). Pose and expression are notes, never retries.
// Reuses the source run's ids, environments, sheets and plates (no repaint).
// Usage: node cleaned/panels.mjs --from custom-rrh4 --label rrh5 [--estimate] [--panels N]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "./src/env.js";
import { jsonCall, S, usage } from "./src/llm.js";
import { Jobs, CAP } from "./src/jobs.js";
import { Tracker } from "./src/tracker.js";
import { framing } from "./src/clips.js";
import { frameStyle } from "./src/seed.js";
import { storyboardScene, checkPanels } from "./src/storyboard.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const from = opt("--from", "custom-rrh4"), name = `custom-${opt("--label", "rrh5")}`, estimate = args.includes("--estimate"), only = Number(opt("--panels", 0));
const src = JSON.parse(readFileSync(join(RUNS, from, "run.json"), "utf8")), dir = join(RUNS, name);
for (const d of ["", "roots", "frames"]) mkdirSync(join(dir, d), { recursive: true });
const logFile = join(dir, "run.json");
const run = { name, estimate, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
run.save = () => { if (!estimate) writeFileSync(logFile, JSON.stringify(run.log, null, 2)); };
const jobs = new Jobs(run, { estimate }), tracker = new Tracker(run), t0 = Date.now();

// Reused from the source run: ids, specs, sheets, plates (files copied; their jobs are not redone).
const ent = Object.fromEntries(src.world.entities.map((e) => [e.id, { ...e, ...(src.asset_specs?.find((a) => a.id === e.id) || {}) }]));
const envs = src.seed_plan.places.filter((p) => src.seed[p.id]);
for (const [id, a] of Object.entries(src.assets)) { copyFileSync(join(RUNS, from, a.file), run.path(a.file)); tracker.roots[id] = a.file; }
for (const e of envs) { const p = src.seed[e.id]; copyFileSync(join(RUNS, from, p.plate), run.path(p.plate)); tracker.addPlate(e.id, p.plate, p.contents || []); }
const sp = src.screenplay_sound || src.screenplay_approved;
Object.assign(run.log, { name, from, screenplay: sp, cap: CAP, started_at: new Date().toISOString(), errors: [] });

// 1. Storyboard, all scenes in parallel; a scene whose panels break the hard rule is redone once with the violations.
console.log(`${name}: storyboard (${sp.scenes.length} scenes in parallel)…`);
const ctx = { assets: Object.values(ent).map((e) => ({ id: e.id, name: e.name })), envs };
let board = run.log.board ??= await Promise.all(sp.scenes.map((sc, i) => storyboardScene(sc, i + 1, ctx)));
let bad = checkPanels(board);
if (bad.length && !run.log.board_fixed) {
  console.log(`  hard rule: ${bad.length} violation(s); redoing those scenes`);
  board = await Promise.all(board.map(async (b, i) => {
    const mine = bad.filter((x) => x.startsWith(`scene ${i + 1} `));
    if (!mine.length) return b;
    // Redo this scene with the violations as a note after its beats.
    return storyboardScene({ ...sp.scenes[i], beats: [...sp.scenes[i].beats, { kind: "action", who: "", text: `(Storyboard note: fix these: ${mine.join("; ")}. Every element must be in the previous panel, introduced by a beat, or moving in.)`, sfx: "" }] }, i + 1, ctx);
  }));
  run.log.board = board; run.log.board_fixed = true; bad = checkPanels(board);
}
run.log.board_violations = bad; run.save();

// 2. Panels → slides (one keyframe each), in order.
const slides = [];
board.forEach((b, i) => b.panels.forEach((p, j) => slides.push({
  n: slides.length + 1, scene: i + 1, first: j === 0, location: b.environment, present: [...new Set(p.elements)].filter((id) => ent[id]),
  what: p.what_we_see, changes: p.changes, intro: p.introductions,
  beats: p.beats.map((k) => sp.scenes[i].beats[k - 1]).filter(Boolean), ambience: sp.scenes[i].ambience, music: sp.scenes[i].music,
})));
const panelCount = slides.length, todo = only ? slides.slice(0, only) : slides;
console.log(`  ${panelCount} panels in ${board.length} scenes · hard rule: ${bad.length ? bad.length + " violation(s): " + bad.join("; ") : "every element has a source"}`);
console.log(`  panels per scene: ${board.map((b) => b.panels.length).join(", ")}`);
// The older page and video code read these fields.
const plan = { title: sp.title, entities: Object.values(ent), locations: envs.map((e) => ({ id: e.id, name: e.id })), slides: slides.map((s) => ({
  ...s, caption: s.what, ste: [s.what], kind: s.first ? "establish" : "act", cast: s.present.map((id) => { const c = s.changes.find((x) => x.id === id); return { id, where: c?.to || "", acting: [c?.pose, c?.expression].filter(Boolean).join("; ") }; }),
  changed: s.changes.map((c) => c.id), change: "" })) };
run.log.plan = plan; run.save();

// 3. Keyframes.
const name_ = (id) => ent[id]?.name || id, SLOTS = 10, MAX = 3;
function panelPrompt(s, base, add, remove) {
  const imgs = [], lines = [];
  let k = 2;
  const packed = (id) => ent[id]?.inside && s.present.includes(ent[id].inside);
  const byFrame = new Map(), fresh = [];
  for (const id of add) { if (packed(id)) continue; const seen = tracker.lastSeen(id, s.n); if (seen) byFrame.set(seen.id, [...(byFrame.get(seen.id) || []), id]); else fresh.push(id); }
  for (const [fid, ids] of byFrame) { if (k > SLOTS) break; const f = tracker.get(fid), nm = ids.map(name_).join(" and "); for (const id of ids) imgs.push({ id, file: f.file, from: fid }); lines.push(`Add ${nm}: copy exactly how ${nm} look${ids.length > 1 ? "" : "s"} in image ${k}; use only ${nm} from image ${k++}.`); }
  for (const id of fresh) {
    if (tracker.roots[id] && k <= SLOTS) { imgs.push({ id, file: tracker.roots[id], from: "sheet" }); lines.push(`Add ${name_(id)}: they must look exactly like image ${k++} (ignore its plain background and pose).`); }
    else lines.push(`Add ${name_(id)}: ${ent[id]?.spec || name_(id)}.`);
  }
  for (const id of remove) lines.push(`Remove ${name_(id)} completely; show the place behind where they were.`);
  for (const c of s.changes) if (base.present.includes(c.id) && !remove.includes(c.id))
    lines.push(`${name_(c.id)}, already in image 1: move from ${c.from || "where they are"} to ${c.to || "where they are"}${[c.pose, c.expression].filter(Boolean).length ? `; ${[c.pose, c.expression].filter(Boolean).join("; ")}` : ""}. There is exactly one ${name_(c.id)}.`);
  const prompt = `Edit image 1. Change ONLY what this moment needs. Everyone and everything else stays exactly as in image 1: the same place,
furniture and objects, light and colours, and the same framing (same zoom, same crop, same edges).
This moment: ${s.what}
${lines.join("\n")}
Every character appears exactly once. Style: ${frameStyle(sp.style || src.world.style)}. One single frame, no text.`;
  return { prompt, imgs };
}
const CHECK = (ids) => S.obj({ counts: S.obj(Object.fromEntries(ids.map((id) => [id, S.int]))), impossible: S.bool, single_frame: S.bool, problems: S.str });
async function checkFrame(file, s, removed) {
  const ids = [...new Set([...s.present, ...removed])].filter((id) => ent[id]?.kind !== "prop");
  const r = await jsonCall({ name: "panel-check", effort: "medium", images: [file], schema: CHECK(ids),
    prompt: `This is one frame of an illustrated story. counts: how many times each of these appears (0 if not visible):
${ids.map((id) => `- ${id}: ${name_(id)}${ent[id]?.spec ? ` (${ent[id].spec.slice(0, 160)})` : ""}`).join("\n")}
impossible: true only if something is physically impossible (extra limbs, a body through furniture, floating). single_frame: one
picture (not a grid or comic). problems: one short sentence naming what is wrong, or "".` });
  const f = [];
  for (const id of ids) {
    const n = r.counts[id] ?? 0;
    if (s.present.includes(id) && n === 0) f.push({ id, kind: "missing" });
    if (s.present.includes(id) && n > 1 && ent[id]?.kind === "character") f.push({ id, kind: "duplicated" });
    if (removed.includes(id) && n > 0) f.push({ id, kind: "not removed" });
  }
  if (r.impossible) f.push({ id: null, kind: `physically impossible: ${r.problems}` });
  if (!r.single_frame) f.push({ id: null, kind: "not a single frame" });
  return { obs: r, faults: f };
}

try {
  for (const s of todo) {
    console.log(`panel ${s.n} (scene ${s.scene}): ${s.what.slice(0, 120)}`);
    const { frame: base0, why } = tracker.baseFor(s);
    let base = base0, best = null;
    const attempts = [];
    for (let a = 1; a <= MAX; a++) {
      const add = s.present.filter((id) => !base.present.includes(id)), remove = base.present.filter((id) => !s.present.includes(id) && ent[id]);
      const { prompt, imgs } = panelPrompt(s, base, add, remove);
      const file = `frames/p${s.n}-a${a}.png`;
      await jobs.image(`p${s.n}-a${a}`, file, prompt, [base.file, ...new Set(imgs.map((x) => x.file))]);
      if (estimate) { best = { file, faults: [], present: s.present, refs: [], a }; break; }
      const { obs, faults } = await checkFrame(run.path(file), s, remove);
      obs.framing = framing(run.path(file), run.path(base.file));
      if (obs.framing.changed) faults.push({ id: null, kind: `framing changed (SSIM ${obs.framing.ssim}, corners ${obs.framing.corner_shift})` });
      const att = { a, file, base: base.id, base_file: base.file, add, remove, keep: [], change: "", refs: imgs.map((x) => ({ id: x.id, file: x.file, from: x.from })), prompt, obs, faults, present: s.present, hops: base.hops + 1 };
      attempts.push(att);
      console.log(`  panel ${s.n} try ${a}: base ${base.id}, +[${add}] -[${remove}] → ${faults.length ? faults.map((x) => `${x.id || ""} ${x.kind}`.trim()).join(", ") : "pass"}`);
      const cost = (fs) => fs.reduce((n, x) => n + (/^framing|^not a single/.test(x.kind) ? 10 : 1), 0);
      if (!best || cost(faults) < cost(best.faults)) best = att;
      if (!faults.length) break;
    }
    tracker.add({ slide: s.n, file: best.file, location: s.location, present: [...s.present], observed: best.present, base: best.base, refs: best.refs || [],
      op: "edit", hops: best.hops || 1, accepted: true, forced: (best.faults || []).length > 0, base_why: why, attempts });
  }
} catch (e) { run.log.errors.push(String(e.stack || e)); console.error(`stopped: ${e.message}`); }
const frames = tracker.frames.filter((f) => f.op === "edit");
run.log.summary = { panels: panelCount, built: frames.length, passed: frames.filter((f) => !f.forced).length, first_try: frames.filter((f) => !f.forced && f.attempts.length === 1).length,
  forced: frames.filter((f) => f.forced).map((f) => f.slide), attempts: frames.reduce((n, f) => n + f.attempts.length, 0), credits: jobs.spent(), llm: usage, wall_s: Math.round((Date.now() - t0) / 1000) };
run.save(); tracker.save();
if (estimate) console.log(`estimate: ${jobs.estimated.length} keyframes, ${jobs.estimated.reduce((n, j) => n + j.cost, 0)} credits on first tries (a retry adds 200); video at 5 s per panel on wan-3.0 ≈ ${panelCount * 5 * 96} credits`);
else console.log(`done: ${JSON.stringify(run.log.summary)}`);
