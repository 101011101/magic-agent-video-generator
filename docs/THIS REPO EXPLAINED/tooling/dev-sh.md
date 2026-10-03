# dev.sh

> Level 2 · Source: `dev.sh` · Up: [Tooling and Config](README.md)

**Purpose:** Start the backend API and the Next.js frontend for local use with one command.

**Role in parent:** The only local launcher. It checks tools, installs missing dependencies, starts both servers, waits until they answer, and stops both on exit.

**Main exports (shell functions, file-local):**
- `require_cmd(name)` — exits with `Missing required command: <name>` if the command is not on `PATH`.
- `node_version_supported(version)` — returns 0 for Node `>=21`, `20.5+`, or `18.18+` (the server needs `node:events` `addAbortListener` for `execa`).
- `select_node_toolchain()` — sets `NODE_BIN` and `NPM_BIN`. Search order: `node`/`npm` on `PATH` → `~/.nvm/versions/node/*/bin` → `/opt/homebrew/bin`. Exits if no supported version is found.
- `wait_for_http(url, name)` — polls `url` with `curl -fsS` once per second, for 90 tries maximum. Returns 1 on timeout.
- `cleanup()` — trap on `EXIT INT TERM`. Kills and waits for `FRONTEND_PID`, then `BACKEND_PID`. Keeps the original exit code.

**Internal flow:**
1. Resolve `ROOT_DIR` from the script location. Create `.run-logs/`.
2. If `.env` exists at repo root, source it with auto-export (`set -a`).
3. Set defaults: `BACKEND_HOST=127.0.0.1`, `BACKEND_PORT=8000`, `FRONTEND_HOST=127.0.0.1`, `FRONTEND_PORT=3000`, `API_PUBLIC_HOST=localhost`, `FRONTEND_PUBLIC_HOST=localhost`.
4. Set the frontend API base:
   - `SINGLE_ORIGIN_DEMO=true` → export `NEXT_PUBLIC_API_BASE_URL` (empty by default) and `BACKEND_INTERNAL_URL` (default `http://127.0.0.1:<BACKEND_PORT>`).
   - Otherwise → export `NEXT_PUBLIC_API_BASE_URL` (default `http://<API_PUBLIC_HOST>:<BACKEND_PORT>`).
5. Require `curl`, `ffmpeg`, `ffprobe`. Select the Node toolchain.
6. Run `npm install` in `server/` and `frontend/` only if the `node_modules` folder is missing.
7. Start the backend in the background: `node node_modules/tsx/dist/cli.mjs src/index.ts` in `server/`, with `SERVER_HOST` and `SERVER_PORT` set from `BACKEND_HOST`/`BACKEND_PORT`. Output goes to `.run-logs/backend.log`.
8. Wait for `GET <backend>/api/health`.
9. Start the frontend in the background: `node node_modules/next/dist/bin/next dev --hostname <FRONTEND_HOST> --port <FRONTEND_PORT>` in `frontend/`. Output goes to `.run-logs/frontend.log`.
10. Wait for the frontend URL. Print both URLs and both log paths.
11. Block on `wait "$FRONTEND_PID"`. Ctrl+C triggers `cleanup()`.

**Depends on:**
- Tools: `bash`, `curl`, `ffmpeg`, `ffprobe`, Node + npm.
- `server/src/index.ts` — reads `SERVER_HOST`/`SERVER_PORT`; serves `/api/health`.
- `frontend/next.config.mjs` — reads `BACKEND_INTERNAL_URL` (single-origin mode).
- Env vars: `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`, `FRONTEND_PORT`, `API_PUBLIC_HOST`, `FRONTEND_PUBLIC_HOST`, `SINGLE_ORIGIN_DEMO`, `NEXT_PUBLIC_API_BASE_URL`, `BACKEND_INTERNAL_URL`, plus all vars in `.env`.

**Used by:** Humans and agents, run as `./dev.sh`. Referenced in root `README.md`, `HANDOFF.md`, `doc/runbook-convo.md`. No script calls it.

**Gotchas:**
- Health checks use `API_PUBLIC_HOST`/`FRONTEND_PUBLIC_HOST` (default `localhost`), but servers bind to `BACKEND_HOST`/`FRONTEND_HOST` (default `127.0.0.1`). A mismatch in overrides can make `wait_for_http` time out.
- `npm install` runs only when `node_modules` is missing. It does not detect stale dependencies.
- The script waits only on the frontend process. If the backend dies after startup, the script keeps running.
- Log files are overwritten on each run. `.run-logs/` is git-ignored.
- The error message says Node `20.5+`, but `18.18+` is also accepted.
