# PRD-024 — An entity may not enter during a beat, so entrances are inexpressible
**Status:** open
**Category:** 01-prd
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`prod/pipeline-state-graph/src/timeline.js` template: "Every character and prop that appears anywhere in a beat is already visible in the beat's start frame (an entrance happened before the beat...). Nothing with an identity enters during a beat, because the video model would invent it." A character walking into frame is among the most basic actions in film. A real limitation of one video model has been promoted into a rule of the type system, where it constrains every future tool as well.

## Evidence
The template text above. The stated reason is the model's behaviour, not a property of video — so the constraint sits at the wrong layer.

## Done when
The restriction is expressed as a per-tool constraint in the tool signature rather than a rule of the representation, so a tool able to accept an entrant (a reference-conditioned model, or a composite) can be selected for a beat with an entrance.
