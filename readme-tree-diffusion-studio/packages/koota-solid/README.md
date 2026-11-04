# `packages/koota-solid`

`@diffusionstudio/koota-solid`: Solid bindings for the koota ECS, a port of `@koota/react`. Lets `apps/web` components subscribe to entities, traits, relations, and queries in the runtime world. Every hook returns an `Accessor`.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | All library code. `index.ts` exports `WorldProvider`, `useWorld`, `useActions`, `useQuery`, `useQueryFirst`, `useTrait`, `useTraitEffect`, `useTag`, `useHas`, `useTarget`, `useTargets`, `access`, type `MaybeAccessor`. |
| [src/world/](src/world/README.md) | `WorldContext`, `WorldProvider({ world, children })`, `useWorld()` (throws outside a provider). |
| [src/hooks/](src/hooks/README.md) | One file per hook: `useQuery`, `useQueryFirst` (query results); `useTrait`, `useTraitEffect` (trait value as signal / untracked callback); `useTag`, `useHas` (presence as `Accessor<boolean>`); `useTarget`, `useTargets` (relation targets); `useActions` (`fn(useWorld())`). |
| [src/utils/](src/utils/README.md) | `reactive-args.ts`: `MaybeAccessor<T>`, `access()`, `createStableTrait()`, `isRelationPair`. `is-world.ts`: `isWorld()`. |
| `package.json` | Version `0.1.0`, `sideEffects: false`. Deps: `koota ^0.6.6`. Peer: `solid-js ^1.9`. Script: `check`. |
| `README.md` | Usage example and list of differences from `@koota/react`. |

## How it works

- `WorldProvider` puts a koota `World` in Solid context. Hooks call `useWorld()` for it.
- Solid components run once, so each hook sets up one subscription. Reactive inputs are passed as accessors (`MaybeAccessor`): `target` may be `Entity | World` or an accessor of one; `trait` in `useTrait`, `useTraitEffect`, `useHas` may also be an accessor.
- Hook pattern (`useTrait`, `useHas`, `useTag`, `useTarget`, `useTargets`; `useTraitEffect` uses `createEffect`): `createComputed` reads `access(target)` and the stable trait (`createStableTrait`, so an identical `ChildOf(parent())` does not resubscribe), picks the world (the target itself if it is a `World`, else context), resolves the entity (`world[$internal].worldEntity` for a world target), subscribes to koota `onAdd`/`onRemove`/`onChange` filtered to that entity, seeds the signal, and `onCleanup` unsubscribes. A changed input re-runs the computed and resubscribes.
- `useQuery` keeps a sorted `QueryResult` in a signal with `equals: false`; add/remove events rebuild it.
- Signals use `equals: false` where koota returns mutated objects, so every change propagates.
- `useTraitEffect` runs its callback with `untrack`; cleanup is tied to the owning component.

## Interfaces

- Depends on: `koota` (`World`, `Entity`, `Trait`, `RelationPair`, `createQuery`, `$internal`, `$relationPair`), `solid-js` (`createContext`, `createSignal`, `createComputed`, `createEffect`, `createMemo`, `onCleanup`, `untrack`). No internal package deps.
- Used by: `apps/web/src/` (84 files import from this package) to render runtime world state in the editor UI. `apps/web/src/engine/context.tsx` mounts `WorldProvider` with `engine.world`. Main hooks: `useWorld`, `useTrait`, `useHas`, `useQuery`, `useTag`. `useQueryFirst`, `useTraitEffect`, `useTarget`, `useTargets`, `useActions`, `access` have no callers in `apps/web`. Not used by other `packages/*`.
- Related: the world it binds to is built by [../runtime/README.md](../runtime/README.md) `createRuntimeWorld`; root `patches/koota+0.6.6.patch` patches the koota it depends on.

Up: [../README.md](../README.md)
