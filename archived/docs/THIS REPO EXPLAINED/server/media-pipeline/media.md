# media.ts

> Level 3 · Source: `server/src/media.ts` · Up: [Media Pipeline](README.md)

**Purpose:** Provider primitives. Generate images, videos and voiceovers through external APIs. Probe, normalize and assemble media with `ffprobe`/`ffmpeg` into `final.mp4`.

**Role in parent:** [workflows.ts](workflows.md) calls these functions for each render step. This file holds no workflow state. It takes a `ProjectContext` and a `Scene`/plan, writes files under `ctx.project_dir`, and returns asset records.

**Main exports:**

- Asset types — `ImageAsset`, `VideoAsset`, `VoiceoverAsset` (optional `scene_timings`, `sections`), `SectionVoiceover`, `SceneVoiceover`, `VideoAssetJob`, `ProviderJobFailureMetadata`, `RecoverVideoAssetJob`, `TimelineStitchClip`, `PerSectionScene`, `MediaStreamDurations`.
- **Magic Hour images**
  - `generateImageAsset(ctx, scene, referenceImagePaths?)` — With reference images: `v1.aiImageEditor.generate` (`style_tool: "ai-image-editor"`). Without: `v1.aiImageGenerator.create`. Polls, downloads to `images/<scene.id>/`.
  - `generateStandaloneImageAssets(ctx, prompt, {image_count, name})` — 1–4 images not tied to a scene. Writes to `images/standalone/` (`image_<n>/` subfolders when count > 1).
- **Magic Hour video**
  - `submitVideoAssetJob(ctx, scene, image)` — Submits image-to-video without wait. `ctx.video_model === "minimax-h3"` uses a raw `fetch` POST to `https://api.magichour.ai/v1/image-to-video` (body from `minimaxH3RequestBody`). Other models use `v1.imageToVideo.generate` with `audio: false`.
  - `pollVideoAssetJob(ctx, job)` — Polls `v1.videoProjects.get`, downloads to `videos/<scene.id>/`. When `job.audio` is true, it requires a native audio stream and sets `has_embedded_audio`.
  - `generateVideoAsset(ctx, scene, image)` — Submit + poll for one scene.
  - `generateVideoAssetsBatch(ctx, pairs)` — Submits all jobs, then polls all jobs concurrently. Returns `VideoAsset | Error` per index. One failure does not fail the batch.
  - `generateTalkingClip(ctx, scene, imagePath, audioPath, audioDuration)` — `v1.aiTalkingPhoto.generate` (image + audio, `generationMode: "realistic"`). Returns `has_embedded_audio: true`, `on_camera: true`. Writes to `videos/<scene.id>/talking/`.
  - `recoverVideoAssetFromProviderJob(ctx, job)` — Re-polls an existing i2v or talking-photo job ID (no new submit). Timeout from `providerRecoveryPollTimeoutSeconds()`.
  - `generateImageFallbackVideoAsset(ctx, scene, image, reason, providerJobId?)` — Local `ffmpeg` still-loop video. `model: "local-still-fallback"`, `provider_status: "fallback"`.
- **Provider errors**
  - `isTransientProviderError(err)` — True for HTTP 408/425/429/5xx and network codes (`ETIMEDOUT`, `ECONNRESET`, `AbortError`, …).
  - `attachProviderJobFailureMetadata(err, meta)` / `providerJobFailureMetadata(err)` — Put and read `provider_job_id`, `provider_kind` (`"i2v"`/`"talking-photo"`), `provider_stage` on a thrown `Error`. Workflows use this for recovery.
  - `providerErrorMessage(err)` — Error to string.
