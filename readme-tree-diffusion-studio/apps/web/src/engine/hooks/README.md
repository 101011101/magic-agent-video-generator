# `apps/web/src/engine/hooks`

Solid hooks that give UI components reactive reads (and a few writes) of editor state on the koota world, so panels never import the Engine object.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every hook below except `use-document.ts`. Re-exported again by `apps/web/src/engine/index.ts`. |
| `use-editor.ts` | `useEditor(): DocumentEditor`. Returns `getDocumentEditor(useWorld())` from `../editor.ts`. The one write path for prop edits, inserts, select/deselect; edits report back to the JSX source. |
| `use-derived.ts` | `useDerived<T>(read, equals?)`. Samples `read` once per engine tick via `Engine.frame` (`../create-engine.ts`), inside `untrack`, wrapped in `createMemo`. Notifies only when the sample changes (`===` or custom `equals`). Needed for state systems write without events (Computed store, `store()` writes) that `useTrait` cannot follow. |
| `use-selection.ts` | `useSelection()`. `useQuery(Selected)` split into `nodes` (entities with `Geometry`, `Group` or `AdjustmentLayer`), `keyframes` (entities with `Keyframe`), `first` (first node or null). Read only; write via `useEditor().select/deselect/clearSelection`. |
| `use-asset-selection.ts` | `useAssetSelection()`. Reads/writes the `AssetSelection` trait (`../traits.ts`). Returns `id`, `asset` (found in `library().list()`), `partial` (found in `library().partials()`, a generation without bytes yet), `select(next: Asset \| PartialAsset \| string \| null)`. Uses `useLibrary` from `../library.ts`. |
| `use-tool.ts` | `useTool(): Accessor<ToolType>`. `useTrait(world, Tool)`; defaults to `ToolType.MOVE`. Write with `world.set(Tool, { value })`. |
| `use-object-mask-tool.ts` | `useObjectMaskTool()`. Reads/writes the `ObjectMaskTool` trait (`../traits.ts`). Returns `mode` (default `'points'`), `op` (default `'add'`), `brushRadius` (default `0`), `set(Partial<{mode, op, brushRadius}>)`. Types from `../object-mask/store.ts`. |
| `use-timeline-index.ts` | `useTimelineIndex(): Accessor<TimelineIndexValue>`. `useDerived` over `getActiveEntity(world)` + `buildTimelineLayers(world, root)` from `@diffusionstudio/runtime`. Custom `equals` = same root and `sameLayers()` (field-by-field compare of `entity`, `kind`, `expanded`, `expandable`, recursive `children`), so the DOM layer column re-renders only when the tree shape changes. |
| `use-camera.ts` | `useCamera(): Accessor<Camera2D \| undefined>`: `useTrait(world.get(Root), Camera)`. `useCameraScale(): Accessor<number>`: `Math.hypot(a, b)` of the camera matrix (1 = 100%). Write via operations in `../camera.ts`. |
| `use-active-scene.ts` | `useActiveScene(): Accessor<Entity \| null>`. First entity of `useQuery(Active)`. Write via `useEditor().activate(...)`. No callers outside this dir. |
| `use-document.ts` | `useDocument()`. Returns `() => getRuntimeDocument(world)` from `@diffusionstudio/reconciler`. Not in `index.ts`; no callers found in `apps/web/src`. |

## How it works

- `EngineProvider` (`../context.tsx`) mounts `WorldProvider` from `@diffusionstudio/koota-solid`. Every hook calls `useWorld()` to get that world.
- Trait-backed state (`Tool`, `Camera`, `AssetSelection`, `ObjectMaskTool`) uses `useTrait`. Query-backed state (`Selected`, `Active`) uses `useQuery`. Both react to koota change events.
- State written without events goes through `useDerived`. `Engine.frame` ticks after the systems run each frame; `useDerived` re-samples on that tick and compares before notifying.
- `useTimelineIndex` composes `useDerived` with a structural comparator so a fresh object tree per frame does not cause a re-render.
- Writes that must reach the JSX source (selection, activation, props) go through `useEditor()`. Writes that are editor-only state (tool, asset pick, mask brush) go through `world.set(...)`.

