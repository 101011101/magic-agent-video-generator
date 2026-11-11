# FIX-204 — An upload named by the plan but absent on disk is silently ignored
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`pipeline-state-graph/run.mjs:45` copies `u1`–`u3` into the run only `if (existsSync(...))`. `Controller.registerUploads` (`src/controller.js:26`) then skips any entity whose upload is not in that map: `if (!e.upload || !uploads[e.upload] || …) continue;`.

So an entity declared with `upload: "u2"` whose file is missing is not an error — the entity simply never gets its upload frame, and is generated from scratch instead. The single most authoritative input a user can provide is dropped without a message.

## Evidence
Read from the code. `p1-grandma-v1` is the only upload case on record and its file was present, so this path has never been exercised.

## Done when
An entity declaring an upload that is not on disk stops the run with an error naming the entity and the expected path.
