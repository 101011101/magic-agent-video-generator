# `packages/runtime/src/systems`

The deterministic per-frame pipeline: resolve assets, advance time, sample motion, compute transforms, draw the frame. Same code runs in the editor (`apps/web`) and the offline encoder (`packages/encoder`). Browser-only systems (input, keyboard, hud, timeline) stay in `apps/web/src/engine`.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel for the five systems plus `gradients.ts`. Reached through `@diffusionstudio/runtime`. |
| `assets.ts` | `assetSystem(world)`. Consumes request traits and starts async resolutions: `LoadRequest` → `Library.resolve(src)`; `GenerationRequest` → `Ai.resolve(ref)`; `TranscriptionRequest` → `Ai.transcribe(world, scene, seed)` once no other source in the scene is pending; `SyncRequest` (`syncTo`) → `computeAudioSyncOffsetCached` then `placeSynced` writes `Delay` and `Trim`. Each resolution sets a `PendingSource`/`PendingSync` token so only the latest binds; success calls `bindAsset`, failure sets `SourceError`. DOM `<img>` hosts get a blob URL via `bindDomImage`. Promises are pushed to `FramePromises` for the encoder to await. Exports `releaseDomImageSource`. |
| `playback.ts` | `playbackSystem(world)`. `advancePlayhead` (realtime mode only) steps every `Playback` entity by `Time.delta * speed`, honours `Workarea` bounds and `loop`, writes `Computed.localTimeInSeconds`/`localTime`, and anchors `AudioPlayback` offsets on play/loop. `updateVisibility` walks each top-level node: `localTime = round((globalFrame - origin) * playbackRate)`, `visibility = start <= globalFrame < end`. `forwardDecoders` seeks video/image/caption/mask decoders, HTML hosts, and shader hosts, and schedules audio via `decoder.playTo(bus, …)`. Transition partners are forced visible inside `getTransitionWindow`. Audio buses `sync()`; `Soloed` mutes every bus outside the soloed ancestor chain. Runs `Tickers`. Exports `resolveAudioBus` (builds the `AudioBus` chain root → leaf on first use). |
| `motion.ts` | `motionSystem(world)`. For each visible Geometry/Group/AdjustmentLayer with animations or keyframe tracks: `resetAnimatedValues` copies authored traits (Position, Offset, Rotation, Scale/UniformScale, Skew, Opacity, Color, Blur, Volume, StrokeStyle, CornerRadius, MixedCornerRadius, ColorStop, Chars) into `Computed`; `applyAnimation` layers preset `AnimationType`s (FADE, GAIN, GROW, SHRINK, BLUR, SLIDE_*, SPIN, TWIST, APPEAR_WORD, APPEAR_CHAR, SCRAMBLE) with animejs `cubicBezier` easings over the in/out window from `getLocalWindow`; `sampleTrack` interpolates `KeyframeTrack` keyframes (easing strings `steps(n)`, `cubicBezier(...)`, `spring(...)`, channel-wise `lerpColor` for color) and writes through `getPropertyPaths`. Exports `getPropertyPaths` (dot-path → `{computed, authored}` store arrays) and `PropertyPath`. |
| `transform.ts` | `transformSystem(world)`. Pre-order walk from `Root` over Geometry/Group children: `computeGroupBounds` (Group = union of child local AABBs; Sequential mirrors parent), `computeLocalMatrix` (T(pos+offset) · T(pivot) · R · Skew · S(flip·scale) · T(−pivot) → `LocalTransform`), `computeWorldTransform` (parent world × local; top level uses `getViewMatrix`), `computeWorldBounds` (AABB → `WorldBounds`), `cullEntity` (adds/removes `Culled` by canvas intersection, inherited from parent). `adjustLayers` composes each `AdjustmentLayer`'s local matrix onto its preceding sibling and re-worlds that subtree. All results go straight into SoA stores. |
| `gradients.ts` | `createLinearGradient` / `createRadialGradient(world, fill, ctx, w, h)`. Build a `CanvasGradient` from a gradient paint sub-entity: center from `Position` (default 0.5,0.5), `Computed.scaleX/Y`, `Computed.rotation`; stops from `ColorStop` children sorted by `Computed.stopOffset`, colored with `colorToCss`. |
| `render.ts` | `renderSystem(world)`. Clears `RenderSurface`, fills `Background` and pushes a `hud` hit region (realtime only), sets `getViewMatrix` as base transform, then `renderNode` for each non-culled top-level node. `renderNode`: pushes an entity `HitRegions` entry if `Interactive`, applies `LocalTransform`, clips to `Cache.clipPaths`, multiplies opacity and `BlendMode`, then `renderContent` or `renderLayered`. `renderContent` dispatches Caption → `resolveCaptionDecoder().draw`, TEXT → `renderText`, RECT → `renderShapeNode` (`drawRectPath`, `renderShadows`, `renderIntrinsicFill`, `renderFills`, `renderGenerating`, `renderStrokes`), then children under `ClipsContent` and `renderTransition` (DISSOLVE, SLIDE_FROM_*, FADE_TO_BLACK/WHITE). `renderFills` handles IMAGE, VIDEO, HTML (`drawElementImage`), SURFACE, SOLID, LINEAR/RADIAL_GRADIENT, WAVEFORM, SHADER (shader samples the media directly below it). Masked effects go through `effectPasses` → `renderLayered` with pooled `OffscreenCanvas` layers, `applyMaskedEffect`, `drawMaskRemoval` (`MaskDecoder` outline or bitmap, feather, inversion). Exports `drawRectPath`, `getScaledImageProps` (FILL/FIT/COVER/NONE), `renderIntrinsicFill`, `renderFills`, `renderNode`. |

