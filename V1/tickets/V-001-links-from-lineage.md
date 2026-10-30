# V-001 — Connected vs cut, derived from lineage
**Status:** done
**Cost:** 0
**Blocked by:** none

## Problem
The slideshow did not say which slides join into one continuous shot and which are cuts. The plan's `continues` flag missed edits of the previous slide (2→3→4 were not flagged).

## Done when
`src/links.js` marks slide k connected when slide k+1's base is slide k's frame; the slideshow shows ⟶ / ✂ on every slide and in the dots. Goldilocks v1: connected 2→3, 3→4, 5→6, 10→11; 8 cuts.
