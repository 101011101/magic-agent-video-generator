# HUNT-201 — A story with no characters gets no scale anchors at all
**Status:** open
**Category:** 04-bug-hunting
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/src/controller.js:127` resolves the scale partner as a character the prop interacts with, else any character in the frame; with neither it records `anchor-skipped: "no scale partner (character) in this frame"` and returns `null`.

A pure-landscape film, or any beat whose props are alone in frame, therefore has no anchored prop and no absolute scale reference anywhere. `pipeline-memory/src/keyframes.js:44-48` has a non-character fallback ("shown in its natural setting … with the scene for scale"); pipeline A has none.

## Evidence
No recorded run lacks a character, so the path is unexercised. The asymmetry between the two pipelines is the signal.

## Done when
Either pipeline A gains a non-character scale reference, or the absence of one is a stated limitation with the beat marked unanchorable on the record.
