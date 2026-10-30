# 5. Keyframes

**Purpose.** One prompt per distinct frame of the film, assembled by code from the screenplay and the state manager, painted
by the image editor with the references the state manager names (or cut from the painted master), gated, shown.

**Modules.** `src/keyframes/template.js` (`keyframePrompt`), `src/keyframes/keyframes.js` (`planKeyframes`,
`paintKeyframes`, `CROP_DIRECT`).

**Inputs.** The state manager's stills table and queries, the bank, the cast lines, the medium.

**The template** (`src/keyframes/template.js`), the PRD-aligned form the user settled on 2026-10-30, replacing both KF1
(references, task, changes, context, camera, people, rules) and KF2 (create this frame, context, from these references,
rules), which restated the whole world every time and ignored what image 1 already carried. **built, not yet exercised** by
a paid run.

```
CONTEXT      the scene heading and which frame of which shot this is, with the shot's action labelled not yet / already;
             Scene: the synopsis (physical situation, then the story beat); So far in this scene: one line per earlier
             shot from the state tables; Before this frame, as last seen: the previous frame's moment and the state of
             its elements; Theme; Moment; Treatment (the authorial choice); Tone.
FRAME        <Size> shot. Motion in this frame: the still-showable cues (blur, spray, contrails, a foreground element, a
             low camera). VIEW: <from behind | from ahead | …> the subjects, <height>: one orientation line, nothing else
             about the camera.
PEOPLE       (exactly N in frame; who is just outside the frame and to which side)
             - <Name>: <third> third, facing <whom and screen direction>,
               <distance to the nearest person or fixture>; <pose>, hands <hands>; <doing>.
             - <prop>: <where>, <size>; <facing>; <condition>.
RELATIONS    one line per relation of the frame, by label: "Vega's F-35C flies toward Harrow." (from the screenplay's triples)
CHANGES      edit branch: what differs from image 1, one line per element (code diff of the two frames)
             crop branch: "None: this is the same instant as image 1, re-rendered at full detail in this framing."
             master branch, when the cast of the PLACE changed since image 1 (a return to it): who is now here, who is no
             longer here, what each is now doing; presence means listed in the frame at all (a person just off frame is still
             here). Otherwise, and in the plate branch, no CHANGES section.
REFERENCES   image 1: the empty place, keep it exactly   |   the scene as it stands, nothing changes but CHANGES   |
             the scene as it stands in the wide view, nothing changes, plus the relation sentences   |
             this exact framing cut from the wide view, keep everything and render at full detail
             image k: <Name>'s face, hair and clothes (<feature line>); the pose and background of that picture do not apply
             — only for people the state manager says need one
RULES        Exactly N people in frame, nobody else. [when references go along:] The numbered images are sources for look
             only: paint no numbers, labels, borders or panels; one single scene. <the medium's frame sentence> One frame
             filling the picture edge to edge, no black bars; no captions, titles or overlaid text, scene text only where
             named above.
```

Branches, chosen by code from the state manager's `envKind` and the crop: from the plate (the first still of a scene in a
place not yet shown); an edit (the same camera as the still before: the change list, "nothing in it changes except what is
listed under CHANGES"; a person whose only changed field is the distance to someone who moved is told to stay exactly as in
image 1); a new setup painted from the master (with `relation`: which man in image 1 is whom, closer or further back, and
how the cut follows the shot just seen; "a moment earlier" and "the same place a moment later" when the cast changed); a
punch-in painted from a crop of the master. Element ids inside the fields are replaced by their unique labels (a fixture's
only when its id is a compound, since a plain-word id such as "doorway" also occurs as an ordinary word). The CONTEXT block
(scene heading, scene n of N, first or last frame of shot n with its seconds, the shot's action labelled as not yet or
already happened, the moment, the tone) precedes FRAME.

**The actual prompt for the Lincoln single of the vanderbilt6 fixture** (`node V2/tests/state.test.mjs` prints it), 1,708
characters, where the KF2 prompt for the same frame ran to about 4,900:

```
CONTEXT
INT. THE EXECUTIVE MANSION IN WASHINGTON — INTERIOR, day; scene 1 of 1, the whole of shot 2 (4–9 s): nothing moves during it.
Moment: Abraham Lincoln asks the urgent naval question, Cornelius Vanderbilt listens with assurance, and Secretary of War Edwin M. Stanton watches silently.
Tone: Formal urgency and national peril underlie Lincoln's searching gravity, Vanderbilt's blunt confidence, and Stanton's restrained vigilance.

FRAME
Medium-close shot.

PEOPLE (exactly 1 in frame; Secretary of War Edwin M. Stanton and Cornelius Vanderbilt are just outside the frame to the left)
- Abraham Lincoln (image 2): centre third, facing toward Cornelius Vanderbilt, screen left, an arm's length from Cornelius Vanderbilt; standing upright, torso and head toward Cornelius Vanderbilt, hands at sides; waiting with measured seriousness, eyes on Cornelius Vanderbilt.

REFERENCES
image 1: the scene as it stands, the place and everyone in it; nothing in it changes. Image 1 is the wide view of this same instant: Abraham Lincoln is the one at the right of image 1. This frame is the same scene and instant with the camera closer, framing Abraham Lincoln.
image 2: Abraham Lincoln's face, hair and clothes (Dark, side-parted swept hair; chinstrap beard without moustache; no glasses; tall, lanky build); the pose and background of that picture do not apply.

RULES
Exactly 1 person in frame, nobody else. The frame is a period-accurate live-action documentary still captured with a static camera in tight framing. One single frame that fills the picture edge to edge, no black bars. No captions, titles or overlaid text; text that belongs to the scene, on a screen or a sign, only where a line above names it.
```

