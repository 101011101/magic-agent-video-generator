# `packages/runtime/src/utils`

Pure, DOM-free helper functions the headless runtime shares across its actions, systems, and media code: color packing, time/frame math, text layout and canvas text rendering, stroke/surface canvas helpers, transition windows, sort comparators, and generation-pulse colors.

## Parts

| Part | Role |
|------|------|
| `index.ts` | Barrel. Re-exports every file below. Header comment sets the rule: pure helpers only; DOM-touching utils (cursor, interaction) stay in `apps/web`. |
| `assert.ts` | `assert(condition, message)`: throws `Error(message)` when `condition` is falsy. TypeScript `asserts condition` narrowing. |
| `async.ts` | `attempt(fn)`: runs `fn`, returns `{ result }` or `{ error }` (non-`Error` throws become `Error('Unknown error')`). `AsyncMutex`: promise-chain lock; `acquire()` awaits the previous holder and returns a `release` resolver. |
| `color.ts` | Packed `0xRRGGBB` color helpers. `parseColor(input)`: number → masked; string → named-color table (`NAMED_COLORS`, ~45 names) → `colord` parse → fallback Figma-style hex normalization (strip non-hex, repeat/pad to 6 digits); returns `null` on empty. `colorToHex(n)` → `#RRGGBB`. `colorToCss(n, opacity)` → hex when opaque, else `rgba()`. `rgbToColor(r,g,b)`, `colorToRgb(n)`. Comment states it is a subset of `apps/web/src/utils/color.ts`. |
| `generating.ts` | Pulse look for entities tagged `Generating`. `isGenerating(entity)`: true when the node or any `Cache.fills` child has `Generating`. `getSourceFailure(entity)`: `SourceError.value` from node or first failing fill. `getGeneratingColor(world)`: `rgb()` string, eased (`animejs` `cubicBezier(0.52,0.18,0.56,0.88)`) between `#1c1c1c` and `#292929` on `world.get(Time).now`; 200 ms delay, 600 ms half-cycle, alternating. `FAILED_COLOR = '#2e1d1d'` still red fill for failed sources. |
| `sort.ts` | Entity comparators: `sortByItemIndex` (`ItemIndex.value`), `sortByStartTime` (`Computed.start`), `sortByOffset` (`Computed.stopOffset`), `sortByFrame` (`Keyframe.time`). |
| `stroke.ts` | `applyStrokeStyle(ctx, world, stroke)`: sets `lineWidth` from `Computed.strokeWidth` (animatable), `lineJoin`/`lineCap`/`miterLimit` from `StrokeStyle` store (defaults MITER/BUTT/10). `findWidestStroke(world, strokes)`: widest non-`Hidden` stroke, or `null`; a stroked shape's shadow takes its silhouette from it. |
| `surface.ts` | `getSurfaceContext(world)`: the 2D context drawing goes to: module-level `redirected` layer if set, else `world.get(RenderSurface).ctx`. `drawOnto(ctx, draw)`: runs `draw` with all surface drawing redirected to `ctx`; nests; restores in `finally`. Module state, not a trait, because a world write is a change event and the swap happens twice per masked node per frame. |
| `transition.ts` | `getTransitionWindow(world, left, right)` → `{ start, end, midpointFrame }`. Midpoint = `max(floor((leftEnd + rightStart)/2), leftEnd)`; window = midpoint ± `Transition.duration/2` read from the left clip. Type `TransitionWindow`. |
| `time.ts` | Frame/second math and source-window resolution. `snapToMs`, `snapToFps`, `secondsToFrames(s, fps=30)`, `framesToSeconds(f, fps=30)`. `formatTimestamp(s, fps)` → `HH:MM:SS:FF`; `formatTimecode(s, fps)` → zero segments dropped (`08s10f`, `0f`). `getTimelineOrigin(entity)`: parent's `Computed.origin` or 0. `getSourceFrameAt(entity, frame)`: `round((frame - origin) * playbackRate)`. `getSourceWindow(entity)`: `{ in: Trim.start, out: in + round(duration * playbackRate) }`. `getLocalWindow(entity)`: `Computed.start/end` relative to origin, scaled by playbackRate. `getIntrinsicPaint(entity)`: own `Paint.value` only when entity has `Geometry`. `isPaintEntity(entity)`: has `Paint`, no `Geometry`. `findGeometryAssetSource(world, entity)`: the entity (own `AssetId` in `Library`) or first fill that carries the asset. `findGeometryAsset(world, entity)` → `Asset | null`. `findAssetDuration(world, entity, ignore?)`: intrinsic media duration in project frames via `getSourceDuration` (own asset when `Audio` or intrinsic `PaintType.VIDEO`, else first video fill); `ignore` lets a trait-removal handler ask for the length after removal. Types `TimeTrait` (`Delay | PlaybackRate | SourceFrameRate`), `Ignorable` (`TimeTrait | Trim | AssetId | IsClipPath`). |
| `text-motion.ts` | Text animation partial-string functions, all `(chars, ratio 0..1) → string`. `revealWords`: whole words visible up to `floor(ratio * wordCount)`, whitespace preserved. `revealChars`: `chars.slice(0, floor(ratio * length))`. `scrambleChars`: port of anime.js `scrambleText` with no DOM/wall-clock; per-char settle windows (`SCRAMBLE_SETTLE_RATIO = 0.3`, `SCRAMBLE_SETTLE_RATE = 30`), FNV-1a seed from the text, stateless glyph pick keyed by `(seed, position, step)` so scrubbing is deterministic; per-text `ScrambleState` cached in a 64-entry map. |
| `text.ts` | Text layout, measurement, and canvas rendering. `renderText(world, entity)` is the entry: `tokenizeText` → `shapeTokens` → `renderTokens` onto `getSurfaceContext(world)`. `Token` class (chars, metrics, `ranges: Entity[]`, offset; getters `x/y/left/right/top/bottom` from its `Line`). Type `Line`, `TokenOptions`. `transformText(text, TextCase)` applies LOWER/UPPER. Internals: `createRenderSplits` splits `Computed.chars ?? Chars.value` at every `TextRange` `[start,end)` boundary and attaches active range entities; `tokenize` splits on spaces keeping the trailing space; `applyFont` builds `ctx.font` from `TextStyle` (range override wins: `getFontSize/Family/Weight/Style/TextBaseline/LetterSpacing/TextCase`); measurement uses a lazily created 1x1 `OffscreenCanvas`. `shapeTokens` wraps at `Size.width`, writes `Computed.width/height` when `Size` is absent, applies `TextAlign` and `TextBaseline` (TOP/MIDDLE/BOTTOM/ALPHABETIC) and `leading`. `renderTokens` draws three passes per word: shadows (scaled by `Camera.a * RenderSurface.resolution`; stroked words use the widest stroke silhouette), strokes, fills (intrinsic `Color` first, then `Cache.fills` with solid or `createLinearGradient`/`createRadialGradient` paint, `BlendMode` via `COMPOSITE_OPERATIONS`, `Opacity`, `Hidden` skipped). |

