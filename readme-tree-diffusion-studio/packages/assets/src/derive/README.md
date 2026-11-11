# `packages/assets/src/derive`

Pure derivation functions: a media `Blob` in, a thumbnail (WebP) or an audio waveform (bytes) out. No cache, no state.

## Parts

| Part | Role |
|---|---|
| `thumbnail.ts` | `deriveThumbnail(file, mimeType, width = DEFAULT_THUMBNAIL_WIDTH)` → `Blob \| null` (WebP, quality 0.7). Routes on MIME: `image/*` → `imageThumbnail` (`createImageBitmap` with `resizeWidth`, drawn into an `OffscreenCanvas` `bitmaprenderer` context); `video/*` → `videoThumbnail` (mediabunny `Input` + `CanvasSink({ width })`, frame at first timestamp + `VIDEO_THUMBNAIL_OFFSET` 0.3 s, falls back to the first frame); `MASK_MIME_TYPE` → `maskThumbnail` (middle tracked frame of a `MaskFile`, outline via `traceMask`, filled white `#ffffff` on `#1a1a1a`). Other MIME types → `null`. Exports `DEFAULT_THUMBNAIL_WIDTH = 300`. |
| `waveform.ts` | `deriveWaveform(file, peaksPerSecond = WAVEFORM_PEAKS_PER_SECOND)` → `Uint8ClampedArray \| null`. Spawns one module `Worker` from `./waveform-worker.ts`, posts a `WaveformRequest`, resolves on `WaveformResponse`, terminates the worker in `finally`. `downsamplePeaks(data, target)` → max of each slice, at least one sample per slice (no gaps when zoomed past source resolution). Exports `WAVEFORM_PEAKS_PER_SECOND = 800`. |
| `waveform-worker.ts` | Worker body. Types `WaveformRequest { file, peaksPerSecond }` and `WaveformResponse = { peaks } \| { error }`. `computeWaveform(file, peaksPerSecond)`: mediabunny `Input` → `getPrimaryAudioTrack()` → `AudioSampleSink.samples()`; allocates `ceil(track.computeDuration() * peaksPerSecond)` bytes; for each sample copies f32 PCM (all channels interleaved), writes each peak at `floor(timestamp * peaksPerSecond)` (index by time, not append, so offset or gapped tracks align); peak = `floor(255 * max(|sample|^0.8))` over channels (gamma lift). Returns `null` for no audio track or zero covered peaks; trims to covered length. Transfers the buffer back; closes every sample and disposes the `Input`. |
| `peaks.ts` | `derivePeaks(file, bars = PEAK_BARS)` → `deriveWaveform` then `downsamplePeaks(waveform, bars)`. Exports `PEAK_BARS = 128`. The "rough waveform" used by thumbnails and inspector previews. |

## How it works

- Thumbnail: caller passes a `Blob` and its MIME type. The decoder scales (mediabunny `CanvasSink` for video, `createImageBitmap` for images); the canvas encodes once to WebP via `encode()` (`OffscreenCanvas.convertToBlob` or `HTMLCanvasElement.toBlob`).
- Waveform: main thread (`waveform.ts`) posts the file to a fresh worker (`waveform-worker.ts`). The worker decodes with mediabunny off the main thread (PCM formats such as WAV unpack in JS and would stall the UI). It returns one byte per peak at 800 peaks/s, transferred, then the worker is terminated.
- Peaks: `peaks.ts` derives the full waveform once and downsamples to 128 bars. Consumers at other resolutions call `downsamplePeaks` on the same full waveform (`cache.ts` does this for the `PEAKS` cache kind; `apps/web/src/engine/timeline/peaks.ts` does it per zoom window).
- Every function returns `null` when the file has no usable picture or audio; errors from the worker reject the promise.

## Interfaces

- Depends on:
  - `mediabunny` (`Input`, `BlobSource`, `ALL_FORMATS`, `CanvasSink`, `AudioSampleSink`) — package dependency of `packages/assets`.
  - [`../mask.ts`](../README.md) — `MASK_MIME_TYPE`, `MaskFile` (`.read`, `.header`, `.has`, `.field`).
  - [`../mask-outline.ts`](../README.md) — `traceMask(field, gridWidth, gridHeight, Path2D)`.
  - Browser APIs: `Worker`, `OffscreenCanvas`, `createImageBitmap`, `Path2D`.
- Used by:
  - `packages/assets/src/cache.ts` — `AssetCache.thumbnail` calls `deriveThumbnail`; `AssetCache` `WAVEFORM` kind calls `deriveWaveform`; `PEAKS` kind calls `downsamplePeaks(..., PEAK_BARS)`.
  - `packages/assets/src/index.ts` — re-exports `peaks.ts`, `waveform.ts`, `thumbnail.ts` as part of `@diffusionstudio/assets` (the worker file is not exported).
  - `packages/runtime/src/media/audio-peaks.ts` — `derivePeaks`.
  - `apps/web/src/components/ui/asset-thumbnail.tsx` — `deriveThumbnail`, `DEFAULT_THUMBNAIL_WIDTH` (width ladder 64/128/300/600/1200), `derivePeaks`.
  - `apps/web/src/components/sidebar-right/inspector/asset-info-preview.tsx` — `derivePeaks`.
  - `apps/web/src/engine/timeline/media.ts` — `deriveThumbnail` at `width * devicePixelRatio`.
  - `apps/web/src/engine/timeline/peaks.ts` — `WAVEFORM_PEAKS_PER_SECOND`, `downsamplePeaks`.

Up: [../README.md](../README.md)
