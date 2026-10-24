# `packages/encoder/src`

Offline encoder: steps a prepared "capture world" frame by frame through the runtime systems and writes the result as a video/audio file (mediabunny), standalone PNG frames, or a labelled contact sheet.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every file below. Package entry (`@diffusionstudio/encoder`). |
| `encoder.ts` | Video/audio export. `createEncoder(world, config)` returns `{ render, cancel }`. `render()` resolves an `ExportResult`. Also exports the shared helpers `captureScene`, `warmupAssets`, `resolverSystem`, `normalizeSceneTransform`. Holds the inline `SinkProcessor` AudioWorklet (`audioWorkletCode`, `createAudioWorkletUrl`) and `createThrottledCallback`. |
| `image-encoder.ts` | Single-frame PNG export. `createImageEncoder(world, config)` returns `{ render, cancel, resize, bounds }`. `render()` resolves an `ImageExportResult` of `CapturedImage[]` (`{ png: Uint8Array, timecode: string }`). |
| `contact-sheet.ts` | Grid layout and composition of up to `MAX_FRAMES_PER_SHEET` (12) frames into one PNG. Exports `planSheet`, `planSheetSizes`, `sheetTimecode`, `composeSheet`, `SheetPlan`, `SHEET_MAX_WIDTH` (2576), `SHEET_MAX_HEIGHT` (1456). |
| `png.ts` | `encodePng(canvas)` → `Uint8Array` (via `toBlob` / `convertToBlob`). `decodePng(bytes)` → `ImageBitmap`. |
| `buffer.ts` | `TargetBuffer`: wraps a mediabunny `Target`. `TargetBuffer.create(handle?)` picks `StreamTarget` (chunked, to a `WritableFileTarget`) or in-memory `BufferTarget`. `close(format)` returns a `Blob` with the container MIME type for the in-memory case. |
| `format.ts` | `createOutputFormat(buffer, format?)`: lazy-imports and instantiates the mediabunny output format (`Mp4OutputFormat` with `fastStart` from the buffer, `WebMOutputFormat`, `OggOutputFormat`, `MovOutputFormat`). Default: mp4. |
| `utils.ts` | Output sizing shared with the UI. `scaleSize(w, h, scale)` rounds to even pixels. `computeOutputSize(w, h, resolution?)` maps a "p" number (shorter side) to `OutputSize { width, height, scale }`. `createRenderEventDetail(progress, total, startTime)` builds `EncoderProgress` with an ETA. |
| `interfaces.ts` | Config types: `EncoderConfig { video?, audio?, format?, target?, onProgress?, comment? }`, `VideoConfig` (codec, fullCodecString, enabled, bitrate, fps, resolution), `AudioConfig` (enabled, sampleRate, numberOfChannels, bitrate, codec), `ImageEncoderConfig { frames, resolution? }`. Defaults live in JSDoc and in `encoder.ts`. |
| `types.ts` | `ContainerFormat` (`mp4 \| webm \| ogg \| mov`), `WritableFileTarget`, `EncoderProgress { total, progress, remaining: Date }`, `ExportResult` (`success \| canceled \| error`). |

## How it works

- Input contract: the caller builds a fresh world that holds one scene as the only child of `Root` (see `apps/web/src/engine/capture.ts` `createCapture`). `captureScene` asserts this. The encoder never touches the editor world.
- Setup (`createEncoder`):
  - `warmupAssets` runs `assetSystem` up to 16 passes and awaits `FramePromises` each pass until nothing is in flight.
  - Reads frame rate from `FrameRate` (default 30), scene size and end from `Computed`, and clamps the range to the scene's `Workarea`.
  - `format === 'ogg'` forces audio on and video off. Other defaults: aac 128 kbps, avc 10 Mbps, 2 ch, 48 kHz, 1080p, mp4.
  - `computeOutputSize` sets canvas size and `RenderSurface.resolution` (scale). `canEncodeVideo` guards the codec/size before any write.
  - Creates an `OfflineAudioContext` sized to the duration and sets it as `AudioEngine`. Sets playback state on the scene (`playing`, no loop, speed 1) and `AudioPlayback.timelineOffsetInSeconds` to the workarea start.
  - Builds `TargetBuffer` → `createOutputFormat` → mediabunny `Output`. Adds `AudioSampleSource` and `CanvasSource` tracks when enabled. Alpha is kept only for webm with no scene fill (`Paint` without `Geometry`).
  - Audio path: loads the inline `SinkProcessor` worklet from a blob URL. Worklet spins on a `SharedArrayBuffer` counter (`Atomics`) until the main thread grants samples, then posts each render quantum back as planar `Float32Array`. `onmessage` wraps it in an `AudioSample` and adds it to `audioSource`. An empty array signals end of audio.
