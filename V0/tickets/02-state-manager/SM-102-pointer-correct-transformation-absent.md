# SM-102 — State is pointer-correct but transformation-absent
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The intended model is: the original source is **passed and transformed, never regenerated**; state is a pointer to where the authoritative source lives. Both pipelines get the pointer half right and the transformation half wrong.

Pointers are correct. A's frames carry `seed`, `merged[]` and `op` lineage (`pipeline-state-graph/src/graph.js` `addFrame`); B's bank entries carry `file` (e.g. `refs/TowerStairs.png`) and each entity version carries an `anchor` path (`current/tests/pipeline-memory/runs/p4-lighthouse-v1/memory.json`).

What happens next contradicts the model. The pointer is handed to `/v1/ai-image-editor` as a reference, and an instruction editor **regenerates every pixel** — the original is consulted, not carried. `current/research/multishot-video-practice.md` records this as measured behaviour ("instruction editors regenerate every pixel; 'keep everything else' is soft; chained edits compound drift — FLUX Kontext measured it") and recommends mask inpainting plus paste-back of original pixels, which neither pipeline does.

## Evidence
Frame-op histogram across all four recorded A runs (`current/tests/pipeline-state-graph/runs/*/state.json`):

| op | kind | count |
|---|---|---|
| `edit` | generated | 19 |
| `merge` | generated | 12 |
| `generate` | generated | 5 |
| `anchor` | generated | 1 |
| `clip-last` | deterministic | 21 |
| `upload` / `upload-direct` | deterministic | 3 |

**37 generated (paid) vs 24 deterministic (free).** Every cut start frame is a paid regeneration even when the seed frame already contains the entity.

The two deterministic paths that do exist are exactly the user's model and both work: `clip-last` (ffmpeg extraction of the real last frame) and `upload-direct` (`controller.js:162` — `copyFileSync` plus `jobs.forget`, no credits, fires only when the upload already shows the entire wanted state).

## Done when
A cut start frame can be produced by extraction/compositing from an existing accepted frame without a generative call, and the frame-op histogram on a comparable run shows the deterministic share rising. Measure against `p4-lighthouse-v3` (37/24 today).
