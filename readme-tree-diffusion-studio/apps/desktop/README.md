# `apps/desktop`

`@diffusionstudio/desktop`: the Electron shell that turns the web editor into the installable Diffusion Studio app. It owns the window, project folders on disk, TSX compilation, the source-edit writer, the MCP server agents connect to, the in-app agent-chat host, and CLI/MCP registration on the user's machine.

## Parts

| Part | Role |
| --- | --- |
| [src/](src/README.md) | Main process and preload. Window, IPC, project folders, compile/write-back, MCP server, agent-chat host, CLI/MCP registration. File groups below. |
| `src/main.ts`, `src/preload.ts` | Entry and context bridge. `main.ts` boots services, registers every `mainBridge.handle()`, creates the `BrowserWindow`, handles `diffusion://` deep links, keeps `logBuffer` (max 2000), streams `FILE_WRITE_*`. `preload.ts` exposes `window.desktop = { getPathForFile, platform, send, on }` with allowlisted channels. |
| `src/main-channels.ts`, `src/main-manager.ts` | IPC protocol. `MAIN_WIRE` = 3 raw channels; `MAIN_CHANNELS` = 43 requests + 4 events with typed maps. `mainBridge` multiplexes requests/replies by `id`. |
| `src/projects.ts`, `src/source.ts`, `src/edit.ts`, `src/edit-types.ts`, `src/atomic.ts` | Project folders on disk. `projects.ts`: scan/scaffold/rename/duplicate/delete, `compileProject()`, `writeProject()`, `assets.yml`, cloud-sync guard, watcher. `source.ts`: babel read plugins (`sourcePlugin`, `canonicalizeTagsPlugin`, `inspectPlugin`). `edit.ts`: ts-morph write-back (`applyEdits()`, `stampProject()`). `atomic.ts`: temp-then-rename writes (`.dstmp-`). |
| `src/headless.ts` | `isHeadless()` / `enableHeadless()`. Set by the first non-chat MCP session. Read only by `projects.ts` `confirmCloudLocation()` (log and proceed, no dialog). |
| [src/dapi/](src/dapi/README.md) | MCP server `DapiServer` (Streamable HTTP on `MCP_HOST:MCP_PORT`, one `McpServer` per session). Forwards renderer tools over `DAPI_WIRE`; writes images/transcripts to disk; builds instructions from `INSTRUCTIONS.md`. |
| [src/dapi/handlers/](src/dapi/handlers/README.md) | The two tools that run in main: `logs` (filter/tail `logBuffer`) and `report` (`gh issue create`). |
| `src/agent-chat.ts` | Forks `dist/agent-host.mjs` as an Electron `utilityProcess`; token-authenticated config over `parentPort`; restart backoff `[1s, 2s, 5s, 10s]`; `agentChatEndpoint()`. |
| `src/mcp-config.ts`, `src/mcp-install.ts` | Agent registration. `AGENT_TARGETS` (9 agents). `mcp-config.ts` = pure JSON/TOML transforms; `mcp-install.ts` = file I/O, `mcpStatus()`, `applyMcp()`, `healMcpRegistrations()`. |
| `src/cli-install.ts`, `src/cli-windows.ts`, `src/squirrel.ts` | `diffusion` / `dapi` on PATH. macOS: `osascript` admin symlinks. Windows: `%LOCALAPPDATA%\DiffusionStudio\bin` shims + user PATH. `squirrel.ts` handles Squirrel.Windows install/update/uninstall launches, then quits. |
| `src/cloud-sync-windows.ts`, `src/analytics.ts`, `src/menu.ts` | Windows sync-root detection (OneDrive, Dropbox, Google Drive, iCloud); Umami events from main (packaged only); role-based app menu. |
| [src/native/](src/native/README.md) | macOS Node-API addon `corner_radius.m` -> `dist/corner_radius.node`: window corner radius (18) and blurred backdrop. |
| [scripts/](scripts/README.md) | `build-native.mjs` (clang), `stage-cli.mjs`, `stage-runtime.mjs`, `stage-docs.mjs` (fill `cli/`, `runtime/`, `docs/` for `extraResource`), `make-icns.sh`, `win-assets.py`. |
| `assets/` | Brand/installer media, no README: `icon.{png,icns,ico}`, `icon-dev.png`, `icon-win.png`, `dmg-background*.{png,svg}`, `install-spinner.gif`, `app.manifest` (Electron 43 manifest + `longPathAware`). Excluded from MPL-2.0. |
| `forge.config.ts` | electron-forge. Packager: name `Diffusion Studio`, bundle id `studio.diffusion.editor`, `diffusion://` protocol, `extraResource: ['./cli', './runtime', './docs']`, ignore all but `package.json`, `dist/`, `web/`. Makers: ZIP (darwin), Squirrel (win32, `Diffusion-Studio-<arch>-Setup.exe`), DMG. Publisher: GitHub draft release. Signing/notarize from env; `SKIP_SIGN=1` skips. |
| `package.json` | Version `0.207.0`. `build` = `check` + esbuild `main.ts`/`preload.ts` (CJS, externals: electron, esbuild, @babel/core, presets) + `build:agent-host` (ESM) + `build:native`. `make`/`package`/`publish` = `build` + `build:web` + `stage:*` + electron-forge. `test` = vitest. |
| `tsconfig.json`, `.gitignore` | Extends root base; `lib: es2024`, `types: node`, `include: src`. Ignores `dist`, `web`, `out`, `cli`, `runtime`, `docs` (all generated). |

