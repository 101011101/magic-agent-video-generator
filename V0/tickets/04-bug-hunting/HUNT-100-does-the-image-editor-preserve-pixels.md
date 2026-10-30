# HUNT-100 — Measure whether `ai-image-editor` preserves the reference or redraws it
**Status:** open
**Category:** 04-bug-hunting
**Cost:** see 03-tests
**Approval:** required-not-given
**Blocked by:** none

## Problem
SM-102 asserts that feeding a reference to `/v1/ai-image-editor` regenerates every pixel rather than carrying the original through. That claim rests on a secondary source, not on our own measurement.

## Evidence
None of ours. `current/research/multishot-video-practice.md` cites FLUX Kontext as having measured compounding drift in chained instruction edits, and recommends mask inpainting plus paste-back. We have not measured our own editor. This is a hunt, not a fix.

## Done when
A measurement exists: take one accepted frame, edit it with a change that should touch only one region, and report per-region difference between source and output. If untouched regions change materially, SM-102's premise is confirmed and the paste-back path is justified; if they do not, SM-102 should be rewritten.
