# `apps/web/src/engine/hud`

Paints the editor chrome over the rendered stage canvas (node headers, selection box with handles, hover outlines, snap guides, marquee, size readout) and registers the hit regions those overlays respond to.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `hud-system` and `name-input`. |
| `hud-system.ts` | Exports `hudSystem(world)`. Draws on the `RenderSurface` 2D context after the runtime render system. Private helpers: `drawSnapLines`, `drawHoverOutlines`, `drawHeader`, `drawSelectionMask`, `drawDimensions`, `drawMarquee`, `getHeaderLayout`, `fitTextToWidth`. Pushes `HitRegion`s of `kind: 'hud'` (ids `play`, `label`, `selection`, `rtl`/`rtr`/`rbr`/`rbl` rotate corners, `l`/`t`/`r`/`b` edges, `tl`/`tr`/`br`/`bl` corner handles) into `world.get(HitRegions).list`, each with an input handler callback. |
| `name-input.ts` | Exports `mountNameInput(world, entity)`, `unmountNameInput()`, `getMountedNameInput()`. Places an absolute `<input>` DOM element over a node header for in-place rename. Writes `name` through `DocumentEditor.editProperty` on each keystroke; restores the original on Escape or empty value; `stopPropagation` on keydown so window shortcuts do not fire. Module-level `mounted` holds the single open field. |

## How it works

- `create-engine.ts` `runSystems()` calls `hudSystem` after `renderSystem` and before `timelineSystem`, every frame. `snapshot()` also calls it once to restore the overlay after an offline render.
- `hudSystem` order per frame:
  1. `drawSnapLines`: strokes `SnapLines.list` in `#F43535` with X crosses at each end. Skipped while `Keys.held` has `mod` (mod suspends snapping).
  2. `drawHoverOutlines`: strokes `entityQuad` of every `Hovering` entity that is `Geometry` or `Group`, not `Sequential`, not `Culled`.
  3. `drawHeader` for each direct child of `Root` that is not `Culled`/`Hidden`. Header sits one `HEADER_HEIGHT` (22) above the node's top edge, follows node rotation, ignores zoom scale (`getHeaderLayout`). Contents: play/pause glyph (`PLAY_PATH`/`PAUSE_PATH`) when the entity has `Playback`; label (source failure text, `Generating...` when `isGenerating`, else `Name.value`), elided by `fitTextToWidth` with a `TEXT_WIDTHS` cache; `Active` badge when entity has `Active`; `mm:ss` duration from `Computed.duration / FrameRate`. Pushes `play` and `label` hit regions.
  4. If `getMountedNameInput()` matches the entity, `drawHeader` positions the DOM input in CSS pixels (`inputMat.e / resolution`) and rotates it to the header angle.
  5. `drawSelectionMask` + `drawDimensions` run when `getSelectionMask(world)` returns a mask and `Hud.mode !== 'moving'` (mask hides during a move gesture). Mask draws each selected node's quad, the shared box, four white 8px corner handles. Pushes regions: `selection` (body), four 16px rotate squares outside corners, four 6px edge strips, four corner handles.
  6. `drawDimensions`: `WxH` pill under the selection. Single node: `Computed.width * |scaleX|` along the node's bottom edge. Multi: mask size mapped back through inverse of `entityWorldMat(world, null)` (view transform) so the readout is in document units.
  7. `drawMarquee`: fills and strokes `getMarqueeQuad(world)` when `Hud.mode === 'marquee'`.
  8. `drawObjectMasks` from `../object-mask`.
- Hit regions are pushed in draw order; `inputSystem` hit-tests them last-to-first, so later HUD regions (handles) win over entity regions the render system pushed earlier. The input system clears the list at the end of its frame.
- Rename flow: double-click on a `label` region -> `handleLabelInteraction` -> `mountNameInput`. The HUD repositions the input each frame while mounted. Blur/Enter/Escape close it.

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime`: traits `RenderSurface`, `HitRegions`, `Root`, `Hovering`, `Selected`, `Active`, `Playback`, `Name`, `Computed`, `FrameRate`, `Geometry`, `Group`, `Sequential`, `Culled`, `Hidden`, `ChildOf`; helpers `entityQuad`, `entityWorldMat`, `getSelectionMask`, `getMaskSelection`, `getSourceFailure`, `isGenerating`, `rectToQuad`, `multiply2D`, `translate2D`, `rotate2D`, `scale2D`, `invert2D`, `transformPoint`, `store`. Runtime render system (`packages/runtime/src/systems/render.ts`) pushes the `kind: 'entity'` regions the HUD layers over.
  - [`../traits.ts`](../README.md): `Hud`, `Keys`, `SnapLines`.
  - [`../input/`](../input/README.md): `handleLabelInteraction`, `handleMaskInteraction`, `handlePlayInteraction`, `handleResizeInteraction`, `handleRotateInteraction` (region callbacks), `getMarqueeQuad`.
  - [`../object-mask/`](../object-mask/README.md): `drawObjectMasks`.
  - [`../editor.ts`](../README.md): `getDocumentEditor` (name-input writes).
- Used by:
  - `apps/web/src/engine/create-engine.ts`: `hudSystem` in `runSystems()` and `snapshot()`.
  - `apps/web/src/engine/input/interactions.ts`: `mountNameInput` on label double-click.
  - `apps/web/src/engine/index.ts`: re-exported as part of the engine public surface.
  - Note: `apps/web/src/components/timeline/layers/node.tsx` has its own local `mountNameInput` ref callback; it is not this module.

Up: [../README.md](../README.md)
