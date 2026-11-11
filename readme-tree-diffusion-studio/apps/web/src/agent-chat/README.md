# `apps/web/src/agent-chat`

The editor's agent chat UI: a SolidJS panel in the left sidebar that drives the user's Claude Code or Codex against the open project through the `@diffusionstudio/agent-chat` host.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Public surface. Re-exports `ChatPanel`, `SidebarTabs`, `ModelPicker`, `harnessIcon`, store accessors (`leftSidebarWidth`, `sidebarTab`, `setSidebarTab`, `startChat`, `currentModel`, `storedModel`, `setStoredModel`, `ensureConnected`, `ASSETS_SIDEBAR_WIDTH`, `CHAT_SIDEBAR_WIDTH`), and attachment helpers. |
| `connection.ts` | Locates the agent host. `resolveEndpoint()`: on desktop asks main over IPC (`MAIN_CHANNELS.AGENT_CHAT_ENDPOINT`), on web reads `VITE_AGENT_CHAT_URL`. `hasHost()` says if any host exists. Exports the single `client = new AgentChatClient({ resolveEndpoint })`. |
| `store.ts` | Module-level Solid store (`chatState`) that outlives pages. Holds `connection`, `harnesses`, `chats` (transcripts by id), `lists` (history by project), `drafts`, `sending` (optimistic user item). Persists `leftSidebar.tab`, `agentChat.model`, `agentChat.active` via `settings.define`. Actions: `ensureConnected`, `openChat`, `refreshChats`, `refreshHarnesses`, `send`, `interrupt`, `respond`, `deleteChat`, `startChat`. Selectors: `activeChatId`, `currentModel`, `modelLabel`, `transcriptOf`, `summaryOf`, `blockedReason`, `leftSidebarWidth`. |
| `chat-panel.tsx` | `ChatPanel`: root view for the open project. Composes header (`SidebarTabs` + `HeaderActions`), `Transcript`, `QuestionCard`, `RecentChats`, "Get desktop app" button, `Composer`. Wires all store actions; restores draft on send failure. |
| `composer.tsx` | `Composer`: docked prompt box. Auto-grows textarea to 160 px, Enter sends, Shift+Enter breaks line, `stopPropagation` so editor shortcuts do not fire. Send button becomes Stop while `running`. Drop zone for attachments. Hosts `ModelPicker`. |
| `transcript.tsx` | `Transcript`: scrollable list of `ChatItem`s. Uses `createStickToBottom`; pins to end on `chatKey` change and every `sendCount` bump. Shows `RunningIndicator` unless a tool row is already spinning. |
| `items.tsx` | One component per `Item` kind: `UserItem`, `AssistantItem` (markdown), `ReasoningItem` (collapsible "Thinking"), `ToolItem` (status icon, collapsible detail/output/images), `QuestionItem` (answered record), `NoticeItem`. `ChatItem` dispatches on `item.kind`. |
| `question-card.tsx` | `QuestionCard`: renders a `PendingRequest` (radio/checkbox per `Question`, "Other" free text, secret input). Single-choice single question submits on click. Emits `onSubmit(Record<string,string[]>)` or `onSkip()`. |
| `model-picker.tsx` | `ModelPicker`: one dropdown of harness → models from `chatState.harnesses`. Not-ready harness shows one disabled row with `unavailableLabel()`. Calls `refreshHarnesses()` on open. `harnessIcon()` maps `claude`/`codex` to icon names. |
| `history-menu.tsx` | `HistoryMenu`: dropdown of the project's chats newest first; spinner while running, dot + "Needs you" while waiting, check on active, hover-remove that calls `deleteChat` without confirmation. Exports `relativeTime()`. |
| `header-actions.tsx` | `HeaderActions`: `HistoryMenu` plus a "New chat" button (disabled on the empty draft). |
| `recent-chats.tsx` | `RecentChats`: on an empty draft, the project's five newest chats above the composer. |
| `running-indicator.tsx` | `RunningIndicator`: spinner + "Writing"/"Thinking" (`runningLabel(last)`) with stepping ellipsis. |
| `sidebar-tabs.tsx` | `SidebarTabs`: "Assets / Chat" tablist bound to `sidebarTab`/`setSidebarTab`. |
| `attachments.tsx` | Drag-and-drop paths (no file read or upload). `Attachment` type, `droppedAttachments(event)` (path via `window.desktop.getPathForFile`, null on web), `mergeAttachments`, `attachmentPaths`, `attachmentFromPath`, `createDropZone` (nested-enter counter), `DropOverlay`, `AttachmentTile`, `AttachmentChip`, `fileType`. |
| `markdown.tsx` | `Markdown`: `marked` (gfm, breaks) → `DOMPurify` sanitize. Anchors get `target=_blank`; on desktop clicks route to `MAIN_CHANNELS.APP_OPEN_EXTERNAL`. |
| `stick-to-bottom.ts` | Vendored `@conciv/solid-stick-to-bottom` 0.0.19 (MIT). `createStickToBottom(scrollEl, options)` returns `isAtBottom`, `isNearBottom`, `escapedFromLock`, `scrollToBottom`, `stopScroll`. Spring animation, wheel-up escape, resize observer follow. |
| `activity.css` | `.agent-shimmer` (sweeping highlight on running tool text) and `.agent-ellipsis` (stepping dots). Both flatten under `prefers-reduced-motion`. |

