# `apps/web/src/lib/store`

Namespaced key-value persistence over `localStorage`, exposed to Solid components as reactive signals for UI preferences.

## Parts

| Part | Role |
| --- | --- |
| `store.ts` | `class Store(namespace?, storageEngine = localStorage)`. `define<T>(key, defaultValue, deserializer?)`: reads the stored value; writes `defaultValue` when absent; runs `Deserializer<T>` (sync or async) on stored data; returns a `StorageItem<T>`. `set(key, value)` writes `JSON.stringify({ value })`. `get(key)` parses `.value` or returns `null`. `remove(key)`. Keys are prefixed `${namespace}.${key}`. |
| `storage-item.ts` | `class StorageItem<T>(store, key, value \| Promise<T>)`. `value` getter returns the current value; setter writes it and calls `store.set`. `loaded` becomes true after an async initial value resolves. |
| `signal.ts` | `createStoredSignal<S>(storageItem)`: wraps `StorageItem.value` in a Solid `createSignal`. Returns `[value, updateValue]`; `updateValue` skips equal values, then sets the signal and `storageItem.value`. |
| `index.ts` | Re-exports the three modules. |

## How it works

- `apps/web/src/init.ts` creates the single app instance: `export const store = new Store('dspro.ui')`.
- A component calls `store.define(key, default)` to get a `StorageItem`, then `createStoredSignal(item)` to get a reactive accessor and setter.
- Reads come from the in-memory `StorageItem._value`; writes go to both the Solid signal and `localStorage` under `dspro.ui.<key>`.
- A `deserializer` converts stored JSON into a richer or validated value (see `apps/web/src/engine/object-mask/store.ts` for `Sam2ModelId`).
- No cross-tab sync and no change events on the `Store` itself; reactivity exists only through `createStoredSignal`.

## Interfaces

- Depends on:
  - `solid-js` `createSignal`.
  - Browser `Storage` (`localStorage` by default; any `Storage` can be injected).
- Used by:
  - `apps/web/src/init.ts` (creates `store`).
  - `createStoredSignal` + `store.define` in: `apps/web/src/context/layout.tsx` (`layout.uiVisible`, `layout.timelineHeight`, `layout.timelineMinimized`), `apps/web/src/components/timeline/layers/layers.tsx` (`timeline.timeFormat`), `apps/web/src/components/canvas/desktop-app-banner.tsx`, `apps/web/src/components/dashboard/get-desktop-app.tsx`, `apps/web/src/components/genai/prompt-input.tsx` (`prompt-input.recent-prompts`, `prompt-input.settings-visible`), `apps/web/src/components/sidebar-right/inspector/time.tsx` (`time.addons`), `apps/web/src/components/sidebar-right/inspector/transform/transform-settings.tsx` (`transform.addons`), `apps/web/src/agent-chat/store.ts` (`leftSidebar.tab`, `agentChat.model`, `agentChat.active`), `apps/web/src/engine/object-mask/store.ts` (`object-mask.model`).

Up: [../README.md](../README.md)
