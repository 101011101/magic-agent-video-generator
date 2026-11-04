# `packages/runtime/src/traits`

Defines every ECS trait (component) and the one relation that make up a Diffusion Studio runtime world: the data schema that systems, actions, queries, and the serializer all read and write.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports all 13 trait modules. `packages/runtime/src/index.ts` re-exports this barrel, so every trait is public API of `@diffusionstudio/runtime`. |
| `relations.ts` | `ChildOf` — the single koota `relation` for parent/child ownership. `exclusive: true` (one parent), `autoDestroy: 'orphan'` (destroying a parent destroys its subtree). Replaces array-based ownership of fills, shadows, strokes, effects, text ranges, tracks, clips, animations. Sibling order lives in `ItemIndex`. |
| `node.ts` | Node identity and role. Value traits: `Geometry` (`GeometryType.RECT`/`TEXT`), `Paint` (`PaintType`), `Name`, `Key` (stable id), `AssetId`, `ItemIndex`, `Caption` (preset type, colors, verticalAlign), `MountScript`/`MountPath` (mount root script and per-entity structural path). Role tags layered on a geometry: `Group`, `Scene`, `Audio`, `AdjustmentLayer`, `IsClipPath`, `Shadow`, `Stroke`, `Hidden`, `ClipsContent`, `Generating`. Session-only, never serialized: `Source` and `Loop` (JSX source location for write-back), `GenerationRequest` (`AssetRef`), `LoadRequest`, `TranscriptionRequest` (seed), `SyncRequest`/`PendingSync` (syncTo correlation), `PendingSource`, `SourceError` (message + `generated` flag). |
| `document.ts` | `Host` — handle to the `SceneNode` (from `@diffusionstudio/jsx`, instantiated with `DomNode = Element \| Text`) the entity was rendered from. Exports types `DomNode`, `SceneNode`. AoS handle, never serialized. |
| `transform.ts` | Authored transform: `Position`, `Offset`, `Rotation`, `Scale`, `UniformScale`, `Anchor`, `Skew`, `Size`, `Flip` (`-1 \| 1`), `Constraint` (`ConstraintType` h/v), `KeepAspectRatio` (snapshotted w/h). Derived (written by the transform system, never serialized): `LocalTransform`, `WorldTransform` (2D affine `a..f`), `WorldBounds` (AABB), `Culled` tag, `ConstraintCache` (parent/child dims). |
| `style.ts` | Paint and effect data: `Opacity`, `BlendMode` (`BlendModeType`), `Color` (0xRRGGBB), `CornerRadius`, `MixedCornerRadius` (TL/TR/BR/BL), `Blur`, `ScaleMode` (`ScaleModeType.COVER` default), `Effect` (`EffectType` + value; one sub-entity per effect), `Mask` (offset, inverted, smoothing = `DEFAULT_MASK_SMOOTHING` from `@diffusionstudio/assets`), `ColorStop` (offset; one entity per stop), `StrokeStyle` (width, `StrokeJoin`, `StrokeCap`, miterLimit), `Shader` (code + uniforms; compiled host lives in `ShaderHostHandle`). |
| `text.ts` | `Chars` (text content, parent node only), `TextStyle` (all fields `undefined` by default so a `TextRange` override carries only set fields; node fallbacks live in the text renderer), `TextRange` (start, end `null` = to end), `TextCache` (runtime-only `Token[][]` layout from `../utils/text`). |
| `timing.ts` | `Delay` (frames on parent timeline, may be fractional), `Trim` (source frames; `end: null` = natural end), `SourceFrameRate` (fps for frames-directory sources), `PlaybackRate`, `Workarea` (scene export window), `Playback` (playing, loop, speed), `Sequential` tag (children cannot overlap in time), `Transition` (`TransitionType` + duration, describes transition INTO the clip), `ClipHeight`, `Expanded` tag (timeline UI, persisted). |
| `audio.ts` | `Volume` (dB, 0 = unity), `Muted` tag, `Soloed` tag (runtime-only), `AudioPlayback` (maps timeline time to `AudioContext` time: `wasPlaying`, `contextOffsetInSeconds`, `timelineOffsetInSeconds`; runtime-only). |
| `motion.ts` | `KeyframeTrack` (property + denormalised `target: Entity`; one per (target, property), `ChildOf` its target), `Keyframe` (time, value, easing; `ChildOf` its track), `Animation` (`AnimationType`, duration, delay, `AnimationPhase`; preset in/out, `ChildOf` its target). |
| `derived.ts` | `Computed` — flat per-frame resolved values (position, offset, origin, rotation, scale, skew, opacity, color, blur, volume, strokeWidth, corner radii, stopOffset, width/height, chars, localTime, duration, start, end, origin, playbackRate, visibility). `Cache` — per-entity owned sub-entity lists (children, fills, shadows, strokes, effects, textRanges, clipPaths, masks, keyframeTracks, keyframes, animations). Both never serialized. |
| `media.ts` | AoS handle traits holding live runtime instances, never serialized: `ShaderHostHandle`, `ImageDecoderHandle`, `VideoDecoderHandle`, `AudioDecoderHandle`, `WaveformHandle`, `CaptionDecoderHandle`, `AudioBusHandle`, `Data` (`MountData`: props + optional `textBox` DocumentFragment). Types come from `../media/*`. |
| `interaction.ts` | Editor state: `Tool` (`ToolType.MOVE` default, world-level), tags `Selected`, `Active`, `Interactive`, `Hovering`, `Dragging`; `Timeline` (scrollX/Y, resolution, `DOMMatrix` transform); drag origins `ClipDragOrigin` (authored, start, end), `KeyframeDragOrigin` (time), `TrimDragOrigin` (start, end) so drags place at origin + delta with no accumulation. |
| `world.ts` | World-level singletons and stage traits: `Project` (id), `Stage` tag, `Root` (pointer to stage entity), `Camera` (2D affine, default a=d=0.3, e=85, f=150), `Background` (`DEFAULT_BACKGROUND = 0x161616`), `Mode` (`RuntimeMode`: `realtime` \| `offline-video` \| `offline-audio`), `Silent` tag, `Time` (now, delta), `FrameRate` (30), `RenderSurface` (canvas, ctx, resolution), `AudioEngine` (`AudioContext` \| `OfflineAudioContext`), `Fonts` (`FontSource[]`), `Library` (`AssetLibrary`), `Ai` (`GenAi`), `Tickers` (`Set<() => void>`), `FramePromises` (offline capture barrier), `HitRegions` (paint-order `HitRegion[]`). Types: `Camera2D`, `EntityTarget`, `HudTarget`, `PointerEventType`, `CanvasPointerEvent`, `DispatchedPointerEvent`, `HitRegion`. |

