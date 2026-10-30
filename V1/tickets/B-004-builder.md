# B-004 — Keyframe builder (edit loop, 1 + k → 1 + 1)
**Status:** done
**Cost:** 200 per attempt
**Blocked by:** B-002, B-003, B-005

## Problem
A slide's frame must be made by editing its base with the roots of what is missing, keeping everything else (PRD §5 S4).

## Done when
`src/builder.js` computes add/remove/keep, makes the edit, verifies, retries at most twice (building on a partial success), keeps the best attempt and records the frame with its lineage.
