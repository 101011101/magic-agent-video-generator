# `apps/web/src/components/genai`

Prompt box and selection action bar that turn a user prompt into declarative `generate.*` / `transform.*` sources and insert them on the canvas.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Re-exports `action-bar.tsx` and `prompt-input.tsx`. |
| `prompt-input.tsx` | `PromptInput` component: mode switch (IMAGE / VIDEO / VOICE / AUDIO), textarea with `/` recent-prompt menu, model / aspect / count / duration / audio / voice menus, image-reference and start/end-frame attach + drag-drop, submit. Exports `createDefaultConfig(mode, prompt)` and `PromptInputAttachButton`. Internal: `PromptInputCompactMenu`, `ModelMenu`, `VoiceMenu`, `PromptInputReferenceImageButton`. |
| `prompt-input-actions.tsx` | `PromptInputActions`: top-right row inside the prompt box. Rerun button, credits-used label, transform toggles (`upscale`, `removeBackground`, `addAudio`) via `TransformItem`. Shows only with an image or video selection. |
| `action-bar.tsx` | `ActionBar`: floating bar above the canvas toolbar when the prompt box is closed. Auto-Captions (scene selected), Remove background / Upscale / Edit with prompt (image), Add audio / Upscale (video), "More" menu with credits, Make video, Rerun, Reuse. Takes `openPromptInput(config)`. |
| `config.ts` | Static option tables: `PROMPT_INPUT_MODE_OPTIONS`, `PROMPT_INPUT_IMAGE_MODEL_OPTIONS`, `PROMPT_INPUT_VIDEO_MODEL_OPTIONS` (`VideoModelOption` with `features`, `durations`, `aspectRatios`), `PROMPT_INPUT_VOICE_OPTIONS` (ElevenLabs voice ids, thumbnails, preview URLs), `PROMPT_INPUT_AUDIO_MODEL_OPTIONS`, `PROMPT_INPUT_VOICE_MODEL = "elevenlabs-v3"`, `ASPECT_RATIO_DIMENSIONS` (ratio to 1080p px), aspect / duration / count / resolution lists. |
| `schemas.ts` | Zod schemas and types: `imageGenerationConfigSchema`, `videoGenerationConfigSchema`, `voiceGenerationConfigSchema`, `audioGenerationConfigSchema`, `generationConfigSchema` (discriminated on `mode`), `aspectRatioSchema`. Types `GenerationConfig`, `ImageGenerationConfig`, etc. Same shape as server-side adapter input. |
| `selection.ts` | `useMediaSelection()`: resolves each selected entity to its source element (`resolve` uses `getIntrinsicPaint`, else first IMAGE / VIDEO fill in `Cache.fills`). Returns `imageNodes`, `videoNodes`, `sources`, `bound` (nodes with a library `Asset` via `AssetId`), `images` (bound IMAGE assets). Types `SelectedNode`, `BoundNode`. |
| `insert.tsx` | `insertGenerated(world, editor, size, element, count, sources)`: finds empty canvas space with `findEmptyPlacement`, inserts `count` elements side by side (`GAP = 40`) under `Root` via `editor.insertElement`, selects them, names each after its resolved asset (`nameAfterGeneration` via `world.get(Ai).resolve(ref)`). Toasts when no project is open. `randomSeed()` gives each declaration a fresh key. Type `GenerationBox`. |
| `use-generate-image.tsx` | `useGenerateImage().generate(config)`: maps `imageRefIds` to library paths, builds one `generate.image(...)` per variant with its own seed, inserts `<Rect keepAspectRatio><ImagePaint src/></Rect>` at `ASPECT_RATIO_DIMENSIONS[aspectRatio]`. |
| `use-generate-video.tsx` | `useGenerateVideo().generate(config)`: maps start / end frame ids to library paths, builds `generate.video(...)` (prompt, model, aspectRatio, duration, audio, frames, seed), inserts `<Rect><VideoPaint src/></Rect>`. |
| `use-generate-voice.tsx` | `useGenerateVoice().generate(config)`: `generate.voice({ prompt, voice, seed })` inserted as `<Audio>` at `AUDIO_SIZE`. |
| `use-generate-audio.tsx` | `useGenerateAudio().generate(config)`: `generate.audio({ prompt, model, seed })` inserted as `<Audio>` at `AUDIO_SIZE`. |
| `use-auto-captions.tsx` | `useAutoCaptions()`: `hasScene`, `generate`. For each selected scene: insert `<Captions seed={Date.now()} />`; if a `Caption` entity exists with a `src` (subtitle file), remove it and insert fresh; else bump `seed` to re-transcribe. |
| `use-transforms.ts` | `useTransforms()`: `isOn(type)`, `toggle(type)`. Wraps the authored `src` in `transform[type](src)` or strips every layer of that type (`hasTransform`, `withoutTransform`, `mapAssetInputs`). Targets: `removeBackground` -> images, `addAudio` -> videos, `upscale` -> both. Writes via `editor.editProperty(entity, "src", ...)`. |
| `use-generation-records.ts` | `useGenerationRecords()`: `isGenerated`, `totalCredits`, `firstConfig`. Reads the `GenerateSpec` under the selection's authored `src` (`generationUnder` looks through transforms) and converts it to a `GenerationConfig` (`toPromptConfig`). Falls back to Supabase `usage_records` (`id, credits, config`) keyed by `asset.generation.id`; `toClientConfig(stored)` normalizes `images` / `startFrame` / `endFrame` fileRefs into `imageRefIds` / `startFrameImageId` / `endFrameImageId` and validates with `generationConfigSchema`. |

