# 4. State manager

**Purpose.** The tables every later stage queries, filled by code in a single pass over the whole screenplay, plus the gates
that check what was made against them. Nothing creative lives here.

**Module.** `src/state/state.js`, class `State`.

**Inputs.** The screenplay, the element table, the bank (with the voices), the cast lines, the plate descriptions.

**The pass** (`State.plan()`, run by `setScript`). Because the screenplay already says, for every shot, who is in frame and
where, the state manager runs once before anything is painted and emits `runs/<label>/state.json` (`State.save()`):

- **elements**: every asset with its properties: id, kind, name, real, the reference picture and its source, the feature
  line, the voice (`{ provider, preset, instructions, descriptor, why, sample, sample_text }`); plus a `narrator` row of kind
  `voice` when the bank has one. The voice is a property of the asset the way the portrait is, so a later stage never
  chooses a voice again.
- **places**: id → the plate file, walls, floor, light, fixtures with side and depth (from the plate description).
- **stills**: the distinct frames of the film, each with: scene, shot, size, camera, moment; the frame (who is in frame and in
  which third, who is off frame and to which side); `env` and `envKind`, which picture it is painted from and why; `prev`,
  the still of the shot the viewer has just seen; `punchIn`; `uses`, which shots use it as start or end; `refs`, the images
  it is given; `painted`, the record once it exists (file, gate verdict, how: paint, edit, crop). Two frames that differ only
  in what people are doing (expression) share one still by default, since the clip carries the change; `--reactions` paints
  them separately.
- **clips**: one per shot: its start and end still, seconds.

**built**; exercised at zero credits by the first V2 run, which produced five stills and four clips for the narrated
Vanderbilt screenplay.

**Environment-reference rule** (which picture is image 1):

