# `apps/web/src/engine/timeline/render`

Immediate-mode canvas draw functions for the timeline: each function paints one layer (ruler, rows, clips, playhead, work area, marquee, snap line) and handles the pointer gestures that belong to that rectangle.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports every module below. |
| `layers.ts` | `renderLayers(world, scene, surface)`: walks `buildTimelineLayers(world, scene)` top to bottom with a `RowCursor { top, height }`. Culls subtrees off screen in time (`VIEWPORT_PADDING = 10px`). `keyframe-track` nodes go to `renderKeyframeTrack`; `sub-item` nodes add height only. Private `renderRow` sets the row transform (`getRowTransform`), applies `getClipAlpha`, paints a `Hovering` highlight, and draws either one clip or, for a `Sequential` parent, all children (`Geometry | Group | AdjustmentLayer` with `ChildOf`) side by side, dragged children last. |
| `clip.ts` | `renderClip(world, scene, surface, entity, row)`: one clip body. Scopes the pointer to `entity.id()`, runs `handleBody` (click selects, drag calls `beginClipDrag`/`applyClipDrag`, marquee intersection selects/deselects via `DocumentEditor`), fills the rounded body (`getGeneratingColor` while `isGenerating`), calls `renderContent`, draws the label (`Name`, caption preset name, `Chars` for text, `getClipFallbackName`, `'Generating...'`, or `getSourceFailure` error), strokes the border (`Selected` -> ring color, 2px), then `handleTrim` (in/out handles sized `min(max(w/3,3), w/2, TRIM_HANDLE_WIDTH)`; sets `surface.cursor` to `trim-right`/`trim-left`; `beginTrim`/`applyTrim`). Skips trim when `fitsChildren(entity)`. Exports `getClipAlpha(entity)` (0.5 when `Hidden`). |
| `thumbnails.ts` | `renderStillThumbnails(...)`: tiles one `resolveStill(asset, tileWidth)` bitmap across IMAGE/SEQUENCE/MASK clips; tile width 80/100/120 by row height; skips SVG and rows <= `CLIP_BREAKPOINTS.sm`; `coverCrop` centers like `object-fit: cover`. `renderVideoThumbnails(...)`: `videoLayout(rowHeight)` splits the body into a picture strip (top half, `MIN_STRIP_HEIGHT = 42`) and waveform (bottom); calls `requestFrames` for the visible source range (scaled by `playbackRate`) and draws `pickFrame` results at source-time tile indices translated by `computed.origin`. |
| `waveform.ts` | `renderWaveform(world, scene, surface, entity, row, options: WaveformOptions)`: draws audio peaks one `SAMPLE_WIDTH` column at a time. Calls `requestPeaks` for the on-screen source range at `peaksPerSecond = max(1, floor(fps*resolution)) / SAMPLE_WIDTH / playbackRate`; reads `getClipSamples(eid)` by time. Centers on tall rows, bottom-anchors and fades (`alpha *= 0.6`) on short rows. Returns early when `asset.sampleRate` is falsy. |
| `caption.ts` | `renderCaption(...)`: one block per word group from `resolveCaptionDecoder(world, entity).groups`; group time = `computed.origin + secondsToFrames(word.start/end)`; clips groups trimmed past `start`/`end`; text via `truncateText`. |
| `group.ts` | `renderGroup(...)`: for a collapsed group, draws each `Cache.children` span as a bar below the label (`CHILD_TOP = 20`), clipped to the group's rounded body. Skips when row height leaves < 12px. |
| `keyframes.ts` | `renderKeyframeTrack(world, scene, surface, track, row)`: diamonds (`SIZE = 8`, hitbox 12) for `Cache.keyframes`; x = `framesToPixels(computed.origin + time/playbackRate)` from `findClosestParentGeometry(track)`; end keyframes half-filled. Private `handleKeyframe`: click/shift-click/marquee select via `DocumentEditor`; drag adds `KeyframeDragOrigin` and calls `editor.editProperty(keyframe, 'time', ...)` in clip time (`delta * rate`). |
| `ruler.ts` | `renderRuler(...)`: pointer scope `'ruler'`. Click or drag -> pause `Playback` and `editPlayhead`; shift-drag -> `editWorkarea([start, end])` and playhead follows the moving edge. Ticks from `getRulerInterval(resolution)` (nearest `RULER_INTERVALS` entry to `TARGET_MAJOR_TICK_DISTANCE`); labels via `formatTickLabel` (`mm:ss` on whole seconds, `Nf` otherwise). |
| `playhead.ts` | `renderPlayhead(...)`: knob (`KNOB_PATH`) in the ruler, 3px dark + 1px ring line down the canvas. Private `renderMotionTrail`: gradient trail whose width is a critically damped spring on measured playhead velocity (`GRADIENT_RESPONSE_TIME = 0.15s`, max 150px). Private `renderCollapsedPlayhead`: pill with frame number when `surface.minimized`. Module-level state: `gradientWidth`, `gradientVelocity`, `lastFrame`, `lastTimestamp`. |
| `workarea.ts` | `renderWorkarea(...)`: bar (`BAR_HEIGHT = 10`) in the ruler when `scene.has(Workarea)`, drawn with `globalCompositeOperation = 'difference'`; in/out handles from `IN_POINT_PATH`/`OUT_POINT_PATH`. Pointer scope `'workarea'`: drag bar moves both ends, drag handle moves one end, double-click -> `editWorkarea(world, scene, null)`. Module-level `dragOrigin` holds the range at press. |
| `marquee.ts` | `updateMarquee(world, surface)`: full-canvas region; click -> `clearSelection()`; drag -> writes `surface.marquee` rect (clears selection on open). `renderMarquee(surface)`: 20% fill + 1px stroke in ring color. |
| `snap.ts` | `renderSnapLine(...)`: 1px vertical line at `surface.snapX` from `RULER_HEIGHT` to canvas bottom; resets `surface.snapX = null` after drawing. |