## How it works

- `canvas/toolbar.tsx` renders `PromptInput` when `promptInputOpen()`, else `ActionBar` (unless Object Mask or Clip Path tool is active).
- `PromptInput` holds one `GenerationConfig` signal. `createDefaultConfig(mode)` seeds it; `initialConfig` prop overrides (Reuse, Edit with prompt, Make video).
- Mode change resets config to defaults for that mode and keeps the prompt text. Video model change (`handleVideoModelChange`) clamps duration, aspect ratio, end frame and audio to the model's `features` / `durations` / `aspectRatios` from `config.ts`.
- Image references and video frames come from three sources: explicit picks (`pickFiles` + `importFiles` into the library), drag-drop (`ASSET_DRAG_TYPE` ids or image files), and the current canvas selection (`useMediaSelection().images`). `effectiveImageRefIds` (max 5) and `effectiveStartFrameId` / `effectiveEndFrameId` merge them. Removing a selection-sourced reference deselects the entity.
- Submit (`Enter` or button): trims prompt, pushes it to `prompt-input.recent-prompts` store (max 10), clears the textarea, dispatches to `useGenerateImage` / `Video` / `Voice` / `Audio` by `config.mode`. Errors toast "Generation failed".
- Each `useGenerate*` hook does not call a server. It builds an `AssetRef` with `generate.*` from `@diffusionstudio/jsx` and inserts an element whose `src` is that declaration. The asset system (`Ai` trait / `@/utils/gen-ai.ts`) notices the declaration, runs the generation and binds the result. `insertGenerated` names the element once the asset resolves.
- Transforms (`useTransforms`) follow the same pattern: toggling edits the element's `src` to `transform.upscale(src)` etc.; turning off returns the inner declaration without running anything.
- `useGenerationRecords` reads the config back from the declaration (no server call) so Rerun / Reuse work before the asset exists. Assets generated before JSX projects fall back to the Supabase `usage_records` row. Credits always come from `usage_records`.
- Rerun = `firstConfig()` -> matching `useGenerate*` with a new seed (new take). Reuse = `openPromptInput(firstConfig())`.
- `/` at the start of the textarea opens the recents menu (ArrowUp / ArrowDown / Enter / Escape). Settings row visibility persists in `prompt-input.settings-visible`.

## Interfaces

- Depends on:
  - `@diffusionstudio/jsx` (`generate`, `transform`, `AssetRef`, `getAssetSpec`, `isAssetRef`, `isTransformSpec`, `mapAssetInputs`, `GenerateSpec`, `TransformType`) — `packages/jsx/src/generate.ts`.
  - `@diffusionstudio/reconciler` (`Rect`, `ImagePaint`, `VideoPaint`, `Audio`, `Captions`, `authoredElement`) — `packages/reconciler`.
  - `@diffusionstudio/runtime` (`Root`, `Ai`, `Library`, `Name`, `Cache`, `Paint`, `PaintType`, `AssetId`, `Caption`, `getIntrinsicPaint`, `getEntityTree`, `isScene`, `getNextName`) — `packages/runtime`.
  - `@diffusionstudio/assets` (`Asset`, `AssetLibrary`, `AssetCache`, `assetName`) — `packages/assets`.
  - `@diffusionstudio/koota-solid` (`useWorld`), `koota` (`Entity`, `World`), `solid-js`, `zod`, `somoto` (toasts).
  - App: `@/engine/hooks` (`useEditor`, `useSelection`), `@/engine/library` (`useLibrary`), `@/engine/placement` (`findEmptyPlacement`), `@/engine/insert-asset` (`AUDIO_SIZE`), `@/engine/asset-actions` (`pickFiles`, `importFiles`, `droppedFiles`), `@/engine/editor` (`DocumentEditor`), `@/lib/supabase`, `@/lib/store` + `@/init` (`store.define`), `@/lib/cva`, `@/components/ui/*` (button, icon, separator, dropdown-menu, popover, tooltip, search-input, remove-button, asset-thumbnail), `@/components/sidebar-left/folder-item` (`ASSET_DRAG_TYPE`), `@/assets/images/voice-thumbnails/*.png`.
- Used by:
  - `apps/web/src/components/canvas/toolbar.tsx` — renders `PromptInput` and `ActionBar`. See [../canvas/README.md](../canvas/README.md).
  - `apps/web/src/context/prompt-input.tsx` — `GenerationConfig` type for `openPromptInput` context.
  - `apps/web/src/components/sidebar-left/assets.tsx`, `apps/web/src/components/sidebar-right/inspector/asset-picker.tsx` — `createDefaultConfig("IMAGE")` to open the prompt box. See [../sidebar-left/README.md](../sidebar-left/README.md), [../sidebar-right/README.md](../sidebar-right/README.md).
  - `apps/web/src/components/sidebar-right/inspector/asset-info.tsx` — `toClientConfig` to show a generated asset's settings.
  - `apps/web/src/utils/gen-ai.ts` — model / voice option tables from `config.ts` when running generations.
  - `apps/web/src/dapi/handlers/models.ts`, `apps/web/src/dapi/handlers/voices.ts` — expose `config.ts` option tables to the agent tool API.

Up: [../README.md](../README.md)
