# `packages/encoder`

`@diffusionstudio/encoder`: offline export of a runtime capture world. Steps the runtime systems frame by frame, draws into the world's canvas, renders audio through an `OfflineAudioContext`, and muxes both with mediabunny into mp4/webm/mov/ogg. Also renders single frames to PNG and composes labelled contact sheets for agents.

## Parts

| Part | Role |
| --- | --- |
| [src/](src/README.md) | All code. `src/index.ts` re-exports every module below. |
| `src/encoder.ts` | Video/audio export. `createEncoder(world, config)` returns `{ render, cancel }`. `captureScene(world)` asserts the world holds exactly one scene under `Root`. `warmupAssets` runs `assetSystem` (up to 16 passes) until nothing is in flight. `resolverSystem` awaits `FramePromises`. `normalizeSceneTransform` zeroes the scene's own transform each tick. Inline `SinkProcessor` AudioWorklet (registered as `sink`) streams render quanta to the main thread, paced by a `SharedArrayBuffer` counter. |
| `src/image-encoder.ts` | Still capture. `createImageEncoder(world, { frames, resolution })` returns `{ render, cancel, resize, bounds }`; `render` yields `CapturedImage { png, timecode }[]` in requested order. Adds `Silent` to the world so no audio decoders start. |
| `src/contact-sheet.ts` | Frame grids for vision models. `SHEET_MAX_WIDTH = 2576`, `SHEET_MAX_HEIGHT = 1456`, `MAX_FRAMES_PER_SHEET = 12`. `planSheet` picks columns/rows; `planSheetSizes` balances a run across sheets; `composeSheet` draws frames with `stampTimestampLabel`; `sheetTimecode` names the span. |
| `src/png.ts` | `encodePng(canvas)` -> `Uint8Array`; `decodePng(bytes)` -> `ImageBitmap`. |
| `src/buffer.ts` | `TargetBuffer.create(handle?)`: `StreamTarget` over a writable file handle, else in-memory `BufferTarget` with mp4 `fastStart: 'in-memory'`. `close(format)` returns a `Blob` for the in-memory case. |
| `src/format.ts` | `createOutputFormat(buffer, format)`: lazy-imports mediabunny `Mp4OutputFormat`, `WebMOutputFormat`, `OggOutputFormat`, `MovOutputFormat`. |
| `src/interfaces.ts` | Config types. `EncoderConfig { video?, audio?, format?, target?, onProgress?, comment? }`. `VideoConfig` (`codec` default `avc`, `bitrate` 10e6, `resolution` 1080 = shorter side, `fps`). `AudioConfig` (`codec` `aac`, `sampleRate` 48000, `numberOfChannels` 2, `bitrate` 128e3). `ImageEncoderConfig { frames, resolution? }`. |
| `src/types.ts` | `ContainerFormat`, `WritableFileTarget`, `EncoderProgress { total, progress, remaining }`, `ExportResult` (`success` / `canceled` / `error`). |
| `src/utils.ts` | `computeOutputSize(sceneW, sceneH, resolution)` and `scaleSize`: even-rounded output size and draw scale shared by encoder, image encoder and UI. `createRenderEventDetail`. |

## How it works

- Caller builds a capture world (`apps/web/src/engine/capture.ts` `createCapture`, called from `apps/web/src/context/render.ts`): a fresh runtime world holding one scene, a `RenderSurface` with an `HTMLCanvasElement`, and a `FrameRate`. The world stays the caller's to dispose.
- `createEncoder`:
  - `captureScene` finds the scene; `warmupAssets` resolves all sources.
  - Reads `Workarea` from the scene to bound the frame range. `ogg` forces audio-only.
  - `computeOutputSize` sizes the canvas; `canEncodeVideo` fails early with a readable message.
  - Creates `OfflineAudioContext(channels, duration * sampleRate, sampleRate)` and sets it as the world's `AudioEngine`. Sets `AudioPlayback` offsets so scheduled audio lands in the encoded window.
  - Builds mediabunny `Output` with `CanvasSource` (video, `latencyMode: 'quality'`, alpha kept only for webm without scene fills) and `AudioSampleSource`.
  - Installs the `sink` AudioWorklet between the scene `AudioBus` and the destination. The worklet spins on a shared `Uint32Array` counter; the main loop credits samples per frame so audio rendering stays in step with video.
- `render()` loop per frame: set `Computed.localTime` and `Time`; run `assetSystem`, `playbackSystem`, `resolverSystem`, `motionSystem`, `normalizeSceneTransform`; if video: `transformSystem`, `renderSystem`, `videoSource.add(timestamp)`; if audio: await last sample, credit the counter. Throttled `onProgress` at 3 Hz. `cancel()` aborts the output and unblocks the worklet.
- After the loop: drain remaining audio, `output.finalize()`, return `Blob` (in-memory) or `undefined` (streamed to `config.target`).
- `createImageEncoder` runs the same tick order without audio, in ascending frame order (seeks only go forward), and returns PNG bytes plus a timecode per frame. `resize` retargets the output height before `render`.
- Contact sheets: `planSheetSizes` -> `planSheet` per sheet -> `composeSheet(frames, plan)` -> PNG. Frames are never upscaled past source size.

## Interfaces

- Depends on: [../runtime/README.md](../runtime/README.md) (systems `assetSystem`, `playbackSystem`, `motionSystem`, `transformSystem`, `renderSystem`; traits `Root`, `ChildOf`, `Computed`, `Playback`, `AudioPlayback`, `Workarea`, `Time`, `FrameRate`, `RenderSurface`, `AudioEngine`, `FramePromises`, `Silent`, `Paint`, `Geometry`, transform traits; `AudioBus`, `AudioBusHandle`; `setActive`, `store`, `framesToSeconds`, `formatTimecode`, `stampTimestampLabel`, `assert`), `koota` (`World`, `Entity`, `Not`), `mediabunny` (`Output`, `CanvasSource`, `AudioSampleSource`, `AudioSample`, targets, output formats, `canEncodeVideo`). Browser APIs: `HTMLCanvasElement`, `OfflineAudioContext`, `AudioWorklet`, `SharedArrayBuffer`, `Atomics`, `OffscreenCanvas`.
- Used by [../../apps/web/README.md](../../apps/web/README.md):
  - `src/engine/capture.ts` (`createCapture`) builds the capture world the encoder expects. It does not import this package.
  - `src/context/render.ts` (`createEncoder`, `computeOutputSize`), `src/context/export.tsx` (`computeOutputSize`), `src/components/sidebar-right/inspector/export.tsx` and `export-progress.tsx` (UI export).
  - `src/dapi/handlers/export.ts` (`export` tool), `src/dapi/handlers/capture.ts` (`createImageEncoder` at 720p, `decodePng` for the `capture` tool), `src/dapi/lib/sheets.ts` (`planSheet`, `planSheetSizes`, `composeSheet`, `sheetTimecode`), `src/dapi/handlers/media-grab.ts` and `media-segment.ts` (`encodePng`).
  - `src/utils/gen-ai.ts` (`createEncoder` to render clips for generation inputs), `src/lib/electron-file-writable.ts` (a `WritableFileTarget`).
- Not used by `apps/desktop` or `apps/cli` directly; they reach it through the web renderer over IPC.

Up: [../README.md](../README.md)
