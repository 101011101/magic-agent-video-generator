# A-004 — Sequencer plans against observed ground plans
**Status:** open
**Cost:** 0
**Blocked by:** A-003

## Problem
Slide compositions and changes do not have to name real items of the place, so a change can target an item the place does not have.

## Done when
The sequencer becomes two calls (cast in A-001, then slides with the observed plans), `shows` and `change` name plan items, the builder's edit prompt carries the plan, and a check flags any change whose item is not in the plan.
