# `packages/runtime/src`

All source of `@diffusionstudio/runtime`: the headless koota ECS editor engine (data model, world, write/read paths, per-frame systems, media decoders, helpers).

## Parts

| Part | Role |
| --- | --- |
| [traits/](traits/README.md) | Data schema. Every koota trait and the one relation (`ChildOf`): node kinds, transform, style, text, timing, audio, motion, derived stores (`Computed`, `Cache`), decoder handles, interaction tags, world singletons (`Root`, `Mode`, `Time`, `RenderSurface`, `AudioEngine`, `Library`, `Ai`, `Fonts`, `FramePromises`, `HitRegions`, ...). |
| [world/](world/README.md) | World lifecycle. `createRuntimeWorld(projectId)` attaches singletons and spawns the root stage entity; `observeWorld` wires invariants on trait add/change/remove; `store(world, trait)` gives raw SoA access; `serialize.ts` clones subtrees via `EntityRecord`. |
| [actions/](actions/README.md) | Write path. Plain `(world, ...)` functions: entity lifecycle, hierarchy, cache upkeep, timing, resize, keyframes, grouping, overlap, playback, camera, clipboard, asset binding (`getLibrary`, `getAi`, `bindAsset`). No undo or persistence. |
| [queries/](queries/README.md) | Read path. Predicates, tree walks, camera/coordinate mapping, hit tests, selection geometry, timeline index and view. No mutation. |
| [systems/](systems/README.md) | Deterministic per-frame pipeline: `assetSystem` -> `playbackSystem` -> `motionSystem` -> `transformSystem` -> `renderSystem`; `gradients.ts` helper. |
| [media/](media/README.md) | Lazy per-entity decoders over mediabunny/WebCodecs (video, image, sequence, mask, shader, HTML, waveform), Web Audio graph (`AudioBus`), offline helpers (`transcode.ts`, `audio-sync.ts`). `resolve*Decoder(world, entity)` creates and caches a handle trait. |
| [media/caption/](media/caption/README.md) | Caption presets: one `CaptionDecoder` per `CaptionType`; reads a TRANSCRIPT asset and writes text per frame. |
| [fonts/](fonts/README.md) | Web font catalog and loader: registers a font in the `Fonts` trait and the environment `FontFaceSet`. |
| [math/](math/README.md) | Pure 2D affine math: `Mat2D`, AABB, quad helpers. |
| [utils/](utils/README.md) | Pure DOM-free helpers: color, time/frame math, text layout and rendering, stroke/surface canvas helpers, transition windows, sort, generation-pulse colors (`isGenerating`). |
| `index.ts` | Package entry. Re-exports `constants`, `ai`, `traits`, `world/{create-world,observers,serialize,store}`, `queries`, `actions`, `systems`, `math`, `media`, `fonts`, `utils`. |
| `constants.ts` | Shared enums: `BlendModeType` (+ derived `COMPOSITE_OPERATIONS` canvas op strings), `StrokeJoin`, `StrokeCap`, `ScaleModeType`, `ConstraintType`, `GeometryType`, `PaintType`, `EffectType`, `MotionType`, `AnimationType`, `AnimationPhase`, `TextAlign`, `TextBaseline`, `TextCase`, `FontStyle`, `TransitionType`, `CaptionType`, `CaptionAlign`, `ToolType`. Numbers: `CONONICAL_TIME_BASE = 1e6`, `DEFAULT_DURATION_FRAMES = 16 * 30`, `MIN_CAMERA_ZOOM = 0.01`, `MAX_CAMERA_ZOOM = 10`. |
| `ai.ts` | `abstract class GenAi`: host-attached generation service, stored in the `Ai` trait. Abstract `resolve(ref: AssetRef): Promise<Asset>` (content-addressed by resolved-spec hash = `generation.key`; concurrent identical specs share one run; rejects with recorded reason for keys in error). Abstract `transcribe(world, scene, seed)` returns a TRANSCRIPT asset cached by scene id + seed. Concrete wrappers `generate.{image,video,voice,audio}` and `transform.{upscale,removeBackground,addAudio}` call `resolve` on `@diffusionstudio/jsx` `generate.*`/`transform.*` refs. |

## How it works

- `index.ts` flattens all subfolders into one public API; `package.json` `exports` also expose `./traits`, `./systems`, `./media` subpaths.
- `traits/` defines the data. `constants.ts` enums give the numeric values that traits store (`PaintType`, `GeometryType`, `AnimationType`, ...).
- `world/create-world.ts` builds a world with singleton traits and the root stage. The host fills `RenderSurface`, `AudioEngine`, `Library`, and `Ai` (a `GenAi` subclass).
- `world/observers.ts` reacts to trait events and calls `actions/` (`rebuildCaches`, time-range propagation, `propagateSize`), `media/dispose.ts`, and `systems/motion.ts` `resetAnimatedValues`.
- Hosts and the reconciler mutate the world through `actions/` and read it through `queries/`.
- Each frame, the host runs `systems/` in order. `assetSystem` calls `Library.resolve` and `GenAi.resolve`/`GenAi.transcribe`. `playbackSystem` drives `media/` decoders and `AudioBus`. `motionSystem`/`transformSystem` write `Computed` and transform stores via `world/store.ts`. `renderSystem` draws to `RenderSurface` with `utils/` text/stroke helpers, `math/`, and `media/caption/` decoders.
- `fonts/` loads font faces that `utils/text.ts` layout and `renderSystem` text drawing use.
- Offline: systems push readiness promises into `FramePromises`; the encoder awaits them per frame.

## Interfaces

- Depends on: `@diffusionstudio/jsx` (`AssetRef`, `generate`, `transform`, option types) ([../../jsx/README.md](../../jsx/README.md)); `@diffusionstudio/assets` (`Asset`, `AssetLibrary`) ([../../assets/README.md](../../assets/README.md)); `koota`, `mediabunny`, `animejs`, `colord`; browser Canvas 2D / OffscreenCanvas, WebCodecs, Web Audio, optional WebGPU.
- Used by:
  - `apps/web/src/utils/gen-ai.ts`: `EditorGenAi extends GenAi`; `attachAi(world, library)` sets the `Ai` trait.
  - `apps/web/src/engine/create-engine.ts`, `apps/web/src/engine/capture.ts`: `createRuntimeWorld`, systems.
  - `apps/web/src/engine/hud/hud-system.ts`, `apps/web/src/engine/timeline/render/clip.ts`: `isGenerating` and other helpers.
  - `packages/reconciler` ([../../reconciler/README.md](../../reconciler/README.md)), `packages/encoder` ([../../encoder/README.md](../../encoder/README.md)): per parent README.

Up: [../README.md](../README.md)