- **Download helpers** — `pickDownload`, `firstDownloadUrl`, `ensureProviderOutputDownloaded` (local file first, else fetch provider URL with up to 4 attempts), `resetProviderOutputDir` (delete + recreate).
- **Poll settings** — `magicHourPollRequestTimeoutMs`, `magicHourPollRequestAttempts`, `videoPollIntervalSeconds`, `imagePollTimeoutSeconds`, `videoPollTimeoutSeconds`, `talkingPhotoPollTimeoutSeconds`, `providerRecoveryPollTimeoutSeconds` (all read env vars; see Depends on).
- **Voiceover (TTS)**
  - `generateVoiceoverAsset(ctx, narration, durationSeconds, referenceId?, plan?)` — One global file `voiceover/voiceover.<audio_format>`. For Hume/ElevenLabs with a plan: joins scene narration, applies one calibrated performance. Conforms to target. ElevenLabs alignment gives per-scene `scene_timings`.
  - `generateSceneVoiceovers(ctx, scenes, referenceId?, plan?)` — One file per scene at `voiceover/scenes/<scene.id>.<ext>`, concurrent. Adds per-scene performance fields (`audio_mode`, `tts_speed`, `tts_temperature`, `trailing_silence`).
  - `generateSectionVoiceovers(ctx, sections)` — One file per `YouTubeClipSection` at `voiceover/sections/section_<n>.<ext>`, keyed `scene_<n>`.
  - `combineSectionVoiceovers(ctx, sectionVoiceovers)` — `ffmpeg` concat into one `VoiceoverAsset` with `sections`.
  - `conformVoiceoverToTarget(ctx, file, target)` — Speeds audio up with `atempo` only when overrun ≤ 6% and ≤ 2 s. Otherwise returns the original duration unchanged.
- **Probe** — `probeMediaDuration(file)` (`ffprobe` format duration, throws if ≤ 0), `probeMediaStreamDurations(file)` (format, video and audio stream durations).
- **Assembly** (all write `<project_dir>/final.mp4`)
  - `stitchAssets(ctx, videos, voiceover, {target_duration_seconds})` — Normalize each clip, hard-cut concat, pad/trim video to target, mux global voiceover (AAC 192k).
  - `stitchTimelineAssets(ctx, clips, voiceover, opts)` — Same, but sorts clips by `timeline_start` and trims each to `source_start`/`source_end`/`duration`. Uses `timeline_clips/`.
  - `stitchAssetsPerSection(ctx, scenes, opts)` — Mux each scene video with its own audio (`muxSection`), then concat. Keeps audio locked to each section.
  - `stitchMixedAssets(...)` — Alias of `stitchAssetsPerSection`.
  - `anyEmbeddedAudio(videos)` — True if any video has `has_embedded_audio` or `on_camera`. Workflow uses it to pick per-section vs global-voiceover stitch.
  - `normalizeSceneVideoForStitch(ctx, src, out, opts)` — Scale/crop to `targetFrameSize`, 30 fps, `yuv420p`, libx264, no audio, optional trim and freeze-pad.
  - `targetFrameSize(ctx)` — Width/height from `ctx.resolution` + `ctx.aspect_ratio` (`9:16`, `1:1`, else 16:9), even numbers.
  - `plannedFinalDurationSeconds(videos)` — Sum of `duration_seconds`, or `null` if any is invalid.
  - `minimaxH3RequestBody(ctx, scene, uploadedImagePath)` — Request JSON for MiniMax H3 (exported for tests).

**Internal flow:**

1. Magic Hour submit: wrap in `providerConcurrency.magicHourSubmit.run` and `withTiming`. Submit uses `waitForCompletion: false` and `maxRetries: 0`.
2. Poll (`pollProviderImageProject` / `pollProviderVideoProject`): loop every `MAGIC_HOUR_POLL_INTERVAL` s. Each status request has its own timeout (`withRequestTimeout`). Transient request errors retry up to `MAGIC_HOUR_POLL_REQUEST_ATTEMPTS`. Stop on `complete`, throw on `error`/`canceled` or overall timeout. Record `recordTimingEvent` spans for start, status change, end and error.
3. Download with `ensureProviderOutputDownloaded`, return the asset record.
4. TTS dispatch (`synthesizeTts`) by `ctx.audio_provider`:
   - `elevenlabs` → `elevenLabsTts`: resolves voice ID (explicit ID → preset `adam`/`brian`/`rachel` → `/v2/voices` search, cached), POSTs `/with-timestamps`, trims edges to alignment, writes `<output>.alignment.json`.
   - `hume` → `humeOctaveTts`: POST `https://api.hume.ai/v0/tts` with utterances + voice description (≤ 1000 chars), trims edge silence. On credit/429/5xx/timeout errors, falls back to Fish (`s2.1-pro`) if a Fish key and reference ID exist.
   - else → `fishAudioTts`: msgpack POST to `https://api.fish.audio/v1/tts`, retries 429 up to 3 times.
   - All paths reject audio < 1024 bytes or < 0.5 s.
