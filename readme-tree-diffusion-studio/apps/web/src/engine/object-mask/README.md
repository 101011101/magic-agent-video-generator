# `apps/web/src/engine/object-mask`

The Object Mask tool: click or brush an object on a video clip, segment and track it with SAM2 in the browser, and write the result into the library as a `.mask` file plus a `<mask>` element on the clip.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every module except `frame.ts`. Reached by `apps/web/src/engine/index.ts` (`export * from './object-mask'`). |
| `store.ts` | Session state, outside the ECS world. Types: `MaskPoint`, `MaskStroke`, `ObjectTrack` (one session: `clip`, `seedFrame`, `points`, `strokes`, `model`, `decoded`, `seedMask`, `first`, `masks[]`, `status`, `completed`, `controller`), `ObjectTrackStatus` (`loading` → `segmenting` → `seeded` → `tracking` → `saving` / `error`), `ObjectHover`, `ObjectMaskMode` (`points`/`brush`), `ObjectMaskOp` (`add`/`subtract`), `ObjectMaskModelLoad`, `MaskRestore`. Signals: `objectTrack`, `objectMaskModel` (persisted via `createStoredSignal`, key `object-mask.model`), `objectMaskModelLoad`, `targetEffect`. Functions: `get/set/clearObjectTrack`, `clearObjectTrackOf`, `clearObjectTracks`, `getObjectMask(track, frame)`, `get/setObjectHover`, `setObjectMaskModel`, `beginObjectMaskFor`, `getTargetEffect`, `getTargetClip`, `clearTargetEffect`, `get/set/finishMaskRestore`. |
| `tracking.ts` | Drives the SAM2 model on one serial `queue`. `promptObjectMask` (click → `holdFrame` + `seedHeld` → `seeded`), `trackObjectMask` (`trackObject` over the clip's source window → `commitObjectMask` → select clip, switch to Move tool), `cancelObjectMask`, `hoverObjectMask`/`clearObjectHover` (coalesced `preview` of the segment under the pointer), `restoreObjectMask`/`canRestoreObjectMask`/`getMaskRestoreOf` (re-track a mask from its `recipe`, write the file back, `library.relink`), `segmentFootage` (`FootageSegmentRequest` → `FootageSegments`, for the agent), `preloadObjectMaskModel`, `pickObjectMaskModel`. Private: `loadModel`, `enqueue`, `openSession`, `openClipSession`, `holdFrame`, `releaseFrame`, `corrector`, `sourceSeconds`. |
| `commit.tsx` | Writes a session into the project. `commitObjectMask(world, track)`: `encodeObjectMask` → `library.store` at `masks/<video>/Tracking <n>.mask` → inserts `<Mask src sourceIn>` under the target effect, the clip's visible opacity effect, or a new `<Effect type="opacity">`. Also `encodeObjectMask`, `objectMaskFolder`, `nextTrackingName`, `pendingMaskPaths` (paths promised to background tracks). |
| `copy.tsx` | Reuses tracked masks. `ObjectMaskSource` type; `objectMasksOf(library, footageId)` (every `MASK` asset whose `recipe.source` is the video); `copyObjectMask(world, effect, source)` (inserts a `<Mask>` under another effect, carries the sibling's `blur` feather); `removeObjectMask` (removes every `<mask>` naming the asset, aborts a restore, removes the file). |
| `use-object-masks.ts` | SolidJS hook `useObjectMasks(clip)` → `{ footage, masks }` accessors; memo over `objectMasksOf` that reruns only when the footage id or library list changes. |
| `brush.ts` | Stroke painting over the seeded mask. `paintableObjectTrack` (seeded session, on its seed frame), `beginMaskStroke`, `extendMaskStroke` (adds a point every `POINT_SPACING` radii), `endMaskStroke`, `undoMaskStroke`. Each paint copies `seedMask.logits` and calls `paintStroke`. |
| `interaction.ts` | HUD hit-region callback `handleObjectMaskInteraction`: points mode → click (< `CLICK_DISTANCE`) → `promptObjectMask`; brush mode → `dragstart/drag/dragend` → brush functions. `heldObjectMaskOp` / `heldObjectMaskLabel` (alt or shift swaps add/subtract). |
| `overlay.ts` | Per-frame HUD draw `drawObjectMasks(world, ctx, resolution)`: resets tool state when the tool is put down; picks `toolTarget` (target clip or video under pointer); `updateHover`; draws the session's mask (`drawMask`, traced by `traceMask` into a cached `Path2D`, max 48), prompt points (`drawPoints`), hover segment, brush ring (`drawBrush`, sets `ObjectMaskTool.brushShown`); pushes a `hud` hit region (`id: 'object-mask'`) that routes to `handleObjectMaskInteraction`. |
| `media.ts` | Geometry between device pixels and the video frame. `VideoRect` type, `getVideoRect(world, entity)` (asset, world matrix, fitted picture rect via `getScaledImageProps`), `pointOnVideo` (0..1 or null off-picture), `videoPointAt` (0..1, unclamped), `videoPointToDevice`, `currentSourceFrame` (clip's `Computed.localTime` clamped to its source window). |
| `frame.ts` | `maskFrame(sam2Mask)`: quantizes float logits to an `Int8Array` `MaskFrame` (`quantizeLogit`), the form the mask file stores. Not re-exported by `index.ts`. |

## How it works

- Toolbar or `M` sets `Tool` to `ToolType.OBJECT_MASK`. `ObjectMaskBar` mounts and calls `preloadObjectMaskModel` → `loadModel` → `loadSam2` (from `@diffusionstudio/sam2`); progress lands on `objectMaskModelLoad`.
- Each HUD frame, `hud-system.ts` calls `drawObjectMasks`. It resolves the target clip, asks `hoverObjectMask` for the segment under a resting pointer, draws the session and hover masks, and registers the click region.
- Click on the video → `handleObjectMaskInteraction` → `pointOnVideo` → `promptObjectMask`. This builds an `ObjectTrack` (`status: loading`), aborts the previous one, and enqueues: open session (model + decodable `InputVideoTrack` via `getVideoTrack`), `holdFrame` the seed frame, `seedHeld(points)` → `decoded`; `paintMask(decoded, strokes)` → `seedMask`; `status: seeded`. Same clip and frame appends a point; anywhere else starts over.
- Brush mode (`B`): drags paint into `seedMask` through `paintStroke`; strokes are stored on the track and replayed as `correct` during tracking. `mod+Z` undoes the last stroke.
- `mod+Enter` or the bar's button → `trackObjectMask`: `trackObject` over every source frame of the clip's window, `onMask` fills `track.masks[i] = maskFrame(...)` and `completed`; then `commitObjectMask` encodes the file with its `MaskRecipe` (`model`, `source`, `first`, `seedFrame`, `points`, `strokes`), stores it, and authors the `<Mask>` element. Session is cleared, clip selected, tool returns to Move.
- `Escape` → `cancelObjectMask` aborts the controller and returns to Move.
- All model work (`prompt`, `track`, `hover`, `restore`, `segmentFootage`) is chained on one promise `queue`; `busy` makes hovers yield to real work. `held` remembers which frame the model has encoded so repeated prompts on it run only the decoder.
- Restore: a `MASK` asset with a `recipe` whose source video is in the library and whose file is a project source can be re-tracked by `restoreObjectMask`; frames are written with `library.fs.write` and `library.relink`.
- Agent path: `dapi/handlers/media-segment.ts` calls `segmentFootage` directly (preview or full track) and uses `encodeObjectMask`, `objectMaskFolder`, `nextTrackingName`, `pendingMaskPaths` to store its own file.
- Session state lives in module-level signals (`store.ts`), not in ECS traits; only `ObjectMaskTool` (mode, op, brushRadius, brushShown) is a world trait in `../traits.ts`.

## Interfaces

- Depends on:
  - `packages/sam2` (`loadSam2`, `trackObject`, `holdFrame`, `Sam2Video`; `./mask`: `paintMask`, `paintStroke`, `Sam2Mask`; `./models`: `SAM2_MODELS`, `DEFAULT_SAM2_MODEL`, `geometryOf`, `sam2ModelOfRepo`).
  - `packages/assets` (`encodeMaskFile`, `quantizeLogit`, `traceMask`, `assetName`, `isProjectSource`, `MASK_EXTENSION`; types `MaskAsset`, `MaskFrame`, `MaskRecipe`, `VideoAsset`, `AssetLibrary`).
  - `packages/runtime` (`Library`, `Tool`/`ToolType`, `FrameRate`, `Computed`, `ScaleMode`, `Cache`, `Effect`, `Mask`, `AssetId`, `Blur`, `Hidden`, `Culled`, `HitRegions`, `RenderSurface`, `getSourceWindow`, `getVideoTrack`, `findGeometryAssetSource`, `entityWorldMat`, `getScaledImageProps`, 2D matrix helpers).
  - `packages/reconciler` (`Mask`, `Effect` JSX elements for `insertElement`).
  - `apps/web/src/engine/traits.ts` (`ObjectMaskTool`, `Pointer`, `Keys`), `../editor` (`getDocumentEditor`), `../hooks` (`useDerived`), `../library` (`useLibrary`), `apps/web/src/lib/store/signal.ts` (`createStoredSignal`), `@/init` (`store`), `koota`, `solid-js`, `somoto` (toasts), `mediabunny` (`InputVideoTrack` type).
- Used by:
  - [../hud/](../hud/README.md) `hud-system.ts` → `drawObjectMasks`.
  - [../input/](../input/README.md) `shortcuts.ts` → `cancelObjectMask`, `trackObjectMask`, `undoMaskStroke`, `getObjectTrack`; sets `ObjectMaskTool.mode` on `P`/`B`.
  - `../create-engine.ts` → adds `ObjectMaskTool` trait; `clearObjectTrackOf` on entity removal; `clearObjectTracks` on dispose.
  - `apps/web/src/components/canvas/object-mask-bar.tsx` → model picker, status, Track/Cancel buttons (`objectMaskModel`, `objectMaskModelLoad`, `pickObjectMaskModel`, `preloadObjectMaskModel`, `heldObjectMaskOp`, `getMaskRestore`).
  - `apps/web/src/components/sidebar-right/inspector/effects-inspector.tsx` → `useObjectMasks`, `copyObjectMask`.
  - `apps/web/src/components/sidebar-right/inspector/object-mask.tsx` → `canRestoreObjectMask`, `restoreObjectMask`, `getMaskRestoreOf`, `useObjectMasks`.
  - `apps/web/src/components/sidebar-right/inspector/tracking.tsx` → `useObjectMasks`, `removeObjectMask`.
  - `apps/web/src/dapi/handlers/media-segment.ts` → `segmentFootage`, `encodeObjectMask`, `objectMaskFolder`, `nextTrackingName`, `pendingMaskPaths`.
  - `beginObjectMaskFor` has no caller outside this directory (grep of `apps/web/src`).

Up: [../README.md](../README.md)
