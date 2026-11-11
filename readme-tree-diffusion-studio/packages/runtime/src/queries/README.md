# `packages/runtime/src/queries`

Read-only lookups over the ECS world: entity classification, tree walks, camera/coordinate mapping, hit tests, selection geometry, and the timeline layer index. No function here mutates the world; writes live in `../actions`.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every file below. Reached through `@diffusionstudio/runtime`. |
| `predicates.ts` | Trait checks on one entity: `isStage`, `isScene`, `isGroup`, `isGroupLike`, `isSequence`, `isAudio`, `isAdjustmentLayer`, `isCaption`, `isClipPath`; geometry checks `isText`, `isRect`, `isShape` (rect that is not group/scene/audio); paint checks `hasHtmlPaint`, `hasSurfacePaint` (own `Paint` or any `Cache.fills` entry). |
| `hierarchy.ts` | Tree navigation over the `ChildOf` relation: `getParentEntity` (raw parent, stage included), `getParentNode` (null when parent is the stage), `getSceneAncestor`, `getEntityChildren` (sorted by `sortByItemIndex`), `getSiblingEntities`, `getEntityTree` (pre-order DFS). `getNodeLocalFrame` maps the nearest top-level `Playback` entity's `Computed.localTime` into the node's source frame (`(time - origin) * playbackRate`). `getNextName(world, prefix)` returns `"<prefix> N"` with N one above the highest existing `Name`. |
| `camera.ts` | Camera read path. `getCamera` reads the `Camera` trait on `Root`; `getCameraScale`, `getCameraMatrix` (6-tuple `[a,b,c,d,e,f]`, the `<stage camera={…}>` file form), `getCameraInverse` (null when determinant < 1e-12). `getViewMatrix` = camera × `RenderSurface.resolution` (document → device pixels). `getViewport` reads canvas size / resolution. `screenToWorld`, `worldToScreen` map CSS pixels ↔ document space. `getEntityBounds` unions `WorldBounds` slots (device pixels) and undoes the view matrix; `getContentBounds` does this for all visible top-level `Geometry`/`Group` children of `Root`. |
| `hit-test.ts` | Document-space hit testing. `worldToLocal(world, entity, x, y)` inverts the entity's `LocalTransform` composed with every ancestor's up to the stage. `findSceneAt(world, x, y)` returns the deepest non-culled, non-hidden `Scene` whose transformed `Computed` box contains the point. |
| `interaction.ts` | Device-pixel geometry for pointer tools. `entityWorldMat` (returns `getViewMatrix` for stage/null), `entityLocalMat`, `entityOffset`, `entityAnchor` read SoA stores by entity id. `entityQuad` gives the box as `[TL,TR,BR,BL]`. `isPointerInEntity` does an AABB reject via `WorldBounds` then an exact test in entity-local space. `getSelection` (all `Selected` Geometry/Group), `getMaskSelection` (same, minus `Sequential`), `getSelectionMask` returns `{width, height, mat}`: one node → its own rotated/skewed frame from `decompose2D`; many → upright AABB of their quads. |
| `timeline-index.ts` | Builds the timeline layer tree. `buildTimelineLayers(world, parent)` returns `TimelineNode[]` (`kind: 'geometry' | 'sub-item' | 'keyframe-track'`, `expanded`, `expandable`, `children`). Skips `Keyframe` children; under a `Sequential` parent keeps only children with a live `KeyframeTrack` somewhere below (`hasKeyframes`). Order: tracks, expandable sub-items, geometry, clip paths, each sorted by item index and reversed. Collapsed nodes (no `Expanded` trait) only probe `isExpandable`; expanded nodes recurse. |
| `timeline-view.ts` | `getTimelineView(world, scene)` returns `[zoom px/s, scrollX s, scrollY px]` from the `Timeline` trait, converting frames → seconds with `FrameRate` so the value survives a frame-rate change. Null when the scene has no `Timeline`. |

## How it works

- All functions take a `World` (koota) and read traits via `entity.get`/`entity.has` or SoA stores via `store(world, Trait)` from `../world/store`.
- Derived per-frame data (`LocalTransform`, `WorldTransform`, `WorldBounds`, `Computed`) is written by `../systems/transform.ts` and `../systems/motion.ts` straight into stores, never added as traits. Queries therefore index those stores by `entity.id()` with `?? default` fallbacks.
- Coordinate spaces: `camera.ts` owns document ↔ CSS-pixel mapping and the device-pixel view matrix; `hit-test.ts` works in document space; `interaction.ts` works in device pixels, the space `WorldTransform`/`WorldBounds` are stored in.
- `hierarchy.ts` is the shared tree walker; `hit-test.ts`, `interaction.ts`, and the systems all call `getParentNode` to stop at the stage.
- `predicates.ts` feeds `hierarchy.ts` (`isStage`, `isScene`), `interaction.ts` (`isStage`), and `timeline-index.ts` (`isSequence`).
- `timeline-index.ts` and `timeline-view.ts` are the read side of the timeline panel; their write counterparts are in `../actions/timeline-view.ts` and keyframe actions.

## Interfaces

- Depends on:
  - `../traits` (all trait definitions), `../world/store` (`store`), `../constants` (`GeometryType`, `PaintType`), `../math` (`invert2D`, `multiply2D`, `transformPoint`, `aabbFromTransformedRect`, `decompose2D`, `rectToQuad`, …), `../utils/sort` (`sortByItemIndex`). See [../README.md](../README.md).
  - `koota` (`Entity`, `World`, `Not`, `Or`).
- Used by:
  - [../systems/](../systems/README.md): `transform.ts`, `render.ts`, `playback.ts`, `assets.ts` import `getParentNode`, `getViewMatrix`, `getSceneAncestor`, `getEntityTree`.
  - `../actions/`: `camera.ts` (`getContentBounds`, `getEntityBounds`, `getViewport`, `getCameraMatrix`), `keyframe.ts` (`getNodeLocalFrame`), `group.ts`/`frame.ts` (`getNextName`), `interactive.ts` (`isPointerInEntity`), `timeline-view.ts` (`getTimelineView`).
  - `apps/web/src/engine/`: `input/interactions.ts`, `input/snapping.ts`, `input/input-system.ts`, `hud/hud-system.ts` (`getSelectionMask`, `entityQuad`, `isPointerInEntity`); `timeline/layout.ts`, `timeline/render/layers.ts`, `hooks/use-timeline-index.ts` (`buildTimelineLayers`); `timeline/controller.ts` (`getTimelineView`); `placement.ts`, `camera.ts`, `camera-controller.tsx` (`screenToWorld`, `getViewport`, `getCameraMatrix`); `object-mask/overlay.ts`.
  - `apps/web/src/components/canvas/canvas.tsx`, `draw-overlay.tsx` (`findSceneAt`, `worldToLocal`, `screenToWorld`); `components/sidebar-right/inspector/*` (predicates, hierarchy); `components/timeline/layers/*`.
  - `packages/reconciler/src`, `packages/encoder/src` (hierarchy and predicates).

Up: [../README.md](../README.md)
