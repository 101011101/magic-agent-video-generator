# G-005 — Text and pixels describe the place differently
**Status:** in-progress (B-008, B-009)
**Cost:** 0
**Blocked by:** none

## Problem
custom-rrh1 slide 9: the place text said the bed's head is "beneath the small window" with the quilt "reaching toward the camera"; the plate painted the tall headboard and pillow nearest the camera. Steps were written from the text ("head beneath the small window"), the editor saw the pixels, and 2 of 3 attempts put the wolf at the foot end (one invented a second pillow there; slide 11 then grew a tail out of the headboard end). Nothing compared the plate with its text.

## Root causes
1. Places are described in prose before the plate exists, and the prose is never checked against the plate.
2. Positions are free prose ("beneath the window"), so a phrase can name a spot the picture does not support.
3. The verifier asked one diluted question per entity ("roughly the same side, same item"): it passed s9-a3 and rejected s9-a1 for the same wrong end, and rejected the one correct attempt (s9-a2) because the tiny needle was "missing".

## Evidence (E1, runs/exp-verifier.json)
Focused questions to gpt-6.1-sol on the same frames: bed end judged right 12/12 at low and at high effort; framing change on s11-a2 caught 3/3. The model can see it; the question was the problem.

## Done when
B-008 (seed) and B-009 (blocking) are built and R-005 shows the first frame of every place matching its ground plan.
