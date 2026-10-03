# API and Transport

> Level 2 · Up: [Server](../README.md)

**End product:** The only HTTP surface of the backend. It accepts project, message, timeline, upload, and review requests, validates them, starts work in other subsystems, streams live progress over SSE, and serves generated files under `/media/`. It does no generation work itself.

**Parts:**
- [index.md](index.md) — `server/src/index.ts`: Fastify app. REST routes, Zod request validation, error handler, CORS, SSE route, `/media/` static serving of `OUTPUT_DIR`, and the listen call.
- [events.md](events.md) — `server/src/events.ts`: `projectEvents`, an in-memory per-project event bus. It buffers the last 500 events per project and pushes new events to SSE subscribers.
- [inputMedia.md](inputMedia.md) — `server/src/inputMedia.ts`: stores uploaded image/audio files in `<OUTPUT_DIR>/input_media/` and resolves an upload id back to its file path.

**How the parts work together:**
1. Upload: `POST /api/input-media` (index.ts) parses `image/*` or `audio/*` as a raw `Buffer` and calls `storeInputMedia` (inputMedia.ts). The response holds `id` and `url` `/media/input_media/<file>`. The `url` works because index.ts serves `OUTPUT_DIR` at `/media/`.
2. The frontend puts upload records in `input_media` of `POST /api/projects`. index.ts validates the body, routes it, and calls `queueProject` (agent-runtime `runners.ts`). Later, `workflows.ts` calls `inputMediaPath` (inputMedia.ts) to get the file path of each uploaded image or audio.
3. Progress: `updateProjectStatus` (`projects.ts`) emits `status` events and `runAgentStreamed` (`runners.ts`) emits `agent_event` events through `projectEvents.emitProjectEvent` (events.ts).
4. `GET /api/projects/:projectId/events` (index.ts) replays `projectEvents.bufferedEvents`, then calls `projectEvents.subscribe` for new events. It sends a `:heartbeat` every 15 s and unsubscribes when the client closes.
5. The frontend plays final media from `/media/<project_id>/...` through the same static route.

**Key contracts:**
- **Routes:** `GET /api/health`, `GET|POST /api/projects`, `GET /api/projects/:projectId`, `GET /api/projects/:projectId/events`, `POST /api/projects/:projectId/messages`, `PATCH /api/projects/:projectId/timeline`, `POST /api/input-media`, `POST /api/providers/openrouter/models`, `/api/youtube-review-sessions*`, `/api/youtube-review-batches*`, `GET /media/*`. Full list: [index.md](index.md).
- **Async model:** project create, message, and review routes return `202` and do work in the background. `PATCH .../timeline` is synchronous.
- **Errors:** `HttpError` → its `statusCode` with `{ detail }`. Any other error (including Zod `.parse` failures and `inputMedia.ts` errors) → 500 `{ detail }`.
- **SSE frame:** `event: <type>` + `data: <JSON ProjectEvent>`. `ProjectEvent` has `id`, `type`, `project_id`, `created_at`, plus event fields. Types: `status`, `agent_event`.
- **Upload:** headers `content-type` (`image/*` or `audio/*`) and `x-file-name` (URI-encoded). Max 30 MB. Id is 32 lowercase hex chars.
- **Env:** `SERVER_PORT` / `PORT` (default `8000`), `SERVER_HOST` (default `127.0.0.1`), `OUTPUT_DIR`.
- **Limits:** events and SSE subscribers live in one process memory only. A restart loses buffered events. Uploaded files are never cleaned up.
- **CORS:** plugin allows `localhost:3000`, `127.0.0.1:3000`, `0.0.0.0:3000`. The SSE route sets its own headers and echoes any request `Origin`.
