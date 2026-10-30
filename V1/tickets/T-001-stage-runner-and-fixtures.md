# T-001 — Stage runner and fixtures
**Status:** open
**Cost:** 0
**Blocked by:** none

## Problem
Stages can only be run through the whole pipeline (with flags such as --seed-only), so testing one stage means running or
caching everything before it.

## Done when
Each stage reads and writes one JSON file in the run directory; `node cleaned/stage.mjs <stage> --run <dir>` runs one stage;
`cleaned/tests/fixtures/` holds hand-checked inputs (a perfect blocking, a story with a known hole, a story with containers) and a
stage can be run on a fixture alone. `run.mjs` runs all stages in order for any natural-language prompt.
