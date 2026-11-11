# types.ts

> Level 3 · Source: `frontend/lib/types.ts` · Up: [Data layer](README.md)

**Purpose:** Hand-written TypeScript mirrors of server request bodies, response bodies, project state, video plan, timeline, and SSE event shapes.

**Role in parent:** Gives the data layer one shared type vocabulary. [api.md](api.md), the hooks, and the UI components type their data with it. Type-only file: no runtime code, no validation.

**Main exports:**
- **Request payloads**
  - `CreateProjectPayload` — body for `POST /api/projects`: `prompt`, `workflow`, `aspect_ratio`, `resolution`, optional `duration_seconds`, `scene_count`, image/video model and resolution, `youtube_search_provider`, agent provider/model/intensity, audio provider and Hume/ElevenLabs voice fields, `input_media`, `runtime_credentials`, `openrouter_api_key`.
  - `ProjectMessagePayload` — body for `POST /api/projects/:projectId/messages`: `message`, optional `runtime_credentials`.
  - `TimelineEditPayload` — discriminated union on `operation` for `PATCH /api/projects/:projectId/timeline`: `inspect`, `trim_clip`, `move_clip`, `set_final_hold`.
  - `YouTubeReviewCommentPayload` — `provider` + `comments` for review-session comments.
  - `RuntimeCredentials` — optional per-request API keys (`openai_api_key`, `openrouter_api_key`, `magic_hour_api_key`, `fish_audio_api_key`, `fish_audio_reference_id`, `hume_api_key`, ElevenLabs key/voice).
  - `InputMedia` — uploaded reference file: `id`, `kind` (`"image" | "audio"`), `name`, `mime_type`, `url`.
- **Option unions** — `WorkflowMode` (`generated`, `youtube_clips`), `AgentModelProvider`, `AgentModelIntensity`, `AudioProvider`, `YouTubeSearchProvider`, `YouTubeReviewProvider` (`YouTubeSearchProvider` minus `auto`), `MagicImageModel`, `MagicImageResolution`, `MagicVideoModel`.
- **Plan and assets** — `SceneSpec` (`id`, `narration`, `image_prompt`, `video_prompt`, `duration_seconds`, optional `audio_mode`, `audio_note`), `VideoPlan` (`title`, `narration`, `aspect_ratio`, `resolution`, `scenes`), `GeneratedImage`, `GeneratedSegment` (adds `youtube_search_benchmark` attempts for YouTube clips).
- **Cost** — `TokenOutput`: `provider`, `model`, `usage` token counts, `cost` in USD.
- **Render result** — `WorkflowManifest`: project metadata, chosen models, `render_status` (`"complete" | "partial"`), completed/failed scene counts, `failed_scenes`, `plan`, `images`, `videos`, `voiceover`, `token_output`, `gpt_cost_usd`, `final_video_path`/`final_video_url`, `manifest_path`, optional `timeline`.
- **Timeline** — `TimelineTrackKind` (`video`, `narration`, `guard`), `TimelineEndBehavior` (`cut`, `freeze`, `fade`), `TimelineClip` (source and timeline start/end, `duration`, `locked`), `TimelineTrack`, `TimelineArtifact` (`version: 1`, `tracks`, `ending` hold info).
- **Project state** — `ProjectState`: persisted agent memory (`status`, `user_preferences`, `provider_settings`, `current_plan`, `scene_assets`, `timeline`, `failures`, `decisions`, `messages`).
- **Status responses** — `ProjectStatus` (`queued`, `running`, `succeeded`, `failed`), `ProjectStage` (known stage names plus open `string`), `CreateProjectResponse` (`project_id`, `status`, `stage`, `progress`, `message`, `updated_at`, `status_url`, optional `manifest`, `project_state`, `error`), `ProjectStatusResponse` (alias of `CreateProjectResponse`), `ProjectListResponse` (`projects` array).
- **Live events** — `ProjectActivityEvent`: one SSE item from `GET /api/projects/:projectId/events`; `type` is `"status" | "agent_event" | string`; optional tool fields (`tool_name`, `arguments_preview`, `output_preview`), agent fields (`agent_name`, `text`), and status fields (`status`, `stage`, `progress`, `message`, `error`).
- **Provider catalog** — `OpenRouterModelInfo`: `id`, `name`, `context_length`, `supported_parameters`, `pricing`.
- **YouTube review** — `YouTubeReviewProviderResult`, `YouTubeReviewSessionResponse` (`providers` keyed by `YouTubeReviewProvider`), `YouTubeReviewBatchItem`, `YouTubeReviewBatchResponse`.

**Depends on:** Nothing. Shapes mirror server code in `server/src/schemas.ts` (zod schemas and option lists), `server/src/timeline.ts`, `server/src/events.ts`.

**Used by:**
- [api.md](api.md) (`frontend/lib/api.ts`) — return and argument types of every fetch function.
- [clarifying-questions.md](clarifying-questions.md) — `WorkflowMode`.
- [use-project.md](use-project.md) — payload and response types for queries and mutations.
- [use-project-events.md](use-project-events.md) — `ProjectActivityEvent`.
- `frontend/app/page.tsx` — `ProjectStatusResponse`, `RuntimeCredentials`, `TimelineEditPayload`, `YouTubeReviewProvider`.
- `frontend/components/chat-workspace.tsx` — create-form options, `InputMedia`, `OpenRouterModelInfo`, timeline types, `ProjectActivityEvent`.
- `frontend/components/youtube-review-workspace.tsx` — YouTube review types.

**Gotchas:**
- Types are copied by hand, not generated from server zod schemas. Server changes do not break the frontend build; update both sides together.
- `SceneSpec` and `VideoPlan` are partial: server `SceneSchema`/`VideoPlanSchema` also have `on_camera`, `audio_source`, `native_audio_prompt`, `reference_media_ids`, `continuity`, `creative_vibe`, `visual_bible`, `voice`.
- `ProjectStage`, `ProjectActivityEvent.type`, and `WorkflowManifest.workflow` accept any `string`, so exhaustive `switch` checks do not work.
- `ProjectState.current_plan` is `Record<string, unknown>`, not `VideoPlan`.
