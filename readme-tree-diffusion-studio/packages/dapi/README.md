# `packages/dapi`

`@diffusionstudio/dapi`: the single tool catalog the Diffusion Studio app exposes to agents. Each tool is a name, description, and zod input/output schemas. The desktop app serves it over MCP, the CLI derives commands from it, the web renderer validates against it.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | Package source. `index.ts` is the only export (`"."`). Holds the catalog, the `defineTool` contract, shared schema blocks, the `Time` parser, error codes, MCP address constants, JSON Schema export, and IPC wire types. |
| [src/tools/](src/tools/README.md) | One file per tool (18 tools): `open`, `context`, `capture`, `check`, `export`, `media_probe`, `media_grab`, `media_transcribe`, `media_filmstrip`, `media_waveform`, `media_listen`, `media_segment`, `models`, `voices`, `logs`, `screenshot`, `fonts`, `report`. Definitions only; no handlers. |
| `src/catalog.ts` | Ordered `catalog` array of all tools. Derives `ToolName`, `ToolInput`, `ToolArgs`, `ToolOutput`, `ToolResult`, `toolByName`, `isToolName`, `tools` (erased). |
| `src/tool.ts` | `Tool` interface (`name`, `title`, `description`, `input`, `output`, `result?`, `environment`), `Environment = "renderer" \| "main"`, `defineTool` (identity with inference). |
| `src/schemas.ts` | Shared blocks: `NodeId`, `SceneId`, `AssetPath`, `Bytes`, `TimecodedImage`, `ImageRef`, `outputDirField`, `sheetFields` + `checkSheetOptions`, `windowFields` + `checkWindow`, `LogLevel`, `LogEntry`, `MAX_FRAMES_PER_SHEET = 12`. |
| `src/time.ts` | `Time`: zod transform that parses seconds, `"45f"`, or `"MM:SS"` via `parseTime` from `@diffusionstudio/jsx`. `NonNegativeTime`, `TIME_FORMS`. |
| `src/errors.ts` | `DapiError(code, message)`, `isDapiError`. Codes: `no-project`, `not-found`, `ambiguous`, `wrong-kind`, `invalid-input`, `busy`, `sign-in-required`, `unsupported`, `canceled`. |
| `src/mcp.ts` | `MCP_HOST = 127.0.0.1`, `MCP_PORT = 3274`, `MCP_PATH = /mcp`, `MCP_URL`. Fixed loopback address, no token. |
| `src/json-schema.ts` | `JSON_SCHEMA_DIALECT` (2020-12), `toolJsonSchemas(tool)` → `{ inputSchema, outputSchema }` for MCP `tools/list`. |
| `src/ipc.ts` | Main↔renderer channel names `DAPI_WIRE` (`dapi:call`, `dapi:cancel`, `dapi:reply`) and types `DapiCall`, `DapiCancel`, `DapiReply`. |
| `src/catalog.test.ts`, `src/time.test.ts` | Vitest: unique MCP-legal names, object inputs/outputs, JSON Schema 2020-12 conversion; `Time` parse and reject cases. |
| `package.json` | `@diffusionstudio/dapi` 0.1.0, MPL-2.0, ESM, `sideEffects: false`. Deps: `@diffusionstudio/jsx`, `zod ^4`. Scripts `check` (tsc), `test` (vitest). |
| `tsconfig.json` | Extends base; `lib: ["es2024"]` only (no DOM), so the package stays free of browser and Node built-ins. |
| `README.md` | Package README with usage example. Links `docs/mcp-server.md`, which does not exist in this clone. |

## How it works

- Each `src/tools/*.ts` calls `defineTool({...})`. `defineTool` returns its argument unchanged and keeps literal `name` and exact schema types.
- `src/catalog.ts` imports every tool into `catalog` in listing order: project loop (`open`, `context`, `capture`, `check`, `export`), media inspection (`media_*`), then app and machine utilities.
- Name-keyed types come from the `catalog` tuple: `ToolArgs<"media_grab">` is the parsed input, `ToolOutput` is structured content, `ToolResult` is the handler return (`result` schema when declared, else `output`).
- `environment` selects the answering process. Renderer tools need the open project or browser media APIs. Main tools (`logs`, `report`) need the file system or a child process.
- `output` vs `result`: image tools return `Bytes` in `result`; the desktop server writes them to disk and returns paths as `output` (`apps/desktop/src/dapi/present.ts`). `media_transcribe` returns the transcript; the server writes JSON and returns `path`.
- `Time` normalizes agent time inputs to seconds at parse time. Input `superRefine` blocks enforce cross-field rules, so handlers receive valid args.
- `toolJsonSchemas` publishes schemas as JSON Schema 2020-12, because MCP client validators reject draft-07.
- `DapiError` codes map to MCP `isError` results in the server and to exit codes in the CLI.
- No Node or DOM imports. The renderer, the main process, and the CLI can all import the package.

## Interfaces

- Depends on:
  - `zod` v4.
  - [`../jsx/`](../jsx/README.md): `parseTime` only (through `src/time.ts`).
- Used by:
  - `apps/desktop/src/dapi/server.ts`, `tools-session.ts`, `renderer-calls.ts`, `present.ts`, `handler.ts`, `handlers/logs.ts`, `handlers/report.ts`: serve the catalog as an MCP server on `MCP_URL`, route calls by `environment`, forward renderer calls over `DAPI_WIRE`.
  - `apps/desktop/src/main.ts`, `main-channels.ts`, `preload.ts`, `projects.ts`, `mcp-install.ts`: MCP address constants and wire types.
  - `apps/web/src/dapi/bridge.ts`, `session.ts`, `handler.ts`, `api.tsx`, `handlers/*.ts`, `lib/*.ts`: renderer handlers typed `ToolHandler<N>`; validate incoming calls against the catalog.
  - `apps/cli/src/index.ts`, `cli-client.ts`, `mcp-proxy.ts`: derive `diffusion` commands and help from `tools`; proxy stdio MCP to `MCP_URL`.
  - See [../../apps/README.md](../../apps/README.md).
- Related docs: `docs/reference/tools/` (one page per tool), see [../../docs/README.md](../../docs/README.md).

Up: [../README.md](../README.md)
