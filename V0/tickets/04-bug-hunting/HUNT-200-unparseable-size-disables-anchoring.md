# HUNT-200 — Does an unparseable `size` string silently disable a prop's anchor?
**Status:** open
**Category:** 04-bug-hunting
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/src/controller.js:124` gates anchoring on `cm(e.size) > 0 && cm(e.size) <= 30`. If `cm()` cannot parse the LLM's free-text size, it returns 0 and the prop is treated as "not small" — so it gets no scale anchor, silently, by the same branch that excludes a wardrobe or a lighthouse.

A parse failure and a genuinely large prop are indistinguishable in the result.

## Evidence
None observed — every recorded `size` string in the four runs parsed. This is a hunt: read `cm()` in `src/prompts.js`, enumerate the shapes the storyboard and timeline prompts actually invite ("as tall as a person", "4 cm, fits in a cupped palm", "a 1.5 m wooden table"), and determine which return 0.

## Done when
Every size string present in the recorded plans is run through `cm()` and the failures listed; if any parse to 0 while describing a hand-sized object, it becomes a FIX ticket.
