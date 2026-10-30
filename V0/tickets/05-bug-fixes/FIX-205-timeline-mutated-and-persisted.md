# FIX-205 — The downgrade mutates the saved plan, so a resume is not reproducible
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/src/controller.js:106` assigns `beat.link = "cut"` on the live beat object. That object belongs to `timeline`, which is `log.timeline` (`run.mjs:50`), which `jobs.save()` writes to `run.json`.

`run.mjs:49` reads `log.timeline || await planTimeline(...)`, so a resumed run loads the **mutated** plan. A beat downgraded in run 1 starts run 2 as a cut and never attempts the continuous path, even if the condition that forced the downgrade no longer holds. The original plan is unrecoverable from the run directory.

## Evidence
`current/tests/pipeline-state-graph/runs/p4-lighthouse-fixed30/run.json` → `timeline.beats[3]` has `link: "cut"` and `link_planned: "continuous"`. The planner's output is gone; only the inference survives.

## Done when
`log.timeline` matches what `planTimeline` returned, byte for byte, after any run including one with a downgrade; runtime decisions live beside the plan, not inside it.
