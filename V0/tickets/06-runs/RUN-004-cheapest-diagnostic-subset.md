# RUN-004 — Cheapest diagnostic subset (Part 3)
**Status:** open
**Category:** 06-runs
**Cost:** 3000
**Approval:** required-not-given
**Blocked by:** none

## Problem
`current/tests/subcases/MATRIX.md` Part 3 names this exact bundle "Cheapest useful subset — 3,000 credits" and states it "is the smallest spend that could change the architecture": it answers whether context transfer works at all, whether prop scale is a model or a prompt problem, whether text can be suppressed, and whether online images work, without yet paying for the harder cut-to-new-place or model-swap tests.

This run executes: T07 (online image URL input, 480 cr), T09 (photographic input + painterly style, 10 cr), T10 (continuous two-clip context transfer, 1,160 cr), T15 (scale anchor vs. none, 400 cr), T17 (no-text instruction, 600 cr) and T20 (prop scale by image model, 4-model mini-sweep, 350 cr). T01–T06 are already answered by replay (RESULTS.md) at zero cost and are not re-run.

## Evidence
None of T07, T09, T10, T15, T17 or T20 has been generated; `ledger.json` has no jobs matching these prompts/held-constant sets. T01–T06 are already closed per RESULTS.md (R01–R06: start-frame adherence PASS, end-frame adherence PASS, cuts-cut PASS, identity-across-cut PASS, typed-size-improves-but-doesn't-fix, location-stability-over-hops FAIL) — included here only as context, not as spend.

Fulfils: TEST-001 (T07, 480 cr), TEST-003 (T09, 10 cr), TEST-004 (T10, 1,160 cr), TEST-009 (T15, 400 cr), TEST-011 (T17, 600 cr), TEST-014 (T20, 350 cr). Sum: 3,000 credits.

## Done when
All six pass criteria have been checked and recorded: T07 job returns 200 and frame 0 matches the hosted URL image; T09 VLM confirms the style line applied with identity kept; T10 VLM confirms same entity+place across the join with seam SSIM ≥ 0.98; T15 the anchored prop stays within 2× its stated size while the unanchored one does not; T17 VLM finds zero readable glyphs across all 3 prompt variants; T20 the prop stays within 2× its stated size for at least one of the four swept image models. Total spend recorded against this run: 3,000 credits.
