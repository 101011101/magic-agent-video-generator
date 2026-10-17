// S5 Verifier: what a frame actually shows. One vision call: per-entity presence and count, the change, single frame.
import { jsonCall, S } from "./llm.js";

export async function verify(file, { plan, ask, change, shows }) {
  const byId = Object.fromEntries(plan.entities.map((e) => [e.id, e]));
  const schema = S.obj({
    entities: S.arr(S.obj({ id: S.enum(ask), present: S.bool, count: S.int, note: S.str })),
    change_visible: S.bool, single_frame: S.bool, problems: S.str,
  });
  const prompt = `This is a frame from an illustrated story. For each entity below, say whether it is visible in the frame.
${ask.map((id) => `- ${id}: ${byId[id].name} (${byId[id].kind}) — ${byId[id].look}`).join("\n")}
present: true if it is clearly visible. For a group, present only if every member is visible. count: how many times it appears (a group counts once if complete).
change_visible: ${change ? `is this visible: "${change}"?` : 'true (no change to check).'}
single_frame: true if this is one single picture (not a grid, collage, storyboard or a picture with text labels).
problems: one short sentence on anything that clearly contradicts "${shows}", or "".`;
  const r = await jsonCall({ name: "verify", schema, prompt, images: [file], effort: "low" });
  return { ...r, entities: ask.map((id) => r.entities.find((e) => e.id === id) || { id, present: false, count: 0, note: "not reported" }) };
}

// Faults of an observation against the wanted presence. A character must appear exactly once.
export function faults(obs, { plan, wanted, remove, change }) {
  const kind = Object.fromEntries(plan.entities.map((e) => [e.id, e.kind])), out = [];
  for (const e of obs.entities) {
    if (wanted.includes(e.id) && !e.present) out.push({ id: e.id, kind: "missing" });
    if (wanted.includes(e.id) && e.present && kind[e.id] === "character" && e.count > 1) out.push({ id: e.id, kind: "duplicated" });
    if (remove.includes(e.id) && e.present) out.push({ id: e.id, kind: "not removed" });
  }
  if (change && !obs.change_visible) out.push({ id: null, kind: "change not visible" });
  if (!obs.single_frame) out.push({ id: null, kind: "not a single frame" });
  return out;
}
