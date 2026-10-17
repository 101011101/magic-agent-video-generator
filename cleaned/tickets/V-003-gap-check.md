# V-003 — Gap check before a connected clip
**Status:** open
**Cost:** 0 (vision) + a mid keyframe when split (200)
**Blocked by:** V-002

## Problem
Lineage says two frames share a place and camera; it does not say the motion between them fits in 5 s. A big change makes a model morph.

## Done when
A vision call rates each connected gap (small / large / impossible); large → insert a mid keyframe or lengthen the clip; impossible → cut.
