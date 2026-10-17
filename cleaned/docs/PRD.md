# PRD — Presence-tracked keyframe pipeline

> A natural-language prompt becomes a consistent slideshow of keyframes, then (later) a video. Consistency comes from editing the
> real frames that already carry the state, not from describing the state in words.

## 1. Problem

- Video and image models are stateless. Between two calls, the only shared context is what goes into the conditioning.
- Pixels carry far more context than words: layout, scale, light, identity, and every small object in a room.
- Earlier pipelines in `current/` tracked many attributes per entity (pose, position, relations). That is expensive, often wrong,
  and duplicates what the reference image already holds.

## 2. Thesis

1. **The frame is the state.** A keyframe holds everything about a scene. The tracker only records *which entities a frame
   shows*, not how they look.
2. **Edit, do not regenerate.** A new keyframe = the latest frame that carries the wanted state + a few reference images,
   through an image editor told to keep everything else the same.
3. **Additive build (1 + k, falling back to 1 + 1).** Missing entities are added from their clean reference sheets. If an edit
   misses some, the next attempt adds only the ones still missing, on top of the frame that got the rest.
4. **Changes live in the latest frame.** A change to an entity (empty bowl, broken chair) is made once, on the frame where it
   happens. Later retrieval of that location returns that frame, so the change carries forward with no text state.
5. **Observed, not intended.** What a frame shows is read back by a vision check after generation. The tracker records the
   observation.
6. **Video is a transition between keyframes.** Keyframes are needed only where the gap holds something the video model would
   invent wrongly: a new entity, a state change, a cut. Simple motion is left to the video model (stage 2, not built yet).

## 3. Scope

| In (v0) | Out (later) |
|---|---|
| Prompt → sequenced slide plan (one LLM call) | Video clips between keyframes (stage 2) |
| Reference sheets for entities, plates for locations | Audio, narration, music |
| Presence tracker and retrieval | Non-linear story retrieval ("a frame before X existed") |
| Keyframe builder (edit loop) with presence verification | Camera-angle indexing of frames |
| Slideshow page with lineage | User uploads as roots |

## 4. Pipeline

```
prompt ──► [S1 Sequencer] ──► plan.json (entities, locations, slides)
                                   │
              ┌────────────────────┴───────────────────┐
              ▼                                        ▼
      [S2 Roots] entity sheets               location plates
              │                                        │
              └──────────────► [S3 Tracker] ◄──────────┘
                                   │  base = latest frame at location
                                   ▼
                            [S4 Builder] edit: base + refs, keep all else
                                   │
                            [S5 Verifier] presence / absence / change
                                   │  accept → tracker.add(observed)
                                   ▼
                            [S6 Slideshow] index.html
                                   ▼
                            (stage 2: clips between keyframes)
```

## 5. Subsystems

### S1 — Sequencer (`src/sequencer.js`)
- **Input:** one natural-language prompt. **Output:** `plan.json`.
- Assumed to be a strong LLM; one call, strict JSON schema.
- Defines: global `style`; `entities` (character, group, prop) with a `look`; `locations` with their fixtures drawn into the
  look; ordered `slides`, each with `location`, `present` (entity ids), `shows` (composition), `change` (a state change of
  things already in frame, or empty), `continues` (edit the previous slide's frame), and a `caption`.
- Rules it is told: fixtures that never leave a place belong to the location, not to entities; a set whose relative size
  matters (three bears) is one `group` entity; a state change is written on the slide where it happens, once.

### S2 — Roots (`src/roots.js`)
- One text-to-image call per entity (reference sheet on a plain background) and per location (empty plate with fixtures).
- Roots are never edited. Every later edit that shows an entity can use its root, so identity never chains
  generated → generated.

### S3 — Tracker (`src/tracker.js`)
- Records frames: `{ id, file, slide, location, present[], base, refs[], op, hops, accepted }`.
- Presence only. No pose, expression, position or condition.
- `baseFor(slide)`: if `continues`, the previous slide's frame. Otherwise the **latest** accepted frame at the same location,
  because it carries the latest state of the place. An older frame that shows more wanted entities is not preferred: entities are
  cheap to add from their roots, a lost change is not. Plates are frames with `present = []`, `hops = 0`.
- `hops` counts edits since the plate, so drift can be measured and bounded later.

### S4 — Builder (`src/builder.js`)
- `add = present − base.present`, `remove = base.present − present`, `keep = present ∩ base.present`.
- One image-editor call: image 1 = base; then the roots of the added entities; then identity roots of kept characters
  (at most 10 images).
- The prompt says: keep image 1 the same (place, furniture, objects, light, camera) except for the listed adds, removes
  and the change.
- Up to 3 attempts. After a partial success, the next attempt builds on the new frame and adds only what is still missing
  (1 + 1). The best attempt is kept; if none passes, it is used and flagged `forced`.

### S5 — Verifier (`src/verify.js`)
- One vision call per attempt. For every entity in `present ∪ base.present`, it reports present or absent and a count.
  It also reports whether the `change` is visible and whether the frame is a single image (not a grid).
- Pass = every wanted entity present (a character exactly once), every removed one absent, the change visible,
  a single frame.
- The tracker records the *observed* presence.

### S6 — Slideshow (`src/page.js`)
- `runs/<case>-<label>/index.html`: the slides in order (arrow keys), and per slide its lineage (base → result, references,
  prompt, attempts, verification). Also a presence matrix (slides × entities) and the roots.

## 6. Infrastructure

- `src/env.js`: keys from the repository root `.env`.
- `src/llm.js`: OpenAI Responses API, strict JSON, optional images, disk cache in `.cache/`.
- `src/magichour.js`: Magic Hour create → poll → download, and upload.
- `src/jobs.js`: every paid call. A job is skipped if its signature (spec + input file hashes) is unchanged. Credits are metered
  against a cap (`CLEANED_CAP`, default 8000) in `runs/ledger.json`. `--estimate` spends nothing.

## 7. Models and cost

| Step | Model | Credits |
|---|---|---|
| Sequencer, verifier | `gpt-6.1-sol` (override `CLEANED_MODEL`) | LLM tokens only |
| Roots, keyframes | Magic Hour `nano-banana-pro`, 2k, 16:9 | 200 per image |

A 12-slide story with 6 roots costs about 18 images (3,600 credits), plus retries.

## 8. Success measures (v0)

- Every slide passes presence verification on the first or second attempt.
- State changes persist: a change made on slide *k* is visible on every later slide at that location.
- Identity holds across slides (eyeballed on the slideshow page; scored later).
- Edit hops per frame stay small (record the maximum).

## 9. Known risks

- Edits re-render the whole image, so the room drifts with each hop. `hops` is recorded; re-anchoring is a ticket.
- A frame from one camera angle cannot faithfully serve another angle. Angle indexing is a ticket.
- A presence check cannot see something the frame does not show (off-screen state).
