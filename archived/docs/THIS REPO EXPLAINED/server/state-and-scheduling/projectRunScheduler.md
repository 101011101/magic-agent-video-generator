# projectRunScheduler.ts

> Level 3 · Source: `server/src/projectRunScheduler.ts` · Up: [State and Scheduling](README.md)

**Purpose:** In-memory FIFO queue. It limits how many project runs execute at the same time.

**Role in parent:** Gives the server one gate for whole project runs. Runs above the limit wait in the queue until a slot opens.

**Main exports:**
- `ScheduledProjectRun` — task shape: `projectId`, `run: () => Promise<void>`, optional `onQueued(position, active, limit)`, optional `onStart(active, limit)`.
- `ProjectRunSchedulerSnapshot` — status shape: `active`, `queued`, `limit`, `queued_project_ids`.
- `class ProjectRunScheduler(limit)` — constructor throws `Invalid project run concurrency limit` if `limit` is not finite or is less than 1.
- `enqueue(task)` — pushes the task to the queue. Calls `onQueued` only if all slots are full. Then calls `drain()`.
- `snapshot()` — returns the current `ProjectRunSchedulerSnapshot`.

**Internal flow:**
1. `enqueue` adds the task to the end of `queue`.
2. If `active >= limit`, it calls `onQueued` with the queue length as position.
3. Private `drain()` loops while `active < limit` and the queue has tasks.
4. For each task: shift it from the queue, increment `active`, call `onStart`, call `run()`.
5. When `run()` settles (success or failure, via `.finally`), `active` decrements (floor 0) and `drain()` runs again.

**Depends on:** Nothing. No imports.

**Used by:**
- `server/src/runners.ts` — creates one module-level instance with `PROJECT_RUN_CONCURRENCY_LIMIT`. That limit comes from env `PROJECT_RUN_CONCURRENCY`, else `MAX_PARALLEL_PROJECT_RUNS`, else `auto` (`max(2, availableParallelism())`).
  - `scheduleProjectRun(projectId, request)` — enqueues `runProject`; `onQueued` writes a `queued` status with position via `updateProjectStatus`. Called by `queueProject`.
  - `projectRunSchedulerStatus()` — returns `snapshot()`.
- `server/src/index.ts` — `GET /api/health` returns `projectRunSchedulerStatus()` as `project_run_scheduler`.
- `server/tests/projectRunScheduler.test.ts` — tests the limit and the queue order.

**Gotchas:**
- State is in memory only. A server restart loses the queue; queued projects do not resume.
- `onQueued`, `onStart`, and `run()` are fire-and-forget (`void`). A rejected `onQueued` or `onStart` promise is not handled here.
- `run()` errors are not caught here; `.finally` only frees the slot. The caller must handle failures inside `run`.
- `onQueued` position is the queue length at push time. It does not update when earlier tasks start.
- This limits whole project runs only. Per-provider limits are in [concurrency.md](concurrency.md).
