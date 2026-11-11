// SCREENPLAY: the shooting script, one call. Scenes (place, time, tone, the 180-degree line, blocking) → shots (camera, seconds
// on the clip model's grid, moment) → a FIRST and LAST frame per shot for EVERY element (third, depth, facing, distance, pose,
// hands, doing; props: where, condition) → timed action, spoken lines, sounds, changes. The staging text here is for the
// screenplay's own continuity; the keyframe prompts copy only positions and intention from it, never the camera prose.
// checkScript() verifies the structure in code before anything is paid; scriptText() prints it for review.
import { jsonCall, S } from "../../lib/llm.js";
import { VIDEOS } from "../../lib/models.js";
import { applyStage, checkStage, staged } from "./stage.js";

// Seconds a clip may run, per video model (Magic Hour image-to-video; veo with an end frame).
export const GRID = Object.fromEntries(Object.entries(VIDEOS).map(([k, v]) => [k, v.grid]));   // seconds per video model, from the model registry (lib/models.js): the screenplay snaps every shot to the chosen model's grid
export const PERSON_FIELDS = ["visible", "third", "depth", "size", "facing", "distance", "pose", "hands", "doing"], PROP_FIELDS = ["visible", "where", "size", "points", "facing", "condition"];
export const SIZE_WORDS = { fills: "filling most of the frame's height", large: "about half the frame's height", medium: "about a quarter of the frame's height", small: "about a tenth of the frame's height", tiny: "a speck, far off" };
export const inFrame = (x) => x.visible === "in frame";
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const kinds = (els) => ({ chars: els.filter((e) => e.kind === "character"), props: els.filter((e) => e.kind === "prop"), places: els.filter((e) => e.kind === "place"), fixtures: els.filter((e) => e.kind === "fixture") });

export function scriptSchema(els) {
  const { chars, props, places, fixtures } = kinds(els);
  const CID = S.enum(chars.map((e) => e.id)), PID = S.enum(props.length ? props.map((e) => e.id) : ["none"]), ANY = S.enum([...chars, ...props].map((e) => e.id)), PLACE = S.enum(places.map((e) => e.id));
  const VIS = S.enum(["in frame", "off left", "off right"]), RELID = S.enum([...chars, ...props, ...fixtures].map((e) => e.id));
  const RELATION = S.obj({ a: RELID, how: S.str, b: RELID });   // a preposition between two elements: "flies toward", "beside", "falls toward", "faces", "a wingspan left of"
  const SZ = S.enum(["fills", "large", "medium", "small", "tiny"]);   // of the frame's height: most of it, about half, a quarter, a tenth, a speck
  const PON = S.enum(props.map((e) => e.id).concat("none"));   // the vehicle or mount a person is inside, aboard or riding at this instant; "none" on their own feet
  const PERSON = S.obj({ id: CID, visible: VIS, third: S.enum(["left", "centre", "right"]), depth: S.enum(["near", "mid", "far"]), size: SZ, facing: S.str, distance: S.str, pose: S.str, hands: S.str, doing: S.str, on: PON });
  const PT = S.obj({ x: S.num, y: S.num, z: S.num });   // a point on the scene's stage, metres: x along the axis toward the goal, y to the right when facing +x, z up
  const POINTS = S.enum(["away from the camera", "toward the camera", "across to screen left", "across to screen right", "down", "up", "none"]);   // structured heading, for the checks
  const ON = S.enum([...chars, ...props].map((e) => e.id).concat("none"));   // what a prop is attached to, mounted on, held by or carried in at this instant; structured, so the painter and the load gate know what each host carries
  const PROP = S.obj({ id: PID, visible: VIS, where: S.str, size: SZ, points: POINTS, facing: S.str, condition: S.str, on: ON, at: PT, heading: S.num, pitch: S.num });
  const FRAME = S.obj({ people: S.arr(PERSON), props: S.arr(PROP), relations: S.arr(RELATION) });
  const VIEW = S.enum(["from behind", "from ahead", "from the side", "from above", "from below", "from inside"]);
  const MOTION = S.enum(["motion blur on the subject", "vapor over the wings", "contrails", "wake on the water", "spray", "dust or debris", "foreground element whipping past the lens", "camera low to the ground or sea", "strong diagonals", "subjects entering and leaving the frame", "lens streaks", "crisp frozen detail", "none"]);
  const CAMERA_MOVE = S.enum(["static", "slow pan", "whip pan", "tracking alongside", "push in", "pull back", "handheld shake", "tilt up", "tilt down"]);   // honoured only when the shot is rendered as a sequence (nothing pinned); a still camera otherwise   // where the camera is relative to its subjects: the one orientation word the painter needs
  const CAMERA = S.obj({ same_as: S.int, stands: S.str, view: VIEW, move: CAMERA_MOVE, height: S.enum(["eye", "low", "high"]), looks_at: S.str, behind: S.arr(S.str), at: PT, toward: PT, moves_with: S.enum(props.map((e) => e.id).concat("none")) });
  const AT = (extra = {}) => S.obj({ at: S.int, ...extra, text: S.str });
  const SHOT = S.obj({ n: S.int, start: S.int, seconds: S.int, size: S.enum(["wide", "medium-wide", "medium", "medium-close", "close"]), cut_reason: S.enum(["scene start", "time up", "new point of interest"]), moment: S.str, treatment: S.str, pace: S.enum(["still", "slow", "natural", "fast", "frantic"]), motion: S.arr(MOTION),
    camera: CAMERA, first: FRAME, action: S.arr(AT()), lines: S.arr(AT({ who: CID })), sfx: S.arr(AT()), vo: S.arr(AT()), last: FRAME, changes: S.arr(S.str) });
  const STAGE = S.obj({ axis: S.str, goal: S.enum([...props, ...fixtures].map((e) => e.id).concat("none")) });   // the scene's coordinate frame in words, and the element x runs toward
  const SCENE = S.obj({ n: S.int, place: PLACE, inside: S.bool, time: S.enum(["DAY", "NIGHT", "DAWN", "DUSK"]), continuous: S.bool, start: S.int, seconds: S.int, synopsis: S.str, situation: S.str, stage: STAGE, tone: S.str, ambience: S.str, captions: S.arr(AT()),
    line: S.obj({ between: S.str, camera_side: S.str }), blocking: S.arr(S.obj({ id: ANY, where: S.str, facing: S.str, holding: S.str })), shots: S.arr(SHOT) });
  // Music is a FILM-level asset: one cue for one bed, made once and mixed under the whole film; the arc names the few
  // moments it changes. Clips never carry music (each clip composed its own riff when the cue was handed to every clip).
  return S.obj({ title: S.str, synopsis: S.str, theme: S.str, music: S.obj({ cue: S.str, arc: S.arr(AT()) }), scenes: S.arr(SCENE) });
}
// Cutting pace by the film's kind: the longest shot and how often to cut, given to the screenplay call.
export const PACING = {
  ad: { max: 4, text: "This is an AD: shots of 2 to 4 seconds, 8 to 15 shots in 30 seconds, every cut a new size or a new angle, pace fast on every action shot; nothing holds longer than 4 seconds." },
  trailer: { max: 4, text: "This is a TRAILER: shots of 2 to 4 seconds, every cut a new size or angle, pace fast or frantic on action; nothing holds longer than 4 seconds." },
  "music-video": { max: 5, text: "This is a MUSIC VIDEO: shots of 2 to 5 seconds cut on the beat, every cut a new size or angle." },
  drama: { max: 10, text: "This is a DRAMA: shots of 3 to 10 seconds, cut where the content turns; dialogue in singles and two-shots." },
  documentary: { max: 10, text: "This is a DOCUMENTARY: shots of 3 to 10 seconds, held long enough to read; cut where the content turns." },
  explainer: { max: 8, text: "This is an EXPLAINER: shots of 3 to 8 seconds, each showing one thing clearly." },
  short: { max: 8, text: "This is a SHORT FILM: shots of 2 to 8 seconds, cut where the content turns." },
};

