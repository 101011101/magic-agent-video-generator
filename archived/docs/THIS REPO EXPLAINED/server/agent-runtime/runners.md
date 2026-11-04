# runners.ts

> Level 3 · Source: `server/src/runners.ts` · Up: [Agent Runtime](README.md)

**Purpose:** Run one project from queue to terminal status: route the request, stream the agent run, fall back to deterministic rendering, and write the final status.

**Role in parent:** Top-level orchestrator of the agent runtime. It drives the agent from [agents.md](agents.md) on the provider from [agentRuntime.md](agentRuntime.md), and writes token cost with [usageCost.md](usageCost.md).

**Main exports:**
- `queueProject(request, { start })` — Makes a new id, stores runtime credentials, initializes project state, sets status `queued`. If `start` is true (default), calls `scheduleProjectRun`.
- `scheduleProjectRun(projectId, request)` — Enqueues `runProject` on a module-level `ProjectRunScheduler`. While the run waits, it sets status `queued` with queue position, active count, and limit.
- `projectRunSchedulerStatus()` — Returns the scheduler snapshot (returned by `GET /api/health` as `project_run_scheduler`).
- `runProject(projectId, request)` — Main generation flow (see Internal flow).
- `runAgentUntilManifest(agent, brief, ctx, runFn, { maxAttempts, onRetry })` — Calls `runFn` up to `maxAttempts` times. Stops when `<project_dir>/manifest.json` exists. Returns `{ usage, attempts, manifestExists }`. `runFn` is injectable for tests.
- `runProjectMessage(projectId, message, credentials)` — Follow-up chat turn on an existing project. Runs `projectMessageAgentForContext(ctx)` streamed, writes token output, merges it into the manifest if one exists, appends the assistant reply with `appendProjectMessage`, sets stage `message_complete` or `message_failed`. Keeps the previous manifest on failure.
- `queueYoutubeReviewSession(request, { metadata, start_projects })` — Queues one project per provider in `YOUTUBE_REVIEW_PROVIDERS_ACTIVE` via `youtubeReviewProjectRequest`, then writes the review session payload (`review_id`, `prompt`, `settings`, `providers`).
- `runYoutubeReviewBatch(batchId)` — For each batch item and provider, runs `runProject` sequentially. Skips projects already `running`, `succeeded`, or `failed`. Always removes `batchId` from `RUNNING_YOUTUBE_REVIEW_BATCHES`.
- `startYoutubeReviewBatchWorker(batchId)` — Starts `runYoutubeReviewBatch` fire-and-forget. No-op if the batch is already in `RUNNING_YOUTUBE_REVIEW_BATCHES`.
- `reviewBatchHasQueuedProjects(payload)` — True if any provider project in the batch has status `queued`.
- `newId()` — `randomUUID()` without dashes.

**Internal flow (`runProject`):**
1. Store credentials, build `ctx` with `context()`, call `ensureProjectState`.
2. `classifyMagicHourRequest(request)`. If `needs_clarification`, or `unsupportedPlannedCapability` matches, write a clarification manifest with `requestClarificationImpl` and set status `succeeded` / stage `needs_input`. Stop.
3. Set stage `planning` (progress 10). Build agent (`projectAgentForRequest`), brief (`buildProjectRunBrief`), runtime (`resolveAgentRuntime`). Record `provider_settings` in project state.
4. `runAgentUntilManifest` with `runAgentStreamed`. Then `writeTokenOutput`.
5. No manifest: `youtube_clips` workflow → `createYoutubeShortFromPromptImpl`. Else plan artifact exists → `completeAcceptedVideoPlan`. Else, if a `draft_video_plan` decision has `validation_failed`, run `draftFallbackVideoPlanImpl` then `completeAcceptedVideoPlan`. Else throw ("without a persisted plan or manifest").
6. `mergeTokenOutputIntoManifest`. Set status `succeeded`: stage `complete` (message "Video is ready.", "Image is ready.", or partial with failed scene count), or `needs_input` for a `clarification` manifest.
7. On error, try recovery in order:
   - No manifest, plan or voiceover validation failed, no `images`/`videos`/`manifest` artifacts yet → deterministic fallback plan + `completeAcceptedVideoPlan` → `complete`.
   - Manifest has an existing `final_video_path` → keep it, `complete`.
   - `terminalYoutubeStatusFromManifest` returns a status → keep it, `complete`.
   - Else status `failed` with stage from `generationFailureStatus`.

