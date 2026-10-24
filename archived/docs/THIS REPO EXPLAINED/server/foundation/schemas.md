# schemas.ts

> Level 3 · Source: `server/src/schemas.ts` · Up: [Foundation](README.md)

**Purpose:** Zod schemas, enum lists, model capability tables, and shared types for HTTP request bodies, agent structured output, and the `VideoPlan`.

**Role in parent:** Gives every subsystem one source of truth for wire shapes and plan shapes. Most modules import only types from here. `.parse()` / `.safeParse()` callers: `index.ts`, `agents.ts`, `workflows.ts`, `projects.ts`, `runners.ts`, `projectContext.ts`, `youtubeSubagents.ts`.

**Main exports:**
- Enum lists (`as const` arrays, each with a matching type):
  - `ASPECT_RATIOS` (`9:16`, `16:9`, `1:1`), `RESOLUTIONS` (`480p`, `720p`, `1080p`).
  - `WORKFLOW_MODES` (`generated`, `youtube_clips`).
  - `YOUTUBE_SEARCH_PROVIDERS` (`auto`, `youtube_data_api`, `yt_dlp`), `YOUTUBE_REVIEW_PROVIDERS`.
  - `AGENT_MODEL_PROVIDERS` (`openai`, `openrouter`), `AGENT_MODEL_INTENSITIES` (`standard`, `pro`, `max`).
  - `AUDIO_PROVIDERS` (`fish`, `hume`, `elevenlabs`), `AUDIO_MODES` (9 voice delivery presets), `SCENE_AUDIO_SOURCES` (`voiceover`, `speech_driven`, `native_scene_audio`).
  - `VIDEO_VIBES` (9 creative vibes).
  - `MAGIC_IMAGE_MODELS`, `MAGIC_IMAGE_RESOLUTIONS`, `MAGIC_IMAGE_STYLE_TOOLS`, `MAGIC_VIDEO_MODELS` — Magic Hour option names. The two model lists include `default`.
  - `YOUTUBE_SEARCH_ORDERS`, `YOUTUBE_VIDEO_DURATIONS`, `YOUTUBE_VIDEO_CATEGORIES`.
- Capability tables (`Record<string, Set<...>>`):
  - `MAGIC_IMAGE_MODEL_RESOLUTIONS` — allowed resolutions per image model.
  - `MAGIC_VIDEO_MODEL_RESOLUTIONS` — allowed resolutions per video model.
  - `MAGIC_VIDEO_MODEL_DURATIONS` — allowed clip seconds per video model (for example `kling-2.5`: 5, 10; `sora-2`: 4–60 in steps).
- Prompt text constants: `IMAGE_PROMPT_DESCRIPTION`, `VIDEO_PROMPT_DESCRIPTION` — `.describe()` text for `image_prompt` / `video_prompt`. They tell the planner model the keyframe and animation rules.
- Plan schemas (agent structured output):
  - `SceneContinuitySchema` — `story_beat`, `required_subjects` (max 8), `opening_state`, `closing_state`, `setting`, `screen_direction`. All fields default to empty.
  - `SceneSchema` / `Scene` — `id`, `narration`, `image_prompt`, `video_prompt`, `duration_seconds` (int 1–30), `on_camera`, `audio_source`, `native_audio_prompt`, `audio_mode`, `audio_note`, `reference_media_ids` (32-hex ids, max 10), `continuity`.
  - `VideoPlanSchema` / `VideoPlan` — `title`, `creative_vibe` (default `polished_ugc`), `narration`, `visual_bible` (max 2400), `scenes` (1–10), `voice` (`VOICE_KEYS` or null).
  - `YouTubeClipSectionSchema` / `YouTubeClipSection` — `section`, `dialogue`, `search_hint`, `duration_seconds` (float 1–30), YouTube Data API search filters (`search_order`, `published_after/before`, `video_duration`, `video_category`, `require_captions`, `channel_hint`), `candidate_video_urls` (max 3), `subject_tokens`.
  - `YouTubeScriptPlanSchema` / `YouTubeScriptPlan` — `title`, `web_search_needed`, `web_search_reason`, `sections` (1–10).
  - `SceneNarrationRevisionSchema` — `{ scene_id, narration }`.