// The prompt of the one call, as text (so a run can record exactly what was asked).
export function scriptPrompt({ story, elements: els, total = 30, max = 15, model = "wan-3.0", seen = {}, kind = "drama" }) {
  const { chars, props, places, fixtures } = kinds(els);
  const pacing = PACING[kind] || PACING.drama, grid = (GRID[model] || GRID["wan-3.0"]).filter((s) => s <= Math.min(max, pacing.max));
  // seen: per place, what its plate actually contains (the state manager's description), so the shots are staged around it.
  const placeLine = (e) => `${e.id} = ${e.name}; fixtures: ${e.look}${seen[e.id]?.fixtures ? ` | as seen in its picture: ${seen[e.id].walls}; ${seen[e.id].fixtures.map((f) => `${f.detail || f.name} (${f.side}, ${f.depth})`).join("; ")}` : ""}`;
  return `Turn this story into a SHOOTING SCRIPT for a ${total}-second live-action film. Code paints the first and the last frame of every shot from the frames you write and makes the clip between them, so every frame must be complete and unambiguous; nothing is left to interpretation.

Elements (use ONLY these ids; no other person or object may appear):
- characters: ${chars.map((e) => `${e.id} = ${e.name}`).join("; ")}
- props: ${props.map((e) => `${e.id} = ${e.name}`).join("; ") || "none (the props arrays stay empty)"}
- places: ${places.map(placeLine).join(" | ")}
- fixtures, for camera and facing text: ${fixtures.map((e) => `${e.id} = ${e.name}`).join("; ") || "none"}

SYNOPSIS (film level): the whole story in three to five sentences, in order: who, where they are, what they do, how it ends ("Two F-35C pilots, Vega and Rook, fly in formation over open sea toward a decommissioned frigate. They check in by radio and by a nod. They bank, release one bomb each, the frigate burns, and they climb away."). It is read by the image painter to know what part of the story every frame illustrates.
THEME (film level): the film's idea in one line, the subtext every frame carries ("two pilots who move as one; trust shown, not said"); no objects, no events.

MUSIC (film level): cue = one line for a music generator: genre, mood, instruments, tempo, for the whole ${total}-second film, instrumental ("driving electric-guitar riff over hard drums, 130 bpm, confident, cinematic"), or "" for no music; arc = the few moments the music changes, each with its film second and what happens ("drops to a low pulse", "cuts to silence"). Music exists ONLY here: scenes carry ambience, and no clip ever contains music.

${pacing.text}

SCENES: one place and one continuous stretch of time each; start and seconds contiguous over the film, the last scene ending at ${total}. time: DAY, NIGHT, DAWN or DUSK; continuous: true when the scene follows the previous one without a jump in time. situation: one sentence of the PHYSICAL situation of the world during this scene, from the story, whatever the camera shows: where every vehicle and person is and what they are doing, and what is outside any window, canopy or door ("Both jets in level flight in formation above open sea, two kilometres short of the frigate; blue sky and sea outside every canopy"); a cockpit scene says the aircraft is in flight, a parlour scene says the hour and the weather outside. synopsis: two sentences a painter needs to know where we are: what this scene is and where it sits in the story ("Two F-35s in flight over open sea, miles from any coast, have just struck a decommissioned frigate with two bombs; they climb away while it burns"); physical situation first, then the story beat; no camera, no adjectives of style. tone: one sentence on the scene's feel and stakes ("a formal, urgent first meeting; Lincoln needs an answer, Vanderbilt is blunt"), with no objects and no events in it: it is read by an image painter and a video model to set expression and delivery. ambience: the background sound under the scene (never music). captions: on-screen overlays with the film second they appear (the title, a date, a source note; never dialogue).
- line: the 180-degree line of the scene. between: the two characters (or a character and a fixture) it runs through. camera_side: the side of that line on which EVERY camera of the scene stands, named by the fixture or wall at the camera's back. No shot of the scene crosses it.
- blocking: for every character and prop of the scene, where it is when the scene starts, in world terms (relative to fixtures and to each other, not to the frame), which way it faces, and what it holds ("" if nothing).

STAGE (per scene) and POSITIONS (per frame): every scene has one coordinate frame in METRES. stage.axis names it in words ("the attack line from the formation to the frigate Harrow"; "the length of the parlour from the door to the fireplace"); stage.goal is the element x runs toward (the frigate; the fireplace; "none" when nothing is approached). x increases toward the goal, y is to the right when facing +x, z is up (0 = the sea or the floor). The camera of every shot has at {x,y,z} and toward {x,y,z}, the point it looks at. Every prop in every frame has at {x,y,z}, heading (degrees from +x turning toward +y: 0 flies toward the goal, 90 to the right of the line, 180 away from the goal, 270 to the left) and pitch (degrees, nose up positive; a falling bomb −60 to −90; 0 otherwise). A person inside or on a vehicle (on) is where the vehicle is and needs no position. Use real speeds and sizes: a jet covers 250–300 m per second, a frigate is 135 m long, a bomb released from a jet keeps the jet's forward speed and drops about 5 m in the first second and 20 m in two; a camera that sees two jets at a quarter of the frame's height must be within about 200 m of them, and a 135 m ship 2 km beyond them then takes a tenth of the frame. A frame records a POSITION and a HEADING, never a transient attitude: a bank, a roll, a flare or a nose-up for a turn is motion that the clip renders between two stills, so it never appears in a frame's condition unless the heading changes within the shot; when the heading is unchanged, both frames' conditions say the level state word for word. A TURN IS A CHANGE OF HEADING in the numbers and nothing else: when no vehicle of a shot changes heading, none of its prose (action, treatment, looks_at, relations) calls the movement a bank, a turn or a convergence, and the same for a scene's situation and synopsis and the film's synopsis against every shot they cover; say what the numbers do ("closes 19 m toward the line, straight ahead"). The painter reads every one of those words: "bank inward … converging diagonals" over a 2° change turned two jets to face each other, "banked" alone turned them to face the camera. Write the heading you want and the words will follow. From these numbers the pipeline derives each thing's screen third, depth, size word, heading relative to the camera and whether it is in frame, and replaces what you wrote for those; write the numbers so that they produce the picture you intend.
SHOTS: one continuous take from one camera that HOLDS STILL for the whole shot: no tracking, panning, tilting, descending, zooming or following inside a shot; a change of view is a new shot. seconds must be one of ${grid.join(", ")}; shots are contiguous within the scene and sum to its seconds. A new shot only where the content turns, and always with a real change: a different size, or an angle of 30 degrees or more. cut_reason: scene start, time up, or new point of interest. moment: one sentence on what this shot is dramatically, written as an instant ("Lincoln has put his question and waits; Vanderbilt weighs it; Stanton, the escort, watches"): who asks, who listens, who watches; no event before or after it, no objects. treatment: the authorial choice for this shot in ONE sentence: what the image conveys and the technique that conveys it ("speed: the aircraft streak across the frame with motion blur, the horizon tilted with the bank"; "isolation: the frigate small and alone on an empty sea, nothing else on the water"; "intimacy: the helmet fills the frame and the visor carries the wingman's reflection"); ideas and relations, never a list of objects, clothing or fixtures. motion: the cues that make the shot feel alive, chosen from the list (motion blur on the subject, vapor over the wings, contrails, wake on the water, spray, dust or debris, a foreground element whipping past the lens, the camera low to the ground or sea, strong diagonals, subjects entering and leaving the frame, lens streaks, crisp frozen detail), two or three for a fast shot, "none" for a held one; the foreground element and the low camera are the strongest in moving pictures. pace: the speed of the VISIBLE MOTION inside the shot, not the cutting rhythm: still (a held frame), slow, natural (a head turn, a nod, a conversation), fast (things cross the frame quickly, motion blur, the air shakes) or frantic; a cockpit close-up where a pilot turns and speaks is natural even in a fast-cut ad; a jet pass or a release is fast. Lines run at 2.5 words a second and an action needs at least 2 seconds; a shot holds everything it contains.
- n: shot numbers run across the whole film (the first shot of scene 2 continues the count), never restarting per scene.
- camera: at and toward = its position and the point it looks at on the stage, in metres (see STAGE); moves_with = the id of the vehicle the camera flies or rides with, keeping its distance for the whole shot (a chase camera: a jet at 260 m/s needs one, or it leaves a fixed camera's frame in a second), or none for a camera fixed in the world; stands = where the camera is in the place, on the scene's camera_side, named by the fixtures and walls around it in a photographer's words ("at the south wall, a room's width from the men, facing the doorway"), never in metres; move = the camera's own movement during the shot, one of static, slow pan, whip pan, tracking alongside, push in, pull back, handheld shake, tilt up, tilt down; it is honoured only when the shot is rendered as part of a longer sequence, and a still-frame render keeps the camera static, so stands and the frames describe the START position; view = where the camera is relative to its subjects: from behind (we see their backs or tails and what they move toward lies beyond them), from ahead (we see faces or noses and what they move toward lies behind the camera), from the side, from above, from below, from inside (inside a vehicle or room with the subject); this one word must agree with stands and with every facing in the frames; height = eye, low or high; looks_at = who or what it points at; behind = the fixtures seen behind the people, as fixture ids or nouns from the place's fixture list only. same_as = the number of an earlier shot of this scene whose setup this shot repeats exactly, else 0.
- first and last frames (first = the shot's first frame, last = its last): EVERY character and prop in the scene's blocking appears in BOTH frames of EVERY shot, as "in frame", "off left" or "off right" (off-frame people keep their state so the next shot can pick it up). These frames are read by an image painter, so they use its words: screen terms and body terms. People: third = left, centre or right of the frame (off frame: the side they are beyond); depth = near, mid or far; size = how much of the frame's HEIGHT the person or thing takes at this instant: fills (most of it), large (about half), medium (a quarter), small (a tenth), tiny (a speck): this is the scale of the picture and the physics of the scene, so a frigate two miles from the aircraft is tiny in a wide and large only in its own close shot, a bomb just released is small beside its aircraft; size changes within a shot only through movement, and across cuts only with the camera; facing = toward whom or which fixture, with the screen direction ("toward lincoln, screen right"), never a compass point; distance = to the nearest person or fixture, in body terms ("an arm's length from lincoln", "a pace behind vanderbilt", "at the doorway, a room's width from lincoln"), never metres; pose = body and head at this instant only; hands = clasped with X, at sides, holding Y; doing = what the person is doing or feeling at this instant, as direction to an actor ("has just asked and waits for the answer, eyes on vanderbilt"; "listening, weighing the question"; "the escort, silent, watching lincoln"): on = the id of the vehicle or mount the person is inside, aboard or riding at this instant (a pilot in their jet, a rider on a horse), or none on their own feet: a person inside something is judged through that thing when they are too small to see; expression, attitude and natural small posture are required here, never "attentive" for everyone; this instant only, no event before or after it. relations: the spatial and motion relations a viewer must read from this frame, as triples of ids: a = the subject, how = the preposition or verb phrase ("flies toward", "holds beside", "falls toward", "faces", "a wingspan to the left of", "above and behind"), b = the object; every element in frame appears in at least one relation; this is how the painter learns that the jets fly TOWARD the ship. Props: where = held by whom in which hand, or on which fixture, or its third and depth; size as for people; points = its heading as one of: away from the camera, toward the camera, across to screen left, across to screen right, down, up, none (a thing with no front); facing = the same in the painter's words ("seen from behind, nose away from the camera toward Harrow, screen right"; "broadside, bow to screen left"; "nose down, falling toward the ship"), or "none" for a thing with no front (a loaf, a ledger); condition = its state (raw, wrapped, open); on = the id of the thing this prop is physically attached to, mounted on, held by or carried in at this instant (a bomb on its pylon, the pylon on its aircraft, a ledger in a person's hand), or none when it is free (released, lying, flying on its own, standing by itself): the painter is told that each host carries exactly what is on it and nothing else, and a gate looks for extra things hanging from it. An aircraft that attacks something ahead of it is seen from behind by a camera behind it: tails toward the lens, never the nose, unless the view says from ahead. A camera from behind or from ahead stands ON the line between a subject and what it moves toward, which is allowed (on the line is not across it); a side view shows a thing crossing the frame, never heading somewhere, so an approach, a chase or an attack is seen from behind or from ahead at least once, and the side view is kept for the formation beats. Never clothing, age or faces in a frame: those come from the portraits.
- Continuity: the first frame of a shot copies the previous shot's last frame word for word for every element (facing, distance, pose, hands, doing; where, condition); only third and depth may differ, and only because the camera changed. Within a shot a person changes third only through an action, and the last frame says where everyone stopped. When nothing happens in a shot, its last frame copies its first frame word for word and changes is empty. A change of expression at the end of a shot (the answer heard, the offer accepted) counts as a change: list it in changes and write the last frame's doing accordingly, but only where the story turns, because every distinct frame is a separate painting.
- action: what happens, each item with the film second it starts (ids for people). lines: the dialogue as SPOKEN lines in the speaker's own words, faithful to the record; where the story reports speech ("Lincoln asks whether…") write the words, and quote directly where the story quotes; each line with its film second and speaker id. sfx: sounds with their film second, never speech. vo: narration spoken by an unseen narrator, each item with its film second and the words, only where the story tells something in narration rather than in dialogue; narration never goes in sfx or lines. changes: what differs at the end from the start, one phrase each.
- Only the events the story contains: no business the story does not contain (a handshake, a gesture, an object the story never mentions). Expression, attitude and the tone of a moment are not business; they are required. "Nothing else may appear" applies to people and props; each place keeps its declared fixtures and furniture.

Story:
${story}`;
}

