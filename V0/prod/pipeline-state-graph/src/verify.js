// Verification: one vision call per frame against the wanted state. Image 1 = the frame; the other images = the reference
// frames each entity was seeded or merged from. Per entity: present, count, same identity as its reference, real size against
// people and the place, wardrobe, condition, position and interaction. Hard faults reject the frame; soft faults are retried
// and, after the retries and the fallback seed, accepted with the fault on record. Nothing passes silently.
import { join } from "node:path";
import { visionCallImages } from "../../pipeline-v2/src/vision.js";
import { retry } from "./net.js";

export const HARD = ["present", "count", "identity", "size", "wardrobe", "condition", "location", "single"];
export const SOFT = ["position", "interaction", "pose"];

// refs: [{ file, ids }] frames that show the listed entities (image 2, 3, …).
export async function verifyFrame(dir, file, want, ents, refs) {
  const ids = want.entities.map((e) => e.id);
  const bool = { type: "boolean" };
  const schema = { type: "object", additionalProperties: false, required: ["single_frame", "place_same_as_reference", "place_problem", "entities"], properties: {
    single_frame: bool, place_same_as_reference: bool, place_problem: { type: "string" },
    entities: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["id", "present", "count", "same_identity", "size_ok", "wardrobe_ok", "condition_ok", "position_ok", "interaction_ok", "pose_ok", "observed", "problem"],
      properties: { id: { type: "string", enum: ids.length ? ids : ["none"] }, present: bool, count: { type: "integer" }, same_identity: bool, size_ok: bool, wardrobe_ok: bool, condition_ok: bool,
        position_ok: bool, interaction_ok: bool, pose_ok: bool, observed: { type: "string" }, problem: { type: "string" } } } } } };
  const refOf = (id) => refs.findIndex((r) => r.ids.includes(id));
  const text = `Image 1 is one frame of a film. Judge it against the wanted state. Be strict on identity, real size, wardrobe and condition; be lenient on exact framing.
single_frame = true if image 1 is one single picture (not a grid, storyboard, collage or split frame) without text or borders.
The place should be ${want.location.id}${want.placeRef != null ? ` and the same place as in image ${want.placeRef + 2} (same architecture and landscape; light, time and weather may differ)` : ""}; place_same_as_reference = false only if it is clearly a different place or its fixed parts changed; place_problem: a few words or "".
For each entity: present = visible; count = how many instances (a character must appear exactly once); same_identity = it is the same one as in its reference image (face, hair, build, clothing design for a character; shape, design, colours, material for a prop), or, with no reference, it matches its look; size_ok = its size against the people and the place is plausible; false only when it is clearly more than twice or less than half its real size (${want.entities.map((e) => `${e.id}: ${ents[e.id].size}`).join("; ")}); wardrobe_ok, condition_ok, position_ok, interaction_ok, pose_ok = the frame does not clearly contradict the wanted value (true when it cannot be seen). observed = what the frame shows for it (a few words). problem = the faults in a few words, or "".
Wanted entities:
${want.entities.map((e) => `- ${e.id} (${e.kind}: ${ents[e.id].look} Real size: ${ents[e.id].size})${refOf(e.id) >= 0 ? ` — reference: image ${refOf(e.id) + 2}` : " — no reference, first appearance"}. Wanted: ${e.wardrobe ? `wardrobe = ${e.wardrobe}; ` : ""}condition = ${e.condition}; pose = ${e.pose}; position = ${e.position}; interacting with = ${e.interacting_with.join(", ") || "nothing"}.`).join("\n")}`;
  const out = await retry(() => visionCallImages("sgverify", schema, text, [join(dir, file), ...refs.map((r) => join(dir, r.file))]), { label: `verify ${file}` });
  const shows = {}, hard = [], soft = [];
  if (!out.single_frame) hard.push("not a single frame (grid, collage or text)");
  if (want.placeRef != null && !out.place_same_as_reference) hard.push(`place differs from reference: ${out.place_problem}`);
  for (const e of want.entities) {
    const o = out.entities.find((x) => x.id === e.id) || { present: false, count: 0, problem: "not judged" };
    const problems = [];
    if (!o.present) problems.push(`${e.id} missing`);
    else {
      if (e.kind === "character" && o.count !== 1) problems.push(`${e.id} appears ${o.count} times`);
      if (!o.same_identity) problems.push(`${e.id} identity differs: ${o.problem}`);
      if (!o.size_ok) problems.push(`${e.id} wrong size (should be ${ents[e.id].size}): ${o.observed}`);
      if (!o.wardrobe_ok) problems.push(`${e.id} wardrobe should be ${e.wardrobe}`);
      if (!o.condition_ok) problems.push(`${e.id} condition should be ${e.condition}: ${o.observed}`);
    }
    const softP = [];
    if (o.present && !o.position_ok) softP.push(`${e.id} position should be ${e.position}: ${o.observed}`);
    if (o.present && !o.interaction_ok) softP.push(`${e.id} should interact with ${e.interacting_with.join(", ") || "nothing"}: ${o.observed}`);
    if (o.present && !o.pose_ok) softP.push(`${e.id} pose should be ${e.pose}: ${o.observed}`);
    hard.push(...problems); soft.push(...softP);
    shows[e.id] = { version: e.version, wardrobe: e.wardrobe, pose: e.pose, position: e.position, interacting_with: e.interacting_with, condition: e.condition, lighting: e.lighting,
      observed: o.observed, ok: !problems.length, problems: [...problems, ...softP] };
  }
  return { shows, hard, soft, ok: !hard.length && !soft.length, raw: out };
}
