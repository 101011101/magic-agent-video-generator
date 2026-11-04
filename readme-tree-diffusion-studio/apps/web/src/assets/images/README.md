# `apps/web/src/assets/images`

Bundled PNG images that UI code imports by URL: the desktop-app promo banner, AI voice picker avatars, and two unused placeholder frames.

## Parts

| Part | Role |
|---|---|
| `desktop-app-banner.png` | 440x330 promo image. Displayed in the canvas "Edit your videos with AI agents" banner (`apps/web/src/components/canvas/desktop-app-banner.tsx:14`, `BANNER_IMAGE`). |
| `voice-thumbnails/` | 18 avatars, `0.png` to `17.png`, 64x64 each. One per entry in `PROMPT_INPUT_VOICE_OPTIONS` (`apps/web/src/components/genai/config.ts`), field `thumbnail`. Voice IDs and `previewUrl` values point to ElevenLabs premade voices. The list has more voices than avatars; later entries reuse `0.png`, `1.png`, and so on. |
| `placeholder112x63.png` | 112x63 frame. No reference found in source. |
| `placeholder232x130.png` | 232x130 frame. No reference found in source. |

## How it works

- Every consumer resolves an image with `new URL("@/assets/images/<file>", import.meta.url).href`. Vite resolves the `@` alias (`apps/web/vite.config.ts`, `@` -> `./src`), copies the file into the build, and returns the hashed URL as a string. No SVG component plugin is involved (that path is for `../icons`).
- Desktop banner:
  - `DesktopAppBanner` (`canvas/desktop-app-banner.tsx`) renders `BANNER_IMAGE` in an `aspect-[220/122]` box at the bottom-left of the canvas.
  - Shown only when `!dismissed() && !isDesktop`. Dismissal persists via `store.define("canvas.desktop-app-banner-dismissed", false)` and `createStoredSignal`.
  - Mounted from `apps/web/src/components/canvas/canvas.tsx:12`.
- Voice thumbnails:
  - `config.ts` builds `PROMPT_INPUT_VOICE_OPTIONS`: `{ value, label, thumbnail, description, previewUrl }` per voice.
  - `apps/web/src/components/genai/prompt-input.tsx:708` passes the array as `options` to the voice selector, which shows `thumbnail` next to `label`.
  - `PROMPT_INPUT_VOICE_OPTIONS[0].value` is the default voice in `prompt-input.tsx`, `apps/web/src/utils/gen-ai.ts:255`, and `apps/web/src/components/genai/use-generation-records.ts:95`.
  - `apps/web/src/dapi/handlers/voices.ts:10` exposes `id`, `label`, `description` to the desktop agent API. It drops `thumbnail`.

## Interfaces

- Depends on:
  - Vite asset pipeline and `@` alias (`apps/web/vite.config.ts`).
- Used by:
  - `apps/web/src/components/canvas/desktop-app-banner.tsx` (banner image). See [../../components/canvas/README.md](../../components/canvas/README.md).
  - `apps/web/src/components/genai/config.ts` (voice avatars). See [../../components/genai/README.md](../../components/genai/README.md).
  - Indirect: `apps/web/src/components/genai/prompt-input.tsx`, `apps/web/src/utils/gen-ai.ts`, `apps/web/src/components/genai/use-generation-records.ts`, `apps/web/src/dapi/handlers/voices.ts`.
- Siblings: `../fonts`, `../icons` (SVG icon set loaded by `import.meta.glob` in `apps/web/src/components/ui/icon.tsx`). See [../README.md](../README.md).

Up: [../README.md](../README.md)
