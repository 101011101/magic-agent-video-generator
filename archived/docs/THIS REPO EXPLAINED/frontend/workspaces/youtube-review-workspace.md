# youtube-review-workspace.tsx

> Level 3 · Source: `frontend/components/youtube-review-workspace.tsx` · Up: [Workspaces](README.md)

**Purpose:** Full-screen "YouTube Prompt Review" UI. It shows a batch of saved eval prompts, plays the video each run makes, and saves reviewer comments per provider.

**Role in parent:** The `"review"` mode surface. [chat-workspace.md](chat-workspace.md) is the `"compose"` mode surface. Both share the Review/Composer toggle in the header.

**Main exports:**
- `YoutubeReviewWorkspace(props)` — the only export. Presentational client component (`"use client"`). It holds no fetch logic; the parent gives data and callbacks.
  - `activeMode: "review" | "compose"`, `onModeChange(mode)` — header mode toggle.
  - `batch: YouTubeReviewBatchResponse | null` — prompt set to show.
  - `isBusy`, `onCreateBatch()` — "Generate fresh set" button (disabled while busy).
  - `onNewReview()` — header "Reset" button.
  - `onSaveComment(reviewId, provider, comments)`, `isSavingComment`, `savingProvider`, `savingReviewId` — comment save and per-panel spinner.

**Internal flow:**
1. Left panel "Prompt Set": one button per `batch.items` entry. It shows index, `readablePromptName(item.name)`, `item.category`, `item.prompt`, and an item status badge. Footer shows "Generate fresh set" and `Batch <batch_id[0..8]> from <prompt_set_path>`. Header badge shows `ready/total videos` from `batchProgress`.
2. Selection: `selectedReviewId` state. A `useEffect` resets it to the first item when the batch changes or the selected id is gone. `selectedItem` falls back to `batch.items[0]`.
3. Right top card: selected prompt text, status, spinner when `reviewIsRunning`, and `Metric` tiles for `settings.duration_seconds`, `settings.scene_count`, `aspect_ratio` + `resolution` (defaults "Auto", "9:16", "720p").
4. Right bottom: one `ProviderReviewPanel` per entry in `PROVIDERS`. Each panel shows provider `project_id`, status badge, time (`latency_seconds`), scenes (`completed/completed+failed`), `render_status`, a `<video>` from `mediaUrl(final_video_url ?? final_video_path)` or a waiting placeholder (`status.message`, `status.stage`), the error box, a comments `<textarea>`, "Save comments", and "Saved <time>" from `comments_updated_at`.
5. Comments: local `comments` state keyed by provider. A `useEffect` reloads it from `selectedReview.providers[*].comments` when `review_id` changes. Save calls `onSaveComment` with the current text.

**Status rules (internal helpers):**
- A provider counts as done when it has `final_video_url` or `final_video_path` (`providerHasVideo`), even if `status.status` is not `"succeeded"`.
- Provider label: `Queued` / `Running` / `Failed` / `Ready`, or `Partial` when `failed_scene_count > 0`.
- Item label (`itemStatus`): `Running` if any provider has no video and is queued/running; else `Needs review` if any failed; else `Partial` if any scene failed; else `Ready`. No providers → `Queued`.
- Error text (`providerError`): `status.error`, else `status.manifest.failed_scenes` joined as `scene_id: error`.
- Other helpers: `formatDuration` (`12.3s`, `1m 05s`, `null` → "Waiting"), `*StatusTone` (Tailwind badge colors), `Metric` (label/value tile).

**Depends on:**
- `@/lib/types`: `YouTubeReviewBatchResponse`, `YouTubeReviewBatchItem`, `YouTubeReviewSessionResponse`, `YouTubeReviewProviderResult`, `YouTubeReviewProvider` (`"youtube_data_api" | "yt_dlp"`).
- `@/lib/api`: `mediaUrl` (video source URL).
- `@/components/ui/button` (`Button`), `@/lib/utils` (`cn`), `lucide-react` icons.

**Used by:** `frontend/app/page.tsx` (`HomePage`) when `mode === "review"`. It wires:
- `batch` ← `createBatch.data ?? latestBatch.data` (`useCreateYoutubeReviewBatch`, `useLatestYoutubeReviewBatch` in `frontend/hooks/use-project.ts`; latest batch polls every 2 s while providers run).
- `onCreateBatch` and `onNewReview` → both `handleCreateBatch` (POST `/api/youtube-review-batches`).
- `onSaveComment` → `useSaveYoutubeReviewComment` (POST `/api/youtube-review-sessions/{reviewId}/comments`).

**Gotchas:**
- `PROVIDERS` lists only `youtube_data_api`. The `yt_dlp` comment state exists but no `yt_dlp` panel renders.
- "Reset" does not clear the view. In `page.tsx` it starts a new batch, same as "Generate fresh set".
- `page.tsx` prefers `createBatch.data` over `latestBatch.data`. The mutation result is a fixed snapshot and `page.tsx` never resets it. After "Generate fresh set", this component gets that snapshot, not the polled latest batch.
- Comment edits reset only when `review_id` changes. Polling updates do not overwrite unsaved text.
