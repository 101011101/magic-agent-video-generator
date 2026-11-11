# PRD-022 — `kind` is a property of an entity, but a location is routinely also a visible object
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Every entity carries one `kind` of `character | prop | location` (`01-types.md`; schema in `prod/pipeline-state-graph/src/timeline.js:17`). `kind` decides whether the entity gets an anchor, how it is versioned, and whether `want()` lists it at all (`src/graph.js:52` excludes the beat's own location). A thing that is both a place and a visible object gets one treatment for both roles.

## Evidence
In `p4-lighthouse-fixed30`, `lighthouse` and `reef` are `kind: location` and appear as objects in frame in **6 of 6 beats** while the beat's own location is `beach`, `cottage` or `tower`. The lighthouse is the title object of the film: a setting in three beats, a distant object in six, with no anchor and no identity treatment in the second role.

## Done when
Role is a property of an entity within a beat rather than of the entity, so the same binding can be the setting in one beat and a tracked visible object in another, and receives the object treatment (anchor, identity condition) when it is one.
