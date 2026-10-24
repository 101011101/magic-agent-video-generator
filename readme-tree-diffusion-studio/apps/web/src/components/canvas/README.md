# `apps/web/src/components/canvas`

The editor's center stage: the rendered scene viewport plus the overlays that create elements, accept drops, pick tools, and drive the object-mask and clip-path tools.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `./canvas`. Public entry: `import { Canvas } from "@/components/canvas"`. |
| `canvas.tsx` | `Canvas()`: root container. Stacks `Toolbar`, `DesktopAppBanner`, `DrawOverlay`, `SceneInitOverlay`, `EngineCanvas`, `CameraController`. Owns `handleDropEvent`: drops of library assets (`ASSET_DRAG_TYPE` ids) or external files land centered under the pointer in the scene hit by `findSceneAt`, else loose on `Root`. |
| `toolbar.tsx` | `Toolbar()`: bottom-center tool bar. Cursor group (`MOVE`/`HAND`/`OBJECT_MASK`, shortcuts V/H/M) with dropdown, `SCENE` (F), `RECT` (R), `TEXT` (T), AI-generate toggle. Writes `world.set(Tool, { value })`. Swaps the secondary bar: `PromptInput` when open, else `ObjectMaskBar`, `ClipPathBar`, or `ActionBar` by tool. Clears clip-path target when tool leaves `CLIP_PATH`. |
| `draw-overlay.tsx` | `DrawOverlay()`: full-size crosshair layer shown for `RECT`, `SCENE`, `TEXT` tools (`TOOL_CONFIG`). Pointer drag draws a preview box with world-space `WxH` badge. Pointer up inserts `<Rect>`, `<Scene>`, or `<Text>` via `editor.insertElement`, then selects it and returns tool to `MOVE` (or `TEXT_EDIT` for text). |
| `scene-init-overlay.tsx` | `SceneInitOverlay()`: empty-project placeholder frame. Shows when `Root` has a `Source` value and zero `ChildOf(root)` children. Editable name, `PRESET_CATEGORIES` format menu (default 1920x1080 "Long-form 16:9"). Click → `createScene`; drop → `insertAssetsInNewScene`. `focusPlaceholder` sets the camera so the new scene lands exactly on the placeholder rect. |
| `object-mask-bar.tsx` | `ObjectMaskBar()`: action bar for `OBJECT_MASK` tool. `ModelMenu` picks a SAM2 model (`SAM2_MODELS`, size/cached hint, download/compile progress). `ModePopover` picks `points`/`brush` and brush size (1–30% of frame height, stored as `brushRadius = value/200`). `OpMenu` picks `add`/`subtract`; shows held-alt swap. Cancel → `cancelObjectMask`; Confirm (enabled when track status is `seeded`) → `trackObjectMask`, label shows tracking percent / "Saving...". |
| `clip-path-bar.tsx` | `ClipPathBar()`: action bar for `CLIP_PATH` tool. Shows pick count from `getClipPathPicks`. Cancel → `cancelClipPath`; Confirm → `applyClipPaths`. Auto-cancels when `getClipPathTarget()` becomes null. |
| `desktop-app-banner.tsx` | `DesktopAppBanner()`: dismissible bottom-left promo card. Hidden when `isDesktop`. Dismissal stored under `canvas.desktop-app-banner-dismissed`; tracks `desktop_app_banner_dismissed`; button calls `downloadDesktopApp("canvas_banner")`. |

## How it works

