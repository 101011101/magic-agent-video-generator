# `docs/reference/jsx`

Authoritative reference for the JSX composition language: the camelCase elements, props, timing, paints, generation and lifecycle a project's `index.tsx` is written in.

## Parts

| Part | Role |
| ---- | ---- |
| `README.md` | Entry. States the model: the JSX source is the document; a Solid component mounts directly into the editor's ECS; every element is an entity, every prop a component write. Lists every file below. Describes the 6-stage pipeline: Stamp (mint `id`s into source) → Compile (esbuild + `babel-preset-solid` in `universal` mode; `solid-js`, `solid-js/store`, `@diffusionstudio/jsx` external) → Evaluate (default export) → Mount (synchronous, into the live `<stage>`) → Resolve (`src` loads, `generate.*`, captions, async) → Live (reactive graph keeps running). |
| `module.md` | Project module contract. Folder scaffold (`index.tsx`, `package.json` with `projectId`, `tsconfig.json`, `assets.yml`, `assets/`, `cache/`). `id` stamping: six base-36 chars, written back to source, stripped at compile. Import categories: host modules (external), userland npm packages (bundled), local imports; no `https://` imports. Babel `plugins` from project `babel.config.json` (presets ignored). camelCase tag canonicalization; `rect`/`text`/`image` resolve lexically inside SVG containers. `jsxImportSource: "@diffusionstudio/jsx"`; compile does not typecheck. |
| `stage.md` | `<stage>`: singleton root, the infinite canvas. Props `background`, `camera` (6-value affine matrix) are editor state written back to source. Camera presets per frame size. Root-level nodes are material, not composition. |
| `scene.md` | `<scene>`: the clipped playable frame; only child of `<stage>`; owns the timeline. Props `width`/`height` (required), `x`/`y`, `fill`, `name`, `volume` (dB bus), `active` (max one, root only), `workarea`, `selected`, `timeline`, `playhead`. `workarea` is read at render; the rest is editor state. |
| `elements.md` | Element-to-entity map: structure (`stage`, `scene`, `group`, `sequence`), nodes (`rect`, `text`, `textRange`, `video`, `image`, `audio`, `captions`, `adjustmentLayer`, `html`, `surface`), paints, styles/motion sub-entities. Default box per element. Common props table: `id`, `ref`, `name`, `x`/`y`, `offsetX`/`offsetY`, `width`/`height`, `keepAspectRatio`, `constrainX`/`constrainY`, `rotation`, `scale`/`scaleX`/`scaleY`, `opacity`, `cornerRadius*`, `blendMode`, `hidden`, timing, `playbackRate`, `transition`. Editor-state props `selected`, `clipHeight`, `expanded`. |
| `group.md` | `<group>`: transform container, no box, no fill, no paints. Spans its children in time unless given `end`. Empty group = 16 s default. |
| `rect.md` | `<rect>`: `fill`, `clipPath` (old spelling `mask`). Clip paths intersect, keep own timing/transform, are never drawn or hit; default 500×500 as clip path, 100×100 otherwise. |
| `text.md` | `<text>`: `color`, `fontFamily` (default `Inter`), `fontSize`, `fontWeight`, `fontStyle`, `letterSpacing`, `textCase`, `textAlign`, `textBaseline`, `leading`. Sizes to glyphs when no box. `<textRange start end>`: per-character-run style override; stacks in document order. |
| `video.md` | `<video>`: `src`, `objectFit`, `frameRate` (image sequences only), `volume` (dB), `muted`, `syncTo`. Default 1920×1080; fits natural duration. |
| `image.md` | `<image>`: `src`, `objectFit`, `frameRate`. Default 1920×1080; still = 16 s default. |
| `audio.md` | `<audio>`: `src`, `volume`, `muted`, `syncTo`, timing; `x`/`y`/`width`/`height` only place the waveform box on the canvas. Children: `volume` keyframe track, `"gain"` animation. |
| `fonts.md` | Fonts come from the machine; discover with the `fonts` tool. `<text>` names a family via `fontFamily`; `<html>` uses CSS, may pin a variant with `@font-face` + `local()`. |
| `paints.md` | Paint sub-entities stacked in document order: `<solidPaint color>`, `<linearGradientPaint rotation>`, `<radialGradientPaint>`, `<colorStop offset color>`, `<imagePaint src>`/`<videoPaint src>`, `<htmlPaint>`, `<surfacePaint>`, `<shaderPaint>`. `fill` is shorthand for a solid paint. Media paint from `src` is intrinsic, bottom of the stack. |
| `styles.md` | `<stroke color width join cap miterLimit>`, `<shadow color blur offsetX offsetY>`, `<effect type value>` (types: `blur`, `hueRotate`, `brightness`, `contrast`, `grayscale`, `invert`, `saturate`, `sepia`, `opacity`). `<mask src sourceIn frameRate blur opacity inverted smoothing>` under an effect limits it to a tracked frame sequence's alpha. All take keyframe tracks. |
| `html.md` | `<html>` / `<htmlPaint>`: real DOM children rasterized via the html-in-canvas API. Recommended pattern: anime.js timeline with `autoplay: false`, `seek(time() * 1000)` from `useTicker`. `<img>` takes composition `src` forms. Rejected tags: `<audio>`, `<video>`, `<canvas>`. Rasterizer limits: `scale()` on large/clipped subtrees and nested fractional `opacity` blank the subtree in captures. |
| `surface-paint.md` | `<surface>` / `<surfacePaint ref>`: a canvas the project draws itself (2d/webgl/webgpu); `ref` receives `SceneNode` whose `element` is the canvas. Sampled every frame. WebGL needs `preserveDrawingBuffer: true`. Oversize the bitmap by `useResolution()`; hold async setup with `useTicker().hold`. |
| `shader-paint.md` | `<shaderPaint wgsl uniforms>`: WGSL fragment stage over the media paint directly below (post-process) or procedural without one. Prelude: `sampleSource(uv)`, `source`, `sourceSampler`, `globals.time`, `globals.resolution`, `globals.fitOffset`, `globals.fitSize`. `@group(1)` uniforms matched by name; `f32` family only. WebGPU; passthrough when unavailable or on compile error. |
| `media.md` | `src` resolution: library path (preferred), asset id (content hash), global path, remote URL, `AssetRef`. Image sequences = directory of numbered frames, duration from `frameRate`. `transform.*` chains. `assets.yml` library record (`path`, `source`, generation `state`). Add an asset by symlinking into `assets/`; imports never copy. |
| `timing.md` | `start`/`end` (parent timeline) vs `sourceIn`/`sourceOut` (source window); `playbackRate`. Rules: `end` and `sourceOut` both cap; containers span children; media fits natural duration; sourceless nodes and stills default to 16 s. `Time = number \| "${n}f" \| "MM:SS" \| "HH:MM:SS"`; internal unit is frames at 30 fps. |
| `keyframes.md` | `<keyframeTrack property>` + `<keyframe time value easing>`. Times are source-local (offset by `sourceIn`). Animatable props list. Easings: `linear`, `easeIn/Out/InOut`, springs `gentle`/`snappy`/`bouncy`/`strong`, `cubicBezier(...)`, `spring(bounce,duration)`, `steps(n)`. |
| `animations.md` | `<animation type phase duration delay>`: preset in/out. Types: `fade`, `slideLeft/Right/Up/Down`, `grow`, `shrink`, `spin`, `twist`, `blur`, text-only `appearWord`/`appearChar`/`scramble`, audio-only `gain`. Keyframes on the same prop override. |
| `transitions.md` | `transition={{ type, duration }}` on the outgoing direct child of `<sequence>`; centered on the cut. Types: `dissolve` (default), `slideFromRight`, `slideFromLeft`, `fadeToBlack`, `fadeToWhite`. Partial merges; `null` removes. |
| `sequences.md` | `<sequence>`: track-like container, no transform, no timing; children need explicit `start`; hosts transitions; non-overlap invariant in the editor. |
| `adjustment-layer.md` | `<adjustmentLayer>`: draws nothing; its transform composes onto the preceding sibling for its own `start`/`end` window. Inside a sequence it acts on what is below the sequence. |
| `audio-sync.md` | `syncTo="<id>"`: cross-correlates audio against another element, computes `start = target.start + offset`. Mutually exclusive with `start`. Runs at Resolve, cached by source pair, chains resolve in dependency order. |
| `captions.md` | `<captions src preset colors verticalAlign seed offsetX offsetY>` + timing. Transcribes the scene's audible mix after all sources land, or mounts an `.srt`/`.vtt`/`.json`. Cache key = scene id + `seed`. Presets: `classic`, `whisper`, `cascade`, `spotlight`, `paper`, `guinea`, `stark`. |
| `generate.md` | `generate.image/video/voice/audio(opts): AssetRef` and `transform.upscale/removeBackground/addAudio(input): AssetRef` from `@diffusionstudio/jsx`. Pure declarations; requested on mount; topological dependency order via `startFrame`/`endFrame`/`refs`; cached by spec key under `assets/generated/`; `pending`/`error` records in the library. |
| `variables.md` | `/** @inspect <type> ... */` on a top-level `const` literal: compiled into a signal, shown as an inspector control, value written back to the initializer. Types `number`, `color`, `text`, `font`, `boolean`, `select`; `min`/`max`/`step`/`options`/`path`/`label`. |
| `lifecycle.md` | A mount stays live; a save disposes and remounts; export/capture re-execute the module (structure must be deterministic). `useTicker()` → `time()`, `frame()`, `delta()`, `playing()`, `hold(promise)`. `useResolution()` → device pixels per composition pixel. `hold` waits frames for async work; 30 s bound; no-op live. |
| `errors.md` | Failure per pipeline stage: Compile (toast, last render kept), Evaluate/mount (document disposed, last render kept), Source resolution (per element, reason carried). Failed generations recorded as `state: error` in `assets.yml`; removing the record re-asks. Checklist for blank `<html>` captures. |

