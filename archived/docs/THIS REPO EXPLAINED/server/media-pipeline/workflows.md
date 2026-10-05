# workflows.ts

> Level 3 · Source: `server/src/workflows.ts` · Up: [Media Pipeline](README.md)

**Purpose:** Implement every agent tool that changes a project: plan, voiceover, images, videos, stitch, retry, edit, timeline edit, YouTube short.

**Role in parent:** Own the artifact state machine. Each `*Impl` function validates preconditions, calls provider helpers in [media.ts](media.md), writes JSON artifacts through [renderState.ts](../state-and-scheduling/renderState.md), records a `decision` and `status.stage`, and returns `next_tools` for the agent.

**Main exports:**
- `draftVideoPlanImpl(ctx, title, narration, scenes, visualBible?, creativeVibe?, normalizeSceneIds?, voice?)` — Parse `VideoPlanSchema`, normalize (scene ids, on-camera intent, dense narration, runtime to target), run all quality validators. On blocking issues: write `plan_readiness`, set stage `plan_validation_failed`, return repair rules with `next_tools: ["draft_video_plan"]`; throw after the repair budget is spent. On pass: refuse if paid media exists, clear old render outputs, write `plan`, set stage `plan_drafted`.
- `draftFallbackVideoPlanImpl(ctx)` — Build a deterministic UGC/product plan (formats `ugc`, `product_demo`, `problem_solution`, `testimonial`, `founder_story` only) and pass it to `draftVideoPlanImpl`.
- `generateVoiceoverImpl(ctx)` — Paths in order: reuse the existing `voiceover` (not for per-scene audio plans); copy an uploaded audio input as the voiceover; for per-scene audio plans (`planNeedsPerSceneAudio`), render TTS only for external-speech scenes; else render one full voiceover with `generateVoiceoverAsset`. Check measured duration; on failure delete the take, set `voiceover_validation_failed`, return `next_tools: ["draft_video_plan"]` (throw on the second failure). On pass, call `alignPlanToMeasuredVoiceover` to move scene cuts to speech boundaries. Provider errors set stage `voiceover_failed`.
- `generateSceneImagesImpl(ctx, sceneIds?, options?)` — Generate keyframes for scenes without an image. Chain a reference image per scene (previous keyframe or identity reference from [sceneContinuity.ts](../decision-and-planning/sceneContinuity.md)) plus uploaded images (max 10). Block automatic paid retry of scenes with an earlier `image_generation` failure. Write `images` and `failed_scenes`.
- `animateSceneVideosImpl(ctx, sceneIds?, options?)` — Render scene videos. Split scenes by `sceneAudioSource`: `speech_driven` scenes go to AI Talking Photo (`renderTalkingPairs`, keyframe + per-scene TTS); other scenes go to `generateVideoAssetsBatch` (image-to-video). Refuse re-renders of scenes with a recoverable provider job id. Stage is `videos_provider_recoverable` or `videos_animated`.
- `stitchFinalVideoImpl(ctx, tokenOutput?)` — Recover failed provider jobs first (`recoverProviderFailuresBeforeStitch`), require a video for every planned scene, then stitch. Per-scene audio → `buildPerSceneStitchInputs` + `stitchMixedAssets`. Global voiceover → `stitchTimelineAssets` from the timeline video track, else `stitchAssets`. Check final duration against the explicit target, write `manifest` via `buildVideoManifest`, attach ffprobe verification to the timeline.
- `createYoutubeShortImpl(ctx, title, narration, sections, options?)` — YouTube-clip workflow: convert sections to a plan (`youtubeSectionsToVideoPlan`), download clips ([youtubeShort.ts](../youtube-workflow/youtubeShort.md)), generate per-section voiceovers after clip selection, resize scene durations to measured audio, infer output aspect from clips, combine audio, stitch with a 0.25s final hold, write manifest with `workflow: "youtube_clips"`.
- `generateStandaloneImagesImpl(ctx, prompt, options?)` — Image-only projects (`classifyMagicHourRequest` → `standalone_image`, no plan). Writes `images` and a `standalone_image` manifest; stage `image_generated`.
- `requestClarificationImpl(ctx, questions, reason?)` — Write a `needs_input` manifest with max 4 questions. Refuse when a plan exists or paid media started.
- `inspectRenderStatusImpl(ctx)` — Report which artifacts exist, missing images/videos, failed and recoverable scenes, and computed `next_tools`.
- Edit operations:
  - `retrySceneWithModelsImpl(ctx, sceneId, stage, options?)` — Re-render `image`, `video`, or `all` for one scene with optional model overrides; clear matching failures.
  - `regenerateSceneImpl(ctx, sceneId, options?)` — Patch scene fields (`patchSceneInPlan`), save plan, invalidate the manifest, re-render image (default) and video.
  - `reviseNarrationImpl(ctx, narration, sceneNarrationUpdates?)` — Save new narration; invalidate manifest and voiceover.
  - `replaceVoiceoverImpl(ctx, narration?)` — Invalidate and re-render the full voiceover.
  - `restitchVideoImpl` / `restitchTimelineImpl` — Call `stitchFinalVideoImpl` and record the edit decision.
  - `recordProjectDecisionImpl(ctx, decision, rationale?, sceneId?)` — Append a free-form decision.
