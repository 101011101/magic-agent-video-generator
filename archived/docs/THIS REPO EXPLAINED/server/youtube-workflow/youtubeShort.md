# youtubeShort.ts

> Level 3 · Source: `server/src/youtubeShort.ts` · Up: [YouTube Workflow](README.md)

**Purpose:** Find, check, and download one real YouTube source clip for each script section. Return one clip record per section.

**Role in parent:** Gives the YouTube workflow its source footage. `createYoutubeShortImpl` sends the planned sections in. It gets clip records (or `Error`s) back in section order.

**Main exports:**
- `downloadYoutubeClipAssets(ctx, sections, { proxy_url?, search_provider? })` — Entry point. Runs `downloadSectionClip` for all sections in parallel (`Promise.allSettled`). Returns `Array<record | Error>` in section order.
- `selectLastResortClip(section, candidates, deps, failures?)` — Third tier. Relaxes only the score thresholds. Keeps the subject gate and the VLM gate hard. `deps: LastResortDeps` is injectable for tests. Returns `LastResortClip` or `null`.
- `metadataSpecificityRejectionReason(section, candidate, strictOverlap = true)` — Subject gate. Checks required entities, `section.subject_tokens`, and field rules. With `strictOverlap`, also checks token overlap with `search_hint` (1 of 4+ tokens, 2 of 6+ tokens).
- `requiredSubjectRejectionReason(candidateText, subjectTokens)` — Rejects when no non-broad subject token is in the candidate text (`BROAD_SUBJECT_TOKEN` tokens are ignored).
- `buildVisualMatchPrompt(section, candidate, windowMatch)` — Prompt for the frame verifier. Rejects ads, CTA banners, title/end cards, overlays, watermarks, stock footage, static shots, and lookalikes of named people.
- `youtubeWindowDurationSeconds(planned, sourceDuration)` — Over-fetch window: `max(planned, planned*1.4 + 1.5)`, clamped to source length. Covers the longer TTS voiceover.
- `visualFallbackWindow(total, wanted)` — Start at `max(4, 18% of total)`, clamped so the window fits.
- `visualFallbackDurationRejectionReason(section, candidate, total)` — Rejects sources over `MAX_VISUAL_FALLBACK_DURATION_SECONDS` (600) unless the channel is authoritative and `require_captions` is false.
- `visualVerificationFrameTimestamps(fileDuration, intendedDuration?)` — 6 frame times at offsets 4%–96% of `min(file, intended)`.
- `normalizeYoutubeSearchProvider(p)` — Accepts `auto`, `youtube_data_api`, `yt_dlp`. Always returns `youtube_data_api` (yt-dlp search was dropped). Throws on other values.
- Parsers and utilities: `parseYoutubeDurationSeconds` (ISO 8601), `parseVttTimestamp`, `cleanVttText`, `publishedAfterIso(days = 45)`, `formatG`, `normalizedToken`, `redactSecretText` (removes `key=`/`token=` query values and `AIza...` keys).
- Constants: `SEARCH_CANDIDATE_LIMIT` (18), `TRANSCRIPT_CANDIDATE_LIMIT` (8), `MIN_TRANSCRIPT_WINDOW_SCORE` (2.0), `MIN_VISUAL_FALLBACK_SCORE` (3.0), `YOUTUBE_CLIP_FORMAT_SELECTOR`, `YT_DLP_SUBPROCESS_TIMEOUT_SECONDS` (120), `STOCK_OR_WATERMARK_SOURCE_PATTERN`, provider name constants, type `Candidate`.

**Internal flow (`downloadSectionClip`, per section):**
1. Build the candidate pool (`searchSectionVideoCandidates`):
   - Hydrate planner-given `candidate_video_urls` IDs with `videos.list` (1 quota unit). Tag them `planner_web_search`.
   - Stop if the top candidate scores >= 5.0 (`BACKUP_SEARCH_MIN_SCENE_SCORE`).
   - Else run up to 3 queries through `search.list` (100 units): `search_hint` (+ `channel_hint`), focused entity tokens from dialogue, broad `"<tokens> b roll"`. Stop early when the top score reaches 5.0.
   - Planner fields become `search.list` params (`sectionSearchParams`): `search_order` → `order`, `published_after`/`published_before`, `video_duration` → `videoDuration`, `video_category` → `videoCategoryId`, `require_captions` → `videoCaption=closedCaption`. An empty filtered result retries once with no filters.
   - Without planner fields, factual/recent queries use `order=date`, `publishedAfter` (45 days), and category 25 (news) when news terms match.
   - `attachYoutubeDataApiVideoDetails` adds duration, tags, view/comment counts, definition, dimension.
   - Rank with `candidateScore`: channel/title/description token hits, +4 for `VERIFIED_CHANNEL_NAMES`, +6 for `channel_hint` match, penalties for shorts, tributes, reactions, unrelated entertainment, OpenAI source mismatch, year mismatch.
