# `apps/web/src/components/ui`

Shared SolidJS widget kit for the web editor: shadcn-solid style wrappers over Kobalte primitives plus editor-specific controls (color, keyframe, slider-input, fill row, floating inspector).

## Parts

| Part | Role |
|---|---|
| `button.tsx` | `Button` + `buttonVariants` (cva). Variants: `default`, `secondary`, `on`, `ghost`, `link`, `destructive`, `outline`. Sizes: `default` (h-7), `small`, `icon`, `icon-square`, `icon-select`. Most-imported control after `Icon`. |
| `icon.tsx` | `Icon({ name, class })`. Eager `import.meta.glob('/src/assets/icons/*.svg')`; name maps to `/src/assets/icons/<name>.svg`. Renders `null` for unknown names. 282 SVGs in `apps/web/src/assets/icons/`. |
| `tooltip.tsx` | `Tooltip` (defaults: `openDelay 0`, `closeDelay 0`, `placement top`, `gutter 8`), `TooltipTrigger`, `TooltipContent` with optional `shortcut` (string or accessor) appended in muted text. `z-[10000]`. |
| `dropdown-menu.tsx` | Kobalte `DropdownMenu` wrappers (`gutter 4`, `modal false`). `DropdownMenuItem` adds `tone: "primary" \| "neutral"` and `variant: "destructive"`. `DropdownMenuItemDetail` = right-aligned detail text. Sub-content is offset with `translate-x-2.5 -translate-y-2`. |
| `context-menu.tsx` | Kobalte `ContextMenu` wrappers. `ContextMenuContent` takes `disabled`; a context (`ContextMenuContentDisabledContext`) propagates it so every `Item`/`SubTrigger`/`CheckboxItem`/`RadioItem` is disabled. Comment: keep content mounted so close animations run. |
| `select.tsx` | Kobalte `Select` wrappers. `SelectTrigger` (`size: "sm" \| "default"`, chevron via `Icon("chevron-down")`), `SelectIconTrigger` (icon + value in a 24/1fr/24 grid), `SelectContent` (embeds `Listbox`), `SelectItem` (check via `Icon("confirm-check")`), `SelectSection`, `HiddenSelect`. |
| `text-field.tsx` | Kobalte `TextField` wrappers (`TextFieldInput` with `uiSize: "compact"`, `TextFieldTextArea`, `TextFieldLabel`, `TextFieldErrorMessage` de-duplicating `errors[].message`, `TextFieldDescription`). `ControlledTextField`: numeric text input with `onNumber`, `step`/`min`/`max` snap+clamp, `unit` suffix + `onUnitChange`, `showSign`, `skipEmpty`, `limitEvents`, ArrowUp/Down stepping (x10 with Shift), and `sliderEnabled` drag on the `icon` slot (`SLIDER_STEP_FACTOR = 3` px per step). Slots: `icon` left, `keyframe` right. |
| `slider-input.tsx` | `SliderInput`: a 28px-tall filled bar that is both a text input and a horizontal drag slider. `value/min/max/step/format`, `onChange`, `onDragStart`, `onDragEnd`. Drag starts after 4px; a click without drag focuses the input or re-dispatches `click` to inner interactive elements. Enter commits, Escape reverts. Optional `keyframe` slot. |
| `control-group.tsx` | `ControlRow({ label, labelClass, contentClass })`: `[label 64px] + [content flex-1]` row used by inspector panels. |
| `panel-section.tsx` | `PanelSection({ title, subtitle, actions })`: 40px header row with top border + content column (`data-grid=true` switches to 2-col grid). |
| `item-row.tsx` | `ItemRow({ value, label, icon, disabled })`: `[label 64px] + [icon 20px] + [text] + [children action]` clickable row; ignores clicks that land on inner `<button>`. |
| `floating-inspector.tsx` | `FloatingInspector({ anchorRef, width=264, offset=8, open })`: fixed, draggable panel placed left of the anchor, clamped to viewport (8px padding), repositioned on resize. Nested inspectors inherit `top` through `FloatingInspectorTopContext`. `FloatingInspectorHeader` registers itself as drag handle (ignores clicks on `button,a,input,select,textarea,[role=button],[data-no-drag]`). Also `FloatingInspectorContent`, `FloatingInspectorTitle`, `FloatingInspectorSeparator`. |
| `keyframe.tsx` | `Keyframe({ target: Entity, property: AnimatableProperty, disabled })`: diamond toggle button. Reads `keyframeFrame`, `findKeyframeTrack`, `findKeyframeAt`; click calls `toggleKeyframe(world, editor, target, property)`. Hidden unless target has `Source` trait and a frame. States: `hasTrack` (primary border), `isActive` (primary fill). |
| `color-opacity-picker.tsx` | `ColorOpacityPicker({ color: number, opacity, onColorChange, onOpacityChange, onBeginChange(label), onEndChange, withoutOpacity, keyframeTarget })`. HSV square + hue bar + opacity bar (all via `useDrag`), EyeDropper button (`pickScreenColor`, toast on failure), Hex/HSL/RGB `Select` with `HexColorInput`/`HslColorInput`/`RgbColorInput` (`NumberField`), opacity % input, "Document colors" swatches from `useQuery(Color)` (max 36). Emits packed `number` colors. |
| `color-opacity-row.tsx` | `ColorOpacityRow({ color, opacity, onChangeColor, onChangeOpacity, onStartTransaction, onEndTransaction, onClick, keyframe })`: compact row with `OpacitySwatch` button, hex text input, opacity % input, and whole-row horizontal drag (3px threshold) that sets opacity. Enter commits, Escape reverts. |
| `fill-item.tsx` | `FillItem({ fill: Entity, onClick })`: one paint row for the fills panel. Reads `Computed.color/opacity` via `useDerived`, `Paint` type via `useTrait`; writes through `editor.editProperty(fill, "color"\|"opacity", ...)` then `syncKeyframe`. `PaintItemIcon` picks `AssetThumbnail` (IMAGE/VIDEO), CSS gradient from `readGradientStops` (LINEAR/RADIAL), `OpacitySwatch` (SOLID), or `Icon("html-small")` (HTML/SURFACE/SHADER). `FillLabel` shows type name or `assetName`. |
| `opacity-swatch.tsx` | `checkerboardStyle(size=8)` CSS helper; `OpacitySwatch({ color, opacity })` = left half opaque, right half at opacity, over checkerboard. |
| `asset-thumbnail.tsx` | `AssetThumbnail({ asset: ThumbnailAsset, size, cache?: AssetCache, draggable })`. `sourceWidth()` rounds `dpr * needed` up to `THUMBNAIL_WIDTHS = [64,128,DEFAULT_THUMBNAIL_WIDTH,600,1200]`, capped at asset width. `MediaThumbnail` (image/video/mask): `cache.thumbnail()` or `getAssetFile` + `deriveThumbnail`; object URL revoked on cleanup. `AudioThumbnail`: `cache.peaks()` or `derivePeaks` -> bar chart. `TranscriptThumbnail`: static "Captions" mock. |
| `control-scrollarea.tsx` | `ControlScrollArea({ scrollKey })`: absolute-fill scroll container. Remembers `scrollTop` per key in a module-level LRU map (`MAX_REMEMBERED_OFFSETS = 100`) so it survives remounts; restores via `ResizeObserver` until reached, user input, or 2s timeout. Follows bottom when pinned. Shows a top hairline when scrolled. |
| `segmented-icon-tabs.tsx` | `SegmentedIconTabs({ value: Accessor, onChange, items: SegmentedIconTab[] })`: row of h-7 buttons; active = `bg-inset`, others `bg-input`. Item `icon` may be an icon name string or JSX. |
| `increment-decrement-control.tsx` | Two-button `[minus][plus]` grid; `onDecrement`/`onIncrement`, optional labels. |
| `remove-button.tsx` | `RemoveButton({ label, onClick })`: 20px round close button, `Icon("close-remove-small")` pinned to centre. |
| `search-input.tsx` | `SearchInput({ placeholder, value, onValue })`: 44px row with search icon; stops keydown propagation except Escape. |
| `search-placeholder.tsx` | `SearchPlaceholder({ text, trailing })`: static search-row look with a fake caret. |
| `progress-slider.tsx` | `ProgressSlider({ value: number, onChange(number), trackClass, fillClass, thumbClass })`: single-value Kobalte `Slider` (h-3 track) clamped to `minValue..maxValue`. |
| `switch.tsx` | Kobalte `Switch` wrappers. `switchControlVariants`/`switchThumbVariants` with `variant: "default" \| "compact"`. `SwitchInput` patches `element.focus` to default `preventScroll: true`. |
| `dialog.tsx` | Kobalte `Dialog` wrappers. `DialogContent` renders overlay + optional close button (`showCloseButton`, default true) + `overlayClass`. |
| `alert-dialog.tsx` | Kobalte `AlertDialog` wrappers. `AlertDialogAction`/`AlertDialogCancel` are `CloseButton`s styled with `buttonVariants` (`cancel` = `outline`). |
| `popover.tsx` | Kobalte `Popover` (`gutter 4`), `PopoverTrigger`, `PopoverContent` (w-72), `PopoverPortal`. |
| `checkbox.tsx` | Kobalte `Checkbox` wrappers: `CheckboxInput` (peer), `CheckboxControl` with inline check SVG, `CheckboxLabel`, `CheckboxDescription`. |
| `separator.tsx` | Kobalte `Separator`; 1px `bg-border`, horizontal or vertical. |
| `badge.tsx` | `Badge` + `badgeVariants`: `base`, `default`, `secondary`, `destructive`, `success`, `outline`. |
| `kbd.tsx` | `Kbd`, `KbdGroup`: keyboard-key chips; restyled inside `[data-slot=tooltip-content]`. |
| `breadcrumbs.tsx` | Kobalte `Breadcrumbs` wrappers with chevron separator SVG; `BreadcrumbList`, `BreadcrumbsItem`, `BreadcrumbsLink`, `BreadcrumbsSeparator`, `BreadcrumbsEllipsis`. |
| `sonner.tsx` | `Toaster`: `somoto` toaster, `position top-center`, theme from Kobalte `useColorMode()`, unstyled with Tailwind classNames and `Icon`s per toast type. |
| `windows-title-bar.tsx` | `WindowsTitleBar({ leftWidth, controlsWidth, left, children })`: fixed draggable title row (`-webkit-app-region: drag`) rendered only when `isWindowsDesktop()`; height from `--titlebar-height`. |
| `adopt-node.tsx` | `AdoptNode({ node: Node })`: inserts an existing DOM node into a `<div>` on mount via `solid-js/web` `insert`. No importers found in `apps/web/src`. |
| `alert.tsx`, `card.tsx`, `combobox.tsx`, `command.tsx`, `hover-card.tsx`, `menubar.tsx`, `progress.tsx`, `radio-group.tsx`, `segmented-control.tsx`, `slider.tsx`, `tabs.tsx`, `toggle-button.tsx`, `toggle-group.tsx` | shadcn-solid copies over Kobalte (`command.tsx` over `cmdk-solid`). `toggle-group.tsx` reuses `toggleButtonVariants` via context. No importers found in `apps/web/src` (grep for `ui/<name>`). |
| `centered-select-menu.tsx` | `CenteredSelectMenu({ value, onChange, options, maxVisibleItems=7 })`: `Popover` + Kobalte `Listbox` rotated so the selected option sits under the trigger (negative `gutter` = `-(28+8+centerIndex*28)`). No importers found in `apps/web/src`. |

