# B-010 — Framing gate: reject whole-picture re-paints
**Status:** done (code); first used in R-005
**Cost:** 0 (ffmpeg)
**Blocked by:** none

## Problem
custom-rrh1 accepted two edits that re-painted the whole picture: slide 3 (SSIM 0.09 to its base; full-bleed → painted edge) and slide 11 (SSIM 0.46; zoomed in, painted edge → cream rectangle). Every later frame at the place inherited the new framing. The verifier never looks at framing.

## Done when
Every blocking-slide edit is compared with its base: whole-frame SSIM < 0.70 or a corner-brightness shift ≥ 10 is a fault ("framing changed"). Calibrated on all 38 rrh1 edits: normal edits 0.78–0.98; re-paints 0.08–0.61. Also: "film still" / "16:9" are dropped from the style in plates and edits (they push full-bleed), and the edit prompt says "same zoom, same crop, same edges and border". Code: `clips.js` `framing()`, `builder.js`.
