# `apps/web/src/components/timeline/layers`

The DOM row column on the left of the timeline: one labelled row per clip, sub-item and keyframe track of the active scene, plus the transport header and Figma-style drag-to-reparent.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `./layers`. Only `Layers` leaves this dir. |
| `layers.tsx` | `Layers()` root component. Header: play/pause (`togglePlayback`), loop toggle (`Playback.loop`), split at playhead (`splitAtPlayhead`), "more" menu (Add layer, Layer height presets, Time format), frame clock (`formatFrames`). Body: `[data-timeline-layers-viewport]` > `[data-timeline-layers]` list, renders `<Layer>` per `index().layers` inside `LayerContextProvider`, then `<DropIndicator>`. `addLayer` inserts an empty `<SequenceElement>` via `editor.insertElement`. `geometryEntities()` generator walks clip rows for the shared-height menu. |
| `layer.tsx` | `Layer()` recursive row renderer. `LAYER_ROWS` maps `TimelineNodeKind` (`geometry`, `sub-item`, `keyframe-track`) to `NodeLayer`, `SubItemLayer`, `KeyframeLayer` via `<Dynamic>`. Recurses into `layer.children` with `depth + 1` and `ancestorSelected`. Exports `LayerRowProps` type. |
| `node.tsx` | `NodeLayer()` clip row (`[data-layer-row]`). Shows chevron, kind icon (`getLayerIcon`), name (double-click to rename inline), mute/solo/hide buttons, bottom-edge height resize handle, context menu (Mute, Solo, Hide, Bring to front, Send to back, Remove). Pointer down selects (`editor.select`, shift extends) and arms a drag (`drag.begin`). Solo is trait-only (`Soloed`), not authored. |
| `sub-item.tsx` | `SubItemLayer()` row for a clip part: fill, stroke, shadow, color stop, effect. `describe()` labels it from `Name`, or `Stroke`/`Shadow`/`ColorStop`/`Paint` (`PAINT_NAMES`)/`Effect` (`effectOption`). Height `KEYFRAME_TRACK_HEIGHT`. Exists so keyframe rows have a parent row. |
| `keyframe.tsx` | `KeyframeLayer()` row for one animated property. Reads `KeyframeTrack.property`/`target`, converts `Cache.keyframes` to scene frames (`Computed.origin + time / playbackRate`), offers previous/next keyframe buttons (`setPlayhead`) and a `<Keyframe>` toggle. `formatProperty()` maps a `PropertyPath` to a label via `PROPERTY_NAMES`, falls back to the last path segment split on capitals. |
| `context.tsx` | `LayerContextProvider()` / `useLayerContext()`. Shares `resized` signal (row being height-dragged) and `drag: LayerDrag` (`dragging`, `target`, `begin`). Owns the reparent gesture: 4px threshold (`DRAG_THRESHOLD_PX`), `requestAnimationFrame` tick, edge auto-scroll (`AUTO_SCROLL_ZONE_PX`, `timeline.scrollBy`), 600ms dwell expands collapsed containers (`EXPAND_DWELL_MS`), Escape cancels. `updateTarget()` pairs `[data-layer-row]` rects with `flattenRows()` output and calls `hitRows`/`resolveGap`. `performDrop()` calls `editor.reparent`; for a sequence parent also `resolveSequentialOverlaps`. |
| `drag.ts` | Pure drop geometry. Types `DropTarget` (`line` with `parent`/`anchor`/`y`/`inset`, or `inside` with `parent`/`top`/`height`), `LayerDrag`, `FlatRow`, `GapContext`, `RowHit`. `flattenRows()` lists geometry rows depth-first with depth, parent, ancestors (sub-item/keyframe rows add depth but are skipped). `getListBottom()` reads the last non-indicator row's bottom. `hitRows()` decides gap vs inside (container rows: 8px / 25% edge strips = gap, middle = inside; plain rows split at midline). `resolveGap()` offers one insertion per depth between the row below and one level into the row above; pointer X picks depth (`DOT_CENTER_PX` + `NESTED_INDENT_PX` steps). `scanAnchor()` finds the document sibling to insert before, restricted to the same clip-path/plain bucket. |
| `drop-indicator.tsx` | `DropIndicator()` (`[data-drop-indicator]`). Renders a primary line + dot at `line.y`/`line.inset`, or an inset ring over `inside.top`/`inside.height`. Positioned in list space so it scrolls with the rows. |
| `hover.ts` | `setRowHover(world, entity)`. Removes `Hovering` from every other entity, adds it to the given one. Single-holder because leave events can be missed. Trait-only, not authored. |
| `config.ts` | `NESTED_INDENT_PX = 20`. Indent per tree depth, shared by rows and drag geometry. |

