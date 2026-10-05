# Server

> Level 1 · Up: [THIS REPO EXPLAINED](../README.md)

**End product:** A local Fastify backend in `server/` (TypeScript, `@openai/agents`, entry `server/src/index.ts`). Input: one prompt plus optional image/audio uploads. Output, written to `outputs/<project_id>/` and streamed to the frontend over SSE, is one of these:
- a multi-scene `final.mp4` (workflow `generated`)
- a standalone image (manifest workflow `standalone_image`)
- a YouTube source-clip short (workflow `youtube_clips`)
- a clarification question set (manifest workflow `clarification`, stage `needs_input`)

**Parts:**
- [api-and-transport](api-and-transport/README.md) — HTTP entry. Fastify routes, request validation, `projectEvents` SSE bus, input media upload, `/media/` static serving of `OUTPUT_DIR`. Does no generation work.
- [foundation](foundation/README.md) — Shared base. `ENV` / `OUTPUT_DIR` loading, the `ProjectContext` shape, Zod wire and plan schemas (`CreateProjectRequestSchema`, `VideoPlanSchema`). No business logic.
- [agent-runtime](agent-runtime/README.md) — OpenAI Agents SDK layer. Tool definitions over workflow `*Impl` functions, OpenAI Responses vs OpenRouter Chat Completions selection, streamed runs, run fallbacks, token cost (`token_output.json`).
- [decision-and-planning](decision-and-planning/README.md) — Deterministic, free logic. Capability routing (`classifyMagicHourRequest`), clarification slots, creative intent, brief compilation (`buildProjectRunBrief`), plan validators, `PlanReadinessReport`.
- [media-pipeline](media-pipeline/README.md) — Accepted plan → media. `workflows.ts` artifact state machine, Magic Hour image / image-to-video / talking photo, Hume / Fish / ElevenLabs TTS, timeline, `ffmpeg` stitch, edit operations.
- [youtube-workflow](youtube-workflow/README.md) — Source-clip path. YouTube Data API search with key rotation, ranking subagents, transcripts, VLM frame check, `yt-dlp` download, clip records.
- [state-and-scheduling](state-and-scheduling/README.md) — Per-project JSON state (`status.json`, `project_state.json`, artifacts), in-memory credentials, `ProjectRunScheduler`, `providerConcurrency` limiters, `timings.json`.
- [tests](tests/README.md) — Vitest suites. Maps each test file to the module and contract it guards. Provider calls are mocked or stubbed.

**How the parts work together:**
1. Upload: the frontend sends each file to `POST /api/input-media`. `storeInputMedia` (api-and-transport) returns `id` and a `/media/input_media/...` URL.
2. Create: `POST /api/projects` parses the body with `CreateProjectRequestSchema` (foundation). `classifyMagicHourRequest` (decision-and-planning) routes it. If no clarification is needed and the capability is wired, `assertRuntimeReady` (state-and-scheduling) checks keys and `ffmpeg`/`ffprobe`. The route returns `202`.
3. Queue: `queueProject` (agent-runtime `runners.ts`) stores request credentials in memory, writes `project_state.json` through `context()` + `initializeProjectState` (state-and-scheduling), sets status `queued`, and puts `runProject` on `ProjectRunScheduler`.
4. Route again: `runProject` rebuilds the `ProjectContext` and calls `classifyMagicHourRequest` again. Missing information or a planned (not wired) capability → `requestClarificationImpl` writes a clarification manifest. The run ends with stage `needs_input` and no paid call.
5. Brief and agent: `buildProjectRunBrief` (decision-and-planning) compiles the brief. `projectAgentForRequest` (agent-runtime) builds the "First-Render Video Art Director" agent. The tool set depends on the request:
   - `youtube_clips` → `create_youtube_short_from_prompt`, `inspect_render_status`, `record_project_decision`.
   - `standalone_image` → `request_clarification`, `generate_magic_hour_images`, inspect, record.
   - Else → `request_clarification`, `draft_video_plan`, `generate_voiceover`, `generate_scene_images`, `animate_scene_videos`, `stitch_final_video`, inspect, record.
6. Run: `runAgentStreamed` runs the agent. Each run item goes out as an `agent_event` on `projectEvents`. Each tool calls one `*Impl` in `workflows.ts` (media-pipeline).
7. Plan gate: `draftVideoPlanImpl` runs the decision-and-planning validators. Blocking issues → `repair_required`, and the agent must call `draft_video_plan` again. `plan.json` is saved only on `ready`. Paid visual generation needs a saved plan.
8. Render: `workflows.ts` calls provider primitives in `media.ts` and reads the same scene-audio, continuity, and TTS rules again. `providerConcurrency` limiters throttle provider calls across all projects. `withTiming` writes `timings.json`.
9. YouTube: `createYoutubeShortFromPromptImpl` (agent-runtime `agents.ts`) drafts the script, then `createYoutubeShortImpl` (media-pipeline) calls `downloadYoutubeClipAssets` (youtube-workflow), adds per-section TTS, and stitches `final.mp4`.
10. Fallback: if the agent ends without `manifest.json`, `runProject` continues without the agent:
    - `youtube_clips` → `createYoutubeShortFromPromptImpl`.
    - Saved `plan.json` → `completeAcceptedVideoPlan` runs voiceover → images → videos → stitch.
    - No plan, but a `draft_video_plan` validation failure is recorded → `draftFallbackVideoPlanImpl`, then `completeAcceptedVideoPlan`.
