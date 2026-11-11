# 10. Decisions log

- **2026-10-29.** One shooting script replaces the three-document split (screenplay → shot list → still prompts). The split
  lost the staging in its hand-offs: the screenplay never said who faced whom, the shot list guessed, the still prompts
  guessed again (vanderbilt3 painted Vanderbilt facing the camera instead of Lincoln).
- **2026-10-29.** "We are never directly editing prompts; it must be done by the pipeline; we are never doing micro fixes,
  we are doing macro fixes on the structure as a whole." Every prompt is assembled by code from the screenplay and the
  tables; a fault is fixed in the structure.
- **2026-10-29.** Identity from the bank: every still that contains a person is painted with that person's portrait attached
  and named by feature, after a chain of last frames carried an identity swap. Superseded on 2026-10-30 by the portrait rule
  in `04-state.md`.
- **2026-10-30.** Context for a keyframe is intention at an instant (`tone`, `moment`, `doing`), never the action paragraph
  or a synopsis: those painted events that had not happened.
- **2026-10-30.** Gates flag only; the user decides. "Instead of retrying things, just show me the thing and I'll tell you
  if it needs to retry." The two most expensive failures of the day, the wallpaper single and the drifted clip, were both
  produced by automatic retries nobody looked at.
- **2026-10-30.** The reference carries the look. The keyframe text says only what the moment is, where people are relative
  to each other, and what changed; it does not describe walls, light, camera position or fixtures, and it does not resend a
  portrait for someone image 1 already shows. KF2's order (frame first, references after) is kept; KF1 is dropped; the
  prose both had grown is removed.
- **2026-10-30.** The state manager is a module with tables and queries, run once over the whole screenplay, and the source
  of every "image 1, image 2" a prompt names. Punch-ins are crops of the master. New setups are never painted from a single.
- **2026-10-30.** V2 is a clean directory; `V1/` and `V0/` are archived and not run.
- **2026-10-30.** Ready-made preset voices over descriptor-only voices. A character's voice is a property of the asset, chosen
  once from the descriptor among the OpenAI TTS presets with a delivery instruction, sampled once for approval, and carried
  by the state manager; the same preset reads every line of that character. No real person's actual voice is cloned.
- **2026-10-30.** Narration is always produced afterwards by one voice: the screenplay's `vo` lines are read by the
  narrator's preset and mixed under the film at the stitch; a clip is never asked to narrate.
- **2026-10-30.** A plate must be an empty view of the place and, for a live-action film, a photograph. A Commons picture
  that fails that check is rejected and the plate is generated; an engraving of a crowded ballroom is not the White House.
- **2026-10-30.** Reruns of text-only stages are allowed when the structure changes (a new schema field needs a new
  screenplay), cost nothing, and are announced before they run, as paid work is.
- **2026-10-30.** The PRD is a directory: one file per subsystem under `V2/prd/`, with `00-overview.md` for how the
  subsystems work together; `V2/PRD.md` is a pointer.
- **2026-10-30.** The room gate judges a still against ITS OWN image 1 (the plate, the master or the previous still), not
  the plate: the gate asks whether the painter kept what it was given, and the plate is reached through the chain. Against
  the plate alone, the opening wide of the Top Gun range, accepted without its platform, was flagged again on the next wide
  built on it.
- **2026-10-30.** A shot's identity is its number across the whole film; the screenplay stage renumbers (and remaps
  `same_as`) whatever the writer did. Three per-scene "shot 1"s of the first V2 Vanderbilt run had collapsed onto one still.
- **2026-10-30.** Every element that can stand in a frame on its own has a picture: props are procured like characters
  (Commons, else generated). The Top Gun warship, left as text, was a different ship in every frame.
- **2026-10-30.** A still must fill its frame. The cause, traced on the Top Gun run: the medium sentence said "cinema
  camera" and "cinematic finish", so the image model letterboxed every generated plate (24-pixel bars, one 228-pixel bar);
  the bars rode into each frame painted from a plate, each frame edited from one of those, and the painter finally widened
  them into a full cinemascope letterbox on the last attack frame. Four rules follow: the medium call may not use words
  that imply widescreen; a generated sheet has its thin bars cropped off at procurement (raw kept) and a thick bar named;
  a plate or still is stripped of thin bars before it goes out as image 1; and the bars gate (ffmpeg, no model) flags 5%
  or more on a still, while thinner bars are noted and cropped at the stitch.