// One call. salt: a run label, so the script is made fresh for the run instead of read from the cache.
export async function writeScript({ story, elements: els, total = 30, max = 15, model = "wan-3.0", salt = "", seen = {}, kind = "drama" }) {
  const grid = (GRID[model] || GRID["wan-3.0"]).filter((s) => s <= Math.min(max, (PACING[kind] || PACING.drama).max)); if (!grid.length) throw new Error(`--max ${max} is below the shortest clip ${model} can make (${(GRID[model] || GRID["wan-3.0"])[0]} s)`);
  const script = await jsonCall({ name: "shooting-script-v3", effort: "high", salt, schema: scriptSchema(els), prompt: scriptPrompt({ story, elements: els, total, max, model, seen, kind }) });
  // A repeated setup copies the earlier shot's camera, so identical frames become one still.
  for (const sc of script.scenes) for (const h of sc.shots) if (h.camera.same_as) { const o = sc.shots.find((x) => x.n === h.camera.same_as); if (o) h.camera = { ...o.camera, same_as: h.camera.same_as }; }
  return normalizeShots(script);
}
// The writer corrects its own script from the check's errors: the whole script back, every error gone, nothing else
// changed. Text only; the pipeline allows two rounds before it stops.
export async function reviseScript({ script, errors, elements: els, total = 30, max = 15, model = "wan-3.0", salt = "", seen = {}, kind = "drama", round = 1 }) {
  const fixed = await jsonCall({ name: "shooting-script-v3-revise", effort: "medium", salt: `${salt}-r${round}`, schema: scriptSchema(els),
    prompt: `Below is a shooting script as JSON and the errors a code check found in it. Return the WHOLE script, corrected so that every error is gone, and change nothing else: the same scenes, shots, frames, lines and beats, except where an error requires a change (a camera move becomes a new shot or is removed; a beat moves inside its shot; a missing element is added to a frame as off frame; a title-card shot is emptied in both frames). Keep the rules of the original call: ${scriptPrompt({ story: "", elements: els, total, max, model, seen, kind }).split("\n").filter((l) => /^(SCENES|SHOTS|STAGE|- |MUSIC)/.test(l)).join("\n")}

Errors:
${errors.map((e) => `- ${e}`).join("\n")}

Script:
${JSON.stringify(script)}` });
  return normalizeShots(fixed);
}
// A shot's identity is its number across the WHOLE film: every table (stills, clips, attempts, file names, --retry ids) is
// keyed by it. The writer may number per scene (the V2 vanderbilt run did, and three shots collapsed onto one still); this
// renumbers in film order and remaps same_as. Idempotent, so it also runs on a script loaded from an earlier run record.
// A script written before the film synopsis and the scene situations existed gets them filled by one text call from the
// story: nothing else in the script is touched. The painter of Rook's cockpit was never told the aircraft was in flight,
// because the scene synopsis the writer gave was "Rook sits inside the neighboring F-35C" and the story text never
// reaches the painter.
export async function fillStoryContext({ script, story, salt = "" }) {
  const need = !script.synopsis || script.scenes.some((sc) => !sc.situation); if (!need) return script;
  const r = await jsonCall({ name: "story-context", effort: "low", salt, schema: S.obj({ synopsis: S.str, situations: S.arr(S.obj({ n: S.int, situation: S.str })) }),
    prompt: `From the story and the scene list below, write (1) synopsis: the whole story in three to five sentences, in order: who, where they are, what they do, how it ends; (2) for every scene, situation: one sentence of the PHYSICAL situation of the world during that scene, whatever its camera shows: where every vehicle and person is and what they are doing, and what is outside any window, canopy or door (a cockpit scene says the aircraft is in flight over open sea alongside the other jet; a room says the hour and the weather outside). Plain words, no camera, no style.\nStory:\n${story}\nScenes:\n${script.scenes.map((sc) => `- scene ${sc.n}: ${sc.inside ? "INT." : "EXT."} ${sc.place}, ${sc.time}, ${sc.start}–${sc.start + sc.seconds} s: ${sc.synopsis}`).join("\n")}` });
  if (!script.synopsis) script.synopsis = r.synopsis || "";
  const by = Object.fromEntries((r.situations || []).map((x) => [x.n, x.situation])); for (const sc of script.scenes) if (!sc.situation) sc.situation = by[sc.n] || "";
  return script;
}

