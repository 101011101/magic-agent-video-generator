# `apps/web/src/dapi/handlers`

One handler per renderer-side agent tool: each takes parsed tool args plus a `ToolContext` and returns the tool's typed result for the desktop MCP server.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Exports `handlers: Handlers`, the map from catalog tool name (`open`, `context`, `capture`, `check`, `export`, `models`, `voices`, `fonts`, `screenshot`, `media_probe`, `media_grab`, `media_transcribe`, `media_filmstrip`, `media_waveform`, `media_listen`, `media_segment`) to its handler. `logs` and `report` are not here; they run in the main process (`ServedToolName` in `../handler.ts`). |
| `open.ts` | `open`: rejects a non-absolute `dir` with `DapiError("invalid-input")`, then calls `ctx.app.openProject(dir)`. |
| `context.ts` | `context`: reports what the project JSX cannot: `rootDir` (`getProjectsRoot()`), `projectDir`, `currentTime` (active entity `Computed.localTime / FrameRate`, seconds), `fontFamilies` (`"Inter"` plus `Fonts.list`), `generations` (`collectGenerations`: `Generating` / failed `SourceError` / `AssetId` with `asset.generation` → rows `generating`/`failed`/`done`), `masks` (`maskTrackRows` from `media-segment.ts`). Returns nulls and empty lists with no session. |
| `capture.ts` | `capture`: renders frames of a scene. `requireScene` → `createCapture(world, scene)` (isolated world) → `createImageEncoder(target.world, { frames, resolution: 720 })`. `times` (seconds) → frame numbers via `TIME_FPS`; default `[0]`. Unless `separate`, frames go into a `SheetCollector` sized to at least `SHEET_CAPTURE_HEIGHT` (1080) tall; `encoder.resize(sheets.cellHeight)`. Disposes the capture world in `finally`. |
| `check.ts` | `check`: static lint of a node subtree. `resolveNode` → window = `Computed` span narrowed by `Workarea` → `visit()` walks `Cache.children` and `Cache.clipPaths`, counts nodes by `kindOf` (scene/group/sequence/adjustment-layer/audio/caption/text/video/image/html/shape/clip-path), emits per-node `CheckIssue`s (`source-error`, `zero-duration`, `transparent` when static `Opacity` 0, `never-visible`), collects coverage intervals for nodes where `drawsPixels`. `findGaps` → `black-frames` (error, with `ranges`); no coverage → `no-visuals` (warning if audio-only, else error). Returns `{ stats: { nodes, byKind, depth, duration }, issues }`. |
| `export.ts` | `export`: encodes a scene to a file. Reads the scene's config from `ProjectConfigTrait.exportOf(scene)` or `getDefaultExportTemplate()`. `resolveFormat` (output extension wins over config; must be in `VIDEO_FORMAT_OPTIONS`), `reconcileCodecs` (swaps codecs the container cannot hold: `FALLBACK_VIDEO` avc/vp9, `FALLBACK_AUDIO` aac/opus; muxers imported on demand from `mediabunny`). Prechecks `canEncodeVideo` at `computeOutputSize`; throws `busy` if `renderOverlay()` is set. Writes through `ElectronWritableFileHandle` via `renderScene(engine, { ..., source: "agent" })`; disposes the handle on failure. Default target `<project>/exports/<sceneConfigKey>.<format>`. Returns `{ path, width, height, duration, size, config }` (size from `MAIN_CHANNELS.PROJECTS_FS_STAT`). |
| `fonts.ts` | `fonts`: lists machine fonts from `getLocalFonts()` (Local Font Access), skips families starting with `.`, filters by `family` substring, `weights`, `style` (`FontStyle.NORMAL` → `normal`, else `italic`), sorts, slices to `limit` (`FONT_LIMIT`). Returns `{ families, total }`. |
| `models.ts` | `models`: flattens `PROMPT_INPUT_{IMAGE,VIDEO,AUDIO}_MODEL_OPTIONS` from `@/components/genai/config` into `ModelInfo[]`, filtered by `type`. Video entries carry `durations`, `aspectRatios`, `features`. |
| `voices.ts` | `voices`: maps `PROMPT_INPUT_VOICE_OPTIONS` to `{ id, label, description }`. |
| `screenshot.ts` | `screenshot`: `mainBridge.call(MAIN_CHANNELS.WINDOW_CAPTURE)`; the main process captures the window. |
| `media-probe.ts` | `media_probe`: `resolveAsset` → `getAssetFile` → `mediabunny` `Input`. Returns asset identity (`id`, `name`, `path`, `type`, `mimeType`, `size`, `width`/`height`), container `format`, `duration`, metadata `tags` (raw dropped; `attachedImages` count), and per-track rows with `computePacketStats(PROBE_SAMPLE_PACKETS=200)`, video coded/display size and `rotation`, audio `sampleRate`/`channels`. On decode failure returns `format: null, tracks: []`. |
| `media-grab.ts` | `media_grab`: decodes video frames. Selection: explicit `times` (negative = from end via `resolveTime`), `count` evenly across `[start,end]`, or `auto` via `pickInformativeTimes` (cap `count ?? AUTO_MAX_FRAMES=30`). Downscales to `FRAME_QUALITY_BUDGETS[quality]` (small 384², medium 768², large 1536², fullres 0); default `small` when `separate`, else `fullres`. Decodes in ascending time through `CanvasSink.canvasesAtTimestamps` (offset by `track.getFirstTimestamp()`), restores requested order. Returns `TimecodedImage[]` (`encodePng`) or `SheetCollector.result()`. |
| `media-filmstrip.ts` | `media_filmstrip`: `filmstripAsset(asset, { start, end, scale })` from runtime; converts `dataUrl` to bytes with `dataUrlToBytes`. |
| `media-waveform.ts` | `media_waveform`: same shape as filmstrip, using `waveformAsset`. |
| `media-transcribe.ts` | `media_transcribe`: `transcodeForTranscription(asset)` → `uploadBlob` → `trpc.transcribe.mutate({ audio: fileRef })`. Caches `TranscriptSegment[]` per `asset.id` in a module-level `Map` for the app's lifetime. Throws when no segment has words. |
| `media-listen.ts` | `media_listen`: `ctx.app.requireUser()`; builds a deterministic `uploadId` from project id, asset id, and `[start,end]` window; `trpc.getUploadUrl.mutate({ action: "resumable" })`. If the server returns an `uploadUrl`, streams `transcodeForAnalysis(asset, { start, end, stripVideo })` (video → `audio/ogg`) through `startResumableSession`/`uploadResumableStream`. Then `trpc.analyze.mutate({ media: fileRef, prompt })`. Returns `{ result, start, end }`. |
| `media-segment.ts` | `media_segment`: SAM 2 object segmentation and tracking on a video (see below). Also exports `maskTrackRows(world)` for `context`. |

