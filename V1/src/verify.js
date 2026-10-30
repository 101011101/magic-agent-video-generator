// S5 Verifier: what a frame actually shows. One vision call: per-entity presence and count, the change, single frame.
import { jsonCall, S } from "./llm.js";

export async function verify(file, { plan, ask, change, shows, cast = null }) {
  const byId = Object.fromEntries(plan.entities.map((e) => [e.id, e]));
  const schema = S.obj({
    // Slides with a cast (step script) are also checked for position and acting; older slides keep their original call.
    entities: S.arr(S.obj(cast ? { id: S.enum(ask), present: S.bool, count: S.int, where_ok: S.bool, acting_ok: S.bool, note: S.str } : { id: S.enum(ask), present: S.bool, count: S.int, note: S.str })),
    change_visible: S.bool, single_frame: S.bool, problems: S.str,
  });
  const prompt = `This is a frame from an illustrated story. For each entity below, say whether it is visible in the frame.
${ask.map((id) => `- ${id}: ${byId[id].name} (${byId[id].kind}) — ${byId[id].look}`).join("\n")}
present: true if it is clearly visible. For a group, present only if every member is visible. count: how many times it appears (a group counts once if complete).${cast ? `
where_ok and acting_ok: compare with what this frame should show${cast.length ? `:\n${cast.map((c) => `- ${c.id}: position "${c.where}"; expression and body "${c.acting}"`).join("\n")}` : " (no positions or acting given: true)"}
where_ok: the position matches roughly (same side, same item). acting_ok: the expression and body match the feeling (a smile is NOT ok for fear). For an entity not listed or not present: true.` : ""}
change_visible: ${change ? `is this visible: "${change}"?` : 'true (no change to check).'}
single_frame: true if this is one single picture (not a grid, collage, storyboard or a picture with text labels).
problems: one short sentence on anything that clearly contradicts "${shows}", or "".`;
  const r = await jsonCall({ name: "verify", schema, prompt, images: [file], effort: "low" });
  return { ...r, entities: ask.map((id) => r.entities.find((e) => e.id === id) || { id, present: false, count: 0, note: "not reported" }) };
}

// Faults of an observation against the wanted presence. A character must appear exactly once.
export function faults(obs, { plan, wanted, remove, change, cast = null }) {
  const kind = Object.fromEntries(plan.entities.map((e) => [e.id, e.kind])), out = [];
  for (const e of obs.entities) {
    if (wanted.includes(e.id) && !e.present) out.push({ id: e.id, kind: "missing" });
    if (wanted.includes(e.id) && e.present && kind[e.id] === "character" && e.count > 1) out.push({ id: e.id, kind: "duplicated" });
    if (remove.includes(e.id) && e.present) out.push({ id: e.id, kind: "not removed" });
    if (cast?.some((c) => c.id === e.id) && e.present && kind[e.id] !== "prop") {
      if (e.where_ok === false) out.push({ id: e.id, kind: "wrong position" });
      if (e.acting_ok === false) out.push({ id: e.id, kind: "wrong acting" });
    }
  }
  if (change && !obs.change_visible) out.push({ id: null, kind: "change not visible" });
  if (!obs.single_frame) out.push({ id: null, kind: "not a single frame" });
  return out;
}

