# V-009 — Audio: narration, ambience and effects
**Status:** open
**Cost:** narration ≈ 120 (AI Voice Generator, 0.1 credit/char, ~1,100 chars of captions); ambience/sfx free on wan-3.0 but only on clips rendered with `audio: true`
**Blocked by:** none

## Problem
The film is silent: clips were made with `audio: false`.

## Done when
(1) Narration: one TTS call per caption, placed at its clip's start, with clip lengths fitted to the narration (wan-3.0 allows 2–10 s). (2) Ambience and effects: each new clip renders with `audio: true` and a "Sound:" line in its prompt from the slide (place ambience + the change's sound, e.g. "a wooden chair cracks"), no music, no speech. (3) Mix: levelled clip audio ducked under narration (reuse the loudness two-pass from `current/prod/pipeline-memory/src/audio.js`). Music: no Magic Hour endpoint; a licensed track file or none.
