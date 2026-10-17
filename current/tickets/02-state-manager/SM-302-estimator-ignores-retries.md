# SM-302 — The estimator is systematically ~2.7× low because it counts one attempt per frame
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Estimate mode breaks out of the attempt loop after the first attempt, so it prices one call per frame beat. Real runs average 2.5–2.83 attempts per frame beat. The bias is stable across independent runs, so it is correctable rather than irreducible uncertainty. The estimator notes "retries not counted" but publishes no worst-case figure, and nothing compares the estimate against remaining cap headroom — which is how `RUN-005` was launched with insufficient headroom and truncated.

## Evidence
Attempts per frame beat, counted from `beats[].attempts` in `current/tests/pipeline-state-graph/runs/*/run.json`:

| run | frame beats | attempts | ratio |
|---|---|---|---|
| p4-lighthouse-v2 | 8 | 20 | 2.50 |
| p4-lighthouse-fixed30 | 5 | 14 | 2.80 |
| p4-lighthouse-v3 | 6 | 17 | 2.83 |

`RUN-005` estimated 3,880 and billed 4,920 (+27%).

## Done when
Estimate mode reports a range whose upper bound uses the measured attempt ratio, warns when the upper bound exceeds remaining cap headroom, and reproduces 4,920 within its range for `p4-lighthouse-fixed30`.
