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
3. **Deltas from the latest frame.** A new frame is the latest frame of its place, edited with only what changes. Anything
   already in that frame gets no reference: the frame already holds it, with every change the story made to it. An element that
   enters is taken from the latest frame that shows it (one shared image when several entering elements were last seen together);
   its seed sheet is used only the first time it ever appears. After the frame is made, the tracker records what it shows.
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

## 4. Pipeline (states first, end to end)

```
natural-language prompt
  ─► [S1a Story]          LLM (creative director): title, style, prose
  ─► [E1 Editor]          LLM: logic read of the story (holes, objects from nowhere, unclear motives) → minimal edits
  ─► [I0 IDs]             small LLM calls: every mention → id in context (pronouns, aliases); coverage; role
                           (asset / fixture / place / part); inside-of; physical links proposed then checked
  ─► [A0 spec half]       LLM: asset specs; environment specs = environment specs (layout) (fixtures are marks; link constraints)
  ─► [S1b Text text blocking]       LLM: one record per step against the marks, using the ids from I0 (never re-reading pronouns)
  ─► [SM State manager]   CODE: fold the records into the state table (rows of ids per frame); infer each place's initial
                           contents; lint; cross-check against the ids
  ─► [Q Question loop]    CODE writes questions from the state manager's findings (props inferred as always there, assets
                           never on screen, untagged mentions, entry/exit repairs, props seen where never carried);
                           E1 answers ALL of them at once with minimal story edits; I0 → SM rerun; ≤ 2 rounds; what is
                           left goes to the user; images only from a clean plan (gate)
  ─► [A0 image half]      image jobs: sheets for first appearances by entry; plates with initial contents; vision checks
  ─► [S3–S5 Slides]       CODE picks base and references from the state table; image edit; vision check; framing gate (code)
  ─► [S6] slideshow (CODE)
```

### 4.00 Terms
- **Text blocking**: turning the story into scene records, one per slide, like a screenplay that writes only what changes
  (who moves, from which spot to which, pose, expression). Code folds the records into the state table.
- **Environment spec (layout)**: an environment's description plus its named spots (`bed.head`, `door`). The spots are what text
  blocking positions things against; the plate is painted from the spec.

### 4.0 The loop in one line
Story → editor → solve (ids → environment specs (layout) → text blocking → state manager) → questions → editor answers all at once → solve again
reusing what did not change (unchanged chunks keep their tags; environment specs (layout) reused when environments and fixtures are the same;
text blocking revised as a patch) → at most 2 rounds → **gate**: images only from a clean plan (no broken rule, no open question).

### 4.0b Environments are elements
A frame row holds its environment like any element. The base of a slide is `lastSeen(environment)`, the same lookup as an asset's
latest context. What is special about an environment is three properties, not a separate pipeline: every frame has exactly one;
other elements stand on its marks and fixtures belong to it; its first appearance is a painted plate (its "sheet").

### 4.1 Determinism: what is code, what is a model

| Stage | Kind | Calls (`name` in `.cache/`) |
|---|---|---|
| Story | LLM, creative | `story` (older runs: `world`) |
| Editor | LLM | `edit-review` (after the story), `edit-answer` (all questions at once) |
| IDs | small LLM calls + parser | `ids-tag` per changed chunk; coverage: parser (code) first, `ids-coverage` only for leftovers; `ids-classify`, `ids-link-propose`, `ids-link-check` per pair |
| Asset specs, environment specs (layout) | LLM, creative | `asset-spec`, `seed-plan` |
| Text text blocking | LLM | `block` (first solve), `block-patch` (after an edit: changed steps only), `block-fix`, `block-fix2` |
| **State manager** | **code** | none: `fold` (states, initial contents, lint), id cross-check, `tracker` rows, `lastSeen`, `baseFor` |
| Question loop | code (questions) + LLM (answers) | questions: none; answers: the editor |
| Sheet and plate checks | vision LLM | `asset-check`, `asset-set`, `seed-observe` |
| Frame building | code | prompts are templates from the records; references from the state table |
| Frame checks | vision LLM + code | `verify-step` (accept or retry only; never writes the state table); framing gate is SSIM (code) |
| Clip prompts (stage 2) | LLM | `motion` |

Rule: a model never writes the state table. The table is the requested ids per frame (by induction every requested asset is
in its frame); vision checks only accept or retry an image.

### 4.1b Data schemas (all in `runs/<case>-<label>/run.json`)
| Record | Fields |
|---|---|
| story | `title, style, story` |
| edit | `original, review[{hole, fix}], rounds[{questions[{key, q}], answers[{key, kind: edit/always-there/cut, sentence}], before, after}], story, open[]` |
| ids.table row | `id, name, tag_kind, role: asset/fixture/place/part/none, kind: character/group/prop/none, place, parent, inside, aliases[]` |
| ids.chunks | `text, tagged ("she{grandmother}"), mentions[{text, ids[]}], new_ids, untagged[]` |
| ids.links | `a, b, relation: part-of/inside/same-thing-other-view, belongs, evidence, constraint` |
| world | `title, style, story, story_ids, entities[{id, name, kind, inside, home}], locations[{id, name}]` |
| seed_plan.places (environment spec) | `id, look, camera, marks[{id, name, where, essential, area, size, faces, key}], doors[{mark, leads_to, swing}], light` |
| blocking.steps (record) | `place, kind, time_jump, beats[{actor, action, to, via, object, pose, expression}], change{mark, state}, caption` |
| blocking.slides (folded state) | `n, location, present[], cast[{id, where, acting}], changed[], beats, change, ste[], caption`; `initial{place: [ids]}`, `lint[]` |
| asset_specs / assets | `id, name, kind, spec, height` / `file, tries[{t, file, ok, chk}], ok, set` |
| seed (plates) | `place: {plate, tries, unresolved[], observed[], contents[]}` |
| tracker.json frames (state table) | `id, slide, location, present[] (requested ids), observed[], file, base, refs[{id, file, from}], op, hops, accepted, forced` |
| jobs / ledger | `jobs{key: {sig, endpoint, file, inputs, prompt, credits}}`; `runs/ledger.json {total, runs{name: credits}}` |

