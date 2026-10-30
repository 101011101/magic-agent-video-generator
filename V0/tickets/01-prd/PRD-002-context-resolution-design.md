# PRD-002 — Context resolution: design not started
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-006

## Problem
Subsystem 3 is a problem statement only. Five questions are unanswered, including the atomic unit of context and when resolution runs. Neither live pipeline implements `ask` or `research` leaves, so missing context cannot be surfaced to the user at all.

## Evidence
- `current/docs/subsystems/03-context-resolution.md:3` — "Status: problem statement only. Design is not started."
- `03-context-resolution.md:20-25` — five unanswered questions.
- `current/prod/pipeline-v2/README.md` "Open" — "uploads and `ask` leaves (only generated entities so far)".

## Done when
The five questions have recorded answers and the atomic unit of context is defined against the atom vocabulary in `01-types.md`.
