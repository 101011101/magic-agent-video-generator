# index.ts

> Level 3 · Source: `server/src/index.ts` · Up: [API and Transport](README.md)

**Purpose:** Fastify HTTP entry point of the backend. It exposes the REST API, the SSE event stream, and `/media/` static files.

**Role in parent:** It is the only HTTP surface. It validates requests, calls the project, runner, and workflow modules, and returns their JSON. It does no generation work itself.

**Main exports:** None. The module has side effects only: it builds the Fastify `app`, registers plugins and routes, and calls `app.listen`.

**Setup (in load order):**
- `Fastify({ logger: true, bodyLimit: 32 MB })`.
- Content-type parsers for `image/*` and `audio/*` → raw `Buffer` body, limit 30 MB (used by `/api/input-media`).
- `@fastify/cors` → origins `http://localhost:3000`, `http://127.0.0.1:3000`, `http://0.0.0.0:3000`; `credentials: true`.
- `@fastify/static` → serves `OUTPUT_DIR` at prefix `/media/`.
- Error handler → `HttpError` becomes `{ detail }` with its `statusCode`; any other error becomes 500 `{ detail: message }`. Zod `.parse` failures therefore return 500, not 400.
- Listen on `ENV.SERVER_PORT ?? ENV.PORT ?? 8000`, host `ENV.SERVER_HOST ?? "127.0.0.1"`. Listen failure → `process.exit(1)`.

**Routes:**
- `GET /api/health` → `status` (`ok` / `missing_config`), `output_dir`, `missing_config` (`missingConfiguration()`), `missing_dependencies` (`missingSystemDependencies()`), `active_projects` (count of `PROJECTS` in `queued`/`running`), `project_run_scheduler` (`projectRunSchedulerStatus()`), `provider_concurrency` (`providerConcurrencySnapshot()`).
- `GET /api/projects?limit=` → `{ projects: listProjectStatuses({ limit }) }`. Default limit 100.
- `POST /api/projects` → parse `CreateProjectRequestSchema` → `classifyMagicHourRequest(body)` → `assertRuntimeReady(body)` only if routing does not need clarification and `unsupportedPlannedCapability(capability_id)` is false → `queueProject(body)` → 202.
- `POST /api/input-media` → body must be a `Buffer`, else 400. Filename from header `x-file-name` (URI-decoded, raw value kept on decode error). Calls `storeInputMedia(buffer, name, content-type)`.
- `POST /api/providers/openrouter/models` → `fetchOpenRouterModels(body.api_key | null)` → `{ models }`.
- `POST /api/youtube-review-sessions` → `assertRuntimeReady()` → parse `YouTubeReviewSessionRequestSchema` → `queueYoutubeReviewSession` → 202 `youtubeReviewSessionResponse`.
- `POST /api/youtube-review-batches` → see Internal flow → 202 `youtubeReviewBatchResponse`.
- `GET /api/youtube-review-batches/latest` and `GET /api/youtube-review-batches/:batchId` → read batch (404 if missing); restart `startYoutubeReviewBatchWorker` if `reviewBatchHasQueuedProjects`.
- `GET /api/youtube-review-sessions/:reviewId` → `readYoutubeReviewSession` → 404 if missing.
- `POST /api/youtube-review-sessions/:reviewId/comments` → parse `YouTubeReviewCommentRequestSchema` → set `providers[provider].comments` and `comments_updated_at` → `writeYoutubeReviewSession`. 404 if session or provider is missing.
- `POST /api/projects/:projectId/messages` → see Internal flow → 202 updated status plus `project_state`.
- `PATCH /api/projects/:projectId/timeline` → parse `ProjectTimelineEditRequestSchema` → switch on `operation`: `inspect` → `inspectTimelineImpl`, `trim_clip` → `trimTimelineClipImpl`, `move_clip` → `moveTimelineClipImpl`, `set_final_hold` → `setFinalHoldImpl`; else 400. Returns existing status plus `project_state`, `timeline`, `timeline_summary`. Synchronous; no queueing.
- `GET /api/projects/:projectId` → `readProjectStatus` → 404 if missing.
- `GET /api/projects/:projectId/events` → SSE stream (see Internal flow).
- `GET /media/*` → files under `OUTPUT_DIR`.

