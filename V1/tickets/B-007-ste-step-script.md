# B-007 — Story → ASD-STE100 step script → slides
**Status:** done
**Cost:** 0 (LLM only)
**Blocked by:** none

## Problem
The v1 sequencer wrote slides directly from the prompt. It skipped exits and entries (the teleport into clip 12), left acting unwritten (the smile while fleeing, V-008), placed moves across items (clip 3 through the table, V-003), and merged changes that happen at different times.

## Done when
Prompt → prose story → STE step script (one change per step; cast with where and acting; waypoints; exit/entry) → one slide per step, with deterministic lint and one rewrite. The builder writes position and acting into the edit; the verifier checks them; the motion director reads the step text. v1 prompts are unchanged (v1 re-runs fully cached, verified).

## Evidence (goldilocks-v2 estimate)
24 steps; Goldilocks exits and enters between rooms (steps 4–5, 10–11, 22–23) and flees on screen (21–24). The first draft used `time_jump` to dodge exits; the lint now allows a time jump only for a character absent from the previous step. Story follows the classic ending after the "best-known version" rule (the first draft had the bears forgive her).
Open: at the 24-step limit the opening (bears leave, Goldilocks arrives) was dropped.
