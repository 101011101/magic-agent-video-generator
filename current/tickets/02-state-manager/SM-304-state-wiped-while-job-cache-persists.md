# SM-304 — `state.json` is deleted every run while the job cache persists
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The graph is deleted and rebuilt on every non-estimate run; `log.jobs` survives in `run.json`. The two halves of a run's memory have different lifetimes. In practice the rebuild is complete enough to stay self-consistent, but a resume re-pays LLM verification for frames it will not regenerate, and frame ids are positional, so ids recorded in an earlier log do not necessarily denote the same frames after a resume that skips differently.

## Evidence
`current/prod/pipeline-state-graph/run.mjs:58` — `if (!estimate) rmSync(join(runDir, "state.json"), { force: true });`
`run.mjs:39` also resets `beats: {}` and `errors: []` each run, while `log.jobs` and `log.calls` are append-only (`jobs.js:24`).
Frame ids are assigned positionally in `graph.addFrame` (`graph.js:122`).

## Done when
Either the graph persists across runs alongside the job cache, or the inconsistency is documented as intended with the resume cost stated; and frame ids are stable across a resume, or recorded ids are never relied on across runs.
