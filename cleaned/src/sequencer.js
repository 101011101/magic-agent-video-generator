// S1 Sequencer, three steps:
//   1. story   — prompt → the world (style, entities, places) and a plain prose story. A given world (--world) is kept as is.
//   2. script  — prose → a step script in ASD-STE100 style (Simplified Technical English, as in aircraft manuals): short,
//                active, one action per sentence, one name per thing. One step = one change the camera sees; changes at
//                different times are different steps. Each step lists every visible character with position and acting.
//   3. slides  — deterministic: one slide per step. The step text stays on the slide; the clip stage reads it again.
// Deterministic checks (sentence length, names, exit/entry on a place change) send the violations back once for a rewrite.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const WORLD = {
  title: S.str, style: S.str,
  entities: S.arr(S.obj({ id: ID, name: S.str, kind: S.enum(["character", "group", "prop"]), look: S.str })),
  locations: S.arr(S.obj({ id: ID, name: S.str, look: S.str })),
};
const STEP = S.obj({
  n: S.int, place: ID,
  kind: S.enum(["establish", "move", "act", "change", "exit", "entry"]),
  time_jump: S.bool,                                           // time passes off screen before this step
  ste: S.arr(S.str),                                           // 1-3 STE sentences: the action that leads to this frame
  cast: S.arr(S.obj({ id: ID, where: S.str, acting: S.str })), // every visible entity, as the frame shows it
  change: S.str,                                               // a persistent change of a place item, or ""
  caption: S.str,                                              // one narration sentence, plain English (audio, later)
});

const WORLD_RULES = `Write a short illustrated story for the request below.
- style: one line of visual style for every image (medium, palette, light, 16:9 film still).
- entities: characters, groups and movable props. A set whose members always appear together and whose relative size matters is
  ONE "group". Concrete, drawable looks. Props that never leave one place are not entities: write them into the place's look.
- locations: each look describes the empty place, its fixtures with their positions and relative sizes, and the doors, from one
  fixed establishing camera angle (state it).
- story: the story in plain prose, 150-300 words, with every action in the order it happens. For a well-known tale, follow its
  best-known version unless the request says otherwise, and show its climax and its feelings on screen (fear, escape).`;

const STE_RULES = `Rewrite the story as a STEP SCRIPT in ASD-STE100 style (Simplified Technical English, as in aircraft maintenance manuals).
Each step becomes one keyframe of an animated film. The frame shows the state AFTER the step's action.

STE writing rules for "ste":
- 1 to 3 sentences per step. Each sentence has at most 20 words, one action, active voice, present tense.
- Use the exact entity names and the item names from the place descriptions. Never "she" or "it" when two things could match.
- No metaphors, no idioms, no "-ing" clauses. Say who does what to what, and where.

Step rules (rigorous):
- ONE STEP = ONE CHANGE the camera sees. If two changes happen at different times, they are two steps. Changes that happen
  at the same moment may share a step. Kinds: establish (first frame of a place), move (a character goes to a new position),
  act (expression or gesture changes), change (an item of the place changes and stays changed), exit, entry.
- A move goes to a NEARBY position. If an item (table, bed, chair) is between the start and the end, add a waypoint step at the
  end of that item, and name the path in the sentence ("walks around the right end of the table"). Never through an item.
- A character who leaves a place on screen gets an "exit" step there (at the door or window), and an "entry" step in the next
  place (in the doorway, door open). Set time_jump = true instead when time passes off screen.
- cast: EVERY entity visible in the frame, with where (relative to named items of the place, from its camera) and acting
  (face AND body, e.g. "terrified, mouth wide open screaming, arms thrown up"). An emotion stays until a step changes it:
  write it again on every step. Never leave acting empty or neutral when the story implies a feeling.
- change: the persistent change of a place item in this step ("the small yellow bowl is now empty, the spoon inside"), or "".
  Write each change once.
- place: one of the place ids. Keep each place's one camera angle.
- caption: one narration sentence in normal English for this step.
- 12 to 24 steps. Fewer steps are better when nothing changes; never merge changes that happen at different times.`;

