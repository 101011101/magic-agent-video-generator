// Key references pipeline (T-058 case 3, a separate test): see keyref.js.
// Usage: CLEANED_CAP=… node V2/backend/keyref/run.mjs --brief "…" --label keyref-1 --clips 2 --total 16 [--model minimax-h3] [--vres 480p]
//        [--budget 600: this run's own credit ceiling] [--audio on|off] [--dry: story, screenplay, state and every prompt, nothing paid]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../lib/env.js";
import { Jobs } from "../lib/jobs.js";
import { jsonCall, S, usage } from "../lib/llm.js";
import { video as videoModel } from "../lib/models.js";
import { runStory } from "../composer/story/story.js";
import { STILL, STILL_RES, clipLengths, writeScreenplay, checkBatches, ask, writePrompt, frameAt, stillCost, videoCost, duration, ssim, stitch } from "./keyref.js";
import { writePage } from "./page.mjs";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const brief = opt("--brief"), label = opt("--label"), N = Number(opt("--clips", 2)), TOTAL = Number(opt("--total", 16)), MODEL = opt("--model", "minimax-h3"), VRES = opt("--vres", "480p");
const BUDGET = Number(opt("--budget", 600)), AUDIO = opt("--audio", "on") !== "off", DRY = args.includes("--dry"), PAGE = opt("--page", null);
if (!brief || !label) { console.error("--brief and --label are required"); process.exit(2); }
const dir = join(RUNS, label); for (const d of ["", "refs", "clips", "frames"]) mkdirSync(join(dir, d), { recursive: true });
const recFile = join(dir, DRY ? "keyref-dry.json" : "keyref.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};
// the record: what this run did (rebuilt each pass) plus the job cache and the paid calls (kept: a rerun pays nothing twice)
const rec = { label, brief, at: new Date().toISOString(), dry: DRY, args: { clips: N, total: TOTAL, model: MODEL, resolution: VRES, audio: AUDIO, budget: BUDGET }, jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {}, tools: [], vlm: [], llm: [] };
const run = { name: label, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run, { estimate: DRY }), say = (m) => console.log(m);
const VIDEO = { model: MODEL, resolution: VRES, audio: AUDIO, aspect_ratio: "16:9" }, maxRefs = videoModel(MODEL).maxRefs;
const rel = (f) => ({ path: run.path(f), rel: f });
class Budget extends Error {}
const pay = (what, cost) => { if (jobs.spent() + cost > BUDGET) throw new Budget(`budget ${BUDGET}: ${what} (${cost}) would take this run to ${jobs.spent() + cost}`); };
const llm = (name, purpose) => rec.llm.push({ name, purpose, model: process.env.CLEANED_MODEL || "gpt-6.1-sol" });
const ff = (op, inputs, output) => rec.tools.push({ tool: "ffmpeg", op, inputs, output, credits: 0 });

// ---- story and screenplay ----
say("== story"); await runStory({ brief, log: rec, run, say, seconds: TOTAL }); llm("story", "research gate + story (composer/story)");
const { lengths, top, fits } = clipLengths(TOTAL, N, MODEL);
if (!fits) { console.error(`${TOTAL} s in ${N} clips (${lengths.join(" + ")}) does not fit ${MODEL}'s grid (max ${top} s a clip)`); process.exit(2); }
say(`== screenplay: ${N} batches of ${lengths.join(" + ")} s (${MODEL} carries up to ${top} s a call)`);
const sp = await writeScreenplay({ brief, story: rec.story, lengths, model: MODEL, say }); llm("keyref-screenplay-v1", "screenplay as clip batches + element table");
rec.screenplay = sp;
rec.batch_checks = checkBatches(sp, MODEL, sp.clips.map((c, i) => c.on_screen.filter((id) => sp.elements.find((e) => e.id === id)?.needs_reference).length + (i ? 1 : 0)));
say(rec.batch_checks.map((b) => `  clip ${b.clip}: ${b.ok ? "carried" : "NOT carried"} (${b.checks.map((x) => `${x.ok ? "ok" : "FAIL"} ${x.check}`).join("; ")})`).join("\n"));
if (!rec.batch_checks.every((b) => b.ok)) { run.save(); console.error("a batch is more than one call can carry; rewrite the screenplay"); process.exit(2); }
run.save();
const els = Object.fromEntries(sp.elements.map((e) => [e.id, e]));
for (const c of sp.clips) c.on_screen = c.on_screen.map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "")).filter((x) => els[x]);

