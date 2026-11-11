# `packages/assets/src`

All code of `@diffusionstudio/assets`: the asset data model, the `assets.yml` manifest codec, content ids, media probing, the stateful `AssetLibrary`, the `cache/` store with its derivations, and the `.mask` file format.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Package entry (`package.json` `exports["."]`). Re-exports every module below. Does not export `derive/waveform-worker.ts`. |
| `types.ts` | Data model. `Asset` union of `ImageAsset`, `AudioAsset`, `VideoAsset`, `TranscriptAsset`, `ScriptAsset`, `SequenceAsset`, `MaskAsset`. `AssetBase` fields: `id`, `path`, `source`, `createdAt`, `mimeType`, `stat`, `generation`, `transient`, `handle`. `PartialAsset` (`state: 'pending' \| 'error'`), `AssetEntry`, `isPartialAsset`. `Transcript`, `TranscriptWord`. `AssetFileHandle`, `AssetDirectoryHandle`. Path helpers `basename`, `dirname`, `joinPath`, `normalizePath`, `assetName`, `assetFolder`. |
| `manifest.ts` | On-disk shape. `MANIFEST_FILE = 'assets.yml'`, `ASSETS_DIR = 'assets'`, `GENERATED_DIR = 'generated'`, `MANIFEST_VERSION = 1`. `Manifest { version, folders, assets }`. `toRecord` drops `handle`, `directoryHandle`, `transient`. `isAssetRecord`, `isPartialRecord`, `normalizeManifest` (drops broken or duplicate-id records). `isUrlSource`, `isAbsoluteSource`, `isProjectSource`. |
| `fs.ts` | `ProjectFS` interface the host implements: `readManifest`, `writeManifest`, `list`, `stat`, `file`, `write`, `remove`, optional `realPath`, `absolute`, `pathOf`. `FsEntry` (`name`, `kind`, `size`, `mtime`, `link`). |
| `hash.ts` | Ids, 16 hex chars (`ID_LENGTH`). `hashBlob`: SHA-256 of size + whole file (≤ 3 MiB) or 1 MiB head/middle/tail. `hashSequence`: frame names and sizes. `hashKey`: generation key, for partials. `looksLikeId`. |
| `probe.ts` | `detectMimeType(Blob \| url)`: extension for `.srt`/`.vtt`/`.json`, declared `image/*`, magic-byte sniff for images (PNG, JPEG, GIF, WebP, BMP, TIFF, AVIF/HEIC, SVG) and masks, then mediabunny sniff for audio/video; `null` if unsupported. `probeMedia(file, mimeType)` → `ProbeResult` (dimensions, duration, `frameRate`, `bitRate`, `sampleRate`, `channels`, mask `recipe`); throws on missing track. `isSequenceListing`, `sortFrames`, `DEFAULT_SEQUENCE_FPS = 30`. |
| `library.ts` | `AssetLibrary`, the stateful core. See "How it works". Also `LibraryOptions`, `ImportOptions`, `ImportResult`, `ReserveOptions`. |
| `cache.ts` | `AssetCache` over `cache/` (`CACHE_DIR`). Kinds `THUMBNAIL` (`thumbnails/*.webp`), `PEAKS` (`peaks/*.u8`), `WAVEFORM` (`waveforms/*.u8`). Entry path `cache/<dir>/<id>[@variant].<ext>`. `thumbnail`, `peaks`, `waveform`; generic `get` (value) and `ensure` (`File`); `remove`, `prune`, `clear`. `isCacheFile`. |
| [derive/](derive/README.md) | Pure derivations, no state: `deriveThumbnail` (WebP), `deriveWaveform` (Worker, 800 peaks/s bytes), `downsamplePeaks`, `derivePeaks` (`PEAK_BARS = 128`). |
| `mask.ts` | `.mask` format (`DSMK`, version 2, `MASK_MIME_TYPE = 'application/x-diffusionstudio-mask'`): JSON `MaskHeader`, per-frame table (offset, length, `score`, `iou`), LEB128 run-coded int8 logit fields. `encodeMaskFile`, `readMaskHeader`, `isMaskFileHead`, `MaskFile.read` → `has`, `field(index, out)`, `score`, `iou`. `quantizeLogit` (`127·tanh(logit/2)`), `FIELD_LOGITS`, `emptyField`. `MaskRecipe`, `MaskPoint`, `MaskStroke`. |
| `mask-outline.ts` | `traceMask(field, width, height, sink, smoothing)`: blur by smoothing, 2× bilinear upsample, marching squares at zero crossing, oriented loops drawn as quadratic B-splines into a `MaskOutlineSink` (`Path2D` or 2D context). `DEFAULT_MASK_SMOOTHING = 0.25`. |
| `browser.ts` | DOM glue. `pickFiles` (hidden `<input type=file>`), `droppedFiles(DragEvent)`, `importFiles(library, files, folder)` (paths via `fs.pathOf`, unnamed files reported), `saveAssetAs` (`showSaveFilePicker`, streams `handle.getFile()`). |

