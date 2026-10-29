# Testing to do (2026-10-29)

Two paths after the Vanderbilt runs (`runs/exp-vanderbilt2`, pages linked in the session). Each test names its cost (Magic Hour
credits; text is OpenAI and not metered here), what it measures and the number it produces, so the next decision is made on
evidence. Nothing here is built yet.

## Path A: clips, and how they join

A1. **One pass per scene at the scene's length.** Repeat scene 2 one-pass (text-to-video, @references, whole scene in words) on
    wan-3.0 at 20 s (five lines need ~20 s) and on seedance-2.5 at 20 s. Measure: lines heard (transcription), first frame vs
    @key1 (SSIM), identity swaps (vision check per 2 s: who shakes hands), caption rendered. Cost: 1,920 (wan) + ~6,700
    (seedance-2.5 at 720p: 336/s; or 480p at 168/s = 3,360).
A2. **Clip-to-clip join inside one scene.** Make scene 2 as two one-pass clips (0–10 s, 10–20 s) where clip 2 starts from the
    last frame of clip 1 (image-to-video, start pinned) with the second half of the text. Measure: the seam (SSIM of clip 2's
    first frame vs clip 1's last; the eye test on the stitched file), identity across the seam. Cost: 2 × 960.
A3. **Cut every ~10 s with a change of shot size.** Same as A2 but clip 2 is framed as a medium shot of the speakers (text asks
    for it; or crop the start frame 1.3× before image-to-video). Measure: does the seam read as a cut rather than a jump? Film
    grammar says a cut between near-identical framings is a jump cut and a change of size or angle (30-degree rule) hides it.
    Cost: 2 × 960.
A4. **Seam fillers.** On A2's seam, try (a) a 6-frame dissolve, (b) a cut to a 1-second insert (the caption card, a prop detail
    from the bank) between the two clips, (c) nothing. Measure: eye test only; cost 0 (ffmpeg).
A5. **Length of a scene.** From the timed AV script, the bakery's scenes are 3–7 s and Vanderbilt's two are ~10 and ~20 s. Record
    for each clip model the shortest and longest it accepts (wan 2–30, seedance-2.5 4–30, veo 4–56, ltx 1–60) and the cost per
    second, and pick a default: one clip per scene, scene length from the script, split at a cut when the scene is longer than
    the model's maximum or than 15 s.

## Path B: keyframe accuracy

B1. **Keyframe vs reference.** For each painted keyframe, the identity check against the bank portrait (vision call: same
    person?) and the state check against its text (counts, who holds what, positions). Run on vanderbilt2 scenes 1–2 (6 frames).
    Cost: 0 (text calls).
B2. **Pinned pairs where it matters.** Scene 2 as: one-pass clip for the staging (A1) but with the handshake and the hand-off
    made as pinned start→end clips, cut in. Measure: swaps (none expected on the pinned parts), seams. Cost: ~2,900.
B3. **Treatment control.** Regenerate the two plates with the treatment sentence first and a colour style reference, and a
    first frame onto the period White House photograph with "image 1 gives the place only; take colour and grain from image 4".
    Measure: colour vs sepia (vision call), SSIM of frame 1 to the photo. Cost: 3 × 200.
B4. **Reference pick.** Add to the pick prompt: reject stereograph cards, mounts, text, two-up images; prefer a single clean
    view; crop to the image when a mount is detected (code). Measure on the Vanderbilt bank. Cost: 0.
B5. **Burned-in text.** Add "no captions, no titles, no text" to every frame prompt and a vision check for text; measure on
    scene 1 frame 1. Cost: 200 on a repaint.

## State tracking with clips (design, not a test)

- The **bank** is made once, before any frame: a portrait or sheet per character, a plate per place, and it is the identity
  reference for the whole film. Faces and clothes do not change, so the bank is always the right reference for *who*.
- **What changes is tracked as text**: the state table holds every transformation (loaf baked, loaf wrapped, who holds what,
  who is present, where they stand). The clip prompt for any later scene says the current state in words; nothing has to be
  cut out of a video.
- **The last frame of a scene's clip is the environment's state image** for the next scene in the same place (the plate plus
  everything that changed), exactly as the chain used the previous frame. It is extracted by code (ffmpeg, as `check()` does
  now). If a changed prop is not visible in that frame, its state is still in the text, and the bank gives its invariant look.
- A reference is never extracted from the middle of a clip. If a mid-scene state must be exact (the handshake), that moment is
  a pinned keyframe (B2), and the keyframe is the reference.
- So the state manager keeps, per element: bank reference (fixed), current state (text, updated per transformation), last
  scene it appeared in; per place: plate, last frame of its latest scene. That is the whole table.

## Reminder (asked 2026-10-29, not to be done mid-run)

S1. **Is a very specific screenplay adaptation useful?** Test a screenplay call that writes the operational detail into the
    screenplay itself (shot-level: time, framing, who is where, what the camera sees) against the current three-document
    split (screenplay → shot list → still prompts). Measure on the same story: fewer undeclared mentions, fewer side swaps,
    fewer still retries, and whether the film reads the same. Decide only after the vanderbilt3 end-to-end run is reviewed.
