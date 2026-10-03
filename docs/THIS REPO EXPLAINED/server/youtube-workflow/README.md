# YouTube Workflow

> Level 2 · Up: [Server](../README.md)

**End product:** One real YouTube source clip per script section for workflow `youtube_clips`. Output is a list of clip records (or per-section `Error`s) in section order. `createYoutubeShortImpl` (`server/src/workflows.ts`) then adds per-section voiceover and stitches `final.mp4`.

**Parts:**
- [youtubeShort.md](youtubeShort.md) — `youtubeShort.ts`: The clip sourcer. YouTube Data API search with key rotation, candidate scoring, subject gate, transcript windows, VLM frame check, `yt-dlp` download, clip records.
- [youtubeSubagents.md](youtubeSubagents.md) — `youtubeSubagents.ts`: Two optional low-cost OpenAI subagents with deterministic fallbacks. Script-budget reviewer and per-section candidate ranker.

**How the parts work together:**
1. The agent tool `create_youtube_short_from_prompt` (or the `runners.ts` fallback) calls `createYoutubeShortFromPromptImpl` (`server/src/agents.ts`). It requires `workflow === "youtube_clips"`.
2. `draftYoutubeScriptImpl` runs the script agent and gets a `YouTubeScriptPlan` (sections with `dialogue`, `duration_seconds`, `search_hint`). It forces a web search call when `web_search_needed` is set and the provider is not OpenRouter.
3. `reviewYoutubeScriptWithSubagent` (youtubeSubagents) fits the plan to the runtime and word budget. The plan is written as `youtube_script_plan.json`. The review goes into decision metadata as `subagent`.
4. `createYoutubeShortImpl` saves a video plan through `draftVideoPlanImpl` and calls `downloadYoutubeClipAssets` (youtubeShort) with `proxy_url` and `youtube_search_provider`.
5. For each section in parallel, youtubeShort builds a candidate pool, then calls `rankYoutubeCandidatesWithSubagent` (youtubeSubagents) to reorder it. The review goes on the clip record as `youtube_subagent_candidate_review`.
6. youtubeShort tries the tiers `transcript` → `visual_fallback` → `last_resort`, downloads the window with `yt-dlp`, and checks frames with the VLM. `youtubeSubagentModel()` is the last model fallback for this check.
7. `createYoutubeShortImpl` turns results into `videos.json` and `failed_scenes.json`. Zero clips → stage `youtube_short_failed` and throw.
8. TTS runs only for sections with a clip (`generateSectionVoiceovers`). Section durations are reset from the voiceover lengths.
9. Output aspect ratio comes from the downloaded clips (`inferYoutubeOutputAspectRatio`). The timeline uses a 0.25 s final hold. Stitch writes `final.mp4`; `manifest.json` gets `workflow: "youtube_clips"`, `video_model: "youtube-clips"`.

**Key contracts:**
- **Entry points:** `createYoutubeShortFromPromptImpl(ctx, { proxy_url })`, `createYoutubeShortImpl(ctx, title, narration, sections, options)`, `downloadYoutubeClipAssets(ctx, sections, { proxy_url?, search_provider? })`.
- **Input shape:** `YouTubeClipSection` (`dialogue`, `duration_seconds`, `search_hint`, optional `channel_hint`, `candidate_video_urls`, search filters such as `search_order`, `published_after`, `require_captions`).
- **Clip record:** `window_source` (`transcript` | `visual_fallback` | `last_resort`), `video_id`, `youtube_url`, `source_duration_seconds` (ffprobe of the real file; `timeline.ts` reads it for cut vs freeze).
- **Files on disk:** `outputs/<project_id>/youtube_script_plan.json`, `youtube_clips/scene_<n>/<start>_<videoId>.mp4`, `section_voiceovers.json`, `videos.json`, `failed_scenes.json`, `manifest.json`, `final.mp4`.
- **Status stages:** `youtube_script` → `youtube_script_ready` → `youtube_clips_downloaded` → `youtube_voiceover_generated` → `youtube_short_stitched`; failure `youtube_short_failed`.
- **Env:** `YOUTUBE_API_KEY_1..3` / `YOUTUBE_API_KEY` / `YOUTUBE_API_KEY_ALIASES`, `YT_DLP_PATH`, `OPENAI_API_KEY`, `YOUTUBE_SUBAGENTS_ENABLED`, `YOUTUBE_SUBAGENT_MODEL`, `YOUTUBE_VISUAL_VERIFY*`.
- **System commands:** `yt-dlp`, `ffmpeg`, `ffprobe`.
- **Gotchas:**
  - Clip search runs before TTS, so failed sections do not consume TTS.
  - A missing `OPENAI_API_KEY` turns off both subagents and fails every VLM frame check (rejection), unless visual verify is disabled.
  - `reuse_existing_manifest: true` returns an existing manifest and skips downloads.
