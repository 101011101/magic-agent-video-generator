# `apps/web/src/components/assets`

Solid primitive that truncates a long asset file name in the middle and expands it on demand.

## Parts

| Part | Role |
|---|---|
| `file-name.ts` | Exports `createExpandableFileName(name: Accessor<string>): ExpandableFileName`. Splits the name into `start` (first 24 chars of the base name) and `end` (last 9 chars, extension included). Sets `shouldTruncate` when the base name is longer than 24 + remaining end chars. Holds a `showFullName` signal with `toggleFullName`, `showCompleteName`, `closeFullName`. `setContainerRef` registers the element; a document `pointerdown` outside it closes the full name. |

## How it works

- Caller passes a reactive `name` accessor. `truncatedName` memo recomputes `{ shouldTruncate, start, end }` when the name changes.
- Extension is kept intact: `endLength` (9) minus extension length gives how many base chars show before it.
- `toggleFullName` is a no-op when `shouldTruncate` is false.
- While `showFullName()` is true, a `createEffect` attaches a `pointerdown` listener on `document`; a press outside `containerRef` calls `closeFullName`. Listener is removed on cleanup or when the full name closes.
- Guards `typeof document === "undefined"` for non-DOM environments.

## Interfaces

- Depends on: `solid-js` (`createSignal`, `createMemo`, `createEffect`, `onCleanup`).
- Used by: no importer found in `apps/` or `packages/` (grep for `createExpandableFileName` returns only this file). Unclear from source whether it is dead code or reserved for asset-panel file names in [../sidebar-left/](../sidebar-left/README.md).
- Types exported: none (`TruncatedName`, `ExpandableFileName` are module-local).

Up: [../README.md](../README.md)
