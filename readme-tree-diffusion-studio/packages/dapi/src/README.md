# `packages/dapi/src`

Source of `@diffusionstudio/dapi`: the typed agent tool catalog plus the shared contract (tool shape, time parsing, errors, MCP address, JSON Schema export, IPC wire) that the desktop server, web renderer, and CLI import. Definitions only; no handlers.

## Parts

| Part | Role |
|---|---|
| [tools/](tools/README.md) | One `defineTool({...})` file per tool (18 tools: 16 `renderer`, 2 `main` — `logs`, `report`). Each has name, title, agent description, zod `input` / `output` / optional `result`, `environment`. |
| `index.ts` | Only package entry. Re-exports `defineTool`, catalog API, `Time`, errors, `MAX_FRAMES_PER_SHEET`, `Bytes`, MCP constants, `toolJsonSchemas`, `DAPI_WIRE`, per-tool constants (`FRAME_CAP`, `SEGMENT_MODELS`, `WEAK_IOU`, `ISSUE_LOG_TAIL`, `LOG_TAIL`, `LOG_MESSAGE_MAX`, `FONT_LIMIT`). Defines named types: `LogEntry`, `ImageRef`, `CheckIssue`, `ExportSettings`, `ModelInfo`, `TranscriptSegment`, `FontFamily`, etc., and per-tool `*Request` / `*Result` aliases (`MediaFrameRequest` = `ToolArgs<"media_grab">`). |
| `tool.ts` | `Tool<Name, Input, Output, Result>` interface (`name`, `title`, `description`, `input: ZodObject`, `output: ZodObject`, `result?`, `environment`). `Environment = "renderer" \| "main"`. `GenericTool` (erased). `defineTool`: identity that keeps the literal name and exact schema types. |
| `catalog.ts` | `catalog` tuple in listing order: project loop (`open`, `context`, `capture`, `check`, `export`), `media_*`, then `models`, `voices`, `logs`, `screenshot`, `fonts`, `report`. Derives `AnyTool`, `ToolName`, `ToolByName<N>`, `ToolInput<N>` (caller side), `ToolArgs<N>` (parsed), `ToolOutput<N>`, `ToolResult<N>` (`result` if declared, else output). `toolByName`, `isToolName` (Map lookup), `tools: readonly GenericTool[]`. |
| `schemas.ts` | Shared zod blocks, not tools: `NodeId`, `SceneId` (support `file:id`), `AssetPath`, `Bytes` (`Uint8Array`), `TimecodedImage` (`timecode` + `png`), `ImageRef` (`timecode` + `path`), `outputDirField`, `sheetFields` + `checkSheetOptions`, `windowFields` + `checkWindow`, `LogLevel`, `LogEntry`, `MAX_FRAMES_PER_SHEET = 12`. |
| `time.ts` | `Time`: number or string → seconds via `parseTime` from `@diffusionstudio/jsx`; accepts `1.5`, `"45f"`, `"1:30"`, `"01:02:03"`, negatives. `NonNegativeTime` refines `>= 0`. `TIME_FORMS` text for error messages. `TimeInput`. |
| `errors.ts` | `DapiError(code, message, {cause})`, `isDapiError`. `DapiErrorCode`: `no-project`, `not-found`, `ambiguous`, `wrong-kind`, `invalid-input`, `busy`, `sign-in-required`, `unsupported`, `canceled`. |
| `mcp.ts` | `MCP_HOST = "127.0.0.1"`, `MCP_PORT = 3274`, `MCP_PATH = "/mcp"`, `MCP_URL`. Streamable HTTP, loopback, no token; server checks Host header. |
| `json-schema.ts` | `JSON_SCHEMA_DIALECT` (2020-12). `toolJsonSchemas(tool)` → `{ inputSchema (io: input), outputSchema (io: output) }`. Replaces the MCP SDK draft-07 default, which client validators reject. |
| `ipc.ts` | `DAPI_WIRE`: `dapi:call`, `dapi:cancel` (main → renderer), `dapi:reply` (renderer → main). Types `DapiCall {id, tool, args}`, `DapiCancel {id}`, `DapiReply` (`ok: true, data` or `ok: false, error {code?, message}`). |
| `catalog.test.ts` | Vitest: unique names matching `^[a-z][a-z0-9_]{0,63}$`, descriptions > 40 chars, object input/output, JSON Schema 2020-12 conversion, `toolByName` environments. |
| `time.test.ts` | Vitest: `Time` parse and reject cases, `NonNegativeTime` rejects negatives. |

## How it works

- Each `tools/*.ts` builds its schemas from `schemas.ts` and `time.ts` and wraps them in `defineTool` from `tool.ts`.
- `catalog.ts` collects all tools into one `as const` tuple. All name-keyed types derive from this tuple, so a new tool file plus one catalog entry types every consumer.
- Callers send `ToolInput<N>` (times as strings or numbers). Zod parses to `ToolArgs<N>` (seconds, defaults applied, `superRefine` cross-field rules checked). Handlers receive only valid args.
- Handlers return `ToolResult<N>`. When a tool declares `result` (image bytes, full transcript), the desktop server writes files and returns `ToolOutput<N>` (paths, counts).
- `environment` picks the answering process. The desktop main process hosts MCP at `MCP_URL`; it lists tools with `toolJsonSchemas`, runs `main` tools locally, and forwards `renderer` tools as `DapiCall` over `DAPI_WIRE.CALL`. The renderer answers with `DapiReply` on `DAPI_WIRE.REPLY`. `DAPI_WIRE.CANCEL` aborts an in-flight call.
- Failures throw `DapiError`. Its `code` travels in `DapiReply.error.code`; the server maps it to an MCP `isError` result; the CLI maps it to an exit code (per `errors.ts` comment).
- `index.ts` is the only public surface; consumers never import internal files.

## Interfaces

- Depends on:
  - `zod` v4 (all schema files).
  - `@diffusionstudio/jsx` `parseTime` (only `time.ts`) — [../../jsx/README.md](../../jsx/README.md).
  - No Node or DOM imports.
- Used by (all through `index.ts`):
  - `apps/desktop/src/dapi/tools-session.ts` (`tools` + `toolJsonSchemas` for `tools/list`), `server.ts` (`MCP_PORT`), `renderer-calls.ts` (`DAPI_WIRE`, `DapiCall`/`DapiCancel`/`DapiReply`), `present.ts`, `handler.ts`, `handlers/logs.ts`, `handlers/report.ts` — [../../../apps/desktop/src/dapi/README.md](../../../apps/desktop/src/dapi/README.md).
  - `apps/desktop/src/preload.ts` (allow-lists `DAPI_WIRE` channels), `main.ts`, `main-channels.ts`, `projects.ts` and `mcp-install.ts` (`MCP_URL`).
  - `apps/web/src/dapi/bridge.ts` (listens on `DAPI_WIRE.CALL`/`CANCEL`, sends `REPLY`), `session.ts`, `handler.ts`, `api.tsx`, `handlers/*.ts`, `lib/*.ts` — [../../../apps/web/src/dapi/README.md](../../../apps/web/src/dapi/README.md).
  - `apps/cli/src/index.ts`, `cli-client.ts`, `mcp-proxy.ts` (connect to `MCP_URL`) — [../../../apps/cli/src/README.md](../../../apps/cli/src/README.md).

Up: [../README.md](../README.md)
