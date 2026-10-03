# agentRuntime.ts

> Level 3 · Source: `server/src/agentRuntime.ts` · Up: [Agent Runtime](README.md)

**Purpose:** Select the LLM provider (`openai` or `openrouter`), model, intensity, and API key for one agent run. Apply matching model settings.

**Role in parent:** Gives [agents.md](agents.md) and [runners.md](runners.md) one `AgentRuntimeConfig`, a configured `Runner`, and per-runtime agent clones. Gives [usageCost.md](usageCost.md) OpenRouter prices.

**Main exports:**
- `resolveAgentRuntime(request?)` — Build `AgentRuntimeConfig` from a `CreateProjectRequest` plus `ENV` fallbacks.
  - `openrouter`: `OpenAI` client with `baseURL`, `HTTP-Referer`, `X-Title` headers; `OpenAIProvider` with `useResponses: false` (Chat Completions).
  - `openai`: `OpenAIProvider` with `useResponses: true` (Responses API). No `model_provider` when no key exists.
- `runtimeFromContext(ctx)` — Rebuild a runtime from a saved `ProjectContext` (`agent_provider`, `agent_model`, `agent_intensity`, `openai_api_key`, `openrouter_api_key`). Fills other request fields with fixed placeholders.
- `cloneAgentForRuntime(agent, runtime)` — `agent.clone()` with `model: runtime.model` and merged `modelSettings`.
- `runnerForRuntime(runtime)` — New `Runner` with `modelProvider`, `workflowName: "Magic Agent video generation"`, and `traceMetadata` (provider, model, intensity).
- `assertAgentRuntimeReady(runtime)` — Throw when the selected provider has no API key.
- `agentRuntimeStatus(runtime)` — Plain status object (`provider`, `model`, `intensity`, `base_url`, `has_api_key`), no client.
- `fetchOpenRouterModels(apiKey?)` — `GET {base}/models`. Map to `OpenRouterModelInfo[]` (price per token and per 1M). Fill `OPENROUTER_PRICING_CACHE`. Return `FALLBACK_OPENROUTER_MODELS` on any error or empty list.
- `openRouterPricingForModel(model)` — Read the pricing cache; `null` if not fetched.
- Constants: `DEFAULT_OPENAI_AGENT_MODEL` (`gpt-5.4`), `DEFAULT_OPENROUTER_AGENT_MODEL` (`openai/gpt-5.4`), `DEFAULT_OPENROUTER_BASE_URL`, `DEFAULT_OPENROUTER_MAX_TOKENS` (4000), `DEFAULT_DEEPSEEK_V4_PRO_MAX_TOKENS` (12000), `FALLBACK_OPENROUTER_MODELS`.
- Types: `AgentRuntimeConfig`, `OpenRouterModelInfo`.

**Internal flow (resolve + clone):**
1. Provider = `request.agent_provider`, else `ENV.AGENT_MODEL_PROVIDER` / `LLM_PROVIDER` / `OPENAI_PROVIDER` (`"openrouter"` or default `"openai"`).
2. Model = `request.agent_model`, else `ENV.OPENROUTER_MODEL` / `ENV.OPENAI_MODEL`, else the default constant.
3. Intensity = `request.agent_intensity`, else `ENV.AGENT_MODEL_INTENSITY` / `OPENROUTER_INTENSITY`. Values other than `pro` / `max` become `standard`.
4. API key = request runtime credentials (via `runtimeCredentialsFromRequest`), else `ENV.OPENROUTER_API_KEY` / `ENV.OPENAI_API_KEY`.
5. On clone, OpenRouter adds `maxTokens` (clamped 1024–16000) and one network-error retry with 500 ms backoff.
6. Response controls apply for OpenRouter and for OpenAI models matching `^(gpt-5|o[1-9]|codex)`. Else the clone removes `reasoning` and `text`.
7. Reasoning effort: `max` → `medium`, `pro` → `low`, `standard` → `none` (OpenAI) or `minimal` (OpenRouter). Verbosity: `max` → `medium`, else `low`.

**Depends on:** `@openai/agents` (`Agent`, `OpenAIProvider`, `Runner`, `retryPolicies`), `openai`, `./config.js` (`ENV`), `./runtimeCredentials.js`, types from `./schemas.js` and `./context.js`.
- Env vars: `AGENT_MODEL_PROVIDER`, `LLM_PROVIDER`, `OPENAI_PROVIDER`, `OPENAI_MODEL`, `OPENAI_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `OPENROUTER_MAX_TOKENS`, `AGENT_MAX_OUTPUT_TOKENS`, `AGENT_MODEL_INTENSITY`, `OPENROUTER_INTENSITY`.

**Used by:**
- `server/src/agents.ts` — build and run agents per request or saved context.
- `server/src/runners.ts` — streamed runs, readiness checks, `agent_runtime` status in payloads.
- `server/src/projects.ts` — readiness checks (`missingConfiguration`, `assertRuntimeReady`, `assertProjectContextReady`).
- `server/src/projectContext.ts` — `context()` takes `agent_provider`, `agent_model`, `agent_intensity` from `resolveAgentRuntime`.
- `server/src/index.ts` — `POST /api/providers/openrouter/models` calls `fetchOpenRouterModels`.
- `server/src/usageCost.ts` — `openRouterPricingForModel` for cost math.

**Gotchas:**
- OpenRouter pricing is known only after `fetchOpenRouterModels` runs; the cache is in-memory and resets on restart.
- `OPENROUTER_MAX_TOKENS` / `AGENT_MAX_OUTPUT_TOKENS` read `process.env` first, then `ENV`.
- OpenRouter mode builds a client even with no key (placeholder `"missing-openrouter-key"`); `has_api_key` stays `false`, so `assertAgentRuntimeReady` throws.
- `cached_input` price equals `input` price for OpenRouter models.
