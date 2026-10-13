# `apps/web/src/components/sidebar-right/soundboard`

Three-channel mixer strip: two selectable layer meters plus a master meter, each with a dB fader, live RMS/peak bars and a dB scale.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `soundboard`. |
| `soundboard.tsx` | `Soundboard()`. Renders three columns: left layer, right layer, master (scene root). Picks which layers are meterable, keeps the two layer slots distinct, and writes volume edits. Local `LayerName({ entity })` shows the `Name` trait or `Layer <id>`. |
| `volume-meter.tsx` | `VolumeMeter({ audioNode })`: two `VerticalMeter`s (channel 0, 1) fed by `useVolumeMeter`. `VolumeControl({ volume, onVolumeChange, disabled })`: vertical pointer-drag fader with tick marks. `MeterScale()`: labels `0 -3 -6 -12 -24 dB`. Helpers `amplitudeToMeterPct` (linear -> dB -> 0..100 over -60..+3 dB), `dbToSliderPct` / `sliderPctToDb` (fader range -60..+60 dB, 0 dB at 50%). Internal `MeterSegments` draws green (0-60%), yellow (60-80%), red (80-100%). |

## How it works

- Meterable layers: `useQuery(Or(AudioBusHandle, Volume))`, intersected with `useTimelineIndex().layers` (in timeline order). The query is used because buses appear during playback; the timeline index alone would not report that.
- Slot selection: `leftMeterEntity` / `rightMeterEntity` signals. `createEffect` (deferred) drops a slot whose layer vanished and auto-fills an empty slot with a layer not shown in the sibling slot. Each `Select` lists only layers not chosen by the other slot; disabled when one or fewer options.
- Audio tap: `useTrait(entity, AudioBusHandle)` -> `.getGain()` gives the `GainNode`. `VolumeMeter` calls `meter.connect(node)` when present, `meter.disconnect()` when null; cleanup disconnects.
- Level display: `useVolumeMeter` yields `levels()` (`ChannelLevels[]`, rms + peak per channel). `VerticalMeter` clips `MeterSegments` to rms height (`clip-path: inset(...)`) and draws a 1px peak line colored by threshold.
- Volume read: `useDerived(() => entity.get(Computed)?.volume ?? 0)` (Computed has no change events, so derived polling is used).
- Volume write: `editVolume` rounds to whole dB, calls `editor.editProperty(entity, 'volume', next === 0 ? false : next)` (0 dB = unity = unset), then `syncKeyframe(world, editor, entity, 'volume', next)`.
- Fader: `VolumeControl` captures pointer, maps `clientY` within the track to dB via `sliderPctToDb`, emits on down and move, removes window listeners on up. `disabled` when no gain node.
- Responsive ticks: CSS container `soundboard` in `apps/web/src/index.css` (lines ~310-345) hides tick/scale rows at small heights.

## Interfaces

- Depends on:
  - `apps/web/src/hooks/use-volume-meter.ts`: `useVolumeMeter()`, type `ChannelLevels`. Shared `AudioWorkletNode` per `GainNode`; worklet `volume-meter` posts `[rms0, peak0, rms1, peak1]`. See [../../../hooks/README.md](../../../hooks/README.md).
  - `@diffusionstudio/runtime`: traits `AudioBusHandle`, `Computed`, `Name`, `Volume` (`packages/runtime/src/traits/media.ts`, `derived.ts`).
  - `@diffusionstudio/koota-solid`: `useQuery`, `useTrait`, `useWorld`. `koota`: `Or`, type `Entity`.
  - `apps/web/src/engine/hooks`: `useEditor`, `useDerived`, `useTimelineIndex`. `apps/web/src/engine/keyframes.tsx`: `syncKeyframe`. See [../../../engine/README.md](../../../engine/README.md).
  - `apps/web/src/components/ui/select` (`Select`, `SelectTrigger`, `SelectValue`, `SelectItem`, `SelectContent`, `SelectPortal`). `apps/web/src/lib/cva` (`cx`). See [../../ui/README.md](../../ui/README.md).
  - `apps/web/src/index.css`: `.soundboard`, `.soundboard-tick`, `.soundboard-scale` container queries.
- Used by:
  - `apps/web/src/components/sidebar-right/index.ts` re-exports it.
  - `apps/web/src/pages/editor.tsx` line 287: `<Soundboard />`, rendered under the timeline when UI is visible and the timeline is not minimized.
  - `VolumeMeter` / `VolumeControl` / `MeterScale` are imported only inside this directory. `inspector/audio.tsx` uses `useVolumeMeter` directly, not these components.

Up: [../README.md](../README.md)
