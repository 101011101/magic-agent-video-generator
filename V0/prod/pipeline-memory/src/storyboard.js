// Storyboard (Co-Director storyboard + FilmWorld world state): one LLM call turns story + chunks into a style line,
// typed entities (kind, look, real size, scale partner, fixture), N shots of 5 s with a full start state (position,
// holding, placed_on, condition per entity), one action, an end state with changes, sound cues, music and text layers.
import { jsonCall } from "../../state-manager/src/llm.js";

const str = { type: "string" }, nstr = { type: ["string", "null"] }, int = { type: "integer" };
const obj = (props, extra = {}) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props, ...extra });
const arr = (items) => ({ type: "array", items });
const entityState = obj({ name: str, position: str, holding: nstr, held_by: nstr, placed_on: nstr, condition: str });
export const SCHEMA = obj({
  style: str,
  entities: arr(obj({ name: str, kind: { type: "string", enum: ["character", "prop", "location"] }, look: str, size: str, upload: nstr, scale_partner: nstr, fixture_of: nstr })),
  shots: arr(obj({
    id: str, chunks: arr(int), link: { type: "string", enum: ["cut", "continuous"] }, location: str, seconds: { type: "integer", enum: [5] }, start_upload: nstr,
    start: obj({ description: str, time_light: str, entities: arr(entityState) }),
    action: str, camera: str, motion_in: str,
    end: obj({ description: str, changes: arr(obj({ name: str, attr: str, from: str, to: str })) }),
    persist: arr(obj({ name: str, attr: str, to: str })),
    sound: obj({ ambient: str, effects: arr(obj({ at_s: { type: "number" }, text: str })) }),
  })),
  audio: obj({ music: arr(obj({ shot: str, at_s: { type: "number" }, kind: { type: "string", enum: ["in", "out", "motif", "swell"] }, text: str })),
    voiceover: arr(obj({ shot: str, at_s: { type: "number" }, text: str })) }),
  layers: arr(obj({ text: str, start_s: { type: "number" }, end_s: { type: "number" }, position: { type: "string", enum: ["center", "lower third", "top"] } })),
});

const TEMPLATE = `Turn this story and its operational chunks into a storyboard for an image-to-video system. Each shot is one 5-second clip made from one start frame; the model shows only the motion you describe. Make exactly {{count}} shots that cover the whole story in order: choose the beats that matter most and merge or drop the rest.

Style: one line about the look of a single frame only (medium, palette, texture, light). No durations, shot counts or sound.

Entities: every character, prop that matters and location, with:
- name: a short fixed name used everywhere.
- kind: character, prop or location.
- look: the traits that never change (face, age, hair, clothing; shape, colour, material; architecture, landscape). No pose, action, time of day or weather. Start with the exact kind of thing (for example "a lighthouse lamp: a fixed optic", not "a lamp").
- size: its real size, as a measure and next to a person or hand (for example "4 cm, fits in a cupped palm"; "as tall as a person"; "a 1.5 m wooden table").
- scale_partner: for a prop that a character holds or touches, that character's name (the prop's reference image shows it in that character's hand or beside their body, so its size is fixed); else null.
- fixture_of: for a prop that is a fixed part of one location and never moves (a lamp in its lantern room, a table in a kitchen): that location's name; else null. A prop that is carried, moved, or appears or disappears is not a fixture.
- upload: the upload name (u1, u2, …) when an upload shows this entity, else null.

Shots, in order. Each shot:
- id: "01", "02", …  chunks: the chunk numbers it covers (cover every chunk in order; split or merge freely within the {{count}} shots).
- link: "cut" = a new camera setup, framing, place or time; the shot gets a fresh start frame. "continuous" = same place and framing; the action continues directly from the last frame of the previous shot. A framing change is always a cut. Prefer continuous when the next action happens in the same place with the same people in the current framing: split one beat into two continuous shots rather than cramming two actions into one shot. Aim for about a third of the links to be continuous. A chain of continuous shots has at most 3 shots.
- location: an entity name of kind location.
- start: the full state at the first frame. description = one still-image paragraph: framing, where everyone and everything is, light, time, weather, present tense, only what is visible, using entity names. time_light = time of day and light in a few words. entities = every visible character and prop: position (where in the frame and in the place, for example "left third, kneeling on wet sand at mid-ground"), holding (the prop a character holds, else null), held_by (the character holding this prop, else null), placed_on (the surface or thing a prop rests on, else null), condition (the state that may change: glowing, lit, dark, open, wet, seated, empty hands, …).
  For a continuous shot, start is the previous shot's end state: copy it.
- action: one clear action, under 25 words, present tense, who does what during the 5 seconds. Name only visible things. Do not describe looks.
- camera: "Static camera." or one simple move (slow push in, slow pan, slow tilt).
- motion_in: for a continuous shot, how the motion is already underway at the first frame ("already walking mid-stride", "hand already turning the shell"); for a cut, "still" or the motion present at the first frame.
- end: description = a still paragraph of the last frame with the same framing; changes = every attribute that changes during the shot (name, attr, from, to).
- persist: changes that must carry into all later shots (a costume change, a lamp that is now lit, a shell that is now dim); attr and to are short values ("condition", "lit"); else [].
- sound: ambient = the natural background sound of this place and moment, one phrase (wind, surf, rain on glass, room tone). effects = sound events with their time in seconds from the shot start (a shell set on wood at 2 s, a hinge creak at 1 s). Always give ambient and effects, even when the request says "just score" or "no dialogue": that rules out speech, not the world's sound; the mixer sets the levels. Diegetic sounds only; no music here.
- start_upload: the upload name when the first frame is the uploaded image itself ("animate this photo"); then link = cut and start describes the upload. Else null.

audio.music: cue points for the score, each with the shot id, the time inside that shot in seconds, kind (in, out, motif, swell) and a short text (mood, instrument, the story moment). Put the first "in" at the start if the story has a score and the last "out" where it ends. If the request says silent or no music, give [].
audio.voiceover: narration lines with shot and time, only if the story has narration or dialogue; else [].
layers: on-screen text (titles, end cards, captions) is never drawn inside a shot. Each layer: exact wording (copy any text the user specified character for character), start and end in seconds of the final video, position. A shot under an end card shows a calm background with empty space for the text. Else [].

The original user request was: {{request}}
Uploads: {{uploads}}

Story:
{{story}}

Operational chunks:
{{chunks}}`;

export async function storyboard({ request, uploads, story, chunks, count }) {
  const prompt = TEMPLATE.replaceAll("{{count}}", String(count)).replace("{{request}}", () => request).replace("{{uploads}}", () => uploads)
    .replace("{{story}}", () => story).replace("{{chunks}}", () => chunks);
  const plan = await jsonCall({ name: "storyboardmem", schema: SCHEMA, prompt, effort: "medium" });
  if (plan.shots[0]) plan.shots[0].link = "cut";
  // A chain of continuous shots is at most 3 long.
  let run = 0;
  for (const s of plan.shots) { if (s.link === "continuous" && run >= 2) s.link = "cut"; run = s.link === "cut" ? 0 : run + 1; }
  for (const s of plan.shots) if (s.link === "cut" && !s.start.description) throw new Error(`shot ${s.id}: cut without start description`);
  return plan;
}

// Scenes: a cut starts one; continuous shots extend it.
export function scenesOf(shots) {
  const out = [];
  for (const s of shots) (s.link === "cut" || !out.length ? out.push([s]) : out.at(-1).push(s));
  return out;
}
export const byName = (plan) => Object.fromEntries(plan.entities.map((e) => [e.name, e]));
