# chat-workspace.tsx

> Level 3 · Source: `frontend/components/chat-workspace.tsx` · Up: [Workspaces](README.md)

**Purpose:** Compose-mode UI. The user writes a video brief, sets models and keys, watches the run, views artifacts, and edits the timeline.

**Role in parent:** Gives the "Composer" screen. It holds only form state. It sends all project actions up to the page through callbacks.

**Main exports:**
- `ChatWorkspace(props)` — 3-column layout: `ConversationPanel` (left), `ArtifactCanvas` + `SceneTimeline` (center), `RunPanel` (right, hidden below `lg`). Header has the Review/Composer mode toggle and a "New" button.
- `ChatSubmitValues` — alias of `CreateProjectPayload` from `@/lib/types`.

**Props of `ChatWorkspace`:**
- `job: ProjectStatusResponse | null` — the selected project. All views derive from it.
- `jobs` — project list for the queue strip.
- `isBusy`, `isCreating` — disable inputs.
- `onCreate(values)`, `onMessage(message, runtimeCredentials)`, `onTimelineEdit(payload)`, `onNewCreate()`, `onSelectProject(id)`, `onModeChange(mode)`.
- `activeMode` (`"review" | "compose"`), `selectedProjectId`.

**Internal flow:**
1. No project: `WorkflowToggle` picks `"generated"` or `"youtube_clips"`. The textarea takes the brief. Enter submits. Shift+Enter adds a new line.
2. Uploads: file picker or drag-drop. `addInputFiles` accepts only `image/*` and `audio/*`. It calls `uploadInputMedia` (POST `/api/input-media`) in parallel with `Promise.allSettled`. Maximum 10 files. Uploaded files show as removable chips.
3. "Advanced controls" opens `SettingsGrid`: agent provider/intensity/model, API keys, audio provider plus voice fields, image/video model and resolution (only for `"generated"`), aspect ratio, output resolution, seconds (5–60 or Auto), scenes (1–10 or Auto). "Load OpenRouter models" calls `getOpenRouterModels` and fills a `<datalist>`.
4. `createInitialProject` builds the `CreateProjectPayload`: `"auto"` becomes `null`. Image/video fields are `null` for `"youtube_clips"`. It sets `youtube_search_provider: "youtube_data_api"`, `input_media`, and `runtime_credentials` (trimmed keys, empty becomes `null`). Then it calls `onCreate`.
5. With a project: the composer becomes a follow-up box. `submitFollowUp` calls `onMessage(text, runtimeCredentials())`. It is disabled while `isBusy`.
6. `creativeStateForJob` maps `job` to `CreativeState`:
   - `messagesForJob` — `project_state.messages`. It adds the local prompt when the backend has no messages. It adds a synthetic assistant reply when only one message exists and `job.status` is not `"queued"`.
   - `artifactsForJob` — script (plan), final video, scene/source videos, scene images, voiceover. Each source is `job.manifest` first, then `job.project_state`.
   - `workflowStepsForJob` — fixed step list per workflow. It maps `job.stage` to step status (`planned`/`running`/`succeeded`/`failed`/`skipped`).
7. `GenerationQueue` shows up to 20 jobs as cards with status, stage label, and progress. A click calls `onSelectProject`.
8. `ArtifactCanvas` shows the selected artifact in this order: plan → `ScriptCanvas`, video/audio/image → media element via `mediaUrl`, no media but status → `ProcessingCanvas`, else `EmptyCanvas`.
9. `ProcessingCanvas` shows `stageDisplayName`, `activeStepLabel`, progress bar, and `statusGuidance`. `statusGuidance` maps error text by regex (keys, credits/429, voice, image, video) to a fix hint.
10. `SceneTimeline`:
    - If `project_state.timeline` or `manifest.timeline` exists: tracks and clips on a time ruler. The selected clip gets trim (`trim_clip`) and move (`move_clip`) controls. It also shows a final hold control (`set_final_hold`) and ffprobe alignment status. Edits go to `onTimelineEdit`.
    - Else: one card per plan scene. A click selects the scene video, or the scene image if no video exists.
11. `RunPanel` has two tabs. "Run plan" lists the workflow steps. "Activity" is `ActivityFeed` over `useProjectEvents(job.project_id)` (SSE). It switches to "Activity" when the first event arrives. `describeActivityEvent` maps `status`, `tool_call_item`, `tool_call_output_item`, `reasoning_item`, `message_output_item` (`item_type`), and `agent_updated` (`event_name`) to icon/title/detail.

**Minor helpers:** `Select`, `TextInput`, `AutoNumberField` (form controls); `STAGE_LABELS`, `stageDisplayName`, `jobDisplayTitle`, `jobStatusClass`, `iconForArtifact`, `secondsLabel`, `parseSeconds`, `timelineTicks`, `clipTone`, `workflowLabel`, `workflowFromJob`, `planFromArtifact`, `sceneTimelineForJob`, `timelineForJob`. Model option lists: `IMAGE_MODELS`, `VIDEO_MODELS`, `AGENT_PROVIDERS`, `AGENT_INTENSITIES`, `AUDIO_PROVIDERS`, `FALLBACK_OPENROUTER_MODELS`, `WORKFLOWS`.

**Depends on:**
- [`@/lib/api`](../data-layer/api.md) — `uploadInputMedia`, `getOpenRouterModels`, `mediaUrl`.
- [`@/hooks/use-project-events`](../data-layer/use-project-events.md) — live activity events and `connected` flag.
- [`@/lib/clarifying-questions`](../data-layer/clarifying-questions.md) — `composeClarifiedPrompt` and types.
- [`@/lib/types`](../data-layer/types.md) — `ProjectStatusResponse`, `CreateProjectPayload`, `TimelineEditPayload`, `RuntimeCredentials`, and others.
- [`@/components/ui/button`](ui-primitives.md), `lucide-react` icons.

**Used by:** [`frontend/app/page.tsx`](../app-shell/page.md) in compose mode. Callbacks map to `createProject`, `sendMessage`, `patchTimeline` mutations and URL `?project_id=` updates.

**Gotchas:**
- Clarification flow (`ClarificationCard`, `answerClarification`, `startClarifiedProject`, `skipClarification`) is wired, but nothing starts a session. `buildClarifyingQuestions` is imported but not called. `submitInitial` goes straight to `createInitialProject`.
- `activeWorkflow` comes from `job.manifest.workflow` or `project_state.user_preferences.workflow`. The local toggle applies only before a project exists.
- Settings state is local React state. It resets on reload. API keys go to the backend in each request as `runtime_credentials`; the component does not store them.
- Default settings: agent `openrouter` / `deepseek/deepseek-v4-pro` / `max`, image `nano-banana-2-lite` at `1k`, video model `auto`, audio `elevenlabs`, `9:16`, `720p`.
- `changeAgentProvider` rewrites the model id between `openai/gpt-5.4` (OpenRouter) and `gpt-5.4` (OpenAI).
- `loadOpenRouterModels` has `try/finally` and no `catch`. A failed fetch gives an unhandled rejection. The fallback list stays.
- Locked timeline clips (`clip.locked`) disable trim and move. Trim can send `null` for fields that do not parse. Move and hold send nothing if the value does not parse.
- `WorkflowToggle` uses a 3-column grid for 2 workflows.
