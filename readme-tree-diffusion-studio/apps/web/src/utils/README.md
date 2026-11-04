# `apps/web/src/utils`

Framework-free helper functions for the web editor (assert/clamp, browser file and color APIs, color math, display formatters, Solid signal helpers) plus `gen-ai.ts`, the editor's concrete `GenAi` service that turns `generate.*`/`transform.*` declarations into library assets through the tRPC backend.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports `common`, `signal`, `browser`, `color`, `media`. Not `formatters` and not `gen-ai`; those are imported by path. |
| `common.ts` | `assert(cond, msg?)` (throws `Error`), `assertAllSettled(results)` (throws if any `PromiseSettledResult` rejected), `clamp(v, min, max)`, `attempt(fn)` → `{ result } \| { error }`, `AsyncMutex` (`acquire()` resolves to a release function; chains promises), `formatAssetDuration(asset)` (`H:MM:SS`/`M:SS` for `VIDEO`/`AUDIO`/`SEQUENCE`/`MASK`, else `null`), `intersect([a,b],[c,d])` (open-interval overlap). |
| `browser.ts` | `getCssVar(name)` → `colord` of a root CSS custom property. `pickScreenColor()` → hex from `window.EyeDropper`, `null` on cancel/unsupported. `verifyHandlePermission(handle, mode)` / `verifyHandlePermissions(handles, mode)` → query then request File System Access permission; batch variant requests all pending handles in parallel so Chromium shows one prompt. `showFileDialog(accept, multiple)` → `showOpenFilePicker` on web, or `<input type=file>` fallback that wraps Electron paths as `ElectronFileHandle`. `downloadObject(blob, name?)` → anchor click on an object URL; appends extension from MIME via `mimeTypeToExtension`. `isInputTarget(e)` → keyboard event target is `INPUT`/`TEXTAREA`/contentEditable. |
| `color.ts` | Numeric color model `0xRRGGBB`. `parseColor(input)` → number or `null`: named color table (`NAMED_COLORS`), then `colord`, then Figma-style hex fallback (strip non-hex, normalize 1–7+ chars to 6). `rgbToHsl`, `hslToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToColor(r,g,b)`, `colorToRgb(color)`, `colorToHex(color)` → `#RRGGBB`, `mergeColorWithOpacity(color, opacity)` → `rgba()` string. |
| `formatters.ts` | Display strings: `formatBytes` (base-1024, 0–2 decimals), `formatAspectRatio(w,h)` (reduced by GCD, `W:H`), `formatMimeTypeLabel` (MIME → "MPEG-4 Movie" etc.), `formatDuration(seconds)` (`MM:SS`/`HH:MM:SS`), `formatChannels` (`Mono`/`Stereo`/`N ch`), `formatAssetDate` (`Today, HH:MM` or `Mon D, HH:MM`). |
| `media.ts` | `mimeTypeToExtension(mime)` → `.jpg`, `.mp4`, ... or `.bin` (table of image/audio/video/document/web types; strips `;charset`). `stripExtension(name)`. |
| `signal.ts` | Solid helpers. `SignalFunction<T>`: one function that reads with no args and writes with one; `createSignalFunction(initial)`. `createRootMemo(fn)` → `[memo, dispose]` and `createRootEffect(fn)` → `dispose`, both under `createRoot`. `onCreated(fn)` runs `fn` immediately. `mergeProps(target, ...sources)` → `Object.assign` semantics that preserve property descriptors (getters/setters) for string and enumerable symbol keys; typed as ordered object spread. |
| `gen-ai.ts` | `attachAi(world, library, dir?)` creates `EditorGenAi` and sets it as the world's `Ai` trait. `class EditorGenAi extends GenAi` (from `@diffusionstudio/runtime`) implements `resolve(ref)` and `transcribe(world, scene, seed)`. See "How it works". |

## How it works