### 4.2 Same input, same result
- Every LLM call is cached on disk by (model, call name, schema, prompt, images); every paid image job by (spec, input file
  hashes). The same prompt reproduces the same story, ids, states and images with no new calls and no credits.
- Strictly, a state depends on the story AND the text blocking call; with the cache, one story gives one text blocking and so one state.

### 4.3 Stages and fixtures (planned, T-001)
- Each stage reads and writes one JSON file in the run directory (`story.json`, `ids.json`, `specs.json`, `blocking.json`,
  `states.json`, `assets.json`, `plates.json`, `frames/`). `node cleaned/stage.mjs <stage> --run <dir>` runs one stage.
- `cleaned/tests/fixtures/` holds hand-checked inputs (a perfect text blocking, a story with a known hole); a stage run on a
  fixture tests that stage alone. The full script on any prompt runs every stage in order.

## 5. Subsystems

### S0 — Seed (`src/seed.js`, PRD-seed.md)
- Used once per place, at the start. Environment spec (layout) → plate → per-mark vision check → canonical marks. After the first frame the
  frames carry the state; the seed only names the marks the steps may use.

### S1 — Sequencer (`src/sequencer.js`)
- **World** (LLM): style, entities, places and a plain prose story (best-known version of a known tale, climax and feelings shown).
- **Text text blocking** (LLM, after the seed): one record per step, like stage text blocking: `beats[{ actor, action, to, via, object, pose,
  expression }]`, `change{ mark, state }`, `caption`. Marks come from the canonical seed. Only changes are written.
- **Fold and lint** (code): the beats are folded into the full state (who is where, holding what, feeling what). Lint: marks exist,
  ≤ 2 beats per step, enter/exit at door marks, exit before a character on screen appears elsewhere, pose and expression on
  arrival, pick-up/put-down consistency. One rewrite; what remains is shown on the page.
- **Slides** (code): one per step. The action sentence is generated from the record; the caption is the only free text.
- Runs saved with the STE step script (B-007) or the first one-call plan re-run from their saved plan.

### S2 — Asset seed bank (`src/assets.js`; older runs: `src/roots.js`)
- Every asset the story mentions (characters, groups, props) gets a spec written against the whole set (one style, agreeing
  sizes, the starting look only), one sheet on a plain background, a check per sheet, and a check of all sheets together.
- **Seeding only.** A sheet is used the first time its asset appears; from then on the asset's context is the frames it is in.
- Not built: the interaction matrix (A-005): which assets interact or contain each other (a house and its rooms, a character
  and what it carries), and an LLM pass that adds the constraints those pairs need before anything is generated.

### S3 — Tracker (`src/tracker.js`)
- Records frames: `{ id, file, slide, location, present[], base, refs[], op, hops, accepted }`.
- `lastSeen(asset, slide)`: the latest accepted frame before the slide that shows the asset (any place).
- Presence only. No pose, expression, position or condition.
- `baseFor(slide)`: if `continues`, the previous slide's frame. Otherwise the **latest** accepted frame at the same location,
  because it carries the latest state of the place. An older frame that shows more wanted entities is not preferred: entities are
  cheap to add from their roots, a lost change is not. Plates are frames with `present = []`, `hops = 0`.
- `hops` counts edits since the plate, so drift can be measured and bounded later.

### S4 — Builder (`src/builder.js`)
- Text text blocking slides: the prompt names only the changed actors (mark, path, pose, expression), adds, removes and the change;
  everything else is "as in image 1", including zoom, crop and border. Style drops "film still" / "16:9" (they push full-bleed).
- `add = present − base.present`, `remove = base.present − present`, `keep = present ∩ base.present`.
- One image-editor call: image 1 = base; then one image per entering asset: the latest frame that shows it (shared when
  several were last seen together), or its seed sheet the first time it ever appears (at most 10 images). Assets already in the
  base get no image (passing their sheets made the editor redraw them: whole-picture re-paints, a second Red; G-006).
- The prompt says: keep image 1 the same (place, furniture, objects, light, camera) except for the listed adds, removes
  and the change.
- Up to 3 attempts. After a partial success, the next attempt builds on the new frame and adds only what is still missing
  (1 + 1). The best attempt is kept; if none passes, it is used and flagged `forced`.

### S5 — Verifier (`src/verify.js`)
- Text text blocking slides (`verifyStep`): presence for characters and groups and for props the step uses; per changed actor, at its mark /
  pose / expression; the change; single frame; physically impossible? Plus the framing gate (`clips.js`): SSIM to the base
  < 0.70 or a corner shift ≥ 10 rejects the edit (calibrated on custom-rrh1: normal 0.78–0.98, re-paints 0.08–0.61).
- Older slides: one vision call per attempt. For every entity in `present ∪ base.present`, it reports present or absent and a count.
  It also reports whether the `change` is visible and whether the frame is a single image (not a grid).
- Pass = every wanted entity present (a character exactly once), every removed one absent, the change visible,
  a single frame, and (step-script slides) each character's position and acting as written. Expression comes from the slide
  text, never from the reference sheet.
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
