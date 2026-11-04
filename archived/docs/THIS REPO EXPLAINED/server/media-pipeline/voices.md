# voices.ts

> Level 3 · Source: `server/src/voices.ts` · Up: [Media Pipeline](README.md)

**Purpose:** Voice catalog and voice-selection rules for each audio provider (Fish Audio, ElevenLabs, Hume).

**Role in parent:** Gives the media pipeline one stable, gender-matched narrator voice per plan before any TTS call.

**Main exports:**
- `FISH_AUDIO_VOICES` — catalog of 5 Fish Audio voices keyed by name: `sarah`, `jasphina` (female), `ethan`, `energetic_male` (male), `alle` (neutral). Each has `key`, `reference_id`, `gender`, `style`.
- `VOICE_KEYS` — catalog keys as a tuple for `z.enum`.
- `FEMALE_DEFAULT_VOICE` = `"sarah"`, `MALE_DEFAULT_VOICE` = `"ethan"`.
- `DEFAULT_HUME_UGC_VOICE_DESCRIPTION` — default Hume prompt: young North American UGC creator voice.
- `inferCharacterGender(plan)` — counts female and male word cues in `visual_bible`, scene `narration`, and scene `image_prompt`. Returns `"female"`, `"male"`, or `"unknown"` (tie).
- `resolveVoiceReferenceId(plan, ctx)` — returns the Fish Audio `reference_id` to use.
- `resolvePlanVoiceKey(plan)` — returns the catalog key for the plan, or `null`.
- `normalizePlanVoice(plan)` — writes the resolved key into `plan.voice`; returns the plan unchanged when the key is `null`.
- `elevenLabsVoiceNameForPlan(plan)` — maps the resolved key to an ElevenLabs voice name (`Rachel`, `Brian`, `Adam`). Fallback key is `alle` → `Rachel`.
- `humeVoiceDescriptionForPlan(plan, baseDescription)` — appends a gender rule (American accent, matches on-screen creator) and the catalog `style` to the base Hume description.
- `shouldLockSingleSpeakerVoice(plan)` — `true` when text matches single-speaker UGC cues (`ugc`, `tiktok`, `testimonial`, `founder`, ...) and no multi-speaker cues (`interview`, `two people`, ...).
- `voiceContinuityIssues(plan)` — for single-speaker UGC plans, returns quality issues: no resolved voice key, or selected voice gender contradicts inferred gender.

**Internal flow (`resolvePlanVoiceKey`):**
1. Look up `plan.voice` in `FISH_AUDIO_VOICES`. Unknown keys count as no candidate.
2. If a male or female candidate contradicts the inferred gender, return `jasphina` (female) or `energetic_male` (male).
3. Else, if a candidate exists, return its key.
4. Return `null` when the plan has no spoken narration or has multi-speaker cues.
5. Check `title`, `creative_vibe`, `visual_bible` for high-energy cues (`tiktok`, `comedy`, `commercial`, ...).
6. Female → `jasphina` (high energy) or `sarah`. Male → `energetic_male` or `ethan`. Unknown → `alle`.

**Internal flow (`resolveVoiceReferenceId`):**
1. Gender-mismatched candidate → `sarah` or `ethan` reference id (not the high-energy pair).
2. Valid candidate → its `reference_id`.
3. No candidate → `sarah` / `ethan` by inferred gender.
4. Unknown gender → `ctx.fish_audio_reference_id`, else `alle`.

**Depends on:** nothing internal. Input types are structural (`VoiceResolvablePlan`, `VoiceResolvableCtx`) so the module does not import the schema.

**Used by:**
- `server/src/workflows.ts` — `normalizePlan` calls `normalizePlanVoice`; `draftVideoPlanImpl` calls `voiceContinuityIssues`; `voiceContextForPlan` calls `humeVoiceDescriptionForPlan` (provider `hume`) and `elevenLabsVoiceNameForPlan` (provider `elevenlabs` with no `elevenlabs_voice_id`); voiceover, scene-animation, stitch, and `replaceVoiceoverImpl` paths call `resolveVoiceReferenceId`.
- `server/src/schemas.ts`, `server/src/agents.ts` — `VOICE_KEYS` for the `voice` field (`z.enum(VOICE_KEYS).nullable().default(null)`).
- `server/src/media.ts` — `DEFAULT_HUME_UGC_VOICE_DESCRIPTION` as fallback when `hume_voice_description` is empty.
- Tests: `server/tests/voices.test.ts`, `media.test.ts`, `workflows.lipsync.test.ts`, `workflows.retry.test.ts`.

**Gotchas:**
- Mismatch fallback differs by function: `resolvePlanVoiceKey` picks `jasphina`/`energetic_male`; `resolveVoiceReferenceId` picks `sarah`/`ethan`. After `normalizePlanVoice`, `plan.voice` already holds the corrected key, so the reference id usually follows that key.
- `neutral` candidates (`alle`) never trigger the mismatch guard.
- Gender cues are plain word regexes (`he`, `his`, `she`, ...). Mixed text ties to `"unknown"`.
- `resolveVoiceReferenceId` ignores the high-energy check and the multi-speaker check.
- In `humeVoiceDescriptionForPlan`, inferred gender wins over the candidate gender.
