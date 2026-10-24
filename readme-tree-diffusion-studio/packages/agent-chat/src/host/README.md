# `packages/agent-chat/src/host`

Node-side agent host: runs the user's own Claude Code or Codex CLI against a project, persists each chat as an event log, and serves it to the editor UI over a token-guarded loopback WebSocket.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Entry: `createAgentHost(config)` hydrates env, opens `ChatStore`, builds `AgentHost` with `ClaudeHarness` + `CodexHarness` (or test `harnesses`), starts the WebSocket server. Returns `RunningAgentHost { url, port, deleteChats, stop }`. Re-exports the public host surface. |
| `host.ts` | `AgentHost`: owns every chat (meta, transcript, one `HarnessSession`, running turn, pending question, subscribers). Dispatches client methods (`harnesses.list`, `chats.list/open/close/delete`, `turn.send`, `turn.interrupt`, `request.respond`). Folds harness events through `reduce`, persists them, fans them out. Probes harnesses; closes idle sessions after `IDLE_MS` (10 min). `HostError(code)` maps to protocol `ErrorCode`. |
| `harness.ts` | Adapter contract and shared helpers. Types: `Harness { id, probe, open }`, `HarnessSession { resume, send, respond, interrupt, close }`, `OpenOptions`, `TurnOutcome`, `ResumeCursor`, `McpConfig`, `Emit`. Helpers: `QuestionBox` (ask/settle/cancelAll question flow), `collectResult` (tool output text + inline images, capped by `DETAIL_MAX`=2048, `IMAGE_MAX`=512KiB, `IMAGES_MAX`=8), `truncateDetail`, `summarizeInput`, `toolTitle`, `newItemId`, `chatInstructions`, `withAttachments`. |
| `claude.ts` | `ClaudeHarness`: Claude Code via `@anthropic-ai/claude-agent-sdk` `query()`. `probe` resolves the binary, checks version ≥ `2.0.0`, `claude auth status`, lists models via `initializationResult()`. `ClaudeSession` keeps one long-lived `query()` fed by a `Queue<SDKUserMessage>`; `dispatch` maps SDK `stream_event`/`assistant`/`user`/`result` messages to `ChatEvent`s. `AskUserQuestion` is intercepted by a `PreToolUse` hook and `canUseTool`. Permission policy steps down `bypassPermissions → auto → default` when `isBypassRefused(stderr)`. Exports `claudeModels`, `claudeModelLabel`, `isAuthFailure`, `isBypassRefused`. |
| `codex.ts` | `CodexHarness`: Codex via `codex app-server` child + JSON-RPC. `probe` runs `initialize`, `account/read`, `model/list`; version ≥ `0.100.0`. `CodexSession.start` spawns the server (MCP injected with `-c mcp_servers.diffusion.url=…`), `thread/start` or `thread/resume`, then `turn/start` per send. `toItem` maps `agentMessage`, `reasoning`, `commandExecution`, `fileChange`, `mcpToolCall`, `webSearch`, `error` thread items to protocol `Item`s. Answers `item/tool/requestUserInput` through `QuestionBox`; approval requests auto-answered (policy `approvalPolicy: "never"`). Sandbox falls back `danger-full-access → workspace-write` on refusal. |
| `jsonrpc.ts` | `JsonRpcPeer`: JSON-RPC 2.0 over a child's stdio, newline-delimited. `request`, `notify`, and handlers `onNotification`, `onRequest`, `onClose`. Rejects all pending on exit. `RpcError`. |
| `server.ts` | `startServer`: `node:http` + `ws` `WebSocketServer` on loopback. Upgrade rejected with 401 unless `?token=` matches in constant time (`timingSafeEqual`), 403 unless `originAllowed` (`DEFAULT_ORIGINS` = `file://`, `null`, `http://localhost:5173`). Each socket becomes an `AgentHost.connect()` link. |
| `store.ts` | `ChatStore`: `<dataDir>/chats/<id>/meta.json` (atomic temp+rename) and `events.jsonl` (append-only). `list`, `readMeta`, `writeMeta`, `append`, `readTranscript` (folds log via `reduce`, skips torn last line), `remove`. Per-chat write serialization. `ChatMeta = ChatSummary & { cwd, resume }`. |
| `env.ts` | Child process environment and binary discovery. `hydrateEnv` reads login-shell PATH (macOS/Linux GUI launch fix), strips `ELECTRON_*`/`NODE_OPTIONS`. `which`, `resolveBinary` (`DIFFUSION_CLAUDE_PATH`/`DIFFUSION_CODEX_PATH` overrides), `resolveClaudeExecutable` (Windows `.cmd` shim → `cli.js`), `needsShell`, `quoteArg`, `runOnce`, `parseVersion`, `compareVersions`, `killTree` (SIGTERM→SIGKILL / `taskkill /T /F`). |
| `fake.ts` | `FakeHarness`: no-binary adapter for tests and UI dev; never offered to users. Prompt prefixes drive behavior: `ask` opens a question, `fail` throws, `slow` streams many deltas, else echoes with a fake reasoning + `Read` tool + assistant reply. |