## How it works

- Every file is a thin styled layer: it takes a Kobalte primitive (or plain element), adds `data-slot="<name>"`, merges Tailwind classes with `cx`/`cva` from `apps/web/src/lib/cva.ts` (cva + `twMerge`), and spreads the rest of props. `tw` from `apps/web/src/lib/tw.ts` is a no-op tag for IntelliSense.
- Files marked `// Copied from https://shadcn-solid.netlify.app/...` are shadcn-solid ports with local restyling (h-7 rows, `text-xs`, `rounded-md`, `z-[10000]` popups, custom shadow). Files without that marker are editor-specific.
- Popup layers (`dropdown-menu`, `context-menu`, `select`, `tooltip`, `centered-select-menu`) use `z-[10000]` and Kobalte's `--kb-popper-content-transform-origin` for directional slide-in.
- Inspector row layout is composed from `PanelSection` > `ControlRow` / `ItemRow` > (`SliderInput` | `ControlledTextField` | `Select` | `SegmentedIconTabs` | `ColorOpacityRow` | `FillItem`) with a `Keyframe` in the trailing slot.
- Editor-bound components (`Keyframe`, `FillItem`, `ColorOpacityPicker` document colors) read ECS state with `@diffusionstudio/koota-solid` hooks (`useWorld`, `useTrait`, `useHas`, `useQuery`) and `useDerived`; they write through `useEditor().editProperty` and `apps/web/src/engine/keyframes.tsx` (`toggleKeyframe`, `syncKeyframe`). Pure inputs (`ColorOpacityRow`, `SliderInput`, `ControlledTextField`) only emit callbacks; the caller owns transactions via `onStartTransaction`/`onDragStart` and `onEndTransaction`/`onDragEnd`.
- Drag-vs-click on `SliderInput`, `FillItem`, `ColorOpacityRow`, `ControlledTextField`: pointer capture on `pointerdown`, a 3-4px threshold decides drag; a non-drag release focuses the input or re-dispatches a synthetic `click` to the inner button.
- Text inputs share one commit contract: Enter blurs and commits, Escape sets a cancel flag and reverts, blur commits unless cancelled.
- Colors flow as packed `number` (0xRRGGBB); conversions come from `apps/web/src/utils/color.ts` (`colorToHex`, `parseColor`, `rgbToHsv`, `hsvToRgb`, `rgbToHsl`, `hslToRgb`, `rgbToColor`, `colorToRgb`, `mergeColorWithOpacity`).
- `Icon` resolves SVGs at build time (Vite `import.meta.glob`, eager); `Select`, `DropdownMenu`, `Sonner`, `RemoveButton`, `SearchInput`, `IncrementDecrementControl`, `SegmentedIconTabs` all render through it.

