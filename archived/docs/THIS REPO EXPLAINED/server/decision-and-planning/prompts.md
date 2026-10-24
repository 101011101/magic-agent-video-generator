# prompts.ts

> Level 3 · Source: `server/src/prompts.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Turn a `CreateProjectRequest` into the text briefs and numeric budgets that the agents plan against.

**Role in parent:**
- Resolves duration and scene-count constraints from the prompt text and request fields.
- Computes the narration word budget from measured or configured TTS pace.
- Compiles the first-run brief (Magic Hour or YouTube workflow) and the follow-up message brief.
- Holds the main agent system prompt `INSTRUCTIONS` and `YOUTUBE_SCRIPT_SYSTEM_PROMPT`.
- Cleans YouTube search hints so the clips stay on the prompt's subject.

**Main exports:**
- **Word counting:** `WORD_PATTERN`, `countSpokenWords(text)` (ignores `[cue]` and legacy `(cue)` tokens), `fishAudioExpressionCues`, `stripFishAudioExpressionCues`, `compactSpokenSentences(text, maxWords)` — keeps whole sentences only; returns the text unchanged if no complete sentence fits.
- **TTS pace:**
  - `configuredTtsWordsPerSecond(provider)` — reads `HUME_TTS_WORDS_PER_SECOND` / `ELEVENLABS_TTS_WORDS_PER_SECOND` / `FISH_AUDIO_WORDS_PER_SECOND`, falls back to `TTS_WORDS_PER_SECOND`; clamps to `MIN_/MAX_TTS_WORDS_PER_SECOND`.
  - `estimateTtsWordsPerSecond(audioModel, outputDir, provider, voiceKey)` — calibrates from past `manifest.json` files under `OUTPUT_DIR`; see flow below.
  - `estimateTtsWordsPerSecondForContext(ctx, voiceKey?)` — same, from `ProjectContext`.
- **Constraints:**
  - `extractPromptDuration(prompt)` — `[seconds, isUpperBound]` for 1–60s; "under N seconds" sets upper bound.
  - `extractPromptSceneConstraint(prompt)` — `exact` ("exactly/use/include N scenes"), `minimum` ("at least N"), or `agent_decides`; N is 1–10, digits or words.
  - `resolveGenerationConstraints(request)` → `GenerationConstraints`. Priority: prompt text > request field > auto (`DEFAULT_AUTO_DURATION_SECONDS`, `DEFAULT_AUTO_SCENE_BUDGET_COUNT`).
  - `speechBudgetForRequest(request, ctx)` → `SpeechBudget` (`words_per_second`, `min_words`, `max_words`, durations).
  - `requestForbidsDeadAir(request)` — true for "no silence / no dead air / no filler" phrasing.
  - `explicitTargetFinalDurationSeconds(request)` — duration, or `null` when source is `auto`.
- **Brief builders:**
  - `buildProjectRunBrief(request, ctx)` — dispatcher: `workflow === "youtube_clips"` → `buildYoutubeWorkflowBrief`, else `buildGenerationBrief`.
  - `buildGenerationBrief(request, ctx)` — Magic Hour planning brief: prompt, uploads, reference-image and user-audio rules, model policy lines, constraint lines, `magicHourCapabilityBrief`, `creativeIntentBrief`, word budgets, scene/audio/voice contracts, `magicHourModelCatalogForAgent()`.
  - `buildYoutubeWorkflowBrief(request, ctx)` — tells the agent to call `create_youtube_short_from_prompt` exactly once; adds factual/current-event rules when `isFactualYoutubePrompt`.
  - `buildYoutubeScriptPrompt(request, ctx)` — `YOUTUBE_SCRIPT_SYSTEM_PROMPT` + current date, runtime, scene count, word budget.
  - `buildProjectMessageBrief(message, ctx, status)` — follow-up turn brief with the full `project_state` snapshot JSON; `compactProjectStatusForAgent` drops `project_state` from status.
  - Line helpers: `durationConstraintLine`, `sceneConstraintLine`, `imageModelPolicyLine`, `videoModelPolicyLine`, `magicHourModelCatalogForAgent` (static image and I2V model list with durations/resolutions).
- **System prompts:** `INSTRUCTIONS` (main production agent: bounded tool loop `draft_video_plan` → `generate_voiceover` → `generate_scene_images` → `animate_scene_videos` → `stitch_final_video`, revision tools, quality rules), `YOUTUBE_SCRIPT_SYSTEM_PROMPT` (section timing table, dialogue rules, search-hint rules, web-search decision rules).
- **YouTube script normalize:** `normalizeYoutubeScriptPlan(plan)` — renumbers sections, clamps `duration_seconds` to 1–30, drops non-`YYYY-MM-DD` dates, caps title at 120 chars; `youtubeScriptNarration(plan)` joins section dialogue.
- **YouTube search hints:**
  - `normalizeYoutubeSectionsForProject(ctx, sections)` — main entry; see flow below.
  - `extractDominantSubject(prompt)` → `{tokens, phrase} | null` — quoted names or capitalized proper-noun spans; lone capitalized words only if not sentence-start and not a stopword.
  - `isFactualYoutubePrompt(prompt)` — news/current-event words, unless historical words appear without "latest/today/current/breaking/news".
  - `factualYoutubeSearchHint`, `cleanSectionSearchHint`, `conciseYoutubeSearchQuery`, `carrySourceSubjectTerms`, `applyDominantSubjectToHint`, `dedupeYoutubeSectionHints` / `uniqueYoutubeSearchHint`.
  - OpenAI-specific helpers: `extractOpenaiProductTerms`, `enrichOpenaiProductQuery`, `compactOpenaiProductHint`, `videoFriendlyOpenaiSearchHint`, `preserveCurrentOpenaiFreshness`, and related predicates.
  - Minor: `compactSearchQuery` (≤120 chars, word boundary), `dedupeQueryWords`, `importantFactualSubjectTokens`, `looksLikeYoutubeCreationInstruction`.
- **Misc:** `agentResponseContent(value)` — agent output to string; `clampedFloat`, `promptNumberValue`, `boundedPromptCount`.

**Internal flow:**
- **TTS pace (`estimateTtsWordsPerSecond`):**
  1. Env override exists → return it, clamped. Hume max also capped by `MAX_HUME_PLANNING_WORDS_PER_SECOND`.
  2. Check cache by provider, model, voice, root.
  3. Scan `<OUTPUT_DIR>/*/manifest.json` with same `audio_model`, provider, voice; ≥10 words; voiceover ≥3s (`probeMediaDurationSync`). Sample = words / duration / recorded speed.
  4. No samples → provider default (`*_DEFAULT_WORDS_PER_SECOND` env or config constant).
  5. Samples → median; ElevenLabs always uses `DEFAULT_ELEVENLABS_TTS_WORDS_PER_SECOND`.
- **Speech budget (`speechBudgetForRequest`):**
  1. Resolve constraints and TTS pace.
  2. Hume/ElevenLabs only: multiply pace by delivery speed from `inferCreativeIntent` (0.92 story/cinematic, 0.96 testimonial/UGC, else 1).
  3. `min_words = ceil(duration × wps × NARRATION_MIN_FACTOR)` (factor ≥0.97 when dead air is forbidden), minimum 4.
  4. `max_words = ceil(duration × wps × NARRATION_MAX_FACTOR)`, at least `min_words + 1`.
  5. `buildGenerationBrief` adds a +6 word planning cushion when dead air is forbidden.
- **YouTube hints (`normalizeYoutubeSectionsForProject`):**
  1. Read source prompt from `project_state.user_preferences.prompt`.
  2. Extract dominant subject.
  3. Non-factual prompt: `cleanSectionSearchHint` → `carrySourceSubjectTerms`.
  4. Factual prompt: collect OpenAI product terms from dialogue (if prompt names OpenAI) → `factualYoutubeSearchHint` (adds prompt subject tokens and a "news" suffix).
  5. Prepend subject phrase if hint lacks all subject tokens; attach `subject_tokens`.
  6. Dedupe identical hints with suffixes ("official update", "announcement", ...).

**Depends on:** `config.js` (TTS constants, `ENV`, `OUTPUT_DIR`), `creativeDecision.js` (`inferCreativeIntent`, `creativeIntentBrief`), `magicHourCapabilities.js` (`magicHourCapabilityBrief`), `mediaSync.js` (`probeMediaDurationSync`), `renderState.js` (`readProjectState`, `artifactPath`), `schemas.js` types.

**Used by:**
- `runners.ts` — `buildProjectRunBrief`, `buildProjectMessageBrief`, `agentResponseContent`.
- `agents.ts` — `INSTRUCTIONS`, `buildYoutubeScriptPrompt`, `normalizeYoutubeScriptPlan`, `youtubeScriptNarration`.
- `workflows.ts` — word counting, `compactSpokenSentences`, `explicitTargetFinalDurationSeconds`, `estimateTtsWordsPerSecondForContext`, `normalizeYoutubeSectionsForProject`, `requestForbidsDeadAir`.
- `youtubeSubagents.ts` — `speechBudgetForRequest`, `countSpokenWords`, YouTube script helpers.
- `media.ts` — `estimateTtsWordsPerSecondForContext`.
- Tests: `server/tests/prompts.test.ts`, `youtubePrompts.test.ts`, `youtubeSubject.test.ts`, `youtubeSubagents.test.ts`, `agentContracts.test.ts`.

**Gotchas:**
- Prompt text overrides UI fields for duration and scene count.
- Prompt durations outside 1–60s and scene counts outside 1–10 are ignored.
- TTS pace cache is process-lifetime; new manifests do not change it until restart.
- `carrySourceSubjectTerms` has hardcoded subject rules (ancient coins, deep sea, Saquon Barkley, Steve Jobs, OpenAI).
- `buildProjectMessageBrief` embeds the full `project_state` JSON; the brief grows with project size.
