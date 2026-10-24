# Media Pipeline

> Level 2 · Up: [Server](../README.md)

**End product:** An accepted `VideoPlan` turned into media files under `outputs/<project_id>/`: voiceover audio, scene keyframes, scene videos, an editable `timeline`, and a stitched `final.mp4` with a `manifest`. It also gives the edit operations that change one part and re-stitch.

**Parts:**
- [workflows.ts](workflows.md) — Agent tool implementations (`*Impl`). Own the artifact state machine: plan → voiceover → images → videos → stitch, plus retry, regenerate, narration, voiceover and timeline edits.
- [media.ts](media.md) — Provider primitives. Magic Hour image, image-to-video and talking-photo jobs (submit, poll, recover, still-fallback). Hume / Fish / ElevenLabs TTS. `ffprobe` probes and `ffmpeg` normalize and stitch. Holds no workflow state.
- [timeline.ts](timeline.md) — `TimelineArtifact` data model (video, narration, guard tracks; final hold). Builds it from project state. Applies pure edits (`trimClip`, `moveClip`, `setFinalHold`).
- [voices.ts](voices.md) — Fish Audio voice catalog and gender-matched voice selection per plan. Maps the choice to a Fish `reference_id`, an ElevenLabs voice name, or a Hume voice description.
- [mediaSync.ts](mediaSync.md) — `probeMediaDurationSync`. Blocking `ffprobe` duration probe for synchronous callers.

**How the parts work together:**
1. The agent (or `runners.ts` fallback) calls `draftVideoPlanImpl` in `workflows.ts`. `normalizePlan` calls `normalizePlanVoice` (`voices.ts`) to lock one narrator voice. `voiceContinuityIssues` feeds the plan validators. A passed plan is saved as artifact `plan`.
2. `generateVoiceoverImpl` resolves the voice through `voices.ts` (`resolveVoiceReferenceId`, `humeVoiceDescriptionForPlan`, `elevenLabsVoiceNameForPlan`). It then calls `media.ts` TTS: `generateVoiceoverAsset` for one global voiceover, or `generateSceneVoiceovers` for per-scene audio plans (`planNeedsPerSceneAudio`).
3. `media.ts` TTS calls `estimateTtsWordsPerSecondForContext` (`prompts.ts`). That estimate uses `probeMediaDurationSync` (`mediaSync.ts`) on voiceovers of past projects.
4. `workflows.ts` checks the measured voiceover duration and moves scene cuts to speech boundaries (`alignPlanToMeasuredVoiceover`).
5. `generateSceneImagesImpl` calls `generateImageAsset` (`media.ts`) per scene with chained reference images. Output is artifact `images`.
6. `animateSceneVideosImpl` splits scenes by audio source. Speech-driven scenes go to `generateTalkingClip`. Other scenes go to `generateVideoAssetsBatch`. Output is artifact `videos`. Failures go to `failed_scenes` with provider job metadata (`attachProviderJobFailureMetadata`).
7. `stitchFinalVideoImpl` recovers failed jobs (`recoverVideoAssetFromProviderJob`, else `generateImageFallbackVideoAsset`). It reads the stored `timeline`, or builds one with `buildTimelineFromProjectState` (`timeline.ts`).
8. Stitch path choice in `workflows.ts`:
   - `anyEmbeddedAudio(videos)` or `planNeedsPerSceneAudio(plan)` → `stitchMixedAssets` (audio locked to each scene).
   - Else, timeline video clips exist → `stitchTimelineAssets` with the global voiceover.
   - Else → `stitchAssets`.
9. `workflows.ts` checks `final.mp4` duration against the explicit target, writes `manifest` (`buildVideoManifest`), and saves the `timeline` with `ffprobe` verification in `ending.verification`.
10. Edits: timeline tools (`trimTimelineClipImpl`, `moveTimelineClipImpl`, `setFinalHoldImpl`) apply `timeline.ts` edits and save the result. `restitchTimelineImpl` renders the edited timeline again through step 8. Scene and narration edits invalidate artifacts and re-run the needed steps.

**Key contracts:**
- Entry points: `*Impl` exports of `workflows.ts`. Callers: `agents.ts` (agent tools), `runners.ts` (`completeAcceptedVideoPlan`), `index.ts` (`PATCH /api/projects/:projectId/timeline`).
- Project artifacts (through `renderState.ts`): `plan`, `voiceover`, `images`, `videos`, `failed_scenes`, `timeline`, `manifest`, `plan_readiness`. Stage values in `status.stage`, for example `plan_drafted`, `voiceover_generated`, `images_generated`, `videos_animated`, `videos_provider_recoverable`.
- Files under `ctx.project_dir`: `voiceover/`, `images/<scene.id>/`, `videos/<scene.id>/`, `timeline_clips/`, `final.mp4`.
- Paid-call guards: `assertProviderCallsAllowed` and `assertNoCompletedManifest`. After `final.mp4` exists, only edit tools run.
- Provider keys come from `ProjectContext`: `magic_hour_api_key`, `hume_api_key`, `fish_audio_api_key`, `elevenlabs_api_key`. `ctx.audio_provider` selects TTS. `MAGIC_HOUR_*` env vars set Magic Hour timeouts and poll settings.
- `ffmpeg` and `ffprobe` must be on `PATH`.
- Stitch never cuts voiceover audio. A voiceover longer than the target makes stitch throw.
