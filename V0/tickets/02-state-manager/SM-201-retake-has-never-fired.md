# SM-201 — The retake mechanism cannot reach the faults that occur, and has never fired
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-020

## Problem
A clip's real last frame is verified against the beat's end state (`prod/pipeline-state-graph/src/controller.js:74`) — the check is sound. The remedy is not. The retake trigger is character identity only: `controller.js:75` filters `wantEnd.entities` to `kind === "character"` and then to `identity differs | missing | appears N times`. Every fault on a prop or a location, and every non-identity fault on anything, is verified, recorded and ignored.

## Evidence
`RETAKES = { per_clip: 1, max: 3 }` (`controller.js:15`). Across all five recorded runs: **2 clip-last identity faults, both on props, and 0 retakes**. The mechanism is coded, capped and paid for, and has never once run. In `p4-lighthouse-fixed30` the recorded clip faults include `beacon identity differs: Missing large optical lens` and `trawler identity differs: Hull not blue` — both props, both ignored.

## Done when
The trigger is the condition's priority rather than `kind === "character"`, so a prop or location whose identity is a rigid condition can cause a retake. Replaying the recorded runs under the new trigger reports a non-zero number of retakes that would have fired, with the list of which faults caused them.
