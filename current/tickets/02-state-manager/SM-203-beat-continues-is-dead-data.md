# SM-203 — `beat.continues` is computed every run and read by nothing
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The timeline schema requires a `continues` array on every beat — for each entity, the earlier beat where it last appeared — and the prompt tells the model "This is the pointer the system follows" (`prod/pipeline-state-graph/src/timeline.js`). The system does not follow it. The documented mechanism does not exist, and the model pays tokens to produce it on every run.

## Evidence
`grep -rn "\.continues" current/prod/pipeline-state-graph/` returns one hit: `src/page.js:89`, which reads `v.continues` — the *version record's* own field, set in `graph.js:37`. No code reads `beat.continues`. The lineage it describes is already carried by frame records (`seed`, `merged`, `op`) and by entity versions.

## Done when
Either the field is consumed where entity lineage is resolved, or it is removed from the schema and the prompt. The phrase "This is the pointer the system follows" is removed or made true.
