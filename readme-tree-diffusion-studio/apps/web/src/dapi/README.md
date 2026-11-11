# `apps/web/src/dapi`

Renderer side of the Diffusion Studio agent tool API (DAPI): receives tool calls from the desktop MCP server over IPC, runs them against the open editor world, and replies.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Public surface: re-exports `EditorApi`, `EditorApiProvider`, `useEditorApi` from `api.tsx`. |
| `api.tsx` | Solid glue. `EditorApi` (mounted once under the router in `apps/web/src/app.tsx`) builds a `ContextFactory` (session accessors, `app.openProject` via `openProjectFolder` + `navigate(projectRoute(...))`, `app.requireUser` via `useAuth`, throws `DapiError("sign-in-required")`) and registers `handlers` on `toolBridge` for the app's lifetime. `EditorApiProvider` (mounted per project page in `apps/web/src/pages/project.tsx`) publishes `{ world, project, engine }` to the session slot while `window.desktop` is set and `project.id()` matches `world.get(Project)?.id`; clears it on cleanup. Also provides `{ isFullscreen, isDesktop }` for editor UI via `useEditorApi`. |
| `bridge.ts` | `ToolBridge` singleton `toolBridge`. Binds `window.desktop.on(DAPI_WIRE.CALL / CANCEL)` at construction so calls during page bootstrap are held, not dropped. `register(handlers, context)` flushes held calls and returns an unregister function. `dispatch` looks up `handlers[call.tool]`, creates an `AbortController` per call id, runs the handler with `context(signal)`, and sends a `DapiReply` over `DAPI_WIRE.REPLY` (`ok: true, data` or `ok: false, error { code?, message }`; `code` only when `isDapiError`). Aborted calls send no reply. |
| `handler.ts` | Types only. `ToolContext` (`session`, `requireSession`, `signal`, `app.openProject`, `app.requireUser`), `ToolHandler<N>`, `ServedToolName = Exclude<ToolName, "logs" \| "report">`, `Handlers` map. Handlers are plain functions with no Solid in them. |
| `session.ts` | Module-level Solid signal `EditorSession \| null` (`world: World`, `project: OpenProject { dir }`, `engine: Engine`). Exports `editorSession`, `setEditorSession`, `requireEditorSession` (throws `DapiError("no-project")`). Lets handlers register once and read the current project per call. |
| [handlers/](handlers/README.md) | One file per served tool: `open`, `context`, `capture`, `check`, `export`, `models`, `voices`, `fonts`, `screenshot`, `media_probe`, `media_grab`, `media_transcribe`, `media_filmstrip`, `media_waveform`, `media_listen`, `media_segment`. `index.ts` exports the `handlers: Handlers` map. |
| [lib/](lib/README.md) | Shared handler helpers: `resolveAsset` / `requireAssetType`, `resolveNode`, `requireScene`, `SheetCollector` (contact sheets), `pickInformativeTimes` (WebGPU frame triage), `dataUrlToBytes`. |

## How it works

- Main process (`apps/desktop/src/dapi/server.ts`) hosts the MCP server and one tool catalog from `packages/dapi`. It validates args, runs `logs` and `report` itself, and forwards every other tool to the renderer through `RendererCalls.call` (`apps/desktop/src/dapi/renderer-calls.ts`): `webContents.send(DAPI_WIRE.CALL, { id, tool, args })`.
- `apps/desktop/src/preload.ts` exposes `window.desktop.on` / `send` and allowlists `DAPI_WIRE.CALL`, `CANCEL` (main → renderer) and `DAPI_WIRE.REPLY` (renderer → main).
- `bridge.ts` receives the call. If no handlers are registered yet, it holds the call. Once `EditorApi` mounts and calls `toolBridge.register(handlers, context)`, held calls run.
- Per call: bridge builds a fresh `ToolContext` from the `ContextFactory` in `api.tsx`, runs `handlers[tool](args, ctx)`, replies over `DAPI_WIRE.REPLY`. `DAPI_WIRE.CANCEL` aborts `ctx.signal`; an aborted call sends no reply.
- Project state is decoupled from registration: `EditorApiProvider` writes `{ world, project, engine }` into `session.ts` while a project page is mounted and clears it on unmount. Project-bound handlers call `ctx.requireSession()` per call and fail with `no-project` at the dashboard; `context` reports nulls instead.
- Shell-only actions (navigate to a project, read the signed-in user) live in `ctx.app` because only Solid components can reach the router and auth context.
- Errors: handlers throw `DapiError(code, message)`; the bridge forwards `code` so `RendererCalls` rebuilds a `DapiError` on the main side and the MCP caller can act on it.
- `useEditorApi` is a side channel for editor UI (`isDesktop`, `isFullscreen`), unrelated to tool dispatch.

## Interfaces

- Depends on:
  - [../../../../packages/dapi/](../../../../packages/dapi/README.md): `DAPI_WIRE` and `DapiCall` / `DapiCancel` / `DapiReply` (`packages/dapi/src/ipc.ts`), `DapiError`, `isDapiError`, `ToolName`, `ToolArgs`, `ToolResult` (catalog in `packages/dapi/src/catalog.ts`).
  - `window.desktop` from `apps/desktop/src/preload.ts` (`on`, `send`). Without it (browser mode) the bridge never binds and `EditorApiProvider` never publishes a session.
  - App modules: `apps/web/src/context/project.tsx` (`useProject`), `apps/web/src/context/auth` (`useAuth`), `apps/web/src/engine` (`useEngineContext`, `Engine`), `apps/web/src/projects/host.ts` (`openProjectFolder`), `apps/web/src/hooks/use-project-route.ts` (`projectRoute`), `apps/web/src/hooks/use-fullscreen-state.ts`, `apps/web/src/utils/common` (`assert`).
  - `@diffusionstudio/koota-solid` (`useWorld`), `@diffusionstudio/runtime` (`Project` trait), `koota` (`World`), `solid-js`, `@solidjs/router`, `@supabase/supabase-js` (`User` type).
  - Handler-level dependencies (runtime, encoder, assets, mediabunny, tRPC, IPC channels): see [handlers/](handlers/README.md) and [lib/](lib/README.md).
- Used by:
  - `apps/web/src/app.tsx` mounts `<EditorApi />` once under the router and auth provider.
  - `apps/web/src/pages/project.tsx` wraps the editor in `<EditorApiProvider>`.
  - `useEditorApi`: `apps/web/src/pages/editor.tsx`, `apps/web/src/components/sidebar-left/sidebar-left.tsx`, `apps/web/src/components/sidebar-left/project-menu/index.tsx`, `apps/web/src/components/canvas/desktop-app-banner.tsx`.
  - [../../../desktop/](../../../desktop/README.md) `src/dapi/renderer-calls.ts` (sends calls, receives replies) via `src/dapi/server.ts`.

Up: [../README.md](../README.md)
