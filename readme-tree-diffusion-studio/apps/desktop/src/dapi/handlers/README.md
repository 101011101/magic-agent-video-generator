# `apps/desktop/src/dapi/handlers`

Implements the two MCP tools that must run in the Electron main process (`logs`, `report`) and exports them as one `mainHandlers` map for the dapi server.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Exports `mainHandlers: MainHandlers = { logs, report }`. Keyed by tool catalog name. The only import point for the server. |
| `logs.ts` | `logs: MainHandler<"logs">`. Filters `ctx.logs()` by `level` (rank via `LEVEL_RANK`: debug < info < warning < error), `since` (`e.ts > since`), `contains` (case-insensitive substring). Takes the last `tail` entries (default `LOG_TAIL` = 100). `clip()` cuts messages over `LOG_MESSAGE_MAX` (4000 chars) and appends `… (N more chars)`. Also exports `formatLogEntry(entry)`: one line `HH:MM:SS.mmm [level] message  (source)`. |
| `logs.test.ts` | Vitest for `logs`: default tail, filter order (filter before tail), message clipping. Builds a fake `MainContext` with `logs: () => entries`. |
| `report.ts` | `report: MainHandler<"report">`. Files a GitHub issue on `diffusionstudio/editor` and returns `{ url }`. `buildIssueBody()` assembles markdown: user body, `## Repro` (commands in a `sh` fence), `## Environment` table (app version, `platform() release() (arch())`, `process.versions.electron`), `## App logs` (last `ISSUE_LOG_TAIL` = 50 entries via `formatLogEntry`). `createIssue()` spawns `gh issue create --repo diffusionstudio/editor --title <t> --body-file -` and writes the body over stdin. |

## How it works

- `DapiServer.createSession()` (`../server.ts`) routes any catalog tool with `environment: "main"` to `runInMain()`.
- `runInMain()` builds a `MainContext` (`{ signal, logs, version }`, typed in `../handler.ts`) and calls `mainHandlers[name](args, ctx)`.
- `ctx.logs()` returns `logBuffer` from `apps/desktop/src/main.ts`: the renderer console mirror, oldest first, max 2000 entries.
- `logs`: filter -> tail -> clip -> `{ entries }`.
- `report`: validate non-empty `title` (else `DapiError("invalid-input")`) -> format log tail -> build body -> spawn `gh` -> parse last stdout line as the issue URL.
- `report` errors: missing `gh` binary (`ENOENT`) -> `DapiError("unsupported", GH_MISSING)`; non-zero exit -> `Error(stderr)`; no `https://` URL in stdout -> `Error`.
- `DapiServer` constructor asserts every `environment: "main"` tool in the catalog has a key in `mainHandlers`; a missing handler throws at startup.

## Interfaces

- Depends on:
  - `@diffusionstudio/dapi` ([packages/dapi/](../../../../../packages/dapi/README.md)): tool schemas `packages/dapi/src/tools/logs.ts`, `packages/dapi/src/tools/report.ts`; constants `LOG_TAIL`, `LOG_MESSAGE_MAX`, `ISSUE_LOG_TAIL`; types `LogEntry`, `LogLevel`, `ToolArgs`, `ToolResult`; `DapiError`.
  - `../handler.ts`: `MainContext`, `MainHandler<N>`, `MainHandlers`, `MainToolName = "logs" | "report"`.
  - `node:child_process` (`spawn`), `node:os` (`arch`, `platform`, `release`), external `gh` CLI (must be installed and authenticated).
- Used by:
  - `apps/desktop/src/dapi/server.ts`: imports `mainHandlers`; startup check and `runInMain()` dispatch.
  - `apps/desktop/src/main.ts`: supplies `logs: () => logBuffer` and `version: app.getVersion()` to `DapiServer`, which become `ctx.logs` / `ctx.version`.
  - Agents and the `diffusion` CLI call these as MCP tools `mcp__diffusion__logs` and `mcp__diffusion__report`.

Up: [../README.md](../README.md)
