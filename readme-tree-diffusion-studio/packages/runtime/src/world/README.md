# `packages/runtime/src/world`

Creates the koota ECS world for one project, wires the runtime invariants as trait observers, gives hot paths raw SoA store access, and clones entity subtrees through plain-object records.

## Parts

| Part | Role |
| --- | --- |
| `create-world.ts` | `createRuntimeWorld(projectId)`: `createWorld(...)` with world singletons `Project({id})`, `Mode`, `Time`, `FrameRate`, `RenderSurface`, `AudioEngine`, `Fonts`, `Library`, `Ai`, `Tickers`, `FramePromises`, `HitRegions`, `Tool`, `Root`. Spawns the root entity (`Stage`, `Camera`, `Background`) and stores it in `Root`. Calls `observeWorld`. Exports `RuntimeWorld` type. |
| `observers.ts` | `observeWorld(world)`: registers every `onAdd`/`onChange`/`onRemove` subscription that keeps derived state correct. Returns a disposer. |
| `store.ts` | `store(world, trait)`: `getStore` wrapper. Runs `world.query(trait)` once when koota has not yet registered the trait, then returns the SoA arrays (indexed by `entity.id()`, no snapshots, no change events). |
| `serialize.ts` | `EntityRecord` interface (plain snapshot of one entity, one optional field per trait, plus `id`, `eid`, `ChildOf` as parent eid). `serializeEntity(entity)`, `deserializeEntity(entity, record)`, `cloneFromRecords(world, records)`, `stripMountIdentity(records)`, `cloneSubtree(world, tree)`. |

## How it works

- Host flow: `createRuntimeWorld(id)` -> host injects `world.set(RenderSurface, ...)` and `world.set(AudioEngine, ...)` -> the editor app adds its own traits (input, history, persistence, asset stores) on top.
- `observeWorld` groups subscriptions by concern:
  - Structure: `onAdd(ChildOf('*'))` -> `rebuildCaches`, `propagateSize`, `resolveConstraintOffsets`, `disconnectAudioBus`, `reactToChildAttached`, `syncStagePlayback` on child and parent. `onRemove(ChildOf('*'))` -> same rebuild plus `evictFromCaches`, `reactToChildDetached`; skipped when the parent is already destroyed.
  - Media handles: `onRemove` of `ImageDecoderHandle`, `VideoDecoderHandle`, `AudioDecoderHandle`, `CaptionDecoderHandle`, `WaveformHandle`, `ShaderHostHandle`, `AudioBusHandle` -> `dispose()` / `reset()` / `disconnect()`. `onAdd(Culled)` -> `disposeDecoders`.
  - Ordering: `onChange(Keyframe)` and `onChange(ItemIndex)` -> `rebuildCaches` on the parent (keyframes sort by frame, siblings by index).
  - Model invariants: `onAdd(Sequential)` adds `Group` and removes `Position`, `Offset`, `Rotation`, `Scale`, `Skew`, `Anchor`, `Flip`. `onAdd/onRemove(IsClipPath)` -> `refileClipPath`. `onAdd(Active)` removes `Active` from every other entity; a child that is not under `Stage` loses `Active` on attach.
  - Time ranges: `onAdd` of `Group`/`Scene`/`Audio` -> `recomputeEntityTimeRange` + `bubbleTimeRangeUp`. `onChange(Paint)` -> `reactToPaintChange`. `AssetId` and `SourceFrameRate` add/change/remove -> `reactToAssetChange`. `Delay`/`Trim`/`PlaybackRate` add/change/remove -> `propagateTimeRangeDown` + `bubbleTimeRangeUp`.
  - Authored -> `Computed` mirrors: `mirror(trait, apply)` writes the authored value into the `Computed` SoA store on add and change (`Position`, `Offset`, `Rotation`, `Scale`, `UniformScale`, `Skew`, `Opacity`, `Color`, `Blur`, `Volume`, `Effect`, `CornerRadius`, `MixedCornerRadius`, `ColorStop`, `StrokeStyle`). On remove it calls `resetAnimatedValues` so the canvas falls back to the default. `Size` mirrors through `propagateSize` and has no remove handler.
- `store()` is the read/write path for `Computed` and other SoA traits in systems and actions; observers use it for the mirrors above.
- Clone flow (copy/paste, duplicate, split-on-overlap): `serializeEntity` per entity -> `EntityRecord[]` -> `stripMountIdentity` (drops `MountScript`/`MountPath` so a same-world copy does not bind two entities to one mount) -> `cloneFromRecords`: spawns one `createEntity(world)` per record, remaps `ChildOf` eids through `eidMap`, then `deserializeEntity`.
- `deserializeEntity` adds each trait then sets only defined fields (`defined()` filter) so trait defaults survive. It attaches `ChildOf` last so the structure observers see every trait already present.
- `serializeEntity` omits `ChildOf` when the parent is the `Stage`. `EntityRecord` is not a persisted format (no storage or compatibility guarantees, per source comment).

## Interfaces

- Depends on:
  - `koota` -> `createWorld`, `getStore`, `World`, `Entity`, `Trait`.
  - `../traits` (`traits/world.ts`, `traits/interaction.ts`, node/derived traits). See [../traits/README.md](../traits/README.md).
  - `../actions/{cache,playback,timing,resize,entities}.ts` -> `rebuildCaches`, `evictFromCaches`, `refileClipPath`, `syncStagePlayback`, `reactTo*`, `*TimeRange*`, `propagateSize`, `resolveConstraintOffsets`, `createEntity`. See [../actions/README.md](../actions/README.md).
  - `../queries/hierarchy.ts` -> `getParentEntity`. See [../queries/README.md](../queries/README.md).
  - `../media/dispose.ts` -> `disposeDecoders`, `disconnectAudioBus`. See [../media/README.md](../media/README.md).
  - `../systems/motion.ts` -> `resetAnimatedValues`. See [../systems/README.md](../systems/README.md).
- Used by:
  - `apps/web/src/engine/create-engine.ts` -> `createRuntimeWorld`, `RuntimeWorld` (the editor's engine world).
  - `apps/web/src/engine/capture.ts` -> `createRuntimeWorld` (a second world for export/capture).
  - `packages/runtime/src/actions/clipboard.ts` -> `serializeEntity`, `cloneFromRecords`, `cloneSubtree`, `stripMountIdentity`, `EntityRecord`.
  - `packages/runtime/src/actions/overlap.ts` -> `cloneSubtree`.
  - `store()`: `packages/runtime/src/{systems,actions,queries,utils,media}/*` (transform, render, motion, playback, assets, gradients, cache, timing, resize, frame, group, hit-test, camera, interaction, timeline-view, caption/*), `packages/encoder/src/{encoder,image-encoder}.ts`, and `apps/web/src/engine/**` (timeline render, input, hud, align, split, group).
  - Re-exported from `packages/runtime/src/index.ts` (`@diffusionstudio/runtime`).

Up: [../README.md](../README.md)