- Barrel consumers import `from "@/utils"`; `formatters.ts` and `gen-ai.ts` are imported by path (`@/utils/formatters`, `@/utils/gen-ai`).
- Internal dependencies: `color.ts` → `common.ts` (`clamp`); `browser.ts` → `media.ts` (`mimeTypeToExtension`), `@/lib/electron-file-handle`, `colord`; `gen-ai.ts` → `common.ts` (`assert`), `media.ts` (`mimeTypeToExtension`).
- `gen-ai.ts` flow (`EditorGenAi`):
  - `resolve(ref)`: memoizes per `AssetRef` identity in `memo` so one ref used by many elements resolves once; a rejected promise is dropped from the map.
  - `generateFromRef`: `getAssetSpec(ref)` → `resolveSpec` resolves every `AssetInput` (nested refs via `resolve`, plain inputs via `library.resolve`) and applies defaults (first model in `@/components/genai/config` option lists, `16:9`, video `duration 5`, `audio false`). Result is a `ResolvedGeneration` or `ResolvedTransform` with fixed field order; `JSON.stringify` of it is the `generationKey`.
  - `generated(key, describe, run)`: asks `library.generated(key)`. Finished asset → return. Partial in `error` → throw `ReportedError` with the recorded reason (no re-run, no second toast). In `inflight` → join. Else `library.reserve({ key, folder: GENERATED_DIR, type, name })` creates a pending `PartialAsset`, then `run(partial)`; on failure `reportFailure` toasts (`somoto`, id `gen-ai:<title>:<message>`) and `library.fail(partial, message)`.
  - `runGeneration`: `checkVideoConstraints` against `PROMPT_INPUT_VIDEO_MODEL_OPTIONS` (aspect ratios, durations, audio, end-frame); uploads referenced assets via `uploadInput` (`uploadBlob(getAssetFile(asset), "<projectId>-<assetId>")`); calls `trpc.generateImage` / `generateVideo` / `textToSpeech` / `generateSound`; `store(url, name, { key, id })` fetches the result and `library.store`s it under `GENERATED_DIR` with extension from `resultExtension` (blob MIME, else URL suffix ≤ 5 chars, else none). Emits `track("generation_started" | "generation_completed" | "generation_failed")`.
  - `runTransform`: `checkTransformInput` (removeBackground → IMAGE; upscale → IMAGE or footage; addAudio → footage); uploads input; calls `trpc.removeBackground` / `upscaleImage` / `upscaleVideo` / `addAudioToVideo`; stores result named `<stem> (<suffix>)`.
  - `transcribe(world, scene, seed)`: key `transcript:v1:<sceneId>:<seed>` where `sceneId` is the scene's `Source` locator (from `parseSource`) or entity id. `sceneHasAudio` walks `getEntityTree` for an unhidden, unmuted entity with `AssetId` and `Audio` or `Paint === VIDEO`. `runTranscription`: `createCapture(world, scene, { mode: "offline-audio", dir })` → `createEncoder(..., { format: "ogg", audio: { codec: "opus", sampleRate: 24000 }, video: { enabled: false } })` → `uploadBlob` → `trpc.transcribe` → stores JSON as `Captions N.json` (`nextCaptionsName` counts library assets and partials).
  - Names: `provisionalName(prompt)` (first 48 chars, cut at a word) names the partial; the model's returned name plus `resultExtension` names the stored asset.

## Interfaces

- Depends on:
  - `solid-js` (`signal.ts`), `colord` (`browser.ts`, `color.ts`), `somoto` toast (`gen-ai.ts`).
  - `@/lib/electron-file-handle` (`browser.ts`); `@/lib/uploads` `uploadBlob`, `@/lib/analytics` `track`, `@/lib/trpc` `trpc` (`gen-ai.ts`) — [../lib/README.md](../lib/README.md).
  - `@/engine/capture` `createCapture` (`gen-ai.ts`) — [../engine/README.md](../engine/README.md).
  - `@/components/genai/config` model/voice option lists (`gen-ai.ts`) — [../components/README.md](../components/README.md).
  - Packages: `@diffusionstudio/runtime` (`GenAi`, `Ai`, `Project`, `Source`, `AssetId`, `Audio`, `Hidden`, `Muted`, `Paint`, `PaintType`, `getAssetFile`, `getEntityTree`), `@diffusionstudio/jsx` (`getAssetSpec`, `isAssetRef`, `isTransformSpec`, `isTransformType`, `parseSource`, spec types), `@diffusionstudio/assets` (`AssetLibrary`, `PartialAsset`, `GENERATED_DIR`, `assetName`, `isPartialAsset`), `@diffusionstudio/encoder` (`createEncoder`), `@diffusionstudio/api-contract` (`FileRef`), `koota` (`World`, `Entity`) — [../../../../packages/README.md](../../../../packages/README.md).
  - `window.desktop` and `showOpenFilePicker` typings in `apps/web/src/vite-env.d.ts`.
- Used by (31 files import `@/utils*` in `apps/web/src`):
  - `attachAi` ← `pages/editor.tsx` only. The runtime calls the attached `Ai` from `packages/runtime/src/systems/assets.ts` and `packages/runtime/src/actions/assets.ts`.
  - `assert` ← 13 files (e.g. `context/auth.tsx`, `context/timeline.tsx`, `context/export.tsx`). `clamp` ← 14 files (e.g. `components/ui/select.tsx`). `intersect` ← `engine/capture.ts`, `engine/timeline/pointer.ts`, `components/sidebar-right/inspector/clip-paths.tsx`. `formatAssetDuration` ← `components/sidebar-left/asset-item.tsx`.
  - `colorToHex` ← 17 files; `parseColor` ← 6 files; HSL/HSV converters, `rgbToColor`, `colorToRgb`, `pickScreenColor` ← `components/ui/color-opacity-picker.tsx`; `mergeColorWithOpacity` ← `components/ui/fill-item.tsx`, `components/sidebar-right/inspector/gradient-picker.tsx`.
  - `formatters.ts` ← `components/sidebar-right/inspector/asset-info.tsx`, `asset-info-preview.tsx`, `export.tsx`, `export-progress.tsx`.
  - `mergeProps` ← 7 files (e.g. `components/ui/dialog.tsx`, `dropdown-menu.tsx`, `floating-inspector.tsx`).
  - `downloadObject` ← `context/export.tsx`. `isInputTarget` ← `context/export.tsx`, `components/sidebar-left/assets.tsx`, `components/sidebar-left/project-menu/index.tsx`, one more. `mimeTypeToExtension` ← `components/sidebar-left/project-menu/file-menu.tsx`.
  - No importers found in `apps/web/src`: `assertAllSettled`, `attempt`, `AsyncMutex`, `getCssVar`, `verifyHandlePermission(s)`, `showFileDialog`, `stripExtension`, `onCreated`, `createSignalFunction`, `createRootMemo`, `createRootEffect`.

Up: [../README.md](../README.md)
