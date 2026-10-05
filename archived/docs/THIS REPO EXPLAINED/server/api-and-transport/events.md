# events.ts
> Level 3 · Source: `server/src/events.ts` · Up: [API and Transport](README.md)

**Purpose:** In-process, per-project event bus. It buffers events in memory and pushes them to live SSE subscribers.

**Role in parent:** Gives the SSE route `GET /api/projects/:projectId/events` a replay buffer and a live feed of status and agent events.

**Main exports:**
- `ProjectEvent` — event shape: `id`, `type`, `project_id`, `created_at` (ISO string), plus any extra fields.
- `projectEvents` — singleton `ProjectEventBus` (extends Node `EventEmitter`). `setMaxListeners(100)`.
- `projectEvents.emitProjectEvent(projectId, event)` — adds `id` (`randomUUID()`), `project_id`, `created_at`. Appends to the project buffer. Emits on channel `project:<projectId>`. Returns the full event.
- `projectEvents.bufferedEvents(projectId)` — returns a copy of the project buffer (oldest first).
- `projectEvents.subscribe(projectId, listener)` — attaches `listener` to `project:<projectId>`. Returns an unsubscribe function.

**Internal flow:**
1. A producer calls `emitProjectEvent`.
2. The bus stores the event in `buffers` (a `Map<projectId, ProjectEvent[]>`). It trims the buffer to the last `MAX_BUFFERED_EVENTS` (500).
3. The bus emits the event to all current subscribers of that project.
4. A new SSE client first replays `bufferedEvents`, then calls `subscribe` for new events.

**Event types emitted today:**
- `status` — from `updateProjectStatus` in `server/src/projects.ts`: `status`, `stage`, `progress`, `message`, optional `error`.
- `agent_event` — from `runAgentStreamed` in `server/src/runners.ts`: per `run_item_stream_event` (`event_name` plus `describeRunItem` fields), and `event_name: "agent_updated"` with `agent_name`.

**Depends on:** `node:crypto` (`randomUUID`), `node:events` (`EventEmitter`). No internal modules.

**Used by:**
- `server/src/index.ts` — SSE route. Writes `event: <type>\ndata: <json>` per event, sends `:heartbeat` every 15 s, unsubscribes on client close.
- `server/src/projects.ts` — `updateProjectStatus` emits `status`.
- `server/src/runners.ts` — `runAgentStreamed` emits `agent_event`.
- Frontend consumer: `frontend/hooks/use-project-events.ts` (`EventSource`).

**Gotchas:**
- Memory only. A server restart loses all buffers.
- Buffers never clear per project. Each project keeps up to 500 events for the process lifetime.
- `emitProjectEvent` overwrites caller-supplied `id`, `project_id`, `created_at`.
- Single process only. Multiple server instances do not share events.
