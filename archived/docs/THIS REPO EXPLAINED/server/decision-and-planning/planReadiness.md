# planReadiness.ts

> Level 3 · Source: `server/src/planReadiness.ts` · Up: [Decision and Planning](README.md)

**Purpose:** Convert plan-validation issue strings into a structured `PlanReadinessReport` that gates paid provider calls.

**Role in parent:** Gives the planning stage one machine-readable verdict: `ready` (provider calls allowed) or `repair_required` (revise the plan with `draft_video_plan` first). Also classifies issues into families for repair-loop logic.

**Main exports:**
- `buildPlanReadinessReport(issues, warnings = [], repairAttempt = 0)` — returns a `PlanReadinessReport` with `stage: "plan_preflight"`.
- `planIssueFamily(issue)` — maps one issue string to a family code by regex: `spoken_script`, `physical_continuity`, `voice_identity`, `audio_performance`, `runtime`, `input_media`, `visual_prompt`, `creative_fit`, `provider_contract`. Fallback: lowercased first clause with `scene_N` replaced by `scene`, or `plan_contract` if empty.
- Types: `PlanIssueOwner` (`"planner" | "user_input"`), `PlanReadinessIssue`, `PlanReadinessAction`, `PlanReadinessReport`.

**Internal flow:**
1. Each issue and warning string becomes a `PlanReadinessIssue` (internal `readinessIssue`): `code` = `planIssueFamily`, `scene_id` = first `scene_N` match (lowercased) or `null`, `owner` from internal `issueOwner`, `safe_to_auto_repair` = `owner === "planner"`, `cost_tier: "free"`, `message` = original string.
2. `issueOwner` returns `user_input` when the text matches `missing user|user must|ask the user|requires an uploaded|no uploaded`; otherwise `planner`.
3. No issues → `status: "ready"`, `provider_calls_allowed: true`, empty `next_actions`. Warnings stay in the report.
4. Any issue → `status: "repair_required"`, `provider_calls_allowed: false`, one `next_actions` entry: `kind: "revise_plan"`, `tool: "draft_video_plan"`, `requires_provider_call: false`.
5. If any issue has owner `user_input`, the action owner is `user_input` and `safe_to_auto_run: false` ("Collect the missing user input…"). Otherwise owner is `planner` and `safe_to_auto_run: true`.

**Depends on:** Nothing. Pure functions, no imports.

**Used by:**
- `server/src/workflows.ts` → `draftVideoPlanImpl`: on blocking issues calls `buildPlanReadinessReport(qualityIssues, qualityWarnings, previousFailures + 1)`; on success calls `buildPlanReadinessReport([], [], 0)`. Both write the report via `writeJsonArtifact(ctx, "plan_readiness", …)`. The failure report is also stored in the project-state decision metadata and returned to the caller as `readiness`.
- `server/src/workflows.ts` → `repairIntroducedOnlyNewIssueFamilies`: uses `planIssueFamily` to detect a repair that swapped old issue families for at most 2 new ones; that case raises the repair budget to `MAX_REPAIR_INTRODUCED_REGRESSION_FAILURES`.
- `server/tests/planReadiness.test.ts`.

**Gotchas:**
- Family regexes run in fixed order; the first match wins. Example: text with "image" and "uploaded" becomes `input_media`, not `visual_prompt`.
- The success path in `draftVideoPlanImpl` passes `[]` as warnings, so the `ready` artifact on disk never holds warnings.
- `cost_tier` is always `"free"`; the report never triggers a provider call itself.
