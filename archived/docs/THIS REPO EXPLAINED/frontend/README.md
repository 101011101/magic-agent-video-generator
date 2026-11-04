# Frontend (Next.js workspace)

> Level 1 · Up: [THIS REPO EXPLAINED](../README.md)

**End product:** One-page browser UI ("Local Video Composer") at `/`. It starts video projects on the server, shows live agent progress, previews artifacts, edits the timeline, and runs YouTube search-provider review batches.

**Parts:**
- [App Shell](app-shell/README.md) — Root layout, global styles, one React Query `QueryClient`, `sonner` `Toaster`; `app/page.tsx` (`HomePage`) owns app state and picks the active workspace.
- [Workspaces](workspaces/README.md) — `ChatWorkspace` (composer, uploads, settings, project queue, activity feed, artifact canvas, scene timeline) and `YoutubeReviewWorkspace` (review batches, per-provider videos and comments); shared `Button` and `cn()`.
- [Data Layer](data-layer/README.md) — `lib/api.ts` fetch client and `mediaUrl()`, `lib/types.ts` server contract types, React Query hooks, SSE hook `useProjectEvents`, clarifying-question helpers.

**How the parts work together:**
1. `app/layout.tsx` wraps the page in `Providers` (one `QueryClient`, `staleTime` 60 s) and `Toaster`.
2. `HomePage` holds `mode` (`"compose"` | `"review"`) and `loadedProjectId` (read from and written to `?project_id=` with `window.history.replaceState`).
3. `HomePage` calls the Data Layer hooks (`useProject`, `useProjects`, `useCreateProject`, `useSendProjectMessage`, `usePatchProjectTimeline`, `useLatestYoutubeReviewBatch`, `useCreateYoutubeReviewBatch`, `useSaveYoutubeReviewComment`). It passes data and `on*` callbacks to the active workspace and shows results as toasts.
4. Workspaces are presentational. Every server write goes through a `HomePage` callback. Both get `onModeChange={setMode}` for the Review/Composer toggle.
5. `ChatWorkspace` calls the Data Layer directly only for `uploadInputMedia`, `getOpenRouterModels`, and `useProjectEvents`. It builds a `CreateProjectPayload` (workflow, models, audio provider, `runtime_credentials` from settings fields) and calls `onCreate`. Follow-ups go through `onMessage`. Timeline controls send `TimelineEditPayload` through `onTimelineEdit`.
6. `useProjectEvents(job?.project_id)` opens `EventSource`. Each SSE `status` event invalidates `["project", id]`, so `useProject` refetches the manifest. `status` and `agent_event` entries feed the activity feed.
7. Mutations write the returned `ProjectStatusResponse` into `["project", id]` and invalidate `["projects"]`.
8. Both workspaces load server files through `mediaUrl()`, which maps `/media/...` and `.../outputs/...` paths to `${API_BASE}/media/...`.

**Key contracts:**
- Server endpoints: `POST/GET /api/projects`, `GET /api/projects/{id}`, `POST /api/projects/{id}/messages`, `PATCH /api/projects/{id}/timeline`, `GET /api/projects/{id}/events` (SSE), `POST /api/input-media`, `POST /api/providers/openrouter/models`, `POST /api/youtube-review-batches`, `GET /api/youtube-review-batches/latest`, `POST /api/youtube-review-sessions/{id}/comments`.
- `NEXT_PUBLIC_API_BASE_URL` → `API_BASE`, fixed at build time. Empty means same origin.
- `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`) — `next.config.mjs` rewrites `/api/*` and `/media/*` to it.
- `dev.sh` starts the frontend on `FRONTEND_PORT` (default `3000`). `SINGLE_ORIGIN_DEMO=true` gives `NEXT_PUBLIC_API_BASE_URL` no default (empty unless set) and uses the rewrites. Else the default is `http://${API_PUBLIC_HOST}:${BACKEND_PORT}`.
- Polling is a fallback: `useProject` every 10 s, `useProjects` every 5 s, latest review batch every 2 s — only while something is `queued` or `running`.
- API keys typed in settings are local React state, sent per request as `runtime_credentials`. The frontend does not persist them.
- `lib/types.ts` is hand-written, not generated from server schemas. Change both sides together.
- Stack: Next.js 16, React 18, TanStack React Query 5, Tailwind 3, `lucide-react`, `sonner`.

**Gotchas:**
- `ChatWorkspace` has a clarification flow (`composeClarifiedPrompt`) but never calls `buildClarifyingQuestions`, so no session starts. The clarifying-question UI is unreachable.
- `tailwind.config.ts` maps colors to shadcn CSS vars that `globals.css` does not define.
