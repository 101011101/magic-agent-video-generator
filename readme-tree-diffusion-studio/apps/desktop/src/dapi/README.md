# `apps/desktop/src/dapi`

The desktop app's MCP server: serves the `packages/dapi` tool catalog over Streamable HTTP on loopback so agents and the `diffusion` CLI can drive the editor.

## Parts

| Part | Role |
| --- | --- |
| `server.ts` | `DapiServer` (name `diffusion`, title `Diffusion Studio`). Takes `DapiServerDeps { version, logs(), onFirstConnection(), docsDir }`. Constructor asserts every `environment: "main"` catalog tool has a key in `mainHandlers`. `start()` starts `RendererCalls` and the HTTP server; `mcpUrl()` resolves the URL or `null` when the port is taken (logged, not fatal). `createSession()` builds one `McpServer` per client and routes each tool to `runInMain()` or `renderer.call()`. |
| `http.ts` | `DapiHttpServer`. Node `http` server on `MCP_HOST:MCP_PORT`, answers only `MCP_PATH` (else 404). One `StreamableHTTPServerTransport` + `McpServer` per session, keyed by `mcp-session-id` header; unknown id -> 404 JSON-RPC `-32001`. `enableDnsRebindingProtection` with `allowedHosts` = host and `localhost` (with and without port); non-loopback Host -> 403. No auth token. Calls `onFirstConnection()` once, skipped when the URL says `?client=chat`. |
| `tools-session.ts` | `serveCatalog(session, run)`. Registers every catalog tool with the SDK (zod input/output validation), wraps results with `present()` -> `toCallToolResult()`, errors with `toErrorResult()`. Overrides `tools/list` to emit `toolJsonSchemas(tool)` (JSON Schema 2020-12) because the SDK's draft-07 output fails client validators (Claude Code rejects `outputSchema`). |
| `renderer-calls.ts` | `RendererCalls`. Runs renderer-side tools from main over Electron IPC: sends `DAPI_WIRE.CALL { id, tool, args }` to the tracked `BrowserWindow`, resolves on `DAPI_WIRE.REPLY`, sends `DAPI_WIRE.CANCEL` on abort (`DapiError("canceled")`). `ready()` waits up to 30 s for the window to finish loading. `did-start-loading`, `render-process-gone`, window `closed` fail all in-flight calls. |
| `present.ts` | `present(name, args, result)`: turns raw tool results into files + refs. `capture`/`media_grab` -> `<timecode>.png` per image in `output` or `mkdtemp(dapi-<kind>-)`; `media_filmstrip`/`media_waveform` -> one PNG via `singleFilePath()`; `screenshot` -> `diffusion-studio_<date>_<time>[-N].png`, never overwrites; `media_transcribe` -> JSON file, returns `{ path, segments, words }`; `media_segment` -> mask to `output`/temp, picture to temp; `context` -> writes each done track's contact sheet once (`trackSheets` map). `toCallToolResult()` = text + `structuredContent`, plus inline base64 images when <= `INLINE_MAX_IMAGES` (4) and each <= `INLINE_MAX_BYTES` (1 MiB). `toErrorResult()` = `isError` text. |
| `docs.ts` | `instructions(docsDir)`: the per-session MCP instructions. `INSTRUCTIONS.md` from `docsDir` verbatim, then a sentence naming the docs path on disk (skills, tool/JSX reference, guides, examples, brand kit; read-only). Falls back to `FALLBACK_INSTRUCTIONS` one-liner when nothing is staged. |
| `handler.ts` | Types for main-process tools: `MainContext { signal, logs(), version }`, `MainToolName = "logs" \| "report"`, `MainHandler<N>`, `MainHandlers`. |
| [handlers/](handlers/README.md) | The two tools that run in main: `logs` (filter/tail/clip `ctx.logs()`) and `report` (`gh issue create` on `diffusionstudio/editor`). Exports `mainHandlers`. |
| `*.test.ts` | Vitest. `http.test.ts`: real HTTP client, sessions, stale id 404, Host rebinding 403. `tools-session.test.ts`: in-memory transport, 2020-12 `$schema` on every tool, validation before run, readable errors. `present.test.ts`: file placement and inlining rules. `docs.test.ts`: instructions text and that every page `docs/INSTRUCTIONS.md` names exists. |

