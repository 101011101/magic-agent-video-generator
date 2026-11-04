# env-config (.env.example, frontend/.env.example, .gitignore)

> Level 2 · Source: `.env.example`, `frontend/.env.example`, `.gitignore` · Up: [Tooling and Config](README.md)

**Purpose:** Template for every runtime env key, plus the list of files git must not track.

**Role in parent:** Gives `dev.sh` and the backend their provider keys, model defaults, throttles, and host/port values. Keeps secrets and generated output out of git.

**Main exports (env keys in `.env.example`, grouped):**
- Agent LLM — `AGENT_MODEL_PROVIDER=openrouter`, `AGENT_MODEL_INTENSITY=max`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL=deepseek/deepseek-v4-pro`, `OPENROUTER_MAX_TOKENS=12000`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `OPENAI_AGENT_MAX_TURNS=30`. Read by `server/src/agentRuntime.ts`, `server/src/projectContext.ts`.
- OpenAI — `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.4`, `OPENAI_REASONING_EFFORT=low`, `OPENAI_VERBOSITY=low`. Used for the OpenAI runtime and YouTube visual/subagent stages (`agents.ts`, `youtubeShort.ts`, `youtubeSubagents.ts`).
- Magic Hour — `MAGIC_HOUR_API_KEY`, `MAGIC_HOUR_IMAGE_MODEL=nano-banana-2-lite`, `MAGIC_HOUR_IMAGE_RESOLUTION=1k`, `MAGIC_HOUR_IMAGE_STYLE_TOOL=general`, `MAGIC_HOUR_VIDEO_MODEL=minimax-h3`, `MAGIC_HOUR_VIDEO_AUDIO=false`. Read by `projectContext.ts`.
- Narration — `AUDIO_PROVIDER=elevenlabs`. ElevenLabs: `ELEVENLABS_API_KEY`, `ELEVENLABS_AUDIO_MODEL=eleven_multilingual_v2`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_NAME=brielle - podcast girl`. Fish: `FISH_AUDIO_API_KEY`, `FISH_AUDIO_REFERENCE_ID`, `FISH_AUDIO_MODEL=s2.1-pro`, `FISH_AUDIO_FORMAT=mp3`. Hume: `HUME_API_KEY`, `HUME_AUDIO_MODEL=octave-1`, `HUME_VOICE_ID`, `HUME_VOICE_NAME`, `HUME_VOICE_PROVIDER=HUME_AI`, `HUME_VOICE_DESCRIPTION`.
- YouTube clips — `YOUTUBE_API_KEY`, `YOUTUBE_API_KEY_1..3`, `YOUTUBE_SUBAGENTS_ENABLED=true`, `YOUTUBE_VISUAL_VERIFY=true`.
- Output and concurrency — `OUTPUT_DIR=outputs`, `PROJECT_RUN_CONCURRENCY=auto` (`runners.ts`), `HUME_TTS_CONCURRENCY=1`, `FISH_TTS_CONCURRENCY=2`, `ELEVENLABS_TTS_CONCURRENCY=2`, `MAGIC_HOUR_SUBMIT_CONCURRENCY=5` (`concurrency.ts`), `MAGIC_HOUR_SUBMIT_TIMEOUT_MS=60000` (`media.ts`).
- Hosts/ports — `BACKEND_HOST`, `BACKEND_PORT=8000`, `FRONTEND_HOST`, `FRONTEND_PORT=3000`, `API_PUBLIC_HOST`, `FRONTEND_PUBLIC_HOST`. Read only by `dev.sh`.
- `frontend/.env.example` — only `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`. Read by `frontend/lib/api.ts` as `API_BASE` (trailing `/` stripped; empty means same-origin).
- `.gitignore` — ignores `.env`, `.venv/`, `outputs/`, `.run-logs/`, `benchmark_artifacts/`, `.playwright-profiles/`, `frontend/.next/`, `frontend/node_modules/`, `server/node_modules/`, `dist/`, `build/`, Python caches, `yt_demo_videos_*/`, `latest_openai_news_youtube_clips.mp4`. Ignores `evals/*` but re-includes `evals/final_video_generation_10_cases.{json,md}` and `evals/assets/final_video_generation_10/` (`README.md`, `*.jpg`, minus `contact-sheet.jpg`).