## How it works

- `../timeline.ts` calls these once per frame in fixed order: `updateDragGestures` -> `updateMarquee` -> (clipped below ruler) `renderLayers`, `renderMarquee` -> `renderRuler` -> `renderWorkarea` -> `renderPlayhead` -> `renderSnapLine`.
- Every function takes the shared `TimelineSurfaceState` (`ctx`, `canvas`, `pointer`, `layout`, `colors`, `cursor`, `marquee`, `snapX`, `minimized`) and writes back to it (`cursor`, `marquee`, `snapX`).
- Hit testing is immediate-mode: a function calls `pointer.scope(id).region(x, y, w, h)` for the rectangle it draws and reads `clicked`/`dragging`/`hovering`/`doubleClicked`/`intersectsMarquee` for the same frame. Later regions win over earlier ones, so the marquee runs first and clips draw over it.
- Geometry comes from the runtime `Computed` store (`start`, `end`, `origin`, `playbackRate`) in frames; `../view` converts frames <-> pixels (`framesToPixels`, `pixelsToFrames`, `getResolution`, `getScrollX`, `getViewport`).
- `renderLayers` -> `renderRow` -> `renderClip` -> `renderContent` dispatches by node: group -> `renderGroup`; caption -> `renderCaption`; IMAGE/SEQUENCE/MASK -> `renderStillThumbnails`; AUDIO -> `renderWaveform`; VIDEO -> `renderVideoThumbnails` (which calls `renderWaveform` too).
- Media is pulled lazily: `renderVideoThumbnails` calls `requestFrames`, `renderWaveform` calls `requestPeaks`; both draw only what `pickFrame`/`getClipSamples` already hold and fill in on later frames.
- Every state change goes through the document, never the canvas: selection via `getDocumentEditor(world).select/deselect/clearSelection`, keyframe time via `editor.editProperty`, playhead/work area via `editPlayhead`/`editWorkarea`, clip move/trim via `../drag`.
- Viewport culling at each level: subtrees off screen in time are skipped; only on-screen tiles, samples, and keyframes are drawn.

## Interfaces

- Depends on:
  - `../surface.ts` (`TimelineSurfaceState`), `../view.ts` (frame/pixel math, viewport, scroll, current frame), `../layout.ts` (`RowCursor`, `getRowTransform`, `getNodeHeight`, `getSubtreeHeight`), `../config.ts` (`RULER_HEIGHT`, `CLIP_*`, `KEYFRAME_TRACK_HEIGHT`, `TRIM_HANDLE_WIDTH`), `../constants.ts` (`RULER_INTERVALS`), `../paths.ts` (`KNOB_PATH`, `IN_POINT_PATH`, `OUT_POINT_PATH`).
  - `../drag.ts` (`beginClipDrag`, `applyClipDrag`, `beginTrim`, `applyTrim`, `isDragging`; sets `surface.snapX`), `../style.ts` (`getClipStyle`, `getClipAsset`, `getClipFallbackName`), `../text.ts` (`truncateText`), `../media.ts` (`requestFrames`, `pickFrame`, `resolveStill`), `../peaks.ts` (`requestPeaks`, `getClipSamples`, `SAMPLE_WIDTH`).
  - `apps/web/src/engine/editor.ts` (`getDocumentEditor`), `apps/web/src/engine/timing.ts` (`editPlayhead`, `editWorkarea`), `apps/web/src/utils` (`assert`).
  - `@diffusionstudio/runtime` (`Computed`, `Cache`, `Keyframe`, `Selected`, `Hovering`, `Hidden`, `Playback`, `Workarea`, `Sequential`, `ChildOf`, `ClipDragOrigin`, `TrimDragOrigin`, `KeyframeDragOrigin`, `buildTimelineLayers`, `resolveCaptionDecoder`, `getSourceWindow`, `findClosestParentGeometry`, `isGroup`/`isCaption`/`isText`/`isGenerating`, `fitsChildren`, `getSourceFailure`, `getGeneratingColor`), `@diffusionstudio/assets` (`Asset`, `AudioAsset`, `VideoAsset` types), `koota` (`World`, `Entity`, `Or`).
- Used by:
  - `apps/web/src/engine/timeline/timeline.ts` (per-frame render pass; imports `renderLayers`, `renderMarquee`, `renderPlayhead`, `renderRuler`, `renderSnapLine`, `renderWorkarea`, `updateMarquee`).
  - No other importers outside this directory (grep of `apps/web/src`).
- Parent: [../README.md](../README.md)

Up: [../README.md](../README.md)
