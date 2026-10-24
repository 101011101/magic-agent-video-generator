# Data Layer

> Level 2 · Up: [Frontend (Next.js workspace)](../README.md)

**End product:** The client-side contract with the server. It gives the UI typed REST calls, cached project state, live SSE activity, and the clarified prompt text. UI components do not build request URLs or parse server responses themselves.

**Parts:**
- [api.md](api.md) — `lib/api.ts`: `fetch` client for every backend REST endpoint, error formatting from `detail`, and `mediaUrl()` for server file paths.
- [types.md](types.md) — `lib/types.ts`: hand-written TypeScript mirrors of server payloads, responses, plan, timeline, and SSE event shapes. No runtime code.
- [use-project.md](use-project.md) — `hooks/use-project.ts`: React Query queries and mutations for projects and YouTube review batches, with cache seeding and fallback polling.
- [use-project-events.md](use-project-events.md) — `hooks/use-project-events.ts`: `EventSource` hook for live `status` and `agent_event` events; invalidates the project query on each `status` event.
- [clarifying-questions.md](clarifying-questions.md) — `lib/clarifying-questions.ts` (+ test): static clarifying questions per `WorkflowMode` and `composeClarifiedPrompt()` to merge answers into the brief. No server call.

**How the parts work together:**
1. `types.ts` defines the shapes. All other parts import from it.
2. `api.ts` sends requests to `${API_BASE}/api/...` and returns typed responses, or throws an `Error` built from the server `detail`.
3. `use-project.ts` wraps the `api.ts` functions. `app/page.tsx` is its only importer. Mutations write the returned `ProjectStatusResponse` into `["project", id]` with `setQueryData` and invalidate `["projects"]`.
4. `use-project-events.ts` opens `EventSource` on `${API_BASE}/api/projects/{id}/events` (it uses `API_BASE` from `api.ts`). `chat-workspace.tsx` calls it with `job?.project_id`.
5. Each SSE `status` event invalidates `["project", id]`, so `useProject` refetches at once. The 10 s `refetchInterval` in `useProject` is a fallback only. `useProjects` has no SSE path and polls every 5 s.
6. `agent_event` and `status` events collect in a deduplicated list (max 400) for the activity feed.
7. `clarifying-questions.ts` works on the client only. In `chat-workspace.tsx`, `startClarifiedProject` passes `composeClarifiedPrompt()` output as the `prompt` in `CreateProjectPayload`. No code path starts that flow (see **Gotchas**).

**Key contracts:**
- Env var `NEXT_PUBLIC_API_BASE_URL` → `API_BASE`. Empty means same-origin; `next.config.mjs` then rewrites `/api/*` and `/media/*` to `BACKEND_INTERNAL_URL`. The value is fixed at build time.
- Query keys: `["project", id]`, `["projects"]`, `["youtube-review-batch", "latest" | batchId]`, `["youtube-review-session", reviewId]`.
- Polling stops when no status is `"queued"` or `"running"`.
- SSE route writes named events `status` and `agent_event` and replays buffered events on each connect. The hook drops repeat `id`s.
- `mediaUrl()` maps `/media/...` and `.../outputs/...` paths to `${API_BASE}/media/...`.

**Gotchas:**
- `types.ts` is not generated from the server zod schemas. A server shape change does not break the frontend build. Update both sides together.
- `chat-workspace.tsx` imports `buildClarifyingQuestions` but does not call it. The clarification flow is unreachable in the current code.
