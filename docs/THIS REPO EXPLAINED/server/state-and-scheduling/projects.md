# projects.ts

> Level 3 · Source: `server/src/projects.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Project registry, status records, output paths, readiness checks, and YouTube review session/batch files.

**Role in parent:** Holds the in-memory project registry (`PROJECTS`) and the on-disk `status.json`. Mirrors status into `project_state.json` (through [renderState.md](renderState.md)). Gives safe path helpers for `OUTPUT_DIR`.

**Main exports:**
- `PROJECT_ID_PATTERN` — `/^[a-f0-9]{32}$/`. Validates project, review, and batch ids.
- `PROJECTS: Map<string, JsonDict>` — in-memory registry of the last status payload per project id.
- `YOUTUBE_REVIEW_PROVIDERS_ACTIVE` — `["youtube_data_api"]`.
- `RUNNING_YOUTUBE_REVIEW_BATCHES: Set<string>` — batch ids that run now. Stops duplicate batch runs.
- `HttpError(statusCode, detail)` — error class. `index.ts` error handler sends `{ detail }` with `statusCode`.
- `missingConfiguration(request?)` — returns missing keys from `REQUIRED_ENV_KEYS`. Skips a key when request credentials or the chosen provider cover it. Normalizes `audio_provider` to `fish` / `elevenlabs` / `hume` (default `hume`). Adds `ELEVENLABS_API_KEY` for `elevenlabs`.
- `missingContextConfiguration(ctx)` — same check against a `ProjectContext`: agent key (`OPENROUTER_API_KEY` or `OPENAI_API_KEY`), `MAGIC_HOUR_API_KEY`, and the audio provider keys.
- `missingSystemDependencies()` — returns commands from `REQUIRED_SYSTEM_COMMANDS` (`ffmpeg`, `ffprobe`) that `which` cannot find.
- `assertRuntimeReady(request?)` / `assertProjectContextReady(ctx)` — throw `HttpError(503, { message, missing_config, missing_dependencies })` when config or commands are missing. Both also check `has_api_key` of the resolved agent runtime.
- `projectDirFor(projectId)` — returns `OUTPUT_DIR/<projectId>`. Throws on an invalid id.
- `statusFileFor(projectId)` — returns `<projectDir>/status.json`.
- `publicMediaPath(mediaPath)` — converts a file under `OUTPUT_DIR` to a `/media/...` URL. Throws for a path outside `OUTPUT_DIR`.
- `withMediaUrl(asset)` — copies `asset` and adds `url` from `asset.path`.
- `slugifyFilename(value, { fallback, maxLength })` — lowercase dash slug. Default fallback `youtube-short`, max 80 chars, cuts at the last dash.
- `exportYoutubeFinalVideo(ctx, manifest)` — for `workflow === "youtube_clips"` only. Copies `final_video_path` to `MH_AGENT_YT_CLIPS_DIR/<slug(prompt)>__<id[0..8]>.mp4`. Returns manifest with `exported_final_video_path`.
- `updateProjectStatus(projectId, { status, stage, progress, message, manifest?, error? })` — main status writer. See internal flow.
- `readProjectStatus(projectId)` — main status reader. See internal flow.
- `terminalYoutubeStatusFromManifest(projectId, manifest)` — builds a `succeeded` / `complete` / 100 payload when a `youtube_clips` manifest has `render_status` `complete` or `partial`, has `videos`, and has an existing `final_video_path` file or a `final_video_url`. Else `null`.
- `listProjectStatuses({ limit })` — merges ids from `PROJECTS` and project dirs in `OUTPUT_DIR`. Sorts by `updated_at` descending. `limit` clamps to 1–500, default 100.
- Review file helpers — `reviewDirFor` / `reviewFileFor` (`OUTPUT_DIR/reviews/<id>/review.json`), `reviewBatchDirFor` / `reviewBatchFileFor` (`OUTPUT_DIR/reviews/batches/<id>/batch.json`), `read`/`writeYoutubeReviewSession`, `read`/`writeYoutubeReviewBatch`, `latestYoutubeReviewBatch()` (newest `batch.json` by mtime).
- `loadYoutubeReviewPromptSet(path = YOUTUBE_REVIEW_PROMPT_SET_PATH)` — parses a JSONL file into `ReviewPromptEntry[]` (`prompt_id`, `name`, `category`, `request`). Validates each request with `YouTubeReviewSessionRequestSchema`. Defaults: `aspect_ratio` `9:16`, `resolution` `720p`. Throws when the file has no prompts.
- `youtubeReviewProjectRequest(request, provider)` — builds a `CreateProjectRequest` with `workflow: "youtube_clips"`, the given `youtube_search_provider`, `youtube_allow_provider_fallback: false`, and all model/voice fields `null`.
- `youtubeReviewSessionResponse(payload)` / `youtubeReviewBatchResponse(payload)` — API response shapes. Add per-provider status, `latency_seconds`, and manifest render fields.
- Minor helpers — `parseIsoDatetime(value)`, `projectLatencySeconds(startedAt, status)` (ends at `updated_at` for `succeeded`/`failed`, else now).

**Internal flow:**
1. `updateProjectStatus` builds `{ project_id, status, stage, progress (0–100), message, updated_at, status_url: /api/projects/<id> }`, plus `manifest` / `error` when given.
2. It sets `PROJECTS`, writes `status.json`, and (only when `project_state.json` exists) calls `updateProjectState` with the `status` block.
3. It emits a `status` event with `projectEvents.emitProjectEvent`.
4. `readProjectStatus` reads `project_state.json` (if present), then takes status from `PROJECTS`, else `status.json`, else `manifest.json` (synthesizes a `succeeded` payload), else returns `null`.
5. For a non-terminal status, the repair step loads the manifest (payload or `manifest.json`). If `terminalYoutubeStatusFromManifest` returns a payload, it overwrites `PROJECTS`, `status.json`, and the state `status` block with `succeeded`.
6. The returned payload carries `project_state` when that file exists.

**Depends on:** `config.ts` (`ENV`, `OUTPUT_DIR`, `MH_AGENT_YT_CLIPS_DIR`, `REQUIRED_ENV_KEYS`, `REQUIRED_SYSTEM_COMMANDS`, `YOUTUBE_REVIEW_PROMPT_SET_PATH`), `context.ts` (`PROJECT_CONTEXT_DEFAULTS`), `agentRuntime.ts`, `events.ts`, [renderState.md](renderState.md), [runtimeCredentials.md](runtimeCredentials.md), `schemas.ts`, `execa`.

**Used by:**
- `server/src/index.ts` — `HttpError` error handler, `/api/health`, `/api/projects`, readiness checks, YouTube review session/batch routes, `updateProjectStatus` on message queue.
- `server/src/runners.ts` — `PROJECTS`, `RUNNING_YOUTUBE_REVIEW_BATCHES`, status read/write, review session/batch runs.
- `server/src/workflows.ts` — `exportYoutubeFinalVideo`, `PROJECT_ID_PATTERN`, `publicMediaPath`, `updateProjectStatus`, `withMediaUrl`.
- `server/src/agents.ts` — `updateProjectStatus`.
- [projectContext.md](projectContext.md) — `projectDirFor`.
- `server/tests/agentContracts.test.ts` — `YOUTUBE_REVIEW_PROVIDERS_ACTIVE`.

**Gotchas:**
- This file does not create projects or `project_state.json`. `initializeProjectState` / `ensureProjectState` in [projectContext.md](projectContext.md) do that.
- `PROJECTS` is in-memory only. After a restart, status comes from `status.json` or `manifest.json`.
- `updateProjectStatus` skips the `project_state.json` mirror when that file does not exist yet.
- `readProjectStatus` can write files (repair step), so a read can change `status.json`.
- `index.ts` imports `updateProjectStatus` only with a dynamic `import("./projects.js")` in the message route. Other `projects.js` helpers use a static import.
