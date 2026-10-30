# PRD-008 — vision.md proposals are unconfirmed but already implemented
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Five proposals are marked "not yet confirmed". At least one is already relied on by the design and by the cost argument: the split between deterministic tools (exact, free) and generative tools (probabilistic, paid). Treating an unconfirmed proposal as settled is how the PRD and the code drift apart.

## Evidence
- `current/docs/vision.md:115-120` — "Proposals not yet confirmed", five items.
- `vision.md:120` — the deterministic/generative split, which `05-solver.md:59-62` already builds on.
- `current/docs/subsystems/01-types.md` and `architecture.md` now state deterministic extraction is preferred, which depends on this proposal being true.

## Done when
Each of the five is confirmed or rejected, and anything the docs already depend on is promoted out of the proposal list.
