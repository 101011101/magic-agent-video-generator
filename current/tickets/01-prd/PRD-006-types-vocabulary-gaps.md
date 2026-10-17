# PRD-006 — Types: atom vocabulary has known gaps and the layer model is unconfirmed
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The atom vocabulary has two gaps found by the solver traces, and the video layer model (entities / world / composition / look) is still a proposal. Subsystem 1 is the basis for subsystems 3, 4, 5 and 6, so every one of them is blocked on it.

## Evidence
- `current/docs/subsystems/01-types.md:72-74` — "No atom for visibility (opacity over time). The `fade` tool makes nothing true." and "No atom for the position of one layer or element."
- `01-types.md:76` — "Draft for discussion (proposal, not confirmed)" over the layer model.
- `01-types.md:86-96` — eleven unanswered questions, including what states a scene state machine has.
- `current/prod/state-manager/src/signatures.js` already ships proposed atoms `visibility` and `layer_position` as local patches, so code has outrun the PRD.

## Done when
The two missing atoms are either adopted into the vocabulary fixture or rejected with a reason, and the layer model is confirmed or dropped.
