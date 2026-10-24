# PRD-009 — Post-MVP items are now load-bearing
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Order, clobbering, confidence and verification were deferred on the assumption that tool specs are good enough. The recorded runs show that assumption is false: later tools routinely break conditions earlier tools made true, which is precisely the clobbering case that was deferred.

## Evidence
- `current/docs/post-mvp.md:5-9` — order and clobbering deferred; "A later tool can break a condition that an earlier tool made true. Example: an image-to-video tool drifts the face."
- `current/tests/pipeline-memory/runs/p4-lighthouse-v2-30s/run.json` — judge records identity drift in tower shots 3-4 after a cut.
- `current/docs/vision.md:102` — "MVP first. Add the checker later, for production."

## Done when
The PRD records whether clobbering and verification stay deferred given this evidence, and if they stay deferred, what the MVP does when a condition is clobbered.
