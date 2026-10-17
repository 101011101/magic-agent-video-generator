// S1 Sequencer: one natural-language prompt → plan (style, entities, locations, ordered slides). One strong-LLM call.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const SCHEMA = S.obj({
  title: S.str,
  style: S.str,
  entities: S.arr(S.obj({ id: ID, name: S.str, kind: S.enum(["character", "group", "prop"]), look: S.str })),
  locations: S.arr(S.obj({ id: ID, name: S.str, look: S.str })),
  slides: S.arr(S.obj({ n: S.int, location: ID, present: S.arr(ID), continues: S.bool, change: S.str, shows: S.str, caption: S.str })),
});

const RULES = `You plan a short illustrated story as an ordered list of keyframes (slides). Each slide is later animated into a ~5 s clip.

How the frames are made (plan for this):
- Every entity and every location gets one clean reference image first.
- A slide's frame is made by EDITING an existing frame: the latest frame of the same location, with reference images of the
  entities to add. The edit keeps everything else (room, furniture, objects, light, camera). So state persists in the pixels:
  once a bowl is emptied in a frame, every later frame of that room shows it empty without being told again.
- Only presence is tracked: which entities a frame shows. Looks come from the reference images.

Rules:
- style: one line of visual style used for every image (medium, palette, light, aspect 16:9 film still).
- entities: characters, groups and movable props. A set whose members always appear together and whose relative size matters is ONE
  entity of kind "group" (its look describes every member and their relative sizes). Give each a concrete, drawable look
  (species, age, build, hair, clothing, colours). Props that never leave one place are NOT entities: write them into that location's look.
- locations: each look describes the empty place and its fixtures with their positions and relative sizes, from one fixed
  establishing camera angle (state that angle). Keep to that angle in every slide of that location.
- slides, in story order, numbered from 1, 8–12 slides:
  - location: a location id. present: ids of the entities visible in this frame (none of the location's fixtures).
  - continues: true only if this frame is the same moment and camera as the previous slide, changed slightly (e.g. the end of
    an action). The previous slide must be in the same location.
  - change: a state change of things already in the place that happens in this frame and must persist (e.g. "the smallest
    porridge bowl is now empty, its spoon inside"), or "". Write each change once, on the slide where it happens.
  - shows: one or two sentences of composition: who is where, doing what, facing which way. No camera angle other than the location's.
  - caption: one narration sentence.`;

export async function sequence(prompt) {
  const plan = await jsonCall({ name: "sequence", schema: SCHEMA, prompt: `${RULES}\n\nThe request:\n${prompt}`, effort: "high" });
  return check(plan);
}

// Structural checks the schema cannot express. Throws on a plan the pipeline cannot run.
export function check(plan) {
  const ents = new Set(plan.entities.map((e) => e.id)), locs = new Set(plan.locations.map((l) => l.id)), bad = [];
  plan.slides.forEach((s, i) => {
    s.n = i + 1;
    if (!locs.has(s.location)) bad.push(`slide ${s.n}: unknown location ${s.location}`);
    for (const id of s.present) if (!ents.has(id)) bad.push(`slide ${s.n}: unknown entity ${id}`);
    if (s.continues && plan.slides[i - 1]?.location !== s.location) { s.continues = false; }
  });
  if (bad.length) throw new Error(`plan: ${bad.join("; ")}`);
  return plan;
}
