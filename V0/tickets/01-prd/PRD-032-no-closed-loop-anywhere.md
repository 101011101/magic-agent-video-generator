# PRD-032 — No check in either pipeline changes a later decision
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-030

## Problem
Both pipelines verify, and neither acts on what it learns. Pipeline A checks frames and cannot reach the clip. Pipeline B judges clips accurately but only after the clip, the stitch and the audio are paid for. The sole feedback mechanism anywhere is the retry loop, which is local to one frame and bounded at three attempts.

A verification system whose output reaches only the report is an observation system. The PRD describes verification as a stage in a pipeline rather than as a control input, and nothing downstream is specified to consume it.

## Evidence
Pipeline A: `forced` is written to the frame record and read by exactly one consumer, `pipeline-state-graph/src/page.js`. `grep -c forced current/prod/pipeline-state-graph/src/graph.js` → **0**. Seed candidates are filtered on `f.accepted` alone (`graph.js:66`, `:75`, `:91`).

Pipeline B: `judgeCut` is invoked at `pipeline-memory/run.mjs:206`, after `stitch` (`:162`) and after the audio step. It emits per-shot scores, `end_state_ok`, `primary_fault` and an issue list; no later code reads any of it.

## Done when
At least one check in each pipeline demonstrably changes a subsequent decision, and the PRD names which checks are control inputs as opposed to reporting.
