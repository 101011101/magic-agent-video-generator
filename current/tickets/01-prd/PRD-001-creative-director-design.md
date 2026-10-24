# PRD-001 — Creative director: "how it works" is not designed
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`architecture.md` states the creative director's nature and its two LLM calls, then says the rest is not designed. The subsystem is live in both pipelines (story + chunks feed `pipeline-state-graph/src/timeline.js` and `pipeline-memory/src/storyboard.js`) so the design is being made implicitly in code.

## Evidence
- `current/docs/architecture.md:46` — "**How it works:** the rest is [not designed yet]."
- `current/docs/subsystems/02-creative-director.md` — status "Direction chosen; chunk format under test".
- Chunk format A vs B has been under test since the first prototype; no decision is recorded.

## Done when
`02-creative-director.md` states the chosen chunk format with the evidence that chose it, and the "how it works" section is written rather than deferred.