// A script written before `on` existed gets it filled by one text call: for every prop in every frame, what it is attached to
// (or none). Nothing else in the script is touched, so the stills' keys are unchanged (`on` is not a key field).
export async function fillAttachments({ script, elements: els, salt = "" }) {
  const props = els.filter((e) => e.kind === "prop"), hosts = els.filter((e) => e.kind === "prop" || e.kind === "character");
  const rows = []; for (const sc of script.scenes) for (const h of sc.shots) for (const w of ["first", "last"]) { for (const p of h[w].props) if (p.on === undefined) rows.push({ shot: h.n, frame: w, id: p.id, text: `${p.where}; ${p.condition}` }); for (const p of h[w].people) if (p.on === undefined) rows.push({ shot: h.n, frame: w, id: p.id, text: `${p.distance}; ${p.pose}; ${p.doing}` }); }
  if (!rows.length) return script;
  const ids = [...new Set(rows.map((x) => x.id))], people = new Set(els.filter((e) => e.kind === "character").map((e) => e.id));
  const r = await jsonCall({ name: "attachments", effort: "low", salt, schema: S.obj({ rows: S.arr(S.obj({ shot: S.int, frame: S.enum(["first", "last"]), id: S.enum(ids), on: S.enum([...new Set([...hosts.map((e) => e.id), ...props.map((e) => e.id)])].concat("none")) })) }),
    prompt: `For each row below (a prop or a person in one frame of a shooting script), answer "on": for a prop, the id of the thing it is physically attached to, mounted on, held by or carried in at that instant; for a person, the id of the vehicle or mount they are inside, aboard or riding; "none" when free (a released bomb, a thing lying or flying on its own, a ship shown on a screen, a person on their own feet). A bomb secured beneath a pylon is on the pylon; the pylon is on its aircraft; a pilot in a cockpit is on that aircraft. Elements: ${hosts.map((e) => `${e.id} (${e.name}, ${e.kind})`).join(", ")}.\nRows:\n${rows.map((x) => `- shot ${x.shot}, ${x.frame} frame, ${x.id}${people.has(x.id) ? " (a person)" : ""}: ${x.text}`).join("\n")}\nReturn one row per input row, in order.` });
  const by = Object.fromEntries((r.rows || []).map((x) => [`${x.shot}:${x.frame}:${x.id}`, x.on]));
  for (const sc of script.scenes) for (const h of sc.shots) for (const w of ["first", "last"]) for (const p of [...h[w].props, ...h[w].people]) if (p.on === undefined) p.on = by[`${h.n}:${w}:${p.id}`] || "none";
  return script;
}

