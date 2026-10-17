# SM-202 — Anchors are keyed on physical size, not on the need to preserve identity
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Anchor creation follows the scale-partner rule — a small prop is drawn in its partner's hand so its real size is fixed (`prod/pipeline-state-graph/src/controller.js`, `isSmall`). Size is the only trigger. `01-types.md` ties anchoring to bindings — "Every condition on that entity must trace back to the same binding through pass-through links" — and says nothing about how big the entity is. A person-sized object whose identity is a condition gets no anchor and no root, and drifts.

## Evidence
In `p4-lighthouse-fixed30`, exactly **one anchor was created**: `shell`, partner `keeper`. The `beacon` is person-sized, so `isSmall` is false, so it never received one — and it failed identity verification twice in that same run: `beacon identity differs: Opaque cylinder lacks large circular optical lens` (beat 3) and `beacon identity differs: Missing large optical lens` (beat 4). The `lighthouse`, the title object of the film, likewise has no anchor.

## Done when
Every bound entity whose identity is a condition gets an anchor, with the scale partner retained as an additional reason rather than the only one. A replay over the recorded runs lists which entities would newly receive anchors and what that would have cost.
