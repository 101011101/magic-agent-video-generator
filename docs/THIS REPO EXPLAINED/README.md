# Magic Agent Video Generator

> Level 0 · Root of the README tree

**How to use this tree:**
- Start here. Each folder has a `README.md` that tells what its level builds, what each child does, and how the children work together.
- Go down one level for more detail. Level 1 = `server/`, `frontend/`, `tooling/`. Level 2 = subsystems. Leaf `.md` files = one source file (see its `Source:` line).
- Stop at the first level that answers your question. Tests: [server/tests](server/tests/README.md). Run and config files: [tooling](tooling/README.md).

**End product:** A local web app. Input: one prompt plus optional image/audio uploads. Output, saved in `outputs/<project_id>/`, is one of these:
- an agent-planned multi-scene `final.mp4` with voiceover (workflow `generated`)
- a standalone image (manifest workflow `standalone_image`)
- a YouTube source-clip short (workflow `youtube_clips`)
- a clarification question set (stage `needs_input`, no paid provider call)

Follow-up messages and timeline edits change an existing project.

**Parts:**
- [Server](server/README.md) — Fastify + `@openai/agents` backend in `server/`. It gives the REST/SSE API, runs the agent, validates plans, calls media providers, stitches with `ffmpeg`, and writes project state to `outputs/<project_id>/`.
- [Frontend](frontend/README.md) — Next.js workspace in `frontend/`. It gives the composer, uploads, settings, live progress, artifact canvas, timeline edits, and YouTube review mode.
- [Tooling and Config](tooling/README.md) — `dev.sh`, `.env.example`, build configs, and root docs (`README.md`, `HANDOFF.md`). They make server and frontend one runnable local app.

**How the parts work together:**
1. Launch: `./dev.sh` sources `.env`, checks `curl`/`ffmpeg`/`ffprobe`/Node 20.5+, runs `npm install` if `node_modules` is missing, starts the server (default `127.0.0.1:8000`), waits for `GET /api/health`, then starts the frontend (default `127.0.0.1:3000`). Logs go to `.run-logs/`.
2. Upload: the frontend sends each file to `POST /api/input-media`. The server returns an `id` and a `/media/input_media/...` URL.
3. Create: the frontend sends `POST /api/projects` with prompt, media references, workflow, models, audio provider, and transient `runtime_credentials` from the settings fields.
4. Accept: the server parses the body with `CreateProjectRequestSchema` and routes it with `classifyMagicHourRequest`. It runs `assertRuntimeReady` (keys, `ffmpeg`/`ffprobe`) only when no clarification is needed and the capability is wired. `queueProject` writes `project_state.json`, sets status `queued`, and returns `202`.
5. Run: `ProjectRunScheduler` starts `runProject`. It routes again. Missing information or an unwired capability → a clarification manifest and stage `needs_input`. Else it builds the brief (`buildProjectRunBrief`) and runs the agent (OpenAI Responses or OpenRouter Chat Completions).
6. Generate: the agent calls bounded tools: `draft_video_plan` → `generate_voiceover` → `generate_scene_images` → `animate_scene_videos` → `stitch_final_video`. Deterministic validators block paid visual generation until `plan.json` is saved. If the agent ends without `manifest.json`, `runProject` completes the saved `plan.json` without the agent (`youtube_clips`: it runs the deterministic YouTube workflow).
7. Progress: the server publishes `status` and `agent_event` events on `GET /api/projects/{project_id}/events` (SSE). The frontend `useProjectEvents` hook reads them, feeds the activity feed, and refetches `GET /api/projects/{project_id}` on each `status` event. Polling is a fallback.
8. Result: the server serves artifacts under `/media/`. The frontend `mediaUrl()` maps artifact paths to `${API_BASE}/media/...` and shows `final.mp4` or the image from the manifest.
9. Edit:
   - `POST /api/projects/{project_id}/messages` runs an edit agent turn on the saved `project_state.json` (edit tools such as `regenerate_scene`, `trim_clip`, `restitch_video`).
   - `PATCH /api/projects/{project_id}/timeline` runs timeline operations directly, without an agent (`inspect`, `trim_clip`, `move_clip`, `set_final_hold`).
10. YouTube: the server searches the YouTube Data API, ranks candidates, downloads clips with `yt-dlp`, adds per-section TTS, and stitches a short. The frontend review mode uses `/api/youtube-review-batches*` and `/api/youtube-review-sessions*` to compare search providers and save comments.

**Key contracts:**
- Frontend → server base URL: `NEXT_PUBLIC_API_BASE_URL` (fixed at build time). `dev.sh` sets it to `http://$API_PUBLIC_HOST:$BACKEND_PORT` (cross-origin). With `SINGLE_ORIGIN_DEMO=true` it stays empty, and `frontend/next.config.mjs` rewrites `/api/*` and `/media/*` to `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`).
- Server CORS allows only `localhost:3000`, `127.0.0.1:3000`, `0.0.0.0:3000`. Exception: the SSE route echoes the request `Origin`.
- Wire types: `frontend/lib/types.ts` is hand-written, not generated from server Zod schemas. Change both sides together.
- Project state on disk (root: `OUTPUT_DIR`, default `<repo root>/outputs`): `outputs/<project_id>/` holds `status.json`, `project_state.json`, `plan.json`, `voiceover.json`, `images.json`, `videos.json`, `failed_scenes.json`, `timings.json`, `token_output.json`, `manifest.json`, `final.mp4`. The timeline lives inside `project_state.json`. `manifest.json` signals the run end.
- Credential precedence: request `runtime_credentials` → in-memory project credentials → process env → `<repo root>/.env`. Project JSON stores only `has_*` flags. The frontend does not persist keys.
- Providers: OpenRouter or OpenAI (agent), Magic Hour (image/video), ElevenLabs, Hume, or Fish Audio (speech), YouTube Data API + `yt-dlp` (clips), `ffmpeg`/`ffprobe` (assembly).
- Defaults differ by entry path: the browser UI submits `openrouter` and `elevenlabs`; a direct API request uses env values (`.env.example`: `AGENT_MODEL_PROVIDER=openrouter`, `AUDIO_PROVIDER=elevenlabs`), then code fallbacks `openai` and `hume`. See `HANDOFF.md`.
- Local-first limits: no auth, no database, no durable queue, no cancellation API. Queue, credentials, and SSE buffers live in process memory and are lost on restart. `/media/` serves the whole output directory.
- Verify: `cd server && npm test && npm run typecheck`; `cd frontend && npm run build`.