- **2026-10-30.** `--dry` runs everything but the paid calls and lists what they would cost. A recheck or an estimate never
  paints on its own; the user's command is the go.
- **2026-10-30.** When a place has no wide view (a cockpit only ever close), a new setup is painted from the place as last
  seen, with whoever was in it, not from the empty plate; the plate is only ever the base of a place's first still.
- **2026-10-30.** A title card is a whole shot, empty in both frames, rendered by code, never anyone's image 1, and its
  caption is not overlaid a second time.
- **2026-10-30.** Scene text (a word on a cockpit screen, a sign) is allowed in a still where a line names it; captions,
  titles and overlaid text are not. The old "no text" rule contradicted a screenplay that asked for the word LASER on a
  display.
- **2026-10-30 (open).** The keyframe CONTEXT block carries the shot's action text, labelled as "not yet happened" or
  "already complete", which the 2026-10-30 decision above ("never the action paragraph") forbids. The old-ideas review
  (`V2/drafts/review-old-ideas.md`) measured the leak risk as real; the user decides whether the labelled form stays or the
  action text goes (ticket T-022).
- **2026-10-30 (after the first Top Gun film).** Music is a film-level asset: one cue in the screenplay's FILM header, one
  bed made once, mixed under the whole film and ducked under the lines; no clip ever contains music. Each clip had composed
  its own riff from the scene's cue, so the music changed at every cut.
- **2026-10-30.** At most four images go to the painter, the least prominent carriers dropped first, no image numbers in
  the element lines, and the master is the wide that shares the most elements with the frame. Nine references and
  "(image n)" labels made the attack wide a three-panel collage with the numbers painted on.
- **2026-10-30.** The camera holds still within a shot; a change of view is a new shot; the check refuses a written move.
  The clip stage pins two frames from one position, and a written descend-and-tilt made the model morph between two
  compositions.
- **2026-10-30.** Pace is a field of every shot, rendered into the clip prompt, and the story's kind sets the cutting
  rhythm (an ad cuts every 2 to 4 seconds). Six seconds between two stills is smooth by nature; speed has to be asked for.
- **2026-10-30 (open, ticket T-023).** Whether to pin the end frame at all. The user's reading: the pinned end frame fights
  the physics of a fast shot, and a text-to-video model with the stills as named references could make longer clips. To be
  decided by a measured test on one action shot: pinned start and end, start only, and text-to-video with references.
- **2026-10-30 (after the second Top Gun film).** The clip stage gains a sequence mode: one text-to-video clip per run of
  shots with all their keyframes as ordered references and the cuts in the text, nothing pinned, up to 15 seconds. Pinned
  pairs from two camera positions made jets pivot mid-clip, and 3-second clips have no room for speed. The edit prompt
  now also tells the painter to keep image 1's viewpoint, so a last frame cannot move the camera.
- **2026-10-30.** Scale is a field: every element in every frame carries its size as a share of the frame's height, copied
  into the keyframe prompt and sanity-checked against depth. The second film's attack frames put a distant frigate at a
  third of the frame; nothing in the screenplay had said how big anything was.
- **2026-10-30.** Nothing repaints on its own, not even when the plan changed under an id: a stale frame is flagged and
  waits for `--retry`. The staleness rule, fed a key that a schema addition had changed, repainted ten approved frames
  unasked (2,000 credits); the frames were restored and the rule now flags.
- **2026-10-30.** Orientation is a field: every prop has a facing and every camera a structured view, and the keyframe
  prompt carries the view as one line. The attack frames of the second film showed jets nose-on to the camera while
  attacking a ship beside them, because nothing in the screenplay or the prompt said which way an aircraft pointed, and
  the camera's position was kept out of the prompt by the no-camera-prose rule. The rule stands; orientation is not prose.
- **2026-10-30.** Authorial intent is in the screenplay as fields, not prose: a theme for the film, a treatment per shot,
  relations per frame as id triples, a structured heading per prop beside its painter's-words facing. The prompts copy
  them. Checks read structured fields; a check that reads prose with a pattern is a last resort and was wrong twice today.
- **2026-10-30.** Style is an asset in the state manager, not a sentence: one style sheet per film, sent with every paint
  whose image 1 is a painting, checked by a style gate on finish alone. Authorial departures stay possible per shot and are
  told to the gate. A new wide setup is painted from a fresh wide (at most two generations deep) and the still table
  records depth. The third film's attack scene had drifted to halftone nine generations deep with nothing to hold it.
