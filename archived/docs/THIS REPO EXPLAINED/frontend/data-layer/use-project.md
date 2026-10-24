# use-project.ts

> Level 3 · Source: `frontend/hooks/use-project.ts` · Up: [Data layer](README.md)

**Purpose:** React Query hooks for projects and YouTube review batches: reads, writes, cache updates, fallback polling.

**Role in parent:** Wraps the fetch functions in [api.md](api.md) as cached queries and mutations. Gives the page one hook per server action.

**Main exports:**
- `useProject(projectId)` — query key `["project", projectId]`. Calls `getProject`. Disabled when `projectId` is null. Polls every 10 s while `status` is `"queued"` or `"running"`; else no poll.
- `useProjects(enabled = true)` — query key `["projects"]`. Calls `getProjects(100)`. Polls every 5 s while any listed project is `"queued"` or `"running"`.
- `useCreateProject()` — mutation. Calls `createProject(CreateProjectPayload)`. On success: seeds `["project", project_id]`, invalidates `["projects"]`.
- `useSendProjectMessage(projectId)` — mutation. Calls `sendProjectMessage(projectId, ProjectMessagePayload)`. Throws when `projectId` is null. On success: seeds and invalidates `["project", project_id]`, invalidates `["projects"]`.
- `usePatchProjectTimeline(projectId)` — mutation. Calls `patchProjectTimeline(projectId, TimelineEditPayload)`. Throws when `projectId` is null. Same cache updates as `useSendProjectMessage`.
- `useLatestYoutubeReviewBatch(enabled = true)` — query key `["youtube-review-batch", "latest"]`. Calls `getLatestYoutubeReviewBatch`. `retry: false`. Polls every 2 s while any provider in any batch item has status `"queued"` or `"running"`.
- `useCreateYoutubeReviewBatch()` — mutation. Calls `createYoutubeReviewBatch`. On success: seeds `["youtube-review-batch", batch_id]` and `["youtube-review-batch", "latest"]`.
- `useSaveYoutubeReviewComment(batchId?)` — mutation. Input is `YouTubeReviewCommentPayload & { reviewId }`. Splits off `reviewId`, calls `saveYoutubeReviewComment(reviewId, payload)`. On success: seeds `["youtube-review-session", review_id]`, invalidates `["youtube-review-batch", batchId]` (if set) and `["youtube-review-batch", "latest"]`.
- Private helpers: `hasRunningProject`, `reviewBatchHasRunningProviders` — the "still running" checks that drive `refetchInterval`.

**Internal flow:**
1. A mutation returns the new server state (`ProjectStatusResponse` or batch/session data).
2. `onSuccess` writes that state straight into the cache with `setQueryData`. The UI updates without a refetch.
3. `invalidateQueries` marks related keys stale, so React Query refetches them.
4. While a job runs, `refetchInterval` polls. It stops when no status is `"queued"` or `"running"`.

**Depends on:** `@tanstack/react-query`; fetch functions from `@/lib/api` ([api.md](api.md)); types from `@/lib/types` ([types.md](types.md)).

**Used by:** `frontend/app/page.tsx` (only importer). It enables `useProjects` in `"compose"` mode and `useLatestYoutubeReviewBatch` in `"review"` mode.

**Gotchas:**
- The 10 s poll in `useProject` is a fallback only. Real-time updates come from SSE: [use-project-events.md](use-project-events.md) invalidates `["project", projectId]`.
- `useProjects` has no SSE path. It relies on the 5 s poll.
- No code reads `["youtube-review-session", review_id]` with `useQuery`. The seeded cache entry has no consumer in the frontend.
