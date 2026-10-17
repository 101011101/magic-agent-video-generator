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
