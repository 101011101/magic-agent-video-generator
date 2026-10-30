# FIX-200 — A continuous→cut downgrade reuses the continuous start description, producing a duplicate shot
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/src/controller.js:106` downgrades a beat from `continuous` to `cut` when the previous clip's last frame lacks a needed entity: `beat.link_planned = "continuous"; beat.link = "cut";`. Nothing touches `beat.start.description`.

In a continuous beat, `start.description` is written to mean "carry straight on from the previous frame" and is by construction near-identical to the previous beat's `end.description`. Under a cut it is rendered verbatim by `prompts.js:23` as the description of a frame to draw fresh — so the cut redraws the moment the previous shot already ended on.

This is the real cause of the repeated shot in `p4-lighthouse-fixed30`, and it is **not** a planner fault: the planner emitted `continuous`, which was correct.

## Evidence
`current/tests/pipeline-state-graph/runs/p4-lighthouse-fixed30/run.json`:
- `timeline.beats[3]` carries `link: "cut"` **and** `link_planned: "continuous"` — the downgrade fired.
- `beats[2].end.description` and `beats[3].start.description` are byte-identical: *"The keeper holds the beacon's glass door open while the shell glows against her chest and the ships remain close to the reef."*
- `measures.joins` b3→b4: `seam_ssim 0.787`, `pass: false`, fault `"cut did not cut (0.787 ≥ 0.5): the two shots still look alike"`.
- Cost of the duplicate: one keyframe (200) plus one 5 s clip (480).

## Done when
A beat downgraded from `continuous` to `cut` either (a) has its start description re-derived for a fresh frame, or (b) is merged into the previous beat; and a re-run of `p4-lighthouse --count 6` produces no join whose `seam_ssim ≥ 0.5` on a `cut`.
