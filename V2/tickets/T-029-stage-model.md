# T-029 · The stage model: global positioning for every frame

status:     built 2026-10-31; the ninth film repainted on a clean plate (see the last section)
priority:   high
subsystem:  screenplay, state, keyframes (template and gates), assets

## The user's request, verbatim (2026-10-31)

> s3-1 does not have context of the previeous scene given as a refercne
>
> so wwe need a couple of thigns, we a need a synposis of the scene as a whole, wait your telling me the scrren play does
> not explain the sotry plot context as in they are int he sky and is onyl operational? that shouldnt be the case. if the
> screen play incldued the sotry as a whle as part of the cotnext, we can feed that to the key frame and explain what part
> of the sotry context the key frame is tyryi0ng to illsutrate,
>
> additioanly the last frame because we ahve the context of the story woudl make more snese because the last frame is
> giving context on what just happened, and if they are in the air, they should be2 in the air as shown by the last
> frame's enviroment no?

> so is it fixed? like it has a synpossi of the sotry as a whole? the scene as a whole, and with that it explaisn what
> part of the scene it is illturating then going for the descirptions? shoudltn the scnee explain that they are roaring
> over the sea in the screen play why doenst it have that?
>
> does the key frtame aslo have the papirtoete context of the global posistigin not just micro relations but macro
> rlealtiosn liek flyiung buy the ship instead of jsut poi0tning away? liek it should ahve the conterxt the last scene
> that is flyign by the ship but it is positinionl towarxd the ship, and this scene is still flyign by the ship but
> potnetily it is now flying away

> so answer theses :
>
> 1. is the glboal context psotitinign a good idea ?
> 2. do the key frames receive the context of the frame ? if so why are thje jets on the ground if it has the context its
> in the air and the last scene unelss it doesnt have the last scene ?
>
> for now stick witht hwe anano banna input , can you shou wme the key frames in the html and their erpescitce promtps
> incldugin whatever was appended and th erefercens given
>
> wait does the scene not say its in the air? like the scene as a whole from the screen play? does it need a sysnposisi
> of the sotry as a whole or something? why doesnt the scene detail infromaiton like this, i thoutght he scene includes a
> cotnet of the story plot as a whole?
>
> why doesnt it have a sybnposi of the scene as a whole and sepraltey the alst frame, the scene as a whole woudl describe
> them in air no? what does the screen play say for that scene

Earlier the same night, on s7-4: "why is the nose pointing away but the bombs are still close to the plane … if it flew
past the ship then the direction of the ship in relation to the plane would be different … I think our positioning needs
context globally speaking … are all the errors so far from the lack of global positioning (positioning in context of the
story and things as a whole, not just descriptors)?"

## What is asked for, in short

- Story context first in every keyframe: the whole story, the scene's physical situation, the beat this frame
  illustrates, then the descriptors. (built 2026-10-31, before this ticket: `synopsis`, `situation`)
- The scene says where everyone is in the world (in the air, over the sea, in formation, toward the ship). (built)
- Macro positions: where each thing is relative to the others and to the goal in the world (short of it, abeam, past it),
  and where the camera stands. (this ticket)
- Position over time: what moved since the last frame, as world movement ("still inbound", "now past the ship, which lies
  behind them to the right", "the bombs trail by 60 m"). (this ticket)
- Sizes and headings follow from positions, never from the writer's guesses. (this ticket)
- The last frame's world carries forward as a picture (built) and as text at world level (this ticket), across places.
- Checks on all of it, so a flipped heading or an oversized ship is flagged. (this ticket)

## Design

Per scene a STAGE: one coordinate frame in metres. x runs along the scene's axis toward its goal (the attack line toward
the frigate; the length of a room toward its far wall), y is to the right when facing +x, z is up. The scene names the
`goal` element and describes the axis in words. Per shot the camera has `at` and `toward` (points). Per frame every prop
has `at` and `heading` (degrees from +x turning toward +y, so 90 is to the right of the line, with an optional `pitch`); a person inside a
vehicle (`on`) is where the vehicle is. Every element on record has `size_m`, its longest dimension.

From that, `src/screenplay/stage.js` derives what the writer used to guess: screen third, depth, the size word (angular
size against a 40° horizontal lens), `points` (heading against the camera's forward and right), and whether a thing is in
frame or off to one side. The derived values replace the writer's; `normalizeShots` applies them. The keyframe prompt gets
a WORLD block: the camera's place on the stage, each prop's position relative to the goal and the line, and the change
since the previous frame in metres. Checks: camera inside a thing, a flying thing below the surface, speeds no aircraft
can fly, a camera looking at nothing. A geometry gate (vision) reads each vehicle's heading and apparent size back from
the picture and flags a flipped heading or a size off by more than 2.5×.

## Acceptance

On the Top Gun story: the attack-run frames state in metres that the formation is short of the frigate and inbound, the
sizes of jets and ship follow from their distances, the WORLD block of the release frame says the bombs trail the jets,
and a painted frame with the jets' noses toward the camera is flagged by the geometry gate. Rook's cockpit frames are in
flight because the plate was generated in the story's situation (T-029 depends on the `setting` field, built).

## After the first full run (2026-10-31, later)

The user, on the painted film: "its good except s7-2–s7-4 why are the jets facing each other this doesn't make sense
what is the cause of this error" — then "make the fixes then rerun s7-2 to s7-4 and show me".

**Cause.** Two things. The writer narrated shot 7's 19 m slide toward the line over 520 m (a 2° change of heading) as
"bank inward … converging diagonals", in the action line, the treatment, the camera's looks_at, two relations, the
scene's situation and synopsis and the film synopsis; the painter drew the jets converging (three attempts nose to the
camera, the fourth nose to nose). The geometry gate flagged only a heading that was the exact opposite of the staged
word, so "across" where the stage said "away" passed, and s7-3 (a crop) and s7-4 (an edit) inherited it. A third defect
in the same block: the WORLD deltas were taken from the previous still in chain order, which for the first exterior
after a cockpit scene was a frame in cockpit coordinates ("advanced 4420 m along the line"; "unmoved" for a jet the
cockpit frame never held).

