# `apps/web`

`@diffusionstudio/web`: the Diffusion Studio editor UI. A SolidJS + Vite single-page app that mounts a compiled JSX project into a koota runtime world, draws it on a canvas and timeline, writes canvas edits back to the project source, and serves renderer-side agent tools. Runs inside the Electron window (`apps/desktop`) or as a hosted browser app on Vercel.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | All application code. Entry `index.tsx` -> `app.tsx` (router, providers, global overlays). Subsystems: `engine/` (runtime world + editor systems), `components/` (canvas, timeline, sidebars, dashboard, ui kit), `dapi/` (renderer tool handlers), `projects/` (on-disk project access over IPC), `agent-chat/` (in-app agent chat panel), `context/` (project, export, layout, auth), `lib/` (IPC, MCP status, tRPC, Supabase, IndexedDB), `pages/`, `hooks/`, `utils/` (helpers, `gen-ai.ts`), `types/`, `assets/`. See [src/](src/README.md) for links. |
| [public/](public/README.md) | Static files copied to the build root. Favicon, OG image, logo marks. `auth/electron-callback.html` and `checkout/electron-callback.html` hand browser redirects to the `diffusion://` scheme for the desktop app. |
| `index.html` | Shell page. Inline script applies the stored color mode (`kb-color-mode`, default `dark`) and, on macOS desktop, shows a boot splash until auth resolves. Loads `/src/index.css` and `/src/index.tsx`. |
| `package.json` | Workspace package `0.207.0`. Scripts: `dev` (Vite on `:5173`), `build` (`tsc -b && vite build` -> `dist/`), `build:desktop` (mode `desktop`, `--base=./`, `--outDir=../desktop/web`), `check`, `lint`. Depends on every `packages/*` workspace plus `@diffusionstudio/api-contract` (external). |
| `vite.config.ts` | Plugins: `vite-plugin-solid`, `@tailwindcss/vite`, `vite-plugin-solid-svg` (SVGs as components), `unplugin-typegpu`. Defines `APP_VERSION` from root `package.json`. Dev server: strict port `5173`, COOP/COEP headers, `/api` proxied to `localhost:3000`. Aliases `@` -> `src`, `@desktop` -> `../desktop/src`. Mode `desktop` throws if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset. |
| `vercel.json` | Hosted deploy. Build copies `.env.example` to `.env`. Rewrites dot-free paths to `index.html` (SPA). Sets COOP `same-origin` and COEP `credentialless` on every path. |
| `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_UMAMI_*` (analytics), `VITE_API_URL` (`https://api.diffusion.studio`). |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Project references. `app`: extends root base, `jsx: preserve` with `solid-js`, libs ES2024 + DOM, types for WebGPU, audioworklet, file-system-access; includes `src` and `../desktop/src/ipc-channels.ts`. `node`: `vite.config.ts` only. |
| `eslint.config.js` | ESLint 9 flat config: `@eslint/js`, `typescript-eslint`, `eslint-plugin-solid`, `eslint-plugin-typegpu`. `solid/reactivity` off. |

## How it works

