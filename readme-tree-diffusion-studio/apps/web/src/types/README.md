# `apps/web/src/types`

Small shared type module for the web app: aspect-ratio and model-output string unions, drag-and-drop `DataTransfer` type keys, and an `Optional<T, K>` helper.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Barrel. `export * from "./common"`. |
| `common.ts` | `AspectRatio = '16:9' \| '9:16' \| '1:1' \| '4:3' \| '3:4'`; `ModelOutput = 'image' \| 'video' \| 'audio'`; `DataTransferType = { ASSET_IDS: 'asset_ids', TRANSITION: 'transition' } as const`; `Optional<T, K> = Pick<Partial<T>, K> & Omit<T, K>` (makes keys `K` optional). |

## How it works

- Pure declarations. No runtime logic except the `DataTransferType` constant object.
- Intended entry is `@/types` (tsconfig alias `@/*` -> `apps/web/src/*`).
- No file in `apps/web/src` imports `@/types`, `./types`, or `../types` pointing here (grep over `apps/web/src`). `DataTransferType` and `ModelOutput` have no other references in `apps/`. Callers that need `AspectRatio` use `apps/web/src/components/genai/schemas.ts` (`z.infer` of `aspectRatioSchema`) or `@diffusionstudio/jsx`. Module appears unused; likely legacy. Unclear from source whether it is kept on purpose.

## Interfaces

- Depends on: nothing (no imports).
- Used by: no importers found in `apps/web/src`. Parallel `AspectRatio` definitions live in [`../components/`](../components/README.md) `genai/schemas.ts` and in `@diffusionstudio/jsx` (used by [`../utils/`](../utils/README.md) `gen-ai.ts`).

Up: [../README.md](../README.md)
