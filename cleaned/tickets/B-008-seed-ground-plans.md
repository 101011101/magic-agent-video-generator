# B-008 — Seed: canonical ground plans and verified plates (S0)
**Status:** in-progress
**Cost:** ≈ 200 per plate try (≤ 3 per place); LLM otherwise
**Blocked by:** none

## Problem
G-005: the first frame of a place is painted from prose nobody checks, so the start state can be inconsistent (a bed's head at the wrong end, doors that lead nowhere) and every later frame inherits it.

## Done when
After the story, one LLM pass writes a ground plan per place: camera, marks (items and directed parts such as `bed.head`, in camera terms, sizes, facing, `key` for marks the story needs), doors and where they lead, and character scale. The plate is painted from the plan; a vision pass asks one focused question per mark; a missing or misplaced key mark regenerates the plate (≤ 3 tries, with the misses as a note). The observed answers become the canonical marks (the picture wins). The seed is used only here: later frames carry the state. Page shows every plate try and the marks table (intended vs canonical).
Code: `src/seed.js`, `run.mjs` (`--first-frames` builds only the first slide of each place). Supersedes A-003 for generated places.
