# Approach 1 — keyframe chain (draft PRD, 2026-10-29)

> The approach of PRD-v4: every moment of a scene is painted as a still before any video exists, each still an edit of the one
> before it, and video fills the gaps between consecutive stills. Kept here as the reference design and for what it proved.
> Scripts: `experiments/keyframes.mjs`, `chain-prompts.mjs`, `chain-run.mjs`, `chain-video.mjs`, `fact-chain.mjs`.

## 1. Pipeline

```
prompt → story → screenplay (scenes; action lines) → keyframes per scene (one resting state per action, first frame in full)
      → state manager (code): image 1 = plate or latest frame of the place; a sheet for whoever enters; later frames = previous frame
      → image editor, one call per keyframe → clips between consecutive keyframes (image-to-video, start and end pinned) → stitch
```

## 2. What it is good at (measured)

- **Exact states.** A keyframe is a checkable still: counts, who holds what, what is open. The bakery scene 2 (4 frames) and
  scene 1 (2 frames) came out as written, every state, same man, same room, SSIM 0.85–0.97 between consecutive frames.
- **Pinned motion.** Clips between two keyframes start and end on them (SSIM 0.96–0.99), so the film never drifts away from the
  stills; what the model invents is only the motion between.
- **Props with state** (dough → loaf → in the oven → door closed) are its natural case: the state is in the picture, not in words.

## 3. What it is bad at (measured)

- **Identity in an edit chain.** An element's look comes from the previous frame; once a frame goes wrong, every frame after it
  inherits the fault (Vanderbilt: the handshake frame put Stanton in Vanderbilt's place and the two frames built on it kept it).
  Portraits were attached only when someone entered, never when the frame was re-edited.
- **Holding states.** When keyframes are chosen by a budget rather than by actions, they land on mid-air states (loaf in hand
  beside an oven that was closed a frame earlier) and the gaps hide two or three actions; the clips between then look like cuts.
- **Dialogue.** A line is not a state; folding lines into the frame they are spoken over is right, but a scene that is mostly
  talk yields two keyframes and one long clip, which is approach 2.
- **Cost and time.** 200 per still plus 480 per 5-second clip; a 7-second scene became 15 seconds of video because the clip
  minimum is 5 s and three gaps were painted.

## 4. Rules (kept)

- One keyframe per action in the story's own words, written as the resting state that results, with counts and positions
  (who stands where, facing whom; nobody crosses anyone unless the text says so).
- The first frame says only what goes into the plate; the plate carries the room.
- Specs describe invariants; state belongs to keyframes. Medium is the noun of every prompt and says colour or monochrome.
- A keyframe is checked against the portraits (identity) and against its text (state) before anything is built on it.

## 5. When to use it

Scenes where an object's state must be exact at known moments, or where a single moment must be reproduced to the pixel
(a hand-off, a reveal). Elsewhere, approach 2.
