# Agent Runtime

> Level 2 · Up: [Server](../README.md)

**End product:** One LLM agent run per project turn, on the OpenAI Agents SDK (`@openai/agents`). The run drives the media workflows through tools, streams events to the frontend, ends in a terminal project status, and writes its LLM cost to `token_output.json`.

**Parts:**
- [agents.md](agents.md) — `agents.ts`: tool definitions (Zod parameters over workflow `*Impl` functions), the `video_studio` and `youtube_short` tool namespaces, the first-render agent, the follow-up edit agent, and the YouTube script planner.
- [agentRuntime.md](agentRuntime.md) — `agentRuntime.ts`: selects provider (`openai` Responses API or `openrouter` Chat Completions), model, intensity, and API key; builds the `Runner`; clones agents with matching model settings; caches OpenRouter prices.
- [runners.md](runners.md) — `runners.ts`: queues and runs projects, streams the agent run, publishes `agent_event`s, limits plan validation failures, completes accepted plans without the agent, and sets the terminal status.
- [usageCost.md](usageCost.md) — `usageCost.ts`: converts agent token `Usage` to an estimated USD cost and writes `<project_dir>/token_output.json`.

**How the parts work together:**
1. `runners.ts` `runProject` calls `projectAgentForRequest(request)` (agents) for a first render, or `projectMessageAgentForContext(ctx)` for a follow-up message.
2. agents calls `resolveAgentRuntime(request)` or `runtimeFromContext(ctx)` (agentRuntime) to pick the provider. It picks the tool set (by workflow and capability for a first render, by provider for a follow-up) and wraps the agent with `cloneAgentForRuntime`.
3. runners resolves the same runtime and records `provider_settings` (with `agentRuntimeStatus`) in project state.
4. runners `runAgentStreamed` runs the agent through `runnerForRuntime(runtime)` with `stream: true`. Each run item goes out as an `agent_event` on `projectEvents`.
5. The model calls tools. Each tool `execute` updates project status and calls one `*Impl` in [workflows.ts](../media-pipeline/workflows.md).
6. After the run, runners calls `writeTokenOutput(ctx, usage, runtime.model, runtime.provider)` (usageCost). For `openrouter`, usageCost reads prices from `openRouterPricingForModel` (agentRuntime).
7. No `manifest.json` after the run → runners completes without the agent: `createYoutubeShortFromPromptImpl` (agents) for `youtube_clips`; else `completeAcceptedVideoPlan` over the saved plan; else, after a recorded `draft_video_plan` validation failure, `draftFallbackVideoPlanImpl` then `completeAcceptedVideoPlan`.
8. runners merges the token output into the manifest with `mergeTokenOutputIntoManifest` (in `workflows.ts`) and writes the terminal status.

**Key contracts:**
- Entry points used by `index.ts`: `queueProject`, `runProjectMessage`, `queueYoutubeReviewSession`, `startYoutubeReviewBatchWorker`, `projectRunSchedulerStatus`, `fetchOpenRouterModels`.
- Runtime shape: `AgentRuntimeConfig` (`provider`, `model`, `intensity`, `base_url`, `has_api_key`, optional `model_provider`). The API key goes into the `OpenAIProvider` client and is not a field. Follow-up runs rebuild it from `ProjectContext` fields `agent_provider`, `agent_model`, `agent_intensity`.
- Files on disk: `manifest.json` (run end signal), `token_output.json` (LLM cost only; Magic Hour, TTS, and ffmpeg costs excluded).
- Tool manifests carry a pending (all-zero) token payload from `pendingTokenOutputForContext` until runners writes the real cost.
- Tool scope: the first-render agent gets no edit, timeline, or retry tools. Only the follow-up agent gets them.
- Env vars: provider/model selection (`AGENT_MODEL_PROVIDER`, `OPENAI_MODEL`, `OPENROUTER_MODEL`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `AGENT_MODEL_INTENSITY`); run limits (`AGENT_MANIFEST_ATTEMPTS`, `AGENT_PLAN_VALIDATION_REPAIRS`, `AGENT_STREAM_TIMEOUT_MS`, `PROJECT_RUN_CONCURRENCY`). Full lists are in the child docs.
- OpenRouter prices exist only after `fetchOpenRouterModels` runs (in-memory cache). Before that, cost falls back to `OPENAI_TEXT_PRICING_USD_PER_1M` or reports `pricing_not_configured`.