// ---- the state manager: the element table and, per clip, the references it needs ----
const state = rec.state = {
  rules: [
    "An element gets a reference still only if the screenplay marks it as one the prose gets wrong and the film is judged on (the place with its sign, the product); made once, checked, reused.",
    "Clip 1 gets the reference stills of the referenced elements on screen in it.",
    "Clip k>1 always gets @previous, the last frame of clip k-1.",
    "Clip k>1 also gets a reference still when its element is lettered (exact text must be spelled), first appears in clip k, or is missing from @previous (asked of the vision model).",
    "A recurring person missing from @previous gets a frame of clip k-1 that shows them (picked by the vision model): no new still is painted for a person.",
    `At most ${maxRefs} references a call (${MODEL}).`,
  ],
  elements: sp.elements.map((e) => ({ id: e.id, kind: e.kind, name: e.name, look: e.look, lettering: e.lettering, needs_reference: e.needs_reference, why: e.why, clips: sp.clips.filter((c) => c.on_screen.includes(e.id)).map((c) => c.n), states: Object.fromEntries(sp.clips.map((c) => [c.n, c.states.find((s) => s.id === e.id)?.state]).filter(([, s]) => s)) })),
  references: {}, clips: [],
};
const refRole = (e) => `${e.kind === "place" ? "the place" : e.kind === "person" ? "the person" : "the product"}: ${e.name}${e.lettering.length ? `, lettered ${e.lettering.map((s) => `"${s}"`).join(", ")}` : ""}`;

// Solve one reference still: reuse it if made, else paint it on the free still model, ask the vision model the element's
// must_show facts, repaint once with the failures stressed if any fact is missing.
async function solveRef(e, why) {
  if (state.references[e.id]) { state.references[e.id].reused_by = [...(state.references[e.id].reused_by || []), why]; return state.references[e.id]; }
  const model = STILL[e.kind] || STILL.product, cost = stillCost(model, STILL_RES), file = `refs/${e.id}.png`, img = { model, resolution: STILL_RES, aspect_ratio: "16:9" };
  const prompt = e.reference_prompt || `${e.name}: ${e.look}`;
  if (DRY) { state.references[e.id] = { name: e.id, file, element: e.id, model, prompt, why: e.why, estimated: cost }; await jobs.image(`ref-${e.id}`, file, prompt, [], img); return state.references[e.id]; }
  pay(`ref-${e.id}`, cost);
  const j = await jobs.image(`ref-${e.id}`, file, prompt, [], img);
  rec.tools.push({ tool: "image generator", endpoint: "/v1/ai-image-generator", model, resolution: STILL_RES, inputs: [], prompt, credits: j.credits || 0, cached: !!j.cached, output: file, for: `reference @${e.id}` });
  const qs = e.must_show.map((f) => `Does this image show: ${f}?`);
  let v = await ask({ rec, stage: "reference", about: `@${e.id} attempt 1`, questions: qs, images: [rel(file)], labels: [`@${e.id}`] }), best = { file, v, prompt, attempt: 1 };
  if (!v.pass) {
    const missing = v.answers.filter((a) => a.answer !== "yes").map((a) => a.q.replace(/^Does this image show: |\?$/g, ""));
    const p2 = `${prompt} It must clearly show: ${missing.join("; ")}.`, f2 = `refs/${e.id}-2.png`;
    pay(`ref-${e.id}-2`, cost);
    const j2 = await jobs.image(`ref-${e.id}-2`, f2, p2, [], img);
    rec.tools.push({ tool: "image generator", endpoint: "/v1/ai-image-generator", model, resolution: STILL_RES, inputs: [], prompt: p2, credits: j2.credits || 0, cached: !!j2.cached, output: f2, for: `reference @${e.id}, repaint (missing: ${missing.join("; ")})` });
    const v2 = await ask({ rec, stage: "reference", about: `@${e.id} attempt 2`, questions: qs, images: [rel(f2)], labels: [`@${e.id}`] });
    const yes = (x) => x.answers.filter((a) => a.answer === "yes").length;
    if (yes(v2) > yes(v)) best = { file: f2, v: v2, prompt: p2, attempt: 2 };
  }
  state.references[e.id] = { name: e.id, file: best.file, element: e.id, model, prompt: best.prompt, why: e.why, attempt: best.attempt, check_pass: best.v.pass };
  run.save(); return state.references[e.id];
}

