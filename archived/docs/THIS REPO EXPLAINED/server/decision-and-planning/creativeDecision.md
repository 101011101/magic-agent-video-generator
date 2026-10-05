# creativeDecision.ts

> Level 3 · Source: `server/src/creativeDecision.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Infer a deterministic `CreativeIntent` from the user prompt with regex rules. Turn it into a prompt brief. Check a drafted `VideoPlan` against it.

**Role in parent:** Gives the planner the creative frame (format, platform, goal, speech mode, vibe, required beats, pacing) before the LLM drafts the plan. Gives the plan validator the intent-specific issue list after the draft.

**Main exports:**
- Types: `CreativeFormat` (`general`, `ugc`, `product_demo`, `problem_solution`, `testimonial`, `founder_story`, `comparison`, `cinematic_ad`, `music_video`, `tutorial`, `youtube_clips`), `CreativePlatform` (`tiktok`, `reels`, `shorts`, `web`, `general`), `CreativeGoal` (`awareness`, `conversion`, `education`, `product_proof`, `story`, `edit`), `CreativeSpeechMode` (`quoted_user_speech`, `inferred_creator_dialogue`, `voiceover`, `mostly_visual`), `RequiredBeat` (`hook`, `creator_reaction`, `product_proof`, `broll_demo`, `payoff_cta`), `VideoVibeRule`, `CreativeIntent`.
- `inferCreativeIntent(request, ctx)` — Returns `CreativeIntent` from `request.prompt`, `request.workflow`, `request.duration_seconds`, `request.scene_count`, and `ctx.video_model` / `ctx.image_model`.
- `creativeIntentBrief(intent)` — Returns a multi-line "Creative intent profile" text block for the LLM: speech style, voice emotion target, vibe cue, per-format grammar, required beats, pacing target, supported I2V durations from `MAGIC_VIDEO_MODEL_DURATIONS`, and fixed plan rules (b-roll speech, product proof, scene progression, ending speech, voice identity, 40s+/45s+ UGC runtime, provider cost).
- `validatePlanForCreativeIntent(plan, intent, request)` — Returns a `string[]` of plan issues. Empty array means the plan fits the intent.
- `explicitQuotedSpeechLines(prompt)` — Returns quoted lines that follow `say`, `narration says`, `dialogue is`, `spoken line is`, and similar.
- `VIDEO_VIBE_RULES` — `Record<VideoVibe, VideoVibeRule>`: `label`, `cue` text, `prompt_markers` regex, `avoid` regex for each of 9 vibes (`raw_ugc`, `polished_ugc`, `high_energy_social`, `practical_product_demo`, `cozy_lifestyle`, `cinematic_commercial`, `founder_explainer`, `tutorial_walkthrough`, `editorial_documentary`).
- `META_NARRATION_DIRECTION` — Regex for planner meta-language in narration (for example "this scene shows", "should feel like").

**Internal flow (`inferCreativeIntent`):**
1. Lowercase the prompt.
2. Format: first match wins. `workflow === "youtube_clips"` → music video → founder → testimonial → comparison (not "instead of repeating/using/…") → creator style → tutorial → problem/solution + product → cinematic + product → product → `general`.
3. Platform: keyword match for `tiktok`, `reels`/`instagram`, `shorts`/`youtube`, `website`/`landing page`/`web`.
4. Goal: edit request → `edit`; music video → `story`; CTA or `ad`/`commercial` → `conversion`; tutorial → `education`; product → `product_proof`; cinematic → `story`; else `awareness`.
5. Speech mode: music video without narration words → `mostly_visual`; quoted text → `quoted_user_speech`; "no narration"/"music only" → `mostly_visual`; creator-driven → `inferred_creator_dialogue`; spoken-track words → `voiceover`; visual-direction words → `mostly_visual`; product/demo/tutorial formats → `voiceover`.
6. Required beats: `hook` (creator-driven or short-form platform, not music video), `creator_reaction` (creator-driven), `product_proof` + `payoff_cta` (product, not music video), `broll_demo` (problem/solution, demo, comparison, tutorial).
7. Pacing: duration defaults to 30s. Scene count = `request.scene_count`, else `ceil(duration/7)` for music video, `ceil(duration/9)` for creator/product ≥30s, `ceil(duration/12)` other ≥30s, 3 for ≥20s, else 2. Clamp to 1–10. Set min/ideal scene seconds by duration thresholds (24s, 30s).
8. Vibe (`inferVideoVibe`): "high energy"/"viral" words → `high_energy_social`; "cozy"/"calm" words → `cozy_lifestyle`; else map from format/platform/goal.

**Internal flow (`validatePlanForCreativeIntent`):**
1. Quoted user speech must appear exactly in scene narration (normalized).
2. Ending claim ("end … narration says X") must appear in the last scene narration.
3. `plan.creative_vibe` must be in the allowed list for the format. Visual prompts must match the vibe `prompt_markers` and not its `avoid` regex.
4. Per scene: no camera/schema words or meta-language in narration. UGC/testimonial/founder narration must be first-person, not polished ad copy, no bracketed cues. B-roll durations must be supported by the video model. No risky video prompts (cuts, captions, "suddenly"). No split-screen/collage or multi-product image prompts.
5. Beat checks: visible-speaker request needs an `on_camera` scene. Creator presence needs a creator/reaction visual. `product_proof` needs a proof visual and not all talking scenes. `payoff_cta` needs payoff or CTA words in the last 2 scenes.
6. Runtime checks: ≥30s UGC caps `on_camera` scenes (3, or 2 at ≥45s). ≥30s average scene length must reach `min_scene_seconds`. ≥45s UGC needs ≥1.25 spoken words per second.
7. Schema-term leak check. Repeated spoken sentences (6+ words) across scenes. Adjacent scenes that repeat one proof beat (reminder, app/progress, setting, charging) for product intents.

**Depends on:** `./context.js` (`ProjectContext`), `./schemas.js` (`MAGIC_VIDEO_MODEL_DURATIONS`, `CreateProjectRequest`, `VideoVibe`, `VideoPlan`). No providers, no env vars, no I/O.

**Used by:**
- [`prompts.ts`](prompts.md) — `speechBudgetForRequest` (delivery speed from goal/format/vibe) and `buildGenerationBrief` (adds `creativeIntentBrief`).
- `server/src/workflows.ts` — `draftVideoPlanImpl` (runs `validatePlanForCreativeIntent`), `draftFallbackVideoPlanImpl` (allows fallback only for `ugc`, `product_demo`, `problem_solution`, `testimonial`, `founder_story`), `validateProductionVideoPlan` (`META_NARRATION_DIRECTION`), `providerImagePrompt` (`VIDEO_VIBE_RULES` cue), `preserveExplicitOpeningSpeech` (`explicitQuotedSpeechLines`).

**Gotchas:**
- All inference is keyword regex. Order matters: for example "founder" wins over "tutorial", and one `tiktok` word sets the platform.
- `inferCreativeIntent` runs again at each call site. It is not stored, so all callers get the same result only if the request is unchanged.
- `QUOTED_SPEECH` also matches single quotes, so apostrophe pairs in a prompt can set `quoted_user_speech`.
- `workflows.ts` `isBlockingPlanIssue` treats the vibe "does not fit" / "is not reflected" issues and the "first-person and creator-native" issue as warnings. All other issues from this file block the plan.
