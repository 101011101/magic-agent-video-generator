# FIX-202 — A zero-byte download is cached as a valid output forever
**Status:** open
**Category:** 05-bug-fixes
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`state-manager/src/magichour.js:54` writes the response body with no size or decode check: `writeFileSync(file, Buffer.from(await res.arrayBuffer()))`. A truncated or empty body produces a 0-byte file.

`pipeline-state-graph/src/jobs.js:43` decides a job is cached on `existsSync(join(this.runDir, file)) && j?.sig === sig`. A 0-byte file satisfies `existsSync`, so the job is never retried — the empty output is cached for the life of the run directory. ffmpeg then fails downstream with an error that names neither the job nor the cause, and the only recovery is deleting the file by hand.

There is no file-size or validity check anywhere in `current/prod`.

## Evidence
Read from the code. `grep` for `statSync|byteLength|\.size` across `current/prod` returns only `Set.size` uses in `solver.js`, `render.js` and `judge.js` — no output validation anywhere.

## Done when
An output of zero bytes, or one that the relevant decoder rejects, is treated as a failed job rather than a cached success, and `jobs.js` will re-run it.
