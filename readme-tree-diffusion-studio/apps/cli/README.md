# `apps/cli`

`@diffusionstudio/cli`: the `diffusion` command (alias `dapi`), a Node binary that turns each shell command into one MCP tool call against the running Diffusion Studio desktop app, and that proxies stdio MCP to the app for agents that cannot connect by URL.

## Parts

| Part | Role |
| --- | --- |
| [src/](src/README.md) | TypeScript source. `index.ts`: commander program, one subcommand per DAPI tool, zod validation, JSON output. `cli-client.ts`: one-session-per-call MCP client over Streamable HTTP (`call`, `ping`, `launchApp`, `waitForApp`, `isAppDown`, per-tool `TIMEOUTS`). `mcp-proxy.ts`: `runProxy()` for `diffusion mcp`, pipes stdio JSON-RPC to the app's HTTP endpoint. |
| [scripts/](scripts/README.md) | `dev-link.mjs`: puts the local `dist/index.js` on PATH as `dapi` and `diffusion` (macOS symlinks in `/opt/homebrew/bin`; Windows `.cmd` shims in `%LOCALAPPDATA%\DiffusionStudio\bin`). `--remove` undoes it. |
| `package.json` | Private workspace, version `0.207.0` (shared with root), MPL-2.0. `bin`: `diffusion` and `dapi` -> `./dist/index.js`. Scripts: `build` (esbuild bundle, CJS, node platform, `chmod 755`), `check` (`tsc --noEmit`), `link` (`build` + `dev-link.mjs`), `unlink`. Deps: `@diffusionstudio/dapi`, `@modelcontextprotocol/sdk`, `commander`, `zod`. |
| `tsconfig.json` | Extends `../../tsconfig.base.json`. `lib: es2024`, `types: node`, `resolveJsonModule` (for the root `package.json` version import). Includes `src`. |
| `dist/` | Build output (`index.js`). Ignored by root `.gitignore` (`dist`). Produced by `npm run build`. |

## How it works

- Build: `npm run build` bundles `src/index.ts` with esbuild into one self-contained `dist/index.js`. No runtime `node_modules` needed.
- Commands map 1:1 to DAPI tools. `index.ts` reads each tool's description and each input field's description from `@diffusionstudio/dapi` (`toolByName`), so `--help` text comes from the shared catalog.
- Command flow: parse argv (commander) -> build the tool input object -> `toolByName(name).input.safeParse(input)` -> on failure print `z.prettifyError` and exit 1 -> `call(name, input)` -> print `structuredContent` as one JSON line. `check` also sets exit code 1 when any issue has `severity === "error"`.
- Transport: `call()` opens a new MCP `Client` (`name: "diffusion"`) on `StreamableHTTPClientTransport(MCP_URL)` (`http://127.0.0.1:3274/mcp`), calls the tool with a per-tool timeout (export and segment 1 h, capture/transcribe/listen 10 min, default 60 s), closes the session. If `result.isError`, the text blocks become the error message.
- Paths: local files that exist are sent as absolute paths (`assetPath`); other strings pass through as URLs or project library paths. Output dirs (`-o`) are resolved with `path.resolve()` because the app runs in another working directory.
- App lifecycle: `diffusion open [path]` calls `launchApp()` (macOS `open -a "Diffusion Studio"`; Windows re-spawns `process.execPath` only when running under Electron), then `waitForApp()` polls `ping()` every 200 ms up to 30 s. A refused connection (`ECONNREFUSED`/`ECONNRESET` in the error `cause` chain, `isAppDown`) prints "Diffusion Studio is not running. Launch the app first, then retry." and exits 1.
- `diffusion mcp`: `runProxy()` pings, launches the app hidden if down, then forwards `JSONRPCMessage`s between `StdioServerTransport` and `StreamableHTTPClientTransport`. Stdout is protocol; stderr is for humans. App close -> exit 0; agent close -> close upstream, exit 0.
- Packaged distribution: the desktop build stages `dist/index.js` as `<resources>/cli/dapi.js` with `bin/dapi` (sh) and `bin/dapi.cmd` wrappers that run it on the app's own Electron binary with `ELECTRON_RUN_AS_NODE=1`. `program.parse(process.argv, { from: "node" })` keeps commander from dropping the script path under Electron. `launchApp` strips `ELECTRON_RUN_AS_NODE` from the child env so the spawned app boots as Electron.
- Dev distribution: `npm run link --workspace=@diffusionstudio/cli` builds and links `dapi`/`diffusion` on PATH. `scripts/dev-desktop.mjs` rebuilds this workspace on every `npm run dev:desktop`, so the link tracks the latest code.

## Interfaces

- Depends on:
  - [../../packages/dapi/](../../packages/dapi/README.md) (`@diffusionstudio/dapi`): `MCP_URL`, `MCP_HOST`/`MCP_PORT`/`MCP_PATH` (`packages/dapi/src/mcp.ts`), `toolByName`, types `GenericTool`, `ToolName`, `ToolInput`, `ToolOutput`. The only in-repo package dependency.
  - `@modelcontextprotocol/sdk` (`Client`, `StreamableHTTPClientTransport`, `StdioServerTransport`), `commander`, `zod`, esbuild (build only).
  - Root `package.json` `version` (`../../../package.json`) for `--version` and the MCP client name.
  - At runtime: the desktop app's MCP server, [../desktop/src/dapi/](../desktop/src/dapi/README.md) (`server.ts`, `http.ts`), listening on `MCP_URL`.
- Used by:
  - [../desktop/](../desktop/README.md): `package.json` `stage:cli` (`npm --prefix ../cli run build && node scripts/stage-cli.mjs`) runs before `package`/`make`/`publish`; `scripts/stage-cli.mjs` copies `dist/index.js` to `apps/desktop/cli/dapi.js` and writes the wrappers; `src/mcp-install.ts` registers `<resources>/cli/bin/dapi mcp` (dev: `/opt/homebrew/bin/dapi`) as the stdio MCP server for Claude Desktop; `src/cli-install.ts` and `src/cli-windows.ts` link `diffusion`/`dapi` into PATH.
  - Root [../../scripts/](../../scripts/README.md) `dev-desktop.mjs` (`npm run build --workspace=@diffusionstudio/cli`). Root `tsconfig.json` project reference. Root `README.md` command table and `npm run link` instructions.
  - Shell users and coding agents: `diffusion open|context|capture|export|check|media ...|models|voices|logs|screenshot|report|fonts`, and `diffusion mcp` for stdio-only MCP hosts.

Up: [../README.md](../README.md)