- **2026-10-30 (after the third film).** A scene synopsis is a field and goes into every prompt's context: the physical
  situation first. Continuity, not freshness, picks the master wide; the style sheet and gate carry the finish. Fast
  sequences may be rendered longer and played faster (`--speed-up`), the one lever on our side for slow motion.
- **2026-10-30.** Motion is a field: cues from a fixed vocabulary per shot, a structured camera move honoured only in
  sequences. The master query scores state, not just presence, and the prompt says what image 1 shows.
- **2026-10-30 (fourth run, stills).** Attachment is a field (`on`), filled for older scripts by one text call; the store
  rule and a new load gate read it. The frame just before goes to the painter as a picture (`prev:` reference) whenever it
  is not image 1. The writer is told that a camera from behind or from ahead stands on the line, not across it, so an
  attack is seen along its heading at least once. A prose rule that a vehicle carries one thing did not hold on its own
  (a fourth paint still hung missiles), and the prose preposition matcher put a store rule on a cockpit crosshair.
- **2026-10-30 (models).** A model is a profile in one registry, never a constant in the code. The user, with word from
  Magic Hour, wants the pipeline to work on the free-flagged models; the registry makes that a flag (`--tier free`) that
  changes the grid, the reference cap, the clip modes, the resolutions and the costs together, and `--script-from` lets
  the same screenplay run on two profiles for a frame-for-frame comparison. Prices are the sheet's until measured.
- **2026-10-31.** The painter is told the story, not only the scene: a film synopsis and a per-scene physical situation
  are fields, filled from the story for older scripts; a place's plate is generated in the situation the story first shows
  it; the previous frame crosses places in a continuous scene. The user's diagnosis: every geometric error traces to the
  absence of a world picture, local descriptors cannot replace it; the stage model (positions as numbers) is the next step.
- **2026-10-31 (T-029).** Positions are numbers. Every scene has a stage in metres, every camera a position and a look
  point, every prop a position and a heading; the pipeline derives the screen words from them and replaces the writer's,
  writes a WORLD block (where everything is relative to the goal, what moved since the frame before, what fixes each size),
  checks the impossible in metres, and a geometry gate reads heading and size back from the picture. The user's request,
  verbatim, is in the ticket; the pipeline is built so a later reader can hold the result against it.
- **2026-10-31 (late).** Attitude is motion, not a frame: a bank never differs between a shot's two stills (the painter's
  jets face the camera on the word "banked"). An edit flagged by the geometry gate is retried as a delta edit, the change
  list only on its passing image 1. A frame records a position and a heading; the clip renders what happens between.
- **2026-10-31 (T-022).** A shot's first frame is not told the shot's action; it is told that nothing has begun. Measured:
  a described detonation was painted into the frame before it, twice.
- **2026-10-31 (later, s7-2).** A turn is a change of heading and nothing else: prose may not call a 2° slide a bank;
  the writer must stage a turn (20° and a track that bends) or say what the numbers do. The geometry gate reads eight
  directions against the stage's yaw and flags absence. A still that brings a vehicle into frame is painted from the
  master, never edited from the frame without it. Measured: four and then five attempts of one frame turned the jets
  to the camera with every word against it; the accepted opening wide was found wrong underneath (no frigate, the
  plate's platform in its place, a jet 2.8× too large seen across) and had passed through the old gate's blind spots.
- **2026-10-31.** The agent is the next subsystem, in front of the film chain, which becomes one tool among several
  (`11-agent.md`). Conversation is for ambiguity only: every project has a universal set of questions (output, subject,
  platform and aspect, audience, length, message, materials, must-include) that must be answered with confidence before
  anything is paid; what the message states or the agent infers confidently is used and shown back, the rest is asked.
- **2026-10-31.** Editing is a separate subsystem, treated as the output fed back as an input with a time range and an
  instruction. Design split by provenance: an asset made by a run re-enters the run on the named shots (cached, paid
  only for the change); a supplied asset or a whole-frame change goes to a tool over the asset.
- **2026-10-31.** Cheapest model that can: the free tier is the default; a move up is for a missing capability, a
  twice-flagged item on the user's word, or the user's explicit ask, and is costed before it is paid.
