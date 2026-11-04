# root-docs (README.md, HANDOFF.md)

> Level 2 · Source: `README.md`, `HANDOFF.md` · Up: [Tooling and Config](README.md)

**Purpose:** Human-written entry docs at the repo root. `README.md` = quick start and API usage. `HANDOFF.md` = engineering handoff: defaults, credentials, architecture, limitations, verification.

**Role in parent:** Tells a new reader how to configure, launch, verify, and call the app that the other tooling parts (`dev.sh`, `.env.example`, build config) set up.

**When to read each:**
- Read `README.md` to run the app, call the API with `curl`, or find the output file layout.
- Read `HANDOFF.md` to learn effective defaults, credential precedence, module ownership, the request lifecycle, known limitations, and the last verification result.
- Read the source code for exact behavior. Both docs are summaries and have drift (see **Gotchas**).

**`README.md` (213 lines) covers:**
- Product: "Local Video Composer". One prompt -> finished MP4. Agent runtime (`@openai/agents`) + Magic Hour image/video + Fish/Hume/ElevenLabs voiceover + ffmpeg stitch. Local-first: no durable queue, database, object storage, auth, or cloud deploy.
- **Structure:** short map of 8 `server/src/` files, `server/tests/`, `frontend/app/page.tsx`, `frontend/components/`, `dev.sh`.
- **Agent Design:** `video_studio` tool namespace; tool order `draft_video_plan` -> `generate_voiceover` -> `generate_scene_images` -> `animate_scene_videos` -> `inspect_render_status` / `record_project_decision` / `retry_scene` -> `stitch_final_video`; edit tools `regenerate_scene`, `revise_narration`, `replace_voiceover` -> `restitch_video`. Project memory lives in `project_state.json`.
- **Workflow:** 9 steps from `POST /api/projects` through SSE `GET /api/projects/{project_id}/events` to follow-up `POST /api/projects/{project_id}/messages`. One failed scene -> marked partial MP4.
- Output layout under `outputs/<project_id>/` (`plan.json`, `status.json`, `project_state.json`, `manifest.json`, `images.json`, `videos.json`, `voiceover.json`, media subfolders, `token_output.json`, `final.mp4`). `token_output.json` holds only agent-token usage and cost.
- **Setup:** required keys, a "useful defaults" env block, optional OpenRouter env block, required commands (`node` 20.5+ or 18.18+, `npm`, `ffmpeg`, `ffprobe`, `curl`, `yt-dlp` for YouTube only).
- **Run:** `./dev.sh`; frontend `http://localhost:3000`; backend `http://localhost:8000`; logs `.run-logs/backend.log`, `.run-logs/frontend.log`; host/port overrides `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`, `FRONTEND_PORT`.
- **Verify:** `cd server && npm test && npm run typecheck`; `cd frontend && npm run build`.
- **API:** `curl` examples for create project (`prompt`, `duration_seconds`, `scene_count`, `aspect_ratio`, `resolution`), SSE stream (`status` and `agent_event` events), follow-up message.

**`HANDOFF.md` (410 lines) covers:**
- **Current Scope:** multi-scene video pipeline is primary; standalone image, YouTube source-clip assembly, follow-up edits, timeline edits also exist. Python backend removed; TypeScript under `server/` and `frontend/` is the source of truth.
- **Effective Defaults:** two paths. Browser UI sends `openrouter` + `deepseek/deepseek-v4-pro`, intensity `max`, `nano-banana-2-lite`, video `auto`, `elevenlabs` + `brielle - podcast girl`. Direct API without `.env` falls back to OpenAI `gpt-5.4`, Hume `octave-1`, Nano Banana 2 Lite, MiniMax H3.
- **Credential Contract:** tables of required keys per provider path and YouTube settings (`YOUTUBE_API_KEY`, `YOUTUBE_API_KEY_ALIASES`, `YT_DLP_PATH`). Precedence: `runtime_credentials` > in-memory project credentials > process env > `.env`. Project JSON stores only credential availability booleans.
- **Architecture:** module-by-module ownership for entry/transport, decision/planning (`magicHourCapabilities.ts`, `clarificationSlots.ts`, `creativeDecision.ts`, `prompts.ts`, `planReadiness.ts`, `sceneContinuity.ts`, `sceneAudio.ts`, `audioPerformance.ts`), agent runtime (`agents.ts`, `agentRuntime.ts`, `runners.ts`, `usageCost.ts`), media pipeline (`media.ts`, `workflows.ts`, `timeline.ts`, `mediaSync.ts`, `voices.ts`), YouTube (`youtubeShort.ts`, `youtubeSubagents.ts`), state (`renderState.ts`). Includes a 9-step request lifecycle and the generated-video stage sequence.
- **Edit Contract:** follow-ups reuse project state; preserve unrelated successful scenes; no automatic subjective re-render after a successful first render.
- **Known Limitations:** 10 production-critical items (no auth, whole `outputs/` served at `/media/`, in-memory queue and credentials, non-transactional JSON state, no idempotency, no cancel API, no quotas, incomplete cost, no central secrets); reliability and product-quality items.
- **Production Migration Direction:** durable queue + database, object storage + signed URLs, tenancy, secret store, idempotency, cancellation, metrics/traces, leased workers that resume from persisted provider job IDs.
- **Local Verification** commands (includes strict `tsc --noUnusedLocals --noUnusedParameters` audit), **Handoff Acceptance Checklist**, and **Verification Record** dated 2026-09-02 (server 30 files / 510 tests PASS; `yt-dlp` BLOCKED; paid generation NOT RUN; one frontend unused-import EXCEPTION).

**Depends on:** Nothing at runtime. Content describes `dev.sh`, `.env.example`, `server/`, `frontend/`.

**Used by:** Human readers and agents. No code reads either file. `README.md` links to `HANDOFF.md`.

**Gotchas:**
- `README.md` **Setup** says Hume is the default `AUDIO_PROVIDER`, but its own "useful defaults" block and `.env.example` set `AUDIO_PROVIDER=elevenlabs`. Code fallback without env is `"hume"` (`server/src/projects.ts`, `server/src/projectContext.ts`). Both claims are true for different entry paths; `HANDOFF.md` **Effective Defaults** explains the split.
- `README.md` "useful defaults" sets `AGENT_MODEL_PROVIDER=openrouter`. Code fallback without env is `"openai"` (`server/src/projectContext.ts`).
- `README.md` **Structure** lists only 8 of the 32 files in `server/src/`. Use `HANDOFF.md` **Architecture** or [../server](../server/README.md) for the full map.
- `HANDOFF.md` references `evals/youtube_workflow_eval_prompts.jsonl`. `.gitignore` ignores `evals/*`, and the file is absent in this checkout.
- `HANDOFF.md` **Verification Record** is a point-in-time snapshot (2026-09-02). Re-run the checks before trusting it; `server/tests/` now holds 31 entries.
