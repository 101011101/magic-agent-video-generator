# PRD v4 — story → screenplay → keyframes → chain → clips (draft, 2026-10-28)

> Replaces the grid design of PRD-draft-v3 §6b and the per-slide blocking of PRD.md §S1/S4. Written from what was run on the
> bakery ad on 26–28 Oct (`cleaned/experiments/keyframes.mjs`, `chain-prompts.mjs`, `chain-run.mjs`, `chain-video.mjs`,
> `av-script.mjs`; results in `runs/exp-bakery/page-chain`). Not yet productised: the scripts are experiments, the pipeline
> (`scenes.mjs`) still runs the grid path.

## 1. The pipeline

```
prompt ──► STORY (1 LLM call)            prose; title; medium
      ──► SCREENPLAY (1)                 scenes: slug line, opening paragraph that sets the scene, action paragraphs
                                         (1–3 sentences, present tense, one camera setup each), dialogue, sound notes;
                                         written to the running time (seconds per scene)          ← to build
      ──► KEYFRAMES (1 per scene)        first frame in full = what goes into the plate (people where, doing what; props and
                                         their state); then ONE resting state per action, quoting its source line
      ──► STATE MANAGER (code)           image 1 for frame 1 = the place's plate, or its latest frame; a sheet for anyone not
                                         yet in a frame; every later frame = the previous frame only (+ a sheet for whoever enters)
      ──► KEYFRAME CHAIN (image editor)  frame 1 from plate + sheets; frame k from frame k−1 with its state line
      ──► CLIPS (image-to-video)         one clip per gap: start frame → end frame, sound from the screenplay; stitched
```

Seeds, once per story: one sheet per character and one plate per place, the medium as the noun of the prompt ("A studio
photograph of a real person", "A live-action photograph of an empty place"), one check each (medium, single subject, major miss).

## 2. Why this shape (what the tests settled)

| question | result | where |
|---|---|---|
| Can a grid draw a sequence? | No. Grids hold look (identity, room, camera) and nothing else; order, counts and hand-offs drift from cell 5 on in every variant (text only, slug + bullets, first-and-last anchors, anchor + changes). | exp-bakery pages 2a–2g, x3 |
| What holds identity? | A reference image per person, named by image number. Text alone gives half the spec. | x3-C, chain s1 |
| What holds the room and camera? | The plate as image 1. Text alone gives another room. | regrid, x3-A/D |
| What holds the sequence? | One edit per state from the previous frame. Scene 1 (2 frames) and scene 2 (4 frames): every state as written, SSIM 0.85–0.97 between frames. | page-chain |
| What does the model fill in? | The motion between two keyframes, with sound. Clips start and end on their keyframes (SSIM 0.99). | page-chain, scene 2 video |
| What breaks it? | Keyframes that are holding states, or that hide several actions in one gap (a budget of 3 for 10 beats). Specs that carry a later state (a golden loaf before the oven). A screenplay that invents business (3 story sentences → 11 beats). | §3 |
| Medium word | It must be the noun of the sentence. "Reference sheet of a character… photographic footage" gives figurines; "A storyboard… footage" gives drawings. | S1 test, regrid grid 5 |
| Schemas | A free array can come back empty; one required key per item cannot. | av-script, seed.js |

## 3. Rules for the text stages

- **Screenplay**: standard spec format. Each scene opens with a paragraph that sets the scene (place, who is present, props and
  their state; a character in CAPS on first appearance); then action paragraphs of 1–3 sentences, each one camera setup; only
  what is seen and heard; no camera directions; add nothing the story does not contain; quote the story words each paragraph
  comes from. Given the running time: about one action per 2–3 s, so a 7-second scene has three paragraphs, not ten.
- **Keyframes**: one per action paragraph, written as the **resting state** that results (never mid-air unless the story says
  so), with counts (one loaf left on the rack) and who holds what; the first frame says only what goes into the plate.
- **Specs**: invariants only (shape, size, material, colour); state belongs to the keyframes. Props get one line; only
  characters get sheets.
- **Names**: one unique noun phrase per thing, used every time; no pronouns in anything a model reads for drawing.

## 4. Prompts (templates, no model)

- Frame 1: `Image 1 is the empty place. Image 2 is <name>: same face, hair and clothes; its pose and grey background do not apply.
  Put this moment into image 1, keeping its room, camera, light and colours exactly: <first frame>. <medium sentence> One single frame, no text.`
- Frame k: `Edit image 1. Change ONLY this: <resting state>. Everything not named stays as in image 1. <medium sentence> One single frame, no text.`
  (The line "same people in the same places and poses" contradicted changes that move someone; it is gone.)
- Clip: `Image 1 is the first frame and image 2 the last frame of one continuous shot; the camera does not move. What happens
  between them: <the action paragraphs this gap covers>. Natural motion only; nothing appears that is not in the frames.
  Sound: <ambience>; <sfx>; no voices; no music.`

## 5. Checks

- Framing gate per frame (code): SSIM to the previous frame; the corner-shift metric false-alarmed on a photo (scene 2 frame 3) and
  needs recalibrating for photographic frames.
- Per frame, one vision call: identity against the sheets of the characters present, counts of characters, the state line true?
  A failed frame is remade from the same previous frame (one retry); the chain never continues from a failed frame.
- Clip ends: SSIM of the clip's first/last frame to its keyframes (code).

## 6. Cost and calls (bakery, 30-second ad, 6 scenes)

- Text: story 1, screenplay 1 (+ sound 1), keyframes 6, timing 1 → ≈ 10 LLM calls (was ≈ 150 with the grid path).
- Images: sheets 4 × 200, plates 2 × 200, keyframes ≈ 15–20 × 200 → ≈ 4,000–5,000 credits.
- Video: one clip per gap at 5 s × 96 = 480 → ≈ 12–15 clips ≈ 6,000–7,000 credits. The clip minimum (5 s) is longer than the
  timed script's gaps (2–3 s); the keyframe count per scene must follow the seconds.

## 7. Open

- Build the screenplay call to the format in §3 with the running time; keyframes then equal paragraphs.
- Productise: `keyframes.mjs` + `chain-run.mjs` + `chain-video.mjs` into one `chain.mjs` over all scenes, with the state
  manager picking images across scenes (scene 3 starts from scene 2's last frame; the neighbour's sheet enters in scene 4).
- Timing: seconds per scene from the screenplay; clips shorter than 5 s if a model allows, else fewer keyframes.
- Story: the brief carries the deliverable (ad, 30 s, ends on the name) and the medium; decide loaves only or both.
- Later: dialogue and voices (TTS + lip sync), kaizen page for the chain, the old grid and per-slide paths removed from `src/`.
