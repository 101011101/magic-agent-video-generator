# Approach 2 — shots: shooting script + bank + environment (draft PRD, 2026-10-29, revised the same day)

> Run on the Vanderbilt film on 29 Oct (`experiments/fact-shots.mjs`, `fact-onepass.mjs`, `fact-pinned2.mjs`, `fact-film2.mjs`,
> then `fact-film3.mjs` with `src/script.js` and `src/prompts.js`). The unit is the shot. ONE text document after the story,
> the shooting script, carries scenes, shots, camera and the start and end frame of every shot for every element; the
> still prompts and the clip prompts are transcribed from it by code; the bank holds identity; the plate or the latest still
> holds the environment; the video model does the acting.

## 1. Pipeline

```
prompt ─► research gate (small call) ─► research round (web search) when needed ─► story from the facts, cited
      ─► element table ─► asset bank: identity references (portraits / sheets) and environments WITH their declared fixtures;
                           real things from the record (Commons), generated only where nothing is on record
      ─► SHOOTING SCRIPT (one call, src/script.js): scenes → shots → START and END frame per shot for EVERY element
      ─► checks (code): timing on the clip model's grid, every element in every frame, thirds move only with an action,
         continuity of states across cuts, beats inside their shots, fixtures declared; errors stop the run before any credit
      ─► cast lines (code + 1 vision call per portrait): how each person is named in every prompt, by telling features
      ─► STILL PROMPTS (code, src/prompts.js): one per distinct frame; the plate or the latest still of the place as image 1,
         the portraits of the people in frame as the other images; a transcription of the frame, nothing else
      ─► stills (image editor), each checked by count and by third against the frame before anything is built on it
      ─► CLIP PROMPTS (code): the shot's timed action, spoken lines with voice descriptors, sounds; image-to-video pinned on
         the two stills, audio on
      ─► stitch; captions as overlays (never painted); music as one bed after
```

The three-document split (screenplay → shot list → still prompts, `fact-film2.mjs`) is replaced. It lost the staging in the
hand-offs: the screenplay never said who faced whom, the shot list guessed, and the still prompts guessed again (vanderbilt3:
Vanderbilt painted facing the camera instead of Lincoln). One structured document, checked in code, removes the guessing.

## 1b. The shooting script (the structure)

```
FILM    title, seconds
SCENE   n, place (bank id), inside, time (DAY/NIGHT/DAWN/DUSK), continuous, start, seconds, ambience, music,
        captions [{at, text}]                                   overlays only: title, date, source note; never dialogue
        line  { between, camera_side }                          the 180-degree line; every camera of the scene stands on camera_side
        blocking [{ id, where, facing, holding }]               world positions of every element when the scene starts
        shots []
SHOT    n, start, seconds (on the clip model's grid), size, cut_reason (scene start / time up / new point of interest)
        camera { same_as, stands, height, looks_at, behind[] }  same_as = an earlier shot whose setup this repeats (code copies it)
        first { people [PERSON], props [PROP] }                 the shot's first frame: EVERY element of the scene, in frame or off left / off right
        action [{at, text}], lines [{at, who, text}], sfx [{at, text}]     at = film second
        last  { people [PERSON], props [PROP] }                 the shot's last frame
        changes []                                              what differs at the end, one phrase each
PERSON  id, visible, third (left/centre/right), depth (near/mid/far), facing, distance, pose, hands, doing
PROP    id, visible, where (held by whom / on which fixture / third and depth), condition
```

Three fields carry the interpretive layer (added 2026-10-30, after the vanderbilt5 review): `tone` per scene (one sentence,
the feel and the stakes, no objects, no events), `moment` per shot (one sentence, what the shot is dramatically, written as
an instant), `doing` per person per frame (what they are doing or feeling at that instant, as direction to an actor).
They exist because a keyframe prompt made of positions alone ("standing upright, head level, attentive" on everyone) paints
a lineup, while narrative context pasted into a keyframe prompt paints events that have not happened (a handshake before
the handshake, a baked loaf before the oven). Intention at an instant gives the painter the feel and cannot leak events.
The screenplay is the only place that knows both the story and the shots it cut, so it writes these lines; code appends
them to every keyframe prompt (a CONTEXT chunk) and every clip prompt (a MOMENT chunk). A change of expression at the end
of a shot is a legitimate `changes` entry and makes the last frame a distinct still; the screenplay is told to use it only
where the story turns.

The keyframe prompt is therefore: context (tone, moment) + camera + each person's position and doing + references mapped to
details + rules. Never the action paragraph, never a synopsis: the events go to the clip prompt only.

Rules the call is given, all checkable: ids from the bank only; seconds from the model's grid; a cut only with a real change
of size or angle; the first frame of a shot copies the previous shot's last frame word for word except third and depth, which
change only with the camera; within a shot a third changes only through an action; when nothing happens the last frame copies
the first; frames use the painter's words (screen left/right, an arm's length, a pace; never metres or compass points); lines
are SPOKEN in the speaker's words, faithful to the record; captions carry no conversation; no clothing, age or faces in a
frame (the portraits carry them); no business the story does not contain.

## 1c. The state manager (`src/state.js`, added 2026-10-30)

A module with tables, filled by code and one vision call per plate, queried by the templates; nothing creative lives in it.

- **elements**: id → kind, name, reference file, feature line (the bank + the cast stage).
- **places**: id → the plate, and what the plate actually contains: walls, floor, light, every fixture with its side of the
  picture and its depth (`describePlaces`, one vision call per plate, once per run). The screenplay call receives this, so
  shots are staged around the real furniture; the templates use it to say what stands behind each person.
