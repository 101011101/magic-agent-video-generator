# B-003 — Presence tracker and base retrieval
**Status:** done
**Cost:** 0
**Blocked by:** none

## Problem
Frames must be indexed by location and entities present only, and the base for a slide must be chosen deterministically (PRD §5 S3).

## Done when
`src/tracker.js` stores frames in `tracker.json` and `baseFor()` returns: the previous frame for `continues`, otherwise the latest accepted frame at the location (the plate on a first visit).