// Pick a frame of a made clip that shows a person clearly (the vision model chooses among a few), as their reference.
async function personFromClip(e, prevN) {
  const clip = run.path(`clips/clip-${prevN}.mp4`), d = duration(clip), ts = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95].map((x) => Math.round(x * d * 10) / 10), files = ts.map((t) => `frames/clip-${prevN}-pick-${t}.png`);
  ts.forEach((t, i) => frameAt(clip, t, run.path(files[i]))); ff(`${ts.length} frames of clip ${prevN} to pick ${e.id} from`, [`clips/clip-${prevN}.mp4`], files);
  const r = await jsonCall({ name: "keyref-pick-v1", effort: "low", images: files.map((f) => run.path(f)), schema: S.obj({ index: S.int, evidence: S.str }), prompt: `Which of the ${files.length} images (1–${files.length}) shows this person most clearly, face and clothes visible: ${e.name}, ${e.look}? Answer only the index and a few words of evidence.` });
  const i = Math.min(files.length, Math.max(1, r.index)) - 1;
  rec.vlm.push({ stage: "pick", about: `a frame of clip ${prevN} showing ${e.id}`, images: files, labels: ts.map((t) => `${t} s`), answers: [{ q: `Which image shows ${e.name} most clearly?`, answer: `image ${i + 1} (${ts[i]} s)`, evidence: r.evidence }], pass: true });
  return { name: e.id, file: files[i], element: e.id, source: `frame ${ts[i]} s of clip ${prevN}`, why: `${e.name} is missing from @previous; a frame of clip ${prevN} that shows them`, credits: 0 };
}

