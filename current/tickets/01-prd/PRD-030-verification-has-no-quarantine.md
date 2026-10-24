# PRD-030 — Verification has no concept of quarantine: a failed check changes nothing
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The PRD specifies that the final product is verified against the requested type and that a failure traces back to the tool that failed (`vision.md`, `architecture.md` step 8). It never states what must happen to an artifact that fails and cannot be repaired. The implementation resolved that silence by accepting the artifact and recording the fault — "accept forced with the fault on record".

The missing concept is **quarantine**: an artifact that may be delivered but must not be built upon. Without it there is no way to express "ship this frame, but never seed another frame from it", which is precisely the distinction the system needs. This is a design gap, not an implementation error — there is nothing for the code to be wrong about.

## Evidence
18 of 26 acceptances across all recorded pipeline A runs are forced (69%); 8 of 8 in `p4-lighthouse-v2` (100%); 18 of 25 (72%) excluding the single trivial grandma clip. Counted from `beats[].attempts[].forced` and `beats[].anchors[].forced` in `current/tests/pipeline-state-graph/runs/*/run.json`.

In `p4-lighthouse-fixed30`, beats 2–5 were forced-accepted carrying `shell identity differs`, `beacon identity differs` and `trawler identity differs`, and those frames were then available as seeds on the same footing as clean frames.

## Done when
The PRD states what happens to an artifact that fails verification and cannot be repaired, distinguishing at minimum: deliverable-but-not-seedable, not-deliverable, and acceptable-with-recorded-fault; and `01-types.md` or `05-solver.md` names the property that carries that status through the chain.
