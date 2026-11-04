# `docs/reference`

The authoritative API for agents: `jsx/` documents the project markup the app compiles and mounts; `tools/` documents every tool as served over MCP and the `diffusion` CLI. No `README.md` at this level in source; each subdir has its own index.

## Parts

| Part | Role |
| --- | --- |
| [jsx/](jsx/README.md) | Composition markup ("pseudo-SVG"). `README.md`: the project-as-Solid-component model, a minimal `<stage>`/`<scene>` example, a contents table, and the six-stage pipeline (Stamp → Compile → Evaluate → Mount → Resolve → Live). Pages: `module.md` (npm package entry, `id`s, types), `stage.md`, `scene.md`, `elements.md` (element→entity mapping, shared props), per-element `group.md` / `rect.md` / `text.md` / `video.md` / `image.md` / `audio.md`, `fonts.md`, `paints.md` (`<solidPaint>`, gradients, `<colorStop>`, `<imagePaint>` / `<videoPaint>`), `styles.md` (`<stroke>`, `<shadow>`, `<effect>`, `<mask src>`), `html.md`, `surface-paint.md`, `shader-paint.md` (WGSL), `media.md` (`src` resolution, `AssetRef`), `timing.md` (`start` / `end` / `sourceIn` / `sourceOut` / `playbackRate`), `keyframes.md`, `animations.md`, `transitions.md`, `sequences.md`, `adjustment-layer.md`, `audio-sync.md` (`syncTo`), `captions.md`, `generate.md` (`generate.*` declarations), `variables.md` (`@inspect` consts as inspector controls), `lifecycle.md` (`useTicker`, `useResolution`), `errors.md`. |
| [tools/](tools/README.md) | Tool catalog docs. `README.md`: the two surfaces (MCP at `http://127.0.0.1:3274/mcp`, CLI `diffusion` / `dapi`), naming rules (`_` → subcommand space, first field positional, kebab-case options), result contract (one JSON object; images as PNG paths, inline over MCP when ≤4 and ≤1 MB each), error contract (`isError: true` over MCP, stderr + exit `1` on CLI), the tool table, and shared types (`Asset`, `Time`, `NodeId`). One page per tool: `open.md`, `context.md`, `capture.md`, `check.md`, `export.md`, `models.md`, `voices.md`, `fonts.md`, `logs.md`, `screenshot.md`, `report.md`. [tools/media/](tools/media/README.md): `probe.md`, `grab.md`, `transcribe.md`, `filmstrip.md`, `waveform.md`, `listen.md`, `segment.md`. Each page: description, MCP name / CLI spelling table, Input fields, Output, Errors. |

## How it works

- `jsx/README.md` states the model: the entry file default-exports a Solid component; the app compiles it with esbuild + `babel-preset-solid` (universal mode); a `solid-js/universal` renderer mounts elements directly as ECS entities; every element has an `id` so canvas edits write back to source; a save disposes the old mount and remounts.
- `tools/README.md` states the loop: `open` a folder once, then edit files. No tool pushes content into the app. Tools read the app (`context`, `capture`, `logs`), inspect media (`media_*`), and list what a declaration may name (`models`, `voices`, `fonts`). Generation happens via `generate.*` in the module, not via a tool.
- Tool groups per `tools/README.md`: project loop (`open`, `context`, `capture`, `check`, `export`); media inspection (`media_*`, absolute paths/URLs without a project, library paths need one); masks (`media_segment` → `.mask` file for `<mask src>`); declaration lists (`models`, `voices`, `fonts`); app and machine (`logs`, `screenshot`, `report`).
- Cross-links: `tools/README.md` → `jsx/README.md`, `jsx/generate.md`, `jsx/media.md`, `jsx/timing.md`, `jsx/styles.md#mask`. `jsx/README.md` pipeline step 5 → `tools/context.md`.
- Both indexes state the pseudo-SVG rule: tags and props are the editor's own, not the SVG spec.
- Footage download: no tool; `tools/README.md` points to `yt-dlp`, and a file under the project's `assets/` folder becomes a library asset.

## Interfaces

- Depends on: `packages/dapi` (the tool catalog these pages document; tool names, fields, and schemas must match — see [../../packages/dapi/README.md](../../packages/dapi/README.md)); `packages/jsx` (the element vocabulary and `generate.*` these pages document — see [../../packages/jsx/README.md](../../packages/jsx/README.md)); `packages/reconciler` and `packages/runtime` (the pipeline `jsx/README.md` describes).
- Used by: `docs/skills/editor.md` (links both indexes); `docs/guides/` walkthroughs (tool and JSX pages); `docs/brand/` (caption presets, elements); `apps/desktop/src/projects.ts` (generated project text links the GitHub URLs of `reference/jsx/README.md` and `reference/tools/README.md`); root `README.md` lines 214–215; `packages/jsx/README.md`. Source comments cite pages: `apps/web/src/components/genai/use-transforms.ts` (`reference/jsx/generate.md`), `packages/runtime/src/media/shader.ts` (`reference/jsx/shader-paint.md`).
- Staged into the app with `docs/` by `apps/desktop/scripts/stage-docs.mjs`; MCP instructions give the on-disk docs path (see [../README.md](../README.md)).

Up: [../README.md](../README.md)
