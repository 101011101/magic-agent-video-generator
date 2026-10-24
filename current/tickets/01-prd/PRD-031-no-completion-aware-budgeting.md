# PRD-031 — Budget logic cannot reason about whether a run can finish
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The credit guard answers one question: does the next call fit under the cap. It never asks whether the work still outstanding fits. A run that cannot possibly finish therefore spends everything available and stops partway, which is the worst of the three available outcomes — worse than refusing to start, and worse than deliberately producing a shorter cut that is complete.

The PRD has no model of a run as a budgeted whole. Cost appears only as a tie-breaker in tool selection (`vision.md:86-90`), never as a constraint on scope.

## Evidence
`current/prod/pipeline-state-graph/src/jobs.js:44` — the only forward-looking check is `led.total - (led.runs[this.log.run] || 0) + this.spent() + cost > CAP`, scoped to the single call named by `cost`.

`RUN-005` (`p4-lighthouse-fixed30`): spent **4,920 credits**, stopped at `clip:b5` with `credit cap 23000: clip:b5 (480) would exceed it`, and delivered a 20-second 4-clip artifact against a planned 30-second 6-beat one. `run.json` records `stopped` but never computes what the run still owes to finish.

## Done when
The PRD states how a run behaves when the remaining work exceeds the remaining budget, and the pipelines implement that choice — at minimum computing outstanding cost before the first paid call, and recording remaining-cost-to-finish when a run stops short.
