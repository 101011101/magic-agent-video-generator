# SM-105 — Generalize the pass-through path; it is the best-performing path we have
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The one recorded run that follows the intended model end to end — original passed and transformed, never regenerated — is also the cheapest and the highest scoring, and the architecture treats it as a special case rather than the default.

`p1-grandma-v1` uses `upload` → `upload-direct` → `clip-last` and **zero generated frames**. It cost 480 credits in A (680 in B, including 200 on an anchor that should not have existed) and scored **94.4 reward / 96 per-shot** — against 72.3, 67.4 and 62.5 for the generated runs.

`upload-direct` fires only under a very narrow guard (`pipeline-state-graph/src/controller.js:162`): the seed must be an upload, have no merges, no fresh entities, and already show every wanted entity at the right version. Any deviation falls through to a paid regeneration.

## Evidence
Op histogram, `current/tests/pipeline-state-graph/runs/p1-grandma-v1/state.json`: `{upload: 2, upload-direct: 1, clip-last: 1}` — no `edit`, `merge`, `generate` or `anchor`. Judge: `current/tests/pipeline-memory/runs/p1-grandma-v1/run.json` → `reward: 94.4`, shot total 96. Ledger: `current/tests/pipeline-memory/ledger.json` → 680 credits, versus 9,200 for `p4-lighthouse-v1`.

Caveat, stated plainly: grandma is a single 5-second clip with one entity and no cut, so it is the easiest case in the set. It is evidence that the pass-through path is cheap and faithful where it applies, not proof that it scales to nine shots.

## Done when
The guard is widened so a frame is passed through whenever the needed content already exists in an accepted frame, with regeneration as the fallback rather than the default — and the deterministic share of the op histogram rises on a multi-shot case.
