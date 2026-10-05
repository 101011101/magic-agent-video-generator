# sceneContinuity.ts

> Level 3 · Source: `server/src/sceneContinuity.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Deterministic continuity rules for a `VideoPlan`: validate the per-scene continuity ledger and compile physics/staging text for image and video provider prompts.

**Role in parent:** Gives the planning stage the `physical_continuity` checks (chronology, inherited physical state, visible subjects, screen direction, causal action). Gives the render stage keyframe-chaining decisions and "scene physics packet" text. No LLM calls; only regex and token-overlap heuristics.

**Main exports:**
- `validateSceneContinuity(plan, { requireLedger? })` — returns issue strings. Skips all checks when no scene has ledger data and `requireLedger !== true`.
  - Per scene: rejects title/text/blank-screen frames (`TEXT_ONLY_FRAME`) and readable generated text (`GENERATED_READABLE_TEXT`) in `image_prompt`.
  - Per scene, multi-scene with `requireLedger: true`: requires `story_beat`, `opening_state`, `closing_state`, `setting`.
  - Per scene: rejects unshown state changes ("off-screen", "between scenes", "has already left").
  - Per scene: each `required_subjects` item must be grounded in `image_prompt` / opening / closing / setting (`subjectVisible`; proper names resolve through `visual_bible`).
  - Per scene, `creative_vibe` `cinematic_commercial` or `editorial_documentary` only: narration must name the animate subjects of a causal story beat.
  - Per scene: narrated falling, catch/contact, arrival, departure, or handoff must also appear in the visual action text.
  - Falling scenes with an animate subject: require vertical origin + destination geometry, duration ≥ 8s when the fall completes contact, no camera reframe/cut in the motion, and an explicit catch or landing.
  - Per scene: an animate subject absent in `opening_state` but present in `closing_state` needs an entrance verb.
  - Scene pairs: story beat similarity ≥ 0.85 (Jaccard) → "repeats"; shared subject + no time/place bridge + closing→opening overlap < 0.12 → state not inherited; `screen_direction` reversal of a shared subject without a turnaround verb.
- `shouldChainPreviousKeyframe(plan, sceneIndex)` — `true` when the scene has no explicit time/place bridge ("later", "next morning", "meanwhile", "elsewhere"), shares a tracked subject with the previous scene, and the settings overlap ≥ 0.3 or say "same".
- `identityReferenceSceneIndex(plan, sceneIndex)` — index of the first earlier scene that shares a tracked subject, else `null`.
- `scenePhysicsContext(plan, scene, { openingKeyframeOnly?, providerSafeMinor?, globalWorldAnchors? })` — joins: world anchors (default `visual_bible`), previous exit (only when chained), current entry, setting, required subjects, story beat, closing state, next-scene handoff target (only when the next scene chains), screen direction. `openingKeyframeOnly` drops beat, closing state, and handoff.
- `effectiveSceneOpeningState(scene, { providerSafeMinor? })` — returns `opening_state`, or for a falling story beat a rewritten pre-contact vertical-axis state. `providerSafeMinor` replaces the child with a "securely wrapped infant-sized rescue bundle".
- `causalMotionInstruction(scene)` — returns `video_prompt`; for a falling scene removes camera-reframe clauses and appends a catch completion sentence when no contact verb exists.
- `causalGeometryGuidance(scene)` — gravity-geometry text for falling scenes, else `""`.
- `causalOpeningKeyframeGuidance(scene, { providerSafeMinor? })` — one-instant pre-contact keyframe text for falling scenes, else `""`.
- `realWorldStagingGuidance(scene)` — base "real-world blocking" text plus one action-specific rule, first match wins: fall → handoff → pour → pickup → place → open/close → arrival/departure → posture → consume → operate.
- Internal helpers: `normalizedTokens` (lowercase, strip plural `s`, alias `automobile`/`sedan`/`vehicle` → `car`, drop stop words and 3–4 digit years), `overlapRatio` (common / smaller set), `similarityRatio` (Jaccard), `sharedTrackedSubject` (any subject pair overlap ≥ 0.5), `hasActiveFallingAction` (ignores "survived the fall"-type outcome references), `fallContactTarget` (shoulders / arms / hands).

**Internal flow (keyframe chaining in the render stage):**
1. `shouldChainPreviousKeyframe` is true → use the previous scene's image as reference.
2. Else `identityReferenceSceneIndex` → use the first earlier scene with a shared subject for identity.
3. Else → no reference image.

**Depends on:** `Scene`, `VideoPlan` types from `server/src/schemas.ts` (`scene.continuity`: `story_beat`, `required_subjects`, `opening_state`, `closing_state`, `setting`, `screen_direction`). No env vars. No providers.

**Used by:**
- `server/src/workflows.ts` `draftVideoPlanImpl` — `validateSceneContinuity(plan, { requireLedger: true })` in the plan quality issues.
- `server/src/workflows.ts` `providerImagePrompt` — `causalOpeningKeyframeGuidance`, `causalGeometryGuidance`, `scenePhysicsContext`, `realWorldStagingGuidance`.
- `server/src/workflows.ts` `providerVideoPrompt` — `scenePhysicsContext`, `causalGeometryGuidance`, `realWorldStagingGuidance`, `causalMotionInstruction`.
- `server/src/workflows.ts` `generateSceneImagesImpl` — `shouldChainPreviousKeyframe`, `identityReferenceSceneIndex`.
- `server/tests/sceneContinuity.test.ts`.

**Gotchas:**
- All checks are English regex/token heuristics; paraphrases can pass or fail unexpectedly.
- `effectiveSceneOpeningState` is not imported by `workflows.ts`; it reaches prompts only through `scenePhysicsContext` and `causalOpeningKeyframeGuidance`.
- Falling logic has special cases for minors: `providerSafeMinor` is set by `providerImagePrompt` when a child subject has a falling opening keyframe.
- Explicit time/place bridge words turn off both keyframe chaining and the state-inheritance check.
