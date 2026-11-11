# `apps/web/src/components/sidebar-right/inspector`

The right-sidebar Inspector: a stack of property panels that reads the current selection (nodes, keyframes, or a library asset) from the ECS world and writes edits back through `DocumentEditor`, so the JSX file, undo history, and canvas stay in sync.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `inspector.tsx`. |
| `inspector.tsx` | `Inspector()`: root component. `classifyNode(entity)` -> `SelectionTarget` (`scene`, `clip-path`, `sequence`, `caption`, `audio`, `adjustment`, `text`, `shape`, `group`, `stage`; plus `scene-tool`, `keyframe`, `asset`). Mounts `InspectorHeader` and a `ControlScrollArea` keyed by `selectionHash` (remounts panels on selection change). Each panel is gated by `includesTarget(...)`. |
| `inspector-header.tsx` | `InspectorHeader()`: "Editor" label and camera zoom dropdown (`zoomBy`, `zoomTo`, `zoomToFit` from `@/engine`). |
| [transform/](transform/README.md) | `TransformSettings`: position plus opt-in rows (constraints, rotate, anchor, offset, scale, skew). |
| `scene-template.tsx` | `SceneTemplatePanel`: shown when `Tool` is `SCENE`. Lists `PRESET_CATEGORIES`; a click inserts a `<Scene>` with a black `<SolidPaint>` centered in the viewport, activates and selects it, then switches to `MOVE`. |
| `alignment.tsx` | `Alignment`: toolbar for multi-selection (`nodes().length > 1`). Six align actions -> `alignSelection`, two distribute actions -> `distributeSelection` (`@/engine/align`). |
| `export.tsx`, `export-templates.ts`, `export-progress.tsx` | `ExportPanel` (root scenes only): reads/writes per-scene export settings via `useProjectConfig().exportOf/setExport`; `ExportInspector` floating dialog (template select, video/audio toggles, resolution via `computeOutputSize`, bitrate, codec, format, fps, sample rate); `canEncodeVideo` (mediabunny) gates the Export button; `estimateFileSize()`. `export-templates.ts`: `EXPORT_TEMPLATE_GROUPS`, `TEMPLATE_BY_ID`, option lists, `DEFAULT_EXPORT_TEMPLATE_ID = "h264-mp4-1080p"`. `export-progress.tsx`: `ExportProgress` fullscreen overlay (Portal) with config summary, progress bar, cancel; type `ExportConfig`. |
| `background.tsx` | `BackgroundSettings` (stage): edits `Root` entity `background` prop via `ColorOpacityRow` + floating `ColorOpacityPicker` (no opacity). |
| `variables.tsx` | `VariablesSettings` (stage): one control per `@inspect` entry from `useInspectEntries(world)`, grouped one level by `entry.group`. Types: number (slider if min+max), color, font (`FontDropdown`), text (`GrowingTextArea`), boolean, select. Commits via `editor.editVariable(file, name, value)`. |
| `time.tsx` | `TimeSettings`: Length field; opt-in "In & Out" and "Speed" rows (persisted in `store.define("time.addons")`); Frame Rate row for SEQUENCE assets (`findGeometryAsset`, `SourceFrameRate`); "Trim content" checkbox for group-like nodes. Writes via `trimIn`, `trimOut`, `editTime` (`@/engine/timing`) and `playbackRate` prop. |
| `layout.tsx` | `LayoutPanel`: width/height with keyframe diamonds; `KeepAspectRatio` lock drives the other axis; scene-only: preset dropdown (`PRESET_CATEGORIES`), orientation swap, `ClipsContent` checkbox (trait toggled directly). |
| `appearance.tsx`, `blend-modes.ts`, `source.tsx` | `AppearanceSettings`: opacity, blend mode (hover previews on trait, select writes prop), hide toggle, corner radius (uniform `cornerRadius` or four per-corner props; mode switch clears the other mode's props and keyframe tracks). `blend-modes.ts`: `BLEND_MODE_ORDER`, `BLEND_MODE_SEPARATORS`, `blendModeName`, `displayBlendMode`. `source.tsx`: `SourceRows` shows intrinsic paint (`getIntrinsicPaint`: video/image `src` with `AssetFillPicker` + `FitMenu`, or label for html/surface/waveform) and intrinsic solid (`fill` prop, `color` on text); remove media -> `editor.removeIntrinsicPaint`. |
| `caption-settings.tsx`, `caption-types.ts` | `CaptionSettings`: preset select and per-preset color slots (`colors` written positionally, all slots at once). `caption-types.ts`: `CAPTION_PRESET_OPTIONS` (classic, cascade, spotlight, whisper, paper, guinea, stark), `captionPresetOption()`. |
| `text.tsx` | `TextPanel` (text, caption): content (`editor.editText`, sets `TEXT_EDIT` tool on focus), `FontDropdown` (web fonts + local fonts via `queryLocalFonts`, hover preview on `TextStyle` trait, `LazyFontItem` with IntersectionObserver), weight select, size, leading, letter spacing, Grow (auto = unset width/height, fixed = pin `Computed` size), horizontal/vertical align. Exports `FontDropdown`, `GrowingTextArea` (reused by `variables.tsx`). |
| `fills.tsx`, `fill-row.tsx`, `fill-picker.tsx`, `solid-picker.tsx`, `gradient-picker.tsx`, `gradient-stops.ts`, `asset-picker.tsx` | Fill stack. `FillsSettings`: lists `Cache.fills` reversed (topmost first); plus inserts `<SolidPaint color="#E0E0E0">`; reorder = `editor.reparent` swap. `FillRow`: label by `PaintType`, context menu (move, hide, remove). `FillPicker`: tabs solid/gradient/asset; changing kind replaces the element (`replaceFill`) and reports it via `onReplace`; exports `FitMenu` (`objectFit`), `getFillTab`, `FIT_OPTIONS`; `BlendModeMenu` per paint. `SolidFillPicker`: `color`/`opacity`. `GradientFillPicker`: stops as `<colorStop>` children (drag track, add/duplicate/delete/redistribute, Backspace removes selected), rotation, flip, linear/radial swap via `onChangeKind`. `gradient-stops.ts`: `readGradientStops` (sorted by offset), `sameGradientStops`, `readStopProps`. `AssetFillPicker`: library image/video grid with search + filter; scenes get stills only; "Generate with AI", "Import from computer". |
| `strokes.tsx`, `stroke-inspector.tsx` | `StrokesSettings`: `Cache.strokes` list, plus inserts `<Stroke color="#000000">`, reorder/hide/remove. `StrokeInspector`: color+opacity, width, join (`miter`/`bevel`/`round`), miter limit. |
| `shadows.tsx`, `shadow-inspector.tsx` | `ShadowsSettings`: `Cache.shadows` list, plus inserts `<Shadow color="#000000" opacity={0.25} blur={4} offsetY={4}>`. `ShadowInspector`: color+opacity, offsetX/Y, blur, all keyframeable. |
| `effects.tsx`, `effect-types.ts`, `effects-inspector.tsx`, `object-mask.tsx` | `EffectsSettings`: `Cache.effects` list, plus inserts `<Effect type="blur" value={8}>`. `effect-types.ts`: `EFFECT_OPTIONS` with `unit` (`amount`/`px`/`deg`) and default `value`. `EffectsInspector`: type select in header, value control by unit, keyframe on `value`; type change across units resets value and removes the track; matte masks: lists `Cache.masks`, "Add matte mask" copies a tracked mask (`copyObjectMask`). `ObjectMaskInspector`: source select (`useObjectMasks`), strength (`opacity`), smoothing, feather (`blur`), invert, hide; restore failed mask (`restoreObjectMask`). Exports `objectMaskName`. |
| `tracking.tsx` | `TrackingSettings` (shape): object-mask tracks of the clip's footage (`useObjectMasks`); plus sets `Tool` to `OBJECT_MASK`; remove -> `removeObjectMask`. Renders only when `footage()` is set. |
| `animations.tsx`, `animation-types.ts` | `AnimationsSettings`: `Cache.animations` sorted IN before OUT; plus inserts `<Animation type="fade">`. `AnimationInspector`: grouped type select (text/audio groups gated by `isText`/`hasAudio`), phase, duration, delay (seconds, 0.1 step). `animation-types.ts`: `ANIMATION_GROUPS`, `animationOption()`. |
| `transition.tsx`, `transition-types.ts` | `TransitionSettings` (shape inside a sequence): single `transition` prop written whole `{ type, duration }`; plus authors 1s dissolve; remove writes `false`. `transition-types.ts`: `TRANSITION_OPTIONS`, `transitionOption()`. |
| `clip-paths.tsx` | `ClipPathsSettings`: `Cache.clipPaths` rows (select -> `editor.select`, remove -> `editor.remove`); plus -> `beginClipPathFor` (`@/engine/clip-path`). |
| `audio.tsx` | `AudioSettings` (shape, audio, group): `volume` dB field + `VolumeKnob` (-60..12 dB, keyframeable), `muted` prop, `Soloed` trait (not persisted), two `HorizontalMeter`s fed by `useVolumeMeter` connected to `AudioBusHandle`. |
| `interpolation.tsx`, `easing-types.ts` | `InterpolationSettings` (keyframe selection): tabs hold/ease/spring. Reads `Keyframe.easing` of the first keyframe; writes `easing` to all selected (named preset or descriptor; linear unsets). `BezierCurve` (drag handles), `SpringCurve` (bounce/duration pills, animejs `spring`), `StepCurve`, `InterpolationPreview`. `easing-types.ts`: `EASE_PRESETS`, `SPRING_PRESETS`, `easingPreset()`. |
| `asset-info.tsx`, `asset-info-preview.tsx` | `AssetInfoPanel` (asset selection): `PartialDetails` for in-flight/failed generations (retry via `retryGeneration`, delete); `AssetDetails` with `AssetInfoPreview` (image/video/audio waveform from `derivePeaks`/cache peaks, play/scrub), "Insert at playhead", "Replace source", metadata rows (`useAssetMetadataRows`, prompt/model loaded from Supabase `usage_records`). |
| `marker.tsx`, `styles-modal.tsx` | `MarkerPanel` (timecode + color select, local signals only) and `StylesModal` (static brand/gray swatches). Not imported anywhere in `apps/web/src`; unused. |

## How it works

- `pages/editor.tsx` renders `<Inspector />`. `Inspector` reads `useTool()`, `useSelection()` (`nodes`, `keyframes`, `first`) and `useAssetSelection()` (`asset`, `partial`).
- Priority: `SCENE` tool -> `scene-tool`; any keyframes -> `keyframe`; asset or partial -> `asset`; exactly one node -> `classifyNode`; else `stage`.
- Panel gating by target (from `inspector.tsx`):
  - `scene-tool`: `SceneTemplatePanel`.
  - `nodes().length > 1`: `Alignment`.
  - `scene` and not nested: `ExportPanel`.
  - `stage`: `BackgroundSettings`, `VariablesSettings`.
  - shape/text/audio/scene/caption/group/clip-path/adjustment: `TimeSettings`, `TransformSettings`.
  - shape/text/audio/scene/clip-path: `LayoutPanel`.
  - shape/text/scene/caption/group/audio/clip-path: `AppearanceSettings`.
  - caption: `CaptionSettings`. text/caption: `TextPanel`.
  - shape/text/scene: `FillsSettings`, `ShadowsSettings`. shape: `TrackingSettings`.
  - shape/text/scene/caption: `StrokesSettings`, `EffectsSettings`.
  - shape/text/caption/group/clip-path: `AnimationsSettings`. shape + sequence child: `TransitionSettings`.
  - shape/text/caption/group: `ClipPathsSettings`. shape/audio/group: `AudioSettings`.
  - `asset`: `AssetInfoPanel`. `keyframe`: `InterpolationSettings`.
- Read path: panels read resolved values from the `Computed` trait through `useDerived` (written by systems without change events) and authored traits through `useTrait`/`useHas`. Child lists (fills, strokes, shadows, effects, animations, clipPaths, masks) come from the `Cache` trait.
- Write path: `editor.editProperty(entity, prop, value)` writes the JSX prop; `value === false` unsets it. Animatable props also call `syncKeyframe(world, editor, entity, prop, value)`; mode switches call `removeKeyframeTrack`. Child elements are authored with `editor.insertElement(parent, () => <Element .../>, anchor?)`, removed with `editor.remove`, reordered with `editor.reparent`.
- Default convention: a control left at the prop's default writes `false` (opacity 1, rotation 0, blur 0, leading 1, fit `cover`, blend `sourceOver`, easing linear, transition absent).
- Trait-only writes (not persisted to JSX): `Soloed`, `ClipsContent`, blend/font hover previews, transform `Anchor`/`Flip`/`Skew` (see [transform/](transform/README.md)).
- List panels share one pattern: `PanelSection` with a plus action, `For` over rows, `picked` signal filtered against the live list (`editing`), and a `FloatingInspector` anchored to the section for the picked item.
- Element-kind changes are swaps: `FillPicker.replaceFill` inserts the new paint before the next sibling and removes the old one; gradient linear/radial swap rewrites stops via `readStopProps`.
- Export settings live in project config (`package.json` `diffusion.export.<scene id>`), not the composition; `useExport().exportScene` runs the encoder and `context/export.tsx` shows `ExportProgress`.

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime`: traits (`Computed`, `Cache`, `Paint`, `Effect`, `Animation`, `Transition`, `Caption`, `TextStyle`, `Chars`, `Keyframe`, `Trim`, `PlaybackRate`, `FrameRate`, `Background`, `Root`, `Hidden`, `Muted`, `Soloed`, `AudioBusHandle`, `BlendMode`, `CornerRadius`, `MixedCornerRadius`, `KeepAspectRatio`, `ClipsContent`, `Mask`, `AssetId`, `Library`, `Tool`), predicates (`isScene`, `isText`, `isShape`, ...), helpers (`colorToHex`, `framesToSeconds`, `secondsToFrames`, `getIntrinsicPaint`, `getParentNode`, `getAssetFile`, `loadWebFont`, `getWebFonts`).
  - `@diffusionstudio/reconciler`: JSX element constructors (`Scene`, `SolidPaint`, `LinearGradientPaint`, `RadialGradientPaint`, `ImagePaint`, `VideoPaint`, `ColorStop`, `Stroke`, `Shadow`, `Effect`, `Animation`) and name tables (`BLEND_MODES`, `EFFECT_TYPES`, `ANIMATION_TYPES`, `TRANSITION_TYPES`, `CAPTION_PRESETS`, `EASINGS`), type `InspectEntry`.
  - `@diffusionstudio/jsx` types; `@diffusionstudio/assets` (`assetName`, `derivePeaks`, `DEFAULT_MASK_SMOOTHING`); `@diffusionstudio/encoder` (`computeOutputSize`, `EncoderConfig`); `@diffusionstudio/koota-solid` (`useWorld`, `useTrait`, `useHas`); `mediabunny` (`canEncodeVideo`); `animejs` (`cubicBezier`, `spring`); `somoto` (toasts).
  - `apps/web/src/engine`: `hooks` (`useEditor`, `useDerived`, `useSelection`, `useAssetSelection`, `useTool`), `keyframes.tsx` (`syncKeyframe`, `removeKeyframeTrack`), `editor.ts` (`DocumentEditor`), `align`, `timing`, `clip-path`, `object-mask`, `library`, `asset-actions`, `generations`, `inspect`, `fonts`, `project-config`, camera zoom (`useCameraScale`, `zoomBy`, `zoomTo`, `zoomToFit`). See [../../../engine/README.md](../../../engine/README.md).
  - `apps/web/src/components/ui`: `PanelSection`, `ControlRow`, `ItemRow`, `FloatingInspector*`, `ColorOpacityPicker`, `ColorOpacityRow`, `ControlledTextField`, `SliderInput`, `Select*`, `DropdownMenu*`, `ContextMenu*`, `SegmentedIconTabs`, `Keyframe`, `Switch*`, `Checkbox*`, `Button`, `Icon`, `Tooltip*`, `ControlScrollArea`, `AssetThumbnail`, `OpacitySwatch`, `FillItem`, `ProgressSlider`, `IncrementDecrementControl`. See [../../ui/README.md](../../ui/README.md).
  - `apps/web/src/components/sidebar-left/asset-item` (`LazyAssetItem`), `components/genai` (`createDefaultConfig`, `toClientConfig`), `context/prompt-input`, `context/export`, `hooks` (`useVolumeMeter`, `useDrag`, `usePermissionState`, `useControlledSelection`), `lib/layout-presets`, `lib/store`, `lib/supabase`, `utils/formatters`, `utils/color`, `init.ts` (`store`).
- Used by:
  - `apps/web/src/components/sidebar-right/index.ts` re-exports; `apps/web/src/pages/editor.tsx` line 260 renders `<Inspector />`.
  - `apps/web/src/context/export.tsx` and `context/render.ts` import `ExportProgress` / `ExportConfig` from `export-progress.tsx`.

Up: [../README.md](../README.md)
