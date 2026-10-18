// S4 Builder: a slide's frame = its base frame edited with the roots of what is missing, keeping everything else.
// 1 + k first (all missing entities in one edit); a retry builds on a partial success and adds only what is still missing,
// one at a time (1 + 1). At most MAX attempts; the best attempt is kept, and flagged `forced` if none passed.
import { verify, faults, verifyStep, stepFaults } from "./verify.js";
import { framing } from "./clips.js";
import { frameStyle } from "./seed.js";

const MAX = 3, SLOTS = 10;

// Blocking slides: the prompt names only what changes (who moves, from which mark, to which mark, by which mark; pose and
// expression), plus what is added or removed. Everyone else is "as in image 1", never restated, so the editor has less to redo.
function blockPrompt(plan, slide, { add, remove, keep, change, retryNote }) {
  const ent = Object.fromEntries(plan.entities.map((e) => [e.id, e]));
  const loc = plan.locations.find((l) => l.id === slide.location), cast = Object.fromEntries(slide.cast.map((c) => [c.id, c]));
  const imgs = [], lines = [];
  let k = 2;
  for (const id of add) { imgs.push(id); lines.push(`Add ${ent[id].name}: they must look exactly like image ${k++} (identity, face, fur or hair, clothing, colours, proportions; ignore that image's pose and plain background).`); }
  const refKeep = keep.filter((id) => k <= SLOTS && ent[id].kind !== "prop" && slide.changed.includes(id));
  for (const id of refKeep) { imgs.push(id); lines.push(`${ent[id].name} is already in image 1; image ${k++} is their identity reference — keep them looking like it.`); }
  for (const id of remove) lines.push(`Remove ${ent[id].name} completely; show the place behind where they were.`);
  for (const b of slide.beats) {
    if (b.action === "vanish" || remove.includes(b.actor)) continue;
    const c = cast[b.actor];
    if (!c) continue;
    lines.push(`${ent[b.actor].name}: now ${c.where}${b.via ? `, having gone around ${b.via_text} (never through it)` : ""}.${c.acting ? ` Body and face: ${c.acting}.` : ""}${ent[b.actor].kind !== "prop" ? " Take the pose and expression from this text, not from any reference image." : ""}`);
  }
  if (change) lines.push(`Change: ${change}`);
  const prompt = `Edit image 1, a frame of ${loc.name}. Change ONLY what is listed below. Everyone and everything else stays exactly as in image 1: same people in the same places and poses, same furniture and objects, same light and colours, and the same framing: same zoom, same crop, same edges and border.
${lines.join("\n")}
${retryNote ? `Fix from the last try: ${retryNote}\n` : ""}Style: ${frameStyle(plan.style)}. One single frame, not a grid or collage, no text.`;
  return { prompt, imgs };
}

function editPrompt(plan, slide, { base, add, remove, keep, change, retryNote }) {
  const name = Object.fromEntries(plan.entities.map((e) => [e.id, e.name]));
  const loc = plan.locations.find((l) => l.id === slide.location);
  const imgs = [], lines = [];
  let k = 2;
  for (const id of add) { imgs.push(id); lines.push(`Add ${name[id]}: they must look exactly like image ${k++} (identity, face, fur or hair, clothing, colours, proportions; ignore that image's pose and plain background).`); }
  const refKeep = keep.filter((id) => k <= SLOTS && plan.entities.find((e) => e.id === id).kind !== "prop");
  for (const id of refKeep) { imgs.push(id); lines.push(`${name[id]} is already in image 1; image ${k++} is their identity reference — keep them looking like it.`); }
  for (const id of remove) lines.push(`Remove ${name[id]} completely; show the place behind where they were.`);
  if (change) lines.push(`Change: ${change}`);
  // Position and acting come from the slide, never from a reference image (references are for identity only).
  for (const c of slide.cast || []) if (plan.entities.find((e) => e.id === c.id)?.kind !== "prop")
    lines.push(`${name[c.id]}: ${c.where}. Expression and body: ${c.acting}. Take the expression and pose from this text, not from any reference image.`);
  const prompt = `Edit image 1, a frame of ${loc.name}. Keep everything in image 1 that is not named below exactly as it is: the place, the furniture and objects and their current state, the light, the colours and the camera framing.
${lines.join("\n")}
The frame should show: ${slide.shows}
${retryNote ? `Fix from the last try: ${retryNote}\n` : ""}Style: ${plan.style}. One single frame, not a grid or collage, no text.`;
  return { prompt, imgs };
}

