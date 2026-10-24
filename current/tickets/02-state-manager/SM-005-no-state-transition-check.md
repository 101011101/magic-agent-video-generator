# SM-005 — The state records transitions but never verifies them
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-010

## Problem
Both pipelines plan a start state and an end state per beat or shot, so the intended transition is written down. Nothing ever checks that the transition happened. The verifier compares a single frame against a wanted state; it has no second frame to compare against and no vocabulary for change.

## Evidence
- `current/prod/pipeline-state-graph/src/verify.js:9-10` — `HARD` and `SOFT` are eleven static frame properties; no temporal term.
- Fault histogram over every A run: position 43, size 24, pose 24, identity 11, interaction 6, place 4, condition 3, wardrobe 1, **motion 0**.
- `current/prod/pipeline-memory` plans `end.changes` per shot and its judge reports `end_state_ok` false in 15 of 16 lighthouse shots — after the clip is paid for, with nothing acting on it.

## Done when
A transition check compares the real first and last frames of a clip against the planned change and can fail, and its faults appear in the run record alongside the frame faults.

## Related
- `PRD-010` is the design gap this sits on: the type model has no way to express a change over time, so no transition condition can exist to check.
