// S1 Sequencer: prompt → world + prose story → (S0 seed: ground plans and plates) → blocking records → slides.
//   world    (LLM)  style, entities, places and a plain prose story. A given world (--world / --entities-from) is kept.
//   blocking (LLM)  one record per step, written against the seed's marks, like stage blocking: who does what, from which mark
//                   to which mark, by which mark, with which pose and expression. Only CHANGES are written; code folds them
//                   into the full state (who is where, holding what, feeling what), so the state cannot contradict itself.
//   slides   (code) one slide per step. The action sentence is generated from the record (never written separately), so
//                   the prompt, the checks and the clip text all say the same thing. The caption is the only free text.
// Deterministic lint (marks exist, one change per step, exits and entries, who is on screen) sends violations back once.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, MARK = { type: "string", pattern: "^$|^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)?$" };
const WORLD = {
  title: S.str, style: S.str,
  entities: S.arr(S.obj({ id: ID, name: S.str, kind: S.enum(["character", "group", "prop"]), look: S.str })),
  locations: S.arr(S.obj({ id: ID, name: S.str, look: S.str })),
};
export const ACTIONS = ["be", "enter", "exit", "appear", "vanish", "move", "sit", "lie", "stand", "kneel", "turn", "pick-up", "put-down", "act"];
const BEAT = S.obj({ actor: ID, action: S.enum(ACTIONS), to: MARK, via: MARK, object: { type: "string", pattern: "^$|^[a-z][a-z0-9-]*$" }, pose: S.str, expression: S.str });
const STEP = S.obj({
  place: ID, kind: S.enum(["establish", "move", "act", "change", "exit", "entry"]), time_jump: S.bool,
  beats: S.arr(BEAT), change: S.obj({ mark: MARK, state: S.str }), caption: S.str,
});

const WORLD_RULES = `Write a short illustrated story for the request below.
- style: one line of visual style for every image (medium, palette, light). Do not ask for full-bleed or "film still" framing.
- entities: characters, groups and movable props. A set whose members always appear together and whose relative size matters is
  ONE "group". Concrete, drawable looks. Props that never move are not entities: they belong to the place.
- locations: each look describes the empty place and its fixtures, from one fixed camera.
- story: the story in plain prose, 150-300 words, with every action in the order it happens. For a well-known tale, follow its
  best-known version unless the request says otherwise, and show its climax and its feelings on screen (fear, escape).`;

const BLOCK_RULES = `Turn the story into BLOCKING: one record per step, like stage directions written against marks on a set.
Each step becomes one keyframe; the frame shows the state AFTER the step. Write only what CHANGES; everything else stays as it was.
- place: the place id. Use ONLY that place's marks (ids below) in to / via / change.mark.
- beats: the changes in this step. ONE change the camera sees per step; two beats only if two characters change at the same moment.
  actor: an entity id. action:
    be       (the establish step only) the actor is already there when the place is first shown: to = its mark
    enter    comes in through a door or path mark (to = that mark)          exit     leaves by a door or path mark (to = that mark)
    appear   becomes visible without entering (to = mark)                    vanish   stops being visible without leaving (eaten, hidden)
    move     goes to another mark (to = mark, via = the mark it passes or goes around, if anything is in the way)
    sit / lie / stand / kneel / turn   changes pose at a mark (to = mark, or "" for where it is)
    pick-up  takes object (an entity id)                                    put-down puts object at to
    act      only the expression or gesture changes
  pose and expression: the actor's body and face after the beat ("lying on his back, head on the pillow"; "smug, grinning").
  Required for be / enter / appear on characters. Otherwise "" means unchanged. Feelings follow the story (fear while fleeing).
  For a group or prop, pose may say its state; expression "".
- Each place has exactly ONE establish step: the first step there. Anyone who arrives later must enter (by a door or path mark),
  or appear (only someone who vanished earlier, e.g. out of the wolf, or a prop brought in).
- Lie, sit and sleep on furniture marks (the bed, bed.head), not on floor marks, unless the story says the floor.
- A move goes to a nearby mark. If an item is between the actor and the mark, set via to it, or add a step to that item first.
- A character on screen who goes to another place gets an exit step here and an enter beat there. Set time_jump = true instead
  only when time passes off screen and the character was not in the previous step.
- change: a lasting change of a place item in this step: mark = the item's mark, state = what it now looks like; else mark "" state "".
- caption: one narration sentence in plain storybook English (it never drives the pictures).
- Cover EVERY event of the story, in order, from its first sentence to its last. Do not start late or skip an event to save steps.
- 12 to 30 steps. Fewer steps when nothing changes; never merge changes that happen at different times.`;

