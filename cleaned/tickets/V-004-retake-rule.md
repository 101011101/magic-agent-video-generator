# V-004 — Retake on failed clip QA
**Status:** open
**Cost:** one clip per retake
**Blocked by:** V-002

## Problem
A clip whose first or last frame does not match its keyframe is kept anyway.

## Done when
Thresholds are set from the probe data (first ≥ 0.9; last ≥ 0.9 for connected), one retake with a stricter prompt is allowed, and the better take is kept.
