# timings.ts
> Level 3 · Source: `server/src/timings.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Record timing events for one project to `<project_dir>/timings.json`. Summarize the events into per-name span stats.

**Role in parent:** Gives the server one append-only performance log per project. Workflows, the agent runner, and media providers write to it. The final manifest reads a summary of it.

**Main exports:**
- `TimingPhase` — `"start" | "end" | "error" | "event"`.
- `TimingEvent` — `{ id, span_id?, phase, name, created_at, duration_ms?, scene_id?, provider_job_id?, provider_kind?, metadata? }`. Extends `JsonDict`.
- `readTimingEvents(ctx)` — Reads the `timings` artifact. Returns `[]` if the file does not exist.
- `recordTimingEvent(ctx, event)` — Adds `id` (`randomUUID()`) and `created_at` (ISO time). Cleans `metadata`. Appends the event to the file. Returns the event.
- `withTiming(ctx, name, metadata, fn)` — Wraps an async `fn` in one span. Writes a `start` event, then an `end` event with `duration_ms`. On a throw, writes an `error` event with `metadata.error` (the error message), then throws the error again.
- `summarizeTimingEvents(events)` — Returns `{ event_count, completed_span_count, by_name: { <name>: { count, total_ms, max_ms, avg_ms } } }`.

**Internal flow (`summarizeTimingEvents`):**
1. Skip events with no `span_id`. Standalone `phase: "event"` records only add to `event_count`.
2. Group events by `span_id`. A `start` event sets `started_at` and `metadata`. An `end` or `error` event with a numeric `duration_ms` sets `duration_ms`.
3. Keep only spans that have `duration_ms` (completed spans). Error spans count as completed.
4. Aggregate completed spans by `name`: `count`, `total_ms`, `max_ms`. Compute `avg_ms` as the rounded mean.

**Depends on:**
- `readJsonArtifact` / `writeJsonArtifact` from [`renderState.ts`](renderState.md) (artifact name `"timings"` → `timings.json` in `ctx.project_dir`).
- `ProjectContext` from `context.ts`.
- `node:crypto` `randomUUID`.

**Used by:**
- `server/src/workflows.ts` — `withTiming` around workflow stages (`workflow.draft_video_plan`, `workflow.generate_voiceover`, `workflow.generate_scene_images`, `workflow.animate_scene_videos`, `workflow.stitch_final_video.*`, and others). Manifest build puts `timings_path` and `timings_summary` into the manifest.
- `server/src/runners.ts` — `withTiming` around `agent.run_streamed`. `recordTimingEvent` for `agent.interrupted_handoff` and `agent.openrouter.pre_output_retry`.
- `server/src/media.ts` — `withTiming` around provider submits, downloads, and TTS requests (`magic_hour.*`, `provider.download.*`, `tts.fish.request`, `tts.hume.request`, `tts.elevenlabs.request`, `voiceover.*`). Manual `start`/`end`/`error` events with an explicit `span_id` and `provider_job_id` for provider poll loops (for example `magic_hour.image.poll`).

**Gotchas:**
- Each `recordTimingEvent` reads the full file and writes it again. Cost grows with event count. No lock: concurrent writers in the same process are safe only because the read and write are synchronous.
- `cleanMetadata` drops `undefined` values and cuts string values longer than 500 chars (adds `...`). Empty metadata is removed from the event.
- `withTiming` writes the same `metadata` on both `start` and `end`.
- `span_id` is required for an event to appear in the summary. `recordTimingEvent` calls without `span_id` do not produce stats.
