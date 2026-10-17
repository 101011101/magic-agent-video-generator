# SM-101 — The designed selection subsystem is dead code
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`current/prod/state-manager/src/signatures.js` (22-atom vocabulary, 40 tool signatures, preserved-property rules), `src/atomize.js` (conditions) and `src/solver.js` (backward search, hard/soft credit, shared nodes, execution levels) are the implementation of the PRD's operations half. No live pipeline imports any of them. They are reachable only from `state-manager/run.mjs` and `execute.mjs`, which `pipeline-v2/README.md:18` records as superseded.

This matters beyond tidiness: the repo's documentation (`current/docs/architecture.md` subsystem table, `current/docs/subsystems/05-solver.md`) still presents the solver as the live operations design, so anyone reading the PRD will believe tool selection exists.

## Evidence
`grep -rn "signatures\|solver\|atomize" current/prod/pipeline-state-graph current/prod/pipeline-memory current/prod/pipeline-v2` — zero import statements; the only hits are the word "signatures" inside a prompt string (`pipeline-state-graph/src/prompts.js:8`) and a comment in `pipeline-v2/src/state.js:12`.

## Done when
Either the subsystem is wired into a live pipeline, or the docs state plainly that it is not in use and what replaced it. Decide which; do not leave the PRD describing a system that is not running.

---
## Resolution (2026-10-14): split the subsystem — revive the signatures, retire the search

The subsystem is not one thing, and the two halves deserve opposite verdicts.

**Revive `signatures.js` — done.** The 22-atom vocabulary and 40 tool signatures are the only machine-readable
statement in the repo of what each tool preserves. They are now live: `src/select.js` + `src/choose.js` read them, and
both pipelines' image and video call sites select through them (`pipeline-state-graph/src/jobs.js`,
`pipeline-memory/src/common.js`). 164 recorded jobs replay to the identical tool, so this is wiring, not a behaviour
change. `loadSignatures({ includeAnalysis: true })` additionally exposes Face Detection, which the solver's filter drops
because it makes no atom true — the selector needs it precisely because a tool that only reports is still the tool that
supplies a tracked property.

**Retire `solver.js` — recommended, not yet done.** Its backward search answers "what chain of tools proves this goal",
a question neither live pipeline asks: both receive an ordered shot list from one LLM call and execute it. Reviving it
would mean re-adopting the condition-built-prompt architecture that `DIAGNOSIS.md` found 19 defects in and that
`pipeline-v2/README.md:18` records as superseded. The costly failures (SM-002 re-anchor, SM-102 transformation) are not
search failures — a perfect search over a tool set that regenerates instead of transforms still regenerates.

Recommended: move `solver.js` and `atomize.js` to `archived/`, leaving `signatures.js` in `prod/`. Blocked on a decision
only because `05-solver.md` is still written as the live operations design; the doc and the move should land together.

**Docs** still need the smaller correction this ticket asks for: `architecture.md`'s subsystem table lists the solver as
the operations design. Selection now exists and the search does not, and the table should say so.
