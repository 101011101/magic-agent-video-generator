# RUN-003 — Video model A/B comparison (M01 sweep)
**Status:** open
**Category:** 06-runs
**Cost:** 1920
**Approval:** required-not-given
**Blocked by:** RUN-002

## Problem
`current/tests/subcases/MATRIX.md` §6.2 raises the hypothesis that the production model was selected on the wrong axis: `wan-3.0` was chosen for end-frame SSIM and free audio, but the vendor positions it for neither logic nor action fidelity — `wan-2.2` is "best for physical motion, action", `kling-2.6` is "best for action, motion blur", `veo3.1` is "expressive action". The dominant measured failure class across production runs is action/logic adherence (MATRIX.md Part 5), which pipeline A cannot even detect (RESULTS.md R08) and pipeline B only scores after paying for the clip. This run tests whether a different model removes those failures.

This run executes M01: the same G1 start frame and prompt (held constant), 5s, 720p, audio off, swept across `wan-2.2`, `kling-2.6`, `seedance-2.5` and `veo3.1` (the `wan-3.0` arm is G1 itself, already paid under RUN-002). M02–M05 (invented-action rate, form stability, camera obedience, relation retention) score the same four clips at zero additional cost.

## Evidence
No model other than `wan-3.0` has ever been used for `image-to-video` in this project (`ledger.json`: all 23 `/v1/image-to-video` calls are production jobs, model not separately logged but pipeline code only calls `wan-3.0`). The credit estimate (1,920 = 4 models × 480 cr, assuming wan-3.0's measured 96 cr/s rate for 5s) carries the caveat already recorded in MATRIX.md Part 4 and Part 6.5: the spec documents per-image credits but not per-second video credits for models other than wan-3.0, so this figure could be wrong for `kling-2.6`, `seedance-2.5` or `veo3.1`. Confirm the per-second rate from the first job's response before committing the full sweep.

Fulfils: TEST-031 (M01, 1,920 cr) plus TEST-032/033/034/035 (M02–M05, 0 cr each, scored off the same four clips).

## Done when
Each of the four models has produced one clip from G1's exact start frame and prompt, and each clip has been scored against L01 (inverted vector), L02 (null action), L03 (invented action), L09 (relation held), L10 (form morph) and L11 (camera obedience, drift < 3%, needs ffmpeg). M01 passes for a given model only if both L01 and L02 pass. Total spend recorded against this run: 1,920 credits (subject to the per-second-rate caveat above — verify and update before running the remaining three models if the first call's billed amount differs from 480).
