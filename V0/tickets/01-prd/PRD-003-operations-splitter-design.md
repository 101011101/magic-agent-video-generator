# PRD-003 — Operations splitter: design not started
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-006

## Problem
Subsystem 4 is a problem statement only. Both live pipelines replaced the splitter with a single planning LLM call, so the designed subsystem has no implementation and the implementation has no design.

## Evidence
- `current/docs/subsystems/04-operations-splitter.md:3` — "Status: problem statement only. Design is not started."
- `current/prod/pipeline-state-graph/src/timeline.js` and `current/prod/pipeline-memory/src/storyboard.js` — one LLM call each, producing a beat/shot list directly. No splitter.
- `current/prod/pipeline-v2/README.md` — "Not used from v1: the atomizer, the solver and the condition-built prompts".

## Done when
Either the splitter is designed, or the PRD records that the single-call planner supersedes it and subsystem 4 is marked superseded with the reason.
