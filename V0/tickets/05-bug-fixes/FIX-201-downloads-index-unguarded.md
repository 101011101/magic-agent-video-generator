# FIX-201 — A completed job with no outputs crashes the run and under-counts the ledger
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`state-manager/src/magichour.js:45` returns `downloads: (p.downloads || p.faces || []).map((d) => d.url)` — an empty array when a job completes with no output. All 15 call sites then index `[0]` unguarded, e.g. `pipeline-state-graph/src/jobs.js:71` and `:81`, `pipeline-memory/src/common.js:97` and `:105`, `sweeps/run-001.mjs:102`. `download(undefined, …)` reaches `fetch(undefined)` and throws a TypeError with no reference to the job.

Worse than the crash: the job completed, so Magic Hour charged for it, but `jobs.js:51-55` catches the throw from `fn()` and pushes `{ key, error }` to `log.calls` **with no `credits` field**. `spent()` sums `credits`, so the charge is invisible to our ledger and to the cap.

## Evidence
Read from the code; no recorded instance — every recorded job returned an output. The charge-after-download ordering is visible at `jobs.js:57-59`: `log.calls.push({... credits: t.credits ...})` runs only after `fn()` returns, and `fn()` is what performs the download.

## Done when
A completed job with an empty `downloads` array raises a named error identifying the job, the credits charged are recorded in `log.calls` regardless of whether the download succeeded, and the ledger reflects them.
