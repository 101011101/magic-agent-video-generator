# `apps/web/src/context`

SolidJS context providers that hold editor-wide state (auth session, open project, timeline controller, export, prompt-input dialog, panel layout) and one shared render path (`renderScene`) used by both the UI export and the agent export tool.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Barrel. Re-exports `./auth` only. Other contexts are imported by path (`@/context/project` etc.). |
| `auth.tsx` | `AuthProvider` / `useAuth`. Supabase session + `user_data` row (credits, access level, Stripe customer, notification flags). Sign-in via OAuth (`google`/`apple`/`github`) or email OTP, sign-out, account delete (tRPC `deleteAccount`), session refresh. Handles Electron OAuth deep-link callback (`AUTH_CALLBACK`, `AUTH_GET_PENDING_CALLBACK`). Live-updates `user_data` through a Supabase realtime channel. Emits analytics (`sign_in`, `sign_out`, `sign_in_attempt`, `account_deleted`). |
| `project.tsx` | `ProjectProvider` / `useProject`. Holds `ProjectInfo` as a signal; exposes memos `id` (package.json `projectId`), `dir` (absolute folder), `name` (`displayName`), plus `rename(displayName)` and `refresh()`. |
| `timeline.tsx` | `TimelineProvider` / `useTimeline`. Creates one `createTimelineController(world)` per project and shares it. |
| `render.ts` | Module-level (no provider). `renderScene(engine, opts)`: stops engine, builds capture world (`createCapture`), runs `createEncoder(...).render()`, reports progress into `renderOverlay` signal, tracks `export_started`/`export_completed`/`export_failed`, restarts engine in `finally`. Exports `renderOverlay`, `cancelRender`, types `RenderOverlayState`, `RenderSceneOptions`. |
| `export.tsx` | `ExportProvider` / `useExport`. `exportScene(scene, config)`: pre-checks `canEncodeVideo`, opens `showSaveFilePicker`, calls `renderScene` with `source: "ui"`, toasts result. `exportCurrentFrame()`: `engine.snapshot()` -> PNG download. Binds ⌘E (active scene, default template) and ⇧⌘E (frame). Mounts `<ExportProgress>` overlay driven by `renderOverlay()`. |
| `prompt-input.tsx` | `PromptInputProvider` / `usePromptInput`. Open/closed signal + current `GenerationConfig` for the GenAI prompt dialog. `openPromptInput(config)` sets both. |
| `layout.tsx` | `LayoutProvider` / `useLayout`. Persisted UI layout: `uiVisible`, `timelineMinimized`, `timelineHeight` (keys `layout.*` in `store`). Exports `MIN_TIMELINE_HEIGHT = 120`, `DEFAULT_TIMELINE_HEIGHT = 234`. |

## How it works

- `AuthProvider` mounts once at app root (`apps/web/src/app.tsx`), outside routing. All other providers mount per project in `apps/web/src/pages/project.tsx`, nested in this order: `ProjectProvider` > `EngineProvider` > `EditorApiProvider` > `TimelineProvider` > `ExportProvider` > `PromptInputProvider` > `LayoutProvider` > `EditorPage`.
- `ProjectProvider` is keyed on the project. A rename changes `dir` but keeps the provider; `dir` is a memo so a no-op `refresh()` does not look like a move.
- `TimelineProvider` reads the ECS world via `useWorld()` (from `EngineProvider`) and builds the timeline controller once.
- Export flow (UI): `useExport().exportScene` -> encodability check -> save picker -> `renderScene` -> overlay updates via `renderOverlay` signal -> `<ExportProgress>` re-renders -> toast on finish.
- Export flow (agent): `apps/web/src/dapi/handlers/export.ts` checks `renderOverlay()` for a running export, then calls `renderScene` with `source: "agent"` and an `ElectronWritableFileHandle` target. Same overlay, same engine stop/start, same analytics.
- `renderScene` picks capture mode: `offline-audio` when video disabled or format is `ogg`, else `offline-video`. Output size comes from `computeOutputSize(scene width/height, resolution)` so the overlay shows the encoded size.
- Auth: session comes from `supabase.auth.getSession()` + `onAuthStateChange`. `user_data` loads via `createResource` keyed on `session().user.id` and is mutated live by a `postgres_changes` subscription. Derived accessors: `isPro = accessLevel > 1`, `remainingCredits = monthly + lifetime`, `creditLimit = isPro ? monthly_credit_quota : FREE_CREDITS_QUOTA`, `nextCreditReset = last_credit_reset_at + 1 month`.
- Auth on desktop (`window.desktop`): OAuth uses `skipBrowserRedirect` and opens the URL through `APP_OPEN_EXTERNAL`; the callback code returns via IPC and is exchanged with `exchangeCodeForSession`.
- Every `useX()` hook asserts it runs inside its provider.

