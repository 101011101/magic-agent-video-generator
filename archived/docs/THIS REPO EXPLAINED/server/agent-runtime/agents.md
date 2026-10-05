# agents.ts

> Level 3 · Source: `server/src/agents.ts` · Up: [Agent Runtime](README.md)

**Purpose:** Define the OpenAI Agents SDK tools (Zod schemas over workflow `*Impl` functions) and the agents that call them.

**Role in parent:** Gives [runners.ts](runners.md) the agent to run for a first render (`projectAgentForRequest`), the agent to run for a follow-up chat message (`projectMessageAgentForContext`), and the deterministic YouTube fallback (`createYoutubeShortFromPromptImpl`).

**Main exports:**
- **Tools** — each is `tool({ name, description, parameters: z.object(...), deferLoading: true, execute })`. Most `execute` bodies call `updateProjectStatus(ctx.project_id, { status: "running", stage, progress, message })`, then call one `*Impl` in [workflows.ts](../media-pipeline/workflows.md). `ctx` is `runContext.context as ProjectContext`.
  - `draftVideoPlan` (`draft_video_plan`) — params `title`, `creative_vibe` (`VIDEO_VIBES`), `scenes` (`SceneSchema[]`), `visual_bible`, `voice` (`VOICE_KEYS` or null). Joins scene `narration` with `\n\n` to make the full voiceover, then calls `draftVideoPlanImpl`. Stage `planning`, 15%.
  - `generateVoiceover` (`generate_voiceover`) — no params → `generateVoiceoverImpl`. Stage `voiceover`, 30%.
  - `requestClarification` (`request_clarification`) — `questions` (1–4), `reason` → `requestClarificationImpl`. Stage `needs_input`, 5%.
  - `generateMagicHourImages` (`generate_magic_hour_images`) — standalone images: `prompt` (3–1200 chars), `image_count` (1–4), `model`, `image_resolution`, `image_style_tool` → `generateStandaloneImagesImpl`.
  - `generateSceneImages` (`generate_scene_images`) — `model`, `image_resolution`, `image_style_tool`, `scene_ids` (null = all) → `generateSceneImagesImpl`. Default model `DEFAULT_MAGIC_HOUR_IMAGE_MODEL`.
  - `animateSceneVideos` (`animate_scene_videos`) — `model` (`MAGIC_VIDEO_MODELS`, default `DEFAULT_MAGIC_HOUR_VIDEO_MODEL`), `resolution` (default `720p`), `audio` (default false), `scene_ids` → `animateSceneVideosImpl`. Stage `video_generation`, 70%.
  - `stitchFinalVideo` (`stitch_final_video`) → `stitchFinalVideoImpl(ctx, pendingTokenOutputForContext(ctx))`. Stage `stitching`, 90%.
  - `inspectRenderStatus` (`inspect_render_status`), `recordProjectDecision` (`record_project_decision`: `decision`, `rationale`, `scene_id`) — no status update.
  - Edit tools: `regenerateScene` (`regenerate_scene`: patch one scene's narration/prompts/duration/models), `reviseNarration` (`revise_narration`: `narration`, `scene_narration_updates`), `replaceVoiceover` (`replace_voiceover`), `restitchVideo` (`restitch_video`), `retryScene` (`retry_scene`: `stage` = `image` | `video` | `all`, default `video`).
  - Timeline tools: `inspectTimelineTool` (`inspect_timeline`), `trimClipTool` (`trim_clip`: `clip_id`, `source_start`, `source_end`), `moveClipTool` (`move_clip`: `clip_id`, `timeline_start`), `setFinalHoldTool` (`set_final_hold`: `hold_seconds` 0–5, default 1.5), `restitchTimelineTool` (`restitch_timeline`).
  - `createYoutubeShortFromPrompt` (`create_youtube_short_from_prompt`) — `proxy_url` → `createYoutubeShortFromPromptImpl`. Stage `youtube_script`, 15%.
- `VIDEO_STUDIO_TOOLS` — `toolNamespace` `video_studio` with all tools above except `createYoutubeShortFromPrompt`.
- `YOUTUBE_SHORT_TOOLS` — `toolNamespace` `youtube_short` with `createYoutubeShortFromPrompt`.
- `videoAgent` / `videoAgentModel` — "Autonomous Video Art Director". Model `ENV.OPENAI_MODEL ?? DEFAULT_OPENAI_AGENT_MODEL`, instructions `INSTRUCTIONS`, tools = both namespaces + `toolSearchTool()`, `parallelToolCalls: true`.
- `projectAgentForRequest(request)` — returns the first-render agent (see Internal flow).
- `projectMessageAgentForContext(ctx)` — OpenRouter runtime → "OpenRouter Video Editor" (flat list of all `video_studio` tools, reasoning `minimal`); otherwise → `videoAgent`.
- `youtubeScriptModel()` — `ENV.YOUTUBE_SCRIPT_MODEL ?? ENV.OPENAI_FAST_MODEL ?? ENV.OPENAI_MODEL ?? "gpt-5.4"`.
- `youtubeScriptInstructionsForRequest(request)` / `youtubeScriptAgentForRequest(request)` — "Notebook-Style YouTube Script Planner" with `outputType: YouTubeScriptPlanSchema`. Adds `webSearchTool({ searchContextSize: "low" })` only when the provider is not `openrouter`.
- `youtubeScriptResultUsedWebSearch(result)` — true when any `result.newItems` marker (type, name, rawItem, providerData) contains `web_search` or `websearch`.
- `draftYoutubeScriptImpl(ctx, request)` — runs the script planner and returns a reviewed `YouTubeScriptPlan`.
- `createYoutubeShortFromPromptImpl(ctx, { proxy_url })` — drafts the script, then calls `createYoutubeShortImpl` with `youtubeScriptNarration(script)` and `script.sections`.

**Internal flow:**
1. First render: `projectAgentForRequest` → `firstRenderAgentForRequest` → `resolveAgentRuntime`, `assertAgentRuntimeReady`.
2. `firstRenderToolsForRequest` picks a restricted tool set:
   - `workflow === "youtube_clips"` → `createYoutubeShortFromPrompt`, `inspectRenderStatus`, `recordProjectDecision`.
   - `classifyMagicHourRequest(request).capability_id === "standalone_image"` → `requestClarification`, `generateMagicHourImages`, inspect, record.
   - Else → clarify, plan, voiceover, scene images, animate, stitch, inspect, record.
3. `chatCompletionsTool` flattens each tool (`deferLoading: false`, `namespace: undefined`). The agent "First-Render Video Art Director" gets `INSTRUCTIONS` + provider note + "first complete output only; no edit/retry/restitch", `parallelToolCalls: false`, wrapped by `cloneAgentForRuntime`.
4. YouTube script (`draftYoutubeScriptImpl`):
   1. Merge `request.runtime_credentials` with `ctx` keys (OpenAI, OpenRouter, Magic Hour, Fish Audio, Hume, ElevenLabs); resolve and assert runtime.
   2. Run the planner with `buildYoutubeScriptPrompt(request, ctx)`, `maxTurns: configuredAgentMaxTurns()`; parse with `YouTubeScriptPlanSchema`, then `normalizeYoutubeScriptPlan`.
   3. If web search is available, `plan.web_search_needed` is true, and no search ran → rerun once with `toolChoice: "web_search"`. Still no search → throw.
   4. On OpenRouter, force `web_search_needed: false`.
   5. `reviewYoutubeScriptWithSubagent` revises the plan.
   6. `writeJsonArtifact(ctx, "youtube_script_plan", plan)`; `updateProjectState` records a `draft_youtube_script` decision (title, section count, search hints, model, provider, web-search flags, subagent review).

**Depends on:** `@openai/agents`, `zod`; [agentRuntime.ts](agentRuntime.md) (runtime, runner, clone); [usageCost.ts](usageCost.md) (`pendingTokenOutputForContext`); [workflows.ts](../media-pipeline/workflows.md) (all `*Impl`); [schemas.ts](../foundation/schemas.md), [config.ts](../foundation/config.md) (`ENV`, default models), [context.ts](../foundation/context.md); [prompts.ts](../decision-and-planning/prompts.md) (`INSTRUCTIONS`, YouTube prompt helpers); [magicHourCapabilities.ts](../decision-and-planning/magicHourCapabilities.md); [voices.ts](../media-pipeline/voices.md) (`VOICE_KEYS`); [projects.ts](../state-and-scheduling/projects.md), [renderState.ts](../state-and-scheduling/renderState.md), [projectContext.ts](../state-and-scheduling/projectContext.md); [youtubeSubagents.ts](../youtube-workflow/youtubeSubagents.md).
- Env vars: `OPENAI_MODEL`, `OPENAI_FAST_MODEL`, `OPENAI_REASONING_EFFORT`, `OPENAI_VERBOSITY`, `YOUTUBE_SCRIPT_MODEL`, `YOUTUBE_SCRIPT_REASONING_EFFORT`, `YOUTUBE_SCRIPT_VERBOSITY` (via `ENV`).

**Used by:**
- `server/src/runners.ts` — `projectAgentForRequest` (first run), `projectMessageAgentForContext` (follow-up messages), `createYoutubeShortFromPromptImpl` (fallback when the agent ends with no YouTube manifest).
- Tests: `server/tests/agentContracts.test.ts`, `agentRuntime.test.ts`, `youtubeScriptPlanner.test.ts`.

**Gotchas:**
- The first-render agent never gets edit/timeline/retry tools; only follow-up messages do.
- `request_clarification` refuses when a draft plan failed validation (returns `clarification_rejected`, `next_tools: ["draft_video_plan"]`) and throws when `current_plan` already exists.
- `create_youtube_short_from_prompt` throws unless the saved request has `workflow === "youtube_clips"`.
- Tool descriptions carry the planning rules the model must obey (word-count range, `visual_bible` ≤ 2400 chars, atomic physical events, LTX 2.3 10-second scenes, `on_camera` for talking scenes, `audio: false` because TTS owns speech).
- `videoAgent` is built once at module load; `ENV` changes after import do not affect it.
