# `packages/koota-solid/src/utils`

Small helpers that let the hooks in [../hooks/](../hooks/README.md) accept either plain values or Solid accessors, and tell koota traits/pairs/worlds apart from functions.

## Parts

| Part | Role |
|---|---|
| `reactive-args.ts` | `type MaybeAccessor<T> = T \| Accessor<T>`. `access(value)`: calls it if it is a function, else returns it. `type TraitOrPair<T>`. `isRelationPair(value)`: checks the `$relationPair` marker symbol. `accessTrait(value)` (private): like `access`, but treats a function that carries `$internal` or `$relationPair` as a koota value, not an accessor. `createStableTrait(input): Accessor<TP>`: `createMemo` over `accessTrait` with custom `equals` that compares `relationOf` + `targetOf`. `relationOf` / `targetOf` (private): unwrap a pair to its `relation` and `target`, or return the trait itself and `undefined`. |
| `is-world.ts` | `isWorld(target: Entity \| World): target is World`. Type guard: `typeof target.spawn === 'function'`. |

## How it works

- Problem: koota traits and relations are themselves functions, so `typeof value === 'function'` cannot separate a trait from a Solid accessor. `accessTrait` checks for koota marker symbols (`$internal`, `$relationPair`) first and only calls the value when neither is present.
- Problem: `ChildOf(parent())` returns a new `RelationPair` object on every evaluation. `createStableTrait` wraps the input in a memo whose `equals` compares `(relation, target)` identity, so hooks re-subscribe only when the pair changes semantically.
- `access` is the generic form used for `target` arguments (entities/worlds are not functions, so a plain typeof check is safe).
- `isWorld` lets a hook accept `Entity | World` in one parameter and branch: world -> use `world[$internal].worldEntity`; entity -> use the context world.

## Interfaces

- Depends on:
  - `koota`: `$internal`, `$relationPair`, `RelationPair`, `Trait`, `Entity`, `World`.
  - `solid-js`: `createMemo`, `Accessor`.
- Used by:
  - `access`, `createStableTrait`, `MaybeAccessor`: [../hooks/](../hooks/README.md) `use-trait.ts`, `use-trait-effect.ts`, `use-has.ts`; `access`, `MaybeAccessor`: `use-tag.ts`, `use-target.ts`, `use-targets.ts`.
  - `isWorld`: `use-trait.ts`, `use-trait-effect.ts`, `use-tag.ts`, `use-has.ts`, `use-target.ts`, `use-targets.ts`.
  - `access` and `MaybeAccessor` are re-exported from `packages/koota-solid/src/index.ts`. No importer in `apps/web` uses them at time of reading (`apps/web/src/components/ui/floating-inspector.tsx` defines its own local `MaybeAccessor`).
  - `isRelationPair`, `TraitOrPair`: exported from the file, used only inside `reactive-args.ts`.

Up: [../README.md](../README.md)
