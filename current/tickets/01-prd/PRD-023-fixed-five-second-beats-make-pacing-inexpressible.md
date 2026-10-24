# PRD-023 — Beat duration is fixed at five seconds, so pacing cannot be expressed
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`seconds: { type: "integer", enum: [5] }` in both pipelines — `prod/pipeline-state-graph/src/timeline.js:20` and `prod/pipeline-memory/src/storyboard.js:14`. A 1.5-second reaction cut and a 12-second hold are unrepresentable. Pacing is the primary expressive device of editing, and no correct implementation can produce a varied cut while the representation forbids it.

## Evidence
Both schema lines above. The repo's own research cannot be applied because of them: `current/research/oneshot-video-generators.md` records an average shot length of about 2.5 s in practice and recommends cutting on action and over-generating then trimming.

## Done when
Duration is a free parameter per beat, bounded by the selected video model's supported range, and the timeline prompt asks for pacing rather than a fixed count of equal beats.
