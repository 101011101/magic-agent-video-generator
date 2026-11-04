# `apps/web/src/dapi/lib`

Shared helpers that DAPI tool handlers call to resolve targets (assets, nodes, scenes), pick and lay out video frames, and decode preview bytes.

## Parts

| Part | Role |
| --- | --- |
| `assets.ts` | `resolveAsset(ctx, path)`: resolves a tool target path to an `Asset`. With a project open, uses `getLibrary(world).resolve(path)`. With none open, only absolute paths and URLs resolve, through a throwaway `AssetLibrary(createProjectFS(""))`; library paths throw `DapiError("no-project")`. `requireAssetType(asset, types, expected)`: narrows `Asset.type` or throws `DapiError("wrong-kind")`. |
| `nodes.ts` | `isNode(entity)`: true when the entity has `Geometry`, `Group`, `AdjustmentLayer`, or `Scene`. `resolveNode(world, id)`: finds the one entity whose `Source` stamp equals `id` or whose parsed locator (`parseSource`) equals `id`. Throws `DapiError` codes `not-found`, `wrong-kind`, or `ambiguous` (loop body rendered many times, or same id in many files). |
| `scene.ts` | `requireScene(world, id, verb)`: calls `resolveNode`, returns the entity if `isScene`. Otherwise walks `getParentNode` up to the enclosing scene and throws `DapiError("wrong-kind")` that names that scene's stamp. `verb` is "capture" or "export" in the message. |
| `sheets.ts` | `SheetCollector`: lays `total` frames over contact sheets via `planSheetSizes` and `planSheet` (from `@diffusionstudio/encoder`). `add(index, frame)` stores a `SheetFrame {at, timecode, image}`; when a sheet's last frame arrives it calls `composeSheet` and `sheetTimecode`, closes `ImageBitmap`s, and drops the frames. `result()` returns `TimecodedImage[]` in sheet order. Exposes `plans`, `cellWidth`, `cellHeight` so callers decode no larger than a cell. |
| `frame-triage.ts` | `pickInformativeTimes(track, {from, to, max})`: scans an `InputVideoTrack` at 2 fps with `VideoSampleSink.samplesAtTimestamps`. For each frame, computes a 32x32 block-luma fingerprint on the GPU with a `typegpu` compute shader (`fingerprintFn`, Rec. 709 luma, 8x8 bilinear taps). `distance()` gives the fraction of blocks changed beyond a deadzone (0.02) up to saturation (0.1). Keeps a frame when motion vs previous sample is at rest (`<= 2/1024`) and novelty vs last kept is `>= 2/1024`; for runs that never settle, keeps the calmest sample every 4 s. Sorts by novelty, trims to `max`, returns times in presentation order. Requires WebGPU (`navigator.gpu`), else `assert` throws. |
| `png.ts` | `dataUrlToBytes(dataUrl)`: base64 `data:` URL to `Uint8Array`. |

## How it works

- A handler in [`../handlers/`](../handlers/README.md) receives `(args, ctx: ToolContext)` from `../handler.ts`.
- Media handlers call `resolveAsset(ctx, args.path)` first, then `requireAssetType` to reject wrong media kinds.
- Node handlers call `resolveNode(world, id)`; capture and export call `requireScene` so only scenes render.
- Frame producers (`media-grab`, `media-segment`, `capture`) build a `SheetCollector`, decode or render each frame no larger than `cellWidth` x `cellHeight`, and `add()` frames in any order. Sheets compose as soon as complete, so memory stays bounded.
- `media-grab` with automatic selection calls `pickInformativeTimes` to choose timestamps before decoding full frames.
- `media-filmstrip` and `media-waveform` get `data:` URL previews from the runtime and convert them with `dataUrlToBytes` for the tool reply.
- Every failure is a `DapiError` with a code (`no-project`, `wrong-kind`, `not-found`, `ambiguous`) so the tool caller can act on it.

## Interfaces

- Depends on:
  - `@diffusionstudio/dapi` (`packages/dapi/src/errors.ts` `DapiError`; `packages/dapi/src/schemas.ts` `TimecodedImage`).
  - `@diffusionstudio/runtime` (`packages/runtime/src/actions/assets.ts` `getLibrary`; `packages/runtime/src/queries/hierarchy.ts` `getParentNode`; `packages/runtime/src/queries/predicates.ts` `isScene`; components `Geometry`, `Group`, `AdjustmentLayer`, `Scene`, `Source`).
  - `@diffusionstudio/assets` (`packages/assets/src/library.ts` `AssetLibrary`, `isAbsoluteSource`, `isUrlSource`).
  - `@diffusionstudio/jsx` (`packages/jsx/src/source.ts` `parseSource`).
  - `@diffusionstudio/encoder` (`packages/encoder/src/contact-sheet.ts` `planSheetSizes`, `planSheet`, `composeSheet`, `sheetTimecode`, `SheetPlan`).
  - `apps/web/src/projects/fs.ts` `createProjectFS`; `apps/web/src/utils` `assert`; `apps/web/src/dapi/handler.ts` `ToolContext`.
  - npm: `mediabunny` (`VideoSampleSink`, `InputVideoTrack`), `typegpu`, `koota` (`Entity`, `World`).
- Used by (`apps/web/src/dapi/handlers/`):
  - `assets.ts`: `media-probe.ts`, `media-transcribe.ts`, `media-grab.ts`, `media-filmstrip.ts`, `media-waveform.ts`, `media-listen.ts`, `media-segment.ts`.
  - `nodes.ts`: `check.ts`; `scene.ts` (internal).
  - `scene.ts`: `export.ts`, `capture.ts`.
  - `sheets.ts`: `media-grab.ts`, `capture.ts`, `media-segment.ts`.
  - `frame-triage.ts`: `media-grab.ts`.
  - `png.ts`: `media-filmstrip.ts`, `media-waveform.ts`.

Up: [../README.md](../README.md)
