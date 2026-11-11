# mediaSync.ts

> Level 3 · Source: `server/src/mediaSync.ts` · Up: [Media Pipeline](README.md)

**Purpose:** Get the duration of a media file in seconds with a blocking `ffprobe` call.

**Role in parent:** Gives synchronous code a duration probe. The async version is `probeMediaDuration` in [media.md](media.md). The sync version exists because its caller is a synchronous function.

**Main exports:**
- `probeMediaDurationSync(filePath: string): number` — runs `ffprobe` on `filePath` and returns `format=duration` as a float (seconds).

**Internal flow:**
1. Run `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 <filePath>` with `execaSync` and `reject: false`.
2. If exit code is not `0`, throw `ffprobe duration failed for <filePath>` with stderr, stdout, or `"no command output"`.
3. Parse stdout with `Number.parseFloat`.
4. If the value is not `> 0` (includes `NaN`), throw `Media has invalid duration`.
5. Return the duration.

**Depends on:** `execa` (`execaSync`); `ffprobe` binary on `PATH`.

**Used by:**
- `estimateTtsWordsPerSecond` in `server/src/prompts.ts` — probes each past project's voiceover file (from `<output>/<project>/manifest.json` → `voiceover.path`) to calibrate TTS words-per-second. It wraps the call in `try/catch` and skips a sample on error.

**Gotchas:**
- Blocks the Node event loop for each `ffprobe` run. `estimateTtsWordsPerSecond` can call it once per past project in the output dir; results are cached per provider/model/voice/root in `ttsWordsPerSecondCache`.
