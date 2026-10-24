# Tests

> Level 2 · Source: `server/tests/` · Up: [Server](../README.md)

**End product:** A Vitest regression suite (30 files, about 400 cases) that locks the backend contracts: request schemas, agent tool surface, plan validators, media provider calls, workflow routing, and YouTube clip selection.

**Run:** `npm test` in `server/` (runs `vitest run`). No `vitest.config`; Vitest defaults apply.

**Parts (test file → guarded module → contract):**

- Foundation and schemas
  - [`schemas.test.ts`](../../../../server/tests/schemas.test.ts) → [`schemas.ts`](../foundation/schemas.md), `projectContext.ts` — `SceneSchema` requires an explicit per-scene `on_camera` choice; `audio_mode`, `creative_vibe`, `voice` defaults and rejects for unknown values; `CreateProjectRequestSchema` defaults (MiniMax H3 video, Nano Banana 2 Lite image, Hume Octave audio), ElevenLabs settings, uploads, 2-minute max.
  - [`youtubeSchema.test.ts`](../../../../server/tests/youtubeSchema.test.ts) → `schemas.ts` — `YouTubeClipSection` accepts fractional `duration_seconds` in range 1..30; invalid video categories become `null`.
- Agent runtime
  - [`agentContracts.test.ts`](../../../../server/tests/agentContracts.test.ts) → [`agents.ts`](../agent-runtime/agents.md), `prompts.ts`, `projects.ts` — default workflow and YouTube Data API provider; orchestrator tool surface (deferred tools plus hosted tool search; YouTube tool only); constrained first-render agent; search hints avoid stock, watermark, and intro/outro clips.
  - [`agentRuntime.test.ts`](../../../../server/tests/agentRuntime.test.ts) → [`agentRuntime.ts`](../agent-runtime/agentRuntime.md), [`usageCost.ts`](../agent-runtime/usageCost.md) — OpenRouter provider/model/key resolution; flat tool surface for OpenRouter and local OpenAI runs; reasoning controls only on models that support them; no web search for OpenRouter YouTube scripts; runtime API keys not persisted; output-token caps and `OPENROUTER_MAX_TOKENS` override; one network retry; usage pricing for unknown, OpenAI-prefixed, and catalog models. Stubs `globalThis.fetch`.
  - [`runnerRetry.test.ts`](../../../../server/tests/runnerRetry.test.ts) → [`runners.ts`](../agent-runtime/runners.md) — `runAgentUntilManifest` defaults to one attempt; retries up to `maxAttempts` only while the manifest is missing.
  - [`youtubeScriptPlanner.test.ts`](../../../../server/tests/youtubeScriptPlanner.test.ts) → `agents.ts` — `youtubeScriptResultUsedWebSearch` detects hosted web search in `providerData`; `draftYoutubeScriptImpl` reruns with forced `web_search` when the planner claims search but did not call it. Mocks `@openai/agents` `run`/`Runner`.
- Decision and planning (pure validators, no I/O except temp dirs)
  - [`creativeDecision.test.ts`](../../../../server/tests/creativeDecision.test.ts) → [`creativeDecision.ts`](../decision-and-planning/creativeDecision.md), `workflows.ts` — creative intent inference (UGC, cinematic, music video, comparison, edit, quoted dictation); plan-vs-intent validation (hook/proof/CTA, repeated lines, first-person creator speech, Talking Photo counts, I2V durations); bounded repair policy; `draftVideoPlanImpl` pre-provider repair gate and fallback plans.
  - [`planQuality.test.ts`](../../../../server/tests/planQuality.test.ts) → `workflows.ts` (`validateProductionVideoPlan`, `alignPlanToMeasuredVoiceover`), `audioPerformance.ts` — runtime coverage vs. speech estimates, keyframe/video prompt compilation (continuity subjects, single-frame guard, minor-subject wording), b-roll stretching limits, hard-cut realignment to measured narration.
  - [`planReadiness.test.ts`](../../../../server/tests/planReadiness.test.ts) → [`planReadiness.ts`](../decision-and-planning/planReadiness.md) — clean plan is ready; objective failures return a free planner repair action; issue families stay stable across rewordings.
  - [`sceneContinuity.test.ts`](../../../../server/tests/sceneContinuity.test.ts) → [`sceneContinuity.ts`](../decision-and-planning/sceneContinuity.md) — required subjects grounded in keyframe; screen-direction and title-card rejects; causal beats and fall geometry; same-world chaining vs. clean cuts and time bridges; hidden between-scene state changes.
  - [`sceneAudio.test.ts`](../../../../server/tests/sceneAudio.test.ts) → [`sceneAudio.ts`](../decision-and-planning/sceneAudio.md) — scene audio ownership: legacy narration → external voiceover; native H3 audio contract; no external narration on native scenes; no native audio on unsupported models or with uploaded audio.
  - [`audioPerformance.test.ts`](../../../../server/tests/audioPerformance.test.ts) → [`audioPerformance.ts`](../decision-and-planning/audioPerformance.md) — UGC mode → Hume settings; pause-token sanitizing; audio-note leak flags; one performance profile per plan; 0.5s topic-change micro-pauses; uniform slow-down with a speed floor.
  - [`magicHourCapabilities.test.ts`](../../../../server/tests/magicHourCapabilities.test.ts), [`magicHourCapabilities.matrix.test.ts`](../../../../server/tests/magicHourCapabilities.matrix.test.ts) → [`magicHourCapabilities.ts`](../decision-and-planning/magicHourCapabilities.md) — prompt routing (image vs. video pipeline, image-to-video, talking photo, subtitles, planned tool wrappers) and clarification questions; matrix file asserts exactly 100 routing/clarification cases.
  - [`prompts.test.ts`](../../../../server/tests/prompts.test.ts) → [`prompts.ts`](../decision-and-planning/prompts.md) — `INSTRUCTIONS` rules (on-camera, no re-render of succeeded scenes, no global voiceover for talking videos, clarify before paid calls); `buildGenerationBrief` injects creative intent profile and narrated floors; ElevenLabs pace calibration; ltx-2.3 catalog blurb.
