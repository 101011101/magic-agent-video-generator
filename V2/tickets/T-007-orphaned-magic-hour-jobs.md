# T-007 · Orphaned Magic Hour jobs

status:     done (built 2026-10-30, not yet exercised by a crash)
priority:   high
subsystem:  lib

what:
`jobs.js` records the job id and its reserved cost under `pending[key]` the moment the POST returns, before polling; the
charge is booked the moment the job completes, before the download, and an empty download is an error. On the next request
for the same key, a pending job is RESUMED (`pollJob` by id), downloaded, recorded and booked once; only a job that errored
on the server side is forgotten and posted anew. The whole per-clip body (render and checks) is guarded so one failure never
kills a sibling render.

why:
When clip 6 of vanderbilt6 was rejected by the content filter, the thrown error ended the process while clip 5 was
rendering. Clip 5 finished on Magic Hour's side, was charged (about 672 credits), and was never downloaded or recorded;
the rerun paid for it again. The audit (H3, M6) found the per-item catch covered only the render, not the checks after it,
and that nothing ever read `pending`.

acceptance:
Kill the process during a render; the next run recovers the clip without a new charge (the log says "resumed job <id>"),
or the earlier `calls` entry carries the id. No sibling render is lost when one item fails. Covered by the guarded loop
case in `V2/tests/audit.test.mjs`; the crash case awaits a real run.
