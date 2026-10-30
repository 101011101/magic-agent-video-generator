# G-006 — Problem register and isolated tests (2026-10-19)
**Status:** open (fixes listed below not yet in the pipeline)
**Cost:** tests 1,200 (T2, T5); others LLM / ffmpeg only
**Blocked by:** none

Every problem met so far, its state, and the isolated test that decides it (`experiments/isolated.mjs`, results in
`runs/exp-isolated/results.json`).

| # | Problem | State | Evidence / test |
|---|---|---|---|
| P1 | Teleports, missing exits | fixed (lint) | rrh2 step 25 leftover |
| P2 | Story softened / events skipped | fixed (rules) | rrh2 covers every event |
| P3 | Wrong feelings (smile while fleeing) | fixed | expression on every step |
| P4 | Text vs pixels disagree on the room | fixed by design (seed) | G-005 |
| P5 | Plate checker skipped 13 of 14 marks | fixed (keyed schema) | rrh2 |
| P6 | Plates fail 3 of 5 | **cause found** | T1: compound, chained `where` clauses fail correct plates; one essential fact per used mark passes cottage t1 and t2 (correct by eye) and fails t3 (shelf turned into a hutch, correct) |
| P7 | Sparse plates | fixed | quality 5 on all rrh3 plates |
| P8 | Doors that cannot open | **cause found** | T8: a focused door question finds t2 and t3 (canonical!) swing into the fireplace; the general "impossible?" question missed it |
| P9 | Sheets that were scenes | fixed (asset bank) | rrh3 |
| P10 | Specs with later story states | fixed | rrh3 redo |
| P11 | Style palette tints the subject | **cause found** | T2: medium-only style → clean charcoal wolf; full style + "own colours" rule still olive/pink. Also: the character template says "standing", so animals stand upright |
| P12 | Checker nitpicks | fixed (major/minor) | rrh3 recheck |
| P13 | Multi-view sheets | fixed (set check) | |
| P14 | Whole-picture re-paints (6/44 in rrh2) | **cause found** | T3: all 6 on steps that added nobody but passed sheets of characters already in the frame (2 such sheets: 5/14; 1: 1/28). T5: same edits without those sheets: 4/4 kept framing |
| P15 | Colour drift to pink | **fix works** | T6: per-channel mean/spread match to the place's reference frame removes the cast (shift 14/-1/8 → 0/0/0) |
| P16 | Character look drifts | **check unreliable** | T4: frame-vs-sheet identity question missed the invented wolf (said same) and flagged Red on frames whose sheets were scenes; needs a crop of the character, not the whole frame |
| P17 | Duplicated characters | **cause found** | T5: same as P14; with Red's sheet attached the editor drew a second Red, without it Red moved (×1, 4/4) |
| P18 | Retry dropped references | fixed | |
| P19 | Forced pick kept a re-paint | fixed | |
| P20 | Crowded scenes miss poses/positions | open | partly P14/P17 |
| P21 | Tiny props failed frames | fixed | |
| P22 | Verifier inconsistent | fixed | E1 12/12 |
| P23 | Clip clipping / cut-clip invention | open (video) | V-003, V-006 |
| P24 | No audio | deferred | V-009 |
| P25 | LLM timeout | fixed | |

## Fixes the tests support (next)
1. P14/P17: pass a sheet only for characters being ADDED; never for characters already in the base frame (the frame is their reference).
2. P6: ground plans keep full detail for painting, but each used mark gets one essential fact, and only those are checked.
3. P8: plates get a focused door question (opens freely?) that rejects.
4. P11: sheets use the medium only (no palette or light); animals use "natural stance", not "standing".
5. P15: colour-match each accepted frame to the place's first accepted frame.
6. P16: identity check on a crop of the character (box from the verifier), not the whole frame.