### `media-segment.ts` detail

- Frame grid: `fps` = project `FrameRate` or the asset's own; `first`/`count` from `start`/`end`; `seedFrame` from `time`.
- `prompts(args)`: `points` (label 1), `exclude` (label 0), `box` corners (labels 2, 3) → `Sam2Point[]`.
- `destination(output, session)`: `undefined` → library (default name) or server when no project; absolute path → `server`; URL → error; relative → library path that must end in `MASK_EXTENSION` and, if it exists, be a replaceable project mask (`isReplaceableMask`).
- Library target → `startTrack`: pushes a `TrackRow` (`state: "loading"`) into a `WeakMap<World, TrackRow[]>`, adds `src` to `pendingMaskPaths`, runs `runTrack` in the background, returns `{ path, src, state: "tracking", ...span }` at once. `runTrack` calls `segmentFootage` with `onDownload`/`onProgress` updating the row, aborts if `current()?.world` changes, then `contactSheet` + `encodeTrack` (`encodeObjectMask`) + `storeMask` (write over and `library.relink`, or `library.store`). Row ends `done` (with `png`, bbox, area, score, iou, lost, weak) or `failed`.
- Preview or server target → `segmentFootage` synchronously with `ctx.signal`; preview returns `previewImage` (prompted frame, mask, tenths grid, prompt marks, `PREVIEW_WIDTH` 1024), otherwise `contactSheet` (`SHEET_FRAMES` 6 frames at `SHEET_FRAME_WIDTH` 512) plus the mask file bytes, `state: "done"`.
- `describeFound`: `measure` (bbox and area from `MaskFrame.field` on `grid`), `spans` for `lost` (`isLost`) and `weak` (`iou < WEAK_IOU`), both in source seconds.
- Drawing: `drawMask` (magenta `OUTSIDE` wash outside the traced mask, white-on-dark outline via `traceMask`), `drawPrompts`, `drawGrid`, `drawGridLabels`, `drawLabel`.

