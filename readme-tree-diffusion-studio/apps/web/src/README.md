# `apps/web/src`

All application code of the Diffusion Studio editor UI: boot, routing, global providers, and the subsystems that open a JSX project, edit it on a canvas and timeline, export it, and serve agent tools.

## Parts

| Part | Role |
|---|---|
| `index.tsx` | Entry. Inits Sentry in production (`release: APP_VERSION`). Blocks the native context menu. On desktop: sets `data-platform` on `<html>`, patches `FileSystemHandle.prototype.queryPermission` to call `requestPermission` (falls back to `'prompt'`), calls `restoreLastRoute()`. Calls `initAnalytics()`. Renders `<App />` into `#root`. |
| `app.tsx` | Root component. `HashRouter` if `window.desktop`, else `Router`. Root tree: `ColorModeProvider` (dark) -> `AppContextMenu` -> `AuthProvider` (page, `BootSplash`, `UpgradeDialog`, `PurchaseSuccess`, `EditorApi`), then `Toaster`, `EnvironmentOverlays` (`ScreenTooSmall`, `UnsupportedBrowser`; off on `/checkout*`), `PersistRoute`, `TitleBarColorMode`. Routes: `/auth/callback`, `/` (dashboard), `/projects/*ref` (editor), `*404`. `AuthGate` shows `LoginPage` until auth resolves to a session. |
| `init.ts` | Exports the single UI preference store: `store = new Store('dspro.ui')` (`lib/store`). |
| `index.css` | Tailwind 4 + `tw-animate-css`. `dark` variant keyed on `data-kb-theme="dark"`. Loads Inter and JetBrains Mono from `assets/fonts`. Design tokens (colors, radii, text sizes, timeline/meter colors) for light and dark. Platform rules: `--titlebar-height: 40px` on `win32`, transparent background and sidebar on `darwin`. Hidden scrollbars, `.focus-ring`, `.screen-too-small` media query, `.soundboard` container queries that thin the meter scale. |
| `vite-env.d.ts` | Global types: `APP_VERSION`, `window.desktop` (`platform`, `send`, `on`, `getPathForFile`), `queryLocalFonts`, `showOpenFilePicker`, `EyeDropper`, `FileSystemHandle.remove`, encoder/decoder `ondequeue`. |
| [engine/](engine/README.md) | Owns the koota `RuntimeWorld` of the open project. Runs the per-frame loop (runtime systems + input, shortcut, HUD, timeline systems). Turns user commands into `EntityEdit`s. Undo/redo, object mask, Solid hooks over world state. |
| [components/](components/README.md) | All view code: canvas, timeline, left/right sidebars, gen-AI prompt box, dashboard views, `ui/` widget kit, app-wide overlays. |
| [pages/](pages/README.md) | One component per route: login, dashboard, project editor, auth callback, 404. |
| [context/](context/README.md) | Solid providers for editor-wide state: auth, project, timeline, export, prompt input, layout. Shared `renderScene` for UI and agent export. |
| [dapi/](dapi/README.md) | Renderer side of the agent tool API. Receives tool calls from the desktop MCP server over IPC, runs handlers against the open world, replies. |
| [projects/](projects/README.md) | Typed client for desktop project folders (list, open, create, compile, write edits, watch, filesystem) plus IndexedDB project records. |
| [agent-chat/](agent-chat/README.md) | Left-sidebar chat panel that drives Claude Code or Codex against the open project via `@diffusionstudio/agent-chat`. |
| [lib/](lib/README.md) | Framework-free infrastructure: IPC bridge (`mainBridge`), Supabase auth, tRPC, uploads, checkout, IndexedDB, `localStorage` store, analytics, route persistence. |
| [hooks/](hooks/README.md) | Reusable Solid hooks over browser, desktop IPC, audio, pointer, and router state. |
| [utils/](utils/README.md) | Helper functions (assert, color, file, format, signals) plus `gen-ai.ts`, the `GenAi` service that turns `generate.*` / `transform.*` declarations into library assets via tRPC. |
| [types/](types/README.md) | Shared type unions (aspect ratio, model output), drag-and-drop `DataTransfer` keys, `Optional<T, K>`. |
| [assets/](assets/README.md) | Static media: SVG icon set, Inter and JetBrains Mono fonts, PNG images (promo banner, voice avatars). |

## How it works

- Boot: `index.tsx` imports `index.css`, sets platform state, restores the last route, starts analytics, renders `app.tsx`.
- Shell: `app.tsx` mounts global providers once. `AuthProvider` (`context/auth`) resolves the Supabase session (`lib/supabase`). `BootSplash` removes `#boot-splash` when auth stops loading. `TitleBarColorMode` sends the color mode to main (`MAIN_CHANNELS.WINDOW_SET_COLOR_MODE`) on Windows.
- Tool serving: `<EditorApi />` (`dapi/`) mounts once under the router, so agent tool calls work on every route. Handlers read the open editor from the tool session per call.
- Dashboard route: `pages/` renders `components/dashboard` views. Project list and create go through `projects/` -> `lib/ipc` -> desktop main.
- Editor route: `pages/` resolves the project ref, nests `context/` providers around `engine/` (`EngineProvider` creates the world), compiles the project over IPC (`projects/`), and mounts it with `packages/reconciler`. `components/` render the canvas, timeline, sidebars, inspector on top of `engine/hooks`.
- Edit loop: `engine/` emits `EntityEdit`s -> `projects/` writes `SourceEdit`s to disk via main -> the file watcher triggers a recompile and remount.
- Gen-AI: `components/genai` builds declarations; `utils/gen-ai.ts` calls tRPC (`lib/trpc`) and adds assets to the library.
- Agent chat: `agent-chat/` renders in the left sidebar tab and talks to the agent host endpoint resolved over IPC or `VITE_AGENT_CHAT_URL`.
- Persistence: UI preferences use `init.ts` `store`; route persistence uses `lib/persist-route`; project records and cached bundles use IndexedDB (`lib/db`, `projects/`).

## Interfaces

- Depends on:
  - Workspace packages: `packages/runtime`, `packages/reconciler`, `packages/koota-solid`, `packages/encoder`, `packages/dapi`, `packages/agent-chat`, `packages/jsx`, `packages/assets`, `packages/sam2` (see [../README.md](../README.md)).
  - `apps/desktop`: `window.desktop` preload API and `@desktop/main-channels` (`MAIN_CHANNELS`), all through `lib/ipc.ts` `mainBridge`.
  - External: `solid-js`, `@solidjs/router`, `@kobalte/core`, `@sentry/solid`, Tailwind 4, `tw-animate-css`.
- Used by:
  - `apps/web/index.html`: loads `/src/index.css` and `/src/index.tsx`.
  - `apps/web/vite.config.ts`: alias `@` -> `src`, defines `APP_VERSION`.
  - `apps/desktop`: loads the built app; forwards renderer tool calls to `dapi/`.

Up: [../README.md](../README.md)
