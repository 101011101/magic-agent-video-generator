# 3. Screenplay

**Purpose.** The one creative document after the story: the shooting script. Scenes, shots, and for every shot the exact
first frame and last frame of every element, plus the timed beats between them. Keyframe prompts and clip prompts are
transcribed from it by code, so it must be complete and unambiguous.

**Module.** `src/screenplay/screenplay.js`: `scriptSchema`, `scriptPrompt`, `writeScript`, `checkScript`, `scriptText`,
the duration `GRID` per clip model.

**Inputs.** The story, the element table (ids only may be used), the plate descriptions (`seen`), the total seconds, the
clip model's duration grid, the maximum shot length.

**Call.** One text call, effort high, strict schema, salted with the run label so a run makes its screenplay fresh
(ported from `cleaned/src/script.js`).

**Schema, as built.**

```
FILM   { title, theme, music { cue, arc [{at, text}] }, scenes[] }   theme = the film's idea in one line, the subtext of every frame;
                                                                   music is film-level: one cue, one bed, the few moments it changes
SCENE  { n, place (one of the place ids), inside, time: DAY|NIGHT|DAWN|DUSK, continuous, start, seconds,
         synopsis,                          two sentences a painter needs: the physical situation, then the story beat
         tone,                              one sentence: the scene's feel and stakes, no objects, no events
         ambience, captions [{at, text}],               captions are overlays only: title, date, source note; never dialogue
         line { between, camera_side },    the 180-degree line; every camera of the scene stands on camera_side
         blocking [{ id, where, facing, holding }],      world positions when the scene starts
         shots[] }
SHOT   { n, start, seconds (on the clip model's grid), size: wide|medium-wide|medium|medium-close|close,
         cut_reason: scene start|time up|new point of interest, pace: still|slow|natural|fast|frantic,
         moment,                            one sentence: what the shot is dramatically, as an instant
         treatment,                         the authorial choice in one sentence: what the image conveys and the technique that conveys it
         camera { same_as, stands, view: from behind|from ahead|from the side|from above|from below|from inside,
                  height: eye|low|high, looks_at, behind[] },        view = where the camera is relative to its subjects
         first FRAME, action [{at, text}], lines [{at, who, text}], sfx [{at, text}], vo [{at, text}], last FRAME,
         changes [str] }
FRAME  { people [{ id, visible: in frame|off left|off right, third: left|centre|right, depth: near|mid|far,
                   size: fills|large|medium|small|tiny, facing, distance, pose, hands, doing }],
         props  [{ id, visible, where, size, points, facing, condition, on }],
         relations [{ a, how, b }] }                             size = the share of the frame's HEIGHT the element takes;
                                                                   points = the heading as an enum (away from / toward the camera,
                                                                   across, down, up, none), facing = the same in the painter's words;
                                                                   relations = the prepositions between elements, by id;
                                                                   on = the id of what the prop is attached to, mounted on, held by
                                                                   or carried in at this instant (a bomb on its pylon, the pylon on
                                                                   its aircraft), or none when it is free; not a key field
```

