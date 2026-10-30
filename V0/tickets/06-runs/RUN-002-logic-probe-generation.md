# RUN-002 — Logic probe generation (G1–G4)
**Status:** open
**Category:** 06-runs
**Cost:** 2520
**Approval:** required-not-given
**Blocked by:** none

## Problem
`current/tests/subcases/MATRIX.md` Part 5 establishes that neither production pipeline has a logic/motion check (RESULTS.md R08, PASS-as-confirmed-defect: pipeline A's fault histogram has zero motion/action faults across 110 recorded faults, because no check exists that could raise one). Eleven logic failure modes (L01–L11, e.g. inverted vector, null action, invented action, state-arrives-early, uncommanded change, count violation under motion) are documented from recorded judge text but have never been probed with a dedicated, isolated generation. L00 (RESULTS.md, PARTIAL) confirmed 10 of the 11 modes are scoreable from text; this run produces the four video clips needed to score them for real.

This run generates the four MATRIX.md generation units: G1 (staircase climb, 680 cr: 200 start frame + 480 clip), G2 (lantern ignition, 680 cr), G3 (reuses G2's last frame, 480 cr clip only), G4 (street corner, 680 cr). All at wan-3.0, 720p, 5s, `audio:false`, nano-banana-pro 2k start frames — matching production exactly.

## Evidence
No logic probe has ever been generated; `ledger.json` contains no job named `G1`–`G4` or matching these prompts. The eleven-mode taxonomy and its evidentiary basis are in MATRIX.md §5.2; RESULTS.md L00 is the only probe-adjacent result so far and it is a text-only replay, not a new generation.

Fulfils: TEST-020 (L01), TEST-021 (L02), TEST-022 (L03), TEST-023 (L09), TEST-024 (L10), TEST-025 (L11) — all read off G1, cost 0 each. TEST-026 (L04), TEST-027 (L05) — off G2, cost 0 each. TEST-028 (L06) — off G3, cost 0, but flagged in RESULTS.md as **not scoreable per shot as designed**; redesign the instrument before scoring it from this footage. TEST-029 (L07), TEST-030 (L08) — off G4, cost 0 each.
Is also the prerequisite for RUN-003 (video model A/B comparison), which reuses G1's start frame and prompt as its held-constant baseline.

## Done when
G1, G2, G3 and G4 are generated exactly as specified (model, resolution, duration, camera instruction held constant per unit) and their real last frames are extracted. Total spend recorded against this run: 2,520 credits. Once generated, TEST-020 through TEST-030 (excluding TEST-028, which needs a redesigned instrument first) can each be scored at zero additional cost by answering their yes/no probe against the footage.
