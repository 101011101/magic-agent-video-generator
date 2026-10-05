# projectContext.ts

> Level 3 · Source: `server/src/projectContext.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Build the `ProjectContext` for a run from a `CreateProjectRequest` or from saved `project_state`, plus env defaults and runtime credentials.

**Role in parent:** Gives every run one resolved settings object (paths, provider keys, models, voices, agent runtime). Writes and reads the `user_preferences` and `provider_settings` parts of `project_state`.

**Main exports:**
- `context(projectId, request)` — Build `ProjectContext` for a new run. Order per field: request value → credentials from `runtimeCredentialsFromRequest` → `ENV` → hard default. Agent fields come from `resolveAgentRuntime(request)`.
- `contextForExistingProject(projectId)` — Build `ProjectContext` for a saved project. Reads `project_state` with a placeholder context, then resolves each field: `provider_settings` → `user_preferences` → credentials from `projectRuntimeCredentials(projectId)` → `ENV` → hard default (`9:16`, `720p`, `openai`, `gpt-5.4`, `standard`).
- `initializeProjectState(ctx, request)` — Write a new `project_state` with `user_preferences` and `provider_settings` (adds `workflow`, `youtube_search_provider`, `youtube_allow_provider_fallback`).
- `ensureProjectState(ctx, request)` — Read `project_state` if the file exists; else call `initializeProjectState`.
- `requestFromProjectState(ctx)` — Rebuild a `CreateProjectRequest` from saved `user_preferences` with `CreateProjectRequestSchema.safeParse`. Returns `null` if empty or invalid.
- `userPreferencesForRequest(request)` — Copy the request without `openrouter_api_key` and `runtime_credentials`.
- `providerSettingsForContext(ctx)` — Flatten the context into `provider_settings`. Stores only credential status (`runtimeCredentialStatus`), not raw keys.
- `inferYoutubeOutputAspectRatio(videos, { default_aspect_ratio })` — Vote an output ratio (`9:16`, `16:9`, `1:1`) from source video sizes. Uses `source_width`/`width` fields, else runs `ffprobe` (10 s timeout). Tie → first detected ratio. No sizes → default.
- `configuredAgentMaxTurns()` — Parse `OPENAI_AGENT_MAX_TURNS`; clamp to 11–80; fall back to `DEFAULT_AGENT_MAX_TURNS`.
- Default helpers: `defaultImageResolution` (`480p`→`640px`, `720p`→`1k`, `1080p`→`2k`), `defaultImageResolutionForModel` (checks `MAGIC_IMAGE_MODEL_RESOLUTIONS`), `defaultMagicHourImageModel`, `defaultMagicHourVideoModel`, `explicitMagicHourDefault` (`"default"` or empty → fallback), `boolSetting`.

**Internal flow (new run):**
1. `runProject` calls `context(projectId, request)`.
2. `context` resolves agent runtime, credentials, audio provider (`hume` | `fish` | `elevenlabs`), image/video models, and voice settings.
3. `ensureProjectState` writes `project_state` on first run; later runs read it.
4. Follow-up messages call `contextForExistingProject`, which rebuilds the same shape from `project_state`.

**Depends on:** `config.ts` (`ENV`, `DEFAULT_*`), `context.ts` (`ProjectContext` type), `projects.ts` (`projectDirFor`), `renderState.ts` (`readProjectState`, `initializeProjectState`, `artifactPath`), `agentRuntime.ts` (`resolveAgentRuntime`), `runtimeCredentials.ts`, `schemas.ts`, `execa` (`ffprobe`). Env vars: `MAGIC_HOUR_*`, `FISH_AUDIO_*`, `HUME_*`, `ELEVENLABS_*`, `AUDIO_PROVIDER`, `AGENT_MODEL_PROVIDER`, `AGENT_MODEL_INTENSITY`, `OPENAI_MODEL`, `OPENAI_AGENT_MAX_TURNS`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`.

**Used by:**
- `runners.ts` — `runProject`, `runProjectMessage`, `queueProject`; `configuredAgentMaxTurns` for agent runs.
- `index.ts` — `contextForExistingProject` in `POST /api/projects/:projectId/messages` and `PATCH /api/projects/:projectId/timeline`.
- `agents.ts` — `configuredAgentMaxTurns`, `requestFromProjectState`.
- `workflows.ts` — `requestFromProjectState`, `boolSetting`, `inferYoutubeOutputAspectRatio`.
- Tests: `server/tests/schemas.test.ts`, `server/tests/agentRuntime.test.ts`.

**Gotchas:**
- `context` falls back to `ENV` for provider keys but not for `openai_api_key` or `openrouter_api_key`. `providerSettingsForContext` adds the `ENV` fallback only for status reporting.
- `context` uses `request.resolution` (not `video_resolution`) to pick the default image resolution.
- `contextForExistingProject` hard-codes placeholder defaults only for the state read. Real fallbacks come from the second object.
- `ensureProjectState` never updates an existing `project_state`; `queueProject` calls `initializeProjectState` directly and overwrites it.
- Unknown `audio_provider` values fall back to `hume`.
- `contextForExistingProject` gets keys from `projectRuntimeCredentials`, an in-memory `Map`. After a server restart, only `ENV` keys remain.
