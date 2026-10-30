# HUNT-202 — Two runs of the same label race on run.json and can lose paid job records
**Status:** open
**Category:** 04-bug-hunting
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
There is no lockfile anywhere in `current/prod` (`grep` for `O_EXCL|flock|lockfile` returns nothing). Each process loads `run.json` into memory at start (`run.mjs:38`) and rewrites the whole file on every `jobs.save()`.

Two processes on the same `--label` therefore each hold a stale `log.jobs` and overwrite the other's. A job paid for by process A can vanish from the record when B saves, after which a third run re-pays for it. The ledger is recomputed from `log.calls`, so lost calls also understate lifetime spend.

## Evidence
Read from the code; no observed instance. Worth checking because this session has already run background pipelines while editing, and `f1-red-riding-hood-anime-v1` appeared in the ledger from outside this conversation — concurrent use is evidently real.

## Done when
Either an exclusive lock on the run directory refuses the second process, or job records are appended rather than rewritten wholesale.