- Timeline operations (wrap [timeline.ts](timeline.md)): `inspectTimelineImpl`, `trimTimelineClipImpl`, `moveTimelineClipImpl`, `setFinalHoldImpl`. Each reads `currentProjectTimeline`, edits, saves `timeline` in project state, returns `inspectTimeline`.
- Plan validators: `validateProductionVideoPlan`, `validatePlanRuntimeCoverage`, `validatePlanAudioDurationFit`, `validateSceneSpeechAndVisualCoverage`, `repairIntroducedOnlyNewIssueFamilies`; estimators `estimateSceneSpeechSeconds`, `estimatePlanSpeechSeconds`; normalizers `normalizePlan`, `normalizePlanRuntimeToTarget`, `alignPlanToMeasuredVoiceover`.
- Prompt builders: `providerImagePrompt(plan, scene)` (single-frame guard, human/minor safety guards, vibe line, scene physics packet), `providerVideoPrompt(plan, scene)` (one continuous shot from entry to closing state).
- Helpers: `loadVideoPlan`, `saveVideoPlan`, `planDurationSeconds`, `sceneIdsFor`, `patchSceneInPlan`, `reviseSceneNarrations`, `invalidateFinalArtifacts`, `clearRenderOutputs`, `buildVideoManifest`, `mergeTokenOutputIntoManifest`, `narrationStats`, `timelineFromProjectState`, `currentProjectTimeline`, `ensureSupportedImageOptions`, `ensureSupportedVideoOptions`, `contextWithMagicImageSettings`, `contextWithMagicVideoSettings`, `youtubeSectionsToVideoPlan`, `existingYoutubeManifest`, `shouldReuseExistingYoutubeManifest`.

**Internal flow (first render):**
1. `draft_video_plan` → artifact `plan`, stage `plan_drafted`.
2. `generate_voiceover` → artifact `voiceover` (or per-scene files under `voiceover/scenes/`), stage `voiceover_generated`.
3. `generate_scene_images` → artifact `images`, stage `images_generated`.
4. `animate_scene_videos` → artifact `videos`, stage `videos_animated`.
5. `stitch_final_video` → `final.mp4`, artifact `manifest`, verified `timeline`.
6. Any failure is kept in artifact `failed_scenes` with a `stage` (`image_generation`, `video_generation`, `talking`, `voiceover_validation`, ...) and provider job metadata when recoverable.

**Depends on:** [media.ts](media.md) (providers, ffmpeg stitch, probes), [timeline.ts](timeline.md), [voices.ts](voices.md), [renderState.ts](../state-and-scheduling/renderState.md), [projects.ts](../state-and-scheduling/projects.md), [projectContext.ts](../state-and-scheduling/projectContext.md), [timings.ts](../state-and-scheduling/timings.md), [schemas.ts](../foundation/schemas.md), [creativeDecision.ts](../decision-and-planning/creativeDecision.md), [planReadiness.ts](../decision-and-planning/planReadiness.md), [sceneAudio.ts](../decision-and-planning/sceneAudio.md), [sceneContinuity.ts](../decision-and-planning/sceneContinuity.md), [audioPerformance.ts](../decision-and-planning/audioPerformance.md), [prompts.ts](../decision-and-planning/prompts.md), [magicHourCapabilities.ts](../decision-and-planning/magicHourCapabilities.md), [inputMedia.ts](../api-and-transport/inputMedia.md), [usageCost.ts](../agent-runtime/usageCost.md), [youtubeShort.ts](../youtube-workflow/youtubeShort.md).

**Used by:**
- [agents.ts](../agent-runtime/agents.md) — agent tool handlers (almost all `*Impl` exports).
- [runners.ts](../agent-runtime/runners.md) — draft/fallback plan, voiceover, images, videos, stitch, clarification, `mergeTokenOutputIntoManifest`.
- [index.ts](../api-and-transport/index.md) — timeline HTTP edits (`inspectTimelineImpl`, `trimTimelineClipImpl`, `moveTimelineClipImpl`, `setFinalHoldImpl`).
- Tests: `server/tests/workflows.retry.test.ts`, `workflows.lipsync.test.ts`, `youtubeWorkflow.test.ts`, `planQuality.test.ts`, `creativeDecision.test.ts`.

**Gotchas:**
- Paid-call guards: `assertProviderCallsAllowed` blocks image/video calls after a failed or rejected voiceover; `assertNoCompletedManifest` blocks first-run tools once `final.mp4` exists. Use edit tools after that.
- `draftVideoPlanImpl` refuses to replace the plan once `voiceover`, `images`, or `videos` artifacts exist.
- Repair budgets: plan validation fails hard after 1 earlier failure (2 if the repair only introduced new issue families); voiceover validation fails hard after 1 earlier failure.
- On a first full render (`videos` empty, no manifest), `animateSceneVideosImpl` ignores `sceneIds` and renders all scenes.
- Request-level `image_model` / `video_model` win over tool `options.model` in the first-run tools; retry/regenerate use the options directly.
- `renderTalkingPairs` records its own failures; a talking failure without a job id falls back to image-to-video. `renderSingleSceneVideo` records nothing and throws on double failure.
- Stitch recovery: timed-out I2V jobs and stalled job recoveries fall back to `generateImageFallbackVideoAsset` when a keyframe exists. Each failure is checked once (`recovery_checked_at`).
- Stitch throws if the final duration is more than 0.5 s below `0.95 × explicit target − 1 s` (`assertFinalDurationCloseToExplicitTarget`).
