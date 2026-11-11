# Decision and Planning

> Level 2 · Up: [Server](../README.md)

**End product:** Deterministic, free (no provider call, no LLM) decisions around the video plan:
- Before the plan: which capability serves the request, or which clarifying questions to ask.
- For the planner: the planning brief, with creative intent, duration/scene constraints, and word budgets.
- After the draft: a validation issue list and a `PlanReadinessReport` that allows or blocks paid generation.
- During render: continuity, keyframe-chaining, scene-audio, and TTS-delivery rules for each scene.

**Parts:**
- [magicHourCapabilities](magicHourCapabilities.md) — Routes a request to one Magic Hour capability (`classifyMagicHourRequest`), or returns clarifying questions. Marks planned (not wired) capabilities.
- [clarificationSlots](clarificationSlots.md) — Regex slot check (output type, subject, duration, source topic, product context, proof point). Gives the router its "what is missing" questions.
- [creativeDecision](creativeDecision.md) — Infers `CreativeIntent` (format, platform, goal, speech mode, vibe, required beats, pacing). Writes the intent brief. Validates a plan against the intent.
- [prompts](prompts.md) — Resolves duration and scene-count constraints, TTS pace, and word budgets. Compiles the run brief, follow-up brief, and system prompts. Cleans YouTube search hints.
- [planReadiness](planReadiness.md) — Turns validator issue strings into a `PlanReadinessReport` (`ready` or `repair_required`) with issue families and next actions.
- [sceneContinuity](sceneContinuity.md) — Validates the per-scene continuity ledger. Decides keyframe chaining. Writes scene-physics and staging text for image and video prompts.
- [sceneAudio](sceneAudio.md) — Decides each scene's audio source (`voiceover`, `speech_driven`, `native_scene_audio`). Validates that scene fields agree with it.
- [audioPerformance](audioPerformance.md) — Maps `AudioMode` to TTS settings (speed, temperature, pause, trailing silence). Gives default `audio_mode` values and audio lint.

**How the parts work together:**
1. Routing: `POST /api/projects` (`index.ts`) and `runProject` (`runners.ts`) call `classifyMagicHourRequest`. It calls `analyzeClarificationSlots` (clarificationSlots) and merges those questions with its own. Questions or a planned capability → `needs_input` manifest, no paid work.
2. Brief: `buildProjectRunBrief` (prompts) picks the YouTube brief or `buildGenerationBrief`. `buildGenerationBrief` embeds `magicHourCapabilityBrief` (magicHourCapabilities), `creativeIntentBrief` (creativeDecision), constraint lines, and word budgets from `speechBudgetForRequest`. `speechBudgetForRequest` uses `inferCreativeIntent` to adjust delivery speed.
3. Draft validation: `draftVideoPlanImpl` (`workflows.ts`) runs these validators on the agent's plan, plus its own checks in `workflows.ts`:
   - `validateSceneContinuity(plan, { requireLedger: true })` (sceneContinuity)
   - `audioPerformanceIssues` (audioPerformance)
   - `validateSceneAudioContract(plan, ctx.video_model, hasUploadedAudio)` (sceneAudio)
   - `validatePlanForCreativeIntent` (creativeDecision)
4. Gate: `isBlockingPlanIssue` (`workflows.ts`) splits issues into blocking issues and warnings. `buildPlanReadinessReport` (planReadiness) writes `plan_readiness`. Blocking issues → `repair_required`, the agent must call `draft_video_plan` again. `planIssueFamily` sets the repair budget. No blocking issues → `ready`, `plan.json` is saved.
5. Render: the media steps read the same rules again:
   - `sceneAudioSource` / `planNeedsPerSceneAudio` choose per-scene TTS, talking vs b-roll video, native H3 audio, and stitch inputs.
   - `audioPerformanceForGeneration` / `audioPerformanceSequenceForPlan` give voice settings to Hume and ElevenLabs calls, with the TTS pace from prompts.
   - `shouldChainPreviousKeyframe` / `identityReferenceSceneIndex` pick reference images. `scenePhysicsContext` and staging guidance go into provider image and video prompts.

**Key contracts:**
- All parts are pure functions over `CreateProjectRequest`, `VideoPlan`, `Scene` (`schemas.ts`). Exception: prompts reads `ENV` TTS pace vars, past `manifest.json` files under `OUTPUT_DIR`, and `project_state`.
- Nothing is stored between calls. `classifyMagicHourRequest` and `inferCreativeIntent` run again at each call site. They must stay deterministic so all callers agree.
- Validators return `string[]` issues. An empty list means the plan passes. Issue text is the contract: `planIssueFamily` and `isBlockingPlanIssue` classify issues by regex.
- Files on disk: `plan_readiness` artifact (via `writeJsonArtifact`); `plan.json` only after a `ready` verdict.
- Env vars (prompts only): `TTS_WORDS_PER_SECOND`, `HUME_TTS_WORDS_PER_SECOND`, `ELEVENLABS_TTS_WORDS_PER_SECOND`, `FISH_AUDIO_WORDS_PER_SECOND` (overrides); `HUME_DEFAULT_WORDS_PER_SECOND`, `ELEVENLABS_DEFAULT_WORDS_PER_SECOND`, `FISH_AUDIO_DEFAULT_WORDS_PER_SECOND` (fallbacks when no past manifest sample exists).
- All inference is English keyword regex. Rule order decides ties.
