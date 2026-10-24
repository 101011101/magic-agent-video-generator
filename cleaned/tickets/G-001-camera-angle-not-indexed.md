# G-001 — Frames are not indexed by camera angle
**Status:** open
**Cost:** 0
**Blocked by:** R-001

## Problem
`baseFor()` picks by location and presence only. A slide that needs another angle of the room must re-render the room from a frame shot from a different angle, which breaks "keep everything else the same".

## Done when
Frames carry a framing tag (wide, medium, close; front, reverse, side), retrieval prefers a matching tag, and locations can hold more than one plate.
