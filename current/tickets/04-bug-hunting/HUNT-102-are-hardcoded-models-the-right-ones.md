# HUNT-102 — Were `nano-banana-pro` and `wan-3.0` ever compared against alternatives?
**Status:** open
**Category:** 04-bug-hunting
**Cost:** see 03-tests
**Approval:** required-not-given
**Blocked by:** none

## Problem
Both models are hardcoded (SM-100). There is no record in the repo of a comparison that selected them over the alternatives, and the positioning in the research notes suggests `wan-3.0` was chosen for end-frame control and native audio — neither of which is the dominant failure class. Action adherence is.

## Evidence
`current/prod/state-manager/README.md` records measured **end-frame** behaviour across wan-3.0, kling-3.0, veo3.1-lite, seedance-1.5 and gemini-omni-1.1 — that is a real comparison, but on end-frame fidelity, a capability the live pipelines no longer use (`pipeline-v2/README.md:18` — "No end frames"). No comparison exists on action adherence, which is what the judges actually penalise.

## Done when
A like-for-like comparison exists on the failure class that dominates, holding start frame and prompt fixed. Note the constraint before running it: `wan-2.2` supports neither end frames nor audio, so a win there is an architectural decision, not a config change.
