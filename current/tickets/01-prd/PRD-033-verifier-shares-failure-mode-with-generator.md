# PRD-033 — The verifier shares a failure mode with the generator
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Verification is a VLM judging an image; generation is a model drawing one. Where both are weak at the same thing, a pass means less than its rate suggests, and the system cannot know it. Real-world size is the clearest instance: the verifier is asked whether an object's size is plausible relative to people and the place, which is the same judgement the generator failed to make. The PRD assumes verification is independent of generation and never states where an independent instrument is required.

## Evidence
`current/prod/pipeline-state-graph/src/verify.js` asks a VLM for `size_ok`, defined as "false only when it is clearly more than twice or less than half its real size". Size is the second most frequent recorded fault (24 occurrences across pipeline A runs, behind position at 43).

No deterministic measurement exists anywhere in either pipeline: `/v1/face-detection`, which returns coordinates rather than a judgement, is never called (SM-104).

## Done when
The PRD names which properties require an independent instrument (a measurement, not a judgement) and which may be judged by a model, with the shared-failure-mode risk stated for the latter.