**What the template does not say, on purpose.** No walls, floor or light. No camera position ("against the south wall, a
room's width from him"). No fixture lists behind people. Those were added in the vanderbilt6 repaint as a reaction to a
wallpaper room, and they invite the painter to paint walls; with the master as image 1 and punch-ins as crops, the reference
carries them. The test asserts the single's prompt is under 1,800 characters and contains no "Walls:", "Light:" or "south
wall".

**The portrait rule, as applied here.** `needsPortrait` (`04-state.md`): a portrait only for a person not in image 1 or
framed two sizes closer than image 1 shows him, and for everyone when image 1 is the empty plate. The three-shot cut from
the walk-in sends no portraits at all.

**What went wrong in vanderbilt6 and the rule each failure produced.**

| failure | cause | rule |
|---|---|---|
| the walk-in start painted twice, both correct | the gate demanded the exact third | order, not thirds |
| the Lincoln single repainted into a wallpaper room, and accepted | the gate checked people only; an automatic retry nobody looked at | the room gate; gates flag only |
| the Vanderbilt single was the Lincoln single with the face swapped | a single used as image 1 for another single | new setups from the master, never a single |
| the three-shot repainted the room with the fireplace moved | the editor regenerates instead of cropping | punch-ins are crops |
| every single carried three portraits and 4,900 characters of prose | the "identity from the bank, always" rule and reactive room prose | portraits only where needed; the reference carries the look |
| the Top Gun attack wide was a three-panel collage with yellow image numbers | nine references for one frame, "(image n)" after every element name, the master a wide sharing one element | at most four images, the least prominent dropped; no numbers in the element lines; the master by shared elements |
| the bank frame of the fourth screenplay carried two bombs and a missile per jet, three times; the approach it was edited from already carried a missile beside each bomb | a prop "attached beneath the pylon" says nothing about what else hangs there, and the record photo of the F-35C shows external stores | attachment is a screenplay field (`on`): a prop on a host is "attached to X, the only thing attached there"; RULES states, through the chain, "Vega's F-35C carries exactly 2 things: the pylon, the bomb; nothing else is attached to it or hangs from it"; an edit's CHANGES ends with "everything else stays exactly as in image 1, including what every vehicle carries"; and the load gate looks at the picture, because the prose rule alone did not hold (a fourth paint still hung missiles on the jets) |
| the close on the frigate had the falling bombs a third of the frame high, the frame before had them beside the ship | image 1 was the wide master two shots back with the bombs' record photos beside it; the frame just before was words only ("before this frame, as last seen") | the state manager sends the frame just before as image 2 whenever it is not image 1 (`prev:` reference) |
| the strike wide of the rerun had four jets: two distant ones and two large foreground cockpits with pilots | two pilots "in frame" at far depth inside distant jets, and RULES demanding "exactly 2 people in frame" | a person at far depth is asked for as a small figure inside what carries it, never as a count to show; RULES count only the people visible up close, and name the far ones as figures inside their carriers, each thing once |

**Painting** (`paintKeyframes`). Per place, in plan order; a still is painted only when everything it is painted from exists
and is not flagged ("waiting on s1-2" otherwise). For a punch-in whose master is painted and has boxes, the crop is cut first:
at 50% or more of the master's width it is the frame, checked by the people gate only, no credits; below that it is painted
from the crop with the crop branch. Otherwise `Jobs.image` with the references in order (image 1 first, then the portraits
the state manager named), model `nano-banana-pro`, 2k, 16:9; one attempt per run, a new attempt suffix (`-r1`, `-r2`) on
`--retry`; every attempt kept; the still's prompt, inputs, crop box, still key and gate results recorded in `build.painted`
and in the state table. A `--retry` of a crop that was used directly paints from the crop (the same cut again would be the
same bytes and the same cached verdict). Title cards keep the attempt suffix too. **built and run** (V2 `vanderbilt`: 5
stills; `topgun`: 10 of 16, the rest waiting on a go).

**Checks.** The people gate on every still, the room gate on every painted still (against the still's own image 1) and the
bars gate on every still (`04-state.md`); a flagged still stops its chain, at paint time and at clip time.

**Cost.** 200 credits per painted still at 2k; a crop used directly costs nothing. Vanderbilt6 needed five distinct stills
for six shots; the first V2 run plans five stills for four shots, two of them crops of the walk-in's end frame.

**Status.** KF1 and KF2 built and compared in `cleaned/` (no visible difference on the one shot where both were painted; KF2's
order kept, KF1 archived, ticket T-011); the PRD-aligned template, the portrait rule and the crop branch are built in V2 and
pass the tests on the vanderbilt6 fixture and the audit cases (`V2/tests/audit.test.mjs`). Painted in V2: the five
Vanderbilt stills (one two-shot flagged for an edge figure, undecided) and ten Top Gun stills (the three cockpit frames
repainted after the latest-still rule, all passing; the warship wide passing against its image 1). Open: whether CONTEXT
should carry the shot's action text at all (`10-decisions.md`, 2026-10-30, and ticket T-022).