// Blocking slides: focused questions, one per thing that changed. Presence is asked only for characters and groups, and for
// props this step uses (tiny props are not reliably visible and must not fail a frame). Each changed actor is asked whether it
// is at its mark (with the mark's canonical description), in its pose, with its expression. Plus physical sense.
export async function verifyStep(file, { plan, slide, ask, sheets = {}, added = [] }) {
  const byId = Object.fromEntries(plan.entities.map((e) => [e.id, e]));
  // Props are asked only when a beat handles them (picked up, put down, moved, brought in); a prop merely placed ("be") is not:
  // a tiny needle on a shelf failed custom-rrh2 s7-a2, a correct frame.
  const used = new Set(slide.beats.flatMap((b) => [b.object, b.action === "be" ? "" : b.actor]).filter(Boolean));
  const askP = ask.filter((id) => byId[id].kind !== "prop" || used.has(id));
  const beats = slide.beats.filter((b) => b.action !== "vanish" && byId[b.actor]?.kind !== "prop");
  const castOf = Object.fromEntries(slide.cast.map((c) => [c.id, c]));
  // Identity: every character or group this step adds or changes is compared with its asset sheet (image 2, 3, …).
  const idIds = [...new Set([...added, ...beats.map((b) => b.actor)])].filter((id) => byId[id]?.kind !== "prop" && sheets[id] && slide.present.includes(id)).slice(0, 8);
  const schema = S.obj({
    // One required property per id, so no answer can be skipped.
    entities: S.obj(Object.fromEntries(askP.map((id) => [id, S.obj({ present: S.bool, count: S.int })]))),
    actors: S.obj(Object.fromEntries(beats.map((b) => [b.actor, S.obj({ at_mark: S.bool, pose_ok: S.bool, expression_ok: S.bool, note: S.str })]))),
    identity: S.obj(Object.fromEntries(idIds.map((id) => [id, S.obj({ same_character: S.bool, note: S.str })]))),
    change_visible: S.bool, single_frame: S.bool, impossible: S.bool, problems: S.str,
  });
  const prompt = `Image 1 is a frame from an illustrated story. Answer from image 1 unless a question names another image.
Presence — for each, is it clearly visible, and how many times does it appear (a group counts once if complete)?
${askP.map((id) => `- ${id}: ${byId[id].name} (${byId[id].kind}) — ${byId[id].look}`).join("\n")}
Actors — for each, answer three questions:
${beats.map((b) => `- ${b.actor}: at_mark: is ${byId[b.actor].name} ${castOf[b.actor]?.where || b.to_text}? pose_ok: is the body "${castOf[b.actor]?.acting.split("; ")[0] || b.pose}"? expression_ok: does the face read as "${castOf[b.actor]?.acting.split("; ").slice(1).join("; ") || b.expression}" (a smile is NOT ok for fear)?`).join("\n") || "- none: answer true for all."}
Identity — ${idIds.length ? idIds.map((id, k) => `image ${k + 2} is the reference sheet of ${byId[id].name}`).join("; ") : "no sheets: answer nothing"}. For each, same_character:
is the one in image 1 clearly the same character (face, hair style and colour, clothes and colours, build, species, art style)?
Pose, expression and background may differ. note: what differs, or "".
change_visible: ${slide.change ? `is this visible: "${slide.change}"?` : "true (no change to check)."}
single_frame: true if image 1 is one single picture (not a grid, collage, storyboard or a picture with text labels).
impossible: true if anything is physically impossible: someone lying with the head at the foot end of a bed (the head end has the
headboard and pillow), a body part where the body cannot be (a tail out of the far end of the covers), a body through furniture,
something floating. problems: one short sentence naming what is wrong, or "".`;
  const r = await jsonCall({ name: "verify-step", schema, prompt, images: [file, ...idIds.map((id) => sheets[id])], effort: "medium" });
  return {
    ...r,
    entities: ask.map((id) => (askP.includes(id) ? { id, ...r.entities[id] } : { id, present: true, count: 1, unasked: true })),
    actors: [...new Set(beats.map((b) => b.actor))].map((id) => ({ id, ...r.actors[id] })),
  };
}

export function stepFaults(obs, { plan, wanted, remove, slide }) {
  const kind = Object.fromEntries(plan.entities.map((e) => [e.id, e.kind])), out = [];
  for (const e of obs.entities) {
    if (e.unasked) continue;
    if (wanted.includes(e.id) && !e.present) out.push({ id: e.id, kind: "missing" });
    if (wanted.includes(e.id) && e.present && kind[e.id] === "character" && e.count > 1) out.push({ id: e.id, kind: "duplicated" });
    if (remove.includes(e.id) && e.present) out.push({ id: e.id, kind: "not removed" });
  }
  for (const a of obs.actors) {
    if (!a.at_mark) out.push({ id: a.id, kind: "wrong position" });
    if (!a.pose_ok) out.push({ id: a.id, kind: "wrong pose" });
    if (!a.expression_ok) out.push({ id: a.id, kind: "wrong expression" });
  }
  for (const [id, v] of Object.entries(obs.identity || {})) if (!v.same_character) out.push({ id, kind: `not the same character${v.note ? ` (${v.note})` : ""}` });
  if (slide.change && !obs.change_visible) out.push({ id: null, kind: "change not visible" });
  if (!obs.single_frame) out.push({ id: null, kind: "not a single frame" });
  if (obs.impossible) out.push({ id: null, kind: `physically impossible${obs.problems ? `: ${obs.problems}` : ""}` });
  return out;
}