## Interfaces

- Depends on:
  - `@kobalte/core/*` (headless primitives), `@kobalte/utils` (`mergeRefs`), `@kobalte/core` `useColorMode`; `cmdk-solid` (`command.tsx`); `somoto` (toasts); `cva`, `tailwind-merge`.
  - `apps/web/src/lib/cva.ts` (`cva`, `cx`), `apps/web/src/lib/tw.ts`, `apps/web/src/lib/call-handler.ts` (`callHandler`).
  - `apps/web/src/utils` (`clamp`, `assert`, color helpers, `pickScreenColor` in `utils/browser.ts`).
  - `apps/web/src/hooks/use-drag.ts` (`useDrag`, color picker sliders).
  - `apps/web/src/engine/hooks` (`useEditor`, `useDerived`), `apps/web/src/engine/keyframes.tsx`, `apps/web/src/engine/library.ts` (`useLibrary`).
  - `apps/web/src/components/sidebar-right/inspector/gradient-stops.ts` (`readGradientStops`, `sameGradientStops`, `GradientStop`) from `fill-item.tsx`.
  - `apps/web/src/projects/host.ts` (`isWindowsDesktop`).
  - `apps/web/src/assets/icons/*.svg` (icon set; pure asset folder).
  - Packages: `@diffusionstudio/koota-solid` (`useWorld`, `useTrait`, `useHas`, `useQuery`), `@diffusionstudio/runtime` (`Color`, `DEFAULT_BACKGROUND`, `Computed`, `Paint`, `PaintType`, `AssetId`, `Cache`, `Source`, `getAssetFile`, `colorToHex`, `parseColor`), `@diffusionstudio/assets` (`deriveThumbnail`, `derivePeaks`, `DEFAULT_THUMBNAIL_WIDTH`, `MASK_MIME_TYPE`, `assetName`, `AssetCache`), `@diffusionstudio/jsx` (`AnimatableProperty` type), `koota` (`Entity` type).
