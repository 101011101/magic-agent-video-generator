# `apps/web/src/hooks`

Reusable SolidJS hooks: small reactive primitives (signals + cleanup) that wrap browser, desktop-IPC, audio, pointer, and router state for the editor UI.

## Parts

| Part | Role |
|---|---|
| `use-avatar.ts` | `useAvatar()` → `Accessor<string \| null>`. Reads `auth.user().user_metadata.avatar_url` from `@/context` `useAuth`. HTTP URL: returned as is. Storage path: downloads from Supabase bucket `avatars` and returns a `blob:` object URL; revokes the previous blob URL on change and on cleanup. |
| `use-click-position.ts` | `useClickPosition()` → `{ position, setFromEvent }`. Stores `{x, y}` from `clientX`/`clientY` of a pointer/mouse event in a signal. No importers found in `apps/web/src`. |
| `use-controlled-selection.ts` | `useControlledSelection({ value?, defaultValue, getValue, onChange? })` → `[selectedValue, select]`. Controlled/uncontrolled selection pattern: if `value` accessor given, it wins; else internal signal holds `getValue(item)`. `select(item)` always calls `onChange`. |
| `use-cursor.ts` | `useCursor()` → `{ set(el, type, rotation, color), get(el) }` and `CursorType` union. Sets the timeline canvas cursor via CSS var `--tl-cursor`. Static types (`default`, `grab`, ...) map to CSS keywords; resize/rotate types render inline SVG rotated by `rotation` (radians → degrees) as a `data:image/svg+xml` cursor; `trim-left`/`trim-right` embed self-contained SVGs. Caches last hash per element in `CURSOR_CACHE` to skip redundant writes. |
| `use-drag.ts` | `useDrag({ onDragStart?, onDragMove?, onDragEnd?, disabled? })` → `{ isDragging, onPointerDown }`. Pointer-capture drag: on pointerdown it captures the pointer, adds `select-none` to `body`, and attaches window `pointermove`/`pointerup`/`pointercancel` listeners; filters events by `pointerId`; removes listeners on end and on `onCleanup`. |
| `use-fullscreen-state.ts` | `useFullscreenState()` → resource `isFullscreen`. Desktop only: calls `mainBridge.call(MAIN_CHANNELS.WINDOW_IS_FULLSCREEN)` and subscribes to `WINDOW_FULLSCREEN_CHANGE`. Mirrors the value onto `<html data-fullscreen>` so the theme can drop the macOS vibrancy background in fullscreen. Web: resolves `false`. |
| `use-mobile.ts` | `useIsMobile()` → signal of `matchMedia("(max-width: 767px)").matches`; updates on `change`. Returns `() => false` on server. No importers found in `apps/web/src`. |
| `use-permission.ts` | `usePermissionState(name)` → signal `PermissionState` (`"granted" \| "denied" \| "prompt" \| "unsupported"`). Wraps `navigator.permissions.query({ name })` and its `change` event; `"unsupported"` when the API or the name is unavailable. |
| `use-project-route.ts` | `projectRoute(id)` → `/projects/<encoded id>`. `ProjectRouteState = { returnTo?: string }`. `useReturnHere()` → function that returns `{ returnTo: pathname + search }` for navigation state. `useProjectRef()` → memo of the `/projects/*ref` param (project id, or legacy folder name; `resolveProject` in `@/projects` decides). |
| `use-volume-meter.ts` | `useVolumeMeter()` → `{ levels, connect(gainNode), disconnect() }`; `ChannelLevels = { rms, peak }` per channel (mono padded to stereo). One shared `AudioWorkletNode('volume-meter')` per `GainNode` (`sharedMeters` WeakMap) fans levels out to all listeners; last listener detaching disconnects the worklet. `subscriptionToken` discards a `subscribe()` that resolves after a newer `connect()`/`disconnect()`. `getVolumeMeterWorkletUrl()` builds the worklet from `volumeMeterWorkletCode()` (an inline `AudioWorkletProcessor` that does pass-through, RMS/peak smoothing with attack/release, peak-hold with decay, and posts `Float32Array [rms0, peak0, rms1, peak1]` every `updateIntervalMs`, default 16 ms) as a Blob URL. |

## How it works

- Each hook is a plain function that creates Solid signals/resources and registers `onCleanup`. It must be called inside a Solid component or root.
- Hooks do not import each other. Each one owns one concern: auth avatar, pointer drag, cursor CSS, permission state, fullscreen IPC, router params, audio metering.
- `use-cursor.ts` writes a CSS custom property, not `style.cursor` directly, so the element's stylesheet can keep `cursor: var(--tl-cursor)`. The stage cursor is a separate, similar implementation in `apps/web/src/engine/input/cursor.ts`; this hook is the timeline's and also holds the trim cursors.
- `use-volume-meter.ts` runs the meter math on the audio thread. The main thread only receives ready values via `port.onmessage` and writes them to a signal. The worklet output is left unconnected so it does not double the signal into the destination.
- `use-fullscreen-state.ts` is the only hook that talks to the Electron main process; it guards on `window.desktop` (declared in `apps/web/src/vite-env.d.ts`).

## Interfaces

- Depends on:
  - `solid-js`, `solid-js/web` (`isServer`), `@solidjs/router` (`useLocation`, `useParams`).
  - `@/context` `useAuth` and `@/lib/supabase` → `use-avatar.ts` ([../context/README.md](../context/README.md), [../lib/README.md](../lib/README.md)).
  - `@/lib/ipc` `mainBridge` and `@desktop/main-channels` `MAIN_CHANNELS` (`apps/desktop/src/main-channels.ts`) → `use-fullscreen-state.ts`.
  - Web APIs: `navigator.permissions`, `matchMedia`, `AudioWorklet`, `setPointerCapture`, `URL.createObjectURL`.
- Used by:
  - `useAvatar` ← `components/dashboard/sidebar.tsx`, `components/dashboard/account-view.tsx`.
  - `useControlledSelection` ← `components/sidebar-right/inspector/styles-modal.tsx`.
  - `useCursor` ← `engine/timeline/timeline.ts`; `CursorType` ← `engine/timeline/surface.ts` ([../engine/README.md](../engine/README.md)).
  - `useDrag` ← `components/ui/color-opacity-picker.tsx`, `components/sidebar-right/inspector/gradient-picker.tsx`.
  - `useFullscreenState` ← `dapi/api.tsx`, `pages/dashboard.tsx`, `pages/login.tsx`.
  - `usePermissionState` ← `components/dashboard/settings-view.tsx`, `components/sidebar-right/inspector/text.tsx`.
  - `projectRoute` / `useReturnHere` / `useProjectRef` ← `pages/project.tsx`, `dapi/api.tsx`, `agent-chat/store.ts`, `components/dashboard/home-view.tsx`, `components/dashboard/projects-view.tsx`, `components/sidebar-left/project-menu/index.tsx`, `components/sidebar-left/project-menu/file-menu.tsx`.
  - `useVolumeMeter` ← `components/sidebar-right/soundboard/volume-meter.tsx`, `components/sidebar-right/inspector/audio.tsx`.
  - `useIsMobile`, `useClickPosition`: no importers found in `apps/web/src`.

Up: [../README.md](../README.md)
