# PRD-020 — The type model is binary; "accepted with faults" is the normal outcome and is not in the PRD
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none
**Related:** PRD-030 (quarantine: an artifact may ship but must not be seeded from), PRD-032 (verification is never a control input), SM-200 (the one coded remedy has never fired)

## Problem
`vision.md`: "The only question for a goal: is it satisfied? A goal is satisfied only when it is proven satisfied. Until then, it remains a goal." The implementation has a third state the theory forbids — `accept-forced`, a condition known to be false and closed anyway — and it is the majority outcome.

Two gaps in the thesis, not the code:
- **No degree.** Conditions are boolean; the recorded faults are continuous (a shell at 2.9x its real size, an identity that is nearly right). There is no per-condition tolerance.
- **No remedy.** `vision.md` says a failure "traces backward through the chain to the tool that failed". Tracing is diagnosis. The PRD never states what happens next, so the implementation invented accept-forced.

## Evidence
Across the five recorded state-graph runs (`current/tests/pipeline-state-graph/runs/*/run.json`): 24 accepted frames, **18 accepted with faults already on record (75%)**. Per run — v2: 8 of 8; v3: 5 of 7; fixed30: 4 of 6; v1: 1 of 2; grandma: 0 of 1. The string `accept-forced` appears in `src/controller.js` and in no document under `current/docs/`.

## Done when
The PRD defines a third satisfaction state with an explicit per-condition tolerance, and a remedy policy selected by the condition's priority (retry / re-source / substitute tool / surface to the user). `post-mvp.md` already anticipates priority; it is moved into the MVP model. A reader can answer, from the docs alone, what the system does when a condition is false after execution.
