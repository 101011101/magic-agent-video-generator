# PRD-007 — vision.md open gaps are unresolved
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Nine open gaps sit at the bottom of the vision doc. Several are load-bearing for the MVP: which tools are in scope, which fields are rigid by default, and how the goal is parsed. "JEV", the named selection method, is undefined.

## Evidence
- `current/docs/vision.md:105-114` — the nine gaps.
- `vision.md:111` — "Selection method: 'JEV' is not defined yet."
- `vision.md:108` — "Which fields are rigid by default when the user does not mention them?" This is unanswered while both pipelines already treat values as rigid or fluid in practice.

## Done when
Each gap is answered or explicitly deferred with a reason, and no gap that the MVP depends on is left open.
