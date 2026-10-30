# HUNT-101 — Would a deterministic composite beat the editor on scale and identity?
**Status:** open
**Category:** 04-bug-hunting
**Cost:** see 03-tests
**Approval:** required-not-given
**Blocked by:** HUNT-100

## Problem
SM-102 and SM-103 together propose replacing some generative edits with a composite path: `image-background-remover` (5 credits) to isolate a subject from an accepted frame, then place it into the target frame at a known scale. The two failure classes this should fix are prop scale (24 recorded `size` faults) and identity (11). Nobody has tried it, and it may simply look wrong — lighting and perspective will not match.

## Evidence
None. The cost argument is sound (5 credits versus 200 per `ai-image-editor` call) but cost is not the question; fidelity is. Listing it as a hunt rather than a fix for exactly that reason.

## Done when
One frame is built both ways from the same source and the same target, and both are judged against the same criteria. Report which wins on scale accuracy, identity and overall plausibility — including the honest possibility that the composite is cheaper and worse.
