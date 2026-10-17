# V-008 — Acting (expression and body) written per slide, carried across cuts
**Status:** open
**Cost:** 0 (sequencer, builder, verifier, motion prompts); regenerating root sheets with a neutral face: 200 each
**Blocked by:** none

## Problem
Goldilocks smiles while fleeing in slide 12. Slide 12's `shows` names no emotion, so the editor falls back to her reference sheet, which was drawn smiling (the prompt asked for a neutral pose, not a neutral face). The motion prompt ("looking ahead") adds nothing. The verifier checks presence only.

## Done when
Each slide gives every present character an `acting` line (expression + body, e.g. "terrified, mouth open screaming, arms flailing"); an emotion persists across a cut until a slide changes it; the edit prompt says the expression comes from the slide, not the reference; root sheets are neutral-faced; the verifier checks acting and position.
