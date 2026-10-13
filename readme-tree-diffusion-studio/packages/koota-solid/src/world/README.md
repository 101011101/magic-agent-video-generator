# `packages/koota-solid/src/world`

Solid context that carries one koota `World` down the component tree so every hook can find the ECS world without prop drilling.

## Parts

| Part | Role |
|---|---|
| `world-context.ts` | `WorldContext = createContext<World>()`. The raw Solid context object. Not exported from the package index. |
| `world-provider.ts` | `WorldProvider(props: { world: World; children?: JSX.Element }): JSX.Element`. Renders `WorldContext.Provider` via `createComponent` with getter-based `value` and `children` so both stay reactive to prop changes. |
| `use-world.ts` | `useWorld(): World`. Reads `WorldContext`; throws `Error('Koota: useWorld must be used within a WorldProvider')` when no provider is above. |

## How it works

- App creates a koota world (in the editor: `engine.world` from `apps/web/src/engine/create-engine.ts`) and mounts `<WorldProvider world={world}>` around the UI.
- Any descendant component or hook calls `useWorld()` to get that `World`.
- The hooks in [../hooks/](../hooks/README.md) call `useWorld()` once at setup; they then use `world.query`, `world.onAdd/onRemove/onChange`, `world.onQueryAdd/onQueryRemove`, and `world[$internal]` on the result.
- `useWorld` fails fast (throws) instead of returning `undefined`, so a hook used outside the provider errors at creation, not on first event.

## Interfaces

- Depends on:
  - `koota`: `World` type.
  - `solid-js`: `createContext`, `useContext`, `createComponent`, `JSX`.
- Used by:
  - `useWorld`: every hook in [../hooks/](../hooks/README.md); re-exported from `packages/koota-solid/src/index.ts`; imported directly in 70 files under `apps/web/src`, e.g. `apps/web/src/pages/editor.tsx`, `apps/web/src/context/timeline.tsx`, `apps/web/src/engine/hooks/use-timeline-index.ts`, `apps/web/src/engine/object-mask/use-object-masks.ts`, `apps/web/src/engine/library.ts`, `apps/web/src/components/timeline/timeline.tsx`.
  - `WorldProvider`: one caller, `apps/web/src/engine/context.tsx` (`EngineProvider` wraps children in `<WorldProvider world={engine.world}>` inside its own `EngineContext.Provider`).
  - `WorldContext`: internal to this dir (`use-world.ts`, `world-provider.ts`).

Up: [../README.md](../README.md)
