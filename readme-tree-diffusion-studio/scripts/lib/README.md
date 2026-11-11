# `scripts/lib`

Shared helper for repo maintenance scripts: a cross-platform way to run `npm` from Node.

## Parts

| Part | Role |
|---|---|
| `npm.mjs` | Exports `npm(args, options = {})`. Calls `execFileSync` with `"npm.cmd"` on Windows (`process.platform === "win32"`) and `"npm"` elsewhere. Defaults `stdio: "inherit"`, spreads caller `options` (`cwd`, `env`, `stdio`), forces `shell: WINDOWS`. Blocking; returns `execFileSync` result. |

## How it works

- On Windows `npm` is a `.cmd` shim; `execFileSync` cannot start it without a shell, so `shell: true` is set there.
- On POSIX `npm` is a plain executable; `shell: false` keeps argument quoting exact.
- Callers pass the npm argv array, for example `["run", "build", "--workspace=@diffusionstudio/cli"]` or `["install", "--package-lock-only", "--no-audit", "--no-fund"]`.
- Output streams to the parent terminal because `stdio` defaults to `inherit`.

## Interfaces

- Depends on: `node:child_process` `execFileSync` only.
- Used by:
  - `scripts/release.mjs` to refresh `package-lock.json` after bumping versions ([../README.md](../README.md)).
  - `scripts/dev-desktop.mjs` to build the CLI and desktop workspaces before launching Vite and Electron ([../README.md](../README.md)).
  - `apps/desktop/scripts/stage-runtime.mjs` (imports `../../../scripts/lib/npm.mjs`) to `npm install --omit=dev` the main process externals into `apps/desktop/runtime` ([../../apps/desktop/scripts/README.md](../../apps/desktop/scripts/README.md)).

Up: [../README.md](../README.md)