## How it works

- Every file calls koota `trait(...)` with a default-value object or a factory. A trait with no argument is a tag (presence = true). A factory `() => value` gives AoS storage: `entity.get(X)` returns the instance itself (handles, `Host`, `Root`, `Library`, `Ai`).
- Entities are composed, not subclassed. A node is `Geometry` + `Paint` + transform + style traits; role tags (`Group`, `Scene`, `Audio`, `Stroke`, `Shadow`, `IsClipPath`) change how systems treat it.
- Ownership is one relation: `ChildOf`. Sub-entities (fills, strokes, shadows, effects, masks, color stops, text ranges, keyframe tracks, keyframes, animations, clip paths) are `ChildOf` their target and are told apart by type tags. `packages/runtime/src/world/observers.ts` watches `ChildOf` queries and fills `Cache` lists so hot paths do not walk relations.
- Three data tiers coexist on one entity:
  - Authored (serialized): `node`, `transform`, `style`, `text`, `timing`, `audio`, `motion` value traits. `packages/runtime/src/world/serialize.ts` lists exactly which (its `EntityRecord`).
  - Derived per frame (never serialized): `Computed`, `Cache`, `LocalTransform`, `WorldTransform`, `WorldBounds`, `Culled`, `ConstraintCache`, `TextCache`, `AudioPlayback`. Observers mirror authored values into `Computed`; `systems/motion.ts` and `systems/transform.ts` overwrite them each tick; `systems/render.ts` reads them.
  - Session handles and requests (never serialized): `Host`, `media.ts` handles, `Source`, `Loop`, `*Request`, `Pending*`, `SourceError`, `Soloed`, `Data`. The asset system (`systems/assets.ts`) consumes requests and stamps `AssetId`.
- World singletons in `world.ts` are attached once by `packages/runtime/src/world/create-world.ts` (`createRuntimeWorld`), which also spawns the single `Stage` entity with `Camera` and `Background` and points `Root` at it. The host injects `RenderSurface`, `AudioEngine`, `Library`, `Ai` after creation.
- Hot paths read trait stores directly as SoA arrays via `packages/runtime/src/world/store.ts` (`store(world, Computed).opacity[entity.id()]`).
- Enum-typed fields take their values from `packages/runtime/src/constants.ts` (`GeometryType`, `PaintType`, `BlendModeType`, `EffectType`, `ConstraintType`, `AnimationType`, `TransitionType`, `CaptionType`, `ToolType`, ...).

## Interfaces

- Depends on:
  - `koota` (`trait`, `relation`, `Entity`, `World`) — the ECS library; `packages/runtime/package.json` pins `^0.6.6`.
  - `packages/runtime/src/constants.ts` — every enum used as a trait default.
  - `@diffusionstudio/jsx` (`packages/jsx`) — `AssetRef` (`GenerationRequest`), `SceneNode` (`Host`).
  - `@diffusionstudio/assets` (`packages/assets`) — `AssetLibrary` (`Library`), `DEFAULT_MASK_SMOOTHING` (`Mask`).
  - Type-only imports from siblings: `../media/*` (decoder/bus/shader/waveform/caption types), `../fonts/types` (`FontSource`), `../ai` (`GenAi`), `../math/aabb` (`Quad`), `../utils/text` (`Token`).
- Used by (all inside `packages/runtime/src` unless stated):
  - [`../world/`](../world/README.md) — `create-world.ts` attaches world traits; `observers.ts` maintains `Cache` and `Computed` mirrors; `serialize.ts` defines the serialized subset.
  - [`../systems/`](../systems/README.md) — `assets.ts`, `gradients.ts`, `motion.ts`, `playback.ts`, `render.ts`, `transform.ts` read authored traits and write derived ones.
  - [`../actions/`](../actions/README.md) — 15 files (entities, hierarchy, timing, keyframe, playback, clipboard, resize, ...) create entities and mutate authored traits.
  - [`../queries/`](../queries/README.md) — hierarchy, hit-test, interaction, timeline-index/view, predicates, camera.
  - [`../media/`](../media/README.md) — decoders, audio bus, caption presets use handle traits and `Computed`.
  - [`../utils/`](../utils/README.md), [`../fonts/`](../fonts/README.md) — text layout, sort, stroke, surface, time, transition, generating.
  - Outside the package, via `@diffusionstudio/runtime`: `apps/web` (149 files), `packages/encoder` (3), `packages/reconciler` (2).

Up: [../README.md](../README.md)
