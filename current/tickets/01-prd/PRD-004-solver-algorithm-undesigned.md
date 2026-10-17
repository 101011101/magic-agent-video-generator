# PRD-004 — Solver: search algorithm and output format not designed
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The solver's core loop is decided but its search algorithm and output format are not. Nine questions are open. The only implementation (`prod/state-manager`) was superseded after 19 defects, and neither live pipeline contains a solver.

## Evidence
- `current/docs/subsystems/05-solver.md:3` — "Search algorithm and output format not designed."
- `05-solver.md:91-100` — nine unanswered questions, including "What algorithm does the backward search use" and "What format does the ordering use".
- `current/prod/state-manager/DIAGNOSIS.md` — 19 confirmed defects; pipeline v2 dropped the solver entirely.

## Done when
The search algorithm is specified, the ordering format is specified, and the PRD states whether the solver is still in the MVP given that no live pipeline uses one.