export async function writeWorld(prompt, given = null) {
  const keep = given ? Object.keys(given) : [];
  const want = Object.fromEntries(Object.entries({ ...WORLD, story: S.str }).filter(([k]) => !keep.includes(k)));
  const r = await jsonCall({ name: "world", effort: "high", schema: S.obj(want),
    prompt: `${WORLD_RULES}${given ? `\n\nThese parts are FIXED (do not change them); write only: ${Object.keys(want).join(", ")}.\n${JSON.stringify(given)}` : ""}\n\nThe request:\n${prompt}` });
  return { ...given, ...r };
}

const marksText = (seed) => Object.entries(seed).map(([id, p]) => `Place ${id} (camera: ${p.camera}):\n${p.marks.map((m) => `  ${m.id}: ${m.name} — ${m.where}`).join("\n")}${p.doors.length ? `\n  doors: ${p.doors.map((d) => `${d.mark} → ${d.leads_to}`).join("; ")}` : ""}`).join("\n");
const blockPrompt = (w, seed) => `${BLOCK_RULES}\n\nEntities:\n${w.entities.map((e) => `- ${e.id} (${e.kind}): ${e.name}`).join("\n")}\n\nMarks:\n${marksText(seed)}\n\nThe story:\n${w.story}`;

// w: world; seed: { placeId: { camera, marks, doors } } (canonical, observed marks).
export async function block(w, seed) {
  let r = await jsonCall({ name: "block", schema: S.obj({ steps: S.arr(STEP) }), effort: "high", prompt: blockPrompt(w, seed) });
  let { bad } = fold(w, seed, r.steps);
  if (bad.length) {
    r = await jsonCall({ name: "block-fix", schema: S.obj({ steps: S.arr(STEP) }), effort: "high",
      prompt: `${blockPrompt(w, seed)}\n\nYour last blocking broke these rules. Rewrite all of it and fix every one:\n${bad.map((b) => `- ${b}`).join("\n")}\n\nLast blocking:\n${JSON.stringify(r.steps)}` });
    ({ bad } = fold(w, seed, r.steps));
  }
  const { slides } = fold(w, seed, r.steps);
  return check({ title: w.title, style: w.style, entities: w.entities, locations: w.locations, story: w.story, lint: bad, steps: r.steps, slides });
}

