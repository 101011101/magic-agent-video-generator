# PRD-021 — Tool specs are treated as proofs; generative tools guarantee nothing
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`vision.md`: "A tool is a proof. Its signature proves that its input types produce its output type" and "A tool spec states which properties the tool maintains." A diffusion model maintains nothing deterministically. Its spec is a prior, not an inference rule. The Lean metaphor assumes sound rules; chaining probabilistic steps compounds error and the model has no term for it.

## Evidence
After the re-anchor work attached root references to 31 generations that previously had none, run `p4-lighthouse-fixed30` still recorded `shell identity differs`, `beacon identity differs` and `trawler identity differs` (`current/tests/pipeline-state-graph/runs/p4-lighthouse-fixed30/run.json`, beats 2-4). The reference was supplied and the property was not maintained. `post-mvp.md` already asks for "how confident it is that it maintains the others" — the core model has no place to put the number.

## Done when
Tool signatures carry a measured per-property retention rate rather than a declared boolean, fed by the retrospective failure tracking `vision.md` already calls for, and the selection rule reasons about retention over a chain instead of boolean satisfaction.
