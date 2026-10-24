# `apps/web/src/engine`

The editor engine: owns the koota `RuntimeWorld` of an open project, runs the per-frame loop (runtime systems + editor input/HUD/timeline systems), and turns every user command into a document change that is reported back as an `EntityEdit` for the JSX source.

## Parts

| Part | Role |
|---|---|
| [input/](input/README.md) | `inputSystem` (drains `PointerEvents`, hit-tests `HitRegions`, synthesizes drag/hover, brackets each press in one undo gesture) and `shortcutSystem` (keyboard tables). Select/move/resize/rotate/marquee gestures with snapping. `editTransform` writes keyframes then props. |
| [hud/](hud/README.md) | `hudSystem`: draws node headers, selection box, handles, hover outlines, snap guides, marquee over the stage canvas, and pushes `hud` hit regions. `name-input.ts`: in-place rename field. |
| [timeline/](timeline/README.md) | `timelineSystem`: immediate-mode canvas pass for the active scene's clips (ruler, playhead, work area, thumbnails, waveforms, keyframes). Clip move/trim/scrub gestures. Thumbnail and peak caches outside the world. `createTimelineController` binds the DOM. |
| [object-mask/](object-mask/README.md) | Object Mask tool: SAM2 point/brush prompts on a video clip, tracking over its source window, writes a `.mask` asset and a `<Mask>` element. Session state in module signals. |
| [hooks/](hooks/README.md) | Solid hooks for UI reads of world state: `useEditor`, `useDerived` (samples on `Engine.frame`), `useSelection`, `useTool`, `useCamera`, `useTimelineIndex`, `useAssetSelection`, `useObjectMaskTool`, `useActiveScene`. |
| `create-engine.ts` | `Engine` class + `createEngine(projectId, options)`. Creates the world (`createRuntimeWorld`), adds editor traits, owns or injects an `AudioContext` (`AudioEngine`). `mount(canvas)` sets `RenderSurface`, binds canvas pointer and window key/blur listeners, observes resize. `loop` sets `Time`, runs `syncInteractiveState` when `ChildOf` changed, runs systems, ticks `frame` signal, clears `Keys.pressed`/`lifted`. `snapshot()` renders one PNG in `offline-video` mode. `dispose()` clears timeline media/peaks and object tracks, destroys the world. `onRemove(Geometry)` clears per-clip caches (koota reuses ids). |
| `context.tsx` | `EngineProvider` (creates the `Engine`, disposes on cleanup, wraps koota-solid `WorldProvider`) and `useEngineContext()` (lifecycle access only). |
| `canvas.tsx` | `EngineCanvas`: renders the `<canvas>`, calls `engine.mount` + `engine.start` on mount. |
| `camera-controller.tsx` | `CameraController`: DOM wheel (ctrl/meta = `zoomCameraAt`, else `panCamera`) and middle/space/HAND-tool drag pan. Reports `camera` on the root via `reportEdit`. |
| `camera.ts` | `zoomBy`, `zoomTo`, `zoomToFit`, `zoomToSelection`: runtime camera ops + `reportEdit(root, 'camera', ...)`. |
| `traits.ts` | Editor-only world traits (never authored): `Pointer`, `Keys` (+ `MODIFIER_KEYS`), `SnapLines`, `Hud` (`idle`/`moving`/`marquee`), `ObjectMaskTool`, `PointerEvents` (queue), `AssetSelection`, `ProjectConfig` (handle). |
| `editor.ts` | `DocumentEditor` (one per world via `getDocumentEditor`). The single write path. `editProperty`, `editText`, `editVariable`, `reportEdit` (no document write), `select`/`deselect`/`activate`, `insertElement` (records created nodes under `pending#n` sources), `duplicate`, `duplicateInPlace`, `wrap`, `reparent`, `remove`, `copy`/`paste`, `removeIntrinsicPaint`. Emits `EntityEdit` = `prop`/`text`/`insert`/`move`/`remove`/`unroll`/`variable` to `onEdit` sinks. `settle` unrolls a `Loop`-rendered iteration before an edit; `unsettle`, `restamp`, `discardPending` let the writer fix sources. |
| `history.ts` | `EditHistory` (`getEditHistory`). Listens to `onEdit`; folds edits into transactions (microtask commit, or one per gesture via `beginGesture`/`endGesture`). Coalesces repeated prop/variable edits within 600 ms; max 100 transactions. Skips view props (`selected`, `active`, `camera`, `expanded`, `clipHeight`, `timeline`, `playhead`). `undo`/`redo` replay ops through `DocumentEditor`; follows source renames. A `remove` without captured node clears history. |
| `timing.ts` | Time edits in frames, written as seconds: `authoredTime`, `editTime`, `editWorkarea`, `editPlayhead` (report only), `trimIn`, `trimOut`, `moveEntityTo`. |
| `overlap.ts` | `resolveSequentialOverlaps` (after a drag) and `resolveNewSequenceOverlaps` (new sequence): siblings in a `Sequential` parent covered by a clip get removed, trimmed, or split via `duplicateInPlace`. |
| `split.tsx` | `splitAtPlayhead`: duplicates visible clips under the playhead, trims both halves, hands off decoders, clones timeline peaks/frames, wraps each pair in a `<Sequence>` unless the parent is a group. |
| `group.tsx` | `groupSelection`, `wrapSelectionInSequence`, `wrapSelectionInScene` (scene sized to selection bounds, children re-offset), `ungroupSelection`, `unwrapSequenceSelection` (reparent children, bake container transform and timeline shift into them). |
| `clip-path.ts` | Clip-path tool: `beginClipPathFor` (target signal + `ToolType.CLIP_PATH`), `canClipWith`, `getClipPathPicks`, `applyClipPaths` (reparent shapes into target, set `clipPath`, keep world placement), `cancelClipPath`. |
| `keyframes.tsx` | `findKeyframeTrack`, `findKeyframeAt`, `keyframeFrame`, `writeKeyframe` (edit existing, insert `<Keyframe>` or new `<KeyframeTrack>`), `toggleKeyframe`, `syncKeyframe` (write only if a track exists), `removeKeyframeTrack`. |
| `align.ts` | `alignSelection` (6 `AlignAction`s), `distributeSelection` (x/y) on top-level selected nodes by `WorldBounds`; writes `x`/`y` + `syncKeyframe`. |
| `library.ts` | `attachLibrary(world, dir)`: `AssetLibrary` over `createProjectFS(dir)` set on the `Library` trait; on rename rewrites `src` props, on relink updates `AssetId`. `isLibraryFile`, `useLibrary`. |
| `asset-actions.ts` | UI wrappers with toasts: `importFiles`, `pickAndImport`, `replaceAssetSource` (relink + forget timeline media/peaks), `saveAssetAs`, `insertAssetAtPlayhead`. Re-exports `pickFiles`, `droppedFiles`. |
| `insert-asset.tsx` | `insertAsset(world, asset, options)`: inserts `<Rect>` + `<VideoPaint>`/`<ImagePaint>`, `<Audio>`, or `<Captions>` by asset type into the active scene (or root), centered, at playhead time; selects it. `AUDIO_SIZE`. |
| `new-scene.tsx` | `createScene` (focus camera, insert `<Scene>` + black `<SolidPaint>`, activate), `insertAssetsInNewScene`, `DEFAULT_SCENE_FORMAT` (1920x1080), `hasSize`, `sizeOf`. |
| `placement.ts` | `findEmptyPlacement(world, width, height, gap)`: free spot right/left of root children nearest the viewport center. |
| `generations.ts` | `retryGeneration`: removes a partial asset and re-adds `GenerationRequest` or `TranscriptionRequest` on errored generated entities. |
| `capture.ts` | `createCapture(source, node, options)`: compiles (desktop) or loads the cached bundle, mounts it in a fresh offline world on a hidden canvas, keeps only the node with the same `Source` stamp, resets camera. Returns `{ world, node, dispose }`. |
| `project-config.ts` | `ProjectConfig` class over `package.json` `diffusion` field (via `@/projects/host`): per-scene `ExportConfig` (format, video/audio codec settings) keyed by scene source locator. `attachProjectConfig`, `useProjectConfig`, `isProjectConfigFile`, `parseExportConfig`. |
| `inspect.ts` | Per-world signal registry of reconciler `InspectEntry`s: `setInspectEntries`, `useInspectEntries`, `findInspectEntry` (used by `editVariable`). |
| `fonts.ts` | `getLocalFonts()`: `window.queryLocalFonts` grouped into runtime `FontSources` with weight/style guessed from style names. |
| `index.ts` | Barrel. Re-exports most modules and child dirs. Not re-exported: `inspect`, `insert-asset`, `new-scene`, `placement`, `generations`, `project-config`, `timeline` (consumers import these by path). |

