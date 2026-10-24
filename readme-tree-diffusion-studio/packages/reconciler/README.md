# `packages/reconciler`

`@diffusionstudio/reconciler`: evaluates a compiled project bundle, binds it to Solid's universal renderer, and reconciles the element tree onto koota entities in a `@diffusionstudio/runtime` world. `mount(code, world)` turns `jsx` vocabulary into `runtime` state and keeps it live.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | All library code. `index.ts` exports `mount`, `evaluate`, `collectInspect`, `renderProject`, `insert`, `withDocument`, `JSX_RUNTIME`, everything in `document.ts` and `elements.ts`, types `ProjectDocument`, `ProjectTick`, `Mount`, `InspectEntry`. |
| `src/mount.ts` | `mount(code, world): Mount`. Evaluates the bundle inside `collectInspect`, creates a `RuntimeDocument`, calls `renderProject`, registers `document.advanceTicker` in the world's `Tickers`. `Mount.dispose()` removes the ticker, disposes the Solid graph, destroys entities. `Mount.inspect` lists `@inspect` signals. |
| `src/evaluate.ts` | `evaluate(code)`: runs a CommonJS bundle with `new Function("require", "module", "exports", code)`. `require` resolves only `solid-js`, `solid-js/store`, and `@diffusionstudio/jsx` (-> `JSX_RUNTIME`). Returns `module.exports.default`; throws if not a function. |
| `src/runtime.ts` | `JSX_RUNTIME`: `{ ...authoring jsx exports, ...elements, render, effect, memo, createComponent, createElement, createTextNode, insertNode, insert, spread, setProp, mergeProps, use, useResolution, useTicker, __inspect }`. Renderer bindings come last so they win. |
| `src/renderer.ts` | Module-level singleton from `solid-js/universal` `createRenderer`. Each host op forwards to the active `ProjectDocument` (Solid context or `currentDocument`). Live `useTicker` (memos over `document.tick()`, `hold` from `document.hold`), live `useResolution` (memo over `document.resolution()`, default 1), `use` (routes `ref` through `document.applyRef` when present), `withDocument`, `renderProject`. |
| `src/host.ts` | `ProjectDocument<N>` interface: `stage`, `createElement`, `createTextNode`, `replaceText`, `isTextNode`, `setProperty`, `insertNode`, `removeNode`, `getParentNode`, `getFirstChild`, `getNextSibling`; optional `tick`, `hold`, `resolution`, `applyRef`. `ProjectTick` = `{ time, frame, delta, playing }`. |
| `src/document.ts` | `RuntimeDocument implements ProjectDocument<SceneNode>` over a koota `World` (1928 lines). `createElement` maps PascalCase tags to entities with runtime traits; lowercase tags become real DOM nodes under `<html>`/`<htmlPaint>`. `setProperty` writes each prop to traits (`Source`, `Loop`, `Name`, `Selected`, `Active`, `Position`, `Size`, `Paint`, `Keyframe`, ...). `insertNode` keeps `ChildOf` and `ItemIndex` in order; text nodes under `<text>` become `Chars`. `tick`, `resolution`, `hold` (30 s timeout, pushes onto `FramePromises`), `advanceTicker` (reads `Computed.localTimeInSeconds` of the nearest `Playback` carrier above the active scene). `dispose` destroys every non-excluded entity. Also: `createRuntimeDocument(world)` (one per world, throws if one exists), `getRuntimeDocument(world)`, `authoredElement`/`authoredTree` (entity back to authored JSX), `isSceneNode`, enum maps `BLEND_MODES`, `TRANSITION_TYPES`, `EASINGS`, `ANIMATION_TYPES`, `CAPTION_PRESETS`, `CAPTION_ALIGNS`, `EFFECT_TYPES`, `HORIZONTAL_CONSTRAINTS`, `VERTICAL_CONSTRAINTS`, `trackProperty`, `trackPropertyPath`. |
| `src/elements.ts` | PascalCase components `Stage`, `Scene`, `Group`, `Rect`, `Video`, `Image`, `Audio`, `Text`, `TextRange`, `Sequence`, `Captions`, `AdjustmentLayer`, paints, `Stroke`, `Shadow`, `Effect`, `Mask`, `Animation`, `KeyframeTrack`, `Keyframe`, `HtmlPaint`, `Html`, `ShaderPaint`, `SurfacePaint`, `Surface`. Each is `hostElement(tag)`: `createElement`, route `ref` via `use`, `spread` the rest. Compile target of `canonicalizeTagsPlugin` (`apps/desktop/src/source.ts`, camelCase -> PascalCase) and ABI of persisted bundles. `renderAuthored(tree)` rebuilds host nodes from an `AuthoredTree` (used to duplicate subtrees). |
| `src/inspect.ts` | Live `__inspect(declaration, initial)`: creates `get`/`set` and `committed`/`commit` signals, pushes an `InspectEntry` (`file`, `name`, `type`, `label`, `group`, `min`, `max`, `step`, `options`) into the list `collectInspect(fn)` is collecting. |
| `package.json` | Version `0.1.0`, `sideEffects: false`. Deps: `@diffusionstudio/assets`, `@diffusionstudio/jsx`, `@diffusionstudio/runtime`, `koota`. Peer: `solid-js ^1.9`. Script: `check`. |

