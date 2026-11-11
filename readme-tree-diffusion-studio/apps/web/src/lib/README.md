# `apps/web/src/lib`

Framework-free infrastructure modules for the editor UI: the renderer-to-main IPC bridge and its desktop-only wrappers, cloud clients (Supabase auth, tRPC API, uploads, checkout), local persistence (IndexedDB, `localStorage` store), analytics, and small Solid/Tailwind helpers.

## Parts

| Part | Role |
|---|---|
| [store/](store/README.md) | Namespaced key-value persistence over `localStorage` (`Store`, `StorageItem`, `createStoredSignal`). Backs UI preferences and the saved route. Single instance `store = new Store('dspro.ui')` in `apps/web/src/init.ts`. |
| `ipc.ts` | `mainBridge` (`class MainBridge`). `call(channel, data)` sends a `MainRequest` (`{id, channel, data}`) on `MAIN_WIRE.REQUEST` over `window.desktop.send` and resolves the matching `MainReply` from `MAIN_WIRE.RESPONSE`. `handle(channel, handler)` registers one receiver per `MainEventChannel` for `MAIN_WIRE.EVENT` envelopes. Rejects when `window.desktop` is absent. All other desktop wrappers go through it. |
| `mcp.ts` | Desktop-only agent setup view. `fetchMcpStatus()` (`MCP_STATUS`), `applyMcp()` (`MCP_APPLY`), `fetchCliStatus()` (`CLI_STATUS`), `installCli()` / `uninstallCli()`. Signal `connectedAgents` (count of agents that carry the app's MCP entry). `AGENT_ICONS` maps `AgentId` to icon names. `displayPath()` shortens home dirs to `~`. Resolves `null` in the browser. |
| `shell.ts` | `revealPath(path)`: shows a file or folder in Finder/Explorer via `APP_SHOW_IN_FOLDER`. No-op off desktop. |
| `electron-file-handle.ts` | `class ElectronFileHandle`: `FileSystemFileHandle`-shaped read handle for an absolute path. `getFile()` asks main (`FILE_TRANSFER`) to set the file on a hidden `<input type=file>` and reads `input.files[0]`; calls are serialized through `inFlight`. `toJSON()` / `rehydrateElectronFileHandle()` round-trip `{kind: "electron-file", path, name}`. Permissions always `"granted"`. |
| `electron-file-writable.ts` | `class ElectronWritableFileHandle implements WritableFileTarget`: `createWritable()` opens an fd in main (`FILE_WRITE_OPEN`) and returns a `WritableStream<StreamTargetChunk>` that forwards positioned chunks (`FILE_WRITE_CHUNK`), then `FILE_WRITE_CLOSE` / `FILE_WRITE_ABORT`. `dispose()` aborts an open write. Lets mediabunny stream encoder output to disk without buffering. |
| `persist-route.tsx` | Desktop route persistence under key `last-route.v2` in `store`. `restoreLastRoute()` sets `location.hash` at boot when no hash is present. `<PersistRoute />` saves `pathname + search` on each navigation; drops `/auth/*` routes and the transient `checkout` query param. |
| `db.ts` | IndexedDB `diffusion-studio-idb` (version 3, via `idb`). Store `projects` (key `dir`, indexes `by-id`, `by-last-opened`) holds `ProjectRecord` (`ProjectInfo` + `recordedAt`, `lastOpenedAt`, `cover: Blob`). Store `bundles` (key `projectId`) holds `ProjectBundle` (last mounted code). Functions: `rememberProject`, `updateProjectRecord`, `addProjectRecords`, `listProjectRecords`, `findProjectRecords`, `moveProjectRecord`, `rememberProjectCover`, `forgetProject`, `rememberProjectBundle`, `loadProjectBundle`, `forgetProjectBundle`, `generateProjectName`. Upgrade `retireRoots()` migrates the v1/v2 `roots` store. |
| `supabase.ts` | `supabase`: `SupabaseClient` from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (PKCE, persisted session, auto refresh). `null` when env vars are unset. |
| `trpc.ts` | `trpc`: `createTRPCClient<AppRouter>` to `${VITE_API_URL}/api/trpc` with `httpBatchLink`. Headers carry the Supabase access token as `Authorization: Bearer`. `paymentRequiredLink` opens `showUpgradeDialog()` on `PAYMENT_REQUIRED` errors. |
| `uploads.ts` | Bytes into the cloud bucket the API resolves a `FileRef` against. `uploadBlob(blob, id)`: `trpc.getUploadUrl` then one signed PUT. `startResumableSession()` + `uploadResumableStream()`: GCS resumable upload in 8 MiB chunks with `Content-Range`, expects `308` until the final chunk. |
| `checkout.ts` | Stripe checkout via tRPC. Pricing constants (`CREDIT_RATE`, `ANNUAL_DISCOUNT`, `SUBSCRIPTION_VOLUME_DISCOUNT`, `TOPUP_MARKUP`) and `getSubscriptionPrice()` / `getTopupPrice()`. `startSubscriptionCheckout()`, `startTopupCheckout()`, `openBillingPortal()`. On desktop, success/cancel URLs point at `app.diffusion.studio/checkout/electron-callback.html` and the URL opens in the system browser (`APP_OPEN_EXTERNAL`); on web it navigates in place. |
| `analytics.ts` | Umami wrapper. `initAnalytics()` injects the script from `VITE_UMAMI_*` env. `track(event, data)`: on desktop forwards to main (`ANALYTICS_TRACK`) because the script is inert on `file://`; on web calls `window.umami.track`. `identify()`, `resetIdentity()`. |
| `desktop-app.ts` | Browser-side desktop installer promo. `desktopAppPlatform()` (macOS / Windows from `navigator`), `desktopAppDownloadLabel()`, `downloadDesktopApp(source)`: tracks `desktop_app_download` and clicks a link to `github.com/diffusionstudio/editor/releases/latest/download/<asset>`; toasts on unsupported platforms. |
| `layout-presets.ts` | Static `PRESET_CATEGORIES` (`video`, `cinematic`, `social`, `device`) of `{label, width, height}` and flat `ALL_PRESETS`. |
| `cva.ts` | `cva`, `cx`, `compose` from `cva` `defineConfig` with `twMerge` on complete. Class-variant helper for the ui kit. |
| `tw.ts` | `tw` tagged template literal; identity string join so Tailwind IntelliSense recognizes class strings. |
| `call-handler.ts` | `callHandler(event, handler)`: invokes a Solid `JSX.EventHandlerUnion` (function or `[fn, data]` tuple); returns `event.defaultPrevented`. Ported from kobalte. |
| `combine-style.ts` | `combineStyle(a, b)` and `stringStyleToObject()`: merge string or object `JSX.CSSProperties`. Ported from solid-primitives. No importers found in `apps/web/src`. |

## How it works

- Host detection: every desktop-only module checks `window.desktop` (set by `apps/desktop/src/preload.ts` with `platform`, `send`, `on`). Absent, `ipc.ts` rejects and the wrappers (`shell`, `mcp`, `analytics` fallback, `checkout` web branch) degrade to browser behavior.
- IPC path: caller -> `mainBridge.call(MAIN_CHANNELS.X, data)` -> `window.desktop.send(MAIN_WIRE.REQUEST, envelope)` -> main handler -> `MAIN_WIRE.RESPONSE` -> pending promise resolved by `id`. Channel request/response types come from `@desktop/main-channels` (`MainRequestMap`).
- File I/O on desktop: `apps/web/src/projects/fs.ts` wraps paths as `ElectronFileHandle` (read) and `ElectronWritableFileHandle` (write). Export (`apps/web/src/dapi/handlers/export.ts`, `apps/web/src/context/render.ts`) streams encoder chunks through the writable handle to disk.
- Boot: `apps/web/src/index.tsx` calls `restoreLastRoute()` (desktop) then `initAnalytics()`. `apps/web/src/app.tsx` mounts `<PersistRoute />` inside the router.
- Project memory: `apps/web/src/projects/host.ts` and `pages/editor.tsx` write `ProjectRecord`s and bundles to `db.ts`; the dashboard (`components/dashboard/*`) lists them; `engine/capture.ts` re-renders from the stored bundle; `projects/cover.ts` stores covers.
- Cloud chain: `supabase.ts` session -> `trpc.ts` bearer header -> `uploads.ts` / `checkout.ts` / `utils/gen-ai.ts` / `dapi/handlers/media-*.ts` call the API. `PAYMENT_REQUIRED` -> `components/upgrade-dialog.tsx`.
- UI helpers: `cva.ts`, `tw.ts`, `call-handler.ts` feed `components/ui/*`; `layout-presets.ts` feeds the inspector layout and scene-init overlay.

## Interfaces

- Depends on:
  - [../../../desktop/](../../../desktop/README.md): `@desktop/main-channels` (`MAIN_CHANNELS`, `MAIN_WIRE`, `ProjectInfo`, `Main*` types, MCP/CLI types); `window.desktop` from `src/preload.ts`.
  - `@diffusionstudio/api-contract` (external npm): `AppRouter`, `BillingPeriod`, `SubscriptionCredits`, `TopupCredits`.
  - [../../../../packages/encoder/](../../../../packages/encoder/README.md): `WritableFileTarget`. `mediabunny`: `StreamTargetChunk`.
  - `apps/web/src/init.ts` (`store`), `apps/web/src/projects/host.ts` (`isDesktop`), `apps/web/src/components/upgrade-dialog.tsx` (`showUpgradeDialog`).
  - External: `solid-js`, `@solidjs/router`, `@supabase/supabase-js`, `@trpc/client`, `@trpc/server/observable`, `idb`, `cva`, `tailwind-merge`, `somoto` (toasts).
- Used by:
  - `ipc.ts`: `apps/web/src/app.tsx`, `agent-chat/connection.ts`, `agent-chat/markdown.tsx`, `context/auth.tsx`, `components/purchase-success.tsx`, `dapi/handlers/export.ts`, `dapi/handlers/screenshot.ts`, `hooks/use-fullscreen-state.ts`, `projects/fs.ts`, `projects/host.ts`, and the sibling wrappers here.
  - `db.ts`: `pages/editor.tsx`, `engine/capture.ts`, `projects/host.ts`, `projects/cover.ts`, `components/dashboard/{home-view,shared}.tsx`, `components/sidebar-left/project-menu/file-menu.tsx`.
  - `supabase.ts` / `trpc.ts`: `context/auth.tsx`, `pages/auth-callback.tsx`, `components/dashboard/{account-view,billing-info-view,invoices-view,shared}.tsx`, `utils/gen-ai.ts`, `dapi/handlers/media-{listen,transcribe}.ts`, `hooks/use-avatar.ts`, `components/genai/use-generation-records.ts`.
  - `checkout.ts`: `components/dashboard/{ai-credits-view,billing-info-view,plans-view}.tsx`, `components/upgrade-dialog.tsx`.
  - `mcp.ts`: `pages/dashboard.tsx`, `components/dashboard/mcp-view.tsx`. `shell.ts`: `components/dashboard/projects-folder-bar.tsx`.
  - `electron-file-handle.ts`: `projects/fs.ts`, `utils/browser.ts`. `electron-file-writable.ts`: `projects/fs.ts`, `dapi/handlers/export.ts`.
  - `analytics.ts`: `index.tsx`, `context/{auth,render}.ts(x)`, dashboard views, `utils/gen-ai.ts`. `desktop-app.ts`: `components/canvas/desktop-app-banner.tsx`, `components/dashboard/get-desktop-app.tsx`, `agent-chat/chat-panel.tsx`, `components/sidebar-left/project-menu/index.tsx`.
  - `cva.ts`, `tw.ts`, `call-handler.ts`: `components/ui/*` and other components. `layout-presets.ts`: `components/canvas/scene-init-overlay.tsx`, `components/sidebar-right/inspector/{layout,scene-template}.tsx`.

Up: [../README.md](../README.md)
