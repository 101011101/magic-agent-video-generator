# `packages/agent-chat/test`

Vitest suite for the agent-chat package: unit tests for the reducer, store and harness helpers, plus an end-to-end loop over a real WebSocket with the fake harness.

## Parts

| Part | Role |
|---|---|
| `e2e.test.ts` | Full loop: `createAgentHost` with `FakeHarness` + `AgentChatClient` over `ws`. Covers token/origin rejection (401/403), harness list push, lazy chat creation and streamed reply, attachments appended for the harness, `busy` and `harness-mismatch` errors, interrupt with streamed text kept, question flow (`waiting` status, late-client snapshot has `pending`, answer/skip/cancel), failed turn → error notice, client auto-reconnect and re-open, `chats.delete`, `deleteChats(projectId)` per project, probe status change. |
| `reduce.test.ts` | `reduce`/`reduceAll`: user item on `turn.started`, delta streaming into an open assistant item, ignoring deltas for unknown/non-text items, `item.started` re-emit replaces in place, running tools fail on interrupted turn, `pending` request lifecycle, `isPersistedEvent` set. Also `titleFor` (whitespace collapse, 60-char cap, "New chat" fallback). |
| `store.test.ts` | `ChatStore` on a temp dir: empty list when no folder, atomic `writeMeta` round-trip and `list`, folding `events.jsonl` into a transcript while skipping a torn trailing line, `remove`. |
| `harness.test.ts` | `collectResult`: joins text parts, keeps base64 images that fit, `[type]` markers for oversized images and other part kinds, `IMAGES_MAX` cap, `DETAIL_MAX` truncation, empty output dropped. |
| `claude-models.test.ts` | `claudeModelLabel` (family + version from wire id, CLI label fallback) and `claudeModels` (alias collapse, default resolution, rows without `resolvedModel`). Fixture: rows as reported by `claude` 2.1.236. |

## How it works

- Run: `npm test` in `packages/agent-chat` → `vitest run` (`package.json` `scripts.test`). No vitest config file; defaults apply. `tsconfig.json` includes `test/`.
- `e2e.test.ts` starts one host in `beforeAll` (temp `dataDir`, `allowedOrigins: ["null"]` because Node `ws` sends no Origin), connects clients via `AgentChatClient` with `resolveEndpoint` and injected `WebSocket`, and uses a `follow(client, chatId)` helper that folds snapshot + events through `reduce` and exposes `until(predicate)` for waiting.
- The fake harness's prompt prefixes (`ask`, `fail`, `slow`) select each scenario; `fake.sessions` and `fake.probeStatus` let tests inspect `OpenOptions` and force a not-ready probe.
- Unit tests import source directly (`../src/...`); no mocks of Node APIs beyond temp directories.

## Interfaces

- Depends on:
  - [`../src/host/`](../src/host/README.md) — `createAgentHost`, `FakeHarness`, `ChatStore`, `collectResult` + caps, `claudeModels`, `claudeModelLabel`.
  - [`../src/`](../src/README.md) — `client.ts` (`AgentChatClient`), `reduce.ts`, `protocol.ts`.
  - `vitest`, `ws` (dev dependencies in `packages/agent-chat/package.json`).
- Used by: root `npm test` (`npm run test --workspaces --if-present` in `/package.json`). No source imports.

Up: [../README.md](../README.md)