2. Rerank with `rankYoutubeCandidatesWithSubagent` ([youtubeSubagents.md](youtubeSubagents.md)).
3. Throw if `section.dialogue` is empty.
4. Tier 1, transcript (top 8): metadata gate → duration (API value, else `yt-dlp --print duration`) → fetch English VTT subs with yt-dlp → pick the cue with the most entity-token overlap with dialogue + hint → require score >= 2.0 → download the window → visual check.
5. Tier 2, visual fallback (top 8): `visualFallbackRejectionReason` (stock/watermark, entertainment, OpenAI mismatch, metadata gate, score >= 3.0; web-sourced candidates need only 1 shared token) → duration gate → download `visualFallbackWindow` → visual check.
6. Tier 3, `selectLastResortClip` over the full pool.
7. If all tiers fail, retry `downloadSectionClip` with each `sectionBackoffSearchHintVariants` hint not yet tried.
8. Else throw with every per-candidate failure reason.

**Visual check (`clipVisualRejectionReason`):** ffmpeg extracts 6 JPEG frames (max 640 px wide). OpenAI Responses API returns strict JSON `{match, reason}`. A missing `OPENAI_API_KEY`, no frames, or invalid JSON counts as a rejection.

**Download (`downloadClip`):** `yt-dlp --download-sections *start-end`, mp4 merge/remux, optional `--proxy`. Output: `<project_dir>/youtube_clips/scene_<n>/<start>_<videoId>.mp4`.

**Clip record (return value):** `scene_id`, `path`, `prompt`, `model: "youtube-clips"`, `resolution`, `audio: false`, `duration_seconds` (planned), `source_duration_seconds` (ffprobe of the real file), `start_seconds: 0`, `end_seconds`, `requested_start_seconds`/`requested_end_seconds`, `window_source` (`transcript` | `visual_fallback` | `last_resort`), `window_match`, `video_id`, `youtube_url`, `youtube_title`, `youtube_channel`, `youtube_published_at`, `youtube_api_key_alias`, `youtube_search_provider(_requested)`, `youtube_search_benchmark`, `youtube_subagent_candidate_review`.

**Depends on:**
- `./config.js` (`ENV`), `./context.js` (`ProjectContext`), `./media.js` (`probeMediaDuration`), `./schemas.js` (`YouTubeClipSection`), `./youtubeSubagents.js`.
- External: YouTube Data API v3 (`search`, `videos`), `yt-dlp`, `ffmpeg`, `ffprobe`, `openai` SDK.
- Env: `YOUTUBE_API_KEY_1`, `YOUTUBE_API_KEY_2`, `YOUTUBE_API_KEY_3`, `YOUTUBE_API_KEY`, `YOUTUBE_API_KEY_ALIASES` (comma list that overrides the key names), `YT_DLP_PATH`, `OPENAI_API_KEY`, `YOUTUBE_VISUAL_VERIFY` / `YOUTUBE_VISUAL_VERIFY_ENABLED` (default on), `YOUTUBE_VISUAL_VERIFY_MODEL` → `YOUTUBE_SUBAGENT_MODEL` → `OPENAI_FAST_MODEL` → `youtubeSubagentModel()`, `YOUTUBE_VISUAL_VERIFY_TIMEOUT_SECONDS` (default 45).

**Used by:**
- `server/src/workflows.ts` — `createYoutubeShortImpl` calls `downloadYoutubeClipAssets`.
- Tests: `server/tests/youtubeShort.smoke.test.ts`, `youtubeLastResort.test.ts`, `youtubeSubject.test.ts`, `youtubeCtaPersistence.test.ts`.

**Gotchas:**
- Key rotation: `searchResponse` tries keys in order, with the last working key first. A failed key is cleared from `workingYoutubeApiKey`. The alias of the key that worked goes on each candidate.
- `searchVideoCandidatesWithProvider` returns `[]` on search error. The error is only in the benchmark attempt, so an API outage looks like "no candidates".
- `webSearchVideoUrlsForSection` is a stub that returns `[]`. Planner-supplied `candidate_video_urls` are the only web-sourced input.
- Module-level caches (`VIDEO_DURATION_CACHE`, `TRANSCRIPT_ENTRIES_CACHE`, `workingYoutubeApiKey`) persist for the process lifetime.
- Transcript fetch has no timeout. `downloadClip` and duration probes use a 120 s subprocess timeout and a 15 s socket timeout.
- Much logic is ported from Python (`pythonFloatStr`, `formatG`, `htmlUnescape`). File names depend on the Python float format (for example `4_0_<id>.mp4`).
- Many hard-coded topic rules (OpenAI models, iPhone years, ancient coins, deep-sea, sports) change scores and rejections.
