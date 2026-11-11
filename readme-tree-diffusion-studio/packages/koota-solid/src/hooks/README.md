# `packages/koota-solid/src/hooks`

Solid hooks that turn koota ECS world state (queries, traits, tags, relations) into Solid `Accessor` signals so editor components re-render when entity data changes.

## Parts

| Part | Role |
|---|---|
| `use-world.ts` (in [../world/](../world/README.md)) | Every hook here calls `useWorld()` to get the context `World`. Not a file in this dir; listed for orientation. |
| `use-query.ts` | `useQuery(...parameters: QueryParameter[]): Accessor<QueryResult<T>>`. Builds a `createQuery` ref, seeds a signal with `world.query(ref).sort()`, re-runs on `world.onQueryAdd` / `world.onQueryRemove`. Registers a reset handler in `world[$internal].resetSubscriptions` so a world reset re-subscribes. Signal uses `equals: false` (array identity does not matter). |
| `use-query-first.ts` | `useQueryFirst(...parameters): Accessor<Entity \| undefined>`. Wraps `useQuery`, returns `() => query()[0]`. |
| `use-trait.ts` | `useTrait(target, trait): Accessor<TraitRecord<T> \| undefined>`. Reads one trait (or `RelationPair`) value from an `Entity` or the `World` entity. Subscribes to `world.onChange`, `onAdd`, `onRemove` filtered to `e === entity`. Two overloads keep `T` inferable when `trait` is a plain trait vs an `Accessor`. |
| `use-trait-effect.ts` | `useTraitEffect(target, trait, callback)`. Same subscriptions as `useTrait`, but calls `callback(value)` instead of setting a signal. Initial call runs inside `untrack`. Uses `createEffect` (not `createComputed`). Same overload split. |
| `use-tag.ts` | `useTag(target, tag: TagTrait): Accessor<boolean>`. Presence of a tag trait on an entity. Subscribes to `onAdd` / `onRemove`. `tag` is not reactive (no accessor form). |
| `use-has.ts` | `useHas(target, trait: MaybeAccessor<Trait \| RelationPair>): Accessor<boolean>`. Like `useTag` but `trait` may be reactive and may be a relation pair. Special case: wildcard pair (`target === '*'`) on remove checks `entity.targetsFor(relation).length > 1` because `onRemove` fires before state cleanup. |
| `use-target.ts` | `useTarget(target, relation): Accessor<Entity \| undefined>`. First related entity via `entity.targetFor(relation)`. Subscribes to `onAdd`, `onRemove`, `onChange`. |
| `use-targets.ts` | `useTargets(target, relation): Accessor<Entity[]>`. All related entities via `entity.targetsFor(relation)`. On `onRemove`, filters the removed target out of the last value because koota fires the event before data removal. `equals: false`. |
| `use-actions.ts` | `useActions(actions: (world) => T): T`. Calls the factory once with the context world. No reactivity. |

## How it works

- Each hook resolves `world` once from `useWorld()` (see [../world/](../world/README.md)).
- Target-based hooks (`useTrait`, `useTraitEffect`, `useTag`, `useHas`, `useTarget`, `useTargets`) accept `MaybeAccessor<Entity | World | undefined | null>`. They read it with `access()` from [../utils/](../utils/README.md) inside `createComputed`, so a changed accessor re-runs the body and re-subscribes.
- If `target` is a `World` (checked by `isWorld`), the hook uses that world and its `world[$internal].worldEntity` as the entity. Otherwise it uses the context world and the given entity.
- Null/undefined target: the hook sets its signal to the empty value (`false`, `undefined`, `[]`) and skips subscription.
- Trait-based hooks (`useTrait`, `useTraitEffect`, `useHas`) pass `trait` through `createStableTrait` so a re-evaluated `RelationPair` with the same relation + target does not re-subscribe.
- Subscriptions: koota `world.onAdd / onRemove / onChange(trait, cb)` return unsubscribe functions. Hooks call them in `onCleanup`, which Solid runs both when the computed re-runs and when the owning component disposes.
- Event callbacks filter by `e === entity` because koota events are per-trait, not per-entity.
- `useQuery` is the only hook that does not take a `target`; its parameters are fixed at creation (not reactive). It also handles world reset via `resetSubscriptions`.
- Solid components run once, so hooks are created once. The return value is always an `Accessor`; callers invoke it (`pos()`) inside JSX / memos / effects to track.

## Interfaces

- Depends on:
  - `koota` (v0.6.6): `World`, `Entity`, `Trait`, `TagTrait`, `Relation`, `RelationPair`, `TraitRecord`, `QueryParameter`, `QueryResult`, `createQuery`, symbols `$internal`, `$relationPair`.
  - `solid-js`: `createSignal`, `createComputed`, `createEffect`, `onCleanup`, `untrack`, `Accessor`.
  - [../world/use-world.ts](../world/README.md): `useWorld()`.
  - [../utils/](../utils/README.md): `access`, `createStableTrait`, `MaybeAccessor`, `isWorld`.
- Used by (re-exported from `packages/koota-solid/src/index.ts` as `@diffusionstudio/koota-solid`):
  - `useTrait`: 39 files in `apps/web/src`, e.g. `apps/web/src/engine/library.ts`, `apps/web/src/engine/camera-controller.tsx`, `apps/web/src/components/ui/fill-item.tsx`, `apps/web/src/components/timeline/layers/layers.tsx` (`useTrait(world, FrameRate)`), most files under `apps/web/src/components/sidebar-right/inspector/`.
  - `useHas`: 13 files, e.g. `apps/web/src/components/ui/keyframe.tsx`, `apps/web/src/components/sidebar-right/inspector/effects-inspector.tsx`, `apps/web/src/components/sidebar-right/inspector/audio.tsx`.
  - `useQuery`: `apps/web/src/engine/hooks/use-selection.ts` (`useQuery(Selected)`), `apps/web/src/engine/hooks/use-active-scene.ts` (`useQuery(Active)`), `apps/web/src/components/sidebar-right/soundboard/soundboard.tsx`, `apps/web/src/components/canvas/scene-init-overlay.tsx`, `apps/web/src/components/sidebar-left/project-menu/file-menu.tsx`, `apps/web/src/components/ui/color-opacity-picker.tsx`.
  - `useTag`: `apps/web/src/components/timeline/layers/{sub-item,node,layer,keyframe}.tsx` (tags `Hovering`, `Selected`, `Muted`, `Soloed`, `Hidden`).
  - `useQueryFirst`, `useTraitEffect`, `useTarget`, `useTargets`, `useActions`: exported, no callers in `apps/web` at time of reading.

Up: [../README.md](../README.md)
