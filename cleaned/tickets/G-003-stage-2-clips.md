# G-003 — Stage 2: clips between keyframes
**Status:** open
**Cost:** ≈ 96 per second of video (wan-3.0 720p)
**Blocked by:** R-001

## Problem
The slideshow is stage 1. Clips must be made from keyframes, with an end frame only where the gap holds a state change or a new entity.

## Done when
A clip stage takes each slide as a start frame, uses the next `continues` slide as its end frame, and stitches the result.
