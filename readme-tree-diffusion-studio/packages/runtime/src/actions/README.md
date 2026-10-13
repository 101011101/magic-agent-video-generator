# `packages/runtime/src/actions`

Write path of the runtime: plain `(world, ...)` functions that mutate the koota ECS world (entities, hierarchy, time, size, camera, playback, keyframes, clipboard). No undo or persistence here; the app observes koota add/remove/change events on the traits these functions touch.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every module below; `packages/runtime/src/index.ts` re-exports this barrel, so all actions ship as the `@diffusionstudio/runtime` public API. |
| `entities.ts` | Lifecycle. `createEntity(world)` spawns an entity with `Computed` (300x300, `DEFAULT_DURATION_FRAMES`) and `Cache` pre-attached. `deleteEntity(world, e)` calls `e.destroy()`; `ChildOf` autoDestroy cascades to the subtree. |
| `hierarchy.ts` | Parenting and z-order. `appendChild` / `removeChild` re-target the exclusive `ChildOf` relation (detach = re-parent to `Root` stage, never drop). `reorderEntity` / `reorderSelection(world, 'front' \| 'back' \| n)` rewrite `ItemIndex` on all siblings. Type `ReorderTarget`. |
| `cache.ts` | Derived-list upkeep on `Cache` store (no change events). `rebuildCaches(world, entity, parent, exclude)` refills the parent's `children`, `clipPaths`, `masks`, `fills`, `strokes`, `effects`, `shadows`, `textRanges`, `keyframes`, `animations` lists by trait. `evictFromCaches` drops one entity from every list (destroy path: traits already stripped). `refileClipPath` moves a geometry between `children` and `clipPaths`. `aggregateKeyframeTracks` collects `KeyframeTrack` entities under a node and stamps `KeyframeTrack.target`. `findClosestParentGeometry` finds nearest node ancestor. |
| `timing.ts` | Time-range derivation into `Computed` (`origin`, `start`, `end`, `duration`, `playbackRate`). `recomputeEntityTimeRange` resolves `Delay` + `Trim` + `PlaybackRate` + asset/transcript length; group-likes with open trim fit their children (`fitsChildren`). `propagateTimeRangeDown`, `bubbleTimeRangeUp` walk the tree. `trimEntityIn` / `trimEntityOut` set `Trim` in source frames via `getSourceFrameAt`. `pinTrimToCurrentBounds` freezes a span before its source leaves. `reactTo*` hooks (`AssetChange`, `PaintChange`, `GeometryDurationChange`, `ChildAttached`, `ChildDetached`) are observer entry points. `ignore` param reads a trait as absent because koota fires onRemove before clearing it. |
| `resize.ts` | Size and constraints. `resizeEntity(world, e, {width, height})` enforces `KeepAspectRatio` (`lockedRatio`), writes `Size`, syncs a `Host` DOM element, then `resolveConstraintOffsets`. `propagateSize` copies `Size` into `Computed.width/height` down the tree. `resolveConstraintOffsets` applies `Constraint` (MAX, CENTER, STRETCH, SCALE) per child using `ConstraintCache` deltas; `Sequential` nodes are transparent. |
| `keyframe.ts` | Keyframe tracks as entities: `KeyframeTrack` child of the target, `Keyframe` children of the track. `findKeyframeTrackEntity`, `getKeyframeTrack`, `findKeyframeTargetNode`, `syncKeyframeTrack` (write value at current local frame), `toggleKeyframeTrack` (add/remove at frame; drops empty track), `setKeyframeTrack` (declarative replace), `removeKeyframeTrack`. |
| `overlap.ts` | Overwrite model for `Sequential` containers. `resolveSequentialOverlaps(world, dragged[])` trims, deletes, or splits (clone via `cloneSubtree` + trim) siblings against each dragged clip's `[start, end)`. `resolveNewSequenceOverlaps(world, sequence)` gives earlier-start clips precedence on a fresh sequence. Groups recurse to leaves; emptied groups are deleted. |
| `group.ts` | `groupSelection(world, sequential?)` wraps `Selected` nodes sharing a parent in a new `Group` (or `Group`+`Sequential`), positions it at the children's AABB (sequences at origin), rewrites child `Position` into local space, refreshes `LocalTransform` via `computeLocalMatrix`, and calls `resolveNewSequenceOverlaps` for sequences. `ungroupSelection` lifts children out and deletes the group. |
| `frame.ts` | Scene creation and active scene. `frameSelection(world)` wraps the selection in a `RECT` geometry with `Scene`, `ClipsContent`, `Playback`, a solid black fill child, and sizes it to the selection's AABB. `getActiveEntity`, `setActive(world, scene \| null)` move the `Active` tag (asserts scene and root-level). |
| `playback.ts` | Playhead control, not persisted. `setPlayhead(world, scene, frame)` writes `Computed.localTime` and `localTimeInSeconds`. `togglePlayback`, `stopPlayback`, `shuttlePlayback(world, scene, ±1)` (J/K/L over `SHUTTLE_SPEEDS = [1,2,4,8,16]`) set `Playback {playing, speed}` and resume the `AudioEngine` context. `syncStagePlayback(entity)` adds `Playback` to a stage-level geometry with own media (`Audio` or VIDEO paint). |
| `camera.ts` | Camera matrix on the `Root` entity's `Camera` trait. `setCamera`, `resetCamera`, `setCameraMatrix`, `panCamera`, `zoomCameraAt` (anchor-pinned, clamped to `MIN/MAX_CAMERA_ZOOM`), `zoomCameraBy`, `setCameraZoom`, `resetCameraZoom`, `focusRect` / `focusEntities` / `focusContent` (fit with `FOCUS_PADDING = 80`, never past 100%). |
| `timeline-view.ts` | `setTimelineView(world, scene, [zoom, x, y])` writes `Timeline.resolution/scrollX/scrollY` through the store (no events). Refuses non-finite or non-positive zoom. |
| `interactive.ts` | Which entities the pointer can hit. `syncInteractiveState(world)` re-derives the `Interactive` tag: top-level scenes and `Sequential` groups pass through to children; everything else is one clickable unit. `findChildAt` hit-tests children with `isPointerInEntity`. `enterEntity` drills into a container: tags its children `Interactive`, sets `Hovering` on the hit child. |
| `clipboard.ts` | Module-level in-memory clipboard of serialized subtrees (`EntityRecord[]`). `copySelection` serializes selected `Geometry`/`Group` trees. `pasteClipboard` clones via `cloneFromRecords(stripMountIdentity(...))` under the selected `Scene`/`Group`. `duplicateSelection` clones in place via `cloneSubtree`, offset by the source width. |
| `assets.ts` | Asset lookups shared by decoders and hosts. `getLibrary`, `getAi` (throw when host attached none). `bindAsset(entity, asset)` stamps `AssetId` and flips a media `Paint` to IMAGE or VIDEO by asset type. `getSequenceFrameRate`, `getSourceDuration` (seconds, or null for non-timed assets). `getAsset`, `getAssetFile` (WeakMap-cached `handle.getFile()`), `getAssetBlob`. |