- Request schemas (HTTP bodies):
  - `CreateProjectRequestSchema` / `CreateProjectRequest` — `prompt` (3–2000), `workflow`, YouTube provider options, `duration_seconds` (1–120), `scene_count` (1–10), `aspect_ratio` (default `9:16`), `resolution` (default `720p`), image/video model and resolution overrides, agent provider/model/intensity, audio provider and Hume/ElevenLabs voice fields, `input_media` (max 10), `runtime_credentials`, legacy `openrouter_api_key`.
  - `ProjectMessageRequestSchema` — `message` (1–4000), `runtime_credentials`.
  - `ProjectTimelineEditRequestSchema` — discriminated union on `operation`: `inspect`, `trim_clip`, `move_clip`, `set_final_hold` (`hold_seconds` 0–5).
  - `YouTubeReviewSessionRequestSchema` — `prompt`, `duration_seconds` (1–60), `scene_count`, `aspect_ratio`, `resolution`.
  - `YouTubeReviewCommentRequestSchema` — `provider`, `comments` (max 8000).
  - `RuntimeCredentialsSchema` / `RuntimeCredentials` — per-request API keys (OpenAI, OpenRouter, Magic Hour, Fish, Hume, ElevenLabs) and voice ids.
  - `InputMediaSchema` / `InputMedia` — `id` (32 hex), `kind` (`image` | `audio`), `name`, `mime_type`, `url`.
- Plain types: `ProjectStatus` (`queued` | `running` | `succeeded` | `failed`), `SpeechBudget`, `SceneConstraintMode`, `GenerationConstraints` (duration and scene-count budget with source `prompt` | `request` | `auto`).

**Depends on:** `zod`; `VOICE_KEYS` from `server/src/voices.ts`.

**Used by:**
- `server/src/index.ts` — `.parse(request.body)` for `POST /api/projects`, `POST /api/youtube-review-sessions`, `POST /api/youtube-review-sessions/:reviewId/comments`, `POST /api/projects/:projectId/messages`, `PATCH /api/projects/:projectId/timeline`.
- `server/src/agents.ts` — `SceneSchema` in the `draft_video_plan` tool parameters; `SceneNarrationRevisionSchema` in `revise_narration`; `YouTubeScriptPlanSchema` as agent `outputType` and parse target.
- `server/src/workflows.ts` — `VideoPlanSchema.parse` for plans; capability tables to pick supported resolutions and durations.
- `server/src/creativeDecision.ts` — `MAGIC_VIDEO_MODEL_DURATIONS`.
- `server/src/projectContext.ts` — `CreateProjectRequestSchema.safeParse`, `MAGIC_IMAGE_MODEL_RESOLUTIONS`.
- `server/src/projects.ts`, `server/src/runners.ts` — `YouTubeReviewSessionRequestSchema.parse`.
- `server/src/youtubeSubagents.ts` — `YouTubeScriptPlanSchema.parse`.
- `server/src/prompts.ts` — `SpeechBudget`, `GenerationConstraints`.
- Type-only imports: `agentRuntime.ts`, `audioPerformance.ts`, `clarificationSlots.ts`, `inputMedia.ts`, `magicHourCapabilities.ts`, `media.ts`, `renderState.ts`, `runtimeCredentials.ts`, `sceneAudio.ts`, `sceneContinuity.ts`, `youtubeShort.ts`.

**Gotchas:**
- The Agents SDK uses strict JSON schemas. Optional plan fields are `.nullable().default(null)`, not `.optional()`. Keep this rule when you add fields.
- `SceneSchema.duration_seconds` is an int. `YouTubeClipSectionSchema.duration_seconds` is a float on purpose: the SDK rejects the whole plan if the model returns `7.5` against `.int()`.
- `video_category` uses `z.preprocess`: it normalizes case, spaces, and dashes, and maps unknown values to `null` (no error).
- `subject_tokens` is filled server-side during normalization, not by the planner.
- Scene `duration_seconds` accepts 1–30, but each video model allows only the seconds in `MAGIC_VIDEO_MODEL_DURATIONS`. Callers must snap to that table.
- Route bodies use `.parse()`. A `ZodError` is not an `HttpError`, so the `index.ts` error handler returns it as HTTP 500, not 400.
