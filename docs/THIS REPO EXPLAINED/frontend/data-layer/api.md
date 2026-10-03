# api.ts

> Level 3 · Source: `frontend/lib/api.ts` · Up: [Data layer](README.md)

**Purpose:** Typed `fetch` client for the backend REST endpoints, plus a helper that turns backend file paths into browser-loadable media URLs.

**Role in parent:** The only module that calls backend REST endpoints. Hooks and components call these functions and do not build request URLs themselves. Request and response types come from [types.md](types.md) (`./types`).

**Main exports:**
- `API_BASE` — `NEXT_PUBLIC_API_BASE_URL` with trailing `/` removed. Empty string when the env var is not set, so requests go to same-origin `/api/...`.
- `createProject(payload: CreateProjectPayload)` — `POST /api/projects` (JSON). Returns `CreateProjectResponse`.
- `uploadInputMedia(file: File)` — `POST /api/input-media`. Sends raw file bytes as body. Sets `Content-Type` to `file.type` (fallback `application/octet-stream`) and `X-File-Name` to the URI-encoded file name. Returns `InputMedia`.
- `getProjects(limit = 100)` — `GET /api/projects?limit=<n>` with `cache: "no-store"`. Returns `ProjectListResponse`.
- `getProject(projectId)` — `GET /api/projects/{projectId}` with `cache: "no-store"`. Returns `ProjectStatusResponse`.
- `sendProjectMessage(projectId, payload: ProjectMessagePayload)` — `POST /api/projects/{projectId}/messages`. Returns `ProjectStatusResponse`.
- `patchProjectTimeline(projectId, payload: TimelineEditPayload)` — `PATCH /api/projects/{projectId}/timeline`. Returns `ProjectStatusResponse`.
- `getOpenRouterModels(apiKey?)` — `POST /api/providers/openrouter/models` with body `{ api_key: apiKey || null }`. Returns the `models` array (`OpenRouterModelInfo[]`).
- `saveYoutubeReviewComment(reviewId, payload: YouTubeReviewCommentPayload)` — `POST /api/youtube-review-sessions/{reviewId}/comments`. Returns `YouTubeReviewSessionResponse`.
- `createYoutubeReviewBatch()` — `POST /api/youtube-review-batches` (no body). Returns `YouTubeReviewBatchResponse`.
- `getLatestYoutubeReviewBatch()` — `GET /api/youtube-review-batches/latest` with `cache: "no-store"`. Returns `YouTubeReviewBatchResponse`.
- `mediaUrl(path)` — Maps a backend path to a URL the browser can load:
  1. `null`/`undefined`/empty → `""`.
  2. Starts with `http://` or `https://` → unchanged.
  3. Starts with `/media/` → `API_BASE + path`.
  4. Contains `/outputs/` → `API_BASE + "/media/" + <text after /outputs/>`.
  5. Other → unchanged.

**Internal flow (all request functions):**
1. Call `fetch` on `${API_BASE}<endpoint>`.
2. Pass the response to private `parseOrThrow<T>()`.
3. `parseOrThrow` reads the body as text and runs `JSON.parse` when the text is not empty.
4. On a non-2xx status, it throws an `Error` from `body.detail`:
   - `detail` is a string → message is `detail`.
   - `detail.message` exists → message is `detail.message`, plus `" Missing: ..."` built from `detail.missing_config` and `detail.missing_dependencies` when either is not empty.
   - Other → message is `JSON.stringify(detail)`. No `detail` → `"Request failed with <status>"`.
5. On success, it returns the parsed body cast to `T`.

**Depends on:**
- `./types` — payload and response types ([types.md](types.md)).
- Env var `NEXT_PUBLIC_API_BASE_URL` (`frontend/.env.example` sets `http://localhost:8000`).
- When `API_BASE` is empty, `frontend/next.config.mjs` rewrites `/api/:path*` and `/media/:path*` to `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`).

**Used by:**
- `frontend/hooks/use-project.ts` ([use-project.md](use-project.md)) — all project and YouTube-review request functions.
- `frontend/hooks/use-project-events.ts` ([use-project-events.md](use-project-events.md)) — `API_BASE` only, to open `EventSource` on `/api/projects/{id}/events`.
- `frontend/components/chat-workspace.tsx` — `getOpenRouterModels`, `mediaUrl`, `uploadInputMedia`.
- `frontend/components/youtube-review-workspace.tsx` — `mediaUrl`.

**Gotchas:**
- `parseOrThrow` calls `JSON.parse` before it checks `response.ok`. A non-JSON error body (for example an HTML proxy error page) throws a `SyntaxError`, not the formatted `detail` error.
- `projectId` and `reviewId` go into URL paths without `encodeURIComponent`.
- `API_BASE` is fixed at build time, because Next.js inlines `NEXT_PUBLIC_*` env vars into the client bundle.
