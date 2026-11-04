# `apps/desktop/src/native`

macOS-only Node-API addon that gives the Electron `BrowserWindow` a custom corner radius and a custom blurred backdrop while keeping the standard window (traffic lights, OS shadow, vibrancy, live resize).

## Parts

| Part | Role |
| --- | --- |
| `corner_radius.m` | Objective-C addon source. Exports two functions to JS via `NAPI_MODULE(corner_radius, Init)`: `setCornerRadius(handle: Buffer, radius: number)` and `setBackdrop(handle: Buffer, blur, r, g, b, a: number)`. `handle` is the `BrowserWindow.getNativeWindowHandle()` Buffer (holds an `NSView*`). |
| `vendor/` | Vendored Node-API C headers, no own README: `node_api.h`, `node_api_types.h`, `js_native_api.h`, `js_native_api_types.h`. Compiled against `-DNAPI_VERSION=8`. Symbols resolve from the Electron binary at load time. |

## How it works

- Build: `apps/desktop/scripts/build-native.mjs` (`npm run build:native`) runs `clang` on `corner_radius.m` -> `apps/desktop/dist/corner_radius.node`. Flags: `-dynamiclib -undefined dynamic_lookup -fobjc-arc -framework AppKit -framework QuartzCore -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -DNAPI_VERSION=8`. Exits early on non-darwin.
- Load: `apps/desktop/src/main.ts` does `require(join(app.getAppPath(), "dist", "corner_radius.node"))` only when `process.platform === "darwin"`.
- `setCornerRadius(handle, radius)`:
  - Reads `NSView*` from the Buffer, gets `view.window`, then `object_getClass(window)` (the real dispatch class; may be a `NSKVONotifying_*` subclass).
  - Stores `radius` (NSNumber) and a rounded-rect `NSImage` mask (`RoundedMaskImage()`, cap-inset stretchable) as associated objects (`kRadiusKey`, `kMaskKey`) on the window. `radius == 0` stores nil -> OS default corner.
  - `RoundEffectViews()` walks `window.contentView` and sets `NSVisualEffectView.maskImage` (public API) so the vibrancy frost is rounded without breaking behind-window blending.
  - `SwizzleRadiusGetter()` replaces private getters `_cornerRadius`, `_effectiveCornerRadius`, `_topCornerRadius`, `_bottomCornerRadius` with `ds_radius()`, which returns the stored radius or defers to the captured original IMP (`g_orig*`). macOS 26 "Tahoe" reads these on every relayout, so the value persists.
  - Replaces `_cornerMask` with `ds_cornerMask()` for macOS < 26.
  - Pushes the value through `_setCornerRadius:` / `_setEffectiveCornerRadius:`, calls `_updateCornerMask`, then `invalidateShadow`.
- `setBackdrop(handle, blur, r, g, b, a)`:
  - `FindEffectView()` finds the first `NSVisualEffectView` under `contentView`; pins `state = NSVisualEffectStateActive` so AppKit does not rebuild the material on resign-key.
  - `FindBackdropLayer()` finds the `CABackdropLayer`; sets `backdrop.filters` to one private `CAFilter` of type `gaussianBlur` with `inputRadius = blur`, `inputNormalizeEdges = YES`.
  - Hides sibling tint/frost layers; inserts or reuses one `CALayer` named `ds-tint` above the backdrop with `backgroundColor` = sRGB `(r, g, b, a)`.
- Call sites in `main.ts`: `applyCornerRadius(MACOS_CORNER_RADIUS = 18)` and `applyBackdrop()` with `MACOS_BACKDROP = { blur: 80, red: 0.07, green: 0.07, blue: 0.07, alpha: 0.9 }` run after `new BrowserWindow`, on `ready-to-show`, and on `show`. `enter-full-screen` -> `applyCornerRadius(0)`; `leave-full-screen` -> `applyCornerRadius(18)`.
- Rationale (from source comments): Electron exposes only the fixed system radius; riding Apple's own corner + shadow path avoids the WindowServer GPU cost that made Electron drop its `_cornerMask` override (electron/electron#48376). Mechanism after github.com/makalin/CornerFix.

## Interfaces

- Depends on:
  - AppKit, QuartzCore, `objc/runtime.h`, `objc/message.h` (private AppKit selectors: `_cornerRadius`, `_effectiveCornerRadius`, `_topCornerRadius`, `_bottomCornerRadius`, `_cornerMask`, `_setCornerRadius:`, `_setEffectiveCornerRadius:`, `_updateCornerMask`; private `CAFilter`, `CABackdropLayer`).
  - `vendor/node_api.h` and included headers (Node-API 8).
  - `apps/desktop/scripts/build-native.mjs` (build); `clang` on the build host.
- Used by:
  - `apps/desktop/src/main.ts` lines 81-100 (`setNativeCornerRadius`, `setNativeBackdrop`, `applyCornerRadius`, `applyBackdrop`) and window lifecycle hooks at lines 257-281.
  - `apps/desktop/package.json` `build` script (`npm run build:native` runs last).
  - No other consumer in the repo. Not used on Windows or Linux.

Up: [../README.md](../README.md)
