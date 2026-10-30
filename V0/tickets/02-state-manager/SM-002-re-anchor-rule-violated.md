# SM-002 — The re-anchor rule is violated: generated chains onto generated
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`05-solver.md` states: "every generation conditions on the root binding (the original reference). Never chain generated → generated for identity." Pipeline A holds a root only for small props; characters and locations are seeded from the best-scoring earlier *generated* frame. Pipeline B attaches anchors but still bases the cut on an earlier generated frame. This is the mechanism behind the recorded identity drift.

## Evidence
- Rule: `current/docs/subsystems/05-solver.md:57`.
- `current/prod/pipeline-state-graph/src/controller.js:111,157` — anchors are created only when `isSmall(e.id)` (props ≤ 30 cm). No root for characters or locations.
- `current/prod/pipeline-state-graph/src/graph.js` `pickSeed` — candidates are "accepted frames", i.e. earlier generated output.
- `current/prod/pipeline-memory/src/keyframes.js` `cutKeyframe` — `sel.base` is an earlier bank frame; anchors are added alongside, not instead.
- Already recorded as defect 14 in `current/prod/state-manager/DIAGNOSIS.md`.
- Observed consequence: `current/tests/pipeline-memory/runs/p4-lighthouse-v2-30s/run.json` — keeper "looks younger with dark hair" in tower shots after the cut.

## Done when
Every generation that must preserve a bound identity receives that binding's root reference as an input, and a run record shows no identity chain longer than one hop from a root.

## Related
- `SM-102` (code trace) reaches the same place from the other side: state is pointer-correct, transformation absent. This ticket is the PRD rule that the behaviour breaks.
