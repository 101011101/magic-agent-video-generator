# A-003 — Observed ground plans from plates
**Status:** open
**Cost:** 0 (LLM vision only)
**Blocked by:** A-002

## Problem
The sequencer composes slides from its own idea of a place, not from what the plate shows (PRD-seed §3).

## Done when
Each plate is read by vision into `{ camera, items[], light }`, stored on the place as `observed`, and shown on the slideshow page beside the plate.
