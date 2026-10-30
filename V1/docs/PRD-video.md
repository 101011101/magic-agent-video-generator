# PRD — Stage 2: clips between keyframes

> The slideshow (stage 1) holds every frame's content. Stage 2 adds motion. Code: `src/links.js`, `src/motion.js`,
> `src/film.js`, `src/clips.js`. Run: `node cleaned/run.mjs --case <id> --label <l> --video [--clips 2,8]`. Tickets: `tickets/V-*`.

## 1. Thesis

- A video model is an interpolator plus a motion prior. Given a start frame (and optionally an end frame) it fills the gap.
- Its errors come from **what it must invent**. A clip that only moves things already in the frame is safe; a clip that must
  introduce a person, change an object or reveal a new part of the room is not.
- So the keyframes decide the content, and the video model decides only the motion. The more the two ends pin, the less it invents.

## 2. The decisions per clip

| Decision | v0 rule | Why |
|---|---|---|
| **Link** (connected or cut) | Derived from lineage: slide k+1 was built by editing slide k → connected; else cut | Same place, same camera, small change = a gap a model can bridge. Not declared by the LLM, so it cannot disagree with the frames |
| **End frame** | Connected: the next slide's frame. Cut: none | Connected seams become exact (clip k ends where clip k+1 starts). A cut needs no end, and pinning one would force a morph |
| **Prompt** | Motion only, written by a vision call that sees the start (and end) frame | The frames carry the look; re-describing it makes the model redraw it |
| **Camera** | Static by default | Keyframes were framed for one camera; a move reveals space nobody drew |
| **Duration** | 5 s | Predictable cost; inside every model's limits |
| **Model** | wan-3.0, 720p | Measured best end-frame match in this repo (first/last SSIM 0.98–0.99, real motion) |
| **Audio** | Off | Each clip's sound would be invented independently and clash at cuts; sound is a later stage |
| **QA** | SSIM of the clip's first frame vs the start keyframe, last frame vs the end keyframe | Cheap, deterministic, catches a model that ignores a frame |
| **Stitch** | Re-encode to 1280×720, 24 fps; at a connected seam drop the repeated first frame | One stream; no doubled frame at a joined seam |

## 3. Flow

```
tracker (stage 1) ──► links: [1 cut] [2 ⟶3] [3 ⟶4] [4 cut] [5 ⟶6] [6 cut] … 
                          │
for each slide k:         ▼
   start = frame k ; end = frame k+1 if connected
   motion  = vision(start, end?) → motion-only prompt + camera
   clip k  = image-to-video(start, end?, prompt, 5 s)
   qa      = SSIM(first, start), SSIM(last, end)
                          ▼
stitch: clips in order; drop frame 0 of a clip that follows a connected seam → final.mp4
```

## 4. Not decided yet (tickets)

- A **gap check** before a connected clip: two frames that are too far apart (big pose or framing change) make a model
  morph instead of move. Then split the gap with a mid keyframe, or cut.
- **Retake rule**: when QA fails (SSIM under a threshold), retry with a stricter prompt or another model.
- **Model per clip**: choose by need (end frame, length, action fidelity) instead of one model for all (RUN-003 in `current/`).
- **Longer connected runs**: one 10–15 s clip through several connected slides (wan-3.0 allows 2–10, 15, 20, 25, 30 s).
- **Cut grammar**: hard cut by default; a crossfade for time jumps.

## 5. Cost

`clips × seconds × rate`. Goldilocks v1, 12 clips × 5 s: wan-3.0 720p (96/s) = **5,760**; kling-3.0 720p (48/s) = 2,880;
seedance-1.5 720p (60/s) = 3,600; veo3.1 720p (96/s) = 5,760.
