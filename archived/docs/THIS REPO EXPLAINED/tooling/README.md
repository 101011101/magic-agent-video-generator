# Tooling and Config

> Level 1 · Up: [THIS REPO EXPLAINED](../README.md)

**End product:** A runnable local app: `./dev.sh` starts the Fastify backend (`server/`) and the Next.js frontend (`frontend/`) on `127.0.0.1`, with credentials and provider defaults from `.env`.

**Parts:**
- [dev-sh.md](dev-sh.md) — `dev.sh`: one-command launcher. Checks tools, installs dependencies, starts backend then frontend, writes logs to `.run-logs/`, stops both on Ctrl+C.
- [env-config.md](env-config.md) — `.env.example`, `frontend/.env.example`, `.gitignore`: env keys, provider defaults, credential precedence, files kept out of git.
- [build-config.md](build-config.md) — `package.json`, `tsconfig.json`, `next.config.mjs`, Tailwind/PostCSS, `components.json`: npm scripts, dependencies, TypeScript settings, the Next `/api` and `/media` proxy.
- [root-docs.md](root-docs.md) — `README.md` and `HANDOFF.md`: what each covers and when to read each.

**How the parts work together:**
1. The user copies `.env.example` to `.env` at the repo root and fills provider keys (env-config).
2. `dev.sh` sources `.env` (`set -a`), so its values become process env for both child servers (dev-sh).
3. `dev.sh` requires `curl`, `ffmpeg`, `ffprobe`, and Node `>=21`, `20.5+`, or `18.18+`. It searches `PATH`, then `~/.nvm/versions/node/*/bin`, then `/opt/homebrew/bin` (dev-sh).
4. `dev.sh` runs `npm install` in `server/` and `frontend/` only when `node_modules/` is missing (build-config).
5. `dev.sh` starts the backend with `node node_modules/tsx/dist/cli.mjs src/index.ts` (same as `npm start`; no compile step), `SERVER_HOST=$BACKEND_HOST`, `SERVER_PORT=$BACKEND_PORT`. It polls `GET /api/health` for up to 90 s.
6. `server/src/config.ts` `loadEnv()` reads `<repo root>/.env`, then overlays `process.env` (process env wins) into `ENV`. `server/src/index.ts` binds to `ENV.SERVER_HOST`/`ENV.SERVER_PORT` (defaults `127.0.0.1`/`8000`).
7. `dev.sh` starts the frontend with `next dev --hostname $FRONTEND_HOST --port $FRONTEND_PORT`. It polls the frontend URL for up to 90 s. Next compiles CSS through PostCSS → Tailwind → Autoprefixer (build-config).
8. The frontend calls the backend at `NEXT_PUBLIC_API_BASE_URL` (`frontend/lib/api.ts`). When that value is empty, calls go same-origin and `next.config.mjs` rewrites `/api/*` and `/media/*` to `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:8000`) (build-config).
9. The backend serves generated files from `OUTPUT_DIR` (default `<repo root>/outputs`) at `/media/`. `.gitignore` keeps `.env`, `outputs/`, `.run-logs/`, and `node_modules/` out of git.
10. `README.md` gives setup, run, verify, and API examples. `HANDOFF.md` gives defaults, credential contract, architecture, limitations, and verification (root-docs).

**Key contracts:**
- Launch: `./dev.sh`. Frontend `http://localhost:3000`. Backend `http://localhost:8000`. Logs `.run-logs/backend.log`, `.run-logs/frontend.log`.
- Host/port env: `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`, `FRONTEND_PORT`, `API_PUBLIC_HOST`, `FRONTEND_PUBLIC_HOST`.
- Two frontend-to-backend modes in `dev.sh`:
  - Default: `NEXT_PUBLIC_API_BASE_URL=http://$API_PUBLIC_HOST:$BACKEND_PORT` (direct cross-origin call; backend CORS allows `localhost:3000`, `127.0.0.1:3000`, `0.0.0.0:3000`).
  - `SINGLE_ORIGIN_DEMO=true`: `NEXT_PUBLIC_API_BASE_URL` stays empty; `BACKEND_INTERNAL_URL` feeds the Next rewrite proxy.
- Readiness probe: `GET /api/health` returns `status`, `output_dir`, `missing_config`, `missing_dependencies`.
- Credential precedence (`HANDOFF.md`): per-request `runtime_credentials` > in-memory project credentials > process env > `.env`.
- Verify: `cd server && npm test && npm run typecheck`; `cd frontend && npm run build`.
- System tools: `node`, `npm`, `ffmpeg`, `ffprobe`, `curl`; `yt-dlp` only for the YouTube clip workflow.

**Gotchas:**
- Defaults differ by entry path. `.env.example` sets `AGENT_MODEL_PROVIDER=openrouter`, `AUDIO_PROVIDER=elevenlabs`. Code fallbacks with no env: `openai`, `hume`. `README.md` Setup names Hume; `HANDOFF.md` **Effective Defaults** explains the split.
- `dev.sh` skips `npm install` when `node_modules/` exists. After a dependency change, run `npm install` by hand.
- `dev.sh` waits only on the frontend process. If the backend dies after startup, the script keeps running; check `.run-logs/backend.log`.
- Health polls use `API_PUBLIC_HOST`/`FRONTEND_PUBLIC_HOST` (`localhost`), but servers bind to `BACKEND_HOST`/`FRONTEND_HOST` (`127.0.0.1`). Mismatched overrides make the 90 s wait time out.
- Some keys are read from `process.env` only (`MAGIC_HOUR_SUBMIT_TIMEOUT_MS`, `YOUTUBE_API_KEY_ALIASES`). A `.env` value applies only when `dev.sh` or the shell exports it.
- `config.ts` resolves `OUTPUT_DIR` with `path.resolve` against the process cwd. `dev.sh` starts the backend in `server/`, so `OUTPUT_DIR=outputs` from `.env.example` writes to `server/outputs`, not `<repo root>/outputs`. The `<repo root>/outputs` default applies only when `OUTPUT_DIR` is unset.
- The server reads only `<repo root>/.env`. `frontend/.env.example` holds only `NEXT_PUBLIC_API_BASE_URL`; `dev.sh` exports that variable, so the value from `dev.sh` applies under `./dev.sh`.
