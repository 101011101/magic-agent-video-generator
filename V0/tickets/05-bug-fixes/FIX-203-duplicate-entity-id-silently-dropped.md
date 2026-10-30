# FIX-203 — Two entities with the same id silently become one
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Entity tables are built with `Object.fromEntries(entities.map((e) => [e.id, …]))`, which keeps the last of any duplicate key and discards the rest:
- `pipeline-state-graph/src/graph.js:13`
- `pipeline-memory/src/memory.js:22`
- `pipeline-memory/src/storyboard.js:84`

Neither pipeline validates the plan for duplicate ids, and neither schema can express uniqueness (`pipeline-state-graph/src/timeline.js:16` declares `entities` as a plain array). An LLM that emits two entities called `keeper` loses one of them, along with its `look` and `size`, and every later reference resolves to the survivor.

## Evidence
Read from the code. No recorded run contains a duplicate id, so this is unexercised rather than observed — but there is no guard, and the plan is LLM-generated.

## Done when
A plan containing two entities with the same id is rejected at load with both offending entries named, in both pipelines.