11. Finish: `writeTokenOutput` writes `token_output.json`. `mergeTokenOutputIntoManifest` adds it to the manifest. `updateProjectStatus` writes `status.json` and emits a `status` event.
12. Read: the frontend reads `GET /api/projects/:projectId/events` (buffered replay, then live events, 15 s heartbeat) and `GET /api/projects/:projectId`. It plays media from `/media/<project_id>/...`.
13. Edits:
    - `POST /api/projects/:projectId/messages` → `contextForExistingProject`, then `runProjectMessage` with the edit agent. It does not go through `ProjectRunScheduler`. Only this agent gets edit tools (`regenerate_scene`, `revise_narration`, `replace_voiceover`, `trim_clip`, `move_clip`, `set_final_hold`, `restitch_video`, `restitch_timeline`, `retry_scene`).
    - `PATCH /api/projects/:projectId/timeline` calls timeline `*Impl` functions directly. No agent. Synchronous.
14. YouTube review: `/api/youtube-review-sessions*` and `/api/youtube-review-batches*` call `queueYoutubeReviewSession` (one project per provider through `queueProject`). `startYoutubeReviewBatchWorker` runs queued batch projects one at a time through `runProject`.

**Key contracts:**
- **Module layering:** foundation has no business logic and is imported by all. decision-and-planning is pure (no provider call). Only `workflows.ts` and `youtubeShort.ts` import `media.ts`. `workflows.ts` calls `downloadYoutubeClipAssets`. Project artifacts and `project_state.json` go through `renderState.ts`.
- **HTTP:** `GET /api/health`, `GET|POST /api/projects`, `GET /api/projects/:projectId`, `GET /api/projects/:projectId/events`, `POST /api/projects/:projectId/messages`, `PATCH /api/projects/:projectId/timeline` (`inspect`, `trim_clip`, `move_clip`, `set_final_hold`), `POST /api/input-media`, `POST /api/providers/openrouter/models`, `/api/youtube-review-sessions*`, `/api/youtube-review-batches*`, `GET /media/*`.
- **Errors:** `HttpError` → its status with `{ detail }`. Any other error, including a Zod `.parse` failure → 500 `{ detail }`.
- **Files on disk:** `outputs/<project_id>/` holds `status.json`, `project_state.json`, `plan.json`, `voiceover.json`, `images.json`, `videos.json`, `timeline.json`, `failed_scenes.json`, `timings.json`, `token_output.json`, `manifest.json`, `final.mp4`. `manifest.json` is the run end signal.
- **Workflows:** `WORKFLOW_MODES = ["generated", "youtube_clips"]`. Agent providers: `openai` | `openrouter`.
- **Credential precedence:** request `runtime_credentials` → in-memory project credentials → `process.env` → `<ROOT>/.env`. Project JSON stores only `has_*` flags, never key values.
- **Env:**
  - Server: `SERVER_PORT` / `PORT` (default `8000`), `SERVER_HOST` (default `127.0.0.1`), `OUTPUT_DIR` (default `<ROOT>/outputs`).
  - Agent: `AGENT_MODEL_PROVIDER`, `OPENAI_MODEL`, `OPENROUTER_MODEL`, `AGENT_MODEL_INTENSITY`, `AGENT_MANIFEST_ATTEMPTS`, `AGENT_PLAN_VALIDATION_REPAIRS`, `AGENT_STREAM_TIMEOUT_MS`.
  - Concurrency: `PROJECT_RUN_CONCURRENCY` / `MAX_PARALLEL_PROJECT_RUNS` (default `max(2, availableParallelism())`), `HUME_TTS_CONCURRENCY`, `FISH_TTS_CONCURRENCY`, `ELEVENLABS_TTS_CONCURRENCY`, `MAGIC_HOUR_SUBMIT_CONCURRENCY`.
  - Provider keys and YouTube vars: see child docs.
- **System commands:** `ffmpeg` and `ffprobe` are required. The YouTube path also needs `yt-dlp` (or `YT_DLP_PATH`).
- **Limits:**
  - In process memory only, lost on restart: `PROJECTS`, credentials, run queue, limiter queues, SSE buffers (last 500 events per project).
  - No authentication. `/media/` serves the whole output directory.
  - No cancellation API, no idempotency key, no file locks on project JSON.
  - Token cost covers LLM calls only. Magic Hour, TTS, and ffmpeg are excluded.