5. Stitch: normalize clips → concat demuxer → pad/trim to target → mux audio. Intermediates (`merged.mp4`, `merged_timed.mp4`, concat lists) are deleted.

**Depends on:**

- Internal: [context.ts](../foundation/context.md) (`ProjectContext`), [config.ts](../foundation/config.md) (ElevenLabs defaults), [audioPerformance.ts](../decision-and-planning/audioPerformance.md), [concurrency.ts](../state-and-scheduling/concurrency.md) (`providerConcurrency`), [timings.ts](../state-and-scheduling/timings.md), [sceneAudio.ts](../decision-and-planning/sceneAudio.md), [voices.ts](voices.md) (`DEFAULT_HUME_UGC_VOICE_DESCRIPTION`), `prompts.ts` (`estimateTtsWordsPerSecondForContext`), `schemas.ts`.
- External: `magic-hour` SDK, `execa`, `@msgpack/msgpack`, `ffmpeg`/`ffprobe` on `PATH`.
- API keys from `ctx`: `magic_hour_api_key`, `hume_api_key`, `fish_audio_api_key`, `elevenlabs_api_key`.
- Env vars: `MAGIC_HOUR_SUBMIT_TIMEOUT_MS` (60000), `MAGIC_HOUR_POLL_REQUEST_TIMEOUT_MS` (30000), `MAGIC_HOUR_POLL_REQUEST_ATTEMPTS` (6), `MAGIC_HOUR_POLL_INTERVAL` (2.0), `MAGIC_HOUR_IMAGE_TIMEOUT_SECONDS` (600), `MAGIC_HOUR_VIDEO_TIMEOUT_SECONDS` (1200), `MAGIC_HOUR_TALKING_PHOTO_TIMEOUT_SECONDS` (1200), `MAGIC_HOUR_PROVIDER_RECOVERY_TIMEOUT_SECONDS` (180).

**Used by:**

- [workflows.ts](workflows.md) — generation, voiceover, recovery and all stitch functions.
- [youtubeShort.ts](../youtube-workflow/youtubeShort.md) — `probeMediaDuration` only.
- Tests: `server/tests/media.test.ts`, `server/tests/media.talkingphoto.test.ts`, `server/tests/workflows.lipsync.test.ts`, `server/tests/workflows.retry.test.ts`.

**Gotchas:**

- `resetProviderOutputDir` deletes the scene output folder before each generation. A regenerate removes the old file.
- Stitch never cuts voiceover audio. `stitchAssets`/`stitchTimelineAssets` throw if the voiceover is longer than the target (+0.04 s). `muxSection` throws if section audio exceeds its target, unless `allow_audio_trim_to_target`.
- `normalizeFinalDuration` only validates (throws when too long beyond max(3 s, 8%) or too short). It never re-encodes `final.mp4`.
- `generateTalkingClip` sends no resolution; `resolution` in the result is only `ctx.resolution` copied.
- `generateSceneVoiceovers` with Hume + Fish credentials: on a fallback-eligible error, it deletes all scene files and re-synthesizes the whole batch with Fish.
- ElevenLabs `scene_timings` are returned only when every scene narration matches the alignment text in order.
- Fish and ElevenLabs strip `[pause]`/`[long pause]` markers from text.
