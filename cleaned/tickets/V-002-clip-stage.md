# V-002 — Clip stage: motion prompt, image-to-video, QA, stitch
**Status:** in-progress
**Cost:** 480 per 5 s clip (wan-3.0 720p)
**Blocked by:** V-001

## Problem
Stage 2 of the pipeline (PRD-video §2–3).

## Done when
`--video` makes one clip per slide (end frame for connected), records SSIM QA per clip, and stitches `final.mp4` once all exist; the page shows the film and each clip with its inputs.

## Probe (goldilocks-v1, clips 2 and 8, 960 credits, ~2.5 min each)
- Clip 2 (connected 2 → 3): first ≈ start SSIM 0.994, last ≈ end 0.990. Clean, but little motion: slides 2 and 3 are nearly the same frame (R-001 noted slide 3 as a wasted keyframe).
- Clip 8 (cut, start frame only): first ≈ start 0.995. The model **lit the fireplace**, which is cold in the keyframe, and shifted Papa Bear's vest. SSIM of the first frame cannot see this → V-006.
- Stitch not run (only 2 of 12 clips exist).
