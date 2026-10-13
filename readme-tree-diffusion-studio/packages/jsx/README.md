# `packages/jsx`

`@diffusionstudio/jsx`: the authoring surface a project's TSX is written against. Element types, pure helpers (`generate.*`, `transform.*`, `parseTime`, source-stamp constants), and hook signatures the editor replaces at mount. No renderer; published to npm.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | All library code. `index.ts` is the `.` export; `jsx-runtime.ts` is the `./jsx-runtime` and `./jsx-dev-runtime` export (type-only). |
| `src/types.ts` | Prop types per composition element: `StageProps`, `SceneProps`, `GroupProps`, `RectProps`, `VideoProps`, `ImageProps`, `AudioProps`, `TextProps`, `SequenceProps`, `CaptionsProps`, paints, `StrokeProps`, `ShadowProps`, `EffectProps`, `MaskProps`, `AnimationProps`, `KeyframeTrackProps`, `KeyframeProps`, `HtmlProps`, `SurfaceProps`, and more. Shared unions: `Time`, `Fit`, `BlendMode`, `Easing`, `AnimatableProperty`, `TransitionType`, `AnimationType`, `CaptionPreset`. `SourceProps` (`id`, `ref`). `SceneNode` (what a `ref` receives: `entity`, `native`, `tag`, `props`, `parent`, `children`, `element`). |
| `src/jsx-runtime.ts` | `declare namespace JSX`. `IntrinsicElements` = camelCase composition tags (`stage`, `scene`, `rect`, `video`, ...) + Solid HTML/SVG tags for `<htmlPaint>` content. `rect`, `text`, `image` are unions of both readings. `img.src` accepts `AssetInput`. |
| `src/generate.ts` | Declarative AI assets. `generate.image/video/voice/audio(opts)` and `transform.upscale/removeBackground/addAudio(input)` validate and return an `AssetRef`. Host accessors: `getAssetSpec`, `getAssetInputs`, `mapAssetInputs`. Wire form: `serializeAssetRef` -> `{ $asset: spec }`, `isSerializedAssetRef`. |
| `src/source.ts` | Source-stamp contract shared by compile step, host, and editor. `ID_ATTR = "id"`, `SOURCE_ATTR = "__source"` (`<file>:<id or position>`), `LOOP_ATTR = "__loop"`, `LOOP_TAGS = ["For", "Index"]`, `COMPOSITION_TAGS` (30 tags), `isCompositionTag`, `parseSource`, `formatSource`, `PropValue`, `isPropValue`. |
| `src/time.ts` | `TIME_FPS = 30`. `parseTime(value)`: number -> seconds, `"30f"` -> frames / 30, `"MM:SS"` / `"HH:MM:SS"` -> seconds. Returns `undefined` if unparsable. |
| `src/hooks.ts` | `useTicker(): Ticker` (`time`, `frame`, `delta`, `playing` accessors + `hold(promise)`) and `useResolution(): Accessor<number>`. Both throw outside a mount (`hostOnly`). |
| `src/inspect.ts` | `@inspect` JSDoc annotation contract. `INSPECT_TAG`, `INSPECT_TYPES` (`number`, `color`, `text`, `font`, `boolean`, `select`), `InspectDeclaration`, `__inspect(declaration, initial)` (throws outside a mount). |
| [scripts/](scripts/README.md) | npm pack hooks. `prepack.mjs` rewrites `package.json` `exports` to `dist/`; `postpack.mjs` restores the `src/` exports workspace consumers use. |
| `package.json` | Version `0.207.0`, `publishConfig.access: public`, `sideEffects: false`. Deps: `koota` (types). Peer: `solid-js ^1.9`. Scripts: `build` (`tsc -p tsconfig.build.json` -> `dist/`), `check`. |
| `tsconfig.build.json` | Emits `dist/` with declarations from `src/`. |
| `README.md`, `LICENSE` | npm README (types and tooling only). MPL-2.0. |

## How it works

- A project sets `jsxImportSource: "@diffusionstudio/jsx"` in its tsconfig. TypeScript resolves element and prop types from `jsx-runtime.ts`. `tsc --noEmit` and IntelliSense work with no host.
- At compile time, `apps/desktop/src/projects.ts` runs babel-preset-solid in `universal` mode with `moduleName: "@diffusionstudio/jsx"`. The specifier stays external in the bundle. `apps/desktop/src/source.ts` stamps sources and rewrites `@inspect`.
- At mount, `packages/reconciler` (`src/evaluate.ts`) binds `@diffusionstudio/jsx` to its own `JSX_RUNTIME` object (`src/runtime.ts`): this package's exports with live `useTicker`, `useResolution`, `__inspect`, and renderer operations layered on top. The npm package is never loaded at runtime.
- Pure helpers run for real in both places. `generate.*` builds an `AssetRef` value tree. Nesting is the dependency order, so cycles cannot exist. The host reads specs with `getAssetSpec` and `getAssetInputs` when the mounted tree commits.
- Source stamps close the edit loop. The compile step (`apps/desktop/src/source.ts`) stamps `SOURCE_ATTR` on every `COMPOSITION_TAGS` element and `LOOP_ATTR` on elements inside `<For>`/`<Index>`. The host stores the stamp on the entity. The editor sends it back with a `PropValue` edit (`AssetRef` goes as `SerializedAssetRef`). `apps/desktop/src/edit.ts` uses `parseSource` to split `file:locator` and writes the change into the JSX.
- `Time` is the one time type. `parseTime` converts every form to seconds; the runtime stores frames at `TIME_FPS`.
- `@inspect` on a top-level `const` becomes a `__inspect` call at compile time (`apps/desktop/src/source.ts`). The reconciler turns it into a Solid signal the inspector can move live.

## Interfaces

- Depends on: `koota` (types for `SceneNode.entity`), `solid-js` (peer; `JSX`, `Accessor` types).
- Used by:
  - [../reconciler/README.md](../reconciler/README.md): spreads these exports into `JSX_RUNTIME`; imports `LOOP_ATTR`, `SOURCE_ATTR`, `parseTime`, `AssetRef`, element prop types.
  - [../runtime/README.md](../runtime/README.md): 4 source files import from this package (types and helpers).
  - [../dapi/README.md](../dapi/README.md): `Time` parser for tool schemas.
  - `apps/web/src/` (29 files) and `apps/desktop/src/` (4 files: `source.ts` compile step, `edit.ts` and `edit-types.ts` source writer, `projects.ts` writes project `tsconfig.json` with `jsxImportSource` and pins `JSX_VERSION`).
  - External projects via npm; `docs/reference/jsx/` documents the authoring surface.

Up: [../README.md](../README.md)
