# `scripts`

Repo-level Node scripts for developing the desktop app from source and cutting a release.

## Parts

| Part | Role |
| --- | --- |
| `dev-desktop.mjs` | `npm run dev` / `npm run dev:desktop`. Builds the CLI, starts the web Vite dev server on `:5173`, waits for it, builds the desktop app, launches `electron-forge start`. Ctrl-C tears down the whole process tree. |
| `release.mjs` | `npm run release <patch\|minor\|major\|x.y.z>`. Bumps the single version in root, `apps/desktop`, `apps/cli`, `apps/web` `package.json`; refreshes `package-lock.json`; commits `vX.Y.Z`; creates tag. Push is manual. |
| [lib/](lib/README.md) | `npm.mjs`: `npm(args, options)` wrapper over `execFileSync`; uses `npm.cmd` + shell on Windows, plain `npm` on POSIX. |

## How it works

- `dev-desktop.mjs` flow: `npm run build --workspace=@diffusionstudio/cli` (so a linked `dapi` matches the app) → `reclaimPort(5173)` → spawn `vite` in `apps/web` → `waitForServer()` HTTP-probes `http://localhost:5173` → `npm run build --workspace=@diffusionstudio/desktop` → spawn `electron-forge start` in `apps/desktop`.
- `run()` spawns binaries from `node_modules/.bin` directly (not via `npm run`) in a detached process group on POSIX; on Windows it runs the `.cmd` shim through a shell and uses `taskkill /T` for teardown (`killTree()`).
- A child exiting on its own triggers `shutdown()` for all children.
- `reclaimPort()` finds listeners (`lsof` or `netstat`), reads their command line (`ps` or PowerShell `Get-CimInstance`), kills only a Vite started from this checkout (`isOurVite()`), and exits with an error for any other process.
- `release.mjs` flow: require clean `git status --porcelain` → compute next version → refuse if tag exists → rewrite the four `package.json` files → `npm install --package-lock-only` → `git add` + `git commit -m vX.Y.Z` + `git tag`. Prints `git push origin HEAD vX.Y.Z`.
- Pushing the tag triggers `.github/workflows/release.yml`, which re-checks that all four versions match the tag.

## Interfaces

- Depends on: root `package.json` `scripts` (`dev`, `dev:desktop`, `release`); `apps/cli` build script; `apps/web` `vite`; `apps/desktop` `build` script and `electron-forge`; `node_modules/.bin`; `git`, `npm`, `lsof`/`ps` (POSIX) or `netstat`/`taskkill`/`powershell.exe` (Windows).
- Used by: developers (`npm run dev`, `npm run release`); `apps/desktop/scripts/stage-runtime.mjs` imports `lib/npm.mjs`; [../.github/README.md](../.github/README.md) release pipeline consumes the tag `release.mjs` creates.
- Related tree nodes: [../apps/cli/README.md](../apps/cli/README.md), [../apps/web/README.md](../apps/web/README.md), [../apps/desktop/README.md](../apps/desktop/README.md).

Up: [../README.md](../README.md)
