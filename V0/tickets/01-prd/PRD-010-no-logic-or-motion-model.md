# PRD-010 — The PRD has no model for motion, action or temporal logic
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** PRD-006

## Problem
Every atom and condition in the PRD is a property of a single still state. Nothing in the type model expresses "the subject moves up the stairs", "the lamp ignites during this clip" or the order of two events. The product is video; the type system describes frames.

## Evidence
- `current/docs/subsystems/01-types.md:38-49` — the state model is "a set of conditions", each true or false against a desired state. No temporal operator.
- `01-types.md:84` — "An image is a single frame: entities, world, composition and look, without time, sound or editing." Time is named as absent and never reintroduced for clips.
- `current/prod/pipeline-state-graph/src/verify.js:9-10` — the implementation mirrors this: HARD and SOFT are eleven static frame properties.
- Recorded fault histogram across all A runs: position 43, size 24, pose 24, identity 11, interaction 6, place 4, condition 3, wardrobe 1, **motion/action 0** — no check exists that could fail on motion.

## Done when
The type model defines how a change over time is expressed as a condition, so that a tool can be given hard credit for performing an action and a verifier can fail it.
