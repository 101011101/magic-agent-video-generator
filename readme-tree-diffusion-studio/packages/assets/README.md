# `packages/assets`

`@diffusionstudio/assets`: a project's asset library. Reads and writes the `assets.yml` manifest, gives each media file a content-hash id, probes media metadata, resolves JSX `src` strings to `Asset` records, and derives cached thumbnails and waveforms. Host-agnostic: all file access goes through a `ProjectFS` the app supplies.

## Parts

| Part | Role |
| --- | --- |
| [src/](src/README.md) | All code. Single entry `src/index.ts` re-exports every module below. |
| `src/types.ts` | Data model. `Asset` union: `ImageAsset`, `AudioAsset`, `VideoAsset`, `TranscriptAsset`, `ScriptAsset`, `SequenceAsset` (numbered frame folder), `MaskAsset`. Shared fields: `id` (content hash), `path` (library path, what JSX `src` names), `source` (absolute OS path, `http(s)://` URL, or project-relative `assets/...`), `mimeType`, `stat`, `generation`, `handle`. `PartialAsset`: a `pending` or `error` record for a `generate.*` run that has no bytes yet. Path helpers `basename`, `dirname`, `joinPath`, `normalizePath`. |
| `src/manifest.ts` | Manifest shape and codec. `MANIFEST_FILE = 'assets.yml'`, `ASSETS_DIR = 'assets'`, `GENERATED_DIR = 'generated'`. `Manifest { version, folders, assets }`. `toRecord` strips runtime handles; `normalizeManifest` drops broken or duplicate-id records. `isUrlSource` / `isAbsoluteSource` / `isProjectSource` classify a `source`. |
| `src/fs.ts` | `ProjectFS` interface the host implements: `readManifest`, `writeManifest`, `list`, `stat`, `file`, `write`, `remove`, optional `realPath`, `absolute`, `pathOf`. `FsEntry` for directory listings. |
| `src/hash.ts` | Content identity. `hashBlob`: SHA-256 over size + whole file (≤ 3 MiB) or 1 MiB head/middle/tail, cut to 16 hex chars. `hashSequence` hashes frame names and sizes. `hashKey` hashes a generation key for partials. `looksLikeId`. |
| `src/probe.ts` | Media inspection via mediabunny. `detectMimeType` (extension, magic bytes, mediabunny sniff). `probeMedia` returns type-specific fields (`width`, `height`, `duration`, `frameRate`, `sampleRate`, `channels`, `bitRate`). `isSequenceListing`, `sortFrames` for image sequences. |
| `src/library.ts` | `AssetLibrary`, the stateful core. Solid signals `assets()`, `partials()`, `folders()`. Reads: `get`, `bySource`, `generated(key)`, `childrenOf`. Lifecycle: `load`, `flush`, `dispose`. Resolution: `resolve(src)` (library path, id, absolute path, or URL; outside sources become in-memory `transient` assets). Writes: `import`, `store`, `reserve`, `fail`, `update`, `relink`, `rename`, `move`, `remove`, folder ops. `LibraryOptions.onRename` / `onRelink` let the host follow path and id changes into JSX. |
| `src/cache.ts` | `AssetCache` over `cache/` in the project. Typed entries `thumbnail(asset, width)`, `peaks(asset)`, `waveform(asset)`; generic `get(kind, keyed, produce)`. Dedupes concurrent derivations. |
| [src/derive/](src/derive/README.md) | Derivations, no state. `deriveThumbnail` makes a WebP (image, video frame at 0.3 s, or mask middle frame). `deriveWaveform` decodes audio in a one-shot Worker to 800 peaks/s bytes; `downsamplePeaks` and `derivePeaks` cut it to `PEAK_BARS = 128`. |
| `src/mask.ts` | `.mask` file format (`DSMK` magic, version 2): per-frame int8 logit fields on the model grid, run-length coded. `encodeMaskFile`, `readMaskHeader`, `MaskFile.read` with `field(index, out)`, `score`, `iou`. `MaskRecipe` (model, source id, seed frame, points, strokes) records how a mask was made. `quantizeLogit`, `FIELD_LOGITS`. |
| `src/mask-outline.ts` | `traceMask(field, w, h, path, smoothing)`: marching squares over bilinearly upsampled logits, output as quadratic-spline loops into a `Path2D`-like sink. `DEFAULT_MASK_SMOOTHING = 0.25`. |
| `src/browser.ts` | Browser glue: `pickFiles`, `droppedFiles`, `importFiles` (links via `fs.pathOf`), `saveAssetAs` (File System Access save dialog). |

## How it works

- Host constructs `new AssetLibrary(fs, { onRename, onRelink })` then calls `load()`. `load` reads the manifest through `fs.readManifest`, normalizes it, attaches `handle`s, re-probes assets whose `stat` changed, adopts any files under `assets/` the manifest does not list, then `cache.prune` drops cache entries of unknown ids.
- A JSX `src` reaches the library through `resolve(src)`. Order: library path or id -> absolute path or URL -> project-relative file. The last two are probed on the fly and kept as `transient` (never written to the manifest). No match throws.
- `import(sources)` links user files where they are: hash the bytes (`hashBlob`), detect MIME (`detectMimeType`), probe (`probeMedia`), record with an absolute `source`. Folders become library folders; numbered image folders become one `SequenceAsset`; URLs are downloaded into `assets/`.
- `store(blob, { name, folder, generation })` writes app-produced bytes into `assets/<folder>/<name>` and registers them. With a generation key it replaces the matching `PartialAsset`.
- Generation state lives in the library: `reserve` adds a `pending` partial; `fail` marks it `error`; `store` replaces it; `remove` on a failed partial is how a run is asked for again. `generated(key)` answers for a key.
- Every mutation calls `publish()` to update the Solid signals and schedules a debounced manifest write. `flush` and `dispose` force the write.
- `AssetCache` reads `cache/<kind>/<id>` from `fs`; on a miss it runs the derivation (`deriveThumbnail`, `deriveWaveform`) and writes the result back. Waveforms are returned as a `File` so the timeline reads only the visible byte range.
- Mask files are produced by the app's SAM 2 tracking (`packages/sam2`) and stored through the library as `MaskAsset`; `MaskFile` and `traceMask` are what the runtime uses to draw them.

## Interfaces

- Depends on: `mediabunny` (probing, thumbnail and waveform decoding), `solid-js` (`createSignal`), Web APIs (`crypto.subtle`, `Worker`, `OffscreenCanvas`, `createImageBitmap`, File System Access). No `koota`, no other `@diffusionstudio/*` package.
- Used by:
  - [../runtime/README.md](../runtime/README.md): `traits/world.ts` `Library` trait holds an `AssetLibrary`; `systems/assets.ts` calls `library.resolve(source)`; `media/mask.ts` uses `MaskFile`, `traceMask`; `media/*` and `media/caption/*` use `Asset` types and `Transcript`.
  - [../reconciler/README.md](../reconciler/README.md): `src/document.ts` imports `DEFAULT_MASK_SMOOTHING`.
  - [../../apps/web/README.md](../../apps/web/README.md): `src/engine/library.ts` creates the library over `src/projects/fs.ts` `createProjectFS` (a `ProjectFS` over Electron IPC); asset sidebar, inspector, timeline (`engine/timeline/render/*` for thumbnails and waveforms), `engine/object-mask/*` (mask files), `dapi/handlers/{open,export,media-probe,media-segment}.ts`.
- Manifest on disk: `<project>/assets.yml` (YAML codec is the host's), app-written bytes under `<project>/assets/`, derived data under `<project>/cache/`.

Up: [../README.md](../README.md)
