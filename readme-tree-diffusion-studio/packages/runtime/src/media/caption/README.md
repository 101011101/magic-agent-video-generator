# `packages/runtime/src/media/caption`

Turns a transcript asset into timed, styled caption text on a `<captions>` entity: seven preset "decoders" that group words, place the caption box, write the current phrase per playhead frame, and draw it.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Entry point. `resolveCaptionDecoder(world, entity)` lazily creates/caches a decoder on the `CaptionDecoderHandle` trait, recreates it when `Caption.type` changes (`clearPresetStyling` deletes decoder-made `Paint`/`Shadow`/`TextRange` children, keeps ones with `Source`). Exports `CAPTION_PRESET_STYLES` (base `TextStyle` per `CaptionType`) and `CAPTION_PRESET_FILLS` (base fill color per type; `STARK` = `undefined`). Re-exports all decoders, `position`, `subtitles`, `utils`. |
| `types.ts` | `CaptionDecoder` interface: `type`, `groups: WordGroup[]`, `ready`, `styled`, `applyStyles()`, `reposition()`, `seekTo(world, entity, relativeTime)`, `draw()`, `dispose()`. `CaptionPresetStyle`: complete base TextStyle (`fontFamily`, `fontWeight`, `fontSize`, `fontStyle`, `textAlign`, `textBaseline`, `textCase`, `leading`, `letterSpacing`). |
| `utils.ts` | Shared helpers. `resolveTranscript(asset)` reads a `TRANSCRIPT` asset (JSON, or SRT/VTT via `parseSubtitles`) or `asset.transcript` on AUDIO/VIDEO. `groupBy(transcript, {duration} \| {length})` splits words into `WordGroup[]` (breaks on segment boundary, size limit, ending punctuation `. ! ? , ;`). `findActiveGroup(groups, t)` returns index or -1. `setChars` writes `Chars` directly to the store (no change events). `clearTextRanges` deletes `TextRange` children and resets `Cache.textRanges`. `splitSequence(group)` halves a group at nearest word boundary. `primeTranscriptDuration` / `getTranscriptDuration` cache the transcript's last word end per asset id. |
| `position.ts` | `placeCaption(world, entity, {width, height, x?, defaultAlign})`. Walks past `Sequential` parents to a spatial parent, reads its `Computed` width/height, calls `resizeEntity`, sets `Position`. Authored `Host.props.x`/`y` win; else x = preset `x` or centered, y from `Caption.verticalAlign` (else preset default) with `CAPTION_MARGIN = 100`. Returns false with no parent. |
| `subtitles.ts` | `parseSubtitles(text)`: SRT/WebVTT to `Transcript`. One cue = one segment. Strips `<tags>` and `{overrides}`. Synthesizes per-word timings proportional to word length within the cue. Sorts by start. |
| `classic.ts` | `ClassicCaptionDecoder`. Urbanist 600 / 62px / lowercase. `groupBy({duration: 0.2})`. Box 600x100, default CENTER. `applyStyles` adds a `Shadow` child (black, blur 28, offset y 5). `seekTo` shows the whole active group. Exports `CLASSIC_PRESET_WIDTH/HEIGHT`. |
| `cascade.ts` | `CascadeCaptionDecoder`. Inter 300 / 50px / left-aligned, top baseline. `groupBy({length: 50})`. Box 800x200, fixed `x: 100`, default BOTTOM. `seekTo` progressive reveal: only words with `start <= relativeTime`. |
| `spotlight.ts` | `SpotlightCaptionDecoder`. The Bold Font 500 / 70px. `groupBy({length: 10})`. Box 700x100, CENTER. `seekTo` shows the group and adds a `TextRange` + solid `Paint` child over the current word. `draw` recolors that fill from `Caption.colors[0]` (default `0x24D5FF`). |
| `whisper.ts` | `WhisperCaptionDecoder`. Montserrat 400 / 40px / leading 1.4. `groupBy({duration: 2})`. Box 1000x100, default BOTTOM. Whole-group display. |
| `paper.ts` | `PaperCaptionDecoder`. Montserrat 300 / 50px / leading 0.9. `groupBy({length: 18})`. Box 700x200, CENTER. `seekTo` splits group via `splitSequence` into two lines (`\n`); active line gets a `TextRange` with `fontWeight: '500'`. |
| `guinea.ts` | `GuineaCaptionDecoder`. The Bold Font 500 / 62px / UPPER. `groupBy({length: 18})`. Box 700x200, CENTER. Two-line split like paper; active line gets a `TextRange` at 1.1x `fontSize` plus a solid `Paint` child. `draw` cycles the fill through `Caption.colors[0..2]` (defaults `0xF55353`, `0xFEB139`, `0xF6F54D`) via `PSEUDO_RANDOM_SEQUENCE`. |
| `stark.ts` | `StarkCaptionDecoder`. Figtree 800 / 70px / UPPER. `groupBy({duration: 0.2})`. Box 700x100, CENTER. `applyStyles` adds a white solid `Paint` child with `BlendMode` DIFFERENCE (why `CAPTION_PRESET_FILLS[STARK]` is `undefined`). Whole-group display. |