## How it works

- Frame order (from `apps/web/src/engine/create-engine.ts` and `packages/encoder/src/encoder.ts`): `assetSystem` → `playbackSystem` → `motionSystem` → `transformSystem` → `renderSystem`.
- `assetSystem` turns request traits into decoders/assets bound on entities; later systems resolve decoders through `../media`.
- `playbackSystem` writes `Computed.localTime` and `Computed.visibility` per entity and drives decoders/audio to that time.
- `motionSystem` resets `Computed` from authored traits, then overlays animations and keyframes at `Computed.localTime`.
- `transformSystem` reads the motion-resolved `Computed` values and writes `LocalTransform`, `WorldTransform`, `WorldBounds`, `Culled`.
- `renderSystem` reads those stores and draws to `RenderSurface.ctx`; `gradients.ts` is a helper for fills and strokes.
- Mode switches: `Mode` = `'realtime'` (editor; playhead advances, background drawn, decoders warm up ±15 frames) vs offline (encoder sets playhead, awaits `FramePromises`, transparent background). `'offline-audio'` skips visuals.
- Headless world (no `RenderSurface`): `renderSystem` is a no-op and nothing is culled.

## Interfaces

- Depends on:
  - `../traits`, `../world/store`, `../constants` (`PaintType`, `GeometryType`, `EffectType`, `TransitionType`, `AnimationType`, `COMPOSITE_OPERATIONS`), `../math`.
  - [../queries/](../queries/README.md): `getParentNode`, `getViewMatrix`, `getSceneAncestor`, `getEntityTree`.
  - `../media`: `resolveVideoDecoder`, `resolveImageDecoder`, `resolveAudioDecoder`, `resolveCaptionDecoder`, `resolveShaderHost`, `resolveWaveformPeaks`, `MaskDecoder`, `AudioBus`, `whenHtmlReady`, `audio-sync`.
  - `../utils`: `time` (`getSourceWindow`, `getLocalWindow`, `getIntrinsicPaint`, `findGeometryAsset*`), `transition`, `text` (`renderText`), `stroke`, `surface`, `color`, `generating`, `text-motion`, `assert`.
  - `../actions/assets` (`bindAsset`, `getAssetFile`).
  - External: `koota`, `animejs` (`cubicBezier`, `steps`, `spring`), `@diffusionstudio/jsx` (`parseSource`), `@diffusionstudio/assets` (`DEFAULT_MASK_SMOOTHING`).
- Used by:
  - `apps/web/src/engine/create-engine.ts` (frame loop; also calls `renderSystem` alone for re-draws).
  - `packages/encoder/src/encoder.ts`, `packages/encoder/src/image-encoder.ts` (offline frame loop).
  - `../world/observers.ts`, `../actions/cache.ts` (`resetAnimatedValues`); `../actions/keyframe.ts`, `apps/web/src/engine/keyframes.tsx` (`getPropertyPaths`).
  - `../actions/frame.ts`, `../actions/group.ts`, `apps/web/src/engine/group.tsx`, `apps/web/src/engine/input/interactions.ts` (`computeLocalMatrix`, `computeGroupBounds`).
  - `../media/image.ts`, `../media/shader.ts`, `apps/web/src/engine/object-mask/media.ts` (`getScaledImageProps`).
  - `../utils/text.ts`, `apps/web/src/engine/timeline/render/playhead.ts` (`createLinearGradient`).

Up: [../README.md](../README.md)
