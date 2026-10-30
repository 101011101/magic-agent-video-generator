# COST-001 — Use a cheap image model for iteration, nano-banana-pro only for the final frame
**Status:** open
**Category:** 07-cost
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
Both production pipelines call `/v1/ai-image-generator` and `/v1/ai-image-editor` exclusively with `nano-banana-pro` at 2k (200 credits/image), for every anchor, every keyframe attempt, and every retry — never just the frame that ships. Confirmed against `current/tests/pipeline-memory/ledger.json`: lifetime spend is 22,640 credits over 81 jobs; `/v1/ai-image-editor` alone is 8,600 credits over 43 calls (all at 200 cr), `/v1/ai-image-generator` is 3,000 credits over 15 calls (all at 200 cr). In the single run `p4-lighthouse-v1` (9 clips, 9,200 credits), keyframes cost 1,400 and retries cost 1,200 — 2,600 credits, over a quarter of the run's spend, on intermediate images that get regenerated or discarded, at the same 200-cr rate as the frame that ships.

`current/research/sources/magic-hour-openapi.json` documents much cheaper models at the same endpoints: `ai-image-generator` has `z-image-turbo` (5 cr), `flux-2-klein` (5 cr), `flux-schnell` (5 cr), `krea-2` (10 cr), `seedream-v4` (40 cr); `ai-image-editor` has `flux-2-klein` (5 cr), `qwen-edit` (10 cr), `krea-2` (10 cr), `seedream-v4` (40 cr) — all confirmed in the spec's model-description text for those two endpoints. Every retry and every keyframe attempt that is not the final shipped frame is currently paying the 200-cr `nano-banana-pro` rate for work whose only purpose is to be looked at and possibly discarded.

## Evidence
`ledger.json` aggregation (verified): `/v1/image-to-video` 11,040 cr / 23 calls, `/v1/ai-image-editor` 8,600 cr / 43 calls, `/v1/ai-image-generator` 3,000 cr / 15 calls, lifetime total 22,640 cr / 81 jobs. `p4-lighthouse-v1` breakdown (verified by summing its 29 ledger entries by job-name prefix): clips 4,800, anchors 1,800, keyframes 1,400, retries 1,200 = 9,200. Per-model rates confirmed in `magic-hour-openapi.json` lines ~6361–6386 (`ai-image-editor`) and ~6856–6883 (`ai-image-generator`).

This is the headline cost-reduction ticket named directly in the project brief: use a cheap model (`z-image-turbo`/`flux-2-klein`/`flux-schnell` at 5 cr, or `qwen-edit`/`krea-2` at 10 cr for edits) for every iteration — anchors used only to check composition, keyframe drafts, and retries — and reserve `nano-banana-pro` for the one frame per shot that actually gets passed to `image-to-video`. TEST-038/039/040/041 (RUN-001, the image-model cost sweep) must confirm first that a cheap model holds the properties (prop scale, text suppression, count, identity) well enough to be useful for iteration even if not for the final frame — a cheap model that fails outright is not a useful draft tool.

## Done when
`pipeline-memory/src/keyframes.js` and the equivalent code path in `pipeline-state-graph` select model by call purpose: a cheap model (≤10 cr) for any call whose output will be retried, discarded, or used only as an anchor/draft, and `nano-banana-pro` only for the frame that is actually handed to `image-to-video`. Re-running a shot-equivalent of `p4-lighthouse-v1`'s keyframe+retry pattern (9 shots, same retry rate) with this split costs materially less than 2,600 credits for the keyframe+retry portion — the saving is measured directly from the next real run's ledger entries, not estimated.
