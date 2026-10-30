# B-001 — Sequencer: prompt → slide plan
**Status:** done
**Cost:** 0 (LLM only)
**Blocked by:** none

## Problem
The pipeline needs a plan: style, entities, locations and ordered slides with presence, composition, changes and continuity (PRD §5 S1).

## Done when
`src/sequencer.js` returns a schema-valid `plan.json` for a one-line prompt, and the plan follows the fixture, group and change rules.