## Interfaces

- Depends on:
  - `@diffusionstudio/koota-solid` (`packages/koota-solid/src/hooks/use-trait.ts`, `use-query.ts`, `world/use-world.ts`): `useTrait`, `useQuery`, `useWorld`.
  - `@diffusionstudio/runtime` (`packages/runtime/src/traits/interaction.ts`, `traits/world.ts`, `queries/timeline-index.ts`, `actions/frame.ts`): `Active`, `Selected`, `Tool`, `ToolType`, `Camera`, `Root`, `Geometry`, `Group`, `AdjustmentLayer`, `Keyframe`, `buildTimelineLayers`, `getActiveEntity`, `TimelineIndexValue`, `TimelineNode`.
  - `@diffusionstudio/reconciler` (`packages/reconciler/src/document.ts`): `getRuntimeDocument`.
  - `@diffusionstudio/assets`: `Asset`, `PartialAsset` types.
  - [`../context.tsx`](../README.md): `useEngineContext().frame`.
  - [`../create-engine.ts`](../README.md): `Engine.frame` signal.
  - [`../editor.ts`](../README.md): `getDocumentEditor`, `DocumentEditor`.
  - [`../traits.ts`](../README.md): `AssetSelection`, `ObjectMaskTool`.
  - [`../library.ts`](../README.md): `useLibrary`.
  - [`../object-mask/store.ts`](../object-mask/README.md): `ObjectMaskMode`, `ObjectMaskOp`.
- Used by:
  - `useEditor`: most inspector panels under `apps/web/src/components/sidebar-right/inspector/`, `apps/web/src/components/genai/*` (prompt input, generate hooks, auto captions, transforms), `apps/web/src/components/timeline/layers/*`, `apps/web/src/components/canvas/draw-overlay.tsx`, `scene-init-overlay.tsx`, `apps/web/src/components/sidebar-left/project-menu/edit-menu.tsx`, `apps/web/src/components/ui/fill-item.tsx`, `ui/keyframe.tsx`, `apps/web/src/engine/camera-controller.tsx`.
  - `useDerived`: inspector panels (`animations`, `appearance`, `fills`, `strokes`, `shadows`, `effects`, `text`, `time`, `transform/*`, `export`, `source`, `object-mask`, `clip-paths`), `apps/web/src/components/canvas/clip-path-bar.tsx`, `object-mask-bar.tsx`, `apps/web/src/components/timeline/layers/keyframe.tsx`, `layers.tsx`, `apps/web/src/components/sidebar-right/soundboard/soundboard.tsx`, `apps/web/src/engine/object-mask/use-object-masks.ts`.
  - `useSelection`: `apps/web/src/components/sidebar-right/inspector/inspector.tsx`, `apps/web/src/components/genai/selection.ts`, `genai/use-auto-captions.tsx`, `apps/web/src/components/sidebar-left/project-menu/edit-menu.tsx`, `object-menu.tsx`, `view-menu.tsx`.
  - `useAssetSelection`: `apps/web/src/components/sidebar-left/assets.tsx`, `apps/web/src/components/sidebar-right/inspector/inspector.tsx`, `inspector/asset-info.tsx`.
  - `useTool`: `apps/web/src/components/canvas/toolbar.tsx`, `canvas/draw-overlay.tsx`, `apps/web/src/components/sidebar-right/inspector/inspector.tsx`, `inspector/text.tsx`.
  - `useObjectMaskTool`: `apps/web/src/components/canvas/object-mask-bar.tsx`.
  - `useTimelineIndex`: `apps/web/src/components/timeline/layers/layers.tsx`, `layers/context.tsx`, `apps/web/src/components/sidebar-right/soundboard/soundboard.tsx`.
  - `useCameraScale`: `apps/web/src/components/sidebar-right/inspector/inspector-header.tsx`.
  - `useActiveScene`, `useCamera`, `useDocument`: no callers found in `apps/web/src` outside this dir.

Up: [../README.md](../README.md)
