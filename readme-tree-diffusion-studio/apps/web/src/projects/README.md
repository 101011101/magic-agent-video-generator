# `apps/web/src/projects`

Renderer-side project service: the web app's typed client for the Electron main process's project folders (list, open, create, compile, write edits, watch, filesystem), plus the IndexedDB project records.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel: `export * from './host'` and `'./cover'`. `edits.ts` and `fs.ts` are imported by path. |
| `host.ts` | Core API. Signals: `projectsRoot` (from `localStorage` key `diffusion-studio:projects-root`), `projectsRevision` (bumped on any list change; `markProjectsChanged()`). Platform: `isDesktop`, `isWindowsDesktop`, `isMacOSDesktop`. Root: `getProjectsRoot`, `pickProjectsRoot`, `ensureProjectsRoot` (default root or picker; `adoptProjectsRoot` scans the root with `PROJECTS_SCAN` and adds found records). Records: `listProjects` (records only; no disk read), `checkProject`, `refreshProject`, `forgetProject`. Folder ops: `createProject`, `openProjectFolder` (`PROJECTS_INIT`), `getProject`, `resolveProject` (id or folder name → `ProjectInfo`), `renameProject` (moves record), `duplicateProject`, `deleteProject`, `projectKey`. Build/IO: `compileProject` → `CompileResult`, `writeProject(dir, SourceEdit[])` → `WriteResult`, `readProjectConfig`, `writeProjectConfig`, `watchProject(dir, onChange, debounceMs=80)` (coalesces `PROJECTS_CHANGED` events; returns unwatch). Re-exports types `CompileResult`, `ProjectInfo`, `ProjectRecord`, `SourceEdit`, `WriteResult`. |
| `edits.ts` | `EditWriter` class and `createEditWriter(dir, world)`. Buffers `EntityEdit`s from the document editor (`unroll`, `insert`, `move`, `set` props, `text`, `remove`, `variable`), debounces 120 ms, orders them (unrolls → inserts in dependency order via `orderedInserts()` → moves → one `set` per element → removes → variables), holds back edits addressed to elements whose insert is still in flight, and calls `writeProject`. `report(result)` restamps entities with the ids the write assigned (`editor.restamp(ids)`), reverts declined unrolls (`editor.unsettle`), renames held edits to their real ids, and discards pending entities the file rejected (`editor.discardPending`). `dispose()` flushes then stops. |
| `fs.ts` | `createProjectFS(dir): ProjectFS` for `@diffusionstudio/assets`. Maps manifest read/write, `list`, `stat`, `remove`, `realPath` to `PROJECTS_MANIFEST_*` / `PROJECTS_FS_*` channels; `file` via `ElectronFileHandle`; `write` streams a `Blob` in chunks via `ElectronWritableFileHandle`; `pathOf` via `window.desktop.getPathForFile`. `absolute()` joins with the platform separator. |
| `cover.ts` | `captureProjectCover(dir, snapshot: Promise<Blob|null>)`. Awaits the canvas snapshot, stores it with `rememberProjectCover` on the project record, then `markProjectsChanged()`. Desktop only. |

## How it works

- Every call goes through `mainBridge.call(MAIN_CHANNELS.PROJECTS_*, …)` (`apps/web/src/lib/ipc.ts`) to handlers in `apps/desktop/src/main.ts` / `apps/desktop/src/projects.ts`. Off desktop (`!window.desktop`) most functions return `null`/`[]` or throw.
- Project identity: `ProjectInfo.id` = package.json `projectId`; `name` = folder name; `dir` = absolute path. Records (`ProjectRecord`, `apps/web/src/lib/db.ts`) mirror `ProjectInfo` plus a cover and are the source of the dashboard list. The disk is only scanned in `adoptProjectsRoot`.
- Open flow: `ProjectPage` calls `resolveProject(ref)`. It finds candidate records with `findProjectRecords(ref)`, asks main `PROJECTS_RESOLVE` for each dir, accepts the one whose `id` or `name` matches, and re-records it (main assigns an id to pre-id folders here).
- Render flow: `EditorPage` calls `compileProject(dir)` for the bundle, `watchProject(dir, cb)` for change bursts, and `refreshProject(dir)` + `captureProjectCover` on close.
- Write-back flow: document editor `onEdit` → `EditWriter.push` → debounce → `flush()` builds a `SourceEdit[]` → `writeProject` → main rewrites the JSX in place and keeps its own write out of the watcher (`noteContent` in `apps/desktop/src/projects.ts`) → `report()` restamps entity ids and reschedules held edits.
- Asset flow: `attachLibrary` (`apps/web/src/engine/library.ts`) and `dapi/lib/assets.ts` build a `ProjectFS` with `createProjectFS(dir)`; the assets package uses it to read the YAML manifest and stream files.
- List invalidation: any mutation bumps `projectsRevision`; dashboard views use it as a `createResource` source.

## Interfaces

- Depends on:
  - `apps/web/src/lib/ipc.ts` (`mainBridge`), `apps/desktop/src/main-channels.ts` (`MAIN_CHANNELS`, `ProjectInfo`, `CompileResult`, `SourceEdit`, `WriteResult`).
  - [../lib/](../lib/README.md) `db.ts`: `rememberProject`, `updateProjectRecord`, `addProjectRecords`, `listProjectRecords`, `findProjectRecords`, `moveProjectRecord`, `forgetProject`, `rememberProjectCover`; `electron-file-handle.ts`, `electron-file-writable.ts`.
  - [../engine/](../engine/README.md) `editor.ts`: `getDocumentEditor`, edit types (`EntityEdit`, `InsertEdit`, `MoveEdit`, `RemoveEdit`, `UnrollEdit`, `VariableEdit`).
  - `@diffusionstudio/assets` (`ProjectFS`, `Manifest`, `isAbsoluteSource`), `koota` (`World`), `solid-js` (`createSignal`), `somoto`.
  - Main-process handlers: `apps/desktop/src/projects.ts`, `apps/desktop/src/main.ts`.
- Used by:
  - [../pages/](../pages/README.md): `project.tsx` (`resolveProject`), `editor.tsx` (`compileProject`, `watchProject`, `refreshProject`, `createEditWriter`, `captureProjectCover`), `dashboard.tsx` (`openProjectFolder`, `pickProjectFolder`, `isDesktop`, `isWindowsDesktop`).
  - [../components/dashboard/](../components/dashboard/README.md): `home-view`, `projects-view`, `project-card`, `projects-folder-bar`, `settings-view`, `mcp-view`, `shared`, `delete-project-dialog`.
  - [../components/sidebar-left/](../components/sidebar-left/README.md): `project-menu/file-menu.tsx` (`createProject`, `deleteProject`, `duplicateProject`, `ensureProjectsRoot`), `sidebar-left.tsx`; `components/ui/windows-title-bar.tsx`.
  - [../context/](../context/README.md) `project.tsx` (`refreshProject`, `renameProject`).
  - [../engine/](../engine/README.md): `capture.ts` (`compileProject`), `project-config.ts` (`readProjectConfig`, `writeProjectConfig`), `library.ts` (`createProjectFS`).
  - [../dapi/](../dapi/README.md): `api.tsx` (`openProjectFolder`), `handlers/context.ts` (`getProjectsRoot`), `lib/assets.ts` (`createProjectFS`).
  - [../lib/](../lib/README.md) `mcp.ts` (`isDesktop`); [../agent-chat/](../agent-chat/README.md) `store.ts` (`ProjectInfo` type).

Up: [../README.md](../README.md)