## How it works

- `createAgentHost` → `hydrateEnv()` (async, probes await it) → `ChatStore` → `AgentHost.start()` → `startServer`.
- `AgentHost.start` loads all metas; any chat left `running`/`waiting` by a crash gets `turn.completed{interrupted}` appended and status `idle`. Then `probeAll()` runs every harness probe in parallel and broadcasts `{ t: "harnesses" }`.
- Client connects → server checks token + origin → `AgentHost.connect(connection)` sends the harness list, returns `{ receive, disconnect }`.
- `receive` parses `ClientMsg { t: "req", id, method, params }` → `handle()` → replies `{ t: "res", ok, data | error }`.
- `turn.send`: validates `model` (`validateModel`), creates the chat lazily (`register`, title via `titleFor`) or checks `harness-mismatch`/`busy`, checks probe status is `ready`, writes meta `running`, emits `chat.updated` + `turn.started`, then `runTurn` in the background.
- `runTurn` → `ensureSession` (calls `harness.open` with `cwd`, `model`, `resume`, `mcp`, `chatInstructions`) → `session.send(text, model, emit)`. Text is `withAttachments(text, attachments)`. Without `mcp` config, a one-time "Editor tools unavailable" notice is emitted.
- `emitter` wraps every harness event: `reduce` into the in-memory transcript, track open items, flip meta `running ↔ waiting` on `request.opened`/`request.resolved`, then `publish`.
- `publish` bumps `seq`, appends persisted events (`isPersistedEvent`: turn boundaries + `item.completed`) to `events.jsonl`, sends `{ t: "event", chatId, seq, event }` to subscribers.
- Turn end: `finalizeOpen` closes anything the harness left open (running tools → `done`/`failed`), emits `turn.completed`, writes meta `idle` with the session's `resume` cursor, `scheduleIdle` closes the session after 10 idle minutes.
- Questions: harness calls `QuestionBox.ask` → `request.opened`; client `request.respond` → `AgentHost.respond` → `session.respond` → `QuestionBox.settle` → `request.resolved` + `question` item. `turn.interrupt` cancels the pending question, then `session.interrupt()`.
- `chats.open` returns `ChatSnapshot { chat, items, seq, pending }` after `ensureLoaded` folds `events.jsonl`; the client subscribes for later events.
- Claude path: `ClaudeSession.open` builds SDK `Options` (`permissionMode`, `disallowedTools: ["Agent","Task"]`, `resume`/`sessionId`, `includePartialMessages`, `systemPrompt` preset + appended instructions, `mcpServers` http). One pump `run(q)` reads SDK messages until close; a dead process before `init` with a bypass refusal retries once with a tighter policy.
- Codex path: `JsonRpcPeer` over stdio; notifications `item/started`, `item/completed`, `item/*/delta`, `turn/completed`, `error` become events; server requests `item/tool/requestUserInput` become questions.

## Interfaces

- Depends on:
  - [`../protocol.ts`](../README.md) — `ChatEvent`, `Item`, `HostMsg`, `ClientMsg`, `Method*`, `HarnessInfo`, `HARNESS_IDS`, `HARNESS_LABELS`, `isHarnessId`, `titleFor`.
  - [`../reduce.ts`](../README.md) — `reduce`, `emptyTranscript`, `isPersistedEvent`, `Transcript`.
  - `@anthropic-ai/claude-agent-sdk` (`query`, hook/permission types) — `claude.ts`.
  - `ws` — `server.ts`.
  - User binaries `claude` and `codex` on PATH / known dirs / `DIFFUSION_*_PATH`.
- Used by:
  - `packages/agent-chat/src/bin.ts` — program wrapper: CLI flags or Electron `parentPort` `start`/`stop`/`deleteProject` messages → `createAgentHost`.
  - `apps/desktop/src/agent-chat.ts` — forks `dist/agent-host.mjs` (built from `bin.ts` by `apps/desktop/package.json` `build:agent-host`) as a `utilityProcess`; passes `mcpUrl` `…?client=chat` from `apps/desktop/src/main.ts`.
  - `apps/web/src/agent-chat/*` — connects through `packages/agent-chat/src/client.ts` to the URL this server returns.
  - [`../../test/`](../../test/README.md) — `e2e.test.ts` drives `createAgentHost` with `FakeHarness`; unit tests cover `store.ts`, `harness.ts`, `claude.ts`.
- Package export: `@diffusionstudio/agent-chat/host` → `index.ts`; `@diffusionstudio/agent-chat/host/env` → `env.ts`.

Up: [../README.md](../README.md)
