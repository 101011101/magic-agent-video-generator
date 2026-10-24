# `apps/web/src/engine/input`

Turns queued pointer events and keyboard state into document edits: hit-testing, drag/hover dispatch, select/move/resize/rotate/marquee gestures with snapping, keyboard shortcuts, and the stage cursor.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports all five modules. |
| `input-system.ts` | Exports `inputSystem(world)`. Drains `PointerEvents.queue`, updates `Pointer`, hit-tests `HitRegions.list` (last pushed wins), synthesizes `pointerenter`/`pointerleave`/`dragstart`/`drag`/`dragend`, brackets each left-button hold in one undo gesture (`history.beginGesture`/`endGesture`), sets `Hovering`/`Dragging` tags, applies the tool cursor, then clears the queue and region list. Skips region dispatch while panning (`Tool === HAND` or space held). |
| `interactions.ts` | Gesture handlers dispatched per hit region: `handleGeometryInteraction` (default for `kind: 'entity'`), `handleCanvasInteraction` (default for no callback: marquee + click-to-deselect), `handlePlayInteraction`, `handleLabelInteraction`, `handleMaskInteraction` (move + drop-into-scene reparent), `handleResizeInteraction`, `handleRotateInteraction`. Exports `editTransform(world, editor, entity, writes)` and type `TransformWrite`: writes keyframes first (via `syncKeyframe`) for changed props, then props via `editor.editProperty`. Exports `updateResizeCursor`, `updateRotationCursor`. Private math: `resizeNode`, `keepGroupPlaced`, `inParentSpace`, `scaleAbout`, `rotateAbout`, `reparentTo`, `settledDropTarget` (250 ms `DROP_DWELL_MS`). Constants `SNAP_DISTANCE = 6`, `CLICK_DISTANCE = 4`. |
| `snapping.ts` | Per-gesture module-level snapshots taken at `dragstart`: `snapshotSelectionTransforms` / `getTransformSnapshot` (`NodeSnapshot`: local + parent matrices, size, scale; recurses into `Group` children), `snapshotSelectionMask` / `getSelectionMaskSnapshot`, `snapshotSnapCandidates` / `getSnapCandidatesSnapshot` (sibling + parent edges/centers, deduped). Pure helpers: `buildSnapCandidatesFromQuad`, `buildSnapCandidatesFromCorners`, `findSnapTarget(source, targets, threshold, axis)` (nearest within threshold, ties broken by shorter guide). `getMarqueeQuad(world)` builds the marquee rect from `Pointer.dragStart*` to `Pointer.client*` when `Hud.mode === 'marquee'`. |
| `shortcuts.ts` | Exports `shortcutSystem(world)` and the actions it binds: `undoEdit`, `redoEdit`, `deleteSelection`, `duplicateSelection`, `copySelection`, `cutSelection`, `pasteSelection`, `nudgeSelection`, `seekBy`, `seekToSelectionEdge`, `seekToTimelineEdge`, `toggleSelectionHidden`, `restackSelection`, `selectAll`, `selectParents`, `selectChildren`. Tables `PRESSED_SHORTCUTS` and `LIFTED_SHORTCUTS` of `{ keys, action, active? }`; `matches()` requires one non-modifier key in `pressed`/`lifted`, the rest in `held`, `!key` absent. Space-hold logic (`SPACE_HAND_DELAY = 200` ms) borrows the `HAND` tool and toggles playback on a tap that did not pan. |
| `cursor.ts` | Exports type `CursorType`, `updateCursor(world, type, rotation?, color?)`, `getToolCursor(world, pressed?)`. Static CSS cursors pass through; resize/rotate cursors are inline SVG data URLs rotated to the selection angle (`getCursorCss`), cached per canvas in a `WeakMap`. `TOOL_CURSORS` maps every `ToolType` to idle/pressed cursors; object-mask brush returns `none`. |

## How it works

- Event intake (outside this dir): `create-engine.ts` canvas listeners push `CanvasPointerEvent`s (device-pixel coords) to `PointerEvents.queue`; window key listeners fill `Keys.held/pressed/lifted` (`mod` aliases meta/control). `runSystems()` calls `inputSystem` then `shortcutSystem` first each frame; the frame loop clears `pressed`/`lifted` after systems run.
- `inputSystem` per event:
  1. Sets `Pointer` (`phase: 'pressed'` + `dragStart*` on pointerdown, `'lifted'` on pointerup).
  2. Left pointerdown -> `history.beginGesture()`; pointerup -> `endGesture()` (one undo step per hold).
  3. If panning, skip. Non-left buttons skip.
  4. `hitTest`: walks `HitRegions.list` backwards; `entity` targets use `isPointerInEntity`, `hud` targets use `pointInQuad`.
  5. pointermove: compares `targetKey` of old vs new region; dispatches `pointerleave`/`pointerenter`, toggles `Hovering`.
  6. pointerdown arms `dragged` and dispatches `dragstart`; every pointermove while armed dispatches `drag` to that same region; pointerup dispatches `dragend`.
  7. Dispatches the raw event type too (`click`, `dblclick`, ...). `dispatch` picks `region.callback`, else `handleGeometryInteraction` for entities, else `handleCanvasInteraction`.
  8. Applies `getToolCursor` when it changes; empties queue and region list.
