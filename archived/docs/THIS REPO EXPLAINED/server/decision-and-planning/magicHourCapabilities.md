# magicHourCapabilities.ts

> Level 3 · Source: `server/src/magicHourCapabilities.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Route a create-project request to one Magic Hour capability, or return clarification questions when the prompt lacks the minimum inputs for paid work.

**Role in parent:** First deterministic gate of the planning layer. It decides the output kind (`image` / `video` / `edit` / `clarification`) and the capability id before any provider call spends credits.

**Main exports:**
- `MAGIC_HOUR_CAPABILITIES: MagicHourCapability[]` — static catalog. Each entry has `id`, `sdk_resource`, `output`, `status` (`"implemented" | "planned"`), `needs`, `use_when`.
  - Implemented: `standalone_image`, `multi_scene_video`, `youtube_clips`, `image_to_video`, `talking_photo`.
  - Planned (recognized, not wired): `image_edit_or_reference_composition`, `text_to_video`, `lip_sync`, `video_to_video`, `auto_subtitles`, `audio_to_video`, `animation`, `face_body_tools`, `image_utility_tools`, `social_asset_tools`, `voice_tools`.
- Types `MagicHourCapability`, `MagicHourCapabilityStatus`, `MagicHourOutputKind`.
- `capabilityById(id)` — catalog lookup; `null` for unknown or `null` id.
- `unsupportedPlannedCapability(id)` — returns the capability only when its `status` is `"planned"`; else `null`.
- `classifyMagicHourRequest({ prompt, workflow, duration_seconds? })` — returns `{ intent, capability_id, needs_clarification, questions }`. Main router.
- `magicHourCapabilityBrief(request)` — multi-line text block for the planner prompt: inferred intent, clarification state, implemented vs planned tools with SDK resources, and the rule "do not spend credits until required inputs exist".

**Internal flow (`classifyMagicHourRequest`):**
1. Trim the prompt. Remove negated edit features with `stripNegatedEditFeatures`. Run `analyzeClarificationSlots` on the result.
2. Source-clip branch: if `workflow === "youtube_clips"` or prompt matches `SOURCE_CLIP`, ask for missing duration and topic (`hasUsefulSourceClipTopic`) plus slot questions; else return `youtube_clips` / `video`.
3. Multi-output branch: if `MULTI_OUTPUT_REQUEST` matches (for example poster + video), ask for missing subject or video duration.
4. Specific capability: `specificCapabilityId` tests ordered regex rules (captions → `text_to_video` → `lip_sync` → `audio_to_video` → face/body → `talking_photo` → image utility → social assets → voice → `video_to_video` → composition → `animation` / `image_to_video`). A match runs `capabilityClarificationQuestions` (per-capability checks: source file/URL, exact quoted speech, duration, motion, style, QR URL). No questions → return the capability with `intentForCapability` (edit-type ids map to `"edit"`).
5. Generic fallback: compute `asksImage`, `asksVideo`, `asksEdit` from regex sets (`IMAGE_ONLY`, `VIDEO`, `IMPLIED_HUMAN_VIDEO`, `EXPLICIT_*_OUTPUT_REQUEST`, `EDIT_MEDIA`). Add questions for vague prompts, missing subject, missing video duration, "my app", "replace voiceover", and slot-analysis questions.
6. Any question → `intent: "clarification"`, `capability_id: null`. Else return `auto_subtitles`, `image_edit_or_reference_composition`, `standalone_image`, or default `multi_scene_video`.
- `compactClarificationQuestions` deduplicates, drops the generic "generation show" question when a more specific context question exists, and caps the list at 3.

**Depends on:** `./schemas.js` (`CreateProjectRequest` type), `./clarificationSlots.js` (`analyzeClarificationSlots`, `stripNegatedEditFeatures`). No env vars. No I/O.

**Used by:**
- `server/src/index.ts` `POST /api/projects` — skips `assertRuntimeReady` when the request needs clarification or routes to a planned capability.
- `server/src/runners.ts` `runProject` — writes a `needs_input` clarification manifest for missing inputs or for a planned capability ("backend wrapper is not implemented yet").
- `server/src/agents.ts` `firstRenderToolsForRequest` — gives the image-only tool set for `standalone_image`, else the video tool set.
- `server/src/workflows.ts` — `generate_magic_hour_images` throws unless the request routes to `standalone_image`.
- `server/src/prompts.ts` — adds `magicHourCapabilityBrief` to the planner prompt.
- Tests: `server/tests/magicHourCapabilities.test.ts`, `server/tests/magicHourCapabilities.matrix.test.ts`.

**Gotchas:**
- Routing is pure regex. Rule order in `specificCapabilityId` decides ties; a new rule can change routing for existing prompts. The matrix test guards this.
- "Source" is detected from prompt text only (URL, file extension, or phrases like "uploaded file"). Attached media fields on the request are not checked here.
- A planned capability with complete inputs still returns `needs_clarification: false`; callers must check `unsupportedPlannedCapability` separately.
- The classifier runs several times per project (API, runner, agent tool set, image tool, prompt). It must stay deterministic so all callers agree.
