# RUN-005 — 30-second, two-cut video (production-scale validation)
**Status:** open
**Category:** 06-runs
**Cost:** 4080
**Approval:** required-not-given
**Blocked by:** RUN-001, RUN-003, RUN-004

## Problem
Every sub-case test in this matrix is deliberately small and isolated (one join, one prop, one model) so a failure is attributable. None of them is a full production-shaped render. Before spending at the scale of a `p4-lighthouse`-size run again (9,200 credits for 9 clips per `ledger.json`), we want one end-to-end check at a representative but smaller scale: a 3-shot, ~30-second film with two cuts (shot 1 → cut → shot 2 → cut → shot 3), run through the actual production pipeline (anchors → keyframes → clips), to see whether the fixes/choices validated by RUN-001 (cheapest image model that holds prop scale/text/count), RUN-003 (best video model for action fidelity) and RUN-004 (context-transfer and scale-anchor mechanics) actually compose when run together, end to end, instead of in isolation.

Estimated at ~4,080 credits: 3 shots × 10s × wan-3.0's measured 96 cr/s = 2,880 cr for video, plus 2 cut-keyframes via `ai-image-editor` with a one-retry margin each (4 editor calls × 200 cr = 800 cr), plus 1 initial `ai-image-generator` start frame (200 cr) and a 200 cr retry margin ≈ 4,080 cr. This mirrors the per-shot cost shape already observed in `ledger.json`'s `p4-lighthouse-v1` run (clips 4,800 / anchors 1,800 / keyframes 1,400 / retries 1,200 over 9 shots), scaled down to 3 shots.

## Evidence
No run of this exact shape (3 shots, 2 cuts, ~30s total) exists yet. The cost shape is extrapolated from `ledger.json`'s recorded `p4-lighthouse-v1` breakdown (9,200 cr / 9 clips) and from the per-test credit estimates already used elsewhere in MATRIX.md for T10 (1,160 cr for one continuous 2-clip join) and T12/T13 (1,360 cr each for one cut join) — a 2-cut, 3-shot sequence is architecturally one continuous join plus one cut join, i.e. of the same order as T10+T12 (1,160+1,360 = 2,520) with the remainder covering model/editor choices that differ from the T10/T12 defaults if RUN-001/RUN-003 pick non-default models.

## Done when
A single 3-shot, ~30-second video is produced end to end through the production pipeline with two real cuts, and judged against: (a) the same context-transfer criteria as T10/T12 (same entity+place held across both the continuous join and the cut join, seam SSIM ≥ 0.98 on the continuous join), (b) the logic criteria validated cheaply in RUN-002/RUN-003 (no inverted vector, no invented action, no uncommanded change), and (c) overall judge score comparable to or better than the equivalent-length slice of `p4-lighthouse-v1`. Total spend recorded against this run: ~4,080 credits (confirm actual against estimate once billed).
