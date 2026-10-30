# PRD-005 — Editing: design not started, and no pipeline can edit
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-004

## Problem
Subsystem 6 is a problem statement. Architecture step 10 promises "an edit changes part of the solved tree; only the affected calls run again". Neither live pipeline can do this: A rebuilds its graph from the timeline every run, B replays by shot id.

## Evidence
- `V0/docs/subsystems/06-editing.md:3` — "Status: problem statement only. Design is not started."
- `V0/docs/architecture.md` step 10 — the promise.
- `V0/prod/pipeline-state-graph/run.mjs` — "The graph is rebuilt every run from the timeline".
- `V0/prod/pipeline-memory/run.mjs:7` — a done shot "is marked done in run.json and replayed on re-runs".

## Done when
The four questions in `06-editing.md` are answered and the propagation rule is specified against whichever plan representation survives.
