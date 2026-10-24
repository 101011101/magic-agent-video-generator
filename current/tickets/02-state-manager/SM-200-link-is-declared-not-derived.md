# SM-200 — `link` is a free variable the state already determines, so the timeline can contradict itself
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`01-types.md` states "Scenes are state machines." In a state machine the transition follows from the states. In the timeline schema (`prod/pipeline-state-graph/src/timeline.js:20`) `link` is an independent enum the LLM declares, so it can assert a transition that its own start and end states contradict.

A `cut` whose start state equals the previous end state in the same location is not a cut. The pipeline pays for a fresh keyframe of a picture it already has, and the clip has nothing left to do.

## Evidence
Over 29 beat boundaries in five recorded runs, the predicate *start(N+1) equals end(N) on description, framing, entities and location* separates `continuous` from `cut` in **28 of 29**. The exception is `p4-lighthouse-fixed30` b3→b4: all four equal, `link: "cut"`, same location `tower`, and the two descriptions are byte-identical —

> "The keeper holds the beacon's glass door open while the shell glows against her chest and the ships remain close to the reef."

That beat cost 200 credits to regenerate an identical picture, and the seam gate then reported `cut did not cut (0.787 >= 0.5): the two shots still look alike` — after the spend.

## Done when
`link` is derived from the state comparison, or the timeline is linted before any generation so that a declared `cut` whose start equals the previous end in an unchanged location is rejected or merged. Re-running the check above over every recorded run reports 0 contradictions, and a synthetic contradicting timeline is rejected before the first paid call.
