# clarificationSlots.ts

> Level 3 · Source: `server/src/clarificationSlots.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Regex-based slot check on a create request. It finds missing details and returns clarifying questions.

**Role in parent:** Gives [magicHourCapabilities.md](magicHourCapabilities.md) a deterministic "what is missing" signal before routing a request to a capability.

**Main exports:**
- `analyzeClarificationSlots(request)` — takes `prompt`, `workflow`, optional `duration_seconds` (from `CreateProjectRequest` in `schemas.ts`). Returns `ClarificationSlotAnalysis`.
- `ClarificationSlotAnalysis` — `{ questions: string[] (max 3), missing_slots: string[], slots }`.
  - `slots.output_type`: `image | video | edit | unknown`
  - `slots.subject`: `present | missing`
  - `slots.duration`: `present | missing | not_applicable` (only videos need duration)
  - `slots.format`: `ugc | product | youtube | edit | general`
  - `slots.speech_mode`: `quoted | creator_dialogue | voiceover | mostly_visual | unknown`
- `stripNegatedEditFeatures(prompt)` — removes `lip sync`, `captions`, `subtitles` inside negated clauses (`no`, `without`, `avoid`, `don't`, etc., up to 160 chars to the next `.!?;` or newline). Stops "no captions" from being read as an edit request.

**Internal flow (`analyzeClarificationSlots`):**
1. Trim prompt. Run `stripNegatedEditFeatures`.
2. `outputTypeFor`: `workflow === "youtube_clips"` → `video`. `EDIT` match → `edit`. Image words without motion words → `image`. Then `VIDEO`/`YOUTUBE` → `video`, else `IMAGE` → `image`, else `unknown`.
3. `formatFor`: priority `YOUTUBE` → `edit` output → `UGC` → `PRODUCT` → `general`.
4. `hasConcreteSubject`: true if a link word matches (`of`, `for`, `about`, `showing`, `with`, `featuring`, `called`, `named`), or 3+ words (length > 2) remain after removing filler words (`make`, `video`, `ugc`, etc.).
5. Duration is present if `duration_seconds` is set or `DURATION` matches (`30s`, `1 minute`, `short`, `quick`, etc.).
6. Add missing slots and questions, in order:
   - `output_type` — output type is `unknown`.
   - `subject` — no concrete subject.
   - `duration` — video without duration.
   - `source_topic` — `youtube` format, no "footage/clips about X" phrase, and fewer than 6 words.
   - `product_context` — video with `PRODUCT_CONTEXT` words but no `PRODUCT_DETAIL` words.
   - `proof_point` — else-branch of `product_context`: no `PROOF_DETAIL` words and fewer than 8 words.
7. `speechModeFor`: quoted text (4+ chars) → `quoted`. `ugc` format → `creator_dialogue`. `SPEECH` words → `voiceover`. `VISUAL_ONLY` words → `mostly_visual`. Else `unknown`.
8. Deduplicate. Cut questions to 3.

**Minor helpers:** `unique`, `compactWords` (lowercase, strip punctuation, keep words longer than 2 chars).

**Depends on:** `CreateProjectRequest` type from `server/src/schemas.ts`. No providers, no env vars, no I/O.

**Used by:** `classifyMagicHourRequest` in `server/src/magicHourCapabilities.ts`. That function is called from `index.ts`, `runners.ts`, `agents.ts`, `workflows.ts`.

**Gotchas:**
- The caller uses only `questions`. `missing_slots` and `slots` (including `speech_mode`) have no reader in `server/src`.
- The caller merges these questions with its own. For image-only requests it swaps the product/benefit question for "What product or visual subject should the image show?".
- Pure keyword regex. Short words like `ad`, `short`, `app` match broadly. `short` counts as both a video word and a duration.