- Render loop (`render()`), per frame:
  - Writes playhead into `Computed.localTime`/`localTimeInSeconds` and advances `Time`.
  - Runs `assetSystem` → `playbackSystem` → `resolverSystem` (awaits frame promises) → `motionSystem` → `normalizeSceneTransform` (zeros scene position/offset/rotation/skew, scale 1).
  - If video: `transformSystem` → `renderSystem` → `videoSource.add(timestamp, frameDuration)`.
  - If audio: awaits the previous sample add, throttles while the worklet backlog exceeds one second, then `Atomics.add` grants samples up to the current timestamp.
  - Emits progress at most 3×/s through `createThrottledCallback`.
  - `cancel()` sets a flag; the loop calls `output.cancel()` and unblocks the worklet.
- Finish: grants the remaining samples plus one second, awaits `startRendering()`, posts `null` to drain the worklet, `output.finalize()`, `buffer.close(format)`. Returns a `Blob` (in-memory) or `undefined` (streamed to file). Revokes the worklet URL in `finally`.
- `createImageEncoder` reuses the same tick order without audio: sets a dummy `OfflineAudioContext`, adds `Silent` to the world, `warmupAssets`, then renders the requested frames in ascending deduplicated order (world only moves forward), `encodePng` per frame, and returns them in the requested order with `formatTimecode` labels. `resize(height?)` re-targets the canvas via `scaleSize`.
- Contact sheets: `planSheetSizes` splits N frames into balanced sheets (13 → 7 + 6). `planSheet` picks the column count that maximizes cell area within the sheet budget, never upscales past source. `composeSheet` draws cells on an `OffscreenCanvas` with `#444` gutters, stamps each with `stampTimestampLabel`, returns PNG bytes. `sheetTimecode` labels the sheet with its first-last span.

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime` ([packages/runtime/src](../../runtime/src/README.md)): systems `assetSystem`, `playbackSystem`, `motionSystem`, `transformSystem`, `renderSystem` (`packages/runtime/src/systems/`); traits `Root`, `ChildOf`, `Computed`, `Playback`, `AudioPlayback`, `Workarea`, `Time`, `FrameRate`, `RenderSurface`, `AudioEngine`, `FramePromises`, `Silent`, `Paint`, `Geometry`, `Position`, `Offset`, `Rotation`, `Scale`, `Skew`, `AudioBusHandle`; helpers `setActive`, `framesToSeconds`, `formatTimecode`, `store`, `assert`, `isScene`, `AudioBus`, `stampTimestampLabel` (`packages/runtime/src/media/transcode.ts`).
  - `mediabunny`: `Output`, `CanvasSource`, `AudioSampleSource`, `AudioSample`, `canEncodeVideo`, `BufferTarget`, `StreamTarget`, `*OutputFormat`.
  - `koota`: `World`, `Entity`, `Not`.
  - Browser APIs: `HTMLCanvasElement`, `OffscreenCanvas`, `OfflineAudioContext`, `AudioWorklet`, `SharedArrayBuffer`, `Atomics`, `createImageBitmap`.
- Used by (`apps/web`, [apps/web/src](../../../apps/web/src/README.md)):
  - `createEncoder`: `apps/web/src/context/render.ts`, `apps/web/src/utils/gen-ai.ts`.
  - `createImageEncoder`, `decodePng`: `apps/web/src/dapi/handlers/capture.ts`.
  - `composeSheet`, `planSheet`, `planSheetSizes`, `sheetTimecode`: `apps/web/src/dapi/lib/sheets.ts`.
  - `encodePng`: `apps/web/src/dapi/handlers/media-grab.ts`, `apps/web/src/dapi/handlers/media-segment.ts`.
  - `computeOutputSize`: `apps/web/src/context/render.ts`, `apps/web/src/context/export.tsx`, `apps/web/src/dapi/handlers/export.ts`, `apps/web/src/components/sidebar-right/inspector/export.tsx`.
  - Capture world builder that satisfies the input contract: `apps/web/src/engine/capture.ts` (`createCapture`).
  - `MAX_FRAMES_PER_SHEET` is mirrored (not imported) in `packages/dapi/src/schemas.ts` for protocol validation.

Up: [../README.md](../README.md)
