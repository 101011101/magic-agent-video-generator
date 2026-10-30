# Sub-case results — zero-cost replay pass

> Run 2026-10-14 against recorded data only. **0 Magic Hour credits, 0 API calls, nothing generated.**
> Sources: `current/research/litmus/test-*/state.json`, `current/tests/pipeline-memory/runs/*/run.json`, `current/tests/pipeline-state-graph/runs/*/run.json`.
> Labels: **PASS** / **FAIL (model)** — the generator did the wrong thing · **FAIL (ours)** — our code or our documentation is wrong · **INCONCLUSIVE** — the record cannot decide it.

## Results table

| id | name | tool | held constant | changed | pass criterion | result | evidence |
|---|---|---|---|---|---|---|---|
| R01 | Litmus CAR identity across a cut to a new place | none — replay | asset set (3), mechanism | location desert→Tokyo | every tracked asset stable in every frame | **PASS** | 6/6 records fully stable, 2 scenes, 0 unstable assets |
| R02 | Litmus G two assets with `part_of` over 4 scenes | none — replay | asset set (5), mechanism | scene index 1→4 | every tracked asset stable in every frame | **PASS** | 12/12 records fully stable, 0 unstable assets |
| R03 | Litmus F location stability over 9 scenes | none — replay | mechanism (typed size) | scene index 1→9 | every tracked asset stable | **FAIL (model)** | 8/24 fully stable. Unstable: `@beach` 14, `@shell` 10, `@keeper` 8 |
| R04 | Litmus E — same story, untyped sizes (the control R03 needs) | none — replay | story, 9 scenes | typed absolute size **absent** | every tracked asset stable | **FAIL (model)** | **0/22** fully stable; `@shell` unstable in 21 of 22 |
| R05 | "Typed absolute size fixes prop scale" | none — replay | story, scene count | typed size present (F) vs absent (E) | shell palm-sized in **every** scene of F | **FAIL (ours)** | Claim is a hardcoded string at `build-typed.mjs:17`, not a measurement. F records show shell *"boot-length, much larger than 7 cm"* at s2 and s6; palm-sized only at s3 and s5 |
| R06 | Typed size **improves** prop scale (weaker claim) | none — replay | story, 9 scenes | typed size present vs absent | F's shell unstable count < E's | **PASS** | E 21/22 unstable → F 10/24 unstable. Real improvement, not a fix |
| R07 | Chain-length hypothesis: failure is a function of hop count | none — replay | — | shot position | score declines monotonically with position | **FAIL (ours)** | Hypothesis refuted — see below |
| R08 | Pipeline A has no logic/motion check | none — replay | — | — | zero motion or action faults in A's fault histogram | **PASS** (defect confirmed) | 110 faults recorded: position 43, size 24, pose 24, identity 11, interaction 6, place 4, condition 3, wardrobe 1. **Motion/action faults: 0** |
| L00 | Are the 11 logic criteria scoreable from recorded text? | none — replay | — | — | each mode unambiguously identifiable in existing `issues` arrays | **PARTIAL** | 45 of 108 issues (41%) match a logic mode; see breakdown |
| X-audio | Magic Hour exposes a music or SFX endpoint | none — spec | — | — | an endpoint exists | **FAIL (platform)** | Of 30 POST endpoints only `ai-voice-cloner` / `ai-voice-generator` are audio-producing. Placeholder score is unavoidable |
| X-overlay | Text-layer / mix path testable at zero cost | none | — | — | runs without generation | **BLOCKED** | Needs ffmpeg, still installing. Not run |

## L00 — decidability breakdown

108 recorded judge issues. 41% are logic-mode; **59% are not logic at all** (wrong wheel design, emblems, branding, lighting placement) — the taxonomy covers a real but minority slice of observed failure.

| mode | instances | scoreable? |
|---|---|---|
| L02 null action | 15 | yes |
| L04 state arrives early | 9 | yes |
| L03 invented action | 5 | yes |
| L10 form morph | 4 | yes |
| L01 inverted vector | 3 | thin |
| L07 uncommanded change | 3 | thin |
| L09 relation broken | 3 | thin |
| L11 camera disobedience | 3 | thin |
| L05 state never reached | 2 | thin |
| L08 count violation | 2 | thin |
| **L06 narrative regression** | **0** | **no — see below** |

