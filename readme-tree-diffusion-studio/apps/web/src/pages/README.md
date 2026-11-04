# `apps/web/src/pages`

Route-level Solid components: one page per URL the app router serves (login, dashboard, project editor, auth callback, 404).

## Parts

| Part | Role |
|---|---|
| `project.tsx` | `ProjectPage` for `/projects/*ref`. Resolves `ref` (project id or legacy folder name) via `resolveProject`, rewrites the URL to the canonical id, wraps `EditorPage` in the provider stack (`ProjectProvider` → `EngineProvider` → `EditorApiProvider` → `TimelineProvider` → `ExportProvider` → `PromptInputProvider` → `LayoutProvider`). Keyed on project id so a folder rename does not remount the engine. Redirects to `/` when no project is found. |
| `editor.tsx` | `EditorPage`: the editing workspace. Owns the project lifecycle effect (attach library, AI, config; compile; mount bundle; edit writer; file watcher; cover capture on close) and the CSS-grid layout of `SidebarLeft`, `Canvas`, `Inspector`, `Layers`, `Timeline`, `Soundboard`, `EditorTitleBar`, `FloatingProjectHeader`. Handles timeline drag-resize. |
| `dashboard.tsx` | `DashboardPage` for `/`. Sidebar plus `Switch` over `DashboardView` values (`home`, `projects`, `account`, `settings`, `mcp`, `ai-credits`, `billing`, `help`) read from the `?dashboard=` search param. Toggles dashboard vs settings navigation. `Cmd/Ctrl+I` opens the native folder picker and adds the folder as a project (desktop only). Fetches MCP status on mount; shows a connect card when no agents are connected. |
| `login.tsx` | `LoginPage`: OAuth buttons (Google, GitHub via `auth.signInWithOAuth`) and an email magic-link form (`auth.signInWithOtp`). Includes `DevAuthCodeInput`. Rendered by `AuthGate` in `app.tsx` when unauthenticated. |
| `auth-callback.tsx` | `AuthCallbackPage` for `/auth/callback`. Calls `supabase.auth.getSession()` then navigates to `/`. |
| `not-found.tsx` | `NotFoundPage` for `*404`. Static "404" screen with a link home. |

## How it works

- `apps/web/src/app.tsx` maps routes to pages: `/auth/callback` → `AuthCallbackPage`, `/` → `AuthGate` + `DashboardPage`, `/projects/*ref` → `AuthGate` + `ProjectPage`, `*404` → `NotFoundPage`. `AuthGate` renders `LoginPage` when `useAuth().isAuthenticated()` is false.
- `ProjectPage` reads `ref` with `useProjectRef()`, runs `createResource(target, resolveProject)`, and holds `target` on the last resolved id so the id rewrite (`navigate(projectRoute(id), { replace: true })`) does not refetch. It then builds the provider stack and renders `EditorPage`.
- `EditorPage` runs one `createEffect` keyed on `project.dir()`:
  - Attaches `attachLibrary(world, dir)`, `attachAi(world, library, dir)`, `attachProjectConfig(world, dir)`.
  - `loadProject()`: races `loadProjectBundle(projectId)` (IndexedDB cache) against `compileProject(dir)` on first open, mounts whichever lands first via `applyBundle`, then mounts the compile result and stores it with `rememberProjectBundle`.
  - `applyBundle(code)`: unmounts the old scene, calls `mount(code, world)` from `@diffusionstudio/reconciler`, sets inspect entries, creates an `EditWriter` (`createEditWriter(dir, world)`), and subscribes `getDocumentEditor(world).onEdit` → `writer.push`. Resets edit history.
  - `watchProject(dir, paths => …)`: library files reload the library; `package.json` reloads config and `project.refresh()`; any other source change re-runs `load()`.
  - `onCleanup`: `captureProjectCover(dir, engine.snapshot())`, `refreshProject(dir)`, unwatch, unmount, dispose config and library.
- `EditorPage` layout: `grid-template-columns` = `leftSidebarWidth()` / 1px / 1fr / 1px / `INSPECTOR_WIDTH` (264); rows = 1fr / 1px / timeline height (`RULER_HEIGHT` when minimized). Pointer drag on the divider updates `setTimelineHeight` between `MIN_TIMELINE_HEIGHT` and `window.innerHeight - MIN_CANVAS_HEIGHT`. `uiVisible()` false collapses to canvas only.
- `DashboardPage` stores the active view in the URL (`setParams({ dashboard })`), so deep links and reloads land on the same view. Settings views (`account`, `settings`, `mcp`, `ai-credits`, `billing`, `help`) open the settings navigation.

## Interfaces

- Depends on:
  - Routing: `@solidjs/router` (`useSearchParams`, `useNavigate`, `useLocation`, `Navigate`, `A`).
  - [../projects/](../projects/README.md): `resolveProject`, `compileProject`, `watchProject`, `refreshProject`, `createEditWriter`, `captureProjectCover`, `isDesktop`, `isWindowsDesktop`, `openProjectFolder`, `pickProjectFolder`.
  - [../engine/](../engine/README.md): `getDocumentEditor`, `getEditHistory`, `setInspectEntries`, `attachLibrary`, `isLibraryFile`, `attachProjectConfig`, `isProjectConfigFile`, `useEngineContext`, `EngineProvider`, `RULER_HEIGHT`.
  - [../context/](../context/README.md): `useLayout`, `useProject`, `useAuth`, plus the providers listed in `project.tsx`.
  - [../components/](../components/README.md): `dashboard/*`, `canvas`, `timeline`, `sidebar-left`, `sidebar-right`, `ui/*`, `dev-auth-code-input`.
  - [../lib/](../lib/README.md): `db` (`loadProjectBundle`, `rememberProjectBundle`), `mcp` (`connectedAgents`, `fetchMcpStatus`), `supabase`.
  - [../dapi/](../dapi/README.md): `useEditorApi`, `EditorApiProvider`.
  - [../agent-chat/](../agent-chat/README.md): `leftSidebarWidth`.
  - [../hooks/](../hooks/README.md): `useFullscreenState`, `useProjectRef`, `projectRoute`.
  - [../utils/](../utils/README.md): `isInputTarget`, `gen-ai` (`attachAi`).
  - Packages: `@diffusionstudio/reconciler` (`mount`), `@diffusionstudio/koota-solid` (`useWorld`), `@diffusionstudio/assets` (`isCacheFile`), `somoto` (`toast`).
- Used by: `apps/web/src/app.tsx` only (route table). `project.tsx` imports `editor.tsx`.

Up: [../README.md](../README.md)
