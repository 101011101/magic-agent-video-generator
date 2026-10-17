# R-003 — Paid run: Goldilocks film
**Status:** done
**Cost:** 5,760 (12 × 5 s, wan-3.0 720p) + retakes
**Blocked by:** none (run approved with CLEANED_CAP=11000)

## Problem
The full film has not been made.

## Done when
`node cleaned/run.mjs --case goldilocks --label v1 --video` with `CLEANED_CAP≈11000` produces `final.mp4`; QA per clip is recorded here.

## Result (goldilocks-v1, 4,800 new credits; 9,760 total with slides; 25 min)
- `runs/goldilocks-v1/final.mp4`: 12 clips, 59.8 s, 1280×720, no audio. Page: `runs/goldilocks-v1/film.html`.
- Connected clips (2, 3, 5, 10): first ≈ start 0.994–0.995, last ≈ end 0.984–0.990. Seams are invisible.
- Cut clips: first ≈ start 0.994–0.995; last ≈ start 0.819–0.979. Low values mix real motion (clip 12: Goldilocks runs up to the camera, 0.87) with invention (clip 8: the cold fireplace is lit, 0.819). SSIM alone cannot tell them apart → V-006 needs a vision check on the last frame, not a threshold.
- Story reads end to end; the room states (empty bowl, broken chair, girl in the small bed) hold across clips.
