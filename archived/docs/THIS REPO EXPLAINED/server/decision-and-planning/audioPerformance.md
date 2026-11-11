# audioPerformance.ts

> Level 3 · Source: `server/src/audioPerformance.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Map each scene's `AudioMode` to safe TTS delivery settings (description, speed, temperature, trailing silence, pause policy).

**Role in parent:** Gives the planner a default `audio_mode` per scene and plan-level audio lint. Gives voiceover generation the per-scene `AudioPerformanceSettings` that Hume and ElevenLabs calls consume.

**Main exports:**
- `AudioPerformanceSettings` — `{ audio_mode, audio_note, emotion_context, description, speed, temperature, trailing_silence, pause }`. `pause` is `AudioPausePolicy` = `"none" | "short" | "long"`.
- `AUDIO_MODE_PRESETS` — fixed preset per `AudioMode` (`ugc_hook`, `ugc_casual`, `product_proof`, `testimonial`, `cinematic_narrator`, `tutorial_clear`, `calm_lifestyle`, `urgent_reaction`, `mostly_visual`). Speed range 0.9–1.15. Temperature range 0.65–0.86. All presets have `trailing_silence: 0`.
- `TOPIC_CHANGE_PAUSE_SECONDS` — `0.5`. Silence added between scenes with different topics.
- `defaultAudioModeForScene(scene, plan?, index)` — Returns `scene.audio_mode` if set. Else picks a mode from regex tests on narration/prompts, `on_camera`, and `plan.creative_vibe`. Fallback for off-camera scenes: `tutorial_walkthrough` → `tutorial_clear`, `cinematic_commercial` → `cinematic_narrator`, `cozy_lifestyle` → `calm_lifestyle`, else `product_proof`.
- `emotionContextForScene(scene, plan?, index)` — Returns one fixed emotion phrase (hook frustration, payoff, creator energy, product-proof curiosity, cozy warmth, polished story) or `null`.
- `audioPerformanceForScene(scene, plan?)` — Per-scene settings: preset + emotion + cleaned `audio_note`. Emotion adds small lifts to temperature (+0.03) and speed (+0.02 / −0.02). Clamps speed to 0.85–1.18 and temperature to 0.6–0.9. Allows `"long"` pause only when the note asks for a long/dramatic pause, the mode is `cinematic_narrator` or `calm_lifestyle`, and the plan is not UGC/product/demo.
- `stableAudioPerformanceForPlan(plan?)` — One voice for the whole plan. Picks mode from plan title/vibe/visual bible (default `ugc_casual`). Caps speed at 0.96 for `ugc_casual` and `testimonial`. Never returns `"long"` pause.
- `planAllowsVoiceVariation(plan?)` — `true` only when plan text asks for multiple voices, speakers, or dialogue (`VOICE_VARIATION_REQUEST`).
- `audioPerformanceForGeneration(scene, plan?)` — Main selector. No plan → `audioPerformanceForScene(scene)`. Variation requested → per-scene settings. Else → `stableAudioPerformanceForPlan(plan)`.
- `audioTopicForScene(scene, plan?, index)` — Labels a scene topic (`hook_problem`, `app_progress`, `feature_demo`, `product_proof`, `payoff_cta`, `tutorial_step_N`, `story_*`, `lifestyle_moment`, `creator_reaction`, `broll_context`).
- `topicChangePauseSeconds(previous, next, plan?, nextIndex)` — Returns `0.5` when topics differ, neither scene is `mostly_visual`, and both narrations have 5+ words. Else `0`.
- `audioPerformanceSequenceForPlan(scenes, plan?, { targetSpeechSeconds?, wordsPerSecond? })` — Settings for every scene in order, with topic-change pauses written into `trailing_silence`. With a target and pace, it estimates total speech time; if the estimate is 88%–100% of the target, it scales all speeds down to fill the target (floor 0.85).
- `sanitizeTextForAudioPerformance(text, settings)` — Collapses whitespace. `pause: "none"` strips all `[pause]` / `[long pause]` tokens. Otherwise keeps only the first token (as `[long pause]` only when `pause: "long"` and the text had one).
- `averagedHumeTemperature(settings[])` — Mean temperature, clamped 0.6–0.9; `null` for an empty list.
- `audioPerformanceIssues(plan)` — Plan lint strings: `audio_note` with visual/schema words, `mostly_visual` scenes over 20 words, `[long pause]` in UGC/product/demo plans.
- Minor helpers: `round2`, `compactNote` (strips pause tokens, drops the note if it matches `AUDIO_NOTE_LEAK`, truncates to 80 chars at a word boundary), `stableAudioModeForPlan`.

**Internal flow (voiceover path):**
1. Caller asks `audioPerformanceSequenceForPlan` or `audioPerformanceForGeneration` for settings.
2. `audioPerformanceForGeneration` chooses per-scene or one stable plan voice via `planAllowsVoiceVariation`.
3. Per-scene path: `defaultAudioModeForScene` → preset → `emotionContextForScene` + `compactNote` → clamped settings.
4. Sequence path adds `TOPIC_CHANGE_PAUSE_SECONDS` via `topicChangePauseSeconds`, then optionally rescales speed to hit the target speech time.
5. Media layer applies `sanitizeTextForAudioPerformance` to text and `averagedHumeTemperature` for Hume requests.

**Depends on:** `AudioMode`, `Scene`, `VideoPlan` types from `./schemas.js`. No env vars, no I/O.

**Used by:**
- `server/src/workflows.ts` — `defaultAudioModeForScene` (fills `audio_mode` in plans), `stableAudioPerformanceForPlan` (pace for `coverageWordsPerSecondForPlan`), `audioPerformanceSequenceForPlan` / `audioPerformanceForGeneration` (scene voice settings), `audioPerformanceIssues` (plan quality issues).
- `server/src/media.ts` — `audioPerformanceSequenceForPlan`, `audioPerformanceForGeneration`, `stableAudioPerformanceForPlan`, `sanitizeTextForAudioPerformance`, `averagedHumeTemperature` (Hume and ElevenLabs voiceover calls).
- Tests: `server/tests/audioPerformance.test.ts`, `server/tests/planQuality.test.ts`.

**Gotchas:**
- `audioPerformanceForScene` calls `defaultAudioModeForScene(scene, plan)` without an index, so the index-0 rule (`ugc_hook` for on-camera UGC/ad plans) applies to every scene that has no `audio_mode`.
- Without a voice-variation request, a plan gets one stable voice. Per-scene `audio_mode` and `audio_note` then do not change delivery.
- Preset `trailing_silence` is always 0. Only topic-change pauses add silence.
- The speed rescale only slows speech; it never speeds it up, and it does nothing when the estimate is under 88% of the target.