## How it works

- Construction: host calls `new AssetLibrary(fs, { onRename, onRelink })`. The library creates its own `AssetCache(fs)` as `library.cache`.
- State: one `map` of `AssetEntry` by id, newest first. `publish()` copies it to Solid signals `assets()`, `partials()`, `folders()`. Transient assets stay in `map` but not in `assets()`.
- `load()`: `fs.readManifest` → `normalizeManifest`. Partials load as records. Assets go through `revive`: URL sources attach handles only; sequences re-hash frames; files re-describe when `fs.stat` size or mtime differs from `stat`. Then `scanAssetsDir` adopts unlisted files under `assets/` (symlink cycles skipped via `realPath`). Then `cache.prune` drops cache entries of unknown ids.
- Describe pipeline (`describeFile`, `describeUrl`, `describeSequence`): `detectMimeType` → `hashBlob` / `hashSequence` + `probeMedia` → `Asset` with a `handle` (`fs.file`, cached `fetch`, or first frame plus `directoryHandle`).
- `resolve(src)`: `get` by id or library path → absolute path or URL as `transient` → project-relative path that `fs.stat` finds, also `transient` → else throws. A transient asset whose id the library owns returns the owned asset.
- `import(sources)`: URL → download → `store`. Empty listing or frame folder → `link` (one asset or one `SequenceAsset`). Other folder → `createFolder` and recurse. Same `source` or same id dedupes.
- `store(blob, { name, folder, generation })`: `fs.write` to `assets/<path>`, describe, replace the partial for the generation key.
- Generation state: `reserve` adds or resets a `pending` partial (id = `hashKey(key)`). `fail` sets `error`. `store` drops the partial. `remove` on a partial asks for the run again. `generated(key)` returns the asset or partial for a key.
- Edits: `update`, `relink` (new id, `cache.remove(old)`, `onRelink`), `rename` / `move` / folder ops (`onRename` for assets), `remove` (deletes bytes only under `assets/`, plus cache entries). `uniquePath` appends ` 2`, ` 3`.
- Persist: each edit calls `changed()` → `publish()` + 200 ms debounced `flush()` → `fs.writeManifest(manifest())`. Writes run in series. `dispose()` flushes and stops.
- Cache: `thumbnail` → `deriveThumbnail` on `handle.getFile()`, non-default widths stored as `@<width>` variants. `waveform` → `ensure(WAVEFORM)` returns the stored `File` for range reads. `peaks` → `downsamplePeaks(waveform, PEAK_BARS)`. Concurrent calls share one promise. Derivation errors log and return `null`.
- Masks: `probeMedia` reads `readMaskHeader` for `MaskAsset` fields (duration = `frameCount / frameRate`). `deriveThumbnail` uses `MaskFile` + `traceMask`. Consumers decode a frame with `MaskFile.field` and draw it with `traceMask`.

## Interfaces

- Depends on: `mediabunny` (`probe.ts`, `derive/*`), `solid-js` `createSignal` (`library.ts`), Web APIs (`crypto.subtle`, `fetch`, `createImageBitmap`, `DOMParser`, `Worker`, `OffscreenCanvas`, `showSaveFilePicker`), host `ProjectFS`.
- Used by (imports of `@diffusionstudio/assets`):
  - [../../runtime/README.md](../../runtime/README.md): `src/traits`, `src/systems`, `src/media` (19 files), `src/actions`, `src/ai.ts`, `src/utils`.
  - [../../reconciler/README.md](../../reconciler/README.md): `src/document.ts`.
  - [../../../apps/web/README.md](../../../apps/web/README.md): `src/engine`, `src/components`, `src/dapi`, `src/projects`, `src/pages`, `src/utils`.
- Detailed per-consumer symbols: see [../README.md](../README.md).

Up: [../README.md](../README.md)