## How it works

- `README.md` is the map: it states the model and the pipeline, and links every other file by topic.
- Structural files (`module.md`, `stage.md`, `scene.md`, `elements.md`) define the tree: a module default-exports a component; `<stage>` holds `<scene>`s; scenes hold nodes; nodes hold paints, styles, tracks and animations as sub-entity children.
- Per-element files (`group.md` ... `captions.md`) list each element's own props on top of the common table in `elements.md`.
- Cross-cutting files apply to any node: `timing.md` (placement), `keyframes.md` and `animations.md` (motion), `paints.md` and `styles.md` (appearance), `media.md` and `generate.md` (where `src` bytes come from).
- Runtime files (`lifecycle.md`, `variables.md`, `errors.md`) describe what happens after mount: reactivity, write-back of editor edits into the source, and where failures surface.
- Every file cross-links with relative Markdown links; `../tools/*.md` links point at the CLI/MCP tools that operate on the same project.

## Interfaces

- Depends on:
  - `packages/jsx/src/` — the runtime the docs describe: `generate.ts`, `hooks.ts` (`useTicker`, `useResolution`), `inspect.ts` (`@inspect`), `time.ts` (`parseTime`, `TIME_FPS`), `types.ts`, `source.ts`. See [../../../packages/jsx/README.md](../../../packages/jsx/README.md).
  - `packages/runtime/src/media/shader.ts` — implements the `shader-paint.md` contract and cites it.
  - [../tools/README.md](../tools/README.md) — `open`, `capture`, `context`, `fonts`, `models`, `voices`, `logs`, `media segment` linked from these pages.
- Used by:
  - `docs/skills/editor.md:61` — agent skill page links this reference as the JSX entry point.
  - `docs/examples/README.md`, `docs/examples/05-anime-timeline.tsx`, `09-inspect-variables.tsx`, `10-typegpu.tsx`, `11-redraw.tsx` — examples cite specific pages.
  - `docs/guides/walkthroughs/talking-head.md:100` — cites `captions.md`.
  - `apps/desktop/src/projects.ts:643` — scaffolded project `README.md` links this folder on GitHub.
  - `apps/desktop/src/main.ts:130` `docsDir()` — serves `docs/` (repo copy in dev, `Contents/Resources/docs` staged by `apps/desktop/scripts/stage-docs.mjs` when packaged) so the MCP server can point agents at the installed copy.
  - `apps/web/src/components/genai/use-transforms.ts:6` — cites `generate.md` for `transform.*`.
  - Repo `README.md:215` — top-level link.

Up: [../README.md](../README.md)
