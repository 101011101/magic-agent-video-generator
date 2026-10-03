# sceneAudio.ts

> Level 3 · Source: `server/src/sceneAudio.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Decide the audio source of each scene. Check that scene fields agree with that audio source.

**Role in parent:** Gives the planner one rule set for scene audio. The plan validator, voiceover step, video submit step, and stitch step all read the audio source from here.

**Main exports:**
- `sceneAudioSource(scene)` — Returns a `SceneAudioSource` (`"voiceover" | "speech_driven" | "native_scene_audio"`, from `SCENE_AUDIO_SOURCES` in `schemas.ts`). Order: explicit `scene.audio_source` → `on_camera === true` gives `speech_driven` → non-empty `narration` gives `voiceover` → else `native_scene_audio`.
- `sceneUsesExternalSpeech(scene)` — `true` for `voiceover` or `speech_driven` (TTS audio made outside the video model).
- `sceneUsesNativeAudio(scene)` — `true` for `native_scene_audio` (the video model makes the audio).
- `planNeedsPerSceneAudio(plan)` — `true` if any scene is not `voiceover`. Then the pipeline uses per-scene audio, not one global voiceover track.
- `nativeAudioVideoPrompt(scene)` — Returns `video_prompt` plus `" Audio: <native_audio_prompt>"`. Returns `video_prompt` alone when `native_audio_prompt` is empty.
- `validateSceneAudioContract(plan, videoModel, hasUploadedAudio = false)` — Returns a `string[]` of issues, one per broken rule per scene.

**Internal flow (`validateSceneAudioContract`, per scene):**
1. `speech_driven`: needs `on_camera === true`, needs `narration`, forbids `native_audio_prompt`.
2. `voiceover`: forbids `on_camera === true` (use `speech_driven` for visible speech), needs `narration`, forbids `native_audio_prompt`.
3. `native_scene_audio`: forbids `on_camera === true` (H3 does not accept external lip-sync audio), forbids `narration`, needs `native_audio_prompt`, needs `videoModel === "minimax-h3"`, forbids user-uploaded audio (`hasUploadedAudio`).

**Depends on:** `schemas.ts` types `Scene`, `SceneAudioSource`, `VideoPlan`. No I/O, no env vars.

**Used by:**
- `server/src/workflows.ts`:
  - `draftVideoPlanImpl` — adds `validateSceneAudioContract` issues to plan quality issues. Passes `ctx.video_model` and `true` when `request.input_media` has an `audio` item.
  - `generateVoiceoverImpl` — `planNeedsPerSceneAudio` picks per-scene TTS; `sceneUsesExternalSpeech` picks the scenes that get TTS; `sceneUsesNativeAudio` lists `native_audio_scene_ids`.
  - `animateSceneVideosImpl` — splits scenes into `speech_driven` (talking) and other (b-roll) with `sceneAudioSource`.
  - `buildPerSceneStitchInputs`, `stitchFinalVideoImpl`, `inspectRenderStatusImpl` — pick per-scene or global audio for stitching and status.
- `server/src/media.ts`:
  - `minimaxH3RequestBody`, `submitVideoAssetJob` — set `audio: true` and use `nativeAudioVideoPrompt` for native-audio scenes. `submitVideoAssetJob` does this only when `ctx.video_model === "minimax-h3"`.
  - `pollVideoAssetJob`, `recoverVideoAssetFromProviderJob` — write `audio_source` on the video asset record.
- `server/tests/sceneAudio.test.ts`.

**Gotchas:**
- An explicit `audio_source` always wins. `validateSceneAudioContract` catches conflicts, for example `audio_source: "voiceover"` with `on_camera: true`.
- A scene with no `narration`, no `on_camera`, and no `audio_source` falls to `native_scene_audio`. Then it fails validation on any model that is not `minimax-h3`.
- `planNeedsPerSceneAudio` is `true` for one `speech_driven` scene too, not only for native audio.
