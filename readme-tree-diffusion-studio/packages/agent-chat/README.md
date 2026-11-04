# `packages/agent-chat`

`@diffusionstudio/agent-chat`: the editor's in-app agent chat. A Node host runs the user's own Claude Code or Codex CLI against a project and streams the conversation over a WebSocket. A browser-safe protocol, client, and reducer let the UI render it as a view over host state.

## Parts

| Part | Role |
|---|---|
| [src/](src/README.md) | Package source. Root export `"."` → `src/index.ts` (browser-safe). Host export `"./host"` → `src/host/index.ts` (Node). `"./host/env"` → `src/host/env.ts`. |
| `src/protocol.ts` | Wire types. `HarnessId` (`claude` \| `codex`), `HarnessInfo`, `ChatSummary`, `Item` (user, assistant, reasoning, tool, question, notice), `ChatEvent`, `PendingRequest`, `Question`, `MethodMap` (`harnesses.list`, `chats.list/open/close/delete`, `turn.send`, `turn.interrupt`, `request.respond`), `ClientMsg`, `HostMsg`, `ErrorCode`. `titleFor`, `HARNESS_LABELS`, `isHarnessId`. |
| `src/reduce.ts` | Pure reducer `reduce(Transcript, ChatEvent)` shared by host and UI. `Transcript = { items, pending, turnId, chat }`. `reduceAll`, `emptyTranscript`, `isPersistedEvent` (turn boundaries + `item.completed`). |
| `src/client.ts` | `AgentChatClient`: one WebSocket, request/response by id (60 s timeout), per-chat `open(chatId, listener)` subscriptions (snapshot then events), reconnect with backoff (500 ms → 5 s), endpoint re-resolved each attempt. `ConnectionState`, `AgentChatError`. |
| [src/host/](src/host/README.md) | Node host. `createAgentHost(config)` → `AgentHost` (chat state, turn loop) + `ChatStore` (`meta.json`, `events.jsonl`) + `startServer` (token- and origin-guarded `ws`) + harnesses `ClaudeHarness` (`@anthropic-ai/claude-agent-sdk`), `CodexHarness` (`codex app-server` JSON-RPC), `FakeHarness` (tests). `env.ts` finds binaries and hydrates PATH. |
| `src/bin.ts` | Host as a program. Electron mode: config over `parentPort` (`start`, `stop`, `deleteProject`), replies `listening { port, url }`. CLI mode: `--token` (or `AGENT_CHAT_TOKEN`) `--data-dir` `[--host --port --mcp-url --origin --instructions --version]`, prints URL to stdout, exits on stdin EOF or SIGTERM. |
| [test/](test/README.md) | Vitest: `e2e.test.ts` (real WebSocket + `FakeHarness`), `reduce`, `store`, `harness` helpers, `claude-models`. |
| `package.json` | `@diffusionstudio/agent-chat` 0.1.0, MPL-2.0, ESM, `sideEffects: false`. Deps: `@anthropic-ai/claude-agent-sdk`, `ws`. No internal deps. Scripts `check`, `test`. |
| `tsconfig.json` | Extends base; `lib: ["es2024", "DOM"]`, `types: ["node"]`; includes `src` and `test`. |

## How it works

- Host state is the source of truth. The UI holds a snapshot (`chats.open`) plus the events after it, folded through the same `reduce`.
- Start: `apps/desktop/src/agent-chat.ts` forks `dist/agent-host.mjs` (esbuild bundle of `src/bin.ts`) as an Electron `utilityProcess`, posts `{ type: "start", config }` with a random 32-byte token, `dataDir`, `mcp` (`{ name: "diffusion", url }`), `allowedOrigins`. `bin.ts` calls `createAgentHost` and posts back `listening { port, url }`.
- `createAgentHost`: `hydrateEnv()` → `ChatStore(dataDir)` → `AgentHost.start()` (loads metas, repairs crashed turns, probes harnesses) → `startServer` on loopback, port 0 by default.
- Connect: the web UI resolves the endpoint over desktop IPC (`apps/web/src/agent-chat/connection.ts`), then `AgentChatClient.connect()`. Server checks `?token=` and Origin, then `AgentHost.connect()` pushes `{ t: "harnesses" }`.
- Turn: UI sends `turn.send { projectId, cwd, text, attachments, model }`. Host creates or resumes the chat, opens a `HarnessSession` with the MCP config injected, and streams `turn.started` → `item.started`/`item.delta`/`item.completed` → `turn.completed` as `{ t: "event", chatId, seq, event }`.
- Persist: `isPersistedEvent` events append to `<dataDir>/chats/<id>/events.jsonl`; `meta.json` holds `ChatSummary` + `cwd` + harness `resume` cursor. Deltas are not stored.
- Questions: harness `AskUserQuestion` (Claude) or `item/tool/requestUserInput` (Codex) → `request.opened`; chat status `waiting`; UI answers with `request.respond`; `request.resolved` + a `question` item follow.
- Editor tools reach the agent through MCP: the host passes `mcp.url` (the desktop `MCP_URL` with `?client=chat`) to each harness. Without it, the host emits a one-time "Editor tools unavailable" notice.
- Reconnect: client re-opens every subscribed chat and receives a fresh snapshot. No replay protocol.

## Interfaces

- Depends on:
  - `@anthropic-ai/claude-agent-sdk` (`query()`, hooks) in `src/host/claude.ts`.
  - `ws` in `src/host/server.ts`.
  - User binaries `claude` (≥ 2.0.0) and `codex` (≥ 0.100.0) on PATH or via `DIFFUSION_CLAUDE_PATH` / `DIFFUSION_CODEX_PATH`.
  - No other `packages/*`. The MCP URL comes in as config; see [../dapi/README.md](../dapi/README.md) for the server it points at.
- Used by:
  - `apps/desktop/src/agent-chat.ts`: forks the host, restarts with backoff, answers the endpoint IPC. `apps/desktop/package.json` `build:agent-host` bundles `src/bin.ts`.
  - `apps/web/src/agent-chat/connection.ts` (`AgentChatClient`), `store.ts` (`reduce`, `Transcript`), `chat-panel.tsx`, `composer.tsx`, `transcript.tsx`, `items.tsx`, `question-card.tsx`, `model-picker.tsx`, `history-menu.tsx`, `running-indicator.tsx` (protocol types).
  - See [../../apps/README.md](../../apps/README.md).

Up: [../README.md](../README.md)
