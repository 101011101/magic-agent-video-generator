# context.ts

> Level 3 · Source: `server/src/context.ts` · Up: [Foundation](README.md)

**Purpose:** Define `ProjectContext`, the per-project settings object that every project operation receives, and its default values.

**Role in parent:** Gives the server one shared type for project identity, output format, provider API keys, and model choices. The file has no logic and no imports.

**Main exports:**
- `interface ProjectContext` — per-project settings. Field groups:
  - Identity and output: `project_id`, `project_dir`, `aspect_ratio`, `resolution`.
  - API keys: `openai_api_key?`, `openrouter_api_key?` (optional), `magic_hour_api_key`, `fish_audio_api_key`, `hume_api_key`, `elevenlabs_api_key`.
  - Agent: `agent_provider`, `agent_model`, `agent_intensity`.
  - Image: `image_model`, `image_resolution`, `image_style_tool`.
  - Video: `video_model`, `video_audio` (boolean).
  - Audio: `audio_provider` (`"fish" | "hume" | "elevenlabs"`), `audio_model`, `audio_format`.
  - Voice: `fish_audio_reference_id`, `elevenlabs_voice_id`, `elevenlabs_voice_name`, `hume_voice_description`, `hume_voice_id`, `hume_voice_name`, `hume_voice_provider`.
- `PROJECT_CONTEXT_DEFAULTS` — `satisfies Partial<ProjectContext>`. Covers all fields except `project_id`, `project_dir`, `aspect_ratio`, `resolution`, `openrouter_api_key`. Values:
  - All API keys, `fish_audio_reference_id`, `elevenlabs_voice_id`, and `hume_voice_*` text fields = `""`.
  - `agent_provider: "openai"`, `agent_model: "gpt-5.4"`, `agent_intensity: "standard"`.
  - `image_model: "seedream-v4"`, `image_resolution: "1k"`, `image_style_tool: "general"`.
  - `video_model: "minimax-h3"`, `video_audio: false`.
  - `audio_provider: "hume"`, `audio_model: "octave-1"`, `audio_format: "mp3"`, `hume_voice_provider: "HUME_AI"`.
  - `elevenlabs_voice_name: "brielle - podcast girl"`.

**Depends on:** Nothing.

**Used by:**
- `server/src/projectContext.ts` — builds real contexts:
  - `context(projectId, request)` fills from the request, runtime credentials, and `ENV`.
  - `contextForExistingProject(projectId)` builds a context from a hardcoded default literal, then applies `project_state.json` preferences.
- `server/src/projects.ts` — `bareContext()` spreads `PROJECT_CONTEXT_DEFAULTS` to build a context for `updateProjectState` in `updateProjectStatus`. It is the only `src/` importer of `PROJECT_CONTEXT_DEFAULTS`; tests also import it.
- Type-only importers of `ProjectContext`: `agentRuntime.ts`, `agents.ts`, `creativeDecision.ts`, `media.ts`, `prompts.ts`, `renderState.ts`, `runners.ts`, `timings.ts`, `usageCost.ts`, `workflows.ts`, `youtubeShort.ts`, `youtubeSubagents.ts`.
- Tests: `server/tests/helpers/testFixtures.ts` and many `server/tests/*.test.ts` files.

**Gotchas:**
- `contextForExistingProject` does not use `PROJECT_CONTEXT_DEFAULTS`. It repeats the defaults inline, so the two sets can drift. They already differ: `elevenlabs_voice_name` is `""` there and `"brielle - podcast girl"` here. `openai_api_key` is absent there.
- `PROJECT_CONTEXT_DEFAULTS` has no `aspect_ratio` or `resolution`. Callers must set them (`bareContext` uses `""`).
- The defaults do not read `ENV`. Environment overrides happen only in `context()` in `projectContext.ts`.