- Boot: `src/index.tsx` inits Sentry (prod only), blocks the native context menu; under desktop it sets `data-platform`, patches `FileSystemHandle.queryPermission`, and restores the last route (`lib/persist-route`); then starts Umami analytics and renders `<App />`.
- Routing (`src/app.tsx`): `HashRouter` when `window.desktop` is set (Electron preload), else `Router`. Routes: `/` dashboard, `/projects/*ref` editor, `/auth/callback`, `*404`. `AuthGate` shows `LoginPage` until Supabase reports a session. Global overlays: `UpgradeDialog`, `PurchaseSuccess`, `ScreenTooSmall`, `UnsupportedBrowser`, `Toaster`.
- Tool registration: `<EditorApi />` mounts once under the router and registers `src/dapi/handlers` on `src/dapi/bridge.ts` (`toolBridge`). The bridge listens on `DAPI_WIRE.CALL` / `CANCEL` from desktop and replies on `DAPI_WIRE.REPLY`. Handlers read the open editor from `src/dapi/session.ts` per call, so they work across project switches.
- Project open (`src/pages/project.tsx`): `resolveProject(ref)` asks desktop main (IPC) which folder the id names. Providers nest: `ProjectProvider` -> `EngineProvider` (creates a `RuntimeWorld` via `createRuntimeWorld`, adds editor traits, owns an `AudioContext`) -> `EditorApiProvider` (publishes `{world, project, engine}` to the tool session) -> `TimelineProvider` -> `ExportProvider` -> `PromptInputProvider` -> `LayoutProvider` -> `EditorPage`.
- Mount loop (`src/pages/editor.tsx`): attach asset library (`engine/library`), gen-AI service (`utils/gen-ai`), project config. `compileProject(dir)` (IPC to desktop esbuild) returns bundle code; `mount(code, world)` from `packages/reconciler` builds entities. A cached bundle from IndexedDB (`lib/db`) mounts first on cold open. `watchProject` reloads on file changes from disk.
- Edit write-back: `engine/editor.ts` `DocumentEditor` emits `EntityEdit`s (prop, text, insert, move, remove, unroll, variable). `projects/edits.ts` `EditWriter` debounces them (120 ms) and sends `SourceEdit[]` to desktop over `PROJECTS_WRITE`. Main keeps its own writes out of the watcher stream. `engine/history.ts` gives undo/redo.
- Frame loop: `engine/create-engine.ts` `Engine` runs runtime systems (`assetSystem`, `transformSystem`, `renderSystem`, `playbackSystem`, `motionSystem`) plus editor systems (`inputSystem`, `shortcutSystem`, `hudSystem`, `timelineSystem`) each `requestAnimationFrame`. `engine/canvas.tsx` `EngineCanvas` mounts the `<canvas>`; `components/canvas` adds toolbar, drop-to-import, overlays.
- Layout (`EditorPage`): CSS grid with `SidebarLeft` (assets or agent chat tab), `Canvas`, `Inspector` (right, 264 px), `Layers` + `Timeline` + `Soundboard` (bottom, resizable). `uiVisible` (stored `layout.uiVisible`, toggled by `toggleUI`) hides all chrome and leaves only the canvas.
- Export: `context/export.tsx` picks a save target (`showSaveFilePicker`), `context/render.ts` re-mounts the bundle in an offline world (`engine/capture.ts` `createCapture`) and feeds `packages/encoder` (mediabunny). Tool `export` in `dapi/handlers/export.ts` uses the same path with `source: "agent"`.
- Agent chat: `src/agent-chat/connection.ts` wraps `AgentChatClient` from `packages/agent-chat`; endpoint comes from desktop over `AGENT_CHAT_ENDPOINT` or `VITE_AGENT_CHAT_URL`. `store.ts` holds transcripts, drafts, model choice.
- Dashboard (`src/pages/dashboard.tsx`): views `home`, `projects`, `account`, `settings`, `mcp` (agent MCP/CLI install via `lib/mcp.ts` -> `MCP_STATUS`, `MCP_APPLY`, `CLI_INSTALL`), `ai-credits`, `billing`, `help`. `⌘I` opens the native folder picker.
- Cloud services: `lib/supabase.ts` (PKCE auth: Google, GitHub, email OTP). `lib/trpc.ts` calls `${VITE_API_URL}/api/trpc` with the Supabase bearer token; a `PAYMENT_REQUIRED` error opens the upgrade dialog. `lib/checkout.ts` starts Stripe subscription/top-up checkouts. `utils/gen-ai.ts` uploads media (`lib/uploads.ts`) and calls `trpc.transcribe`, `trpc.removeBackground`, generation endpoints.
- Browser mode (no `window.desktop`): auth and dashboard work; project actions toast "Projects on disk are only available in the desktop app"; `components/canvas/desktop-app-banner.tsx` and `dashboard/get-desktop-app.tsx` link to GitHub release installers (`lib/desktop-app.ts`).

## Interfaces

- Depends on:
  - [../../packages/runtime/](../../packages/runtime/README.md): `createRuntimeWorld`, systems, traits (`Project`, `Computed`, `Workarea`, `FrameRate`, `Library`, `AudioEngine`).
  - [../../packages/reconciler/](../../packages/reconciler/README.md): `mount(code, world)`.
  - [../../packages/koota-solid/](../../packages/koota-solid/README.md): `WorldProvider`, `useWorld`.
  - [../../packages/encoder/](../../packages/encoder/README.md): `createEncoder`, `computeOutputSize`.
  - [../../packages/dapi/](../../packages/dapi/README.md): `DAPI_WIRE`, `DapiError`, tool arg/result types.
  - [../../packages/agent-chat/](../../packages/agent-chat/README.md): `AgentChatClient`, transcript reducer.
  - [../../packages/jsx/](../../packages/jsx/README.md), [../../packages/assets/](../../packages/assets/README.md), [../../packages/sam2/](../../packages/sam2/README.md) (object masks).
  - [../desktop/](../desktop/README.md): `window.desktop` from `src/preload.ts`; `@desktop/main-channels` (`MAIN_CHANNELS`, `MAIN_WIRE`, `ProjectInfo`, `SourceEdit`, `CompileResult`); all filesystem, compile, watch, MCP, CLI, deep-link calls go through `src/lib/ipc.ts` `mainBridge`.
  - External: `solid-js`, `@solidjs/router`, `@kobalte/core`, `koota`, `mediabunny`, `typegpu`, `@supabase/supabase-js`, `@trpc/client`, `@diffusionstudio/api-contract` (npm), `@sentry/solid`, `idb`, Tailwind 4.
- Used by:
  - [../desktop/](../desktop/README.md): loads `apps/desktop/web/index.html` (packaged) or `http://localhost:5173` (dev, [../../scripts/](../../scripts/README.md) `dev-desktop.mjs`); forwards renderer tool calls from `src/dapi/server.ts` to `src/dapi/bridge.ts` here.
  - Vercel hosted app at `app.diffusion.studio` (`vercel.json`).
  - Root `package.json` `build` script (`npm run build --workspace=@diffusionstudio/web`).

Up: [../README.md](../README.md)
