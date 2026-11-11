# HUNT-203 — Pipeline A never invalidates its upload cache; pipeline B does
**Status:** open
**Category:** 04-bug-hunting
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/src/jobs.js:29` — `forget(f) { delete this.hashes[f]; }`
`pipeline-memory/src/common.js:56` — `touch(f) { delete this.hashes[f]; delete this.upCache[f]; }`

Pipeline A clears the content hash but keeps the uploaded-URL cache (`jobs.js:64`), keyed on filename. If a filename is ever rewritten within a run and then used as a job input, A uploads the old bytes' URL. B guards against exactly this.

## Evidence
No current collision: within one run every generated filename is unique per beat and per attempt (`b{n}-start-a{k}.png`, `b{n}-last.png`, `anchor-{id}-a{k}.png`). `jobs.forget(to)` is called after the take-to-final copies at `controller.js`, which suggests the author expected rewrites. Latent, not live — hence a hunt.

## Done when
Either a filename rewritten mid-run is shown to be impossible by construction, or `forget()` clears `upCache` as B's `touch()` does.