export async function sequence(prompt, given = null) {
  const world = await jsonCall({ name: "world", effort: "high",
    schema: S.obj(given ? { story: S.str } : { ...WORLD, story: S.str }),
    prompt: `${WORLD_RULES}${given ? `\n\nThe world is FIXED (do not change it). Write only the story.\n${worldText(given)}` : ""}\n\nThe request:\n${prompt}` });
  const w = given ? { ...given, story: world.story } : world;
  let script = await jsonCall({ name: "ste", schema: S.obj({ steps: S.arr(STEP) }), effort: "high", prompt: steprompt(w) });
  let bad = lint(w, script.steps);
  if (bad.length) {
    script = await jsonCall({ name: "ste-fix", schema: S.obj({ steps: S.arr(STEP) }), effort: "high",
      prompt: `${steprompt(w)}\n\nYour last script broke these rules. Rewrite the whole script and fix every one:\n${bad.map((b) => `- ${b}`).join("\n")}\n\nLast script:\n${JSON.stringify(script.steps)}` });
    bad = lint(w, script.steps);
  }
  return check({ title: w.title, style: w.style, entities: w.entities, locations: w.locations, story: w.story, lint: bad, slides: toSlides(w, script.steps) });
}

const worldText = (w) => `Title: ${w.title}\nStyle: ${w.style}\nEntities:\n${w.entities.map((e) => `- ${e.id} (${e.kind}): ${e.name}. ${e.look}`).join("\n")}\nPlaces:\n${w.locations.map((l) => `- ${l.id}: ${l.name}. ${l.look}`).join("\n")}`;
const steprompt = (w) => `${STE_RULES}\n\n${worldText(w)}\n\nThe story:\n${w.story}`;

// Deterministic rule checks on the step script.
export function lint(w, steps) {
  const ents = new Set(w.entities.map((e) => e.id)), locs = new Set(w.locations.map((l) => l.id)), out = [];
  const where = {};                                            // entity → { place, step } of its last appearance
  steps.forEach((s, i) => {
    const n = i + 1;
    if (!locs.has(s.place)) out.push(`step ${n}: unknown place "${s.place}"`);
    if (!s.ste.length || s.ste.length > 3) out.push(`step ${n}: needs 1-3 STE sentences, has ${s.ste.length}`);
    s.ste.forEach((t) => { const wc = t.trim().split(/\s+/).length; if (wc > 20) out.push(`step ${n}: sentence over 20 words (${wc}): "${t}"`); });
    for (const c of s.cast) {
      if (!ents.has(c.id)) { out.push(`step ${n}: unknown entity "${c.id}"`); continue; }
      if (!c.acting.trim() && w.entities.find((e) => e.id === c.id)?.kind !== "prop") out.push(`step ${n}: ${c.id} has no acting`);
      const prev = where[c.id];
      // A time jump excuses a place change only for a character absent from the previous step.
      const onScreen = prev && prev.i === i - 1;
      if (prev && prev.place !== s.place && (onScreen || !s.time_jump)) {
        if (steps[prev.i].kind !== "exit") out.push(`step ${prev.i + 1}: ${c.id} leaves ${prev.place} for ${s.place} (step ${n}) without an exit step ${onScreen ? "" : ` (or set time_jump on step ${n})`}`);
        if (s.kind !== "entry") out.push(`step ${n}: ${c.id} arrives in ${s.place} without an entry step${onScreen ? "" : " (or set time_jump)"}`);
      }
      where[c.id] = { place: s.place, i };
    }
  });
  return [...new Set(out)];
}

// One slide per step. `shows` is composed from the step so the builder, verifier and page all read the same text.
function toSlides(w, steps) {
  const name = Object.fromEntries(w.entities.map((e) => [e.id, e.name]));
  return steps.map((s, i) => ({
    n: i + 1, location: s.place, kind: s.kind, time_jump: s.time_jump,
    present: [...new Set(s.cast.map((c) => c.id))], cast: s.cast, change: s.change, ste: s.ste, caption: s.caption,
    continues: false,
    shows: `${s.ste.join(" ")} ${s.cast.map((c) => `${name[c.id] || c.id}: ${c.where}; ${c.acting}.`).join(" ")}`.trim(),
  }));
}

// Structural checks the schema cannot express. Throws on a plan the pipeline cannot run.
export function check(plan) {
  const ents = new Set(plan.entities.map((e) => e.id)), locs = new Set(plan.locations.map((l) => l.id)), bad = [];
  plan.slides.forEach((s, i) => {
    s.n = i + 1;
    if (!locs.has(s.location)) bad.push(`slide ${s.n}: unknown location ${s.location}`);
    s.present = s.present.filter((id) => ents.has(id) || (bad.push(`slide ${s.n}: unknown entity ${id}`), false));
    if (s.continues && plan.slides[i - 1]?.location !== s.location) s.continues = false;
  });
  if (bad.length) throw new Error(`plan: ${bad.join("; ")}`);
  return plan;
}