## Interfaces

- Depends on:
  - `solid-js` (`createContext`, signals, resources), `@diffusionstudio/koota-solid` (`useWorld`), `koota` (`Entity`).
  - `@diffusionstudio/encoder` (`createEncoder`, `computeOutputSize`, `EncoderConfig`, `ExportResult`), `@diffusionstudio/runtime` (`Computed`, `FrameRate`, `Workarea`, `getActiveEntity`), `mediabunny` (`canEncodeVideo`).
  - `@supabase/supabase-js`, `@diffusionstudio/api-contract` (`FREE_CREDITS_QUOTA`, `UserData`), `somoto` (`toast`).
  - [`../engine/`](../engine/README.md): `useEngineContext`, `Engine`, `createCapture` (`engine/capture.ts`), `createTimelineController` (`engine/timeline/controller.ts`).
  - [`../projects/`](../projects/README.md): `ProjectInfo`, `renameProject`, `refreshProject` (`projects/host.ts`).
  - [`../lib/`](../lib/README.md): `supabase.ts`, `trpc.ts`, `analytics.ts` (`identify`, `resetIdentity`, `track`), `ipc.ts` (`mainBridge`), `store/` (`createStoredSignal`).
  - [`../utils/`](../utils/README.md): `assert`, `downloadObject`, `isInputTarget`.
  - `../init.ts` (`store`), `apps/desktop/src/main-channels.ts` (`MAIN_CHANNELS`), `apps/web/package.json` (`version`).
  - [`../components/`](../components/README.md): `sidebar-right/inspector/export-progress.tsx` (`ExportProgress`, `ExportConfig`), `sidebar-right/inspector/export-templates.ts` (`MIME_TYPES`, `getDefaultExportTemplate`), `genai/schemas.ts` (`GenerationConfig`).
- Used by:
  - Providers mounted: `apps/web/src/app.tsx` (`AuthProvider`), `apps/web/src/pages/project.tsx` (all others).
  - `useAuth`: `pages/login.tsx`, `dapi/api.tsx`, `hooks/use-avatar.ts`, `components/upgrade-dialog.tsx`, `components/dashboard/*` (account, ai-credits, billing, billing-info, help, plans, shared, sidebar), `components/sidebar-left/project-menu/{ai-credits-menu,help-menu}.tsx`.
  - `useProject`: `pages/editor.tsx`, `dapi/api.tsx`, `agent-chat/chat-panel.tsx`, `components/sidebar-left/sidebar-left.tsx`, `components/sidebar-left/project-menu/file-menu.tsx`.
  - `useTimeline`: `components/timeline/timeline.tsx`, `components/timeline/layers/{layers,context}.tsx`.
  - `useExport`: `components/sidebar-left/project-menu/file-menu.tsx`, `components/sidebar-right/inspector/export.tsx`.
  - `usePromptInput`: `components/canvas/toolbar.tsx`, `components/sidebar-left/assets.tsx`, `components/sidebar-left/project-menu/tool-menu.tsx`, `components/sidebar-right/inspector/asset-picker.tsx`.
  - `useLayout` / `MIN_TIMELINE_HEIGHT`: `pages/editor.tsx`, `components/sidebar-left/sidebar-left.tsx`, `components/sidebar-left/project-menu/view-menu.tsx`, `components/timeline/layers/layers.tsx`.
  - `renderScene` / `renderOverlay`: `dapi/handlers/export.ts` (agent export tool).

Up: [../README.md](../README.md)
