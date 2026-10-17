# A-001 — Cast call with user assets attached
**Status:** open
**Cost:** 0 (LLM only)
**Blocked by:** none

## Problem
The cast (entities, places) is decided by text only; a user's photo cannot be the source of a place or a character (PRD-seed §2 A1).

## Done when
Cases accept `uploads: [{ file, note }]`; one LLM call sees the images and returns entities and places with `source: "upload:N" | ""` and an intended ground plan per place. Test case: `kitchen-cat` with `cases/uploads/kitchen.jpg` (stand-in photo: the goldilocks-v1 dining-room root, downscaled).