## How it works

- Every function takes `world` first and mutates via `entity.add/set/remove` (fires koota change events) or via `store(world, Trait)` (silent, for derived state in `Computed`, `Cache`, `ConstraintCache`, `KeyframeTrack.target`, `Timeline`).
- Structural edits (`appendChild`, `removeChild`, `deleteEntity`) only re-target `ChildOf`. The fixups ride on `ChildOf` events in `packages/runtime/src/world/observers.ts`, which call back into `cache.ts` (`rebuildCaches`, `evictFromCaches`, `refileClipPath`), `timing.ts` (`reactToChildAttached`, `reactToChildDetached`, `reactToAssetChange`, `reactToPaintChange`), `resize.ts` (`propagateSize`, `resolveConstraintOffsets`), and `playback.ts` (`syncStagePlayback`).
- Composite actions compose primitives: `groupSelection` / `frameSelection` = `createEntity` + `appendChild` + `removeChild` + `resizeEntity` + `computeLocalMatrix`; `pasteClipboard` = `cloneFromRecords` + `removeChild` + `appendChild`; `resolveSequentialOverlaps` = `trimEntityIn/Out` + `deleteEntity` + `cloneSubtree`.
- Time flow: an authored `Delay`/`Trim`/`PlaybackRate`/`AssetId` change → observer → `recomputeEntityTimeRange` (absolute frames in `Computed`) → `bubbleTimeRangeUp` for fitting ancestors; systems and the timeline read `Computed.start/end`.
- Size flow: `resizeEntity` writes `Size` → Size observer calls `propagateSize` → `resolveConstraintOffsets` repositions and resizes constrained children using `ConstraintCache` deltas.
- Playhead, camera, and timeline view are editor state, not document state: written directly, never serialized to the project file.

