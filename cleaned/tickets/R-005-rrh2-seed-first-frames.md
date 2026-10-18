# R-005 — Paid run: Red Riding Hood rrh2, seed + first frame of each place
**Status:** done
**Cost:** ≤ 3,600 (3 places × ≤ 3 plate tries + 3 first frames × ≤ 3 tries); character sheets reused from custom-rrh1 (0). Cap 30,000 approved.
**Blocked by:** B-008, B-009, B-010, B-011

## Done when
`CLEANED_CAP=30000 node cleaned/run.mjs --prompt "Make a short storybook-style video of Little Red Riding Hood." --label rrh2 --entities-from custom-rrh1 --first-frames` finishes; the page shows each plate with its marks (intended vs canonical), the full blocking table, and the first frame of each place. Judge: do the plates match their plans (bed head/foot, doors), and is each first frame consistent with them.

## Result (2026-10-18): 1,600 credits
- Story 30 steps, every event of the tale in order. Blocking lint left one violation after the rewrite (step 25: Red re-enters while already inside).
- Plates: woodland try 1 misplaced the ferns and flowers → try 2 matched every key mark. Cottage try 1 put the sewing shelf above the bed's head and left no floor beyond its foot → try 2 matched (bed head against the back wall, foot toward the camera, door left, table under the window).
- Slide 1 (woodland): pass first try. Slide 7 (cottage, Grandmother opens the door to the wolf): try 1 rejected (wolf leaning over a closed half-door), try 2 pass. Try 3 of the first run (rebuilt on try 2 to add the needle) re-painted a different room: the framing gate rejected it (SSIM 0.09).
- Bugs found and fixed: the plate observer answered only one of 14 marks in a free list (now one required field per mark); tiny props merely placed in a scene failed frames (now asked only when a beat handles them). Re-verification after the fixes cost 0 credits.

## Full run (cap 36,000): 8,400 more credits (rrh2 total 10,000)
- 25/30 slides, 44 attempts, 23 passed (11 first try), forced 12 and 23. Stopped before slide 26 (cap).
- Woodland (1–6) and the first cottage stretch (7–11) hold one room, one framing, consistent characters and marks.
- Slide 12 kept a re-painted room: try 1 failed the framing gate (SSIM 0.16), tries 2–3 duplicated Red, and "fewest faults" kept try 1. Every later cottage slide inherited the new room. Fixed: a framing or grid fault now weighs 10 when choosing the forced attempt.
- Colour drifts warm/pink over hops 13–19 (corner shift 15–22 at SSIM 0.85–0.92 on slides 21–23 triggered the gate). G-002.
