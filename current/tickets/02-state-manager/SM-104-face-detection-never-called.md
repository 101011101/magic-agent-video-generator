# SM-104 — `/v1/face-detection` never called; uploads become identity anchors unvalidated
**Status:** in-progress
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** SM-100

## Problem
`/v1/face-detection` exists in the API and is called nowhere in `current/prod`. In B, an uploaded file is copied verbatim and registered as the entity's identity anchor with no face check, no crop, no resolution gate. A full-body source photo whose face occupies a few dozen pixels becomes the reference for every subsequent frame of the film, and nothing notices.

This is the user's architectural point in concrete form: identity is a tracked property, face-detection is the tool that supplies it, and a state-driven selector would have reached for it. No selector exists (SM-100), so it was never considered.

## Evidence
`grep -rn "face-detection" current/prod` — zero hits. `DIAGNOSIS.md` already lists "clean references isolated from frames where the entity is small" under Suspicions, and A carries 11 recorded `identity` faults. The upload path is exercised by exactly one recorded case (`p1-grandma`), a clean front-facing portrait, so the failure mode has never been tested.

## Done when
An upload used as an identity anchor passes a face check (face present, exactly one where the entity is a character, face box above a minimum fraction of the frame), or the run records why it was accepted without one. A full-body photo with a small face is rejected or cropped rather than silently adopted.
