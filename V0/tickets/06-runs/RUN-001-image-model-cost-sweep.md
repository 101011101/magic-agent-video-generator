# RUN-001 — Image-model cost sweep (M08–M11)
**Status:** open
**Category:** 06-runs
**Cost:** 1195
**Approval:** required-not-given
**Blocked by:** none

## Problem
Every image call in both production pipelines uses `nano-banana-pro` at 200 credits/image (confirmed: `current/tests/pipeline-memory/ledger.json` — `/v1/ai-image-generator` 3,000 cr / 15 calls, `/v1/ai-image-editor` 8,600 cr / 43 calls, all at 200 cr each). `current/research/sources/magic-hour-openapi.json` documents six cheaper models whose rates are confirmed in that spec: `z-image-turbo` 5 cr, `flux-2-klein` 5 cr, `krea-2` 10 cr (generator) / `qwen-edit` 10 cr (editor), `seedream-v4` 40 cr, `gpt-image-2` 50 cr, `nano-banana-pro` 150–200 cr. We don't yet know whether any cheap model holds the three properties pipelines keep failing on at full price: prop scale (RESULTS.md R05/R06 — typed size only improves, never fixes, prop scale at nano-banana-pro), text suppression (0-for-3 on retries per MATRIX.md §"Text and graphics"), and count discipline.

This run executes MATRIX.md M08, M09, M10 and M11 together, sharing the same six-model generator sweep across three prompts (prop-scale, no-text, count) plus a four-model editor sweep for identity-preserving edits.

## Evidence
No generation has been done yet at these rates — nothing in `ledger.json` uses any model but `nano-banana-pro`. Per-model credit figures are taken directly from `magic-hour-openapi.json`'s `ai-image-generator`/`ai-image-editor` model descriptions (verified: z-image-turbo 5, flux-2-klein 5, krea-2 10, qwen-edit 10, seedream-v4 40, gpt-image-2 50, seedream-v4.5 50, nano-banana-pro 150–200).

Fulfils: TEST-038 (M08, 310 cr), TEST-039 (M09, 310 cr), TEST-040 (M10, 310 cr), TEST-041 (M11, 265 cr) = 1,195 cr.
Because the sweep includes `nano-banana-pro` as one of its arms, it also supplies the single-model answers for TEST-010 (T16, count) and TEST-011 (T17, no-text) as a side effect — no need to run those separately first.

## Done when
For each of M08 (prop scale), M09 (text suppression) and M10 (count), all six generator models (`z-image-turbo`, `flux-2-klein`, `krea-2`, `seedream-v4`, `gpt-image-2`, `nano-banana-pro`) have been run against the fixed prompt, and the pass/fail table (prop within 2×, zero readable glyphs, exact count) is filled in per model. For M11, all four editor models (`qwen-edit`, `flux-2-klein`, `seedream-v4.5`, `nano-banana-pro`) have been run against the fixed source frame and edit instruction, and identity/fixed-parts-of-the-place retention is scored per model. Total spend recorded against this run: 1,195 credits.