**Fixes (all structural, all tested, no prompt edited by hand).**
- Turn words are headings (`checkStage`): prose about a shot's movers (action, treatment, looks_at, relations), a
  scene's situation and synopsis and the film synopsis may call a movement a bank, a turn or a convergence only when a
  mover's heading changes by `TURN_DEG` (20°) or more in that scope. The error tells the writer what the numbers do.
- Attitude words (banked, rolled, flared) in a mover's condition with the heading unchanged across the shot are an error.
- A thing goes where its nose points: each frame's heading of a mover that covers 50 m lies within half the shot's turn
  plus 5° of its track. Added after the writer answered the first error by changing the headings by exactly 10° and
  keeping the words.
- The stage goal is never a mover (in cockpit coordinates the frigate seems to steam backward); a goal keeps one heading
  across the film (the writer had turned it around in scene 6 to satisfy the track check).
- The geometry gate reads eight directions and holds them against the stage's yaw (`derive` now returns `yaw`); more
  than 70° off is a flag. A staged thing missing from the picture at 3% of the height or more is a flag. A size 2.5×
  off is a flag (was 3×).
- WORLD deltas come from the previous frame on the same stage (`previousFrame`): the shot's first frame for its last,
  the previous shot's last for a first; "closed 19 m toward the line"; a thing absent from the frame before is not
  called unmoved.
- A staged prop's size in PEOPLE/PROPS is its two shares of the frame ("about 5% of the frame's height and 12% of its
  width"), the same numbers as the WORLD block; "about a quarter of the frame's height" for a jet from behind made the
  painter enlarge it, and a large jet over the sea is painted nose-first.
- A still whose change brings a positioned vehicle INTO frame is painted from the master wide, not edited from the
  previous still (six edits of the single-jet frame brought the second jet in as a huge foreground jet nose-first).
- The relation text for a master painted from the same camera view says "held on the same side and at the same angle",
  not "moved to a new angle".
- `--retry` with `--only` remakes only the named dependents and marks the rest; a paint from the master flagged for a
  heading is retried as a delta edit of the master when it shows the same side; `--restore id:n` makes an earlier
  attempt the still again; a stale mark clears when the plan changes back.
- The writer's revision prompt now carries the STAGE rules (it carried only SCENES/SHOTS lines).

**What the painter did with the fixed prompt (five more attempts of s7-2, 1,000 credits).** Edit of s7-1: both jets
nose to the camera, 35% and 21% of the height. Delta edit of s7-1: Vega's jet right, Rook's jet brought in huge and
nose-first. Paint from the master s1-1: both nose to the camera, 45% and 23%. Delta edit of the master: a copy of the
master. All flagged by the new gate; none accepted.

**Found underneath.** The accepted master wide s1-1 (its retry, `s1-1-r1.png`) is itself wrong: a huge near jet seen
across (39% of the height where the stage says 14%), no frigate (the stage puts it in frame at 6%), and the plate's
offshore platform standing in as the target. It passed the old gate by its two blind spots (across is not the opposite
of away; 2.8× is under 3×) and by skipping absent things. The first attempt `s1-1.png` shows two jets from behind with
the ship a dot and passed every gate. The place plate carries an offshore platform although the place's look excludes
built structures: it was generated in topgun8 before the sheet check existed and reused into topgun9 without a check.

**Open, the user's call.** (1) `--restore s1-1:0 --only s1-1,s7-2,s7-3,s7-4` (no credits for s1-1) and repaint s7-2
to s7-4 from it, about 400 credits; or (2) regenerate the plate without the platform and repaint the exterior chain,
about 2,400. s5-1 and s7-1 would be kept as painted in either case unless named.

## Option 2, run (2026-10-31, later still)

The user chose the new plate and the exterior chain. What it took, all in the pipeline:

- A plate holds the place and nothing of the cast: generated "as the story first shows it", the first new plate came
  with two jets painted into it; plates now exclude the story's vehicles and objects by name, and the sheet check lists
  them as excluded. A reused sheet never checked is checked on reuse. A regenerated plate remakes every still painted
  from it.
- A pilot who is a speck is far, never "visible up close", and gets no portrait; a prop picture's angle does not apply;
  "strong diagonals" is checked against the stage (the writer dropped it from five shots).
- An accepted heading travels down the chain only for a thing that does not move (the frigate broadside). A repair
  states the count in numbers and names a duplicate of the kept thing.
- A thing staged level but read as pointing down has fallen (a flag); a listed item no longer attached is a flag; the
  first frame of a shot with an action carries the moment of the shot before and no treatment (T-022 extended): the frame
  before the release once showed both bombs already falling, with every gate passing it.
- A punch-in is cut by the vehicles' boxes when there are no people to cut by, and only when it is the master's instant
  (the strike was once cut from the release as it stood).

Result: 20 stills, all painted on nano-banana-pro and passing or accepted; every jet heads the right way in every
exterior. Accepted liberties: s1-1 jets painted large for the camera distance and the frigate broadside; s5-1 the solo
frigate bow-on where the stage has it stern-quarter; s7-1 extra stores and the frigate broadside; s7-2 a second bomb
per jet (T-028); s7-4 the far frigate small, the bomb enlarged with the jets, a mild painterly drift in the clouds.
Spend on the label 12,000 credits (4,600 this round: two plates, nineteen paints and retries).
