# COST-003 — Video generation is the single largest spend line and has never been cost-compared
**Status:** open
**Category:** 07-cost
**Cost:** 0
**Approval:** not-required
**Blocked by:** RUN-003

## Problem
Confirmed against `current/tests/pipeline-memory/ledger.json`: `/v1/image-to-video` is 11,040 credits over 23 calls (average 480 cr/call), the largest of the three endpoint lines — larger than `/v1/ai-image-editor` (8,600/43) and `/v1/ai-image-generator` (3,000/15) combined minus a small margin, and nearly half of lifetime spend (22,640 total). Every one of those 23 calls used `wan-3.0`, chosen (per `current/docs/subsystems`/state-manager README, cited in MATRIX.md §6.2) for end-frame SSIM and free native audio — not for cost, and not for the action/logic fidelity that MATRIX.md Part 5 identifies as the dominant measured failure class.

`magic-hour-openapi.json` documents several other video models (`wan-2.2`, `kling-2.6`, `ltx-2.5`, `minimax-h3`, etc.) but — as MATRIX.md Part 4 and §6.5 both note — the spec does not publish a per-second credit rate for any of them, only for images. We do not currently know whether a model switch would raise or lower the single biggest cost line; we only know it might fix the logic problem (that is what RUN-003 tests). This ticket is the cost side of that same question, kept separate because "better at the verb" and "cheaper per second" are independent axes and MATRIX.md's own credit estimates for non-wan-3.0 models are explicitly flagged as assuming wan-3.0's rate, which could be "materially wrong."

## Evidence
`ledger.json` aggregation as above (verified). `magic-hour-openapi.json`'s `/v1/image-to-video` and `/v1/text-to-video` schemas give duration/resolution/audio support per model (confirmed, see lines ~3945–4518) but no credit-rate field for any model besides what is inferable from image endpoints. No probe of an alternate video model's actual billed credits exists yet anywhere in this repo.

## Done when
When RUN-003 (video model A/B comparison) executes its first non-wan-3.0 clip, record the actual billed credit amount from that job's response (not an assumed 96 cr/s) for each of `wan-2.2`, `kling-2.6`, `seedance-2.5` and `veo3.1`. Produce a credits-per-second table alongside the existing action-fidelity results, so any future model-selection decision (including COST decisions, not just the logic question RUN-003 was designed for) is made on a measured rate, not the carried-over wan-3.0 assumption.