- the first still of a scene in a place not yet shown → the plate;
- the same camera as the still before it → that still (an edit);
- a new camera → the scene's **master**: the wide or medium-wide still of the place that shows the MOST of what this frame
  shows, scoring one point per shared element and one more when the element is in the same STATE (a prop's condition, a
  person's doing), the latest among equals, never a single; the frame with the ship already burning beats the approach for
  the climb that follows. The relation sentence then says what image 1 shows, in that frame's own moment. Continuity wins over freshness: a rule that preferred a shallow wide once
  painted the climb after the strike from the approach before it, and the frame lost the burning ship. Texture over
  generations is the style sheet's and the style gate's job; `depth` is recorded per still. Every generation compounds texture: the attack scene of the third Top Gun film was nine generations deep by its last frame
  and its sea and sky had posterized; the still table carries each still's `depth`. The latest wide alone was wrong once: the Top Gun attack wide was painted from
  the warship wide, which held one of its nine elements, instead of the opening wide with both jets and the ship. Painting a
  single from another single produced a head swap: the painter kept the composition and swapped the man (vanderbilt6, first
  build). When the place has no wide view at all (a cockpit only ever seen close), the **latest still** of it: the place as
  last seen with whoever was in it, because the plate would lose them (the Top Gun cockpit inserts were painted from the
  empty cockpit until this case was added). The plate is only ever the base of a place's first still;
- a **title card** (nothing in frame, a caption covering the shot) is decided first and is never anyone's image 1: the still
  after a card starts from the plate or the latest real still;
- **the cross-scene case**: a scene that continues in a place already shown (marked `continuous`, or simply the same place
  as an earlier scene) keeps that place's existing stills as its references, so its tighter setups are crops of the earlier
  master and the room is the same rendering across the cut. Without it the first V2 run planned the two scene-3 shots of the
  Vanderbilt story as fresh paintings from the plate although the men stood exactly where the walk-in had left them. **built**.

**Reference cap and prominence** (`refs`, `MAX_REFS` = 4). At most four images go to the painter: image 1 and the three
most prominent carriers. Prominence is what the element can occupy in this frame: a person near > mid > far; a prop by
the near, mid or far in its `where`; a worn, attached, held or carried thing counts only in a medium-close or closer shot.
In a wide, only near or mid things get a carrier at all. Nine references for one frame (two pilots, two jets, two helmets,
two bombs, the scene) once came back as a three-panel collage with the image numbers painted on in yellow.

**The frame just before (`prev:` reference, 2026-10-30 at the user's call).** When the still just before this one is not
already image 1 (a new camera after a close, so image 1 is the scene's master wide), the state manager sends it as image 2:
"the frame just before this one, a moment earlier from another camera; everything continues from it: what is intact or
spent, where each thing has got to, and how big each thing is beside the others; only its camera does not apply". It takes
one of the carrier slots under the cap; it is sent only for a still of the same place, never a card. The close on the
frigate (s7-7 of the fourth run) was painted from the wide master of two shots earlier with the bombs' record photos, and
the bombs came out a third of the frame high while the frame before had them beside the ship.

**What each host carries (`loads`).** From `on`: for every host in frame, the names of everything attached to it through
the chain. The template's store rule and the load gate both read this query.

**The style sheet** (`styleSheet`, `styleCheck`; added 2026-10-30 after the third Top Gun paint). Style is an asset of the
film: one image, the first generated plate (the assets stage's `style_ref`), else the first plate of any kind. It rides
along as the last reference of every paint whose image 1 is itself a painting, with the line "match its grain, colour
treatment, contrast, sharpness and finish exactly; nothing in it is part of this scene", outside the carrier cap; the
medium's treatment sentence opens the RULES of every keyframe prompt. The *style gate* asks one vision question against
the sheet, finish only (same medium; no posterization, halftone, painterly strokes, banding, oversaturation, plastic
smoothness, line art), and flags; a shot that departs from the film's look on purpose passes its expectation to the gate.
Before this nothing carried the style but a sentence, and the attack scene of the third film posterized over nine
generations of painting.

**Portrait rule** (`needsPortrait`). A portrait is attached only for a person who is not in image 1, or who is framed two
sizes closer than image 1 shows him (medium-close from a wide, close from a medium-wide), so the face must be re-rendered at a
size image 1 cannot supply; and for every person when image 1 is the empty plate. The `V1/` build sent every in-frame
portrait every time, which was the earlier "identity from the bank, always" rule written after a chain carried an identity
swap; the user's rule, and PRD v4's, is this one. **built, not yet exercised** (ticket T-002). On the vanderbilt6 fixture:
the Lincoln single gets the master and Lincoln's portrait; the three-shot gets the master and no portraits.

**Punch-ins are crops** (`cropFor`, and the crop branch in `src/keyframes/keyframes.js`). When a shot is a tighter view of
the master from the same side, which every shot of a static scene is, code cuts the frame out of the master: the people gate
returns each person's horizontal centre and the top and bottom of his extent in the master, as percentages; from the shot's
size and the people in frame, code computes a 16:9 crop box (knees-up keeps 80% of the figure's height for a medium-wide,
50% for a medium, 42% for a medium-close, 30% for a close, with a margin above the heads and enough width for everyone plus
30% of the picture). The crop of the 2k master is the keyframe when its width is at least 50% of the master (`CROP_DIRECT`),
at no cost, checked by the people gate only; when it is smaller it goes to the painter as image 1 with the crop branch of the
template, "this exact framing, cut from the wide view; keep everything in it exactly and render it at full detail", so the
room behind the man is the master's own pixels. The image editor is not a camera: asked for a closer framing of image 1 it
repaints the room and lays the fixtures out again (the fireplace moved to the right of both windows in the three-shot).
**built and run** (every Top Gun close-up on Vega is a crop of the cockpit medium-close; ticket T-001).

**Memory** (`history`, added 2026-10-30 at the user's call). The tables know which scene and which clip every still
serves, so the frame prompt is told what has already happened rather than left to infer it: the moments and changes of
the earlier shots of its scene (and the last shot of the previous scene when continuous), and what the frame just before
it showed, its moment and the state of its elements. A climb frame had been painted on the ground when nothing said the
jets were airborne and the strike had just happened.

**Queries the templates use.** `refs(still)` the images to send, in order, each with its role and why; `needsPortrait(still,
person)`; `offFrame(frame)` ("Vanderbilt and Stanton are just outside the frame to the left"); `relation(still)` the
sentences that tie a new setup to the master it is painted from and to the shot the viewer just saw ("Image 1 is the wide
view of this same instant: Abraham Lincoln is the man at the right of image 1. This frame is the same scene and instant with
the camera closer, framing Abraham Lincoln." and "The shot just seen was a medium-close on Abraham Lincoln; this cuts closer
to Cornelius Vanderbilt, on the same side of the room, so left and right stay as they were."); `cropFor(still, boxes)`;
`record(still, result)`. `behind(place, third)` (the place's middle and background fixtures on a side) is kept for
diagnostics; the template does not use it, by the rule that the reference carries the room.

**Gates.** All flag; none remakes.

- *Load gate* (`loadCheck`), per painted still that has anything carried (not for crops): one vision call naming each host
  and what the screenplay puts on it; the gate lists what is visibly attached to or hanging from each host and says
  `extra` when there is more than the list, or a kind the list does not name; `absent` when the host is not in the picture
  or too small to judge, and then nothing is enforced; the fitting that holds a listed item (pylon, rack, strap, hand) belongs
  to the item and is never extra (the first clean-run paint was flagged for "one bomb and its pylon"). Three paints of the fourth screenplay's attack approach hung extra
  bombs and missiles on the jets while the people, room, bars and style gates all passed: nothing was looking at the
  loads. The identity half of T-021 (is this the same object as its picture) is still open.

- A still's identity (its dedup key) is the place, the scene's time of day and interior flag, the camera and the frame, so
  a day scene and a night scene in one room never share a still.
- *People gate* (`peopleCheck`), per still (the left-to-right order only when the picture lets the gate tell the people
  apart, which two helmeted pilots do not, and the count not enforced when the gate says the people are not countable and
  the screenplay puts every one of them at far depth, as pilots inside banking jets in a wide; the note says so), one vision call with the cast lines: how many people are visible, the ids from the
  left edge to the right edge, the third each stands in, and each person's box (horizontal centre, top of the head, lowest
  visible point, as percentages) for the crops. Pass: the count equals the frame's in-frame people and the left-to-right
  order agrees with the frame's thirds (a lefter third before a righter one; the same third in either order). The exact third
  is reported, not enforced: a man "a pace ahead" of another in the left third lands at the edge of the centre, which the
  first gate rejected four times for nothing. **built**.
- *Room gate* (`roomCheck`), per painted still, one vision call with IMAGE 1 of the paint, told what the frame may show that
  image 1 does not (`expectedFor`: every prop in frame with its declared place and state, and the shot's change list for a
  last frame; a correct bomb-impact frame was flagged for "added explosions" while the gate was told positions only), (the plate for a plate paint, else
  the master or the previous still the painter was told to keep): same arrangement (the same kinds of fixtures in the same
  places, the same kind of wall finish) even if a closer view restyles details; `added` lists things with no counterpart in
  image 1. Against the plate alone, a deviation the user accepted upstream (the opening wide of the range without its
  platform) was flagged again on every still built on it; against image 1 the gate asks what it should ask, whether the
  painter kept what it was given, and the plate is reached through the chain of gates.
- *Bars gate* (`bars`, code only, ffmpeg's cropdetect), per still: black letterbox or pillarbox bars of 5% or more of the
  height or width flag the still; thinner bars are noted on the still and cropped off by code at the stitch, so they never
  stop a chain. The painter put 24-pixel bars (1.6% a side) on four Top Gun stills, and a bar in a master is inherited by
  every still built on it; the keyframe rules also ask for a picture that fills the frame. Pass: same room and nothing added. A crop of the master skips it. The first criterion compared
  craftsmanship and flagged a correct single for its mantel carving; the arrangement criterion still flagged two of three
  repaints for a missing window edge and a fireplace shifted right of both windows, both tolerable to a viewer. Calibration
  is open (ticket T-003). **built**.
- *Clip gate* (`clipCheck`), per clip (a frame whose people are too small or hidden to count is reported and not counted,
  and the order is checked only when the people can be told apart; two clips of helmeted pilots in distant jets were
  flagged on counts before this; `--recheck clip-N` reruns the gate on the frames on disk without a render): frames sampled at two per second into one vision call: count and left-to-right order per
  frame against the shot's first and last frames, and one yes-or-no: does anyone's face, beard, hair or glasses turn into
  another person's. Pass: every frame agrees with the first or the last frame and the answer is no. It caught Stanton turning
  into Vanderbilt mid-clip while both pinned ends matched (first frame 0.967, last 0.975 against the stills), and two singles
  where the video model added partial men at the edges. **built**.
- Reported, not gating: SSIM of the clip's first and last frame against the two stills; the transcription of the clip's
  audio against the line (`gpt-4o-mini-transcribe`).

**Review loop** (in `src/pipeline.mjs`). A flagged still stops its chain (a still is painted only when everything it is
painted from exists and is not flagged); a flagged clip stops the stitch; the build prints what to look at and exits.
`--retry s1-3,clip-2` remakes the named items with a fresh attempt suffix (`-r1`, `-r2`) and forgets whatever was built on a
retried still (its dependants and the clips that use them); every earlier attempt stays on disk and in `build.attempts`;
`--accept s1-3,clip-2` keeps them (and marks the still table); `--recheck s1-3` runs the gates again on a still exactly as
paint time did (none for a card, no room gate for a crop, the room gate against the still's own image 1, the bars gate);
`--dry` sends no paid call and lists each job a real run would send with its cost, so a recheck or an estimate never paints
anything on its own. An unknown id is named. A painted entry whose still key changed under the same id (the plan changed) is marked STALE
and reported; the frame stays until the user says `--retry`, like every other gate. The key is built only from the fields
a frame actually has, so a schema addition never changes the keys of an earlier run: on 2026-10-30 a new `size` field did,
the old rule repainted ten approved frames on its own for 2,000 credits, and the approved frames were restored from the
attempts. **built**.

**Crops, guarded.** `cropFor` returns no crop (the still is painted from the master) when any in-frame person lacks a
usable box (the gate's "zeros if absent", or a top at or below its bottom); when an off-frame person pulls an edge in, the
crop shrinks only while it still covers the wanted height and stays anchored just above the head, instead of re-centring
through it (audit M1, M2: a 30% top-left corner painted as "this exact framing", a chest crop a third of the way down the
head).

**Cost.** Text and vision calls only, one or two per still and one per clip.

**Status.** The single pass, the tables, the queries, the environment rule with the master and the cross-scene case, the
portrait rule, the crops and the three gates are built; the pass has run at zero credits; the crops, the portrait rule and the
gates have not yet been through a paid V2 run.