// The state machine. Folds the beats into the full state per step and lints them. Returns the slides and the violations.
export function fold(w, seed, steps) {
  const ent = Object.fromEntries(w.entities.map((e) => [e.id, e])), bad = [], slides = [];
  const markOf = (place, id) => seed[place]?.marks.find((m) => m.id === id);
  const doorMarks = (place) => new Set((seed[place]?.doors || []).map((d) => d.mark));
  const state = {};                                   // actor → { place, at, pose, expression, holder }
  let prevOnScreen = new Set(), leaving = new Set();
  const established = new Set(), vanished = new Set();
  steps.forEach((s, i) => {
    const n = i + 1, err = (m) => bad.push(`step ${n}: ${m}`), mk = (id) => id && markOf(s.place, id);
    if (!seed[s.place]) err(`unknown place "${s.place}"`);
    if (s.kind === "establish" && established.has(s.place)) err(`${s.place} is already established; later arrivals enter or appear`);
    if (s.kind !== "establish" && !established.has(s.place)) err(`first step at ${s.place} must be its establish step`);
    const firstHere = s.kind === "establish" && !established.has(s.place);
    established.add(s.place);
    for (const a of leaving) delete state[a];         // an exit frame shows the actor at the door; the next step does not
    leaving = new Set();
    const chars = s.beats.filter((b) => ent[b.actor]?.kind !== "prop").map((b) => b.actor);
    if (s.kind !== "establish" && new Set(chars).size > 2) err(`more than two characters change at once (${chars.join(", ")})`);
    if (s.kind !== "establish" && s.beats.length > 2) err(`${s.beats.length} beats; one change per step (two only at the same moment)`);
    if (s.change.mark && !mk(s.change.mark)) err(`change.mark "${s.change.mark}" is not a mark of ${s.place}`);
    for (const b of s.beats) {
      const e = ent[b.actor], cur = state[b.actor];
      if (!e) { err(`unknown actor "${b.actor}"`); continue; }
      if (b.to && !mk(b.to)) err(`${b.actor} ${b.action}: "${b.to}" is not a mark of ${s.place}`);
      if (b.via && !mk(b.via)) err(`${b.actor} ${b.action}: via "${b.via}" is not a mark of ${s.place}`);
      if (b.object && !ent[b.object]) err(`${b.actor} ${b.action}: unknown object "${b.object}"`);
      const here = cur && cur.place === s.place;
      const arrives = ["be", "enter", "appear"].includes(b.action);
      if (arrives) {
        if (here) err(`${b.actor} ${b.action}s ${s.place} but is already there`);
        if (b.action === "be" && !firstHere) err(`"be" is only for the first (establish) step of a place (${b.actor}); use enter or appear`);
        if (b.action === "appear" && e.kind !== "prop" && !vanished.has(b.actor)) err(`${b.actor} appears but never vanished; characters enter by a door or path mark`);
        if (b.action === "enter" && doorMarks(s.place).size && !doorMarks(s.place).has(b.to)) err(`${b.actor} enters at "${b.to}", not a door of ${s.place} (${[...doorMarks(s.place)].join(", ")})`);
        if (!b.to) err(`${b.actor} ${b.action} needs a mark (to)`);
        if (e.kind === "character" && (!b.pose.trim() || !b.expression.trim())) err(`${b.actor} ${b.action}: pose and expression are required`);
        // A character on screen in the previous step must exit there before it can be somewhere else.
        if (cur && cur.place !== s.place && prevOnScreen.has(b.actor)) err(`${b.actor} goes from ${cur.place} to ${s.place} without an exit step`);
        if (cur && cur.place !== s.place && !prevOnScreen.has(b.actor) && !s.time_jump && b.action !== "appear") err(`${b.actor} reappears in ${s.place}: add an exit from ${cur.place} or set time_jump`);
        state[b.actor] = { place: s.place, at: b.to, pose: b.pose, expression: b.expression, holder: null };
        continue;
      }
      if (!here) { err(`${b.actor} ${b.action} in ${s.place} but is not there (enter, appear or be first)`); continue; }
      if (b.action === "exit") { if (doorMarks(s.place).size && !doorMarks(s.place).has(b.to)) err(`${b.actor} exits at "${b.to}", not a door of ${s.place}`); leaving.add(b.actor); }
      if (b.action === "vanish") { vanished.add(b.actor); delete state[b.actor]; for (const [k, v] of Object.entries(state)) if (v.holder === b.actor) delete state[k]; continue; }
      if (b.action === "pick-up") { const o = state[b.object]; if (!o || o.place !== s.place) err(`${b.actor} picks up ${b.object}, which is not in ${s.place}`); else Object.assign(o, { holder: b.actor, at: "" }); }
      if (b.action === "put-down") { const o = state[b.object]; if (!o || o.holder !== b.actor) err(`${b.actor} puts down ${b.object} without holding it`); else Object.assign(o, { holder: null, at: b.to }); }
      if (b.to && !["pick-up", "put-down"].includes(b.action)) cur.at = b.to;
      if (b.via) cur.via = b.via; else delete cur.via;
      if (b.pose.trim()) cur.pose = b.pose;
      if (b.expression.trim()) cur.expression = b.expression;
    }
    // Held props move with their holder, and are off screen while the holder is.
    for (const v of Object.values(state)) if (v.holder && state[v.holder]) v.place = state[v.holder].place;
    const onScreen = Object.entries(state).filter(([, v]) => (v.holder ? state[v.holder]?.place === s.place : v.place === s.place)).map(([id]) => id);
    if (!onScreen.length) err("nobody and nothing is on screen");
    slides.push(toSlide(w, seed, s, n, onScreen, state));
    prevOnScreen = new Set(onScreen.filter((id) => ent[id]?.kind !== "prop"));
  });
  return { slides, bad: [...new Set(bad)] };
}

