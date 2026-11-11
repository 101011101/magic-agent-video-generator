# `apps`

The three deliverables of the Diffusion Studio editor: the editor UI (web), the Electron shell that hosts it and serves the agent-facing MCP server (desktop), and the `diffusion` command-line client that talks to that server (cli).

## Parts

| Part | Role |
|---|---|
| [web/](web/README.md) | `@diffusionstudio/web`. SolidJS + Vite single-page app: the editor UI (canvas, timeline, sidebars, agent chat panel), project pages, auth. Runs in a browser (Vercel, `vercel.json`) or inside the desktop window. Renderer-side tool handlers in `src/dapi/`. Entry: `index.html` -> `src/index.tsx` -> `src/app.tsx`. |
| [desktop/](desktop/README.md) | `@diffusionstudio/desktop`. Electron app (electron-forge). Main process: window, project folders on disk, TSX project compilation (esbuild + babel), MCP server on a fixed loopback port (`src/dapi/`), agent-chat host process, CLI and MCP registration for agents. Entry: `src/main.ts`; bridge: `src/preload.ts`. |
| [cli/](cli/README.md) | `@diffusionstudio/cli`. Node binary `diffusion` (alias `dapi`), built with esbuild and commander. Each command is one MCP tool call to the running desktop app. `diffusion mcp` proxies stdio to the app's HTTP MCP endpoint. Entry: `src/index.ts`. |

## How it works

- One product, three surfaces. `web` is the editor. `desktop` wraps `web` and adds the filesystem, compiler, and MCP server. `cli` is a thin client for `desktop`.
- Build chain: `web` `build:desktop` emits into `apps/desktop/web/`; `desktop` `main.ts` loads `web/index.html` when packaged, or `http://localhost:5173` (Vite) in dev (`scripts/dev-desktop.mjs`). `desktop` `stage:cli` copies the built `cli/dist/index.js` into its resources as `dapi.js`.
- Runtime split: `web` detects the host with `window.desktop` (set by `desktop/src/preload.ts`). With it, `web` uses `HashRouter`, IPC (`src/lib/ipc.ts`, `@desktop/main-channels`), and on-disk projects (`src/projects/host.ts`). Without it, `web` runs as a hosted browser app (`Router`, Supabase auth) and offers desktop downloads (`src/lib/desktop-app.ts`).
- Tool catalog: `packages/dapi` defines every agent tool (name, description, zod schemas). `desktop/src/dapi/server.ts` serves the catalog as an MCP server (`McpServer`, Streamable HTTP, `MCP_URL`). Main-process tools (`logs`, `report`) run in `desktop/src/dapi/handlers/`; renderer tools are forwarded over IPC (`DAPI_WIRE`) to `web/src/dapi/bridge.ts`. `cli/src/index.ts` derives its commands and option help from the same catalog.
- Agent flow: an agent (Claude Code, Codex, Cursor, Claude Desktop) connects to `MCP_URL` directly, or runs `diffusion mcp` (`cli/src/mcp-proxy.ts`) for stdio. The first non-chat MCP session (no `?client=chat`) calls `enableHeadless()` (`desktop/src/headless.ts`); `desktop/src/projects.ts` then logs cloud-sync warnings instead of showing a dialog. `desktop/src/mcp-install.ts` writes the server into each agent's config; `desktop/src/cli-install.ts` links `diffusion` into PATH.
- Project flow: a project is a folder with `index.tsx` (`desktop/src/projects.ts` `ENTRY_FILES`). Main compiles it (esbuild, babel-preset-solid) and the renderer runs it against `@diffusionstudio/jsx` and `solid-js`. Edits from the UI write back to source; agents read and write the same files.
- In-app agent chat: `desktop/src/agent-chat.ts` forks `dist/agent-host.mjs` (esbuild bundle of `packages/agent-chat/src/bin.ts`) as an Electron `utilityProcess`; `web/src/agent-chat/` talks to it over WebSocket.
- Shared version: all three read `version` from the root `package.json` (`0.207.0`). Root scripts: `dev` -> `dev:desktop`, `build` -> web, `make` -> desktop installers.

## Interfaces

- Depends on: [../packages/](../packages/README.md) — `dapi` (tool catalog, IPC wire, `MCP_URL`), `jsx` (project JSX runtime), `agent-chat` (chat host), `runtime`, `encoder`, `reconciler`, `koota-solid`, `assets`, `sam2` (web only). Root [../scripts/](../scripts/README.md) `dev-desktop.mjs`, `release.mjs`. [../docs/](../docs/README.md) staged into desktop (`stage-docs.mjs`) as MCP instructions.
- Used by: end users (desktop installers from GitHub releases, hosted web app), external agents over MCP (`MCP_URL` or `diffusion mcp`), shell users via `diffusion` CLI.
- Path aliases: `web` imports `@desktop/*` -> `apps/desktop/src/*` (`web/vite.config.ts`); `desktop` and `cli` import `../../../package.json` for the version.

Up: [../README.md](../README.md)
