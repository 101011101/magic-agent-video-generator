# Solver Traces (Worked Examples)

> Hand traces of the core loop in [05-solver.md](subsystems/05-solver.md) against [tool-signatures.json](../tests/fixtures/tool-signatures.json). Inputs: GPT change-based chunks in [tests/creative-director/outputs/gpt/](../tests/creative-director/outputs/gpt/). Traced 2026-10-06, before the nature field and soft credit.

## Grandma (3 continuous chunks, 5 s)

- **Conditions:** baseline (identity, head_hair, wardrobe, background, lighting, props, style, camera locked, aspect, duration 5 s) + changes (expression neutral → smile, pose_action wave → settle).
- **Epoch 1:** Image-to-Video. Makes true: expression, pose_action, camera, duration. Passes through from the start image: identity, head_hair, wardrobe, background, lighting, props, style, aspect. Nothing uncovered.
- **Input:** start image = the upload (given input). Leaf.
- **Result:** 1 tool call. No join. The three chunks merge into one call.
- **Lesson:** chunk boundaries are not tool boundaries.

## Logo fade (Sendly, 5 s)

- **Conditions:** transparent background; circle, plane and wordmark invisible; plane offset → circle 0 → 100%; plane visible and slides into place; SENDLY 0 → 100%; hold. Rigid: final logo exactly as uploaded.
- **Epoch 1:**
  - Image-to-Video: fails. The logo is a `text` atom, which the tool drops. No exactness, no transparency.
  - `fade`: fails. It makes nothing true (no visibility atom).
  - `transform`: fails. It sets `camera` (whole frame), not one element.
  - No join fits. Stitch joins in time; mux joins audio. Nothing joins visual layers in space.
- **Result:** fails. Gaps found:
  - Atoms: visibility, layer position.
  - Join: layer composite (several visual layers, each with its own atoms and timing).
  - Leaf tool: blank or transparent canvas.
  - Separate element images: ask for a layered logo file (original-only), or isolate elements with the image editor (exactness at risk).
- **With the gaps fixed:** canvas → composite(circle with fade, plane with slide, wordmark with fade). About 4 deterministic calls, exact.
- **With soft credit (after the nature field):** a video generator could do the fade, but the rigid exact-logo condition needs hard credit, so the deterministic path still wins.

## Lighthouse (23 chunks: 18 cuts, 5 continuous, 120 s, score only)

| Epoch | Goal | Non-join tool covers all? | Join | Sub-goals |
|---|---|---|---|---|
| 1 | Film: 120 s, painterly, music, 23 segments | No | audio_mix_mux | video + music |
| 2a | Music: melancholy, 120 s | Yes: `music_score` (unbound) | — | leaf, bound at execution |
| 2b | Video: 120 s, 23 segments | No | stitch | 23 chunk sub-goals |
| 3 | Chunk 6 (cut, kitchen, 5 s): keeper, wardrobe, kitchen, window light, painterly, placing, shell palm → table | Yes: Image-to-Video with start and end image | — | start image, end image |
| 4 | Start image: keeper at the table holding the shell | Yes: Image Editor on the keeper reference | — | keeper reference |
| 4 | End image: shell on the table, hand empty | Yes: Image Editor on the start image | — | the start image (shared node) |
| 5 | Keeper reference (fictional, painterly) | Yes: Image Generator (makes identity) | — | leaf, generated once, shared by all chunks |

- **Result:** resolves. Every condition ends at a leaf.
- **Lessons:**
  - The prop change gets credit only through the end image (Image-to-Video takes props at t = end from the end image).
  - Real identity (grandma) → given or ask leaf. Fictional identity (keeper) → generated leaf, bound once.
  - Continuous chunks share end-frame nodes; all chunks share the keeper root node.

## Fixes found by the traces (open)

1. Atoms: visibility, layer position ([01-types.md](subsystems/01-types.md)).
2. Join: layer composite. Leaf tool: canvas.
3. Editor signatures: the Image and Video Editors list background and other atoms as "makes true". They must pass through by default and change only what the prompt names.
4. Join order when several joins apply.
