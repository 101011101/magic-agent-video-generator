# `packages/agent-chat/src`

Source of `@diffusionstudio/agent-chat`: a browser-safe wire protocol, client, and reducer (root), plus the Node agent host (`host/`) and its program wrapper (`bin.ts`).

## Parts

| Part | Role |
|---|---|
| `index.ts` | Browser-safe root (export `"."`). Re-exports `protocol`, `reduce`, `client`. Does not import `host/`. |
| `protocol.ts` | Wire types for JSON text frames over a WebSocket. `HarnessId`, `ModelRef { harness, model }`, `HarnessInfo`/`HarnessStatus`, `ChatSummary`/`ChatStatus` (`idle` \| `running` \| `waiting`), `Item` (`user`, `assistant`, `reasoning`, `tool`, `question`, `notice`), `ChatEvent` (`turn.started`, `item.started`, `item.delta`, `item.completed`, `turn.completed`, `request.opened`, `request.resolved`, `chat.updated`), `PendingRequest` (only `question` in v1), `Question`, `RequestResponse`, `ChatSnapshot { chat, items, seq, pending }`, `MethodMap`, `ErrorCode`, envelopes `ClientMsg` / `HostMsg` (`res`, `event`, `harnesses`). Helpers `titleFor` (`TITLE_MAX` = 60), `HARNESS_LABELS`, `HARNESS_IDS`, `isHarnessId`. |
| `reduce.ts` | Pure reducer `reduce(Transcript, ChatEvent)`. `Transcript = { items, pending, turnId, chat }`. Upserts items by id (search from end); `item.delta` appends text to `assistant`/`reasoning` only; non-`completed` `turn.completed` marks `running` tools `failed`. `reduceAll`, `emptyTranscript`, `EMPTY_TRANSCRIPT`, `isPersistedEvent` (`turn.started`, `item.completed`, `turn.completed`). |
| `client.ts` | `AgentChatClient`: one WebSocket; `request(method, params)` matched by id, 60 s timeout; `open(chatId, listener)` delivers snapshot (`chats.open`) then events with `seq` > snapshot `seq`, unsubscribe sends `chats.close`; `subscribed`, `onState`, `onHarnesses`. Reconnect backoff 500 ms → 5 s (doubling), `resolveEndpoint()` called each attempt, re-opens all subscriptions on open. `not-found` drops a subscription. `ConnectionState` (`connecting`, `open`, `closed`, `unavailable`), `AgentChatError` (`ErrorCode` \| `disconnected`). |
| [host/](host/README.md) | Node host (export `"./host"`, `"./host/env"`). `createAgentHost` → `AgentHost` (chats, turn loop) + `ChatStore` (`meta.json`, `events.jsonl`) + `startServer` (token- and origin-guarded `ws`) + `ClaudeHarness`, `CodexHarness`, `FakeHarness`. |
| `bin.ts` | Host as a program. Electron `utilityProcess` mode (if `process.parentPort`): messages `start { config }` → `createAgentHost` → posts `listening { port, url }` or `error`; `stop`; `deleteProject { projectId }` → `deleteChats`. CLI mode: `--token` (or `AGENT_CHAT_TOKEN`) `--data-dir` required; optional `--host --port --mcp-url --origin --instructions --version`; prints URL to stdout. Stops on SIGTERM, SIGINT, stdin EOF, or `stop`. |

## How it works

- `protocol.ts` is the contract. `reduce.ts`, `client.ts`, and `host/` all import its types.
- Host side: `bin.ts` builds an `AgentHostConfig` (from `parentPort` or flags) and calls `createAgentHost` in `host/index.ts`. Electron mode keeps the config off argv.
- `host/` folds harness events through `reduce` into each chat's in-memory `Transcript`. It appends `isPersistedEvent` events to `events.jsonl`. It sends `{ t: "event", chatId, seq, event }` to subscribers.
- Snapshot: `chats.open` returns `ChatSnapshot`. The host builds it by `reduce` over `events.jsonl`.
- UI side: `AgentChatClient.open` gets the snapshot, then events in `seq` order. The client skips events until the snapshot arrives and skips events with `seq` ≤ snapshot `seq`. The UI folds events with the same `reduce`.
- Requests: client sends `ClientMsg { t: "req", id, method, params }`. Host answers `HostMsg { t: "res", id, ok, data | error }`. An error becomes `AgentChatError(code)`.
- Harness list: host pushes `{ t: "harnesses" }` on connect and when probes change. Client caches it in `harnesses` and calls `onHarnesses` listeners.
- Reconnect: socket close rejects pending requests with `disconnected`, then backoff retries. On open, every subscription gets a fresh snapshot. No replay protocol.

## Interfaces

- Depends on:
  - Root files: no runtime deps; global `WebSocket` (or `options.WebSocket`).
  - `host/`: `@anthropic-ai/claude-agent-sdk`, `ws`, Node built-ins, user binaries `claude` and `codex`. See [host/README.md](host/README.md).
- Used by:
  - `apps/web/src/agent-chat/connection.ts` (`AgentChatClient`), `store.ts` (`reduce`, `Transcript`), and `chat-panel.tsx`, `composer.tsx`, `transcript.tsx`, `items.tsx`, `question-card.tsx`, `model-picker.tsx`, `history-menu.tsx`, `running-indicator.tsx` (protocol types) via `@diffusionstudio/agent-chat`.
  - `apps/desktop/package.json` `build:agent-host`: esbuild bundles `bin.ts` to `dist/agent-host.mjs`; `apps/desktop/src/agent-chat.ts` forks it as a `utilityProcess`.
  - [../test/README.md](../test/README.md): `e2e.test.ts`, `reduce.test.ts`, `store.test.ts`, `harness.test.ts`, `claude-models.test.ts`.

Up: [../README.md](../README.md)