## How it works

- `apps/desktop/src/main.ts` constructs `DapiServer` with `version: app.getVersion()`, `logs: () => logBuffer`, `docsDir()` (`Resources/docs` packaged, repo `docs/` in dev), `onFirstConnection: enableHeadless`. `dapi.start()` runs on `whenReady`; `dapi.stop()` on `before-quit`.
- Connect: client POSTs `initialize` to `http://127.0.0.1:3274/mcp`. `DapiHttpServer.open()` calls `createSession()`, which builds a `McpServer` with `instructions(docsDir)` and `serveCatalog()`. Transport hands out a UUID session id; later requests carry it in `mcp-session-id`.
- First non-chat session: `onsessioninitialized` calls `onFirstConnection()` once -> app enters headless mode. The in-app agent chat connects with `?client=chat` and does not trigger it.
- Call: SDK validates args against the tool's zod `input`. `serveCatalog` calls `run(tool, args, signal)`:
  - `environment: "main"` -> `runInMain()` -> `mainHandlers[name](args, { signal, logs, version })`.
  - otherwise -> `RendererCalls.call()` -> `DAPI_WIRE.CALL` over IPC -> `apps/web/src/dapi` answers on `DAPI_WIRE.REPLY`.
- Result: `present()` writes any binary payload (PNG frames, masks, transcripts) to disk and replaces it with paths. `toCallToolResult()` emits JSON text + `structuredContent`, and inlines images when few and small. SDK validates `structuredContent` against the tool's `output` schema.
- Failure: handler throws -> `toErrorResult()` -> `isError: true` with the message as text, not a protocol error. `DapiError` codes from the renderer are rebuilt in `RendererCalls`.
- Cancel: client abort -> `extra.signal` -> `DAPI_WIRE.CANCEL` to renderer; window reload/crash/close rejects every in-flight call.
- Port taken: `start()` logs `[dapi] cannot serve MCP at <url>`; `mcpUrl()` resolves `null`; app keeps working without agents.

## Interfaces

- Depends on:
  - [packages/dapi/](../../../../packages/dapi/README.md) (`@diffusionstudio/dapi`): `tools`, `toolJsonSchemas`, `JSON_SCHEMA_DIALECT`, `MCP_HOST` (`127.0.0.1`), `MCP_PORT` (`3274`), `MCP_PATH` (`/mcp`), `DAPI_WIRE`, `DapiCall`/`DapiReply`/`DapiCancel`, `DapiError`, `LogEntry`, `ToolArgs`/`ToolResult`/`ToolOutput`, `TimecodedImage`, `GenericTool`, `ToolName`.
  - `@modelcontextprotocol/sdk`: `McpServer`, `StreamableHTTPServerTransport`, `ListToolsRequestSchema`, `CallToolResult`.
  - `electron`: `app`, `BrowserWindow`, `ipcMain` (renderer-calls only).
  - `node:http`, `node:fs`, `node:os`, `node:crypto`, `node:path`.
  - [docs/](../../../../docs/README.md): `INSTRUCTIONS.md` read at first session (staged by `apps/desktop/scripts/stage-docs.mjs`).
  - [apps/web/src/dapi/](../../../web/src/dapi/README.md): the renderer side that answers `DAPI_WIRE.CALL`; `apps/desktop/src/preload.ts` allowlists the three channels.
- Used by:
  - `apps/desktop/src/main.ts`: constructs, starts, stops `DapiServer`; passes `mcpUrl() + "?client=chat"` to `startAgentChat()`.
  - `apps/desktop/src/headless.ts` `enableHeadless()`: the `onFirstConnection` callback.
  - External agents registered by `apps/desktop/src/mcp-install.ts` (HTTP `MCP_URL`) and the `diffusion`/`dapi` CLI ([apps/cli/](../../../cli/README.md)) over `dapi mcp` stdio proxy or HTTP; tools appear as `mcp__diffusion__<tool>`.
  - [packages/agent-chat/](../../../../packages/agent-chat/README.md) host process: connects as `?client=chat`.

Up: [../README.md](../README.md)