**Internal flow (how a key value is resolved):**
1. `dev.sh` sources root `.env` with `set -a`, so keys become process env.
2. `server/src/config.ts` `loadEnv()` parses `<repo root>/.env`, then overlays `process.env`. Process env wins. Result is `ENV`.
3. `config.ts` copies `ENV.OPENAI_API_KEY` into `process.env` when it is unset there.
4. Credentials per project: request `runtime_credentials` > in-memory `projectRuntimeCredentials(projectId)` (`runtimeCredentials.ts`) > `ENV`.
5. Provider/model choice per project: request `providers` > saved `preferences` > `ENV` key > code default (`projectContext.ts`).
6. YouTube keys: tries `YOUTUBE_API_KEY_1`, `_2`, `_3`, then `YOUTUBE_API_KEY`; skips duplicate values. `YOUTUBE_API_KEY_ALIASES` (comma list, process env only) overrides the name list.
7. Readiness: `REQUIRED_ENV_KEYS` (`config.ts`) plus provider rules in `projects.ts` build `missing_config` for `GET /api/health`. Fish keys count only for `fish`; `HUME_API_KEY` only for `hume`; `ELEVENLABS_API_KEY` only for `elevenlabs`; `OPENAI_API_KEY` is skipped when OpenRouter has a key.

**Depends on:** `dotenv` (`parse`), `dev.sh`.

**Used by:** `dev.sh`, `server/src/config.ts`, `agentRuntime.ts`, `agents.ts`, `projectContext.ts`, `projects.ts`, `media.ts`, `concurrency.ts`, `runners.ts`, `youtubeShort.ts`, `youtubeSubagents.ts`, `inputMedia.ts`, `prompts.ts`, `index.ts`, `frontend/lib/api.ts`, `frontend/next.config.mjs`.

**Gotchas:**
- Code defaults differ from `.env.example`. With no `.env`: `AGENT_MODEL_PROVIDER` → `openai`, `AGENT_MODEL_INTENSITY` → `standard`, `AUDIO_PROVIDER` → `hume`, `OPENROUTER_MODEL` → `openai/gpt-5.4`.
- `OPENROUTER_MAX_TOKENS` is clamped to 1024–16000. Unset: 12000 for `deepseek/deepseek-v4-pro`, else 4000.
- `OUTPUT_DIR` is resolved against the process cwd (`path.resolve`). Under `dev.sh` the cwd is `server/`, so `OUTPUT_DIR=outputs` means `server/outputs`. Unset: `<repo root>/outputs`.
- `MAGIC_HOUR_SUBMIT_TIMEOUT_MS` and `YOUTUBE_API_KEY_ALIASES` are read from `process.env` only. A `.env` value takes effect only when `dev.sh` (or the shell) exports it.
- Only root `.env` feeds the backend. `frontend/.env.example` is not read by `dev.sh`; `dev.sh` sets `NEXT_PUBLIC_API_BASE_URL` itself.
- `.gitignore` pattern `.env` matches only files named exactly `.env`. `.env.local` or `frontend/.env.local` is not ignored.
- Keys read in code but absent from `.env.example`: `MH_AGENT_YT_CLIPS_DIR`, `BACKEND_INTERNAL_URL`, `SINGLE_ORIGIN_DEMO`, legacy aliases `LLM_PROVIDER`, `OPENAI_PROVIDER`, `OPENROUTER_INTENSITY`, `MAX_PARALLEL_PROJECT_RUNS`, `HUME_OCTAVE_VERSION`, `AGENT_MAX_OUTPUT_TOKENS`.