- `Canvas` mounts `EngineCanvas` (the WebGL/render surface) and `CameraController` (pan/zoom input) from `@/engine`; every other child is an absolutely positioned HTML overlay above them.
- Layering by `z-index`: `SceneInitOverlay` z-2, `DrawOverlay` z-5, `Toolbar`/bars/banner z-10.
- Tool state is a single ECS trait: `Tool` on the `world`, read through `useTool()`. `Toolbar` sets it; `DrawOverlay`, `ObjectMaskBar`, `ClipPathBar` react to it.
- Screen→document math is shared: `screenToWorld(world, x, y)` then `findSceneAt` to pick a parent scene, then `worldToLocal` for local coords. `Canvas.handleDropEvent` and `DrawOverlay.handlePointerUp` follow this exact chain.
- Draw flow: pointer down records `startPoint` + `targetScene`; move updates preview DOM directly (no signals); up computes size (drag box, or `defaultWidth/Height` on click < 10px, or font-derived for text), inserts through `editor.insertElement(parent, jsx)`, selects, resets tool. Scenes always parent to `Root`; rect/text parent to hovered scene. Insert is skipped when parent has no `Source` (no project mounted).
- Text font size on click = `max(8, round(sceneHeight / 22.5))` from `Computed.height` of the target scene.
- Drop flow: read `dataTransfer` before any `await` (transfer is cleared after). Library ids resolve via `library.get(id)`; files go through `importFiles(library, files, '')` first. Each asset placed via `insertAsset(world, asset, { parent, x, y })` centered on the drop point (asset `width/height` or fallback 500x150). Toast "Nothing to insert into" if placement fails.
- Empty project: `SceneInitOverlay` computes a camera matrix `{a: scale, d: scale, e, f}` from the placeholder button rect so `createScene` / `insertAssetsInNewScene` (with `focus: focusPlaceholder`) land in place.
- Object mask: `onMount(preloadObjectMaskModel)` fetches the model as the bar opens. `useDerived(getObjectTrack)` maps track `{status, completed, masks.length}` to bar state; `busy` when status is `loading|segmenting|tracking|saving`. Esc inside menus is stopped (`keepEscape`) so it does not put the tool down.
- Clip path: bar reads target/picks from `@/engine/clip-path` module signals via `useDerived`; `Toolbar` calls `clearClipPathTarget()` on tool change.

## Interfaces

- Depends on:
  - `@/engine` — `EngineCanvas` (`apps/web/src/engine/canvas.tsx`), `CameraController` (`engine/camera-controller.tsx`), `useEditor`, `useTool`, `useDerived`, `useObjectMaskTool` (`engine/hooks/`), `insertAsset` (`engine/insert-asset.tsx`), `importFiles`/`droppedFiles` (`engine/asset-actions.ts`), `createScene`/`insertAssetsInNewScene` (`engine/new-scene.tsx`), `engine/clip-path.ts`, `engine/object-mask/` (`store.ts`, `tracking.ts`, `interaction.ts`). See [../../engine/](../../engine/README.md).
  - `@diffusionstudio/runtime` — `Tool`, `ToolType`, `Root`, `Source`, `Library`, `Name`, `ChildOf`, `Computed`, `store`, `screenToWorld`, `worldToLocal`, `findSceneAt`, `getNextName`, `setCamera` (`packages/runtime/src`).
  - `@diffusionstudio/reconciler` — `Scene`, `Rect`, `Text`, `SolidPaint` host elements (`packages/reconciler/src/elements.ts`).
  - `@diffusionstudio/koota-solid` — `useWorld`, `useTrait`, `useQuery`.
  - `@diffusionstudio/sam2/models` — `SAM2_MODELS`, `sam2Model`, `downloadSize`; lazy `cachedSam2Models` (`packages/sam2/src`).
  - [../genai/](../genai/README.md) — `PromptInput`, `ActionBar`; `@/context/prompt-input` — `usePromptInput`.
  - [../sidebar-left/](../sidebar-left/README.md) `folder-item.tsx` — `ASSET_DRAG_TYPE` (`"application/x-asset-id"`).
  - [../ui/](../ui/README.md) — `Button`, `Icon`, `Separator`, `Tooltip`, `DropdownMenu*`, `Popover*`, `SegmentedIconTabs`, `SliderInput`.
  - `@/lib` — `layout-presets.ts` (`PRESET_CATEGORIES`, `LayoutPreset`), `desktop-app.ts`, `analytics.ts` (`track`), `store/signal.ts` (`createStoredSignal`), `cva.ts` (`cx`); `@/init` (`store`); `@/dapi` (`useEditorApi().isDesktop`); `somoto` (`toast`).
- Used by: `apps/web/src/pages/editor.tsx` (`import { Canvas } from "@/components/canvas"`) — the only importer.

Up: [../README.md](../README.md)