## How it works

- Setup: `pages/project.tsx` renders `EngineProvider`. It calls `createEngine`, which builds the world and adds editor traits plus `TimelineSurface`. `components/canvas/canvas.tsx` renders `EngineCanvas` and `CameraController`.
- Project attach: `pages/editor.tsx` calls `attachLibrary`, `attachProjectConfig`, `setInspectEntries` after mount, subscribes `getDocumentEditor(world).onEdit` to the `EditWriter`, and calls `getEditHistory(world).reset()` on reload.
- Events: canvas DOM pointer events go into the `PointerEvents` queue in device pixels. Key events go into `Keys` sets. Nothing acts at event time, except `preventDefault`.
- Frame order (`runSystems`): `inputSystem` -> `shortcutSystem` -> runtime `assetSystem`, `playbackSystem`, `motionSystem`, `transformSystem`, `renderSystem` -> `hudSystem` -> `timelineSystem`. Then `frame` ticks, so `useDerived` hooks resample.
- Hit regions: `hudSystem` and `object-mask/overlay.ts` push regions each frame. The next frame's `inputSystem` tests the pointer against them and dispatches to handlers in `input/interactions.ts`.
- Commands: gestures, shortcuts, inspector panels, and `dapi` handlers call the operation modules (`timing`, `split`, `group`, `align`, `clip-path`, `keyframes`, `insert-asset`, `new-scene`, `overlap`). Each operation writes only through `DocumentEditor`.
- Write-back: `DocumentEditor` changes the `RuntimeDocument` (reconciler) and emits an `EntityEdit` keyed by the element's `Source` stamp. New elements get `pending#n` stamps. `projects/edits.ts` writes the source, then calls `restamp`, `unsettle`, or `discardPending`.
- View-only state (`camera`, `playhead`, `timeline`, `selected`, `active`) goes through `reportEdit`: the file gets it, history skips it.
- Undo: `EditHistory` records the same edit stream. `input-system.ts` opens one transaction per press with `beginGesture`/`endGesture`. Replay calls `DocumentEditor` again, so the replay also reaches the file.
- Cache lifetime: decoded thumbnails, peaks, and object-mask tracks live outside the world. `create-engine.ts` clears them per clip on `Geometry` removal and fully on `dispose()`.
- Export and agent capture: `createCapture` re-mounts the bundle in a separate offline world, so export does not touch the live world.

