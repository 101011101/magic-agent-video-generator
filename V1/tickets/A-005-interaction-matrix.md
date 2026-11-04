# A-005 — Asset interaction matrix and constraints
**Status:** open
**Cost:** 0 (LLM only)
**Blocked by:** none

## Problem
The asset seed bank specs each asset against the set, but nothing records which assets interact or contain each other, so pairs
that must agree are generated independently: the cottage's outside door (woodland plate) and inside door (cottage plate); a
character and what it carries (Red and her basket); a prop worn by another later (Grandmother's nightcap on the wolf).

## Done when
After the asset list, one pass builds a matrix of asset × asset (and place × place) with the relation: contains (house ⊃ rooms),
carries, wears, interacts. For each related pair an LLM decides whether a constraint is needed and writes it into both specs
(the door's side and colour match inside and out; the basket's size fits Red's hand; the nightcap fits over the wolf's ears).
Sheets and plates are then generated from the constrained specs.