## How it works

- Every decoder follows the same lifecycle: `constructor(asset)` starts async `init()` -> `resolveTranscript` -> `groupBy` -> `ready = true`.
- `resolveCaptionDecoder` runs on each playback/render tick. It creates the decoder once per `(entity, Caption.type)`, stores it in `CaptionDecoderHandle`, then calls `applyStyles`. `applyStyles` calls `reposition` -> `placeCaption`; if the entity has no parent yet it returns false and `styled` stays false, so the next resolve retries.
- Preset switch: `resolveCaptionDecoder` disposes the old decoder, calls `clearPresetStyling`, and creates the new one. The reconciler separately rewrites `TextStyle` from `CAPTION_PRESET_STYLES` and `Color` from `CAPTION_PRESET_FILLS`, then re-applies authored props on top.
- Per frame: `systems/playback.ts` calls `decoder.seekTo(world, entity, localFrame / fps)`. The decoder finds the active group, writes text with `setChars`, and (spotlight/paper/guinea) rebuilds `TextRange` children for the highlighted word or line.
- Draw: `systems/render.ts` calls `decoder.draw(world, entity)`, which updates highlight `Color` from `Caption.colors` where applicable and calls `renderText`.
- Timing: `actions/timing.ts` calls `primeTranscriptDuration` once per asset, then `getTranscriptDuration` synchronously to size the caption clip; a transcript with no words returns null and the clip takes its parent's span.
- Timeline UI reads `decoder.groups` to draw one block per phrase along the clip.

## Interfaces

- Depends on:
  - `packages/runtime/src/constants.ts`: `CaptionType`, `CaptionAlign`, `PaintType`, `BlendModeType`, `FontStyle`, `TextAlign`, `TextBaseline`, `TextCase`.
  - `packages/runtime/src/traits/`: `Caption`, `CaptionDecoderHandle`, `AssetId`, `Chars`, `TextRange`, `TextStyle`, `Paint`, `Color`, `Shadow`, `Opacity`, `Blur`, `Offset`, `BlendMode`, `ItemIndex`, `Position`, `Computed`, `Host`, `Sequential`, `ChildOf`, `Source`, `Cache`.
  - `packages/runtime/src/actions/`: `assets.ts` (`getAsset`, `getAssetFile`), `entities.ts` (`createEntity`, `deleteEntity`), `hierarchy.ts` (`appendChild`), `resize.ts` (`resizeEntity`).
  - `packages/runtime/src/queries/hierarchy.ts` (`getParentNode`), `packages/runtime/src/world/store.ts` (`store`), `packages/runtime/src/utils/text.ts` (`renderText`), `packages/runtime/src/fonts/utils.ts` (`loadWebFont`).
  - `packages/assets` types: `Asset`, `Transcript`, `WordGroup`, `TranscriptWord`.
  - `koota` (`World`, `Entity`).
- Used by:
  - `packages/runtime/src/media/index.ts` re-exports everything (see [../README.md](../README.md)).
  - `packages/runtime/src/systems/playback.ts` `forwardCaptionDecoder` -> `resolveCaptionDecoder` + `seekTo`.
  - `packages/runtime/src/systems/render.ts` `renderCaptionNode` -> `resolveCaptionDecoder` + `draw`.
  - `packages/runtime/src/actions/timing.ts` -> `getTranscriptDuration`, `primeTranscriptDuration`, disposes `CaptionDecoderHandle`.
  - `packages/runtime/src/media/dispose.ts`, `packages/runtime/src/world/observers.ts` -> `CaptionDecoderHandle.dispose()`.
  - `packages/reconciler/src/document.ts` -> `CAPTION_PRESET_STYLES`, `CAPTION_PRESET_FILLS` when applying or switching a preset.
  - `apps/web/src/engine/timeline/render/caption.ts` -> `resolveCaptionDecoder(...).groups` for timeline clip blocks.

Up: [../README.md](../README.md)