- Media pipeline
  - [`media.test.ts`](../../../../server/tests/media.test.ts) → [`media.ts`](../media-pipeline/media.md), [`voices.ts`](../media-pipeline/voices.md) — MiniMax H3 audio flags; transient-error classification and poll timeouts (`MAGIC_HOUR_POLL_REQUEST_TIMEOUT_MS`, `MAGIC_HOUR_POLL_REQUEST_ATTEMPTS`); `generateSceneVoiceovers` for Fish Audio, Hume (fallback to Fish on zero credits), ElevenLabs; `conformVoiceoverToTarget`; stitch functions (`stitchAssetsPerSection`, `stitchMixedAssets`, `stitchTimelineAssets`) reject underfill instead of freeze-padding. Stubs `fetch` with `vi.stubGlobal`; runs real `ffmpeg`.
  - [`media.talkingphoto.test.ts`](../../../../server/tests/media.talkingphoto.test.ts) → `media.ts` (`generateTalkingClip`) — calls `v1.aiTalkingPhoto.generate`; no paid resubmit on transient 502 poll; no retry on 400. Mocks `magic-hour` `Client`.
  - [`voices.test.ts`](../../../../server/tests/voices.test.ts) → `voices.ts` — `inferCharacterGender`, `resolveVoiceReferenceId` (gender mismatch guard, env default, catalog fallback), `humeVoiceDescriptionForPlan`, single-speaker UGC voice lock, five curated voices.
  - [`timeline.test.ts`](../../../../server/tests/timeline.test.ts) → [`timeline.ts`](../media-pipeline/timeline.md), `renderState.ts` — ordered video/narration tracks, no default freeze hold, YouTube cut-vs-freeze by window length, talking spans gap narration, timeline persisted on state updates.
  - [`workflows.lipsync.test.ts`](../../../../server/tests/workflows.lipsync.test.ts) → [`workflows.ts`](../media-pipeline/workflows.md) — talking-photo vs. b-roll partition in `animateSceneVideosImpl`; `generateVoiceoverImpl` per-scene vs. global audio; `inspectRenderStatusImpl` provider-job recovery; `stitchFinalVideoImpl` / `restitchTimelineImpl` audio-preserving path; `replaceVoiceoverImpl` voice choice. Mocks media boundary.
  - [`workflows.retry.test.ts`](../../../../server/tests/workflows.retry.test.ts) → `workflows.ts` — `retrySceneWithModelsImpl` / `regenerateSceneImpl` keep talking vs. b-roll treatment; paid media preflight blocks visuals after voiceover failure; keyframe continuity chaining in `generateSceneImagesImpl`. Mocks media boundary.
- State and scheduling
  - [`concurrency.test.ts`](../../../../server/tests/concurrency.test.ts) → [`concurrency.ts`](../state-and-scheduling/concurrency.md) — `AsyncLimiter` runs up to the limit and queues the rest.
  - [`projectRunScheduler.test.ts`](../../../../server/tests/projectRunScheduler.test.ts) → [`projectRunScheduler.ts`](../state-and-scheduling/projectRunScheduler.md) — `ProjectRunScheduler` runs five projects in parallel and queues the sixth.