## How it works

- `pages/editor.tsx` mounts `<Layers />` next to `<Timeline />` (the canvas).
- `Layers` reads `useTimelineIndex()` (`{ root, layers: TimelineNode[] }`, rebuilt from `buildTimelineLayers` per engine tick, reported only on shape change).
- `Layers` calls `timeline.mount` / `timeline.unmount` on mount/cleanup. The timeline controller then grabs `[data-timeline-layers]` and `[data-timeline-layers-viewport]`, translates the list by `-scrollY`, and sets `--layer-x` for sideways label scroll. Rows apply `translateX(calc(var(--layer-x) * -1))` on `[data-layer-label]`.
- `Layer` renders each `TimelineNode` as the row component for its `kind`, then its children one depth deeper. Row heights: clip rows use `ClipHeight` (default `DEFAULT_CLIP_HEIGHT`), other rows use `KEYFRAME_TRACK_HEIGHT`.
- Row edits go through `editor.editProperty(entity, key, value)` for authored state (`muted`, `hidden`, `expanded`, `name`, `clipHeight`). Hover and solo write traits directly (`Hovering`, `Soloed`).
- Drag flow: `NodeLayer` pointerdown -> `drag.begin` (pending). Move past 4px -> `activate` (forbidden set = dragged subtree via `getEntityTree`). Each frame: auto-scroll, dwell-expand, then `updateTarget` reads DOM rects, computes `DropTarget`, `DropIndicator` draws it. Pointer up -> `performDrop` -> `editor.reparent(entity, parent, anchor)` as one undo step. Rows never move during the drag.
- Order semantics: the column reads top-down, the document reads bottom-up. `anchor === undefined` appends last (frontmost). "Bring to front" = `reparent(entity, parent, undefined)`; "Send to back" = anchor first sibling.

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime` traits and queries: `ClipHeight`, `Expanded`, `Hidden`, `Hovering`, `Muted`, `Name`, `Selected`, `Soloed`, `Playback`, `Computed`, `FrameRate`, `KeyframeTrack`, `Keyframe`, `Cache`, `Paint`, `Stroke`, `Shadow`, `ColorStop`, `Effect`; `getEntityTree`, `getEntityChildren`, `getParentEntity`, `findGeometryAsset`, `findClosestParentGeometry`, `getActiveEntity`, `setPlayhead`, `togglePlayback`, `getNextName`, `isGroupLike`, `isSequence`, `isClipPath`, `isGroup`, `isScene`, `isText`, `isCaption`, `isAdjustmentLayer`; type `TimelineNode` (`packages/runtime/src/queries/timeline-index.ts`).
  - `@diffusionstudio/koota-solid`: `useWorld`, `useTrait`, `useTag`.
  - `@diffusionstudio/reconciler`: `Sequence` element, `trackProperty`.
  - `apps/web/src/engine/hooks` (`useEditor`, `useTimelineIndex`, `useDerived`), `apps/web/src/engine/editor.ts` (`editProperty`, `select`, `clearSelection`, `remove`, `reparent`, `insertElement`), `apps/web/src/engine/timeline` (`DEFAULT_CLIP_HEIGHT`, `MIN_CLIP_HEIGHT`, `MAX_CLIP_HEIGHT`, `KEYFRAME_TRACK_HEIGHT`, `RULER_HEIGHT`, `getClipFallbackName`), `apps/web/src/engine/split.ts` (`splitAtPlayhead`), `apps/web/src/engine/overlap.ts` (`resolveSequentialOverlaps`).
  - `apps/web/src/context/timeline` (`useTimeline`: `mount`, `unmount`, `scroll`, `scrollBy`, `setMinimized`), `apps/web/src/context/layout` (`useLayout`).
  - `apps/web/src/components/ui` (`button`, `icon`, `tooltip`, `dropdown-menu`, `context-menu`, `keyframe`), `apps/web/src/components/sidebar-right/inspector/effect-types.ts` (`effectOption`), `../time-format.ts` (`formatFrames`, `TIME_FORMAT_OPTIONS`).
  - `apps/web/src/init` (`store`), `apps/web/src/lib/store` (`createStoredSignal`) for persisted `timeline.timeFormat`.
- Used by:
  - `apps/web/src/components/timeline/index.ts` re-exports `Layers`.
  - `apps/web/src/pages/editor.tsx:278` renders `<Layers />`.
  - `apps/web/src/engine/timeline/controller.ts` queries `[data-timeline-layers]`, `[data-timeline-layers-viewport]`, `[data-layer-label]` and writes `--layer-x` (DOM contract, no import).

Up: [../README.md](../README.md)
