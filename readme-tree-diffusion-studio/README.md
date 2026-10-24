# `.`

Diffusion Studio: an agent-first video editor where a project is SolidJS/JSX source code, the app renders that code to an editable canvas, and agents drive the app through an MCP server and a `diffusion` CLI.

## Parts

| Part | Role |
| --- | --- |
| [apps/](apps/README.md) | Deliverables. `web/` is the editor UI (Solid + Vite). `desktop/` is the Electron shell that hosts the UI, the MCP server, project files, and agent chat. `cli/` is `diffusion` (alias `dapi`), a client of the MCP server. |
| [packages/](packages/README.md) | Shared libraries. `runtime/` (headless koota ECS world, systems, media decode, capture), `reconciler/` (mounts compiled JSX onto runtime entities), `jsx/` (element vocabulary, `generate.*`), `assets/` (`assets.yml` library), `encoder/` (offline export via mediabunny), `dapi/` (tool catalog: names + zod schemas), `agent-chat/` (Node host + protocol for Claude Code/Codex chat), `koota-solid/` (Solid bindings for koota), `sam2/` (SAM 2.1 segmentation on WebGPU). |
| [docs/](docs/README.md) | Agent-facing docs shipped with the app. `INSTRUCTIONS.md` (MCP session preamble), `skills/` (editor, watch), `reference/tools/` (one page per tool), `reference/jsx/` (composition markup), `examples/` (runnable `.tsx`), `guides/`, `brand/` (house style). |
| [.github/](.github/README.md) | CI. `workflows/release.yml` (tag `v*` builds and publishes desktop), `build-windows.yml` (manual unsigned Windows build), `bump-cask.yml` (Homebrew cask on release). |
| [scripts/](scripts/README.md) | Repo tooling. `dev-desktop.mjs` builds CLI, starts Vite on :5173, launches Electron. `release.mjs` bumps the single version in root and app `package.json`s, commits, tags. `lib/npm.mjs` runs npm cross-platform. |
| [patches/](patches/README.md) | `koota+0.6.6.patch`, applied by `patch-package` on `postinstall`. Fixes `Or(...)` matching across bitmask generations in `checkQuery` / `checkQueryTracking`. |
| `assets/` | Pure asset folder. README media only: `banner.png`, `desktop-screenshot.png`, two demo GIFs. No code. |
| `package.json` | npm workspaces root (`apps/*`, `packages/*`), version `0.207.0`, MPL-2.0. Scripts: `dev` (= `dev:desktop`), `build` (web), `make` (desktop installer), `release`, `check`/`lint`/`test` across workspaces. |
| `tsconfig.json`, `tsconfig.base.json` | Project references to `apps/web`, `apps/cli`, `apps/desktop`. Base: ES2024, strict, `noEmit`, bundler resolution. |
| `README.md`, `LICENSE` | Public repo README (product pitch, tool table, repo layout). MPL-2.0; brand assets in `apps/desktop/assets` excluded. |

## How it works

- Source is the document. A project is a folder of JSX. The root is `<stage>` with one `<scene>` per frame. Every element has an `id`.
- Desktop compiles the entry file (`apps/desktop/src/projects.ts` `compileProject`). `packages/reconciler` evaluates the bundle with Solid's universal renderer and mounts elements as koota entities in `packages/runtime`.
- `apps/web` renders the runtime world to a canvas and timeline. Canvas edits write back as props on the element with the matching `id`. Code edits recompile and redraw.
- Agents drive the app two ways. `apps/desktop/src/dapi/server.ts` serves an MCP server (`diffusion` namespace, Streamable HTTP on loopback port `3274`). `apps/cli` wraps every tool as a shell command and proxies stdio MCP to the same endpoint.
- `packages/dapi` is the single tool catalog. Desktop serves it, CLI derives commands from it, web validates against it. Main-process tools run in desktop; renderer tools are forwarded over IPC to web.
- Media tools (`media probe|grab|filmstrip|waveform|transcribe|listen|segment`, `capture`, `check`) let an agent inspect footage it cannot watch. Each returns one JSON object.
- Export: `packages/encoder` encodes runtime worlds offline via mediabunny.
- `docs/` is staged into the installed app. On connect, `apps/desktop/src/dapi/docs.ts` `instructions()` sends `INSTRUCTIONS.md` text plus the on-disk docs path. Agents read the rest as files.
- Headless mode: the first non-chat MCP session calls `enableHeadless()` (`apps/desktop/src/headless.ts`). The only effect in source: `projects.ts` `confirmCloudLocation()` logs the cloud-sync warning instead of a dialog.
- Dev loop: `npm run dev` runs `scripts/dev-desktop.mjs`. Release: `npm run release` tags; pushing the tag runs `.github/workflows/release.yml`.

## Interfaces

- Depends on: SolidJS, Vite, Electron (Forge), koota (patched), mediabunny, `@modelcontextprotocol/sdk`, zod, commander, ONNX Runtime (sam2), Sentry. `@diffusionstudio/api-contract` is an external npm package (not in this repo).
- Used by: coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI, OpenCode, Pi) over MCP; humans via the desktop app; shells and CI via `diffusion` CLI; `diffusionstudio/skills` (`npx skills add`) and `diffusionstudio/open-projects` (external repos).
- Internal dependency graph: `apps/web` -> all `packages/*`; `apps/desktop` -> `dapi`, `agent-chat`, `jsx`; `apps/cli` -> `dapi`; `reconciler` -> `runtime`, `jsx`, `assets`; `runtime` -> `jsx`, `assets`; `encoder` -> `runtime`; `dapi` -> `jsx`.
