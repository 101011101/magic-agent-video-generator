# page.tsx

> Level 3 · Source: `frontend/app/page.tsx` · Up: [App shell](README.md)

**Purpose:** Client page at route `/`. It holds app state and renders one of two workspaces: compose (chat video agent) or review (YouTube review batches).

**Role in parent:** The only page of the Next.js app. [layout.md](layout.md) wraps it in `Providers` (React Query) and `Toaster`. It connects the data hooks to the workspace components.

**Main exports:**
- `HomePage()` (default export) — owns `mode: "review" | "compose"` (default `"compose"`), `loadedProjectId`, and `savingTarget`; returns `YoutubeReviewWorkspace` when `mode === "review"`, else `ChatWorkspace`.
- `mergeProjectJobs(...groups)` (internal) — merges project lists, removes duplicates by `project_id`, sorts by `updated_at` descending.

**Internal flow:**
1. Init `loadedProjectId` from the `?project_id=` URL query param (only in the browser).
2. Call hooks from [use-project.md](../data-layer/use-project.md): `useProject(projectId)`, `useProjects(mode === "compose")`, `useCreateProject`, `useSendProjectMessage`, `usePatchProjectTimeline`, `useLatestYoutubeReviewBatch(mode === "review")`, `useCreateYoutubeReviewBatch`, `useSaveYoutubeReviewComment(latestBatch.data?.batch_id ?? null)`.
3. Compute `currentJob`: first `useProject` data, then `createProject.data` (if its id matches), then the match in the `useProjects` list.
4. Compute `projectJobs` = `mergeProjectJobs(projects list, createProject.data, currentJob)` for the sidebar list.
5. Compute `isBusy`: `sendMessage` or `patchTimeline` is pending, or `currentJob.status` is `"queued"` or `"running"`.
6. Handlers (each shows a `sonner` toast on success and on error):
   - `handleCreate(values)` — `createProject.mutate`; on success sets `loadedProjectId` and writes `?project_id=` with `history.replaceState`.
   - `handleMessage(message, runtimeCredentials)` — sends `{ message, runtime_credentials }` as a follow-up message.
   - `handleTimelineEdit(payload)` — sends a `TimelineEditPayload` patch.
   - `handleNewCreate()` — clears the project id and URL param; resets the three project mutations.
   - `handleSelectProject(id)` — sets the project id and URL param.
   - `handleCreateBatch()` — starts a new YouTube review batch (also used for `onNewReview`).
   - `handleSaveComment(reviewId, provider, comments)` — saves reviewer comments; `savingTarget` tracks which review/provider shows a saving state.
7. Both workspaces get `onModeChange={setMode}`; the workspace UI switches modes.

**Depends on:**
- [chat-workspace.md](../workspaces/chat-workspace.md) (`ChatWorkspace`, `ChatSubmitValues`), [youtube-review-workspace.md](../workspaces/youtube-review-workspace.md) (`YoutubeReviewWorkspace`).
- [use-project.md](../data-layer/use-project.md) hooks; types from [types.md](../data-layer/types.md): `ProjectStatusResponse`, `RuntimeCredentials`, `TimelineEditPayload`, `YouTubeReviewProvider`.
- `sonner` (`toast`).

**Used by:** Next.js App Router only (file-based route `/`, rendered inside `RootLayout` in `frontend/app/layout.tsx`). No code imports it.

**Gotchas:**
- The project id lives in component state plus the URL; `replaceState` changes the URL without navigation. There is no `popstate` handling.
- The polling-error toast is called during render when `isJobError` is true; the fixed toast id `"polling-error"` prevents duplicates.
- The project list query runs only in compose mode; the latest review batch query runs only in review mode.
- Displayed batch = `createBatch.data ?? latestBatch.data`, so a newly created batch shows before the latest-batch query refreshes.
- `isBusy` does not include `createProject.isPending`. `ChatWorkspace` gets that as `isCreating`.
- Live SSE events are not handled here; `ChatWorkspace` calls `useProjectEvents` itself.