- YouTube workflow
  - [`youtubeShort.smoke.test.ts`](../../../../server/tests/youtubeShort.smoke.test.ts) → [`youtubeShort.ts`](../youtube-workflow/youtubeShort.md) — candidate pool sizes (18 search, 8 transcript); frame sampling; over-fetch window (1.4x + 1.5s); VTT/ISO8601 parsing; stock/watermark pattern; `redactSecretText`; fallback window; `normalizeYoutubeSearchProvider`.
  - [`youtubeSubject.test.ts`](../../../../server/tests/youtubeSubject.test.ts) → `youtubeShort.ts`, `prompts.ts` — `extractDominantSubject`, `requiredSubjectRejectionReason`, `subject_tokens` injection in `normalizeYoutubeSectionsForProject`, subject gate in `metadataSpecificityRejectionReason`.
  - [`youtubeLastResort.test.ts`](../../../../server/tests/youtubeLastResort.test.ts) → `youtubeShort.ts` (`selectLastResortClip`) — accepts only subject-matching, VLM-clean clips; else returns `null`. Uses injected `LastResortDeps`.
  - [`youtubeCtaPersistence.test.ts`](../../../../server/tests/youtubeCtaPersistence.test.ts) → `youtubeShort.ts` — VLM judge prompt rejects large CTA banners and impersonators; allows small corner logos.
  - [`youtubeSubagents.test.ts`](../../../../server/tests/youtubeSubagents.test.ts) → [`youtubeSubagents.ts`](../youtube-workflow/youtubeSubagents.md) — `fitYoutubeSectionDurations`, `fitYoutubeScriptToBudget`, `applyCandidateRanking`.
  - [`youtubePrompts.test.ts`](../../../../server/tests/youtubePrompts.test.ts) → `prompts.ts` — OpenAI search-hint cleanup (fake GPT model tokens, freshness); duration extraction from prompts.
  - [`youtubeWorkflow.test.ts`](../../../../server/tests/youtubeWorkflow.test.ts) → `workflows.ts` — existing manifest is not reused unless requested.
- [`helpers/testFixtures.ts`](../../../../server/tests/helpers/testFixtures.ts) — shared builders:
  - `makeScene(overrides)` — full `Scene` with safe defaults (`on_camera: true`, `audio_mode: "ugc_casual"`, empty `continuity`).
  - `testContext(projectDir, projectId)` — `ProjectContext` at 16:9 / 720p plus `PROJECT_CONTEXT_DEFAULTS`.
  - `makeSilentVideo(path, s)`, `makeTone(path, s)` — generate real media with `ffmpeg` lavfi.
  - `silentClipFor`, `talkingClipFor` — video manifest entries (b-roll vs. `ai-talking-photo` with embedded audio).
  - `seedPlanAndImages`, `seedPlanImagesVideos` — write `plan`, `images`, `videos` artifacts via `writeJsonArtifact`.
  - Used by: `media.test.ts`, `media.talkingphoto.test.ts`, `workflows.lipsync.test.ts`, `workflows.retry.test.ts`.

**How the parts work together:**

1. Pure validator suites (decision-and-planning, schemas, voices, youtubeShort helpers) call exported functions directly with inline fixtures.
2. Workflow suites seed a temp project dir with `helpers/testFixtures.ts`, then call `*Impl` functions from `workflows.ts`.
3. Provider boundaries are replaced, never called: `vi.mock` on `../src/media.js`, `magic-hour`, or `@openai/agents`; `fetch` stubs for TTS and OpenRouter; injected deps for `selectLastResortClip`.
4. Assertions target the file-backed state (`readJsonArtifact`) and mock call arguments, so they guard both routing and paid-call avoidance.

**Key contracts:**

- Suites replace provider clients with mocks or stubs. Give a new provider call path a mock or stub too.
- `ffmpeg` must be on `PATH` for `media.test.ts` and `media.talkingphoto.test.ts`.
- Mocked-module suites import the module under test with `await import(...)` after `vi.mock`. Keep that order.
- Temp project dirs use `mkdtempSync(path.join(tmpdir(), ...))`.
- Many cases guard paid-call rules: no duplicate renders, no silent fallback that spends credits, no TTS for native H3 audio.

**Gotchas:**

- `media.test.ts` sets `MAGIC_HOUR_POLL_REQUEST_*` on `process.env` directly; `agentRuntime.test.ts` uses `vi.stubEnv("OPENROUTER_MAX_TOKENS", ...)`.
- `magicHourCapabilities.matrix.test.ts` fails if the case count is not exactly 100.