## Interfaces

- Depends on:
  - `koota` (`World`, `Entity`, `Or`, `Not`, `ChildOf` relation).
  - [../traits/](../traits/README.md): all trait definitions (`Computed`, `Cache`, `ChildOf`, `Selected`, `Playback`, `Camera`, `Trim`, `Delay`, `KeyframeTrack`, `Keyframe`, `Constraint`, `Library`, `Ai`, ...).
  - [../queries/](../queries/README.md): `hierarchy` (`getParentNode`, `getEntityTree`, `getNextName`, `getNodeLocalFrame`), `predicates` (`isScene`, `isGroup`, `isGroupLike`, `isStage`), `camera` (`getCamera`, `getViewport`, `getContentBounds`), `interaction` (`isPointerInEntity`).
  - [../world/](../world/README.md): `store` (raw trait stores), `serialize` (`cloneSubtree`, `cloneFromRecords`, `serializeEntity`, `stripMountIdentity`).
  - [../systems/](../systems/README.md): `transform.computeLocalMatrix`, `motion.getPropertyPaths`, `motion.resetAnimatedValues`.
  - [../utils/](../utils/README.md): `time` (`getSourceFrameAt`, `findAssetDuration`, `getIntrinsicPaint`, `secondsToFrames`), `sort`, `assert`.
  - [../media/](../media/README.md): `caption/utils` (`getTranscriptDuration`, `primeTranscriptDuration`).
  - `../constants` (`DEFAULT_DURATION_FRAMES`, `MIN/MAX_CAMERA_ZOOM`, `PaintType`, `GeometryType`, `ConstraintType`), `../math`, `../ai` (`GenAi` type), `@diffusionstudio/assets` (types).
- Used by:
  - `packages/runtime/src/world/observers.ts`: cache, timing, resize, playback hooks on trait events.
  - `packages/runtime/src/media/*` (video, image, audio, transcode, audio-peaks, audio-sync, mask, caption presets): `getAsset`, `getAssetFile`, `getSequenceFrameRate`, `createEntity`, `appendChild`, `deleteEntity`, `resizeEntity`.
  - `packages/runtime/src/systems/assets.ts`: `bindAsset`, `getAssetFile`. `packages/runtime/src/utils/time.ts`: `getSourceDuration`, `recomputeEntityTimeRange`. `packages/runtime/src/traits/world.ts`: `getAi`.
  - `packages/reconciler/src/document.ts`: `createEntity`, `appendChild`, `removeChild`, `bindAsset`, `resizeEntity`, `setActive`, `setPlayhead`, `setCameraMatrix`, `setTimelineView` (JSX/document → world sync).
  - `packages/encoder/src/encoder.ts`, `image-encoder.ts`: `setActive`.
  - `apps/web/src/engine/*`: `group.tsx` (group/ungroup), `overlap.ts`, `timeline/drag.ts` (`resolveSequentialOverlaps`), `timing.ts` (`setPlayhead`, `trimEntityIn/Out`), `camera.ts`, `camera-controller.tsx`, `new-scene.tsx`, `capture.ts` (camera), `input/shortcuts.ts`, `input/interactions.ts` (clipboard, playback, `syncInteractiveState`, `enterEntity`, `resizeEntity`), `keyframes.tsx`, `editor.ts` (`setActive`, `pinTrimToCurrentBounds`).
  - `apps/web/src/components/*`: timeline layers, inspector rows (`removeKeyframeTrack`, `resizeEntity`, `resolveConstraintOffsets`, `getSequenceFrameRate`, `togglePlayback`), project menus, `dapi/handlers` (`getLibrary`, `getAssetFile`).
  - No callers found in repo for: `frameSelection`, `pasteClipboard`, `reorderEntity`, `reorderSelection`, `setKeyframeTrack`, `getKeyframeTrack`, `findChildAt`, `getAssetBlob`, `aggregateKeyframeTracks`, `reactToGeometryDurationChange` (exported public API only).

Up: [../README.md](../README.md)