- **stills**: id → scene, shot, who is in frame and where, who is off frame and to which side, what stands behind each
  person, which still it was painted from and why.
- **queries**: `behindFor(still, env, person)` (the fixtures on the side of the ROOM the person stands on, taken from his
  position in the master wide, not from his position in a single); `offFrame(frame)`; `relation(still, env, prev)` (how this
  frame relates to the frame it is painted from and to the shot the viewer just saw: "Lincoln is the man at the right of
  image 1; this frame is the same instant with the camera closer; the previous shot was a medium-close on Lincoln, this
  cuts to Vanderbilt on the same side of the room"); `roomCheck(file, place)` (the room gate).
- **Environment reference rule** (`planStills`): the first still of a scene in a place → the plate; the same camera as the
  still before it → that still (an edit); a new camera → the scene's MASTER, the latest wide or medium-wide still of the
  scene, never a single. Painting a single from another single produced a head swap (vanderbilt6, first build).
- **Gates flag, never remake**: a still is checked for people (count, left-to-right order) and for the room (same walls and
  fixtures as the plate, nothing added); a clip for identity across sampled frames. A flagged item stays for review; the
  build stops at the next stage; `--retry id` remakes named items (and whatever was built on a retried still),
  `--accept id` keeps them.

## 2. Rules

- **The script is the single source of truth.** No model writes a prompt after it. A still prompt is: the environment
  reference, the portraits named by feature, the scene heading, the camera sentence, one line per element in frame from its
  PERSON or PROP record, the count ("exactly 3 people, nobody else"), the medium sentence. A clip prompt is the shot's beats
  in order with seconds relative to the clip, the voices, the ambience, the count.
- **Identity from the bank, always.** Every still that contains a person is painted with that person's portrait attached and
  named by image number with the telling features ("white side-whiskers, no glasses"). Identity never comes from a previous
  still or clip. Each still is checked (one vision call): the count of people, and each person's third against the frame; a
  wrong third or count is one retry; nothing is built on a failed still.
- **Environment from the plate or the latest still of the place.** The first still in a place starts from the plate (or the
  period photograph of the real place). A later still starts from the latest still there: same camera → an edit that names
  only what changed (code diffs the two frames); new camera → "the same instant from a new setup". A still with the same
  frame and camera as an earlier one is not painted again (a shot with no change has one still; a shot that returns to an
  earlier setup reuses it).
- **The line is a scene property.** Every camera of a scene stands on the scene's camera_side; a shot cannot cross the line
  because it has no side field of its own. Sides of frame therefore hold across cuts without a reframe tool.
- **Off-frame elements keep their state.** Every element of the scene is in every frame, in or off, so a cut-away and a
  return are checked for continuity by code, and the running state of the scene is the frames themselves.
- **Time rules the cuts.** Seconds per shot come from the script on the clip model's grid (wan-3.0: 2–10, 15, 20, 25, 30;
  veo3.1 with an end frame: 4, 6, 8); a shot is at most MAX seconds; the next shot is a cut with a real change of framing.
- **Dialogue.** Lines are spoken in the clip (wan-3.0 or veo3.1 with audio) with a voice descriptor per speaker;
  transcription checks the words. TTS + lip sync remains the fallback when one voice must hold across clips.
- **Captions are overlays**, burned at the stitch with their film second, never painted into a frame.

## 3. What it proved (measured, Vanderbilt)

| test | result |
|---|---|
| one-pass text-to-video with 7 @references, 15 s | whole scene staged in order, caption rendered, 3 of 5 lines heard; first frame 0.74 to @key1; Stanton shook hands instead of Vanderbilt (two bearded references) |
| six shots chained on last frames, 28 s | room, treatment, faces held across every cut; all lines heard; "reverse angle" shots copied the previous framing (jump cuts); an extra man from shot 4 inherited by 5–7 |
| two pinned clips (A→B wide 10 s, cut, C→D medium 20 s) | clips start and end on their stills; the cut is a real reframing; identity only as good as the stills (first run inherited the swap; second run paints every still with the portraits and checks it) |
| dialogue at video time, veo3.1 8–16 s | all lines verbatim; voice descriptors followed; voice not stable across clips; 120 credits/s |
| end to end after the story, three documents (vanderbilt3, 29 s, 3,984 credits) | film assembled, lines heard; Vanderbilt faced the camera instead of Lincoln: the screenplay never carried the staging |
| shooting script v1 (vanderbilt4, text only) | states per element per shot came out complete; 11-second shots (no model accepts 11); camera and line only as prose |
| shooting script v2 (vanderbilt5) | to measure: errors from the code checks, continuity notes, still retries, sides held, film reads the same |

## 4. Costs (wan-3.0 720p with audio)

- stills 200 each, one per DISTINCT frame (a 30-second film of four shots where two are static and one returns to an earlier
  setup is 4 stills, not 8); clips 96 per second (2,880 for 30 s); research, story, script, cast lines and checks are text.

## 5. Open

- The treatment: a period photograph as the environment pulls the whole film to its tone; the medium sentence says colour or
  monochrome once and a style reference goes to every still (PRD v4 §4b).
- Reference pick: reject mounts, stereograph cards, two-up images; prefer a single clean view.
- Music: one bed from `/v1/ai-music-generator` under the stitched film; voices: TTS + lip sync when a character speaks in more
  than one clip.
- Parallelism: stills chain per place (places in parallel); clips are independent (N at a time).
