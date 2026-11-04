# `packages/runtime/src/fonts`

Web font catalog and loader: registers a font in the world's `Fonts` trait and in the environment's `FontFaceSet` so text layout and rasterization use it.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Barrel. Re-exports `types`, `fixtures`, `utils`. |
| `types.ts` | `FontSource` (`family`, `source` as `url(...)`, optional `style: FontStyle`, optional `weight`). `FontSources` (`family` + `variants: FontSource[]`). |
| `fixtures.ts` | `WebFonts` const: 11 families (Inter, The Bold Font, Komika Axis, Geologica, Nunito, Figtree, Urbanist, Montserrat, Bangers, Chewy, Source Code Pro), each with `weights[]` and one `url` (fonts.gstatic.com woff2 or diffusion-studio-public S3 ttf). `FONT_WEIGHTS` const: weight number -> label (`'400'` -> `'Normal'`, `'700'` -> `'Bold'`, ...). |
| `utils.ts` | `getWebFonts()`: maps `WebFonts` to `FontSources[]`, one variant per weight. `loadWebFont(world, family, style?, weight?)`: builds a `FontSource`, pushes it to `world.get(Fonts).list`, creates a `FontFace` and adds it to `document.fonts` (page) or `self.fonts` (worker) via `getFontFaceSet()`. `STYLE_MAP`: `FontStyle` enum -> CSS style string. |

## How it works

- `loadWebFont` reads `WebFonts[family].url` and forms `source = url(<url>)`.
- It returns early with the `FontSource` when the world has no `Fonts` trait or `FontFace` is undefined (headless; text measurement then uses the system font).
- It returns early when `Fonts.list` already holds the same `source` + `weight`.
- It pushes the `FontSource` to `Fonts.list` before the load starts.
- No `weight` given: it loads a variable range `"<min> <max>"` from `WebFonts[family].weights` (single weight when only one exists).
- `new FontFace(family, source, { weight, style })` -> `load()` -> `getFontFaceSet().add(loaded)`.
- Load failure: it filters the entry back out of `Fonts.list` with `world.set(Fonts, ...)` and rejects.
- `getWebFonts()` is the read-only catalog view for UI pickers.
- Local-font enumeration (`window.queryLocalFonts`) and font persistence are app-side, not here (see `apps/web/src/engine/fonts.ts`).

## Interfaces

- Depends on:
  - `../constants` -> `FontStyle` enum (`NORMAL`, `ITALIC`, `OBLIQUE`).
  - `../traits` -> `Fonts` world trait (`{ list: FontSource[] }`, defined in `packages/runtime/src/traits/world.ts`). See [../traits/README.md](../traits/README.md).
  - `koota` -> `World` type.
  - Browser `FontFace` / `FontFaceSet` globals (optional at runtime).
- Used by:
  - `packages/runtime/src/traits/world.ts` -> imports `FontSource` type for the `Fonts` trait.
  - `packages/runtime/src/media/caption/{classic,cascade,guinea,paper,spotlight,stark,whisper}.ts` -> call `loadWebFont` for caption presets. See [../media/README.md](../media/README.md).
  - `apps/web/src/components/sidebar-right/inspector/text.tsx` -> `WebFonts`, `getWebFonts`, `loadWebFont`, `FONT_WEIGHTS` for the font picker.
  - `apps/web/src/components/sidebar-right/inspector/variables.tsx` -> `WebFonts`, `loadWebFont`.
  - `apps/web/src/engine/fonts.ts` -> `FontSources` type, `FontStyle`; adds `getLocalFonts()` on top.
  - Re-exported from `packages/runtime/src/index.ts` (`@diffusionstudio/runtime`).

Up: [../README.md](../README.md)
