# `packages`

Shared npm workspace libraries (`@diffusionstudio/*`) that build the editor engine: authoring vocabulary, ECS runtime, JSX-to-entity reconciler, asset library, encoder, agent tool catalog, agent chat host, and ML segmentation. The apps in `apps/` compose these into the desktop app, web editor, and CLI.

## Parts

| Part | Role |
|---|---|
| [jsx/](jsx/README.md) | `@diffusionstudio/jsx`. Authoring surface for project sources: JSX element types (`StageProps`, `VideoProps`, ...), `generate.*` declarative AI assets, `parseTime`, source-stamp constants, and hooks (`useTicker`, `useResolution`) the editor implements at mount. Types and pure helpers only; no renderer. Published to npm. |
| [runtime/](runtime/README.md) | `@diffusionstudio/runtime`. Headless editor engine on koota ECS: traits, `createRuntimeWorld`, actions, deterministic systems (`assetSystem`, `playbackSystem`, `motionSystem`, `transformSystem`, `renderSystem`), media decoding, captions, fonts, capture. No DOM, no solid-js. |
| [reconciler/](reconciler/README.md) | `@diffusionstudio/reconciler`. Evaluates a compiled project bundle (`evaluate`), binds it to Solid's universal renderer, and reconciles the element tree onto runtime entities (`mount(code, world)`). Turns `jsx` vocabulary into `runtime` state. |
| [assets/](assets/README.md) | `@diffusionstudio/assets`. Project asset library: `assets.yml` manifest, content hashing, media probing (mediabunny), `AssetLibrary` over a host `ProjectFS`, derived cache (thumbnails, waveforms, peaks). State as solid-js signals; no koota. |
| [encoder/](encoder/README.md) | `@diffusionstudio/encoder`. Offline video/audio/image export: runs runtime systems over a capture world frame by frame and writes through mediabunny (`createEncoder`, `createImageEncoder`, `planSheet`/`composeSheet` contact sheets, `encodePng`). Needs canvas, OfflineAudioContext, SharedArrayBuffer. |
| [dapi/](dapi/README.md) | `@diffusionstudio/dapi`. Tool catalog exposed to agents: one `defineTool` per tool (18 tools; 16 `renderer`, 2 `main`) with zod input/output schemas (`open`, `context`, `capture`, `check`, `export`, `media_*`, `models`, `voices`, `logs`, `screenshot`, `fonts`, `report`). Also MCP URL constants, JSON-schema export, IPC wire types. Depends on zod and `jsx` `Time` parser only. |
| [agent-chat/](agent-chat/README.md) | `@diffusionstudio/agent-chat`. In-editor agent chat. Root export is browser-safe: protocol, client, reducer. `./host` export is Node: `createAgentHost` runs Claude Code (`ClaudeHarness`) or Codex (`CodexHarness`) and serves chats over a token- and origin-guarded WebSocket, with a `ChatStore` and injected MCP config. `bin.ts` wraps it as a program. |
| [koota-solid/](koota-solid/README.md) | `@diffusionstudio/koota-solid`. Solid bindings for koota, a port of `@koota/react`: `WorldProvider`, `useWorld`, `useQuery`, `useTrait`, `useActions`, etc. Every hook returns an `Accessor`. |
| [sam2/](sam2/README.md) | `@diffusionstudio/sam2`. SAM 2.1 video object segmentation and tracking in the browser: ONNX Runtime on WebGPU, frames decoded with mediabunny, weights fetched from pinned Hugging Face repos and cached in OPFS. Exports `loadSam2`, `Sam2Video`, `trackObject`, mask painting. |

## How it works

- Dependency graph inside `packages/` (from each `package.json`):
  - `jsx` -> koota (types only), solid-js (peer).
  - `assets` -> mediabunny, solid-js.
  - `runtime` -> `jsx`, `assets`, koota, mediabunny, animejs, colord.
  - `reconciler` -> `jsx`, `runtime`, `assets`, koota, solid-js (peer).
  - `encoder` -> `runtime`, koota, mediabunny.
  - `dapi` -> `jsx`, zod.
  - `agent-chat` -> `@anthropic-ai/claude-agent-sdk`, ws. No internal deps.
  - `koota-solid` -> koota, solid-js (peer). No internal deps.
  - `sam2` -> onnxruntime-web, mediabunny. No internal deps.
- Layering: `jsx` (vocabulary) is the base. `runtime` holds state and systems. `reconciler` bridges them. `encoder` consumes `runtime` worlds. `dapi` and `agent-chat` are agent-facing and independent of the engine.
- Project render path: project source (TSX written against `jsx` types) is compiled to a bundle -> `reconciler.mount(code, world)` evaluates it and creates entities in a `runtime` world made by `createRuntimeWorld` -> runtime systems tick playback, motion, transforms and render onto the host `RenderSurface`/`AudioEngine` -> `assets.AssetLibrary` resolves `src` references to files.
- Export path: `encoder.createEncoder` takes a capture world, drives the same runtime systems offline, and muxes frames and audio via mediabunny. `createImageEncoder` renders single PNG frames; `planSheet`/`composeSheet` build contact sheets for agent tools.
- Agent path: `dapi.catalog` is the single tool definition. The app serves it as an MCP server (`MCP_URL`), the renderer validates calls against it, the CLI derives commands from it. `agent-chat` `createAgentHost` (forked by `apps/desktop` as a `utilityProcess`) starts a Node WebSocket host that runs Claude Code or Codex against the project with that MCP config injected; the browser `client` and `reduce` render the chat.
- UI reactivity: `koota-solid` lets Solid components subscribe to koota traits and queries in the web app.
- Apps consume packages (from `apps/*/package.json`):
  - `apps/web` -> all nine packages.
  - `apps/desktop` -> `agent-chat`, `dapi`, `jsx`.
  - `apps/cli` -> `dapi`.

## Interfaces

- Depends on: external libs koota, solid-js, mediabunny, zod, onnxruntime-web, `@anthropic-ai/claude-agent-sdk`, animejs, colord. Root workspace config `package.json` (`workspaces: ["apps/*", "packages/*"]`), `tsconfig.base.json`.
- Used by: [../apps/README.md](../apps/README.md) (`apps/web`, `apps/desktop`, `apps/cli`). `packages/jsx` is also published to npm for external project authoring.
- Related docs: `docs/reference/jsx/` (jsx authoring surface), `docs/reference/tools/` (dapi tools). Note: `packages/dapi/README.md` links `docs/mcp-server.md` and `packages/jsx/README.md` links `reference/jsx/README.md`; neither path exists in this clone.

Up: [../README.md](../README.md)
