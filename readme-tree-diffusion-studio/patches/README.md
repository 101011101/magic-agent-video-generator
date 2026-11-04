# `patches`

`patch-package` diffs applied to `node_modules` after every `npm install`; currently one fix to the `koota` ECS query engine.

## Parts

| Part | Role |
|---|---|
| `koota+0.6.6.patch` | Patches `koota@0.6.6` dist files `chunk-ZWIGMIL4.js`, `index.cjs`, `react.cjs`. Changes `checkQuery()` and `checkQueryTracking()` in each. Upstream returns `false` as soon as one generation's `or` bitmask has no match. The patch collects `staticHasOr` / `staticOrMatched` across all generations and returns `false` only when an `or` group exists and no generation matched. Result: `Or(A, B)` queries succeed when the matching traits live in different bitmask generations. |

## How it works

- Root `package.json` declares `"postinstall": "patch-package"` and `devDependencies.patch-package ^8.0.1`.
- `npm install` / `npm ci` installs `koota@0.6.6` (pinned in `package-lock.json`), then `patch-package` applies this diff in place.
- The patched `checkQuery` decides whether an entity matches a query's static trait masks. `checkQueryTracking` does the same for change-tracking queries before its own `trackingGroups` loop.
- Same edit applied three times: once per distribution bundle (`chunk-ZWIGMIL4.js` for ESM, `index.cjs`, `react.cjs`).
- No other patches exist in this directory.

## Interfaces

- Depends on:
  - `patch-package` (root `package.json`), runs in `postinstall`.
  - `koota@0.6.6` installed at `node_modules/koota`.
- Used by:
  - Every workspace that imports `koota`: `packages/runtime`, `packages/reconciler`, `packages/jsx`, `packages/encoder`, `packages/koota-solid`, `packages/assets`, `apps/web` ([../packages/README.md](../packages/README.md), [../apps/web/README.md](../apps/web/README.md)).
  - `Or(...)` queries that this patch fixes, for example `Or(Geometry, Group)` in `packages/runtime/src/queries/interaction.ts`, `packages/runtime/src/actions/clipboard.ts`, `packages/runtime/src/systems/transform.ts`, and `Or(Geometry, Group, AdjustmentLayer)` in `packages/runtime/src/actions/hierarchy.ts` ([../packages/runtime/README.md](../packages/runtime/README.md)).
  - CI: `npm ci` in `.github/workflows/release.yml` and `build-windows.yml` applies the patch before building ([../.github/workflows/README.md](../.github/workflows/README.md)).

Up: [../README.md](../README.md)
