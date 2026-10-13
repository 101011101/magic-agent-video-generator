# `docs/brand`

Fallback house style for agents: four reference pages (design, voice, video, library) plus bundled JSX components and compositions that apply them. Used only when the brief, project, or user supplies no style of their own.

## Parts

| Part | Role |
| --- | --- |
| `README.md` | Router. Table maps task → page: visual design → `design.md`; copy → `voice.md`; video → `design.md` + `video.md` + `library.md`; assets/components/compositions → `library.md` + medium page. Rules: check `library.md` before creating a reusable item, reuse the closest item, use relative paths to bundled assets, treat values as defaults and keep departures consistent. |
| `design.md` | Visual rules, all pixel values scaled from a 1080 short edge. Dark neutral palette (`#000000` background, `#161616` surface, `#F8F8F8` text, `#A4A4A4` secondary), no own accent (borrow one from the subject, one per piece). Type: `Geist` / `Geist Mono`, no italic; title 96/600 ≤32 chars, subtitle 60/400 ≤64, lower-third name 48/500 ≤28, detail 30/400 ≤40, label 24/500 ≤16. Layout: margin 64, gap 40, spacing in multiples of 8, radius 24 on framed media. Media forms: full frame, two-up, four-up. 9:16 text safe area `x 64–900`, `y 200–1520`. Captions: `stark` for 9:16, `cascade` otherwise, no `colors`, no band behind captions. |
| `voice.md` | Writing rules for titles, labels, scripts, captions, CTAs. Keep supplied names exact. Lead with result, short words, active voice, no hype words (`effortless`, `magical`, `revolutionary`, `all-in-one`). Rewrite copy over a limit; do not shrink type. Tone: clear, calm, sure; match the footage register. |
| `video.md` | Motion and sound rules at 30 fps. Layout changes follow the idea, prefer hard cuts. Timing: enter `"12f"` (400 ms), exit `"6f"` (200 ms), stagger `"3f"` (100 ms), max `"18f"`. Four easing anchors (Entrance, Settle, Travel, Exit) as `cubicBezier(...)` values. Cut methods table (hard cut on action, jump cut, continuous carry, hold cut); `dissolve` 300 ms for same subject only, `fadeToBlack` at end. Captions added last. Speech has audio priority; mute duplicate captures. |
| `library.md` | Catalog of bundled files. Components table (file, use, notes) and compositions table (file, use, format, required inputs). States the split: components do not own a `<scene>`; compositions own `<scene>`, timing, and editable inputs. Rules for selecting media and adding new items. |
| [assets/](assets/README.md) | Bundled source. `components/`: `tokens.ts` (colors, fonts, typography, spacing, `layoutMetrics()`, `frameMetrics()`), `title-card.tsx` (`TitleCard`), `lower-third.tsx` (`LowerThird`), `callout.tsx` (`Callout`), `media-grid.tsx` (`MediaGrid`, `mediaGridSlots()`). `compositions/`: `product-demo.tsx` (9:16, `videoSrc`/`name`/`detail`), `product-tour.tsx` (16:9 default, four sources + lower third), `end-card.tsx` (9:16, `title`/`cta`). Empty slots with `.gitkeep`: `audio/music`, `audio/sfx`, `audio/voiceovers`, `fonts/`, `imagery/`. No font files are bundled. |

## How it works

- `docs/skills/editor.md` sends an agent here only when no branding is specified. `README.md` then routes by task to the page(s) to read.
- `design.md` defines the values. `assets/components/tokens.ts` mirrors them as constants (`colors`, `fonts`, `typography`, `spacing`). `library.md` says to keep `tokens.ts` in sync with `design.md` and to override values in the project copy, not here.
- `tokens.ts` derives geometry: `layoutMetrics(width, height)` scales margin/gap/radius by `min(width, height) / 1080`; `frameMetrics()` detects 9:16 (ratio within 0.02) and applies the 180 right rail and 400 bottom reserve from `design.md`.
- Components are fragments of `<rect>` / `<text>` / `<video>` elements that take `width`, `height`, `start`, `end` plus content props. `MediaGrid` computes 1, 2, or 4 slots via `mediaGridSlots()` (two-up stacks in portrait, side by side otherwise; four-up is a centered 2×2) and wraps each `<video>` in a `<sequence>`.
- Compositions default-export a component that returns one `<scene id=...>` filled with `colors.background`. Each declares an `inputs` object and a `requireInput()` guard that throws if a field is empty. `product-tour.tsx` phases four `MediaGrid` blocks (full → two-up → four-up → full, `PHASE = 3` s each) with a `LowerThird` over the last phase.
- Agent flow: read `library.md` → copy only the needed component/composition files into the project → set `inputs` → adjust content, not the shared values → verify with `capture`.

## Interfaces

- Depends on: `@diffusionstudio/jsx` types (`Time`, `Fit`) in components (see [../../packages/jsx/README.md](../../packages/jsx/README.md)); JSX elements `<scene>`, `<sequence>`, `<video>`, `<rect>`, `<text>` documented in [../reference/jsx/README.md](../reference/jsx/README.md); caption presets `stark`, `cascade` from `reference/jsx/captions.md`.
- Used by: `docs/skills/editor.md` (links `../brand/README.md` as the fallback style). Staged into the app with the rest of `docs/` by `apps/desktop/scripts/stage-docs.mjs` (see [../README.md](../README.md)).
- Not imported by any package or app source. Unclear from source whether any test references these files.

Up: [../README.md](../README.md)
