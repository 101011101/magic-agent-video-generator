# G-002 — Drift from chained edits
**Status:** open
**Cost:** 0
**Blocked by:** R-001

## Problem
Each edit re-renders the whole frame. A frame many hops from its plate drifts, and retrieval of the latest frame inherits all of it.

## Done when
R-001 reports `hops` per frame and a drift measure (e.g. SSIM of the static parts against the plate); a re-anchor rule is designed if drift is visible.

## Evidence (R-001)
`runs/goldilocks-v1/frames/s8-a2.png` (hops 5: plate → s2 → s3 → s4 → s8-a1 → s8-a2) is framed tighter and warmer than `s4-a1.png` (hops 3). Rooms at hops ≤ 3 look stable.