## How it works

- Every file is stateless except `surface.ts` (`redirected` layer), `text.ts` (measurement `OffscreenCanvas`), and `text-motion.ts` (scramble state cache).
- Trait-reading helpers use `store(world, Trait)` (`../world/store`) for hot paths (`text.ts`, `stroke.ts`, `transition.ts`) and `entity.get(Trait)` for single lookups (`time.ts`, `sort.ts`, `generating.ts`).
- Render path: `systems/render.ts` calls `getSurfaceContext`/`drawOnto` to pick the target canvas, `applyStrokeStyle` for shape strokes, `renderText` for text nodes, `getGeneratingColor`/`FAILED_COLOR` for placeholders, and `getTransitionWindow` to blend adjacent clips.
- Text path: `renderText` tokenizes chars by `TextRange` boundaries, measures with `applyFont`, lays out lines (`shapeTokens`), caches `Token[][]` in `TextCache.tokens`, then paints shadow/stroke/fill passes.
- Time path: `actions/timing.ts` and `systems/assets.ts` call `findAssetDuration` and `getSourceFrameAt` to resolve `Computed` timing; `systems/playback.ts` uses `getSourceWindow` and `getTransitionWindow` to decide which source frame to seek.
- Motion path: `systems/motion.ts` computes a 0..1 ratio from `getLocalWindow`, then calls `revealWords`/`revealChars`/`scrambleChars` to write partial `Computed.chars`.
- Sort comparators order children (`ItemIndex`) and keyframes (`Keyframe.time`) in `actions/cache.ts`, `actions/hierarchy.ts`, `queries/hierarchy.ts`, `queries/timeline-index.ts`.

## Interfaces