- Region sources: runtime `renderSystem` (`packages/runtime/src/systems/render.ts`) pushes `kind: 'entity'` regions with no callback; [`../hud/`](../hud/README.md) `hudSystem` pushes `kind: 'hud'` regions with callbacks from `interactions.ts`.
- Move gesture (`handleMaskInteraction`): dragstart snapshots mask, transforms, snap candidates; sets `Hud.mode = 'moving'`; resets drop dwell. Each drag: pointer delta in mask space, snap unless `mod` held (writes `SnapLines`), `settledDropTarget` may `reparentTo` a scene or the stage (accumulates `reparentCorrections`), then `editTransform` writes `x`/`y` per selected node. dragend resets `Hud.mode = 'idle'`.
- Resize (`handleResizeInteraction`): `HANDLE_FACTOR` maps handle id to axis signs; shift or all-`KeepAspectRatio` locks ratio (diagonal projection); alt scales about center; snaps dragged vertices; `resizeNode` decomposes the new local matrix into `width`/`height`/`x`/`y` (+ `rotation` and `Skew` trait for multi/group). Groups resize their direct children then `keepGroupPlaced`.
- Rotate (`handleRotateInteraction`): angle delta about single-node anchor or multi-selection center; shift snaps to 15 degree steps; writes `x`/`y`/`rotation`.
- Marquee (`handleCanvasInteraction`): `Hud.mode = 'marquee'`; each drag selects fully-contained top-level scenes plus intersecting `Interactive` nodes not inside a covered scene. A pointerup under `CLICK_DISTANCE` clears selection and `syncInteractiveState`.
- Header regions: `handlePlayInteraction` -> `togglePlayback`; `handleLabelInteraction` -> select, `activate` scene on click, `mountNameInput` on dblclick, then delegates to mask move.
- `editTransform`: filters writes that differ from `shownTransform` (Computed values), calls `syncKeyframe` for those, then `editor.editProperty` for all. Keeps a dragged animated node in step with its keyframe track.
- `shortcutSystem`: first matching `PRESSED_SHORTCUTS` entry runs on a frame with a press; `LIFTED_SHORTCUTS` on a release; `updateSpaceHold` promotes a long space hold to the hand tool and releases it when `held` loses space (including on window blur). Tool-scoped entries (`clipPathTool`, `objectMaskTool`, `maskStrokeToUndo`) sit ahead of the general Esc/⌘Z/⌘↵ bindings.
- Cursor: tools set the resting cursor; handles override during hover/drag via `updateResizeCursor`/`updateRotationCursor`; on `Pointer.phase === 'lifted'` handlers return the tool cursor.

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime`: `HitRegions`, `Tool`, `ToolType`, `Dragging`, `Hovering`, `Selected`, `Scene`, `Group`, `Geometry`, `Interactive`, `KeepAspectRatio`, `Skew`, `Computed`, `Time`, `Workarea`, `Position`, `AdjustmentLayer`, `RenderSurface`; helpers `isPointerInEntity`, `pointInQuad`, `entityQuad`, `entityWorldMat`, `entityLocalMat`, `entityAnchor`, `entityOffset`, `decompose2D`, `computeLocalMatrix`, `computeGroupBounds`, `enterEntity`, `getSelection`, `getSelectionMask`, `getActiveEntity`, `getCameraMatrix`, `setPlayhead`, `togglePlayback`, `shuttlePlayback`, `stopPlayback`, `syncInteractiveState`, `findKeyframeTrackEntity`, matrix utilities. Types `CanvasPointerEvent`, `DispatchedPointerEvent`, `HitRegion`, `PointerEventType` (`packages/runtime/src/traits/world.ts`).
  - [`../traits.ts`](../README.md): `Pointer`, `Keys`, `MODIFIER_KEYS`, `PointerEvents`, `SnapLines`, `Hud`, `ObjectMaskTool`.
  - [`../editor.ts`](../README.md): `getDocumentEditor` (`select`, `activate`, `editProperty`, `reparent`, `remove`, `duplicate`, `copy`, `paste`, `clearSelection`).
  - [`../history.ts`](../README.md): `getEditHistory` (`beginGesture`, `endGesture`, `undo`, `redo`).
  - [`../keyframes.tsx`](../README.md): `syncKeyframe`.
  - [`../hud/name-input.ts`](../hud/README.md): `mountNameInput`.
  - `../camera.ts`: `zoomBy`, `zoomTo`, `zoomToFit`, `zoomToSelection`. `../group.tsx`: `groupSelection`, `ungroupSelection`, `wrapSelectionInScene`, `wrapSelectionInSequence`, `unwrapSequenceSelection`. `../split.tsx`: `splitAtPlayhead`. `../clip-path.ts`: `applyClipPaths`, `cancelClipPath`. [`../object-mask/`](../object-mask/README.md): `cancelObjectMask`, `trackObjectMask`, `undoMaskStroke`, `getObjectTrack`.
- Used by:
  - `apps/web/src/engine/create-engine.ts`: `inputSystem`, `shortcutSystem` in `runSystems()`.
  - [`../hud/hud-system.ts`](../hud/README.md): region callbacks `handle*Interaction`, `getMarqueeQuad`.
  - `apps/web/src/engine/group.tsx`, `apps/web/src/engine/clip-path.ts`: `editTransform`, `TransformWrite`.
  - `apps/web/src/components/sidebar-left/project-menu/edit-menu.tsx`: `copySelection`, `pasteSelection`, `duplicateSelection`, `deleteSelection`, `toggleSelectionHidden`, `selectAll`, `selectParents`, `selectChildren` (Edit menu items).
  - `apps/web/src/engine/index.ts`: re-exported as part of the engine public surface.
  - Cursor note: `cursor.ts` header comment says the camera controller also calls `updateCursor`, but `apps/web/src/engine/camera-controller.tsx` contains no such call (comment is stale). The timeline sets its own canvas cursor via `@/hooks/use-cursor`, not this module.

Up: [../README.md](../README.md)
