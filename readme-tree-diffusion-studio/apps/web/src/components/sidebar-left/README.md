# `apps/web/src/components/sidebar-left`

Builds the editor's left sidebar: project header (menu + rename), and the Assets panel (folder browser, import, drag-drop, per-item context menus) or the agent chat panel, chosen by tab.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Re-exports `./sidebar-left`. |
| `sidebar-left.tsx` | `SidebarLeft()`: column with `ElectronHeader` + `ProjectHeader` (hidden on Windows desktop via `isWindowsDesktop()`), then `<Assets />` (kept mounted, `hidden` when `sidebarTab() === "chat"`) or `<ChatPanel />`. `ElectronHeader()`: 40 px drag strip + `LayoutToggles` (timeline / UI toggles from `useLayout()`), desktop only (`useEditorApi().isDesktop`). `ProjectHeader()`: `ProjectMenu` + `ProjectNameInput`. `EditorTitleBar(leftWidth, controlsWidth)`: Windows title bar (`WindowsTitleBar`) carrying `ProjectMenu`, "Diffusion Studio" label, `LayoutToggles`, centered `ProjectNameInput`. `FloatingProjectHeader()`: fixed pill with `ProjectMenu` + UI toggle, shown when chrome is hidden. `ProjectNameInput` (private): draft signal; Enter -> `project.rename(trimmed)`, Escape/blur reverts; errors toast. |
| `assets.tsx` | `Assets()`: the asset panel. State: `query`, `assetFilter` (`"ALL" \| "VIDEO" \| "IMAGE" \| "AUDIO"`), `currentFolder`, `renamingFolder`, `isDragging`. Reads `library().list()` (excludes `type === "SCRIPT"`), `partials()`, `folders()`; `isShown` filters by type, search (basename match across all folders), else `dirname(path) === currentFolder()`. Header: `SidebarTabs`, filter dropdown, add dropdown (Import assets ⌘I -> `pickAndImport`; Create folder ⇧⌘N -> `lib.uniqueFolderName` + `lib.createFolder`, opens rename). Breadcrumbs collapse deep paths (`ancestorsOf`, `collapsedFolders`, `tailFolders`); `BreadcrumbCrumb` is a drop target (`handleFolderDrop`). Grid (2 cols): `FolderItem`, `PartialAssetItem`, `LazyAssetItem`. Keyboard: arrows move selection by 1/2, Backspace/Delete removes selected entry else goes to parent folder; window-level ⌘I / ⇧⌘N via `handleShortcut` guarded by `isInputTarget`. External file drop -> `importFiles(lib, droppedFiles(event), currentFolder())`; internal drag -> `handleFolderDrop`. Empty state: "Generate with AI" (`openPromptInput(createDefaultConfig("IMAGE"))`) / "Import media". Effect closes a deleted `currentFolder` to nearest surviving ancestor. |
| `asset-item.tsx` | `LazyAssetItem({asset, selected, onSelect})`: thumbnail card. `IntersectionObserver` (`rootMargin: 100px`) gates `AssetThumbnail` mount so offscreen items free their buffer. Shows `formatAssetDuration` badge. Draggable with `ASSET_DRAG_TYPE` = asset id. Inline rename -> `library().rename`. Context menu: Insert at playhead (`insertAssetAtPlayhead(world, asset)`), Rename, Replace (`replaceAssetSource`), Save as (`saveAssetAs`), Delete (`library().remove([asset])`). |
| `folder-item.tsx` | Drag protocol constants `ASSET_DRAG_TYPE = "application/x-asset-id"` (comma-separated ids), `FOLDER_DRAG_TYPE = "application/x-folder-path"`; `isAssetOrFolderDrag(event)`; `handleFolderDrop(library, event, target)` -> `library.move(assets, target)` / `library.moveFolder(folder, target)`, refuses a folder dropped into itself (toast), returns true when the drag was internal. `FolderItem({path, renaming, onRenameStart, onRenameEnd, onOpen})`: folder card with child count (`library.childrenOf(path)`), drop-target ring, inline rename -> `renameFolder`, context menu Open / Rename / Delete (`deleteFolder`). |
| `partial-asset-item.tsx` | `PartialAssetItem({partial, selected, onSelect})`: placeholder for a `PartialAsset` (generation with no bytes). `state !== "error"` pulses with spinner + "Generating…" tooltip; `state === "error"` shows warning icon and `partial.error`. Context menu: Retry (`retryGeneration(world, lib, partial)`, error state only), Delete (`library().remove([partial])`). |
| [project-menu/](project-menu/README.md) | `ProjectMenu()`: logo dropdown with File / Edit / View / Tool / AI credits / Help submenus. Rendered by `ProjectHeader`, `EditorTitleBar`, `FloatingProjectHeader`. |

