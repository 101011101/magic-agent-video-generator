# concurrency.ts

> Level 3 · Source: `server/src/concurrency.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Limit how many calls run at the same time against each external provider (TTS vendors, Magic Hour submit).

**Role in parent:** Gives process-wide, in-memory FIFO limiters that all projects share. One limiter per provider caps parallel requests across all running projects.

**Main exports:**
- `class AsyncLimiter(name, limit)` — FIFO queue with a cap on active tasks. Constructor throws `Invalid concurrency limit for <name>` if `limit` is not finite or `< 1`.
- `AsyncLimiter.run(label, task)` — Queues `task`, returns a promise that settles with the task result or error. `label` is for diagnostics only.
- `AsyncLimiter.snapshot()` — Returns `{ name, active, queued, limit, queued_labels }`.
- `providerConcurrency` — Four shared limiters:
  - `humeTts` (`hume_tts`) — env `HUME_TTS_CONCURRENCY`, default `1`.
  - `fishTts` (`fish_tts`) — env `FISH_TTS_CONCURRENCY`, default `2`.
  - `elevenLabsTts` (`elevenlabs_tts`) — env `ELEVENLABS_TTS_CONCURRENCY`, default `2`.
  - `magicHourSubmit` (`magic_hour_submit`) — env `MAGIC_HOUR_SUBMIT_CONCURRENCY`, default `5`.
- `providerConcurrencySnapshot()` — Returns `snapshot()` of all four limiters, keyed `hume_tts`, `fish_tts`, `elevenlabs_tts`, `magic_hour_submit`.

**Internal flow:**
1. `run()` pushes `{ label, run, resolve, reject }` onto the queue and calls `drain()`.
2. `drain()` starts tasks from the queue head while `active < limit`.
3. Each started task increments `active`. On settle, it forwards the result to `resolve`/`reject`, decrements `active` (floor `0`), and calls `drain()` again.
4. `envLimit(name, fallback)` (private) parses `ENV[name]` as an integer. It uses `fallback` if the value is missing, not a number, or `<= 0`.

**Depends on:** `ENV` from `server/src/config.ts`.

**Used by:**
- `server/src/media.ts`:
  - `magicHourSubmit.run` — image edit, image generation (scene and standalone), talking-photo, image-to-video submits. Labels `image-edit:`, `image:`, `talking:`, `i2v:` + `<project_id>:<scene_id>`.
  - `fishTts.run` — each Fish Audio `/v1/tts` request attempt (inside a 4-attempt retry loop).
  - `humeTts.run` — Hume TTS requests.
  - `elevenLabsTts.run` — ElevenLabs voice list and TTS requests.
- `server/src/index.ts` — `GET /api/health` returns `providerConcurrencySnapshot()` as `provider_concurrency`.

**Gotchas:**
- Limits are per server process, in memory. They reset on restart and do not coordinate across processes.
- Limits are read once at module load. Changing env vars needs a restart.
- `magicHourSubmit` limits only the submit call. Polling for job completion is not inside the limiter (submits use `wait_for_completion: false`).
- Fish TTS retries call `run()` per attempt, so each retry queues again at the back of the queue.