export function normalizeShots(script, elements = null) {
  let n = 0;
  for (const sc of script.scenes) { const map = {}; for (const h of sc.shots) { map[h.n] = ++n; h.n = n; h.pace ??= "natural"; h.motion ??= []; if (h.camera) h.camera.move ??= "static"; } for (const h of sc.shots) if (h.camera?.same_as) h.camera.same_as = map[h.camera.same_as] || 0; }
  // A script written before music was film-level: lift the first scene cue into the film header, drop the scene field.
  if (!script.music) script.music = { cue: (script.scenes.map((sc) => sc.music).find(Boolean) || ""), arc: [] };
  script.theme ??= ""; script.synopsis ??= ""; for (const sc of script.scenes) { sc.synopsis ??= ""; sc.situation ??= ""; sc.stage ??= null; }
  for (const sc of script.scenes) delete sc.music;
  if (elements) script.stage_notes = applyStage(script, elements);   // the stage's numbers replace the writer's screen words
  return script;
}

// Code checks. errors: the structure is wrong (timing, grid, presence, thirds). notes: things to look at (continuity wording,
// timing pressure, undeclared fixtures). Nothing is paid while errors exist.
export function checkScript(script, { total, max = 15, model = "wan-3.0", elements: els, seen = {}, kind = "drama" }) {
  const grid = (GRID[model] || GRID["wan-3.0"]).filter((s) => s <= Math.min(max, (PACING[kind] || PACING.drama).max)), errors = [], notes = [];
  const MOVES = /\b(track(?:s|ing)?|dolly|dollies|descend(?:s|ing)?|tilt(?:s|ing)?|pan(?:s|ning)?|zoom(?:s|ing)?|follow(?:s|ing)?|push(?:es|ing)? in|pull(?:s|ing)? (?:back|out)|orbit(?:s|ing)?|crane|handheld|whip)\b/i;
  for (const m of script.music?.arc || []) if (m.at < 0 || m.at >= total) errors.push(`music arc at ${m.at} s is outside the film`);
  const vocab = [...els.flatMap((e) => [e.id, e.name, e.aka || "", ...(e.kind === "place" || e.kind === "fixture" ? e.look.split(/[,.;]/) : [])]), ...Object.values(seen).flatMap((p) => (p.fixtures || []).flatMap((f) => [f.name, f.detail]))].map(norm).filter(Boolean);
  // A mention is declared when it is contained in a vocabulary entry, or shares most of its content words with one.
  const STOP = new Set(["the", "a", "an", "of", "and", "with", "in", "on", "at", "to", "its", "his", "her", "their", "that", "this", "is", "are"]);
  const words = (s) => norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  const declared = (m) => { const w = norm(m).replace(/^(the|a|an) /, ""); if (!w || vocab.some((v) => v.includes(w) || w.includes(v))) return true; const mw = words(w); return mw.length > 0 && vocab.some((v) => { const vw = new Set(words(v)); return mw.filter((x) => vw.has(x)).length >= Math.ceil(mw.length / 2); }); };
  for (const e of checkStage(script, els)) errors.push(e);   // the stage: the impossible in metres
  let t = 0;
  const nums = script.scenes.flatMap((sc) => sc.shots.map((h) => h.n)), dupN = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupN.length) errors.push(`shot numbers repeat across the film (${[...new Set(dupN)].join(", ")}): every table is keyed by the number`);
  for (const sc of script.scenes) {
    if (sc.start !== t) errors.push(`scene ${sc.n} starts at ${sc.start} s, expected ${t}`);
    const ids = sc.blocking.map((b) => b.id);
    let u = sc.start, prev = null;
    for (const h of sc.shots) {
      if (h.start !== u) errors.push(`shot ${h.n} starts at ${h.start} s, expected ${u}`);
      if (!grid.includes(h.seconds)) errors.push(`shot ${h.n}: ${h.seconds} s is not on the grid (${grid.join(", ")})`);
      u += h.seconds;
      if (h.camera.same_as && !sc.shots.some((x) => x.n === h.camera.same_as && x.n < h.n)) errors.push(`shot ${h.n}: same_as ${h.camera.same_as} is not an earlier shot of scene ${sc.n}`);
      // The camera holds still within a shot: the clip stage pins two frames from ONE camera position. A written move
      // made the two frames of one Top Gun shot come from different positions, and the model morphed between them.
      // A move counts only where the CAMERA is the subject of the clause and the clause is not negated ("the locked camera
      // does not follow", "a fixed position"): the bombs may descend and the wingman may follow.
      for (const [field, text] of [["stands", h.camera.stands], ["looks_at", h.camera.looks_at], ...h.action.map((a) => ["action", a.text])]) {
        for (const clause of String(text || "").split(/[.;,]/)) { const m = clause.match(MOVES); if (!m) continue; if (field !== "stands" && !/\bcamera\b/i.test(clause)) continue; if (/\b(not|never|no|without|locked|fixed|static|still|holds?)\b/i.test(clause)) continue; notes.push(`shot ${h.n}: the camera may move ("${m[0]}" in ${field}); the camera holds still within a shot, a new view is a new shot`); break; }   // prose read by a pattern: a note, never an error
      }
      for (const which of ["first", "last"]) {
        const present = [...h[which].people, ...h[which].props].map((x) => x.id);
        for (const id of ids) if (!present.includes(id)) errors.push(`shot ${h.n} ${which} frame: ${id} is missing (every element of the scene is in every frame, in or off)`);
        for (const id of present) if (!ids.includes(id)) errors.push(`shot ${h.n} ${which} frame: ${id} is not in scene ${sc.n}'s blocking`);
        const dup = present.filter((id, i) => present.indexOf(id) !== i); if (dup.length) errors.push(`shot ${h.n} ${which} frame: ${dup.join(", ")} listed twice`);
        for (const x of [...h[which].people, ...h[which].props]) if (!["in frame", "off left", "off right"].includes(x.visible)) errors.push(`shot ${h.n} ${which} frame: ${x.id} visible "${x.visible}" is not in frame, off left or off right`);
        // Scale sanity: a far person or thing is never large; a near one is never tiny (the painter was drawing far frigates at a third of the frame).
        for (const x of h[which].people) if (inFrame(x) && x.size) { if (x.depth === "far" && ["fills", "large"].includes(x.size)) errors.push(`shot ${h.n} ${which} frame: ${x.id} is far yet ${x.size}`); if (x.depth === "near" && x.size === "tiny") errors.push(`shot ${h.n} ${which} frame: ${x.id} is near yet tiny`); }
        for (const x of h[which].props) if (inFrame(x) && x.size && /\bfar\b/i.test(x.where) && ["fills", "large"].includes(x.size)) errors.push(`shot ${h.n} ${which} frame: ${x.id} is far yet ${x.size}`);
        if (![...h[which].people, ...h[which].props].some(inFrame)) { if (sc.captions.some((c) => c.at >= h.start && c.at < h.start + h.seconds)) { if (which === "first") notes.push(`shot ${h.n}: a title card (nothing in frame; the caption at ${sc.captions.find((c) => c.at >= h.start && c.at < h.start + h.seconds).at} s fills it)`); } else errors.push(`shot ${h.n} ${which} frame: nobody and nothing in frame, and no caption to fill it`); }
      }
      for (const w of ["first", "last"]) for (const r of h[w].relations || []) { const present = new Set([...h[w].people, ...h[w].props].map((x) => x.id)), fix = new Set(els.filter((e) => e.kind === "fixture").map((e) => e.id)); for (const id of [r.a, r.b]) if (!present.has(id) && !fix.has(id)) errors.push(`shot ${h.n} ${w} frame: relation "${r.a} ${r.how} ${r.b}" names ${id}, which is not in this frame`); }
      const empties = ["first", "last"].filter((w) => ![...h[w].people, ...h[w].props].some(inFrame));
      if (empties.length === 1) errors.push(`shot ${h.n}: the ${empties[0]} frame is empty and the other is not; a title card is a whole shot, empty in both frames`);
      for (const a of h.first.props) { const b = h.last.props.find((x) => x.id === a.id); if (b && a.points && b.points && inFrame(a) && inFrame(b) && a.points !== b.points && !h.action.length) errors.push(`shot ${h.n}: ${a.id} turns (${a.points} → ${b.points}) with no action`); }   // the structured heading, not the prose
      // Orientation agreement, from the structured fields only (no reading of prose): a camera from behind cannot have a prop pointing toward it, nor from ahead one pointing away.
      for (const w of ["first", "last"]) for (const x of h[w].props) if (x.on && x.on !== "none") { const host = [...h[w].people, ...h[w].props].find((y) => y.id === x.on); if (x.on === x.id) errors.push(`shot ${h.n} ${w} frame: ${x.id} is on itself`); else if (!host) errors.push(`shot ${h.n} ${w} frame: ${x.id} is on ${x.on}, which is not in the frame list`); else if (inFrame(x) && !inFrame(host)) errors.push(`shot ${h.n} ${w} frame: ${x.id} is in frame on ${x.on}, which is off frame`); }   // the structured attachment: its host is in the same frame
      // The camera's prose and the frame list must agree about who is in view: "behind Vega's left shoulder; Vega's shoulder and
      // helmet edge in frame" with Vega listed off frame painted Vega twice and failed the people gate twice. A note: prose.
      for (const w of ["first", "last"]) for (const q of h[w].people) if (!inFrame(q)) { const nm = els.find((e) => e.id === q.id)?.name || q.id; const cam = `${h.camera?.stands || ""} ${h.camera?.looks_at || ""}`; if (new RegExp(`\\b${q.id}\\b|\\b${nm.split(" ")[0]}\\b`, "i").test(cam) && /\b(shoulder|helmet|hand|arm|head|back|edge of frame|in frame|in view|visible)\b/i.test(cam)) notes.push(`shot ${h.n} ${w} frame: ${q.id} is listed ${q.visible}, but the camera text puts part of them in view ("${cam.slice(0, 80)}…"); list them in frame or move the camera`); }
      if (h.camera?.view === "from the side" && ["first", "last"].some((w) => (h[w].relations || []).some((r) => /\btoward\b/i.test(r.how)))) notes.push(`shot ${h.n}: something moves toward something else, but the camera is from the side; heading reads only from behind or from ahead (a side view shows a thing crossing the frame)`);
      for (const w of ["first", "last"]) for (const x of h[w].props) if (inFrame(x) && x.points) { if (h.camera.view === "from behind" && x.points === "toward the camera") errors.push(`shot ${h.n} ${w} frame: the camera is from behind, yet ${x.id} points toward the camera`); if (h.camera.view === "from ahead" && x.points === "away from the camera") errors.push(`shot ${h.n} ${w} frame: the camera is from ahead, yet ${x.id} points away from it`); }
      for (const a of h.first.people) {
        const b = h.last.people.find((x) => x.id === a.id); if (!b) continue;
        if ((b.third !== a.third || b.visible !== a.visible) && !h.action.length) errors.push(`shot ${h.n}: ${a.id} changes third or leaves the frame with no action`);
        if (!h.action.length && !h.changes.length) { const d = PERSON_FIELDS.filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`shot ${h.n}: no action and no change, but ${a.id}'s last frame differs in ${d.join(", ")}`); }
      }
      if (prev) {
        for (const a of h.first.people) { const b = prev.last.people.find((x) => x.id === a.id); if (!b) continue; const d = ["facing", "distance", "pose", "hands", "doing"].filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`continuity: shot ${h.n} first vs shot ${prev.n} last, ${a.id}: ${d.map((k) => `${k} "${b[k]}" → "${a[k]}"`).join("; ")}`); }
        for (const a of h.first.props) { const b = prev.last.props.find((x) => x.id === a.id); if (!b) continue; const d = ["where", "condition"].filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`continuity: shot ${h.n} first vs shot ${prev.n} last, ${a.id}: ${d.map((k) => `${k} "${b[k]}" → "${a[k]}"`).join("; ")}`); }
      }
      const need = h.lines.reduce((n, l) => n + l.text.split(/\s+/).length / 2.5, 0) + 2 * h.action.length;   // narration plays over the film, not inside the clip
      if (need > h.seconds + 0.5) notes.push(`shot ${h.n}: ${h.seconds} s holds about ${Math.round(need)} s of lines and actions`);
      for (const b of [...h.lines, ...h.action, ...h.sfx, ...(h.vo || [])]) if (b.at < h.start || b.at >= h.start + h.seconds) errors.push(`shot ${h.n}: a beat at ${b.at} s is outside the shot (${h.start}–${h.start + h.seconds} s)`);
      for (const m of h.camera.behind) if (!declared(m)) notes.push(`shot ${h.n}: "${m}" behind the people is not a declared fixture`);
      if (h.treatment && /\b(camera|lens|angle|composition|framing|portrait|insert|view|crop|shot)\b/i.test(h.treatment)) notes.push(`shot ${h.n}: the treatment talks about the camera ("${h.treatment.slice(0, 70)}…"); it should carry the idea and the technique that conveys it, the view field carries the camera`);
      // Content in the wrong slot: speech or narration written into sfx or action belongs in lines or vo.
      for (const x of h.sfx) if (/\b(narration|narrator|voice-?over)\b|["\u201c][^"\u201d]{12,}["\u201d]|\bsays?\b/i.test(x.text)) notes.push(`shot ${h.n}: sfx may hold speech or narration ("${x.text.slice(0, 60)}"); spoken words belong in lines or vo`);   // prose read by a pattern: a note, never an error
      for (const a of h.action) if (/["\u201c][^"\u201d]{12,}["\u201d]/.test(a.text)) notes.push(`shot ${h.n}: action quotes a sentence; spoken words belong in lines or vo`);
      prev = h;
    }
    if (u !== sc.start + sc.seconds) errors.push(`scene ${sc.n}: shots sum to ${u - sc.start} s, scene says ${sc.seconds}`);
    for (const c of sc.captions) if (c.at < sc.start || c.at >= sc.start + sc.seconds) errors.push(`scene ${sc.n}: caption at ${c.at} s is outside the scene`);
    t = sc.start + sc.seconds;
  }
  if (t !== total) errors.push(`film ends at ${t} s, expected ${total}`);
  return { errors, notes };
}

// The script as text, for review.
export function scriptText(script, els, { total } = {}) {
  const name = (id) => els.find((e) => e.id === id)?.name || id;
  const pf = (p) => `      ${p.id.padEnd(11)} [${p.visible}]  ${p.third} third, ${p.depth}${p.size ? `, ${p.size}` : ""}; facing ${p.facing}; ${p.distance}; ${p.pose}; hands ${p.hands}; doing: ${p.doing}`;
  const xf = (p) => `      ${p.id.padEnd(11)} [${p.visible}]  ${p.where}${p.size ? `; ${p.size}` : ""}${p.on && p.on !== "none" ? `; on ${p.on}` : ""}${p.at ? `; at (${p.at.x}, ${p.at.y}, ${p.at.z}) hdg ${p.heading ?? 0}°${p.pitch ? ` pitch ${p.pitch}°` : ""}` : ""}${p.facing && p.facing !== "none" ? `; facing ${p.facing}` : ""}; ${p.condition}`;
  const fr = (f) => [...f.people.map(pf), ...f.props.map(xf), ...(f.relations?.length ? [`      relations: ${f.relations.map((r) => `${r.a} ${r.how} ${r.b}`).join("; ")}`] : [])].join("\n");
  const out = [`${script.title.toUpperCase()}  (${total ?? script.scenes.reduce((n, s) => n + s.seconds, 0)} s; ${script.scenes.length} scenes, ${script.scenes.reduce((n, s) => n + s.shots.length, 0)} shots)`];
  if (script.synopsis) out.push(`synopsis: ${script.synopsis}`);
  if (script.theme) out.push(`theme: ${script.theme}`);
  if (script.music?.cue) out.push(`music: ${script.music.cue}${script.music.arc?.length ? `   arc: ${script.music.arc.map((m) => `[${m.at}s] ${m.text}`).join("  ")}` : ""}`);
  for (const s of script.scenes) {
    out.push(`\n${s.n}. ${s.inside ? "INT." : "EXT."} ${name(s.place).toUpperCase()} — ${s.time}${s.continuous ? " (CONTINUOUS)" : ""}   ${s.start}–${s.start + s.seconds} s`);
    if (s.synopsis) out.push(`   synopsis: ${s.synopsis}`);
    if (s.situation) out.push(`   situation: ${s.situation}`);
    if (s.stage?.axis) out.push(`   stage: ${s.stage.axis}; x toward ${s.stage.goal}`);
    out.push(`   tone: ${s.tone}`);
    out.push(`   ambience: ${s.ambience}`);
    if (s.captions.length) out.push(`   captions: ${s.captions.map((c) => `[${c.at}s] "${c.text.replace(/\n/g, " / ")}"`).join("  ")}`);
    out.push(`   line: ${s.line.between}; camera side: ${s.line.camera_side}`);
    out.push(`   blocking: ${s.blocking.map((b) => `${b.id}: ${b.where}; facing ${b.facing}; holding ${b.holding || "nothing"}`).join(" | ")}`);
    for (const h of s.shots) {
      out.push(`\n   SHOT ${h.n}  ${h.start}–${h.start + h.seconds} s  ${h.size}  (${h.cut_reason})${h.pace && h.pace !== "natural" ? `  pace: ${h.pace}` : ""}`);
      out.push(`   moment: ${h.moment}`);
      if (h.treatment) out.push(`   treatment: ${h.treatment}`);
      if (h.motion?.length && h.motion[0] !== "none") out.push(`   motion: ${h.motion.join(", ")}${h.camera?.move && h.camera.move !== "static" ? `   camera move (sequences only): ${h.camera.move}` : ""}`);
      out.push(`   camera: ${h.camera.same_as ? `same setup as shot ${h.camera.same_as}: ` : ""}stands ${h.camera.stands}; ${h.camera.view ? `${h.camera.view}; ` : ""}${h.camera.height} height; looks at ${h.camera.looks_at}; behind: ${h.camera.behind.join(", ") || "nothing named"}`);
      out.push(`   FIRST FRAME`, fr(h.first));
      if (h.action.length) out.push(`   ACTION`, ...h.action.map((a) => `      [${a.at}s] ${a.text}`));
      if (h.lines.length) out.push(`   LINES`, ...h.lines.map((l) => `      [${l.at}s] ${name(l.who).toUpperCase()}: "${l.text}"`));
      if (h.sfx.length) out.push(`   SFX  ${h.sfx.map((x) => `[${x.at}s] ${x.text}`).join("  ")}`);
      if (h.vo?.length) out.push(`   NARRATION`, ...h.vo.map((v) => `      [${v.at}s] "${v.text}"`));
      out.push(`   LAST FRAME`, fr(h.last));
      if (h.changes.length) out.push(`   changed: ${h.changes.join("; ")}`);
    }
  }
  return out.join("\n");
}
