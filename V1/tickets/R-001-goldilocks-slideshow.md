# R-001 — Paid run: Goldilocks slideshow (stage 1)
**Status:** done
**Cost:** ≈ 3,600–5,000 credits (estimate first with `--estimate`)
**Blocked by:** B-001 … B-006

## Problem
The thesis (the frame is the state; edits carry changes forward) has not been tested end to end.

## Done when
`node cleaned/run.mjs --case goldilocks --label v1` finishes, and the result is recorded here: slides passed on first or second attempt, forced slides, changes that persisted or were lost, max hops, credits.

## Result (goldilocks-v1, 4,000 credits, 12.5 min)
- 12/12 slides passed verification; 11 on the first try. 13 edits + 7 roots = 20 images. 0 forced.
- **Changes persisted through the frames, with no text state:** the empty small bowl (made on slide 4) is still empty on slide 8; the broken chair (slide 6) is still broken on slide 9; sleeping Goldilocks (slide 7) is still in the small bed on slides 10–11.
- **1 + 1 fallback fired once:** slide 8 try 1 dropped the spoon; try 2 built on try 1 and added only the spoon → pass.
- **Rooms held** across first visits and returns (fireplace, window, door, furniture layout), and so did the bears' relative sizes (group root).
- **Drift is visible at 4–5 hops** (slide 8, hops 5): the camera pushed in and the palette warmed against slide 4 → G-002.
- Plan weakness: slide 3 is almost identical to slide 2 ("middle bowl too cold" has no visual change). Fine for video, wasted as a keyframe.
- Not checked by a judge: identity across slides was eyeballed only.
