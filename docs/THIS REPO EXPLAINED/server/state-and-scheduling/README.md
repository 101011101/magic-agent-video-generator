# State and Scheduling

> Level 2 · Up: [Server](../README.md)

**End product:** The per-project memory and throttle layer of the server. It gives each run one resolved `ProjectContext`, keeps project files under `outputs/<project_id>/`, keeps provider keys in memory only, limits how many project runs and provider calls run at the same time, and records timing spans.

**Parts:**
- [projects.md](projects.md) — `projects.ts`: project status registry (`PROJECTS`, `status.json`), `updateProjectStatus` / `readProjectStatus`, readiness checks (`assertRuntimeReady`), `OUTPUT_DIR` path helpers, YouTube review session/batch files.
- [projectContext.md](projectContext.md) — `projectContext.ts`: builds `ProjectContext` from a request (`context`) or from saved state (`contextForExistingProject`). Writes `user_preferences` and `provider_settings` into `project_state.json`.
- [renderState.md](renderState.md) — `renderState.ts`: the only JSON file layer. Artifact read/write (`<name>.json`), `project_state.json` read/patch/write, scene retry helpers.
- [runtimeCredentials.md](runtimeCredentials.md) — `runtimeCredentials.ts`: per-project credential `Map` in process memory. Request keys win over `ENV`. Never written to disk.
- [projectRunScheduler.md](projectRunScheduler.md) — `projectRunScheduler.ts`: FIFO queue that caps whole project runs.
- [concurrency.md](concurrency.md) — `concurrency.ts`: `AsyncLimiter` and the shared `providerConcurrency` limiters (Hume, Fish, ElevenLabs, Magic Hour submit).
- [timings.md](timings.md) — `timings.ts`: appends timing events to `timings.json`. `summarizeTimingEvents` gives per-name span stats.

**How the parts work together:**
1. `POST /api/projects` calls `assertRuntimeReady` (projects). It checks env keys, request credentials (runtimeCredentials), and `ffmpeg`/`ffprobe`.
2. `queueProject` (`runners.ts`) makes a new id and calls `rememberProjectRuntimeCredentials` (runtimeCredentials).
3. `queueProject` calls `initializeProjectState(context(projectId, request), request)` (projectContext). renderState writes `outputs/<project_id>/project_state.json`. Raw keys are removed; only `has_*` status is stored.
4. `updateProjectStatus` (projects) writes `status: "queued"` to `PROJECTS`, `status.json`, and the `status` block of `project_state.json` (renderState). It emits a `status` event.
5. `scheduleProjectRun` enqueues `runProject` on `ProjectRunScheduler`. When all slots are full, `onQueued` writes a `queued` status with the queue position.
6. `runProject` starts. It calls `context()` and `ensureProjectState` again. Workflows and agents then read and patch state through renderState and report progress through `updateProjectStatus`.
7. Provider calls in `media.ts` go through `providerConcurrency` limiters (concurrency). These limits are shared across all running projects.
8. `withTiming` / `recordTimingEvent` (timings) wrap agent runs, workflow stages, and provider calls. They write `timings.json` through renderState. The manifest build adds `timings_path` and `timings_summary`.
9. Follow-up messages (`POST /api/projects/:projectId/messages`) call `rememberProjectRuntimeCredentials`, then `contextForExistingProject` (keys from the in-memory map, else `ENV`), then `runProjectMessage`. This path does not go through `ProjectRunScheduler`.

**Key contracts:**
- Files per project in `OUTPUT_DIR/<project_id>/`: `status.json`, `project_state.json`, `timings.json`, `manifest.json`, plus other `<name>.json` artifacts through `artifactPath`.
- Context precedence, new run: request → request credentials → `ENV` → hard default. Existing project: `provider_settings` → `user_preferences` → stored credentials → `ENV` → hard default.
- Env vars: `PROJECT_RUN_CONCURRENCY` / `MAX_PARALLEL_PROJECT_RUNS` (default `max(2, availableParallelism())`), `HUME_TTS_CONCURRENCY` (1), `FISH_TTS_CONCURRENCY` (2), `ELEVENLABS_TTS_CONCURRENCY` (2), `MAGIC_HOUR_SUBMIT_CONCURRENCY` (5). All are read once at startup.
- `GET /api/health` returns `project_run_scheduler` (scheduler snapshot) and `provider_concurrency` (limiter snapshots).
- In memory only, lost on restart: `PROJECTS`, stored credentials, the run queue, limiter queues. After a restart, status comes from `status.json` / `manifest.json`, and keys come from `ENV` unless the next request sends them.
- No file locks. JSON read-modify-write is not atomic, so concurrent writers to the same project can lose updates.