## How it works

- `ensureConnected()` runs once (from `ChatPanel`, `ModelPicker`, or any action). It subscribes `client.onState` → `chatState.connection` and `client.onHarnesses` → `chatState.harnesses`, then calls `client.connect()` if `hasHost()`.
- `ChatPanel` mounts → `refreshChats(projectId)` requests `chats.list` → `chatState.lists[projectId]`.
- `activeChatId(projectId)` picks the remembered chat, else newest, else `null` (draft). `ChatPanel` calls `openChat(id)` for it.
- `openChat` subscribes via `client.open(chatId, cb)`. A `snapshot` message replaces `chatState.chats[id]` through `applySnapshot`. Each `event` is queued per chat and flushed once per animation frame (plus a 120 ms timer for hidden tabs); `flush()` folds events through the shared `reduce()` from `@diffusionstudio/agent-chat` and upserts `ChatSummary` on `chat.updated`.
- User types → `setDraftText`/`setDraftAttachments` on `draftKey(projectId, chatId)` (`new:<projectId>` for a draft).
- Send: `ChatPanel.handleSend` clears the draft, bumps `sendCount`, calls `send()`. `send` writes an optimistic user `Item` into `chatState.sending[key]`, awaits `whenOpen()` (4 s timeout), requests `turn.send` with `projectId`, `cwd`, `text`, `attachments`, `model`. For a new chat it records `awaitingSnapshot` and `setActiveChat`; then `openChat(chatId)`. On error the draft is restored and a toast shows.
- The model sent is `ChatPanel.model()`: inside a chat, the chat's harness (remembered model only if same harness); in a draft, `currentModel()` (remembered if ready, else first match of `/astra|sol|fable|opus/i`, else first ready default). Picking another harness in a non-empty chat moves the typed text to a fresh draft.
- `Transcript` renders `transcript.items` plus the optimistic item; `running` = summary status `running`/`waiting` or optimistic pending; `waiting` = `transcript.pending !== null`.
- A `PendingRequest` shows `QuestionCard`; its answers go to `respond(chatId, requestId, { answers } | "skip")` → `request.respond`. Stop calls `interrupt(chatId)` → `turn.interrupt`.
- `deleteChat` unsubscribes, requests `chats.delete`, drops the chat from `lists`, `chats`, `drafts`, and repoints the active chat.
- `startChat()` (home view handoff) sets the Chat tab, forces `layout.uiVisible = true`, sends the first turn with `chatId: null`; on failure the text and attachments become the project's draft.
- `leftSidebarWidth()` returns 340 px on the Chat tab, 264 px on Assets.

## Interfaces

- Depends on:
  - `packages/agent-chat/src` ([README](../../../../packages/agent-chat/src/README.md)): `AgentChatClient`, `reduce`, `emptyTranscript`, `AgentChatError`, and the types `ChatEvent`, `ChatSnapshot`, `ChatSummary`, `HarnessInfo`, `Item`, `ModelRef`, `PendingRequest`, `Question`, `RequestResponse`, `ConnectionState`, `Transcript`. Request names: `harnesses.list`, `chats.list`, `chats.delete`, `turn.send`, `turn.interrupt`, `request.respond`.
  - `apps/desktop/src/main-channels.ts` ([README](../../../desktop/src/README.md)): `MAIN_CHANNELS.AGENT_CHAT_ENDPOINT`, `MAIN_CHANNELS.APP_OPEN_EXTERNAL`. Handler in `apps/desktop/src/main.ts` (`agentChatEndpoint()` from `apps/desktop/src/agent-chat.ts`).
  - `apps/web/src/lib/ipc` (`mainBridge`), `apps/web/src/lib/store` (`createStoredSignal`), `apps/web/src/lib/cva` (`cx`), `apps/web/src/lib/desktop-app` (`downloadDesktopApp`) ([README](../lib/README.md)).
  - `apps/web/src/init` (`store as settings`), `apps/web/src/hooks/use-project-route` (`projectRoute`) ([README](../hooks/README.md)), `apps/web/src/context/project` (`useProject`) ([README](../context/README.md)), `apps/web/src/projects` (`ProjectInfo` type) ([README](../projects/README.md)).
  - `apps/web/src/components/ui` ([README](../components/ui/README.md)): `Button`, `Icon`, `Tooltip*`, `DropdownMenu*`, `RemoveButton`.
  - npm: `solid-js`, `solid-js/store`, `somoto` (toast), `marked`, `dompurify`.
  - `window.desktop` (preload bridge): `getPathForFile(file)` for attachment paths.
- Used by:
  - `apps/web/src/components/sidebar-left/sidebar-left.tsx` ([README](../components/sidebar-left/README.md)): renders `ChatPanel` when `sidebarTab() === "chat"`.
  - `apps/web/src/components/sidebar-left/assets.tsx`: renders `SidebarTabs` in the Assets header.
  - `apps/web/src/components/dashboard/home-view.tsx` ([README](../components/dashboard/README.md)): `ModelPicker`, `currentModel`, `setStoredModel`, `startChat`, `AttachmentTile`, `DropOverlay`, `createDropZone`, `mergeAttachments`, `attachmentPaths`, `Attachment`.
  - `apps/web/src/pages/editor.tsx` ([README](../pages/README.md)): `leftSidebarWidth()` sizes the grid column and title bar.

Up: [../README.md](../README.md)