## How it works

- `pages/editor.tsx` mounts `EditorTitleBar` always, `SidebarLeft` when `uiVisible()`, `FloatingProjectHeader` when chrome is hidden and not Windows desktop.
- `SidebarLeft` reads `sidebarTab()` from `agent-chat/store.ts` (stored setting `leftSidebar.tab`). `Assets` stays mounted across tab switches; `ChatPanel` mounts only on `"chat"`.
- All library state comes from `useLibrary()` (`engine/library.ts`), an accessor on the world's `Library` trait wrapping `AssetLibrary` from `packages/assets`. The library's `list()`, `partials()`, `folders()`, `childrenOf()` are reactive, so memos in `Assets` and `FolderItem` follow adds, removes, moves and renames.
- Selection lives on the world's `AssetSelection` trait through `useAssetSelection()`; the right sidebar inspector reads the same trait, so a click here drives the inspector.
- Mutations go through `AssetLibrary` methods (`rename`, `remove`, `move`, `moveFolder`, `createFolder`, `renameFolder`, `deleteFolder`) or `engine/asset-actions.ts` (`importFiles`, `pickAndImport`, `replaceAssetSource`, `saveAssetAs`, `insertAssetAtPlayhead`). Failures toast via `somoto`.
- Drag protocol: items set `ASSET_DRAG_TYPE` / `FOLDER_DRAG_TYPE` on `dataTransfer`. Drops inside the panel (folder card, breadcrumb, panel root) move entries. The same `ASSET_DRAG_TYPE` is read by the canvas, timeline, scene-init overlay and prompt input, so an asset dragged out of this panel lands in those surfaces.
- Header keyboard shortcuts (⌘I, ⇧⌘N) are bound on `window` inside `Assets`, not in the engine shortcut table, and act on `currentFolder()`.

## Interfaces

- Depends on:
  - [../../engine/](../../engine/README.md): `library.ts` (`useLibrary`), `asset-actions.ts`, `generations.ts` (`retryGeneration`), `hooks/use-asset-selection.ts` (`useAssetSelection`).
  - [../../agent-chat/](../../agent-chat/README.md): `ChatPanel`, `SidebarTabs`, `sidebarTab`.
  - [../ui/](../ui/README.md): `button`, `icon`, `context-menu`, `dropdown-menu`, `tooltip`, `breadcrumbs`, `asset-thumbnail`, `windows-title-bar`.
  - [../genai/](../genai/README.md): `prompt-input.tsx` (`createDefaultConfig`); `apps/web/src/context/prompt-input.tsx` (`usePromptInput`).
  - Contexts: `apps/web/src/context/layout.tsx` (`useLayout`), `context/project.tsx` (`useProject`); `apps/web/src/dapi/api.tsx` (`useEditorApi`); `apps/web/src/projects/host.ts` (`isWindowsDesktop`).
  - `apps/web/src/utils` (`formatAssetDuration`, `isInputTarget`), `apps/web/src/lib/cva` (`cx`).
  - Packages: [../../../../../packages/assets/](../../../../../packages/assets/README.md) (`AssetLibrary`, `Asset`, `PartialAsset`, `assetName`, `basename`, `dirname`), `@diffusionstudio/koota-solid` (`useWorld`), `solid-js`, `somoto`.
- Used by:
  - [../../pages/](../../pages/README.md) `editor.tsx`: `SidebarLeft`, `EditorTitleBar`, `FloatingProjectHeader`.
  - [../sidebar-right/](../sidebar-right/README.md) `inspector/asset-picker.tsx`: `LazyAssetItem`.
  - `ASSET_DRAG_TYPE` from `folder-item.tsx`: [../canvas/](../canvas/README.md) `canvas.tsx`, `scene-init-overlay.tsx`; [../timeline/](../timeline/README.md) `timeline.tsx`; [../genai/](../genai/README.md) `prompt-input.tsx`.

Up: [../README.md](../README.md)