export async function buildSlide(slide, { plan, tracker, jobs, run }) {
  const { frame: base0, why } = tracker.baseFor(slide);
  if (!base0) throw new Error(`slide ${slide.n}: ${why}`);
  const attempts = [];
  let base = base0, retryNote = "", best = null;
  for (let a = 1; a <= MAX; a++) {
    const add0 = slide.present.filter((id) => !base.present.includes(id));
    const add = a > 1 && best?.gain ? add0.slice(0, 1) : add0;              // 1 + 1 after a partial success
    const remove = base.present.filter((id) => !slide.present.includes(id));
    const keep = slide.present.filter((id) => base.present.includes(id));
    const change = base.changeDone ? "" : slide.change;                       // a change already made on the base is not redone
    const blocking = !!slide.beats;
    const { prompt, imgs } = (blocking ? blockPrompt : editPrompt)(plan, slide, { base, add, remove, keep, change, retryNote });
    const file = `frames/s${slide.n}-a${a}.png`, inputs = [base.file, ...imgs.map((id) => tracker.roots[id])];
    await jobs.image(`s${slide.n}-a${a}`, file, prompt, inputs);
    const ask = [...new Set([...slide.present, ...base.present])];
    const obs = run.estimate ? { entities: ask.map((id) => ({ id, present: slide.present.includes(id), count: 1, note: "" })), actors: [], change_visible: true, single_frame: true, problems: "" }
      : blocking ? await verifyStep(run.path(file), { plan, slide, ask })
      : await verify(run.path(file), { plan, ask, change: slide.change, shows: slide.shows, cast: slide.cast });
    const f = blocking ? stepFaults(obs, { plan, wanted: slide.present, remove, slide }) : faults(obs, { plan, wanted: slide.present, remove, change: slide.change, cast: slide.cast });
    // Framing gate (blocking runs): an edit that re-paints the whole picture is rejected, whatever the vision check says.
    if (blocking && !run.estimate) { obs.framing = framing(run.path(file), run.path(base.file)); if (obs.framing.changed) f.push({ id: null, kind: `framing changed (SSIM ${obs.framing.ssim}, corners ${obs.framing.corner_shift})` }); }
    const present = obs.entities.filter((e) => e.present).map((e) => e.id);
    const att = { a, file, base: base.id, base_file: base.file, add, remove, keep, change, refs: imgs.map((id) => ({ id, file: tracker.roots[id] })), prompt, obs, faults: f, present, hops: base.hops + 1 };
    attempts.push(att);
    console.log(`  slide ${slide.n} try ${a}: base ${base.id}, +[${add}] -[${remove}]${change ? " Δ" : ""} → ${f.length ? f.map((x) => `${x.id || ""} ${x.kind}`.trim()).join(", ") : "pass"}`);
    const gain = add.some((id) => present.includes(id));
    if (!best || f.length < best.faults.length) best = { ...att, gain };
    if (!f.length) break;
    retryNote = f.map((x) => (x.id ? `${plan.entities.find((e) => e.id === x.id).name} ${x.kind}` : x.kind)).join("; ") + (obs.problems ? `; ${obs.problems}` : "");
    // Build on a partial success: it already holds some of what was added (and the change, if visible).
    if (gain && f.every((x) => x.kind === "missing" || x.kind === "change not visible") && obs.single_frame)
      base = { id: `s${slide.n}-a${a}`, file, present, hops: att.hops, changeDone: !slide.change || obs.change_visible };
  }
  const frame = tracker.add({ slide: slide.n, file: best.file, location: slide.location, present: best.present, base: best.base, refs: best.refs,
    op: "edit", hops: best.hops, accepted: true, forced: best.faults.length > 0, base_why: why, attempts });
  return frame;
}