`at` values are film seconds. Ids are enums built from the element table, so an undeclared person or object cannot appear.
`same_as` names an earlier shot whose setup this shot repeats; code copies that shot's camera so identical frames become one
still. **Shot numbers run across the whole film**: every table downstream (stills, clips, attempts, clip file names, `--retry
clip-N`) is keyed by the bare number, so `normalizeShots` renumbers in film order after the call and again on load
(idempotent) and remaps `same_as`. Added after the first V2 Vanderbilt run numbered per scene: three shots collapsed onto
one still and two painted prompts carried scene 1's shot context (audit H1, 2026-10-30). `vo` is narration: spoken by an unseen narrator, each item with its film second and the words, only where the story
tells something in narration rather than in dialogue; narration never goes in `sfx` or `lines`. Added after the first V2
screenplay, written for a narrated story with no narration field, put its voice-over into the sound effects ("Voice-over
narration, 22 words at 2.5 words per second: …").

**The information each field carries, and why.** `tone`, `moment` and `doing` are the interpretive layer: what the scene
feels like, what the shot is, what each person is doing or feeling at that instant, written as direction to an actor. They
exist because keyframes made of positions alone ("standing upright, head level, attentive" on everyone) painted a lineup,
while narrative pasted into a keyframe prompt painted events that had not happened (a handshake before the handshake, a baked
loaf before the oven). Intention at an instant gives the painter the feel and cannot leak events. `facing`, `distance`,
`pose`, `hands` are positions and states in the painter's words: screen left and right, an arm's length, a pace; never
metres or compass points (the second v2 run wrote "0.9 metres northeast of vanderbilt"). `changes` lists what differs at the
end of the shot. The place line of the call carries the plate description ("as seen in its picture: walls …; a fireplace with a
mantel clock (right, background); …") so `stands`, `behind` and the blocking name real fixtures.

**Rules the call is given.**

- Only the declared ids; nothing else may appear; each place keeps its declared fixtures.
- Scenes: one place and one continuous stretch of time; contiguous; the last ends at the total.
- Shots: one continuous take from one camera that HOLDS STILL for the whole shot (no tracking, panning, tilting, descending,
  zooming or following; a change of view is a new shot), because the clip stage pins two frames from one camera position:
  a written move once put the two frames of a shot in different positions and the video model morphed between them;
  seconds from the grid; a new shot only where the content turns and always with a real change of size or an angle of 30
  degrees or more; lines at 2.5 words a second; an action needs 2 seconds.
- Size: every element in every frame says how much of the frame's height it takes (fills, large, medium, small, tiny), in
  the painter's words in the keyframe prompt ("a speck, far off", "about half the frame's height"). Depth alone (near, mid,
  far) had no scale: the painter drew a frigate two miles from the aircraft at a third of the frame because "far" let it.
  The check refuses a far element marked large and a near one marked tiny; the size is the writer's physics.
- A scene synopsis (2026-10-30, the user's call): two sentences per scene, the physical situation first ("two F-35s in
  flight over open sea, miles from any coast, have just struck a frigate"), then the story beat. It goes into the CONTEXT
  of every keyframe, clip and sequence prompt. Without it a frame prompt never said the jets were in the air, and a climb
  frame was painted on the ground. It is a scene summary, not the action paragraph, which stays out.
- Authorial intent, as fields (the user's direction, 2026-10-30): a film `theme`, a `treatment` per shot (what the image
  conveys and the technique: "speed: the aircraft streak with motion blur, the horizon tilted with the bank"), and
  `relations` per frame as id triples ("vega-f35c flies toward frigate-harrow"). They carry ideas and relations, never
  how a thing looks; the references carry looks. The keyframe prompt renders them as Theme and Treatment lines in CONTEXT
  and a RELATIONS block; the clip and sequence prompts carry the treatment after the pace. A relation naming an element
  absent from the frame is an error.
- Orientation: every prop says which way it points relative to the camera and the frame ("seen from behind, nose away
  toward Harrow, screen right"; "none" for a thing with no front), and every camera carries one structured `view` (from
  behind, from ahead, from the side, from above, from below, from inside) that must agree with `stands` and with every
  facing. People had a facing and props did not, and the camera's position stayed out of the keyframe prompt on purpose,
  so the painter drew attacking jets nose-on to the lens while their target lay beside them. The check refuses a prop that
  turns without an action, and reads the structured `points` enum, not the prose, to refuse a from-behind camera with a
  prop pointing toward it (a regex on the prose once flagged "tails toward the lens", which is exactly right from behind). The keyframe prompt carries the view as
  one line, orientation only ("VIEW: from behind the subjects, high angle: backs and tails toward the camera").
- Motion cues and the camera's move (2026-10-30): every shot carries a `motion` list chosen from a fixed vocabulary of cues
  that make a picture feel alive (motion blur on the subject, vapor over the wings, contrails, wake, spray, dust, a
  foreground element whipping past the lens, the camera low to the ground or sea, strong diagonals, subjects entering and
  leaving the frame, lens streaks, crisp frozen detail), and the camera a structured `move` (static, slow pan, whip pan,
  tracking alongside, push in, pull back, handheld shake, tilt). A still gets only the cues a still can show; a clip or
  sequence gets them all; the camera move is honoured only in a sequence, where nothing is pinned, and a still-frame render
  keeps the camera static at the start position.
- Pace: every shot says how fast it must feel (still, slow, natural, fast, frantic); the clip prompt turns it into a
  sentence, since six seconds of interpolation between two stills is smooth by nature and nothing else asks for speed.
- Pacing by kind (`PACING`): the story's `kind` (ad, trailer, music-video, drama, documentary, explainer, short) sets the
  longest shot and the cutting rhythm the call is given; an ad cuts every 2 to 4 seconds and holds nothing longer than 4.
  The first Top Gun screenplay was written with drama pacing: ten shots, one of six seconds.
- Music is film-level: one cue for one bed and an arc of the moments it changes; scenes carry ambience only and no clip
  ever contains music (each clip composed its own riff when the cue was handed to every clip).
- Every element of the scene appears in both frames of every shot, in frame or off frame with its side, so a cut-away and a
  return are checkable and off-frame people keep their state.
- Continuity: the first frame of a shot copies the previous shot's last frame word for word for every element; only third
  and depth may differ, and only because the camera changed; within a shot a third changes only through an action; when
  nothing happens the last frame copies the first and `changes` is empty; a change of expression at the end of a shot is a
  legitimate change, used only where the story turns.
- Lines are spoken, in the speaker's words, faithful to the record; captions carry no conversation; narration goes in `vo`
  and never in `sfx` or `lines`; `sfx` is sounds, never speech.
- No clothing, age or faces in a frame: the portraits carry them.
- No business the story does not contain; expression, attitude and tone are not business and are required.
- **Do not over-describe.** The painter and the video model receive the references. The frames say where people are
  relative to each other and what they do; they do not restate what a reference shows. The call does not contain this
  sentence; V2 enforces it where it matters, in the keyframe template, which copies positions and intention from the frames
  and never the camera prose, the plate description or the fixture lists (`05-keyframes.md`). The camera fields and
  `behind` remain in the screenplay for its own continuity and for the checks.

**Checks in code** (`checkScript`), before anything is paid: scenes and shots contiguous and the film ends at the total;
every shot's seconds on the grid (and `--max` below the grid stops before the call); shot numbers unique across the film;
`same_as` names an earlier shot of the scene; every element of the scene present in both frames of every shot, none listed
twice, `visible` one of its three values, somebody or something in frame, and a title card (nothing in frame, a caption
covering the shot) empty in BOTH frames, since a card is a whole shot; a third or visibility change only with an action;
a no-action shot whose last frame differs from its first is noted; continuity across cuts is compared field by field and
differences are listed as notes; lines and actions fit the shot's seconds (2.5 words a second plus 2 seconds per action; narration
plays over the film and is not counted); every beat, narration included, inside its shot; captions inside their scene;
fixtures named behind the people are declared; `sfx` holding a quoted sentence or the words narration or voice-over is an
error, a bare "says" a note; a written camera move (tracking, panning, tilting, descending, zooming, following, a push or
pull) is an error when the camera is the subject of the clause and the clause is not negated ("the locked camera does not
follow" and "the bombs descending" are not moves); the music arc lies inside the film.

**The writer corrects its own errors** (`reviseScript`, in `src/pipeline.mjs`). When the check finds errors, the whole
script goes back to the writer with the error list and the instruction to change nothing else; the corrected script is
renumbered and checked again, twice at most, before the run stops. Text only. Before this a single error stopped the run
and the remedy was a whole new screenplay. A mention counts as declared when it is contained in an element's name, alias
or look, in a plate's fixture names and details (`seen`), or shares at least half of its content words with one of those
entries (stop words dropped). Errors stop the run; notes are printed for review. The line between them (2026-10-30): an error comes only from a
structured field that a check cannot misread (a number off the grid, a missing id, an enum that disagrees with another
enum, a relation naming something absent); anything read from prose with a pattern (a possible camera move, speech written
into a sound effect) is a note the user sees and never a stop, because patterns over-restrict on general cases. The vanderbilt6 screenplay passed with zero
continuity notes; the first V2 screenplay ("Vanderbilt's Offer", three scenes, four shots, narrated) passed with two notes:
one shot holding 9 seconds of words and actions in 8, and one `behind` phrase the plate description did not match.

**Planned extension (v3, from `drafts/CASES.md` §D), design only.** FILM header: kind (drama, ad, short, vlog, explainer,
documentary, streamer, music-video, trailer, news, storybook, walkthrough, presenter), medium, aspect (16:9, 9:16, 1:1),
cutting rule (content, beat, step, jump), hook. Elements: screens, items, tracks. Scene: time optional; the line may be a
subject and the camera, or none. Shot: kind (live, to-camera, insert, screen, broll); camera_first and camera_last with a
motion kind (static, pan, tilt, dolly, track, handheld, zoom, orbit) and a path; lens; held_by; overlays by kind (title,
caption, subtitle, lower-third, label, cta, end-card, title-card) with an anchor; an insert's item and move; structured
changes `[{ id, what }]`. Checks to add: static shots keep their camera; overlays inside safe margins on 9:16; a hook in
shot 1 when asked. (`vo` from that list is already built.)

**Cost.** One text call at high effort, several minutes of wall time; no credits.

**Status.** Built and run four times on the Vanderbilt story (vanderbilt4 v1, vanderbilt5 v2, vanderbilt6 v2 with tone,
moment, doing; the V2 run `vanderbilt` with `vo` and the plate description). vanderbilt6 chose dialogue coverage on its own:
a wide walk-in, singles on Lincoln and Vanderbilt, a three-shot for the offer. The V2 run, given a narrated story, chose a
wide walk-in, a cutaway to the steamship at Hampton Roads, a two-shot and a close-up with the narration over them. The Top
Gun brief (fiction) produced seven scenes and ten shots, numbered across the film, ending on a title card.

**Attachment is a field (`on`, 2026-10-30).** What a prop hangs from is structured, never read out of `where`. The keyframe
prompt derives from it, through chains (bomb on pylon on aircraft), the line "attached to X, the only thing attached
there" and the rule "X carries exactly N things: …; nothing else is attached to it or hangs from it"; the state manager's
`loads(still)` query and the load gate read the same field. The prose version matched "beneath the crosshair" in a cockpit
frame and told the painter "the crosshair carries exactly one thing: the frigate". A script written before the field gets it
filled by one text call (`fillAttachments`), which touches nothing else; `on` is not in the dedup key, so the stills of an
older run stay valid. Checks: a prop's host must be in the same frame list, in frame when the prop is in frame, and not the
prop itself (errors).

**Heading reads only from behind or from ahead (2026-10-30).** The writer is told that a camera from behind or from ahead
stands ON the line between a subject and what it moves toward, which the line rule allows (on the line is not across it),
and that a side view shows a thing crossing the frame, never heading somewhere: an approach, a chase or an attack is seen
from behind or from ahead at least once, the side view kept for formation beats. The fourth Top Gun screenplay put every
attack-run camera "on the starboard side of the flight line, never across the line" and the jets read as flying past the
frigate, not at it. A shot whose relations say "toward" under a side camera gets a note, not an error.