// ---- per clip: the references, the prompt, the call, the checks ----
const made = []; let stopped = null;
try {
  for (const clip of sp.clips) {
    const k = clip.n, prev = k > 1 ? sp.clips[k - 2] : null, refs = [], decisions = [];
    let missing = new Set();
    if (prev) {
      const last = `clips/clip-${k - 1}-last.png`;
      refs.push({ name: "previous", file: last, role: `the last frame of clip ${k - 1}`, why: "every clip after the first continues from the previous clip's last frame", source: `last frame of clip ${k - 1}` });
      decisions.push(`@previous = the last frame of clip ${k - 1}`);
      const carried = clip.on_screen.filter((id) => prev.on_screen.includes(id));
      if (!DRY) {
        const qs = [...carried.map((id) => `Is ${els[id].name} (${els[id].look}) visible in this frame?`), ...clip.continuity.map((c) => `Is this true in this frame: ${c}?`)];
        const v = await ask({ rec, stage: "last frame", about: `clip ${k - 1}'s last frame against what clip ${k} must continue`, questions: qs, images: [rel(last)], labels: [`last frame of clip ${k - 1}`] });
        carried.forEach((id, i) => { if (v.answers[i].answer !== "yes") missing.add(id); });
        decisions.push(missing.size ? `missing from @previous: ${[...missing].join(", ")}` : `everything clip ${k} carries over is in @previous (${carried.join(", ") || "nothing carried"})`);
      } else decisions.push("(dry run: the last frame is not made yet; assumed to carry every element of the previous clip)");
    }
    for (const id of clip.on_screen) {
      const e = els[id], first = !prev || !prev.on_screen.includes(id);
      if (e.needs_reference && (!prev || e.lettering.length || first || missing.has(id))) {
        const why = !prev ? e.why : e.lettering.length ? `lettered (${e.lettering.map((s) => `"${s}"`).join(", ")}): the exact text is fed again` : first ? `first appears in clip ${k}` : `missing from @previous`;
        const r = await solveRef(e, `clip ${k}: ${why}`);
        refs.push({ name: e.id, file: r.file, role: refRole(e), why, source: r.reused_by?.length ? `reused (painted on ${r.model} for an earlier clip)` : `painted on ${r.model}${r.attempt === 2 ? ", second attempt" : ""}` });
        decisions.push(`@${e.id}: ${why}`);
      } else if (prev && missing.has(id) && e.kind === "person" && !DRY) {
        const r = await personFromClip(e, k - 1); refs.push({ ...r, role: refRole(e) }); decisions.push(`@${e.id}: ${r.why}`);
      } else if (prev && missing.has(id) && !DRY) {
        const r = await solveRef({ ...e, reference_prompt: e.reference_prompt || `${e.name}: ${e.look}, on a plain surface, no people, photographic`, must_show: e.must_show.length ? e.must_show : [e.name] }, `clip ${k}: missing from @previous`);
        refs.push({ name: e.id, file: r.file, role: refRole(e), why: "missing from @previous", source: `painted on ${r.model}` }); decisions.push(`@${e.id}: missing from @previous, painted`);
      }
    }
    if (refs.length > maxRefs) { decisions.push(`capped at ${maxRefs} references`); refs.length = maxRefs; }
    const prompt = await writePrompt({ sp, clip, refs, model: MODEL, audio: AUDIO }); llm("keyref-prompt-v1", `prompt of clip ${k}`);
    state.clips.push({ n: k, seconds: clip.seconds, refs: refs.map(({ name, file, why, source, role }) => ({ name, file, why, source, role })), decisions, prompt, prompt_chars: prompt.length });
    run.save();
    say(`--- clip ${k} (${clip.seconds} s, ${prompt.length} chars) refs: ${refs.map((r) => `@${r.name}=${r.file}`).join(", ") || "none"}\n  ${decisions.join("\n  ")}\n${prompt}`);
    const file = `clips/clip-${k}.mp4`, cost = videoCost(clip.seconds, MODEL, VRES, AUDIO);
    if (DRY) { await jobs.tvideo(`clip-${k}`, file, prompt, refs.map(({ name, file }) => ({ name, file })), clip.seconds, VIDEO); continue; }
    pay(`clip-${k}`, cost);
    const j = await jobs.tvideo(`clip-${k}`, file, prompt, refs.map(({ name, file }) => ({ name, file })), clip.seconds, VIDEO);
    rec.tools.push({ tool: "text-to-video", endpoint: "/v1/text-to-video", model: MODEL, resolution: VRES, audio: AUDIO, seconds: clip.seconds, inputs: refs.map((r) => `@${r.name}=${r.file}`), prompt, credits: j.credits || 0, cached: !!j.cached, output: file, for: `clip ${k}` });
    // frames: the last (for the next clip), the opening three and the closing three (the continuity strip)
    const clipPath = run.path(file), d = duration(clipPath);
    frameAt(clipPath, -0.1, run.path(`clips/clip-${k}-last.png`));
    const openT = [0, 0.5, 1.0], closeT = [Math.max(0, d - 1.0), Math.max(0, d - 0.5), Math.max(0, d - 0.1)].map((t) => Math.round(t * 100) / 100);
    const opening = openT.map((t) => frameAt(clipPath, t, run.path(`frames/clip-${k}-open-${t}.png`)) && `frames/clip-${k}-open-${t}.png`);
    const closing = closeT.map((t) => frameAt(clipPath, t, run.path(`frames/clip-${k}-close-${t}.png`)) && `frames/clip-${k}-close-${t}.png`);
    const mid = `frames/clip-${k}-mid.png`; frameAt(clipPath, d / 2, run.path(mid));
    ff(`frames of clip ${k}: last, opening ${openT.join("/")} s, closing ${closeT.join("/")} s, middle`, [file], [`clips/clip-${k}-last.png`, ...opening, ...closing, mid]);
    const m = { n: k, file, seconds: clip.seconds, rendered: Math.round(d * 10) / 10, last: `clips/clip-${k}-last.png`, opening, closing, mid, openT, closeT, credits: j.credits || 0 };
    // checks of the made clip: (a) its opening against @previous and the continuity list
    if (prev) {
      const prevLast = `clips/clip-${k - 1}-last.png`, people = clip.on_screen.filter((id) => els[id].kind === "person" && prev.on_screen.includes(id));
      const qs = [...clip.continuity.map((c) => `In images 2 and 3 (the opening of the new clip): ${c}?`), ...people.map((id) => `Is ${els[id].name} in images 2–3 the same person as in image 1 (same face, hair and clothes)?`), "Is images 2–3 the same place, with the same light, as image 1?"];
      m.opening_check = await ask({ rec, stage: "clip opening", about: `clip ${k}'s opening against @previous and its continuity list`, questions: qs, images: [rel(prevLast), rel(opening[0]), rel(opening[2])], labels: [`@previous (last frame of clip ${k - 1})`, `clip ${k} at 0 s`, `clip ${k} at 1 s`] });
      m.ssim_join = ssim(run.path(prevLast), run.path(opening[0]));
    }
    // (b) what the state demanded is in the clip: each reference's facts, and the frame it must end on
    for (const r of refs.filter((x) => x.name !== "previous" && state.references[x.name])) {
      const e = els[r.name], qs = (e.must_show.length ? e.must_show : [e.name]).filter((f) => !/no people/i.test(f)).map((f) => `In images 2–3 (frames of the clip): ${f}?`);
      if (qs.length) await ask({ rec, stage: "clip vs reference", about: `clip ${k} shows @${r.name}`, questions: qs, images: [rel(r.file), rel(mid), rel(m.last)], labels: [`@${r.name} (the reference)`, `clip ${k} middle`, `clip ${k} last frame`] });
    }
    const letters = clip.on_screen.flatMap((id) => els[id].lettering);
    m.end_check = await ask({ rec, stage: "clip end", about: `clip ${k}'s last frame against what it must end on`, questions: [`Does this frame show: ${clip.ends_on}?`, ...letters.map((s) => `Is there lettering that reads exactly "${s}" in this frame? (transcribe what it reads)`)], images: [rel(m.last)], labels: [`last frame of clip ${k}`] });
    made.push(m); rec.outputs = { clips: made }; run.save();
    say(`  clip ${k}: ${m.rendered} s · ${j.credits || 0} credits${j.cached ? " (cached)" : ""}${m.ssim_join != null ? ` · SSIM @previous→first frame ${m.ssim_join}` : ""}`);
  }
} catch (e) { if (!(e instanceof Budget) && !/credit cap/.test(String(e))) throw e; stopped = String(e.message || e); say(`STOPPED: ${stopped}`); }

// ---- the stitch ----
if (DRY) {
  const est = jobs.estimated.reduce((a, b) => a + b.cost, 0);
  rec.estimate = { jobs: jobs.estimated, total: est, note: "plus any repaint (10) or reference added after the last-frame check" };
  say(`== dry run: ${jobs.estimated.map((x) => `${x.key} ${x.cost}`).join(", ")} → ${est} credits (budget ${BUDGET})`);
} else if (!stopped && made.length === N) {
  const film = "clips/film.mp4"; stitch(made.map((m) => run.path(m.file)), run.path("clips/concat.txt"), run.path(film));
  ff("stitch (normalise to 1280×720, loudnorm, concat)", made.map((m) => m.file), film);
  rec.outputs.film = film; rec.outputs.film_seconds = Math.round(duration(run.path(film)) * 10) / 10;
  say(`film: runs/${label}/${film} (${rec.outputs.film_seconds} s)`);
}
rec.stopped = stopped; rec.credits = jobs.spent(); rec.llm_usage = { ...usage }; run.save();
say(`credits this run: ${rec.credits}`);
if (PAGE && !DRY) { writePage(rec, PAGE); say(`page: ${PAGE}`); }