## Interfaces

- Depends on:
  - `packages/runtime` (`@diffusionstudio/runtime`): world, traits, systems, camera, time and matrix helpers.
  - `packages/reconciler`: `RuntimeDocument`, `getRuntimeDocument`, `insert`, `withDocument`, `authoredElement`/`authoredTree`/`renderAuthored`, `mount`, JSX elements (`Rect`, `Scene`, `Sequence`, `Group`, `Keyframe`, `KeyframeTrack`, `Mask`, ...).
  - `packages/jsx`: `isAssetRef`, `serializeAssetRef`, `SOURCE_ATTR`, `parseTime`, `parseSource`.
  - `packages/assets`: `AssetLibrary`, import/save/pick helpers. `packages/sam2` (via [object-mask/](object-mask/README.md)). `@diffusionstudio/koota-solid`, `koota`, `solid-js`, `somoto`, `mediabunny` (types, timeline decode).
  - `apps/web/src/projects` (`createProjectFS`, `compileProject`, `isDesktop`, `host` config read/write), `apps/web/src/lib/db.ts` (`loadProjectBundle`).
- Used by:
  - `apps/web/src/pages/project.tsx` (`EngineProvider`), `apps/web/src/pages/editor.tsx` (editor, history, inspect, library, project config, `engine.snapshot`).
  - `apps/web/src/projects/edits.ts` (`onEdit` stream, `restamp`, `unsettle`, `discardPending`).
  - `apps/web/src/components/*`: canvas, timeline, `sidebar-left` (assets, project menus), `sidebar-right/inspector`, `genai` — mostly via `@/engine/hooks`, `@/engine/keyframes`, `@/engine/library`, `@/engine/asset-actions`.
  - `apps/web/src/context/render.ts`, `apps/web/src/utils/gen-ai.ts`, `apps/web/src/lib/db.ts`, `apps/web/src/dapi/handlers/capture.ts` (`createCapture`); `dapi/handlers/export.ts` (project config); `dapi/handlers/fonts.ts` (`getLocalFonts`).
- Note: parent `apps/web/src/README.md` is still pending; this README matches the engine claims in [../../README.md](../../README.md).

Up: [../README.md](../README.md)
