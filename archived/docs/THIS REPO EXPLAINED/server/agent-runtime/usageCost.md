# usageCost.ts

> Level 3 · Source: `server/src/usageCost.ts` · Up: [Agent Runtime](README.md)

**Purpose:** Convert agent token `Usage` (from `@openai/agents`) into a USD cost estimate and write it to `<project_dir>/token_output.json`.

**Role in parent:** Gives the agent runtime its cost accounting. Runners call it after each agent run. Tools and workflows use its "pending" payload as a placeholder `token_output` in the manifest.

**Main exports:**
- `pricingKeyForModel(model)` — Map a model name to a key in `OPENAI_TEXT_PRICING_USD_PER_1M`. Tries exact match, then strips an `openai/` prefix, then matches a `<knownModel>-` prefix (dated variants). Throws if no match.
- `tokenOutputPayload(projectId, model, usage, provider = "openai")` — Build the cost payload (`project_id`, `created_at`, `provider`, `model`, `pricing`, `usage`, `cost`, `scope`). Does not write to disk.
- `pendingTokenOutput(ctx, model, provider = "openai")` — Build an all-zero payload with `token_output_path` and a "Pending until the agent run completes" `scope`. Does not write to disk.
- `pendingTokenOutputForContext(ctx)` — Call `pendingTokenOutput` with `ctx.agent_model` (default `"gpt-5.4"`) and `ctx.agent_provider` (default `"openai"`).
- `writeTokenOutput(ctx, usage, model, provider = "openai")` — Build the payload, add `token_output_path`, create `ctx.project_dir`, write `token_output.json` (2-space JSON), return the payload.
- Internal helpers: `pricingForModel` (pricing lookup), `tokenDetailValue` (sum a key over detail object or array), `round8` (round to 8 decimals), `serializeUsage` (camelCase `Usage` to snake_case, incl. `request_usage_entries`).

**Internal flow (`tokenOutputPayload`):**
1. Get pricing. If `provider === "openrouter"`, use `openRouterPricingForModel(model)` first. Else (or on miss) use `OPENAI_TEXT_PRICING_USD_PER_1M`. No match gives `null` (no throw).
2. Read `cached_tokens` and `tool_search_tokens` from `inputTokensDetails`, and `reasoning_tokens` from `outputTokensDetails`.
3. Compute `uncached_input_tokens = max(inputTokens - cached, 0)`.
4. Long context check: max input tokens over total usage and each `requestUsageEntries` item > `long_context_threshold_input_tokens`. If true, apply `long_context_input_multiplier` / `long_context_output_multiplier`.
5. Cost (per 1M tokens): uncached input × `input`, cached input × `cached_input`, output × `output`. Sum to `total_usd`. Round each to 8 decimals.

**Depends on:** `OPENAI_TEXT_PRICING_USD_PER_1M` (`config.ts`), `openRouterPricingForModel` (`agentRuntime.ts`, reads an in-memory OpenRouter pricing cache), `ProjectContext` (`context.ts`), `JsonDict` (`renderState.ts`), `Usage` type (`@openai/agents`).

**Used by:**
- `server/src/runners.ts` — `writeTokenOutput` after the project agent run and after the project-message agent run; `pendingTokenOutputForContext` for the fallback video plan path.
- `server/src/agents.ts` — `pendingTokenOutputForContext` for stitch / restitch tools and a tool result payload.
- `server/src/workflows.ts` — `pendingTokenOutputForContext` as default `token_output` in `buildVideoManifest` calls.
- `server/tests/agentRuntime.test.ts` — tests `tokenOutputPayload`.

**Gotchas:**
- Unknown model gives zero cost with `pricing.source = "pricing_not_configured"` and `estimate_available: false`. Only `pricingKeyForModel` throws.
- Cost covers the LLM agent run only. `scope` states that Magic Hour, TTS provider, and ffmpeg costs are not included.
- Pending payloads are never written to disk; only `writeTokenOutput` writes `token_output.json`.
