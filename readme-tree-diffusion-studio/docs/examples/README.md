# `docs/examples`

Eleven self-contained project entry files that show the `@diffusionstudio/jsx` composition API, from a basic cut to raw WebGPU on a `<surface>`. Copy one into a project folder as `index.tsx` and run `diffusion open <folder>`.

## Parts

| Part | Role |
| --- | --- |
| `README.md` | Index table (example -> feature shown), run recipe (`cp` + `diffusion open`), per-example requirements (credits, remote media, extra npm packages, babel config), typecheck note (`tsc -p examples --noEmit`). |
| `tsconfig.json` | Typecheck config for `*.tsx` here. Extends `../../tsconfig.base.json`; sets `jsx: preserve`, `jsxImportSource: @diffusionstudio/jsx`, `lib: ES2024/DOM`, `types: @webgpu/types`. |
| `01-basics.tsx` | `Basics()`: `<stage>` > `<scene>` > `<sequence>` of two remote `<video>` clips with a `dissolve` transition, `<image>` picture-in-picture overlay, `<For>`-driven `Title` components (`<text>` with fade-in/out `<animation>` children), `<audio>` music bed. Uses `Time` type. |
| `02-genai.tsx` | `GenAi()`: builds a generation graph with `generate.image` (second ref uses `refs: [keyframe]`), `generate.video` (`startFrame`), `generate.voice`, `generate.audio`. Results feed `<video src={ref}>`, `<audio src={ref}>`. `<captions preset="spotlight">` reads finished scene audio. Consumes credits. |
| `03-ticker.tsx` | `Ticker()`: `useTicker()` returns `{ time, frame }` accessors. `createMemo` derives `progress`, `angle`, `hue`, `eased`. Memos drive `<rect>` `rotation`, `cornerRadius`, `fill`, position and a `<text>` readout. No timers. |
| `04-html-in-canvas.tsx` | `PromptBox()`: `<rect>` with `<animation type="slideUp">` and `<htmlPaint>` child holding real DOM (`<div style=...>`). Typed-out prompt and cursor blink derive from `time()`. Needs Chromium html-in-canvas flag. |
| `05-anime-timeline.tsx` | `AnimeTimeline()`: paused anime.js `createTimeline` tweens plain objects `chip`, `card`. `createEffect` calls `tl.seek((time()*1000) % tl.duration)` and copies values into a `createStore`. Store drives a `<rect>` (ECS) and an `<html>` DOM card in lockstep. |
| `06-three.tsx` | `ThreeHelmet()`: `<surface ref={surfaceRef}>` exposes `SceneNode.element` (detached canvas). `onMount` creates `THREE.WebGLRenderer` (`preserveDrawingBuffer: true`), `RoomEnvironment` PBR env map, `GLTFLoader.loadAsync` of Khronos DamagedHelmet. `hold(ready)` blocks export frames until the model loads. `createEffect` sets `pivot.rotation.y` from `time()` and renders. Needs `three`. |
| `07-webgpu.tsx` | `WebgpuTriangle()`: raw WebGPU on a `<surface>`. Async `setup()` requests adapter/device, configures `el.getContext("webgpu")`, builds a render pipeline from inline WGSL (`SHADER`) with one `f32` time uniform. `hold(setup())` in `onMount`; `createSignal<Gpu>` wakes the draw `createEffect`; `onCleanup` destroys the device. |
| `08-shader-paint.tsx` | `ShaderPaintExample()`: `<video>` with `<shaderPaint wgsl={ABERRATION} uniforms={{ strength, vignette }}>` child. WGSL uses engine-provided `sampleSource(uv)` and `globals.time`; `@group(1)` uniforms bind by name. Chromatic aberration + vignette. |
| `09-inspect-variables.tsx` | `InspectVariables()`: top-level consts annotated `/** @inspect <type> path=... min= max= step= options= */` (`text`, `font`, `number`, `color`, `boolean`, `select`). Values become sidebar controls; edits update live and write back to the source. Drives `<scene fill>`, `<rect>` + `<stroke>`, `<text>`. |
| `10-typegpu.tsx` | `TypegpuCaustics()`: TypeGPU shaders in TypeScript (`'use gpu'` functions `tilePattern`, `caustics`, `rotateXY`, `mainVertex`, `mainFragment`). `tgpu.init()`, `root.createUniform`, `root.createRenderPipeline`. `@inspect` consts (`tileDensity`, `speed`, `fogColor`, `ambientColor`) read inside the draw effect reach the shader as uniforms via `hexToVec3`. Needs `typegpu`, `@typegpu/noise`, `unplugin-typegpu` babel plugin. |
| `11-redraw.tsx` | `RedrawHello()`: Redraw (WebGPU 2D renderer) on a `<surface>`. `createColor` (`PathGradient`) and `createStrokeWidth` (`HelloStroke`) declare GPU functions; `createLibrary`, `lib.makeCanvas`, `canvas.drawPath(pathGeo.segment(0, progress))`, `canvas.render`. Swapchain configured `rgba8unorm` + `STORAGE_BINDING`. `useResolution()` factor `k` resizes the bitmap and applies `canvas.scale(k)`. `@inspect` consts `period`, `strokeWidth`, `paletteSpeed`, `background`; `<surface end={period}>`. Needs vendored `redraw` tarball + `typegpu@0.11.3`. |