## How it works

- Input is a CommonJS bundle produced by `apps/desktop/src/projects.ts` (babel-preset-solid `universal`, `moduleName: "@diffusionstudio/jsx"`, plus source-stamp, tag-canonicalize, and inspect plugins). Composition tags arrive PascalCase; DOM content under `<htmlPaint>` stays lowercase.
- `mount(code, world)`:
  1. `collectInspect(() => evaluate(code))` runs the bundle; every `__inspect` call registers an `InspectEntry`; the default export is the root component.
  2. `createRuntimeDocument(world)` wraps the world's `Root` entity as `document.stage` (a `SceneNode` stored in the `Host` trait).
  3. `renderProject(component, document)` runs Solid's `render` under a `DocumentContext.Provider`. Every `createElement`/`setProperty`/`insertNode` from the compiled code lands in `RuntimeDocument`, which creates entities and sets traits. No intermediate tree.
  4. `document.advanceTicker` joins the world's `Tickers`. The runtime `playbackSystem` calls it once per tick; `useTicker` memos update; project effects re-run before motion and render systems read the world.
- Solid reactivity is shared: the bundle gets the app's `solid-js` instance from `evaluate`, so one reactive graph spans app and project. An inspector `set` on an `InspectEntry` updates entities without a remount.
- `ref` on a composition element receives the `SceneNode` (`entity`, `tag`, `props`, `element`). A `<surface>` ref's `element` is the backing canvas.
- Realtime vs offline: `resolution()` returns 1 when `Mode` is `realtime`, else `RenderSurface.resolution`. `hold` is a no-op when the `FramePromises` list is null (realtime); offline it delays the frame until the promise settles or 30 s pass.
- One mount per world. `createRuntimeDocument` throws if a document exists; `dispose` the old `Mount` first.
- Reverse direction: `authoredTree(world, entity)` reads `Host.tag`/`Host.props` back into authored form; `renderAuthored` re-renders such a tree into the active document.

## Interfaces

- Depends on:
  - [../jsx/README.md](../jsx/README.md): authoring exports spread into `JSX_RUNTIME`; `SOURCE_ATTR`, `LOOP_ATTR`, `parseTime`, `AssetRef`, prop types.
  - [../runtime/README.md](../runtime/README.md): traits (`Host`, `Root`, `Source`, `Playback`, `Computed`, `Tickers`, `FramePromises`, `Mode`, `RenderSurface`, ...), `createEntity`, `appendChild`, `bindAsset`, `getActiveEntity`, enums.
  - [../assets/README.md](../assets/README.md): `DEFAULT_MASK_SMOOTHING`.
  - `koota` (`World`, `Entity`, `IsExcluded`), `solid-js`, `solid-js/universal`, `solid-js/web` (`SVGElements`).
- Used by:
  - `apps/web/src/pages/editor.tsx` and `apps/web/src/engine/capture.ts` call `mount(code, world)`.
  - 41 files in `apps/web/src/` import from this package (inspector enum maps, `authoredTree`, `renderAuthored`, `getRuntimeDocument`, `insert`, `withDocument`, `InspectEntry`).
  - Bundle producer: `apps/desktop/src/projects.ts` (`compileProject`).

Up: [../README.md](../README.md)
