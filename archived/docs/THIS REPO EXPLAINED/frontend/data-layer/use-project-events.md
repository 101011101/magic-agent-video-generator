# use-project-events.ts

> Level 3 · Source: `frontend/hooks/use-project-events.ts` · Up: [Data layer](README.md)

**Purpose:** React hook. It streams live project activity (status changes and agent events) from the server over Server-Sent Events (SSE).

**Role in parent:** Gives the data layer its push channel. It keeps a rolling list of activity events for the UI. It also tells React Query to refetch the project on each status event, so the UI does not wait for the next poll.

**Main exports:**
- `useProjectEvents(projectId: string | null)` → `{ events: ProjectActivityEvent[], connected: boolean }`
  - `events` — deduplicated activity events, oldest first, maximum `MAX_EVENTS` (400).
  - `connected` — `true` after `EventSource.onopen`, `false` after `onerror` or unmount.

**Internal flow:**
1. On each `projectId` change: clear `events` and the `seenIds` set. If `projectId` is `null`, stop.
2. Open `new EventSource(`${API_BASE}/api/projects/${projectId}/events`)`.
3. Listen to two named SSE events: `status` and `agent_event`. Both go to `push`.
4. `push` parses `raw.data` as JSON. It drops the event if the JSON is invalid.
5. If the event has an `id` that is already in `seenIds`, drop it. Otherwise add the `id`.
6. Append the event. If the list is longer than 400, keep only the last 400.
7. If `event.type === "status"`, call `queryClient.invalidateQueries({ queryKey: ["project", projectId] })`. This makes `useProject` in [use-project.md](use-project.md) refetch.
8. On cleanup: `source.close()` and set `connected` to `false`.

**Depends on:**
- `API_BASE` from `@/lib/api` ([api.md](api.md)); built from env var `NEXT_PUBLIC_API_BASE_URL`.
- `ProjectActivityEvent` from `@/lib/types` ([types.md](types.md)). Fields: `id`, `type`, `project_id`, `created_at`, plus optional `event_name`, `item_type`, `tool_name`, `arguments_preview`, `output_preview`, `text`, `agent_name`, `status`, `stage`, `progress`, `message`, `error`.
- `useQueryClient` from `@tanstack/react-query`.
- Server route `GET /api/projects/:projectId/events` in `server/src/index.ts`. It writes `event: <type>\ndata: <json>`, replays `projectEvents.bufferedEvents(projectId)` first, then sends live events. It sends a `:heartbeat` comment every 15 s. `agent_event` events come from `server/src/runners.ts`.

**Used by:**
- `frontend/components/chat-workspace.tsx` — calls `useProjectEvents(job?.project_id ?? null)`. It passes `events` and `connected` to `RunPanel`. `RunPanel` shows a "live"/"idle" badge and renders `ActivityFeed`.

**Gotchas:**
- The server replays buffered events on each connect. `EventSource` reconnects automatically after an error. The `seenIds` check stops duplicates from these replays. Events with no `id` are never deduplicated.
- Only the named SSE events `status` and `agent_event` are handled. Other event types from the server are ignored (no `onmessage` handler).
- `seenIds` is not trimmed with the 400-event cap. It grows for the life of one connection.