**Internal flow:**
1. Review batch (`POST /api/youtube-review-batches`): `loadYoutubeReviewPromptSet()` (500 on failure) → `newId()` batch id → for each entry, `queueYoutubeReviewSession(entry.request, { metadata, start_projects: false })` → collect item (`prompt_id`, `name`, `category`, `prompt`, `settings`, `review_id`) → `writeYoutubeReviewBatch` with `prompt_set_path: YOUTUBE_REVIEW_PROMPT_SET_PATH` → `startYoutubeReviewBatchWorker(batchId)`.
2. Project message (`POST .../messages`): parse `ProjectMessageRequestSchema` → 404 if no status → `rememberProjectRuntimeCredentials(projectId, runtimeCredentialsFromRequest(body))` → `contextForExistingProject` → `assertProjectContextReady` → `appendProjectMessage(ctx, { role: "user" })` → `updateProjectStatus` to `queued` / `message_queued` (keeps `progress` and `manifest`) → fire-and-forget `runProjectMessage(...)` → 202.
3. SSE (`GET .../events`): 404 if `readProjectStatus` throws → write headers with `text/event-stream` → write `:ok` → replay `projectEvents.bufferedEvents(projectId)` → `projectEvents.subscribe(projectId, send)` → `:heartbeat` every 15 s → on client close, clear heartbeat and unsubscribe. Each frame: `event: <type>` + `data: <JSON>`.

**Depends on:**
- `./config.js` (`ENV`, `OUTPUT_DIR`, `YOUTUBE_REVIEW_PROMPT_SET_PATH`), `./concurrency.js`, `./agentRuntime.js`, [`./events.js`](events.md), `./magicHourCapabilities.js`, `./projectContext.js`, `./projects.js` (`HttpError`, `PROJECTS`, status and review-file helpers), `./renderState.js`, `./runtimeCredentials.js`, [`./inputMedia.js`](inputMedia.md), `./runners.js`, `./schemas.js`, `./workflows.js`.
- Packages: `fastify`, `@fastify/cors`, `@fastify/static`.
- Env vars: `SERVER_PORT`, `PORT`, `SERVER_HOST`; `OUTPUT_DIR` via `config.ts`.

**Used by:**
- Launch: `dev.sh` (sets `SERVER_HOST`, `SERVER_PORT`, runs `tsx src/index.ts`); `server/package.json` scripts `dev` (`tsx watch`) and `start`.
- HTTP clients: `frontend/lib/api.ts` (projects, input media, OpenRouter models, messages, timeline, review comments, review batches, `/media/` URLs); `frontend/hooks/use-project-events.ts` (`EventSource` on `/events`); `frontend/next.config.mjs` rewrites `/api/*` and `/media/*` to the backend.
- No frontend caller found for `POST /api/youtube-review-sessions`, `GET /api/youtube-review-sessions/:reviewId`, or `GET /api/youtube-review-batches/:batchId`.

**Gotchas:**
- The SSE route writes to `reply.raw` and sets its own CORS headers: it echoes any request `Origin` (or `*`), so it bypasses the `cors` plugin origin list.
- The SSE route returns 404 only when `readProjectStatus` throws, not when it returns `null`. Other project routes check both.
- In `PATCH .../timeline`, the project lookup runs before body validation, so an unknown project gives 404 even with a bad body.
- `POST .../messages` imports `updateProjectStatus` with a dynamic `import("./projects.js")`, while other `projects.js` helpers use a static import.
- `runProjectMessage` is not awaited; its errors do not reach the HTTP response.