## How it works

- Boot (`main.ts`): `handleSquirrelEvent()` first; on a Squirrel launch nothing else starts. Then `setAsDefaultProtocolClient("diffusion")`, single-instance lock, register every `mainBridge.handle()`. On `whenReady`: `setupAppMenu()`, grant all permission handlers, deliver an argv deep link, `dapi.start()`, `dapi.mcpUrl()` -> `startAgentChat({ mcpUrl: url + "?client=chat" })`, `refreshCliShim()`, `healMcpRegistrations()`, `trackInstall()`, `createWindow()`.
- Window: `BrowserWindow` with `preload.js`. macOS: `hiddenInset` title bar, `sidebar` vibrancy, native addon rounds corners and sets backdrop on create/`ready-to-show`/`show`; fullscreen sets radius 0. Windows: hidden title bar + `titleBarOverlay` (40px, color per `WINDOW_SET_COLOR_MODE`).
- Renderer to main: web calls `window.desktop.send(MAIN_WIRE.REQUEST, { id, channel, data })`; `MainBridge` dispatches to the handler for `channel` and replies on `MAIN_WIRE.RESPONSE`. Main pushes `MAIN_WIRE.EVENT` envelopes for `AUTH_CALLBACK`, `CHECKOUT_CALLBACK`, `WINDOW_FULLSCREEN_CHANGE`, `PROJECTS_CHANGED`.
- Project read path: `PROJECTS_COMPILE` -> `compileProject(dir)`: `findEntry()` (`package.json` `main` or `index.tsx`...), `ensureRecord()`, `stampProject()` (write ids to source), esbuild `build` with `solidLoader` plugin; each project file goes through babel with `[sourcePlugin, canonicalizeTagsPlugin, inspectPlugin, ...projectPlugins]` then `babel-preset-solid` (`generate: "universal"`, `moduleName: "@diffusionstudio/jsx"`) and `@babel/preset-typescript`. Output: one CJS bundle with `solid-js` and `@diffusionstudio/jsx` left external; renderer evaluates it.
- Project write path: `PROJECTS_WRITE` -> `writeProject(dir, edits)` -> `applyEdits()` (ts-morph). Each element located by `id` or document-order position; the same order `sourcePlugin` numbered. Files written with `writeFileAtomic()`; `noteContent()` pre-claims the digest so the watcher stays silent. Returns `WriteResult { skipped, ids, unrolled }`.
- Watching: `watchProject()` uses `fs.watch(recursive)`; skips `node_modules/`, `.diffusion/`, `.dstmp-*`; serial queue digests the file (SHA-1, or size:mtime above 8 MiB) and emits `PROJECTS_CHANGED` only when the digest differs from `known`.
- Streamed asset writes: `FILE_WRITE_OPEN` opens a temp beside the target (optional `wx` reservation), `FILE_WRITE_CHUNK` writes at position, `FILE_WRITE_CLOSE` calls `noteRenamed()` then renames; `FILE_WRITE_ABORT` unlinks.
- Agent path: `DapiServer` serves one `McpServer` per HTTP session over the `packages/dapi` catalog. `environment: "main"` tools run `mainHandlers` (`logs`, `report`); all others go `RendererCalls.call()` -> `DAPI_WIRE.CALL` -> `apps/web/src/dapi` -> `DAPI_WIRE.REPLY`. `present()` writes captures/frames/transcripts to `output` or a temp dir and inlines up to 4 images under 1 MiB. First non-`?client=chat` session calls `enableHeadless()`; headless only skips the cloud-sync warning dialog.
- Instructions: `docsDir()` = `Resources/docs` (packaged) or repo `docs/` (dev). `docs.instructions()` prepends `INSTRUCTIONS.md` plus the docs path to every session.
- Agent chat: main forks the host, gets a `listening` message with a tokenized WebSocket URL, and returns it on `AGENT_CHAT_ENDPOINT`; web connects directly. Host sessions get the MCP URL with `?client=chat`.
- Settings page: `MCP_STATUS`/`MCP_APPLY` read and upsert the `diffusion` entry in each agent's config; `CLI_STATUS`/`CLI_INSTALL`/`CLI_UNINSTALL` manage PATH links/shims. Unavailable reasons: no bundled binary, or app running from `/AppTranslocation/`.
- Deep links: `diffusion://auth/callback` and `diffusion://checkout/callback` arrive via `open-url` (macOS) or `second-instance` argv (Windows); parked in `pendingDeepLinks` until the renderer calls `*_GET_PENDING_CALLBACK`.
- Packaging: `build:main` bundles everything except esbuild/babel, which `stage-runtime.mjs` installs into `runtime/` and `projects.ts` `load()` requires from `process.resourcesPath/runtime`. `stage-cli.mjs` puts the CLI bundle at `Resources/cli/dapi.js` + `bin/dapi` wrapper; `stage-docs.mjs` copies `docs/`. `update-electron-app` checks `diffusionstudio/editor` releases on packaged non-hidden launches.
- Quit: `before-quit` runs `unwatchAll()`, `stopAgentChat()`, `dapi.stop()`.

