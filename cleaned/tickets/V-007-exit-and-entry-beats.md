# V-007 — Exit and entry beats when a character changes place
**Status:** open
**Cost:** 0 (sequencer rule) + 1–3 keyframes and clips per move
**Blocked by:** none

## Problem
Clip 11 ends with Goldilocks in bed; clip 12 starts with her already halfway down the outside path. The cut skips the exit (out of bed, out of the house) and the entry (door opens, she bursts out), so she appears to teleport.

## Done when
The sequencer adds, for any on-screen move between places: an exit slide in place A (she reaches the door/window) and an entry slide in place B (the door swings open, she is in the doorway), with the run in place B as a connected chain (doorway → mid-path → leaving frame).
