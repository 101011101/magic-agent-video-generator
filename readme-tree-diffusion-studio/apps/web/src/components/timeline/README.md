# `apps/web/src/components/timeline`

The editor's bottom timeline: a `<canvas>` the timeline engine draws clips on, plus the DOM row column (`Layers`) on its left, plus the time display formatter both share.

## Parts

| Part | Role |
|---|---|
| `timeline.tsx` | `Timeline()` component. Renders `<canvas id="timeline-canvas">` in a `relative size-full` wrapper. On mount calls `timeline.attachCanvas()`, on cleanup `timeline.detachCanvas()` (from `useTimeline()`). Owns drop-to-insert: `handleDrop` reads asset ids from `ASSET_DRAG_TYPE` and dropped files, imports files via `importFiles`, converts `event.clientX` to a start time with `timeline.clientToFrame` + `framesToSeconds`, then inserts. `handleDragOver` sets `dropEffect = 'copy'`. Draws nothing itself. |
| [layers/](layers/README.md) | `Layers()` component. Transport header (play/pause, loop, split at playhead, "more" menu, frame clock) and one labelled DOM row per clip, sub-item and keyframe track of the active scene. Figma-style drag-to-reparent with a drop indicator. Registers itself with the timeline controller via `timeline.mount()` / `timeline.unmount()`. |
| `time-format.ts` | `TimeFormat = 'standard' \| 'timecode' \| 'frames'`. `TIME_FORMAT_OPTIONS` (value, label, example) for the format menu. `formatFrames(frame, fps, format)` renders a frame position as `MM:SS:CS`, `HH:MM:SS:FF`, or `Nf`; clamps bad `fps` to 30 and bad `frame` to 0. |
| `index.ts` | Re-exports `./layers` (`Layers`) and `./timeline` (`Timeline`). `time-format.ts` is not re-exported. |

## How it works

- `pages/editor.tsx:8` imports `{ Timeline, Layers }` from this dir. `pages/editor.tsx` renders `<Layers />`, a border div, then `<Timeline />` side by side in the bottom strip, both gated on `uiVisible()`.
- The drawing logic lives in `apps/web/src/engine/timeline` (`createTimelineController`), not here. `context/timeline.tsx` `TimelineProvider` creates one controller per project and `useTimeline()` hands it to both components.
- Canvas lifecycle: `Timeline` mounts -> `attachCanvas()` looks up `#timeline-canvas` by id, stores the 2D context, observes the parent size, and binds `wheel` and `pointerdown`. `detachCanvas()` drops the canvas so the draw pass no-ops until another is attached. The canvas can be collapsed and reopened without the rows going away because `Layers` uses the separate `mount()` / `unmount()` pair (body-level `pointermove` / `pointerup`).
- Row column and canvas stay aligned through the controller: it translates `[data-timeline-layers]` by `-scrollY` and writes `--layer-x` for label scroll. See [layers/](layers/README.md).
- Drop flow (`timeline.tsx` `handleDrop`): read `dataTransfer` before the first `await` (it is gone after). Resolve ids through `useLibrary()`; import raw files with `importFiles(lib, files, '')`. `start` = `framesToSeconds(max(0, clientToFrame(clientX)), fps)` where `fps` = `world.get(FrameRate)?.value ?? 30`. If `getActiveEntity(world)` is null: `insertAssetsInNewScene(world, assets, { start })`, toast "Open a project first" on failure. Else: `insertAsset(world, asset, { start })` per asset, toast "Open a scene first" on failure.
- Unlike a drop on the canvas (which starts at the playhead), a drop here starts at the pointer's frame: the horizontal position means "when".
- `formatFrames` is consumed by `layers/layers.tsx` for the header clock; the chosen `TimeFormat` is persisted as `timeline.timeFormat` by `Layers`.

## Interfaces

- Depends on:
  - `apps/web/src/context/timeline.tsx` (`useTimeline`: `attachCanvas`, `detachCanvas`, `clientToFrame`, `mount`, `unmount`, `scrollBy`).
  - `apps/web/src/engine/timeline` (`createTimelineController`, row height and ruler constants) — see [../../engine/timeline/README.md](../../engine/timeline/README.md).
  - `apps/web/src/engine/asset-actions.ts` (`droppedFiles`, `importFiles`), `apps/web/src/engine/insert-asset.tsx` (`insertAsset`), `apps/web/src/engine/new-scene.tsx` (`insertAssetsInNewScene`), `apps/web/src/engine/library` (`useLibrary`).
  - `apps/web/src/components/sidebar-left/folder-item.tsx` (`ASSET_DRAG_TYPE = "application/x-asset-id"`).
  - `@diffusionstudio/runtime` (`FrameRate`, `framesToSeconds`, `getActiveEntity`), `@diffusionstudio/koota-solid` (`useWorld`), `somoto` (`toast`).
  - Everything `layers/` lists in [layers/README.md](layers/README.md#interfaces).
- Used by:
  - `apps/web/src/pages/editor.tsx` (`<Layers />`, `<Timeline />`).
  - `apps/web/src/engine/timeline/controller.ts` by DOM contract: `document.getElementById('timeline-canvas')`, `[data-timeline-layers]`, `[data-timeline-layers-viewport]`.

Up: [../README.md](../README.md)
