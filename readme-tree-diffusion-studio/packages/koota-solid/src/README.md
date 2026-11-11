# `packages/koota-solid/src`

All source of `@diffusionstudio/koota-solid`: Solid hooks and a context provider that expose koota ECS world state to editor components as `Accessor` signals.

## Parts

| Part | Role |
|---|---|
| [world/](world/README.md) | `WorldContext` (Solid context of one koota `World`), `WorldProvider({ world, children })`, `useWorld()` (throws outside a provider). |
| [hooks/](hooks/README.md) | One file per hook. `useQuery`, `useQueryFirst` (query results); `useTrait`, `useTraitEffect` (trait value as signal / callback); `useTag`, `useHas` (presence as `Accessor<boolean>`); `useTarget`, `useTargets` (relation targets); `useActions` (calls `fn(world)` once). |
| [utils/](utils/README.md) | `reactive-args.ts`: `MaybeAccessor<T>`, `access()`, `createStableTrait()` (memo that keeps `ChildOf(parent())` stable when relation + target are unchanged). `is-world.ts`: `isWorld()` type guard. |
| `index.ts` | Package entry. Re-exports `useActions`, `useQuery`, `useQueryFirst`, `useTag`, `useHas`, `useTarget`, `useTargets`, `useTrait`, `useTraitEffect`, `useWorld`, `WorldProvider`, `access`, type `MaybeAccessor`. Does not export `WorldContext`, `isWorld`, `createStableTrait`. |

## How it works

- App mounts `WorldProvider` with a koota `World`. In the editor, `apps/web/src/engine/context.tsx` passes `engine.world`.
- Each hook calls `useWorld()` from `world/` once at setup.
- Target hooks read `target` with `access()` from `utils/` inside `createComputed` (`createEffect` in `useTraitEffect`). A changed accessor re-runs the body and resubscribes.
- `isWorld()` branches the target: a `World` target uses `world[$internal].worldEntity`; an `Entity` target uses the context world.
- Trait hooks (`useTrait`, `useTraitEffect`, `useHas`) pass `trait` through `createStableTrait()`, so a new but identical `RelationPair` does not resubscribe.
- Hooks subscribe to koota `world.onAdd` / `onRemove` / `onChange` (or `onQueryAdd` / `onQueryRemove` for `useQuery`), filter events to the entity, write a signal, and unsubscribe in `onCleanup`.
- `index.ts` exposes the public surface. Consumers import from `@diffusionstudio/koota-solid`.

## Interfaces

- Depends on: `koota` (`World`, `Entity`, `Trait`, `TagTrait`, `RelationPair`, `createQuery`, `$internal`, `$relationPair`); `solid-js` (`createContext`, `useContext`, `createComponent`, `createSignal`, `createComputed`, `createEffect`, `createMemo`, `onCleanup`, `untrack`).
- Used by: 84 files under `apps/web/src` import `@diffusionstudio/koota-solid`. Main hooks: `useWorld` (70 files), `useTrait` (39), `useHas` (13), `useQuery` (e.g. `apps/web/src/engine/hooks/use-selection.ts`), `useTag` (`apps/web/src/components/timeline/layers/`). `WorldProvider`: `apps/web/src/engine/context.tsx`. `useQueryFirst`, `useTraitEffect`, `useTarget`, `useTargets`, `useActions`, `access`: no callers in `apps/web`.
- Related: world built by [../../runtime/README.md](../../runtime/README.md).

Up: [../README.md](../README.md)
