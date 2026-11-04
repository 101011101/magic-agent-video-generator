# `apps/cli/scripts`

Developer tooling that puts the locally built `diffusion` / `dapi` CLI on the PATH, so a dev build of the desktop app and a shell can run the workspace's `dist/index.js`.

## Parts

| Part | Role |
| --- | --- |
| `dev-link.mjs` | Creates or removes (`--remove`) PATH entries named `dapi` and `diffusion` (`NAMES`) that point at `apps/cli/dist/index.js`. Platform branches: macOS symlinks in `/opt/homebrew/bin`; Windows writes `%LOCALAPPDATA%\DiffusionStudio\bin\{dapi,diffusion}.cmd` shims and adds that folder to the user PATH via `addToUserPath(dir)`; other platforms exit 1 with a message. |

## How it works

- `script` = `<this file>/../dist/index.js`; the CLI must be built first (`npm run link` runs `npm run build` before this script).
- macOS: requires `/opt/homebrew/bin` to exist (Apple Silicon Homebrew; user-writable, no admin prompt). For each name: `rmSync` any existing link, then `symlinkSync(script, link)`. The packaged app uses `/usr/local/bin` instead, so the two never collide.
- Windows: writes a `.cmd` shim per name containing `node "<script>" %*` (with `%` escaped as `%%`). Then `addToUserPath(dir)` reads `HKCU\Environment\Path` through PowerShell with `DoNotExpandEnvironmentNames`, compares normalized entries, and appends `dir` if absent, keeping the value kind (`ExpandString`) and deleting a throwaway `DAPI_PATH_BROADCAST` variable so .NET broadcasts the change to new terminals. `--remove` deletes the shims but leaves the PATH entry, because a packaged install may still use it.
- Why the name `dapi` matters: a dev build of the desktop app looks for exactly `/opt/homebrew/bin/dapi` (`DEV_BINARY` in `apps/desktop/src/mcp-install.ts`, `DEV_LINK_DIR` in `apps/desktop/src/cli-install.ts`) to register with agents and to report in the settings CLI card. `diffusion` is added only for typing at a shell.
- A packaged Windows app rewrites the `dapi.cmd` shim on launch (`apps/desktop/src/cli-windows.ts`), so re-run this script after using a packaged build.

## Interfaces

- Depends on:
  - `apps/cli/dist/index.js`, the esbuild bundle of [../src/README.md](../src/README.md).
  - Node built-ins only: `node:child_process` (`execFileSync` for `powershell.exe`), `node:fs`, `node:os`, `node:path`, `node:url`.
- Used by:
  - `apps/cli/package.json` scripts `link` (`npm run build && node scripts/dev-link.mjs`) and `unlink` (`node scripts/dev-link.mjs --remove`).
  - Root `README.md` (`npm run link --workspace=@diffusionstudio/cli`).
  - `scripts/dev-desktop.mjs` rebuilds the CLI on each start so an existing link keeps running the latest code.
  - `apps/desktop/src/mcp-install.ts`, `apps/desktop/src/cli-install.ts`, `apps/desktop/src/main-channels.ts` reference this link as the dev-mode install path.

Up: [../README.md](../README.md)
