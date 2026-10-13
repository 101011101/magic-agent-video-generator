# `docs/brand/assets`

The house-style brand kit: reusable JSX components, starter compositions, and empty asset folders that agents copy into a project when no other branding is specified.

## Parts

| Part | Role |
| --- | --- |
| `components/tokens.ts` | Shared design values. Exports `colors` (`background #000000`, `surface #161616`, `text #F8F8F8`, `textSecondary #A4A4A4`), `fonts` (`sans: "Geist"`, `mono: "Geist Mono"`), `typography` (title 96/600, subtitle 60/400, lowerThirdName 48/500, lowerThirdDetail 30/400, label 24/500), `spacing` (margin 64, mediaGap 40, mediaCornerRadius 24, and 16/24/40 stack gaps). Exports `layoutMetrics(width, height)` → `{ scale, margin, gap, cornerRadius }` with `scale = min(w,h)/1080`. Exports `frameMetrics(width, height)` → text-safe box `{ left, right, top, bottom }`; in 9:16 (`|w/h − 9/16| < 0.02`) it reserves the right 180 px and bottom 400 px and starts at `top = 200`. |
| `components/title-card.tsx` | `TitleCard(props: TitleCardProps)`. Props: `width`, `height`, `start`, `end`, `title`, optional `subtitle`. Renders one or two `<text>` nodes anchored low-left inside `frameMetrics`. No `<scene>`. |
| `components/lower-third.tsx` | `LowerThird(props: LowerThirdProps)`. Props: `width`, `height`, `start`, `end`, `name`, `detail`. Renders a full-width `<rect>` panel (`colors.surface`, height 172×scale) at the bottom of the safe frame plus two `<text>` nodes (name, detail). |
| `components/callout.tsx` | `Callout(props: CalloutProps)`. Props: `width`, `height`, `start`, `end`, `label`, `value`. Renders a left-aligned `<rect>` panel (max 560×scale wide, 152×scale tall) with a label `<text>` and a value `<text>`. |
| `components/media-grid.tsx` | `MediaGrid(props: MediaGridProps)` and `mediaGridSlots(width, height, count)`. Types: `MediaGridItem { name, src, sourceIn?, objectFit?, muted }`, `MediaGridProps { width, height, start, end, items, name? }`. `mediaGridSlots` accepts only 1, 2, or 4 items (throws otherwise): 1 → full frame with no radius; 2 → square panels, stacked in portrait, side by side otherwise; 4 → centered 2×2. `MediaGrid` wraps each item in a `<sequence>` holding one `<video>` with the slot geometry, `cornerRadius`, and `objectFit` default `"contain"`. |
| `compositions/product-demo.tsx` | Default export `ProductDemo()`. 1080×1920, 6 s. One `<sequence>` with a full-frame `<video>` (`objectFit="contain"`) from 0–6 s, then `LowerThird` from 3–6 s. Inputs: `inputs.videoSrc`, `inputs.name`, `inputs.detail`; `requireInput` throws if any is empty. |
| `compositions/product-tour.tsx` | Default export `ProductTour()`. 1920×1080 by default (comment permits 1080×1920 or 1080×1080). `PHASE = 3`, `DURATION = 12`. Four `MediaGrid` beats: 1-up (0–3 s), 2-up (3–6 s), 4-up (6–9 s), 1-up (9–12 s); the primary video's `sourceIn` advances by `PHASE` each beat so playback stays continuous, and only the primary is unmuted. `LowerThird` over the last beat. Inputs: `primaryVideoSrc`, `secondaryVideoSrc`, `detailVideoSrc`, `fourthVideoSrc`, `name`, `detail`. |
| `compositions/end-card.tsx` | Default export `EndCard()`. 1080×1920, 4 s. One `TitleCard` with `title` and `subtitle = cta`. Inputs: `inputs.title`, `inputs.cta`. |
| `fonts/`, `imagery/`, `audio/music/`, `audio/sfx/`, `audio/voiceovers/` | Asset folders. Each holds only a `.gitkeep` in the repo. `apps/desktop/scripts/stage-docs.mjs` drops `.gitkeep` when it stages docs into the app. |

## How it works

- `tokens.ts` encodes the numbers written in `docs/brand/design.md` (margin 64, gap 40, corner radius 24, 9:16 safe area `x 64–900`, `y 200–1520`). `frameMetrics` derives that safe area; `layoutMetrics` scales all values from a 1080 base.
- Every component calls `frameMetrics` or `layoutMetrics` with the scene size, then multiplies pixel constants by `frame.scale`. Components emit only `<text>`, `<rect>`, `<video>`, and `<sequence>` tags; they never emit a `<scene>`.
- Compositions own the `<scene>` (id, name, size, `fill={colors.background}`), the timing constants, and a top-level `inputs` object. `requireInput` throws with the message `Set inputs.<name> before mounting <file>.tsx.` when a field is empty.
- Agent flow (from `docs/brand/library.md`): pick the nearest composition, copy needed files into the project, fill `inputs`, save; the app recompiles and re-renders.

## Interfaces

- Depends on: `@diffusionstudio/jsx` for the `Time` and `Fit` types (`packages/jsx/src/types.ts`: `Time = number | \`${number}f\` | \`${string}:${string}\``, `Fit = "cover" | "contain" | "fill"`) and the intrinsic tags `<scene>`, `<sequence>`, `<video>`, `<text>`, `<rect>` (see [../../reference/jsx/README.md](../../reference/jsx/README.md)).
- Depends on: `docs/brand/design.md` for the values `tokens.ts` mirrors (`library.md` says to keep them in sync).
- Used by: `docs/brand/library.md` catalogs every file here with its inputs and format; `docs/brand/design.md` line 77 names `media-grid.tsx` as the tested grid geometry; `docs/skills/editor.md` points to the house style as the fallback branding.
- Used by: `apps/desktop/scripts/stage-docs.mjs` copies this tree into `apps/desktop/docs` so the shipped app exposes it; `apps/desktop/src/dapi/docs.ts` `instructions()` tells connecting agents the docs folder holds "the brand kit (fonts, imagery, components to copy)".
- Not imported by any app or package source. Unclear from source whether any test compiles these files.

Up: [../README.md](../README.md)