## How it works

- The desktop main process runs the MCP server and validates tool args against the `@diffusionstudio/dapi` catalog, then sends a `DapiCall` over `DAPI_WIRE.CALL`.
- `../bridge.ts` (`ToolBridge.dispatch`) looks up `handlers[call.tool]`, builds a `ToolContext` (session accessor, `requireSession`, `signal`, `app.openProject`, `app.requireUser`), awaits the handler, and replies over `DAPI_WIRE.REPLY`; `DAPI_WIRE.CANCEL` aborts `ctx.signal`.
- `../api.tsx` registers this map once with `toolBridge.register(handlers, context)`.
- Handlers share helpers from `../lib`: `resolveAsset`/`requireAssetType` (asset tools), `requireScene` (`capture`, `export`), `resolveNode` (`check`), `SheetCollector` (contact sheets for `capture`, `media_grab`, `media_segment`), `pickInformativeTimes` (`media_grab` auto), `dataUrlToBytes` (filmstrip, waveform).
- Errors are `DapiError(code, message)` with codes such as `invalid-input`, `no-project`, `wrong-kind`, `not-found`, `busy`, `canceled`, `unsupported`; the bridge forwards `code` to the caller.
- Three kinds of work: read app state (`context`, `models`, `voices`, `fonts`, `screenshot`), render the composition (`capture`, `check`, `export`), inspect or process a media asset locally (`media_probe`, `media_grab`, filmstrip, waveform, `media_segment`) or through the cloud API (`media_transcribe`, `media_listen` via `trpc`).

## Interfaces

- Depends on:
  - `apps/web/src/dapi/handler.ts` (`ToolHandler`, `ToolContext`, `Handlers`, `ServedToolName`), `apps/web/src/dapi/session.ts` (`EditorSession`), [`../lib/`](../lib/README.md).
  - `packages/dapi` (`DapiError`, result and arg types, `FONT_LIMIT`, `WEAK_IOU`; tool schemas in `packages/dapi/src/tools/*.ts` mirror this folder file-for-file).
  - `packages/runtime` (traits `Computed`, `Workarea`, `FrameRate`, `Fonts`, `Library`, `Source`, `SourceError`, `Generating`, `AssetId`; `getAssetFile`, `getVideoTrack`, `filmstripAsset`, `waveformAsset`, `transcodeForTranscription`, `transcodeForAnalysis`, `formatTimecode`).
  - `packages/encoder` (`createImageEncoder`, `encodePng`, `decodePng`, `computeOutputSize`), `packages/assets` (`isAbsoluteSource`, `isProjectSource`, `isUrlSource`, `traceMask`, `MASK_EXTENSION`, `ASSETS_DIR`), `packages/jsx` (`TIME_FPS`), `mediabunny` (`Input`, `CanvasSink`, `canEncodeVideo`, output formats).
  - App modules: `apps/web/src/engine/capture.ts`, `apps/web/src/engine/fonts.ts`, `apps/web/src/engine/object-mask/{commit,tracking}.ts`, `apps/web/src/engine/project-config.ts`, `apps/web/src/engine/traits.ts`, `apps/web/src/context/render.tsx` (`renderScene`, `renderOverlay`), `apps/web/src/components/genai/config.ts`, `apps/web/src/components/sidebar-right/inspector/export-templates.ts`, `apps/web/src/lib/{ipc,trpc,uploads,electron-file-writable}.ts`, `apps/web/src/projects` (`getProjectsRoot`), `apps/desktop/src/main-channels.ts` (`MAIN_CHANNELS.WINDOW_CAPTURE`, `PROJECTS_FS_STAT`).
- Used by:
  - `apps/web/src/dapi/api.tsx` (imports `handlers`, registers with `toolBridge`).
  - `apps/web/src/dapi/bridge.ts` (dispatches each `DapiCall` to a handler).
  - `apps/desktop/src/dapi/renderer-calls.ts` (main-process side that sends calls and receives replies over `DAPI_WIRE`).
  - `context.ts` imports `maskTrackRows` from `media-segment.ts` (only cross-file import inside this folder).

Up: [../README.md](../README.md)
