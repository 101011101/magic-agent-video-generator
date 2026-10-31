// KEYFRAMES: the plan (one prompt per distinct still, from the state manager's tables and the template), then painting.
// A still is painted from its reference (the plate, the previous still, or the scene's master); a tighter setup of a painted
// master is first CUT from it (state.cropFor): the crop is the keyframe when it is at least 60% of the master's width, else
// the painter re-renders the crop at full detail. Every painted still goes through the people gate (count, order, boxes) and
// the room gate (arrangement against image 1 of the paint: the plate, the master or the previous still). Gates flag; nothing is remade here. --retry / --accept / --recheck are
// handled by the pipeline before this runs.
import { existsSync } from "node:fs";
import { crop as cropImage, bars, size as imageSize } from "../../lib/media.js";
import { captionCard } from "../../lib/captions.js";
import { execFileSync } from "node:child_process";
// A black 16:9 frame with the caption centred: the caption card (transparent) laid over black.
export function titleCard(text, out) { const tmp = out.replace(/\.png$/, "-text.png"); captionCard(text, tmp, { w: 1920, h: 1080, size: 56, at: "middle" }); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=1920x1080", "-i", tmp, "-filter_complex", "[0][1]overlay=0:0", "-frames:v", "1", "-update", "1", out]); return out; }
import { keyframePrompt, deltaEditPrompt, sameInstant } from "./template.js";
import { inFrame } from "../screenplay/screenplay.js";
import { WIDTH } from "../../lib/models.js";

export const CROP_DIRECT = 0.5;   // a crop at least this fraction of the master's width is used as the frame without painting…
export const MIN_CROP_PX = 1000;  // …and only when that is at least this many pixels wide: half of a 640px master is 320 px, which is no frame

export function planKeyframes(state, medium) {
  return state.stills.map((s) => {
    if (s.card) { const sc = state.script.scenes.find((x) => x.n === s.scene), cap = sc.captions.find((c) => c.at >= s.start_at && c.at < s.start_at + s.seconds_of); return { id: s.id, mode: "card", punchIn: false, images: [], prompt: `TITLE CARD (rendered by code, no model): black 16:9 frame with the caption centred:\n"${cap?.text || ""}"`, cropPrompt: null, caption: cap?.text || "" }; } const mode = s.envKind === "edit" ? "edit" : "paint"; const p = keyframePrompt({ still: s, state, medium, mode }); const alt = s.punchIn ? keyframePrompt({ still: s, state, medium, mode: "crop" }) : null; return { id: s.id, mode, punchIn: !!s.punchIn, images: p.images, prompt: p.prompt, cropPrompt: alt?.prompt || null }; });
}

// A REPAIR: when a still fails the load gate and nothing else, its retry is a removal edit of that very frame, not a new
// painting. Removing a thing from a picture is what editors do best; painting the whole frame again rolled the same dice
// (five approaches in a row grew a missile beside the bomb). remove: [{ host, keep: [names], attached: [what the gate saw] }].
export function repairPrompt(repair, medium) {
  // The count is said in numbers, and a duplicate of a kept thing is named as such: told to "keep only Vega's bomb" with a
  // bomb under each wing, the painter kept both, since either one is Vega's bomb.
  const lines = repair.remove.map((r) => `- ${r.host} carries exactly ${r.keep.length === 1 ? "ONE thing" : `${r.keep.length} things`}: ${r.keep.join(", ")}; that is ${r.keep.length} item${r.keep.length === 1 ? "" : "s"} in all, counting both sides. The picture shows attached to it: ${r.attached.join("; ")} (${r.attached.length} items). Remove ${Math.max(0, r.attached.length - r.keep.length)} of them so that exactly ${r.keep.length} remain${r.keep.length === 1 ? "s" : ""}: everything that is not in the first list, and any second copy of a listed thing (the same kind under the other wing or on the other side), leaving clean wing or body where it was; keep ${r.keep.length === 1 ? "the one listed thing" : "the listed things"} exactly as ${r.keep.length === 1 ? "it is" : "they are"}.`);
  return `REPAIR (from image 1)\nImage 1 is this exact frame; keep its camera, place, light, every person and vehicle, their positions and poses, and the finish exactly. Change only this:\n${lines.join("\n")}\n- Nothing else changes: no new thing appears anywhere, nothing moves.\n\nRULES\n${medium.treatment ? `${medium.treatment} ` : ""}${medium.frame} One frame filling the picture edge to edge, no black bars; no captions, titles or overlaid text.`;
}

export async function paintKeyframes({ state, jobs, medium, K, run, say = console.log, only = null, still: STILL = "nano-banana-pro", res: RES = "2k", cropDirect = CROP_DIRECT }) {
  K.painted ??= {}; K.attempts ??= {};
  // A reference never carries black bars: a painted still with thin bars is cropped to its picture before it is sent as
  // image 1 (the painter widened the thin bars of one frame into a full letterbox on the frame edited from it).
  const noBars = (f) => { const lb = bars(run.path(f)); if (!(lb.frac > 0 && lb.frac <= 0.1)) return f; const cf = f.replace(/\.png$/, "-nobars.png"); if (!existsSync(run.path(cf))) { const [W, H] = imageSize(run.path(f)); cropImage(run.path(f), { x: lb.left / W, y: lb.top / H, w: (W - lb.left - lb.right) / W, h: (H - lb.top - lb.bottom) / H }, run.path(cf)); } return cf; };
  const resolve = (ref) => { const [kind, id] = ref.split(":"); return kind === "env" || kind === "prev" ? noBars(K.painted[id].file) : kind === "plate" ? noBars(state.bank[id].file) : kind === "style" ? ref.slice(6) : state.bank[id].file; };   // plate, portrait and prop refs all resolve to bank files; plates and stills go out without their thin bars
  const envFlagged = (s) => { for (let e = state.still(s.env); e; e = state.still(e.env)) { if (!K.painted[e.id] || K.painted[e.id].bad) return e.id; } return null; };
  // The frame just before is a reference too (prev:), so a still waits for it like for its image 1: unpainted or flagged, the
  // still is not painted yet. A run once crashed resolving prev:s7-8 for s7-9 while s7-8 was still waiting on a flagged frame.
  const prevBlocked = (s) => { const r = state.refs(s).find((x) => x.ref.startsWith("prev:")); if (!r) return null; const id = r.ref.slice(5); return !K.painted[id] || K.painted[id].bad ? id : null; };
  const todo = state.stills.filter((s) => !only || only.has(s.id));
  // Passes until nothing more can be painted: a still may wait on a frame of ANOTHER place (the previous frame crosses places
  // in a continuous scene), which a single pass in place order never reaches; the run once stopped with fourteen stills
  // waiting on a frame painted a moment earlier in the same pass.
  const waits = new Map(); let progress = true;
  while (progress) { progress = false; waits.clear();
  for (const place of [...new Set(todo.map((s) => s.place))]) {
    for (const s of todo.filter((x) => x.place === place)) {
      if (K.painted[s.id]?.stale && /\|/.test(String(K.painted[s.id].stale)) && K.painted[s.id].key === s.key) delete K.painted[s.id].stale;   // the plan changed back (a revision undone): not stale any more
      if (K.painted[s.id]?.key && K.painted[s.id].key !== s.key && !K.painted[s.id].stale) { K.painted[s.id].stale = s.key; say(`  ${s.id}: the plan changed under this id (STALE); the frame stays until --retry ${s.id}`); }   // ids are positional; nothing is repainted without the user's word
      if (K.painted[s.id]) continue;
      const people = s.frame.people.filter(inFrame), k = (K.attempts[s.id] || []).length, suffix = k ? `-r${k}` : "";
      if (s.card) { const sc = state.script.scenes.find((x) => x.n === s.scene), cap = sc.captions.find((c) => c.at >= s.start_at && c.at < s.start_at + s.seconds_of), f = `stills/${s.id}${suffix}-card.png`; titleCard(cap?.text || "", run.path(f)); progress = true; K.painted[s.id] = { file: f, key: s.key, card: true, check: { people: 0, note: "title card by code" }, bad: false, images: [], prompt: null, attempt: k + 1 }; run.save(); state.record(s, { file: f, gate: "ok", how: "card" }); say(`  ${s.id}: title card by code ("${(cap?.text || "").replace(/\n/g, " / ")}")`); continue; }
      const blocker = envFlagged(s) || prevBlocked(s); if (blocker) { waits.set(s.id, blocker); continue; }
      let file, images, prompt, mode = s.envKind === "edit" ? "edit" : "paint", cropped = null;
      // Punch-in: cut the framing from the painted master.
      const env = state.still(s.env), boxes = env && K.painted[env.id]?.check?.boxes;
      if (s.punchIn && env && sameInstant(env.frame, s.frame)) {   // a cut is the master's instant; a frame in which something has changed is painted
        let box = boxes ? state.cropFor(s, boxes) : null;
        if (!box) { const pb = await state.propBoxes(K.painted[env.id].file, s.frame.props); box = state.cropFor(s, boxes || {}, pb); }   // no people to cut by: the vehicles
        if (box) { const cf = `stills/${s.id}${suffix}-crop.png`; cropImage(run.path(K.painted[env.id].file), box, run.path(cf)); cropped = { file: cf, box, of: env.id, from: K.painted[env.id].file }; }
      }
      const triedDirect = (K.attempts[s.id] || []).some((a) => a.cropped && !a.prompt && a.cropped.from === cropped?.from);   // a retry of a crop used directly paints from the crop: the same cut of the same master would be the same bytes
      if (cropped && cropped.box.w >= cropDirect && cropped.box.w * (WIDTH[RES] || 2048) >= MIN_CROP_PX && !triedDirect) {
        const c = await state.peopleCheck(cropped.file, people), lb = bars(run.path(cropped.file)), bad = !c.ok || lb.boxed; if (lb.frac >= 0.005) c.note = `${c.note} · black bars: ${lb.top} px top, ${lb.bottom} px bottom, ${lb.left} px left, ${lb.right} px right${lb.boxed ? "" : " (cropped at the stitch)"}`;
        say(`  ${s.id}${suffix}: CROP of ${cropped.of} (${Math.round(cropped.box.w * 100)}% of its width), used as the frame · ${c.people} people (want ${people.length}) · order ${(c.order || []).join(" < ") || "-"}${bad ? " · FLAGGED" : " · ok"} · ${c.note}`);
        progress = true; K.painted[s.id] = { file: cropped.file, key: s.key, cropped, check: { ...c, bars: lb }, bad, images: [`env:${cropped.of}`], prompt: null, attempt: k + 1 }; run.save();
        state.record(s, { file: cropped.file, gate: bad ? "flagged" : "ok", how: "crop" }); continue;
      }
      const repair = K.repair?.[s.id];
      if (repair) { mode = "repair"; images = repair.kind === "delta" && state.styleSheet ? [noBars(repair.from), state.styleSheet] : [noBars(repair.from)]; prompt = repair.kind === "delta" ? deltaEditPrompt({ still: s, state, medium, styleSheet: !!state.styleSheet }) : repairPrompt(repair, medium); delete K.repair[s.id]; say(repair.kind === "delta" ? `  ${s.id}: DELTA EDIT of ${repair.from} (the change list only; nothing turns)` : `  ${s.id}: REPAIR of ${repair.from} (a removal edit, not a new painting): ${repair.remove.map((r) => `${r.host}: keep only ${r.keep.join(", ")}`).join("; ")}`); }
      else if (cropped) { mode = "crop"; const p = keyframePrompt({ still: s, state, medium, mode }); images = [cropped.file, ...p.images.slice(1).map(resolve)]; prompt = p.prompt; }
      else { const p = keyframePrompt({ still: s, state, medium, mode }); images = p.images.map(resolve); prompt = p.prompt; }
      file = `stills/${s.id}${suffix}.png`;
      const job = await jobs.image(`still-${s.id}${suffix}`, file, prompt, images, { model: STILL, resolution: RES, aspect_ratio: "16:9" });
      if (job.estimated) { say(`  ${s.id}${suffix}: would be painted (${mode}${cropped ? " from the crop" : ""}, ${job.credits} credits); dry run, nothing sent`); continue; }
      const expected = state.expectedFor(s);
      const c = await state.peopleCheck(file, people, state.peopleBaseline(s, K.painted)), room = mode === "crop" ? { ok: true, note: "crop of the master" } : await state.roomCheck(file, s.place, expected, env ? K.painted[env.id].file : null, state.cameraOf(s)), lb = bars(run.path(file)), style = await state.styleCheck(file), load = mode === "crop" ? { ok: true, note: "crop of the master" } : await state.loadCheck(file, state.loads(s), state.loadBaseline(s, K.painted)), geo = mode === "crop" ? { ok: true, note: "crop of the master" } : await state.geometryCheck(file, s.frame.props, state.geoBaseline(s, K.painted), state.headingBaseline(s, K.painted)), bad = !c.ok || !room.ok || lb.boxed || !style.ok || !load.ok || !geo.ok;
      if (!geo.ok) c.note = `${c.note} · GEOMETRY: ${geo.note}`;
      if (!style.ok) c.note = `${c.note} · STYLE drift: ${(style.drift || []).join(", ") || style.note}`;
      if (!load.ok) c.note = `${c.note} · LOAD: ${load.extra.length ? `${load.extra.join(", ")} carr${load.extra.length === 1 ? "ies" : "y"} more than the screenplay puts on it: ` : ""}${load.note}`;
      if (lb.frac >= 0.005) c.note = `${c.note} · black bars: ${lb.top} px top, ${lb.bottom} px bottom, ${lb.left} px left, ${lb.right} px right${lb.boxed ? "" : " (cropped at the stitch)"}`;
      say(`  ${s.id}${suffix} (${mode}${cropped ? ` from a ${Math.round(cropped.box.w * 100)}% crop of ${cropped.of}` : ""}): ${c.people} people (want ${people.length}) · order ${(c.order || []).join(" < ") || "-"} · people ${c.ok ? "ok" : "FLAGGED"} · room ${room.ok ? "ok" : `FLAGGED${room.added?.length ? ` (added: ${room.added.join(", ")})` : ""}`}${lb.boxed ? " · black bars FLAGGED" : ""}${load.ok ? "" : " · load FLAGGED"}${geo.ok ? "" : " · geometry FLAGGED"} · ${c.note} ${room.note || ""}`);
      progress = true; K.painted[s.id] = { file, key: s.key, cropped, mode, repaired: mode === "repair" || undefined, check: { ...c, room, bars: lb, style, load, geo }, bad, images: cropped ? [`crop:${cropped.of}`, ...keyframePrompt({ still: s, state, medium, mode }).images.slice(1)] : keyframePrompt({ still: s, state, medium, mode }).images, prompt, attempt: k + 1 }; run.save();
      state.record(s, { file, gate: bad ? "flagged" : "ok", how: mode });
    }
  }
  }
  for (const [id, b] of waits) say(`  ${id}: waiting on ${b}`);
  const flagged = todo.filter((s) => K.painted[s.id]?.bad), waiting = todo.filter((s) => !K.painted[s.id]);
  return { flagged, waiting };
}
