# `apps/cli/src`

Source of the `diffusion` / `dapi` command-line binary: a thin MCP client that turns shell commands into tool calls against the running Diffusion Studio desktop app.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Entry point. Builds the `commander` program (`diffusion`), one subcommand per DAPI tool. Validates argv with the tool's zod schema from `@diffusionstudio/dapi`, calls the app, prints `structuredContent` as one JSON line. Helpers: `run()`, `describe()`, `field()`, `assetPath()`, `maskOutput()`, `numeric`, `point`, `box`, `fail()`, `appError()`. |
| `cli-client.ts` | Transport layer. `call(name, input)` opens one MCP session per call over Streamable HTTP to `MCP_URL` (`http://127.0.0.1:3274/mcp`) and returns typed `ToolOutput<N>`. Also `ping()`, `isAppDown()`, `launchApp(background)`, `waitForApp(timeoutMs)`, constant `APP_NAME`, and per-tool `TIMEOUTS` (export 1h, capture/transcribe/listen 10m, segment 1h, default 60s). |
| `mcp-proxy.ts` | `runProxy()` for `diffusion mcp`. Bridges stdio (`StdioServerTransport`) to the app's HTTP endpoint (`StreamableHTTPClientTransport`) by forwarding `JSONRPCMessage`s both ways. For agents that only spawn stdio MCP servers (Claude Desktop). Stdout is protocol; humans get stderr. |

Commands defined in `index.ts` and the DAPI tool each maps to:

| Command | Tool | Notes |
| --- | --- | --- |
| `open [path] [-b]` | `open` | Calls `launchApp()` then `waitForApp()`/`ping()`; with a path, opens/creates that folder as a project. |
| `mcp` | — | Runs `runProxy()`. |
| `context` / `ctx` | `context` | |
| `capture <id>` | `capture` | `-t --times`, `-S --separate`, `--per-sheet`, `-o --output`. |
| `export <id> [output]` | `export` | |
| `check <id>` | `check` | Bypasses `run()`; sets `process.exitCode = 1` if any issue has `severity === "error"`. |
| `media probe\|transcribe\|grab\|filmstrip\|waveform\|listen\|segment <path>` | `media_*` | Path goes through `assetPath()`: existing local file -> absolute path; else passed through as URL or library path. `segment` builds `points`/`exclude` via `point`, `box` via `box`, output via `maskOutput()`. |
| `models [type]`, `voices`, `logs`, `screenshot`, `report <title>`, `fonts` | same-named tool | Options mirror each tool's input fields. |

## How it works

- `index.ts` reads tool descriptions and field descriptions verbatim from the DAPI catalog (`toolByName(name).description`, `.input.shape[key].description`). The CLI help text is therefore generated from the shared schemas, not duplicated.
- Each command action calls `run(name, input)`: `toolByName(name).input.safeParse(input)` -> on failure `fail(z.prettifyError(...))` and exit 1 -> on success `call(name, input)` -> `console.log(JSON.stringify(output))`.
- Numeric options pass through `numeric` so zod checks numbers; malformed `x,y` / `x0,y0,x1,y1` become `NaN` so the schema emits its own error. Time strings such as `"45f"` stay strings; the schema parses them on both sides.
- Relative output paths (`-o`) are resolved with `path.resolve()` in the CLI before sending, because the app runs in a different working directory.
- `call()` in `cli-client.ts`: `connect()` creates `new Client({ name: "diffusion", version })` + `StreamableHTTPClientTransport(MCP_URL)`, calls `client.callTool(...)` with the per-tool timeout, throws the joined text blocks if `result.isError`, returns `result.structuredContent`, and closes the session in `finally`.
- `isAppDown(e)` walks up to 5 `cause` links looking for `ECONNREFUSED` / `ECONNRESET`. `appError()` in `index.ts` maps that to "Diffusion Studio is not running. Launch the app first, then retry." and exits 1.
- `launchApp(background)`: macOS runs `open -a "Diffusion Studio"` (`-g --args --hidden` when background); Windows re-spawns `process.execPath` detached only when running under Electron (`process.versions.electron`), with `--hidden` for background; other platforms return `false`. `ELECTRON_RUN_AS_NODE` is stripped from the child env so the app boots as Electron, not Node.
- `waitForApp()` polls `ping()` every 200 ms for up to 30 s while `isAppDown()` is true.
- `runProxy()`: pings; if down, `launchApp(true)` then `waitForApp()`; then wires `upstream.onmessage -> stdio.send`, `stdio.onmessage -> upstream.send`; `upstream.onclose` exits 0 (app quit), `stdio.onclose` closes upstream then exits 0 (agent quit); send failures log to stderr and exit 1.
- Final line `program.parse(process.argv, { from: "node" })`: the packaged wrapper runs the bundle on Electron with `ELECTRON_RUN_AS_NODE=1`, where commander would otherwise detect Electron and drop the script path from argv.

## Interfaces

- Depends on:
  - `packages/dapi` (`@diffusionstudio/dapi`): `MCP_URL`, `toolByName`, types `GenericTool`, `ToolName`, `ToolInput`, `ToolOutput` (`packages/dapi/src/catalog.ts`, `packages/dapi/src/mcp.ts`, `packages/dapi/src/tool.ts`). See [../../../packages/dapi/README.md](../../../packages/dapi/README.md).
  - `@modelcontextprotocol/sdk`: `Client`, `StreamableHTTPClientTransport`, `StdioServerTransport`, `JSONRPCMessage`.
  - `commander` (argv parsing), `zod` (`z.prettifyError`).
  - Root `package.json` `version` (imported as `../../../package.json`) for `--version` and the MCP client name.
  - The app's MCP server over HTTP: `apps/desktop/src/dapi/http.ts`, `apps/desktop/src/dapi/server.ts` (the endpoint `call()` and `runProxy()` talk to).
- Used by:
  - `apps/cli/package.json`: `build` bundles `src/index.ts` with esbuild to `dist/index.js` (CJS, node platform); `bin` maps `diffusion` and `dapi` to it.
  - `apps/desktop/scripts/stage-cli.mjs`: copies `apps/cli/dist/index.js` to `apps/desktop/cli/dapi.js` and writes `bin/dapi` (sh) / `bin/dapi.cmd` wrappers that run it on the app's Electron binary with `ELECTRON_RUN_AS_NODE=1`.
  - `apps/desktop/src/mcp-install.ts`: registers `<resources>/cli/bin/dapi mcp` (or `/opt/homebrew/bin/dapi` in dev) as the stdio MCP server for Claude Desktop.
  - `apps/desktop/src/cli-install.ts`, `apps/desktop/src/cli-windows.ts`: link the packaged wrapper into PATH.
  - `scripts/dev-desktop.mjs`: rebuilds this workspace on every `npm run dev:desktop`.
  - Shell users and coding agents that call `diffusion ...` / `dapi ...`.

Up: [../README.md](../README.md)
