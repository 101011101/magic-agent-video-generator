# `apps/web/src/components/sidebar-right/inspector/transform`

The "Transform" inspector section: position plus opt-in rows for constraints, rotate, anchor, offset, scale and skew on the selected node.

## Parts

| Part | Role |
|---|---|
| `index.ts` | Re-exports `transform-settings`. |
| `transform-settings.tsx` | `TransformSettings({ selection })`. `PanelSection` "Transform". Always shows Position (`x`/`y`). "Add transform" (+) dropdown toggles addon rows. Addon visibility is per-user app state: `createStoredSignal(store.define('transform.addons', {}))`. `supportsConstraints` memo: false for sequences and adjustment layers; walks up past sequence parents; true only when the parent is a scene. |
| `constants.ts` | `anchorPositions` (9 grid points with icon + tooltip), `horizontalConstraints` / `verticalConstraints` (`ConstraintType` -> label), `horizontalConstraintName()` / `verticalConstraintName()` (`ConstraintType` -> JSX name via reverse map of `HORIZONTAL_CONSTRAINTS` / `VERTICAL_CONSTRAINTS`). Types `Constraint`, `AnchorPosition`. |
| `constraints-row.tsx` | `ConstraintsRow({ node })`. Two `Select`s (horizontal, vertical) plus a clickable pin diagram (left/right/top/bottom/center). Writes `constrainX` / `constrainY` props. `MIN` writes `false` (prop absent). Center button writes both axes. |
| `rotate-row.tsx` | `RotateRow({ node, onRemoveAddon })`. `rotation` field with keyframe diamond, "Rotate 90" button, flip H / flip V buttons. `rotation` is a prop (unset at 0). Flip writes the `Flip` trait directly (`node.add(Flip)`, `node.set(Flip, {x|y: ±1})`); not persisted to JSX. |
| `anchor-row.tsx` | `AnchorRow({ node, onRemoveAddon })`. X/Y percent fields plus `AnchorPointPicker`. Writes the `Anchor` trait directly, both axes on every write (absent trait reads as 0.5,0.5; trait default is 0,0). Not persisted to JSX. |
| `anchor-picker.tsx` | `AnchorPointPicker({ x, y, onPick })`. 3x3 button grid from `anchorPositions`; active cell when within 0.01 of current anchor; icon on hover/active, dot otherwise. |
| `offset-row.tsx` | `OffsetRow({ node, onRemoveAddon })`. `offsetX` / `offsetY` fields with keyframe diamonds. Unset at 0. |
| `scale-row.tsx` | `ScaleRow({ node, onRemoveAddon })`. Uniform field (`scale`, unset at 1) or separate `scaleX` / `scaleY` fields, switched by `SegmentedIconTabs`. Mode init: `separate` when node has `Scale` and not `UniformScale`. Mode switch clears the other mode's props and keyframe tracks (`removeKeyframeTrack`). Uniform field shows "Mixed" in separate mode. |
| `skew-row.tsx` | `SkewRow({ node, onRemoveAddon })`. `skewX` / `skewY` degree fields. Writes the `Skew` trait directly; no keyframe diamonds (no prop to name). Not persisted to JSX. |

## How it works

- `Inspector` passes `selection`; `TransformSettings` uses `selection[0]` as `entity`.
- Reads: every row reads current values from the `Computed` trait via `useDerived` (positionX/Y, rotation, offsetX/Y, scaleX/Y, skewX/Y). `Flip`, `Anchor`, `Constraint` are read via `useTrait`.
- Writes, two paths:
  - Prop path: `editor.editProperty(entity, name, value)` then `syncKeyframe(world, editor, entity, name, value)`. Used for `x`, `y`, `rotation`, `offsetX/Y`, `scale`, `scaleX/Y`, `constrainX/Y`. Survives recompile; goes through history.
  - Trait path: `node.add(T)` + `node.set(T, ...)`. Used for `Anchor`, `Flip`, `Skew`. No JSX spelling, so lost on recompile.
- Default convention: a value at its default writes `false` to unset the prop (`rotation` 0, `offset` 0, `scale` 1, constraint `MIN`). Position is the exception: always written, even at 0.
- Each addon row wraps its `ControlRow` in a `ContextMenu` with "Reset to Default" (disabled when `isDefault`) and "Remove row" (`onRemoveAddon` -> `toggleAddon(name, false)`).
- The "+" dropdown lists only addons not yet shown; it hides when all six are shown. `ConstraintsRow` also requires `supportsConstraints()`.
- Keyframe diamonds: `<Keyframe target property>` on fields whose property is animatable (`x`, `y`, `rotation`, `offsetX/Y`, `scale`, `scaleX/Y`).

## Interfaces

- Depends on:
  - `@diffusionstudio/runtime`: traits `Computed`, `Anchor`, `Flip`, `Skew`, `Scale`, `UniformScale`, `Constraint`, enum `ConstraintType`; `getParentEntity`, `isScene`, `isSequence`, `isAdjustmentLayer` (`packages/runtime/src/traits/transform.ts`, `derived.ts`).
  - `@diffusionstudio/reconciler`: `HORIZONTAL_CONSTRAINTS`, `VERTICAL_CONSTRAINTS`. `@diffusionstudio/jsx`: types `HorizontalConstraint`, `VerticalConstraint`.
  - `@diffusionstudio/koota-solid`: `useWorld`, `useTrait`.
  - `apps/web/src/engine/hooks` (`useEditor`, `useDerived`), `apps/web/src/engine/keyframes.tsx` (`syncKeyframe`, `removeKeyframeTrack`), `apps/web/src/engine/editor.ts` (`DocumentEditor.editProperty`). See [../../../../engine/README.md](../../../../engine/README.md).
  - `apps/web/src/components/ui`: `PanelSection`, `ControlRow`, `ControlledTextField`, `Keyframe`, `Icon`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `Select`, `SegmentedIconTabs`, `Button`. See [../../../ui/README.md](../../../ui/README.md).
  - `apps/web/src/lib/store/signal.ts` (`createStoredSignal`), `apps/web/src/init.ts` (`store`, namespace `dspro.ui`).
- Used by:
  - `apps/web/src/components/sidebar-right/inspector/inspector.tsx` line 136: `<TransformSettings selection={nodes()} />`, shown for targets shape, text, audio, scene, caption, group, clip-path, adjustment. See [../README.md](../README.md).

Up: [../README.md](../README.md)
