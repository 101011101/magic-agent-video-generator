# `apps/web/src/components/sidebar-left/project-menu`

Builds the editor's main application menu: the logo dropdown in the left sidebar with File / Edit / View / Tool / AI credits / Help submenus.

## Parts

| Part | Role |
| --- | --- |
| `index.tsx` | `ProjectMenu()`: root `DropdownMenu` behind the `diffusion-logo` trigger. Items: "Go to dashboard" (⇧⌘D, bound on `window` keydown via `isInputTarget` guard), File/Edit/View/Tool submenus, AI credits/Help submenus, "Account" (`/?dashboard=account`), "Get desktop app" (hidden when `useEditorApi().isDesktop`; calls `downloadDesktopApp("main_menu")`). |
| `file-menu.tsx` | `FileMenu()`: new/duplicate/delete project, "Import from computer..." (⌘I → `pickAndImport`), Asset and Export submenus. `FileAssetMenu()`: "Download all assets..." (writes every `library().list()` asset into a `window.showDirectoryPicker` dir, dedupes names), "Remove unused media..." (removes library assets whose id is not on any `AssetId` entity). `FileExportMenu()`: "Export scene..." (⌘E, active scene + `getDefaultExportTemplate()`), "Export current frame as image" (⇧⌘E). `FileExportSpecificSceneMenu()`: lists `Scene` children of `Root` sorted by `sortByItemIndex`; each exports that scene. |
| `edit-menu.tsx` | `EditMenu()`: Undo/Redo via `getEditHistory(world)`; Copy/Paste/Duplicate/Delete/Hide; Select all / parent / children / Deselect (`editor.clearSelection()`). Selection-dependent items disabled when `useSelection().nodes()` is empty. |
| `view-menu.tsx` | `ViewMenu()`: Zoom in/out (`zoomBy` 1.25 / 0.8), Zoom to 100% (`zoomTo(world,1)`), Zoom to fit, Zoom to selection; Toggle UI / Toggle timeline via `useLayout()`. |
| `tool-menu.tsx` | `ToolMenu()`: "Generate with AI..." (`setPromptInputOpen(true)`); sets active tool with `world.set(Tool, { value })` for `ToolType.SCENE` (F), `TEXT` (T), `RECT` (R), `OBJECT_MASK` (M). |
| `ai-credits-menu.tsx` | `AiCreditsMenu()`: usage bar from `useAuth()` (`creditLimit`, `remainingCredits`, `isPro`, `nextCreditReset`); footer "One time only" / "Resets monthly" / "Resets in N days"; "Buy credits" → `/?dashboard=billing`. |
| `help-menu.tsx` | `HelpMenu()`: external links (updates page, Discord, `mailto:support@diffusion.studio`) and "Copy user id" (`navigator.clipboard`, toast). |
| `object-menu.tsx` | `ObjectMenu()` + `ObjectAiMenu()`, `ObjectTransformMenu()`, `ObjectAlignMenu()`. Wired: Group/Ungroup, Wrap in scene/sequence, Unwrap sequence (from `@/engine`, enabled by `isGroupLike`/`isSequence` checks). Other items (z-order, insert, align, transform, reveal, remove properties) have no `onSelect` handler. Not mounted by `index.tsx`. |
| `timeline-menu.tsx` | `TimelineMenu()` + `TimelineSelectMenu()`, `TimelineCaptionsMenu()`, `TimelineClipMenu()`, `TimelineTrackMenu()`, `TimelineAudioMenu()`. Label-only items with shortcuts; no handlers. Not mounted by `index.tsx`. |
| `text-menu.tsx` | `TextMenu()`: Bold/Italic/Underline/Strikethrough, text align, caption group items. Label-only; no handlers. Not mounted by `index.tsx`. |
| `preferences-menu.tsx` | `PreferencesMenu()`: checkbox items (snapping, tooltips, zoom direction, timeline options) held in local `createSignal`s only; Theme radio group writes `useColorMode().setColorMode` and reads `COLOR_MODE_STORAGE_KEY` from `localStorage`; "Reset all to default". Not mounted by `index.tsx`. |
| `types.ts` | `type Theme = "light" \| "dark" \| "system"`; used by `preferences-menu.tsx`. |

## How it works

- `sidebar-left.tsx` renders `<ProjectMenu />`. `index.tsx` composes the six live submenus through Kobalte `DropdownMenuSub` + `DropdownMenuPortal`.
- Each submenu is a stateless Solid component. It reads editor state through hooks (`useWorld`, `useSelection`, `useAuth`, `useLayout`, `useProject`, `useLibrary`, `useExport`) and calls engine/project actions on `onSelect`.
- Engine mutations (copy, group, zoom, tool switch) go through `@/engine` functions that take the koota `World`; undo/redo goes through `getEditHistory(world)`.
- Project lifecycle (new, duplicate, delete) calls `@/projects` host functions, then navigates with `@solidjs/router` (`projectRoute(id)` or `/?dashboard=...`). Errors surface via `somoto` `toast`.
- Export items delegate to `useExport().exportScene` / `exportCurrentFrame` with the default template from the right sidebar's export templates.
- `object-menu.tsx`, `timeline-menu.tsx`, `text-menu.tsx`, `preferences-menu.tsx` are present but not imported by `index.tsx` or any other file in `apps/web/src`. Most of their items are placeholders without handlers.

## Interfaces

- Depends on:
  - `apps/web/src/components/ui/dropdown-menu` (Kobalte wrappers), `apps/web/src/components/ui/icon`.
  - `apps/web/src/engine` — `engine/history.ts` (`getEditHistory`), `engine/camera.ts` (`zoomBy`, `zoomTo`, `zoomToFit`, `zoomToSelection`), `engine/group.tsx` (`groupSelection`, `wrapSelectionInScene`, ...), `engine/input/shortcuts.ts` (`copySelection`, `selectAll`, `toggleSelectionHidden`, ...), `engine/hooks/use-selection.ts`, `engine/hooks/use-editor.ts`, `engine/library.ts` (`useLibrary`), `engine/asset-actions.ts` (`pickAndImport`).
  - `apps/web/src/projects/host.ts` (`ensureProjectsRoot`, `createProject`, `duplicateProject`, `deleteProject`); `apps/web/src/lib/db.ts` (`generateProjectName`, `forgetProjectBundle`); `apps/web/src/lib/desktop-app.ts`.
  - Contexts: `apps/web/src/context/auth.tsx`, `project.tsx`, `export.tsx`, `layout.tsx`, `prompt-input.tsx`; `apps/web/src/dapi/api.tsx` (`useEditorApi`).
  - `apps/web/src/hooks/use-project-route.ts` (`projectRoute`, `ProjectRouteState`); `apps/web/src/components/sidebar-right/inspector/export-templates.ts` (`getDefaultExportTemplate`); `apps/web/src/utils` (`isInputTarget`, `mimeTypeToExtension`).
  - Packages: `@diffusionstudio/runtime` (`Tool`, `ToolType`, `Scene`, `Root`, `ChildOf`, `Name`, `AssetId`, `getActiveEntity`, `getAssetFile`, `sortByItemIndex`, `isGroupLike`, `isSequence`), `@diffusionstudio/koota-solid` (`useWorld`, `useQuery`), `@diffusionstudio/assets` (`assetName`), `@kobalte/core` (`useColorMode`), `@solidjs/router`, `somoto`.
- Used by: `apps/web/src/components/sidebar-left/sidebar-left.tsx` (imports `ProjectMenu` from `./project-menu`, renders it in three layout branches). See [../README.md](../README.md).

Up: [../README.md](../README.md)
