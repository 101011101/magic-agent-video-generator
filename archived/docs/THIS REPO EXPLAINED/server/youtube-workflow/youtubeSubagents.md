# youtubeSubagents.ts

> Level 3 · Source: `server/src/youtubeSubagents.ts` · Up: [YouTube Workflow](README.md)

**Purpose:** Two optional low-cost OpenAI subagents for the YouTube workflow: a script-budget reviewer and a candidate-video ranker. Each has a deterministic fallback.

**Role in parent:**
- Makes sure the YouTube script plan fits the runtime and spoken-word budget before clip search starts.
- Reorders YouTube search candidates per section before transcript alignment and download.
- Returns a `review` record that callers store in project decision metadata and clip metadata.

**Main exports:**
- `reviewYoutubeScriptWithSubagent(ctx, request, plan)` → `{ plan, review }` — checks the `YouTubeScriptPlan` against `speechBudgetForRequest`; asks the model to rewrite `dialogue` and `duration_seconds` if over budget; falls back to `fitYoutubeScriptToBudget`. Agent name `youtube_script_budget_subagent`.
- `rankYoutubeCandidatesWithSubagent(section, candidates)` → `{ candidates, review }` — asks the model to rank candidates for one `YouTubeClipSection`; review adds `ranked_video_ids` and `rejected_video_ids`. Agent name `youtube_candidate_selection_subagent`.
- `fitYoutubeSectionDurations(plan, targetSectionSeconds)` — scales section durations down to the target with largest-remainder rounding; each section keeps at least 1s.
- `fitYoutubeScriptToBudget(plan, { targetSectionSeconds, maxWords })` — runs `fitYoutubeSectionDurations`, then truncates each section `dialogue` to a word share in proportion to its duration.
- `applyCandidateRanking(candidates, rankedVideoIds)` — puts ranked IDs first (skips unknown and duplicate IDs), then appends all unranked candidates in original order.
- `youtubeSubagentModel()` — returns `YOUTUBE_SUBAGENT_MODEL` or `"gpt-5.4-mini"`.
- Types: `YoutubeSubagentReview` (`agent`, `model`, `accepted`, `changed`, `issues`, `summary`, `usage`), `YoutubeScriptSubagentResult`, `YoutubeCandidateSubagentResult`.
- Internal helpers: `subagentsEnabled`, `responseText` (reads `output_text` or joins `output[].content[].text`), `plainUsage`, `scriptBudgetIssues`, `truncateToWords`.

**Internal flow (script review):**
1. Compute budget issues: total section seconds > `scene_duration_total_seconds`, or spoken words > `max_words`.
2. No issues → return plan unchanged, `accepted: true`.
3. Subagents disabled → return `fitYoutubeScriptToBudget` result, `accepted: false`.
4. Else call OpenAI `responses.create` with strict JSON schema `youtube_script_budget_plan` (`max_output_tokens: 1800`).
5. Parse with `YouTubeScriptPlanSchema`, run `normalizeYoutubeScriptPlan`, then always run `fitYoutubeScriptToBudget` again.
6. Re-check budget; `accepted` = no remaining issues.
7. On error → deterministic fit, error text (max 180 chars) added to `issues`.

**Internal flow (candidate ranking):**
1. Disabled or fewer than 2 candidates → return input order unchanged.
2. Send first 8 candidates (compact: `video_id`, `title`, `channel_title`, `description` cut to 240 chars, `duration_seconds`, `published_at`) with section `dialogue` and `search_hint`.
3. Prompt prefers real footage of the visible scene over commentary, stock, podcasts, title cards, and compilations.
4. Strict JSON schema `youtube_candidate_ranking` (`max_output_tokens: 600`) → `applyCandidateRanking`.
5. On error → original order kept, `accepted: false`.

**Depends on:**
- `openai` SDK (Responses API).
- `./config.js` `ENV`: `OPENAI_API_KEY`, `YOUTUBE_SUBAGENTS_ENABLED` (off only when `"false"`), `YOUTUBE_SUBAGENT_MODEL`, `YOUTUBE_SUBAGENT_TIMEOUT_SECONDS` (default 20).
- `./prompts.js`: `countSpokenWords`, `speechBudgetForRequest`, `youtubeScriptNarration`, `normalizeYoutubeScriptPlan`.
- `./schemas.js`: `YouTubeScriptPlanSchema`, `CreateProjectRequest`, `YouTubeClipSection`, `YouTubeScriptPlan`.

**Used by:**
- `server/src/agents.ts` `draftYoutubeScriptImpl` — calls `reviewYoutubeScriptWithSubagent` before it writes the `youtube_script_plan` artifact; stores `review` as `subagent` in the decision metadata.
- `server/src/youtubeShort.ts` `downloadSectionClip` — calls `rankYoutubeCandidatesWithSubagent` after `searchSectionVideoCandidates`; stores `review` as `youtube_subagent_candidate_review`. `youtubeSubagentModel()` is also the last fallback model for YouTube visual verification.
- `server/tests/youtubeSubagents.test.ts` — tests the three deterministic fit and ranking functions.

**Gotchas:**
- Subagents are enabled by default whenever `OPENAI_API_KEY` is set.
- Deterministic fallback cuts dialogue mid-sentence and adds a `.`; it can lose meaning.
- `fitYoutubeSectionDurations` only shrinks durations; it never extends a short plan.
- `rejected_video_ids` is only recorded; rejected candidates are not removed from the list.
- Candidates past index 8 are never shown to the model but stay at the end of the list.
- Candidate `changed` is `true` only when the top candidate changes.
