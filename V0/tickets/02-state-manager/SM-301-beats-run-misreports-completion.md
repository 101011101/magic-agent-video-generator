# SM-301 — `beats_run` reports planned beats, so a stopped run claims it completed
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`log.beats_run` is written from the planned beat list before execution begins and is never corrected. A run that stops early still reports every planned beat as run. The run page renders this directly, so an operator reading either the page or `run.json` is told a truncated run finished.

## Evidence
`current/prod/pipeline-state-graph/run.mjs:47` — `log.beats_run = beats.map((b) => b.n);` executes before the beat loop at `:63`.

`current/tests/pipeline-state-graph/runs/p4-lighthouse-fixed30/run.json`: `beats_run: [1,2,3,4,5,6]`, `stopped: "credit cap 23000: clip:b5 (480) would exceed it"`, and only 4 `clip:` job keys present. The rendered page reads "beats 6/6 run" above a 20-second, 4-clip video.

## Done when
`run.json` distinguishes planned from completed beats, the page renders the completed count, and `p4-lighthouse-fixed30` re-renders as 4 of 6.