## Interfaces

- Depends on:
  - [../../packages/dapi/](../../packages/dapi/README.md): `tools`, `toolJsonSchemas`, `MCP_HOST`/`MCP_PORT`/`MCP_PATH`/`MCP_URL`, `DAPI_WIRE`, `DapiError`, `LogEntry`, `ToolArgs`/`ToolResult` types.
  - [../../packages/jsx/](../../packages/jsx/README.md): `ID_ATTR`, `SOURCE_ATTR`, `INSPECT_TAG`, `COMPOSITION_TAGS`, `parseSource`/`formatSource`, `PropValue`/`SerializedAssetRef`/`InspectValue` types; also the runtime module name compiled projects import.
  - [../../packages/agent-chat/](../../packages/agent-chat/README.md): `src/bin.ts` bundled to `dist/agent-host.mjs`.
  - [../web/](../web/README.md): built output copied into `apps/desktop/web/` by `build:web`; renderer tool handlers in `apps/web/src/dapi/`.
  - [../cli/](../cli/README.md): `dist/index.js` staged as `cli/dapi.js`.
  - [../../docs/](../../docs/README.md): staged verbatim; `INSTRUCTIONS.md` read by `src/dapi/docs.ts`.
  - Root `package.json` (version), [../../scripts/](../../scripts/README.md) `dev-desktop.mjs`, `lib/npm.mjs`.
  - npm: electron 43, electron-forge 7 (makers dmg/squirrel/zip, publisher-github), `@modelcontextprotocol/sdk`, esbuild, `@babel/core`, `babel-preset-solid`, `@babel/preset-typescript`, ts-morph, nanoid, yaml, `update-electron-app`, vitest.
  - External binaries: `gh` (report tool), `osascript` (macOS CLI install), `clang` (native build).
- Used by:
  - `apps/web` over `window.desktop` (`src/lib/ipc.ts`) and the `@desktop/*` alias to `apps/desktop/src/*` (types: `main-channels.ts`, `edit-types.ts`, `mcp-config.ts` `AgentId`).
  - External agents over `MCP_URL` (HTTP) or `dapi mcp` (stdio proxy); `diffusion` CLI.
  - CI: [../../.github/](../../.github/README.md) `release.yml` (`npm run publish --workspace=@diffusionstudio/desktop`), `build-windows.yml` (`npm run make`, `SKIP_SIGN=1`).
  - End users via GitHub release installers (DMG, ZIP, Squirrel setup).

Up: [../README.md](../README.md)