- Depends on:
  - `packages/runtime/src/traits` (`Computed`, `Cache`, `TextStyle`, `TextRange`, `TextCache`, `StrokeStyle`, `RenderSurface`, `Transition`, `Generating`, `SourceError`, `Time`, `Trim`, `Library`, `Paint`, `AssetId`, and others) — see [../traits/README.md](../traits/README.md).
  - `packages/runtime/src/world/store.ts` (`store`) — see [../world/README.md](../world/README.md).
  - `packages/runtime/src/constants.ts` (`CONONICAL_TIME_BASE`, `PaintType`, `FontStyle`, `TextAlign`, `TextBaseline`, `TextCase`, `StrokeCap`, `StrokeJoin`, `COMPOSITE_OPERATIONS`).
  - `packages/runtime/src/math/common.ts` (`clamp`) — see [../math/README.md](../math/README.md).
  - `packages/runtime/src/systems/gradients.ts` (`createLinearGradient`, `createRadialGradient`), `packages/runtime/src/queries/hierarchy.ts` (`getParentNode`), `packages/runtime/src/actions/assets.ts` (`getSourceDuration`).
  - npm: `colord` (`color.ts`), `animejs` (`generating.ts`), `koota` types, `@diffusionstudio/assets` (`Asset` type).
- Used by (inside runtime):
  - `systems/render.ts`: `colorToHex`, `isGenerating`, `getSourceFailure`, `getGeneratingColor`, `FAILED_COLOR`, `applyStrokeStyle`, `renderText`, `getTransitionWindow`, `drawOnto`, `getSurfaceContext`, `findGeometryAssetSource`, `getIntrinsicPaint` — see [../systems/README.md](../systems/README.md).
  - `systems/playback.ts`: `getIntrinsicPaint`, `getSourceWindow`, `getTransitionWindow`. `systems/motion.ts`: `revealChars`, `revealWords`, `scrambleChars`, `getLocalWindow`. `systems/assets.ts`: `findAssetDuration`, `findGeometryAsset`, `assert`. `systems/gradients.ts`: `colorToCss`.
  - `actions/timing.ts`: `findAssetDuration`, `getSourceFrameAt`, `isPaintEntity`, `secondsToFrames`, types `Ignorable`, `TimeTrait`. `actions/playback.ts`: `getIntrinsicPaint`. `actions/cache.ts`, `actions/group.ts`, `actions/hierarchy.ts`, `actions/frame.ts`: `sortByItemIndex`, `sortByFrame`, `assert` — see [../actions/README.md](../actions/README.md).
  - `queries/hierarchy.ts`, `queries/timeline-index.ts`: `sortByItemIndex` — see [../queries/README.md](../queries/README.md).
  - `media/caption/*.ts` (classic, stark, cascade, whisper, spotlight, paper, guinea): `renderText`. `media/audio.ts`: `AsyncMutex`. `media/audio-bus.ts`: `attempt`. `media/transcode.ts`: `formatTimestamp`. `media/video.ts`, `media/sequence.ts`, `media/audio-sync.ts`: `assert`. `media/shader.ts`: `parseColor` — see [../media/README.md](../media/README.md).
  - `traits/text.ts`: `Token` type for `TextCache.tokens`.
- Used by (outside runtime, via `@diffusionstudio/runtime` barrel `packages/runtime/src/index.ts`):
  - `packages/reconciler/src/document.ts`: `parseColor`, `secondsToFrames`.
  - `packages/encoder/src/encoder.ts`, `packages/encoder/src/image-encoder.ts`: `framesToSeconds`, `formatTimecode`.
  - `apps/web/src/engine/timeline/render/clip.ts`, `apps/web/src/engine/hud/hud-system.ts`: `isGenerating`, `getSourceFailure`, `getGeneratingColor`.
  - `apps/web/src/engine/timing.ts`, `apps/web/src/engine/editor.ts`, `apps/web/src/engine/group.tsx`: `getTimelineOrigin`, `framesToSeconds`, `secondsToFrames`, `getSourceFrameAt`, `getIntrinsicPaint`.
  - `apps/web/src/engine/object-mask/*`, `apps/web/src/engine/timeline/render/thumbnails.ts`, `waveform.ts`: `getSourceWindow`, `findGeometryAssetSource`, `findGeometryAsset`.
  - `apps/web/src/dapi/handlers/media-grab.ts`, `media-segment.ts`: `formatTimecode`. `apps/web/src/engine/timeline/drag.ts`: `findAssetDuration`.
  - `apps/web/src/utils/color.ts` and `apps/web/src/utils/common.ts` define their own `parseColor`/`colorToHex`/`attempt`/`AsyncMutex`; app UI components may import either copy. Unclear from source which copy each component uses without per-file checks.
  - `sortByStartTime`, `sortByOffset`, `findWidestStroke` (outside `text.ts`), `transformText`, `snapToMs`, `snapToFps`: no importers found outside this dir.

Up: [../README.md](../README.md)