**L06 is not scoreable per shot.** Zero instances appear in any per-shot `issues` array; the one quoted instance lives in the film-level `summary`. L06 is a cross-shot property, so a per-clip probe cannot test it. The G3 probe as designed in Part 5 will not score it — it needs a different instrument.

Six of eleven modes have ≤3 recorded instances. They are real but too thin to calibrate a pass criterion against, so a probe that "fails" on one of them cannot be distinguished from noise yet.

## R07 — the chain-length hypothesis is refuted

The matrix's headline conclusion was *"sub-cases pass, and failure is a function of chain length"*, and it proposed hop count as a primary test variable. The data does not support it.

**1. Correlation is weak and not significant.** Across all 21 judged production shots, Pearson r between shot position and score is **−0.218** (n=21, p≈0.34) — about 5% of variance.

**2. Every multi-shot run recovers at the end.** If accumulation drove failure the last shot would be the worst. It is usually among the best:

| run | per-shot scores | worst at | last shot |
|---|---|---|---|
| p4-lighthouse-v1 | 83, 79, 75, 72, 64, 68, **61**, 74, 71 | shot 7 | 71 |
| p4-lighthouse-v2-30s | 83, 72, 61, **59**, 75, 84 | shot 4 | **84 (best)** |
| d1-desert-tokyo | 78, 73, 71, **50**, 52, 85 | shot 4 | **85 (best)** |

All three are V-shaped, not declining.

**3. Litmus F fails in the middle and recovers.** Per-scene fully-stable rate: s1 2/2, s2–s5 **0/14**, s6 1/3, s7 1/1, s8 2/2, s9 2/2. Scenes 7–9 are *later in the chain* and perfect.

**4. What actually separates F's good and bad scenes is location, not position.**

| F scenes | location | fully stable |
|---|---|---|
| s1–s5 | `@beach` (open exterior, distant lighthouse landmark) | **2/16** |
| s6–s9 | `@kitchen` (enclosed interior) | **6/8** |

The recorded note matches: *"Beach lighthouse drifts: missing in scene 2, smaller in scene 4, a cottage is added in scene 5."* The failing element is a distant landmark in an open exterior, which has few fixed near-field cues to anchor it.

**5. Entity count does not explain it either.** Frames tracking 7 assets are 2/2 stable; frames tracking 3 assets are 2/21. Rejected as the driver.

**6. But the location story does *not* transfer to production.** First visit to a location scores 72.8 (n=9), a revisit 69.6 (n=12) — no meaningful difference, and in the opposite direction to the litmus pattern. Different instrument (binary per-asset stability vs a 100-point rubric), so the two are not directly comparable.

**7. Test E is the decisive counter-example.** E is 0/22 from *scene 1 onward* — it never works at any hop count. That is a mechanism failure, not accumulation.

**Verdict: hop count should not be a primary test variable.** The evidence points instead at *scene/location type* — specifically distant landmarks in open exteriors — and at mechanism correctness. **INCONCLUSIVE** on what the single dominant driver is: n=21 scored shots across 3 runs, with location, link type, entity set and position all varying together, is too thin to separate them. Isolating that needs a designed test, which is exactly what the matrix should spend its budget on instead of hop count.

## What this changes

1. **Do not port litmus F's typed size as a "proven fix" (R05).** It improves prop scale substantially (R06) but does not fix it. The matrix called it *"worth more than any new test on this list"* on the strength of a hardcoded string.
2. **Drop hop count as a primary variable (R07); test location type instead** — open exterior with a distant landmark vs enclosed interior, holding entity set and mechanism constant.
3. **Redesign the L06 probe** — it cannot be scored per shot.
4. **Treat the six thin modes as uncalibrated.** Prefer L02 (15) and L04 (9), which have enough instances to anchor a criterion.
5. **R08 stands and is the most actionable item in the whole matrix**: pipeline A cannot fail a motion or action check at any price, because no such check exists.

## Not run

- Everything in Parts 7–8 needing ffmpeg (overlay, mix, geometry) — ffmpeg was still building.
- All generation-bearing rows (G1–G4, M01–M11, T-series, X-series) — these need credits and were out of scope.