**Internal helpers:**
- `runAgentStreamed(agent, input, ctx, runtime)` — Wrapped in `withTiming("agent.run_streamed")`. Calls `runnerForRuntime(runtime).run(cloneAgentForRuntime(...), { stream: true, maxTurns: configuredAgentMaxTurns(), signal })`.
  - Publishes each run item as `agent_event` via `projectEvents.emitProjectEvent` (shape from `describeRunItem`: `tool_name`, `arguments_preview` ≤400 chars, `output_preview` ≤2000, `text` ≤600/400). Also emits `agent_updated`.
  - Plan attempt limit: counts `draft_video_plan` outputs with `validation_failed` or "Draft plan failed first-run production quality checks". A passing output resets the count. Throws when count exceeds `MAX_STREAMED_PLAN_VALIDATION_FAILURES`, or at once on "Draft plan repair budget exhausted". Error text says it stops before paid provider calls.
  - OpenRouter transport errors (`terminated`, `fetch failed`, `econnreset`, `abort`, …): if output was emitted, a plan artifact exists, and stage is not `plan_validation_failed`, `voiceover_validation_failed`, `planning_failed`, or `voiceover_failed` → return `finalOutput: null` (event `agent.interrupted_handoff`). If no plan exists and it is attempt 1 → wait 750 ms and retry once (event `agent.openrouter.pre_output_retry`). Else rethrow.
- `completeAcceptedVideoPlan(ctx, tokenOutput)` — Deterministic completion. Throws if project state stage matches `validation_failed|failed|blocked` with an error. Runs only missing steps: `generateVoiceoverImpl` (skipped if `voiceover` artifact or all per-scene audio files exist), `generateSceneImagesImpl`, `animateSceneVideosImpl`, then `stitchFinalVideoImpl`. Throws if no scene videos exist.
- `generationFailureStatus(exc, state, current)` — Maps error text or current stage to a terminal stage: `configuration_failed`, `provider_limited`, `planning_failed`, `voiceover_failed`, `image_generation_failed`, `video_generation_failed`, `stitching_failed`, or `failed`.
- `summarizePlanValidationOutput(output)` — First 4 `issues` from JSON, or a cleaned text preview ≤800 chars.

**Depends on:**
- Internal: `agentRuntime.ts`, `agents.ts`, `prompts.ts`, `workflows.ts`, `usageCost.ts`, `projects.ts`, `projectContext.ts`, `renderState.ts`, `projectRunScheduler.ts`, `events.ts`, `timings.ts`, `runtimeCredentials.ts`, `magicHourCapabilities.ts`, `schemas.ts`, `config.ts`.
- Env vars (via `ENV`):
  - `AGENT_MANIFEST_ATTEMPTS` — outer agent passes (default 1).
  - `PROJECT_RUN_CONCURRENCY`, fallback `MAX_PARALLEL_PROJECT_RUNS` — scheduler limit; `auto`/`hardware`/invalid → `max(2, availableParallelism())`.
  - `AGENT_PLAN_VALIDATION_REPAIRS` — plan failure limit (min 2, default 2).
  - `AGENT_STREAM_TIMEOUT_MS` — stream abort timeout (min 60 000, default 12 min).

**Used by:**
- `server/src/index.ts` — imports `newId`, `projectRunSchedulerStatus`, `queueProject`, `queueYoutubeReviewSession`, `reviewBatchHasQueuedProjects`, `runProjectMessage`, `startYoutubeReviewBatchWorker`.
- `server/tests/runnerRetry.test.ts` — tests `runAgentUntilManifest`.

**Gotchas:**
- `AGENT_MANIFEST_ATTEMPTS` > 1 re-runs the full agent and can duplicate paid provider jobs. Code comment says to use it only for non-render dry runs or debugging.
- Clarification outcomes set status `succeeded`, not `failed`; check `stage === "needs_input"`.
- `runYoutubeReviewBatch` runs projects one at a time and calls `runProject` directly, so it bypasses the scheduler concurrency limit.
- Fallback recovery runs only before any visual provider artifact exists, to avoid re-rendering paid media.
