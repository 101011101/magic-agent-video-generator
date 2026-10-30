# SM-300 — A forced-accepted frame is an equal-standing seed for every later frame
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-030

## Problem
The verifier records `forced: true` on a frame it accepted despite unresolved faults. Nothing in the pipeline reads that flag — the seed picker selects candidates on `f.accepted` alone, so a frame with recorded identity faults competes on equal terms with a clean one and can become the source of every subsequent frame. Faults therefore propagate forward silently, which is the mechanism behind recorded identity drift.

Once PRD-030 defines quarantine this becomes implementable: `pickSeed` should at minimum prefer clean frames, and should refuse a frame whose recorded fault is on an entity the new frame must preserve.

## Evidence
`current/prod/pipeline-state-graph/src/graph.js:66` — `.filter(({ f }) => f.accepted && !exclude.includes(f.id))`; `:75` and `:91` filter the same way for merge sources and roots. `grep -c forced current/prod/pipeline-state-graph/src/graph.js` → **0**; the only consumer is `src/page.js`.

18 of 26 acceptances are forced across all recorded runs (69%). In `p4-lighthouse-fixed30`, b4 was seeded from f9 (b3's start frame) while b3 itself was forced-accepted carrying `beacon identity differs: Opaque cylinder lacks large circular optical lens`; b4 then recorded `beacon identity differs: Missing large optical lens`.

## Done when
`pickSeed` takes recorded faults into account, and a replay over the recorded runs shows how many seed selections change and which faults stop propagating.