## How it works

- Each file default-exports one component. The component returns `<stage>` with one `<scene ... active>`.
- The editor mounts the entry file as a project (`diffusion open <folder>`). Edits to the file remount the project. `@inspect` and signal-driven uniform changes update live without remount.
- Time source: `useTicker().time()` / `frame()` are the only clocks (03, 04, 05, 06, 07, 10, 11). Derived values go through `createMemo` or `createEffect`. Same playhead gives the same frame in scrub, playback, capture, and export.
- Async readiness: examples with network or device setup (06, 07, 10, 11) pass a promise to `useTicker().hold(promise)`. Export and capture wait for it before they sample frames. A `createSignal` holding the ready GPU/renderer state wakes the draw effect.
- `<surface ref={surfaceRef}>` gives a `SceneNode` whose `.element` is a detached canvas. External renderers (three.js, WebGPU, TypeGPU, Redraw) draw into it. The engine samples that bitmap into the node box each frame.
- Generation (02): `generate.*` calls return refs that form a dependency graph. Nothing runs until commit. The engine generates in topological order and caches results in the project library.
- Progression: 01 (elements, sequences, animations) -> 02 (generated assets) -> 03 (reactive time) -> 04/05 (DOM in canvas) -> 06/07 (external renderers on `<surface>`) -> 08 (shader paint on media) -> 09 (`@inspect` controls) -> 10/11 (compile-time GPU TypeScript, `useResolution`).

## Interfaces

- Depends on:
  - `@diffusionstudio/jsx` (`packages/jsx/src/index.ts`): intrinsic elements (`stage`, `scene`, `sequence`, `video`, `audio`, `image`, `text`, `rect`, `stroke`, `animation`, `html`, `htmlPaint`, `shaderPaint`, `surface`, `captions`), `useTicker` / `useResolution` (`packages/jsx/src/hooks.ts`), `generate` (`packages/jsx/src/generate.ts`), types `Time`, `SceneNode`. See [../../packages/jsx/README.md](../../packages/jsx/README.md).
  - `solid-js` (`For`, `createMemo`, `createEffect`, `createSignal`, `onMount`, `onCleanup`, `createStore`).
  - `../../tsconfig.base.json` (via `tsconfig.json`); `@webgpu/types`.
  - Not repo dependencies (installed per project): `three` (06), `animejs` (05), `typegpu`, `@typegpu/noise`, `unplugin-typegpu` (10, 11), `redraw` tarball (11).
  - Browser features: Chromium html-in-canvas flag (04, 05), WebGPU (07, 08, 10, 11).
  - Remote media over network: 01, 06, 08. Generation credits: 02.
- Used by:
  - `README.md` (repo root, line 216) links here as "Examples".
  - `docs/skills/editor.md` links `../examples/README.md`. See [../skills/README.md](../skills/README.md).
  - `docs/reference/jsx/module.md` links `10-typegpu.tsx` as the babel-plugin example. See [../reference/jsx/README.md](../reference/jsx/README.md).
  - `apps/desktop/src/projects.ts` (line 645) links the GitHub URL of this folder in in-app text. See [../../apps/desktop/README.md](../../apps/desktop/README.md).
  - Documentation cross-refs: `../reference/jsx/README.md`, `../reference/tools/open.md`, `../reference/jsx/variables.md`, `../reference/jsx/lifecycle.md`, `../reference/jsx/html.md`.
  - Typecheck: `README.md` says `tsc -p examples --noEmit` runs as part of `npm run check`. No workspace `package.json` in the repo references `examples`; which script invokes it is unclear from source.

Up: [../README.md](../README.md)
