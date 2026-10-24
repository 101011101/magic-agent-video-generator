# `apps/web/src/components/sidebar-right`

Right-hand editor controls: the Inspector (property panels for the current selection) and the Soundboard (audio mixer strip). Both read the ECS world and write edits back through `DocumentEditor`.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Barrel. Re-exports `./inspector` and `./soundboard`. Public names: `Inspector`, `Soundboard`. |
| [inspector/](inspector/README.md) | `Inspector()`: stack of property panels. Classifies the selection (`scene-tool`, `keyframe`, `asset`, one node kind, or `stage`) and gates panels per target: transform, time, layout, appearance, text, captions, fills, strokes, shadows, effects, masks, animations, transitions, clip paths, audio, interpolation, export, background, variables, asset info. Also holds shared option tables (`export-templates.ts`, `effect-types.ts`, `gradient-stops.ts`) used elsewhere in the app. |
| [soundboard/](soundboard/README.md) | `Soundboard()`: three-column mixer (two selectable layer meters + master). dB faders, live RMS/peak bars from `useVolumeMeter`, volume writes via `editor.editProperty` + `syncKeyframe`. |

## How it works

- `pages/editor.tsx` imports both from `@/components/sidebar-right` and places them in the editor grid: `<Inspector />` in the right column (`INSPECTOR_WIDTH = 264` px, next to the canvas), `<Soundboard />` in the bottom row after `<Timeline />`. Both hide when `uiVisible()` is false; Soundboard also hides when the timeline is minimized.
- Read path (both children): resolved values come from the `Computed` trait through `useDerived`; authored traits through `useTrait`/`useHas`; child lists (fills, effects, animations, ...) from the `Cache` trait.
- Write path (both children): `editor.editProperty(entity, prop, value)` writes the JSX prop; `false` unsets it. Animatable props also call `syncKeyframe`. Elements are added with `editor.insertElement`, removed with `editor.remove`, reordered with `editor.reparent`. Edits flow to `engine/editor.ts` -> `projects/edits.ts` -> disk, and into undo history.
- Inspector and Soundboard do not import each other. They share only engine hooks and the `ui/` kit. `inspector/audio.tsx` reuses `hooks/use-volume-meter.ts`, not soundboard components.

## Interfaces

- Depends on:
  - `apps/web/src/engine` (`useEditor`, `useDerived`, `useSelection`, `useTool`, `useTimelineIndex`, `syncKeyframe`, `DocumentEditor`). See [../../engine/README.md](../../engine/README.md).
  - `apps/web/src/components/ui` control kit. See [../ui/README.md](../ui/README.md).
  - `apps/web/src/hooks/use-volume-meter.ts`. See [../../hooks/README.md](../../hooks/README.md).
  - `@diffusionstudio/runtime` traits, `@diffusionstudio/reconciler` JSX constructors and name tables, `@diffusionstudio/koota-solid`, `koota`. See [../../../../../packages/runtime/README.md](../../../../../packages/runtime/README.md).
  - Full per-child lists in [inspector/README.md](inspector/README.md) and [soundboard/README.md](soundboard/README.md).
- Used by:
  - `apps/web/src/pages/editor.tsx` line 9: `import { Soundboard, Inspector } from "@/components/sidebar-right"`; rendered at lines 260 and 287.
  - Deep imports into `inspector/` from outside this directory: `context/export.tsx` and `context/render.ts` (`ExportProgress`, `ExportConfig`, export templates); `dapi/handlers/export.ts` and `components/sidebar-left/project-menu/file-menu.tsx` (`getDefaultExportTemplate`, `VIDEO_FORMAT_OPTIONS`); `components/ui/fill-item.tsx` (`gradient-stops.ts`); `components/timeline/layers/sub-item.tsx` (`effectOption`).

Up: [../README.md](../README.md)
