// State timeline: the only creative LLM call. Story + chunks → entities with fixed looks and real sizes, and beats with typed
// entity states (wardrobe, pose, position, interacting_with, condition, lighting), changes (transient or carried forward),
// pointers to the beat each entity continues from, cut/continuous, and sound cues. No prompts: prompts come from state differences.
import { jsonCall } from "../../state-manager/src/llm.js";
import { retry } from "./net.js";

export const ATTRS = ["wardrobe", "pose", "position", "interacting_with", "condition", "lighting"];
const str = { type: "string" };
const entityState = { type: "object", additionalProperties: false, required: ["id", ...ATTRS], properties: {
  id: str, wardrobe: str, pose: str, position: str, interacting_with: { type: "array", items: str }, condition: str, lighting: str } };
const frameState = { type: "object", additionalProperties: false, required: ["framing", "description", "entities"], properties: { framing: str, description: str, entities: { type: "array", items: entityState } } };
const change = { type: "object", additionalProperties: false, required: ["id", "attr", "from", "to", "carry", "sound"], properties: {
  id: str, attr: { type: "string", enum: ATTRS }, from: str, to: str, carry: { type: "string", enum: ["transient", "forward"] }, sound: str } };
export const SCHEMA = { type: "object", additionalProperties: false, required: ["style", "entities", "beats", "layers"], properties: {
  style: str,
  entities: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "kind", "look", "size", "upload"], properties: {
    id: str, kind: { type: "string", enum: ["character", "prop", "location"] }, look: str, size: str, upload: { type: ["string", "null"] } } } },
  beats: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["n", "link", "seconds", "location", "time", "weather", "start", "action", "camera", "end", "changes", "continues", "ambience", "music"], properties: {
      n: { type: "integer" }, link: { type: "string", enum: ["cut", "continuous"] }, seconds: { type: "integer", enum: [5] }, location: str, time: str, weather: str,
      start: frameState, action: str, camera: str, end: frameState, changes: { type: "array", items: change },
      continues: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "from_beat"], properties: { id: str, from_beat: { type: "integer" } } } },
      ambience: str, music: { type: "object", additionalProperties: false, required: ["cue", "event"], properties: { cue: str, event: { type: "string", enum: ["start", "hold", "change", "stop"] } } } } } },
  layers: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "start_s", "end_s", "position"], properties: {
    text: str, start_s: { type: "number" }, end_s: { type: "number" }, position: { type: "string", enum: ["center", "lower third", "top"] } } } },
} };

const TEMPLATE = `Turn this story into a state timeline for a video system. A video is a visual guide to the story: at every moment the story has one visible state. The timeline lists those states; the system draws frames from them and derives its own prompts, so write states, not prompts.

Cover the story as exactly {{count}} beats of 5 seconds each ({{seconds}} seconds), in story order, spread over the whole story.

style: one line about the look of a single frame only (medium, palette, texture, light). No sound, durations or counts.

entities: every character, prop and location that is seen, each with a short id (lowercase, one word, for example keeper, shell, beach).
- look: the traits that never change, starting with the exact kind of thing (a seashell is a spiral marine snail shell; a lighthouse lamp is a fixed beacon with a glass housing, not a hand lantern). Face, age, hair, build for characters; shape, material, colours for props; architecture and landscape for locations. No pose, time or weather.
- size: the real size, in metres or centimetres, and relative to a person (for example "7 cm, fits in a palm"; "1.7 m tall woman"; "beacon lamp as tall as a person").
- upload: the upload name (u1, u2, …) when an uploaded image shows this entity, else null.

beats:
- link: "cut" (new camera setup, framing, place or time) or "continuous" (same place and framing; the beat starts from the exact last frame of the previous beat, so its action must be visible in that same framing). At least {{min_continuous}} beats must be continuous: when a story moment has two actions in one place (walk then kneel; open the housing then bring the shell to the burner; settle the shell then stand and walk away), give it a cut beat followed by a continuous beat.
- location: the id of one location entity. time and weather: short values.
- Every character and prop that appears anywhere in a beat is already visible in the beat's start frame (an entrance happened before the beat; a figure may stand at the frame edge or far away). Nothing with an identity enters during a beat, because the video model would invent it. Only places and light may be revealed by the camera.
- start and end: the full state at the first and the last frame. framing = one short line (wide / medium / close, angle). description = one still-image sentence of what is in frame and where. entities = the typed state of every entity visible in that frame, with:
  wardrobe (characters only; else ""), pose, position (where in the frame and relative to other entities, with distances in metres or centimetres), interacting_with (ids it touches, holds, sits on, stands beside; else []), condition (physical state only: glowing, lit, dark, wet, open, closed, intact, …; expressions belong in pose), lighting.
  Use the same value strings when a value does not change. A continuous beat's start is the previous beat's end: copy it.
- action: what happens during the 5 seconds, one clear action, under 25 words, using entity ids. camera: "Static camera." or one simple move.
- changes: each attribute that differs between start and end, as id, attr, from, to. carry = "forward" when later beats must keep the new value (a clothing change, a lamp that goes out, a shell put down, a beach strewn with driftwood), "transient" when it is only this beat's motion (a pose, a glance, lighting). sound = the sound of this change (a few words) or "".
- continues: for each entity in the beat, the earlier beat where it last appeared (0 if this is its first appearance). This is the pointer the system follows.
- ambience: the natural background sound of this place, weather and time (a few words, no music), always given even when the story asks for score only; the mix sets its level.
- music: cue = the music feel for this story beat (a few words); event = start (a new cue begins), hold (the current cue continues), change (the cue changes mood), stop (silence).

layers: exact on-screen text (titles, end cards) with start and end seconds and position; [] when none. Copy any text the user specified character for character.

Original request: {{request}}
Uploads: {{uploads}}

Story:
{{story}}

Operational chunks (the story's own change list; keep its order):
{{chunks}}`;

export async function planTimeline({ request, uploads, story, chunks, count, seconds }) {
  const prompt = TEMPLATE.replace("{{count}}", count).replace("{{min_continuous}}", Math.max(1, Math.floor(count / 3))).replace("{{seconds}}", seconds).replace("{{request}}", () => request)
    .replace("{{uploads}}", () => uploads).replace("{{story}}", () => story).replace("{{chunks}}", () => chunks);
  const t = await retry(() => jsonCall({ name: "statetimeline", schema: SCHEMA, prompt, effort: "medium" }), { label: "timeline" });
  if (t.beats[0]) t.beats[0].link = "cut";
  const ids = new Set(t.entities.map((e) => e.id));
  for (const b of t.beats) for (const fs of [b.start, b.end]) fs.entities = fs.entities.filter((e) => ids.has(e.id));
  return { ...t, template: prompt.length };
}
