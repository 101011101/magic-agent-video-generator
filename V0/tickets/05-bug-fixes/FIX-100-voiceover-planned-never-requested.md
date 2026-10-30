# FIX-100 — Voiceover path is fully wired and has never fired
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
B's audio agent implements TTS end to end: `storyboard.js` emits an `audio.voiceover[]` array, `audio.js:61-62` turns each line into a cue, `audio.js:130-150` posts to `/v1/ai-voice-generator`, and `audio.js:169` mixes the result. The planner has never produced a single voiceover line, so none of it has ever run.

This corrects an earlier claim that `ai-voice-generator` is "unused while the storyboard emits a voiceover array that is never rendered". The renderer exists and is correct as far as can be told; the **planner** never asks for voiceover.

## Evidence
`plan.audio.voiceover` has length **0** in all four recorded runs (`p4-lighthouse-v1`, `p4-lighthouse-v2-30s`, `d1-desert-tokyo-v1-30s`, `p1-grandma-v1`). `current/tests/pipeline-memory/ledger.json` contains **0** jobs against `/v1/ai-voice-generator` out of 81 total.

## Done when
Either the storyboard prompt is changed so voiceover is produced when the story calls for it and one run exercises the path end to end, or the schema field is removed. An entire paid code path that has never executed is untested code, not a feature.