- Used by (119 files in `apps/web/src`; counts = importing files):
  - [`../sidebar-right/`](../sidebar-right/README.md) inspector panels (46 files): `control-group`, `panel-section`, `item-row`, `floating-inspector`, `keyframe`, `slider-input`, `color-opacity-picker`, `color-opacity-row`, `fill-item` (`inspector/fill-row.tsx`), `control-scrollarea` (`inspector/inspector.tsx`), `progress-slider` (`inspector/asset-info-preview.tsx`), `search-placeholder` (`inspector/styles-modal.tsx`), `segmented-icon-tabs`, `increment-decrement-control`.
  - [`../dashboard/`](../dashboard/README.md) (17): `alert-dialog`, `dialog`, `badge` (`invoices-view.tsx`), `kbd` (`home-view.tsx`), `switch`, `select`, `text-field`, `tooltip`, `separator`.
  - [`../sidebar-left/`](../sidebar-left/README.md) (13): `asset-thumbnail`, `context-menu`, `breadcrumbs` (`assets.tsx`), `windows-title-bar` (`sidebar-left.tsx`).
  - [`../canvas/`](../canvas/README.md) (5): `button`, `tooltip`, `dropdown-menu`, `popover`, `slider-input`, `segmented-icon-tabs`, `separator`.
  - [`../genai/`](../genai/README.md) (3): `asset-thumbnail`, `search-input`, `remove-button`, `popover`, `dropdown-menu`.
  - [`../timeline/`](../timeline/README.md) (4), `apps/web/src/agent-chat/*` (10 files: `button`, `icon`, `tooltip`, `dropdown-menu`, `remove-button`), `apps/web/src/components/app-context-menu.tsx`, `upgrade-dialog.tsx`, `dev-auth-code-input.tsx`, `apps/web/src/pages/*`.
  - `apps/web/src/app.tsx` mounts `Toaster` from `sonner.tsx`.
  - Import counts (files): `icon` 87, `button` 63, `tooltip` 44, `dropdown-menu` 29, `control-group` 26, `text-field` 24, `panel-section` 21, `select` 18, `context-menu` 16, `keyframe` 15, `floating-inspector` 13.

Up: [../README.md](../README.md)
