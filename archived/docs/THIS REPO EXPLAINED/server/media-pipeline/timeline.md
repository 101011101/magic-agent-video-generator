# timeline.ts

> Level 3 · Source: `server/src/timeline.ts` · Up: [Media Pipeline](README.md)

**Purpose:** Define the editable timeline artifact (tracks, clips, final hold). Build it from project state. Apply pure edits to it.

**Role in parent:** Gives the pipeline one data model for clip order and timing. The stitch step reads it. Agent tools and the HTTP API edit it.

**Main exports:**
- Types: `TimelineArtifact` (`version: 1`, `duration_seconds`, `tracks`, `ending`, `updated_at`), `TimelineTrack`, `TimelineClip`, `TimelineEditResult` (`{ timeline, summary }`).
- `TimelineTrackKind` — `"video" | "narration" | "guard"`. `TimelineEndBehavior` — `"cut" | "freeze" | "fade"`.
- `DEFAULT_FINAL_HOLD_SECONDS` — `0`. Internal max hold is `5` s.
- `normalizeTimeline(timeline)` — Rounds all times to 3 decimals. Clamps negative values to 0. Forces `source_end >= source_start` and `timeline_end >= timeline_start`. Recomputes `duration` as `timeline_end - timeline_start`. Recomputes `duration_seconds` as the max `timeline_end` over all tracks. Sets `updated_at` to now.
- `buildTimelineFromProjectState(projectState, { final_hold_seconds?, ending_reason? })` — Builds a new 3-track timeline from `scene_assets.videos` and `scene_assets.voiceover`.
- `setFinalHold(timeline, holdSeconds, reason?)` — Clamps hold to `[0, 5]`. Replaces the guard track with one `guard:final-hold` clip at the end of the video/narration tracks, or with no clip when hold is 0. Rewrites `ending`.
- `moveClip(timeline, clipId, timelineStart)` — Sets a new `timeline_start` (min 0) and keeps `duration`.
- `trimClip(timeline, clipId, { source_start?, source_end? })` — Sets a new source range. Sets `duration` to the source range. Keeps `timeline_start`.
- `timelineSummary(timeline)` — One line: video clip count, total seconds, final hold, ending state.
- `inspectTimeline(timeline)` — Returns `{ timeline: normalized, summary }`.

**Internal flow (`buildTimelineFromProjectState`):**
1. Sort `scene_assets.videos` by scene order in `current_plan.scenes`. Videos with no match go last.
2. Place video clips back to back from 0. Clip id is `video:<scene_id>`. Clip length is `audio_duration_seconds`, else `timeline_duration_seconds`, else source length (`duration_seconds`, else `end_seconds - start_seconds`, else 1).
3. For YouTube segments (`source === "youtube"` or `youtube_url` set), set the source range to `0..source_duration`, because the file is already cut. Keep the original range in `metadata.original_start_seconds` / `original_end_seconds`.
4. Set `end_behavior` to `"freeze"` when clip length exceeds the source range, else `"cut"`.
5. Add narration clips (locked, `source_start == timeline_start`) when the voiceover has a positive `duration_seconds`. With no talking clips: one `narration:voiceover` clip `0..voiceover duration`. With talking clips (`metadata.on_camera` or `metadata.has_embedded_audio`): one `narration:voiceover:gap-<n>` clip per gap between talking spans, up to the video end.
6. When hold > 0, add a `guard:final-hold` freeze clip that uses the last video clip's source. It starts at `max(video end, first narration clip end)`.
7. Return the result of `normalizeTimeline`.

**Depends on:** No imports. Reads only the `projectState` object that the caller passes in.

**Used by:**
- `server/src/workflows.ts` ([workflows.md](workflows.md)) — `timelineFromProjectState` (normalizes the stored `state.timeline`, else builds a new one); `inspectTimelineImpl`, `trimTimelineClipImpl`, `moveTimelineClipImpl`, `setFinalHoldImpl` save the result to project state; `keepEndingGuardAtTimelineEnd` calls `setFinalHold` after a trim or move; stitch paths build timelines (the YouTube clips path passes `final_hold_seconds: 0.25`); `attachTimelineRenderVerification` writes `ending.verification`.
- `server/src/agents.ts` — agent tools `inspect_timeline`, `trim_clip`, `move_clip`, `set_final_hold` call the `*Impl` functions.
- `server/src/index.ts` — `PATCH /api/projects/:projectId/timeline` with `operation` = `inspect` | `trim_clip` | `move_clip` | `set_final_hold`.
- `server/src/renderState.ts` — calls `normalizeTimeline` when it reads or writes `state.timeline`.
- `server/tests/timeline.test.ts`.

**Gotchas:**
- Edit checks are minimal. `moveClip` and `trimClip` throw `Timeline clip not found: <id>`. `trimClip` throws when the new duration is not positive. Nothing checks for clip overlaps or gaps.
- `trimClip` sets `duration` to the source range. A clip that was longer than its source (a `"freeze"` clip) loses the extra time. `end_behavior` does not change.
- `setFinalHold` replaces `ending` and drops `ending.verification`.
- `normalizeTimeline` uses `Number(x) || fallback`, so a value of `0` for `source_end` or `timeline_end` counts as missing.
- The guard start differs: the builder uses only the first narration clip end, but `setFinalHold` uses the max end of the full video and narration tracks.
- A comment in `server/src/workflows.ts` says the default hold is 1.5 s. The code value of `DEFAULT_FINAL_HOLD_SECONDS` is `0`, so default builds have no guard clip and `ending.intentional` is `false`.