const VERB = { be: "is at", enter: "comes in at", exit: "goes out at", appear: "appears at", vanish: "disappears", move: "goes to", sit: "sits down at", lie: "lies down at", stand: "stands up at", kneel: "kneels at", turn: "turns at", "pick-up": "picks up", "put-down": "puts down", act: "" };

// One slide from one step. Every text a later stage reads is generated here from the record.
function toSlide(w, seed, s, n, onScreen, state) {
  const name = (id) => w.entities.find((e) => e.id === id)?.name || id, place = seed[s.place];
  const mark = (id) => place?.marks.find((m) => m.id === id);
  const the = (id) => { const m = mark(id); if (!m) return id; const t = m.name.replace(/^(the|a|an)\s+/i, ""); return `the ${t[0].toLowerCase()}${t.slice(1)}`; };
  const markText = (id) => (mark(id) ? `${mark(id).name} (${mark(id).where})` : id);
  const sentence = (b) => {
    if (b.action === "act") return `${name(b.actor)} ${[b.pose, b.expression].filter(Boolean).join(", ")}.`;
    if (b.action === "vanish") return `${name(b.actor)} disappears${b.pose ? ` (${b.pose})` : ""}.`;
    if (b.action === "pick-up") return `${name(b.actor)} picks up ${name(b.object)}.`;
    if (b.action === "put-down") return `${name(b.actor)} puts ${name(b.object)} down at ${the(b.to)}.`;
    return `${name(b.actor)} ${VERB[b.action]} ${the(b.to) || "where they are"}${b.via ? `, passing ${the(b.via)}` : ""}${b.pose && b.action !== "be" ? ` (${b.pose})` : ""}.`;
  };
  const changed = [...new Set(s.beats.map((b) => b.actor).concat(s.beats.map((b) => b.object).filter(Boolean)))];
  const cast = onScreen.map((id) => {
    const v = state[id], where = v.holder ? `held by ${name(v.holder)}` : v.at ? `at ${markText(v.at)}` : "where it was";
    return { id, where, acting: [v.pose, v.expression].filter(Boolean).join("; ") };
  });
  const changeText = s.change.mark ? `${mark(s.change.mark)?.name || s.change.mark}: ${s.change.state}` : "";
  const ste = s.beats.map(sentence).concat(changeText ? [`${changeText}.`] : []);
  return {
    n, location: s.place, kind: s.kind, time_jump: s.time_jump, present: onScreen, cast, changed,
    beats: s.beats.map((b) => ({ ...b, to_text: b.to ? markText(b.to) : "", via_text: b.via ? markText(b.via) : "" })),
    change: changeText, ste, caption: s.caption, continues: false,
    shows: `${ste.join(" ")} ${cast.filter((c) => changed.includes(c.id)).map((c) => `${name(c.id)}: ${c.where}; ${c.acting}.`).join(" ")}`.trim(),
  };
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
