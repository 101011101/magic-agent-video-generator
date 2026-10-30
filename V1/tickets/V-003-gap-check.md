# V-003 — Gap check before a connected clip
**Status:** open
**Cost:** 0 (vision) + a mid keyframe when split (200)
**Blocked by:** V-002

## Problem
Lineage says two frames share a place and camera; it does not say the motion between them fits in 5 s. A big change makes a model morph.

## Done when
A vision call rates each connected gap (small / large / impossible); large → insert a mid keyframe or lengthen the clip; impossible → cut.

## Evidence (R-003, clip 3)
Slide 3's frame shows Goldilocks at the FRONT-LEFT of the table (the edit kept her where slide 2 had her, although `shows` said "behind the centre"); slide 4 puts her BEHIND the right end. The connected clip must get her from one to the other in 5 s and takes the straight line: through the table. The motion prompt also packed four actions into 5 s (shiver, walk, eat several spoonfuls, hands on tummy).
Fix order: (1) gap check flags a path blocked by a plan item → insert a waypoint keyframe (her at the table's end) or cut; (2) the motion prompt names the path ("around the right end of the table"); (3) one action per clip; (4) the verifier checks position, not only presence (see V-008).

## Patch
Addressed in the sequencer by B-007 (step-script rules); the clip-stage gap check itself is still open.
