# config.ts

> Level 3 · Source: `server/src/config.ts` · Up: [Foundation](README.md)

**Purpose:** Single source of server configuration: merged env values, output paths, required keys and commands, model pricing, and default tuning constants.

**Role in parent:** Gives every other server module one import (`./config.js`) for env and constants. It has no internal imports, so it sits at the bottom of the dependency graph.

**Main exports:**
- `ROOT` — repo root; resolved as two levels up from the directory of `config.ts` (`server/src` → repo root).
- `loadEnv()` — reads `<ROOT>/.env` with `dotenv.parse`, then overlays every defined `process.env` value. `process.env` wins over `.env`.
- `ENV` — result of `loadEnv()` at import time. Plain `Record<string, string>`.
- `OUTPUT_DIR` — `ENV.OUTPUT_DIR` or `<ROOT>/outputs`; absolute; created on import.
- `MH_AGENT_YT_CLIPS_DIR` — `ENV.MH_AGENT_YT_CLIPS_DIR` or `<ROOT>/../mh_agent_output/yt-clips`; not created here.
- `REQUIRED_ENV_KEYS` — `OPENAI_API_KEY`, `MAGIC_HOUR_API_KEY`, `FISH_AUDIO_API_KEY`, `FISH_AUDIO_REFERENCE_ID`, `HUME_API_KEY`.
- `REQUIRED_SYSTEM_COMMANDS` — `ffmpeg`, `ffprobe`.
- `OPENAI_TEXT_PRICING_USD_PER_1M` — per-model USD per 1M tokens for `gpt-5.5` and `gpt-5.4`: `input`, `cached_input`, `output`, long-context threshold (`272_000` input tokens) and multipliers (input ×2.0, output ×1.5), `source` URL.
- `YOUTUBE_REVIEW_PROMPT_SET_PATH` — `<ROOT>/evals/youtube_workflow_eval_prompts.jsonl`.
- Default constants:
  - Run shape: `DEFAULT_AUTO_DURATION_SECONDS` (15), `DEFAULT_AUTO_SCENE_BUDGET_COUNT` (4), `DEFAULT_AGENT_MAX_TURNS` (30).
  - Magic Hour models: `DEFAULT_MAGIC_HOUR_IMAGE_MODEL` (`nano-banana-2-lite`), `DEFAULT_MAGIC_HOUR_VIDEO_MODEL` (`minimax-h3`).
  - ElevenLabs: `DEFAULT_ELEVENLABS_AUDIO_MODEL` (`eleven_multilingual_v2`), `DEFAULT_ELEVENLABS_VOICE_NAME` (`brielle - podcast girl`).
  - TTS pace (words per second): `DEFAULT_TTS_WORDS_PER_SECOND` (2.8), `DEFAULT_HUME_TTS_WORDS_PER_SECOND` (2.95), `DEFAULT_ELEVENLABS_TTS_WORDS_PER_SECOND` (2.6), `MAX_HUME_PLANNING_WORDS_PER_SECOND` (3.4), clamp `MIN_TTS_WORDS_PER_SECOND` (1.6) / `MAX_TTS_WORDS_PER_SECOND` (3.6).
  - Narration length factors: `NARRATION_MIN_FACTOR` (0.9), `NARRATION_MAX_FACTOR` (1.0).

**Internal flow (runs once, at import):**
1. Resolve `ROOT`.
2. Build `ENV` from `.env` plus `process.env`.
3. Delete empty-string proxy vars (`http_proxy`, `https_proxy`, `all_proxy`, upper and lower case) from `process.env`.
4. Resolve `OUTPUT_DIR` and create it (`mkdirSync` recursive).
5. Resolve `MH_AGENT_YT_CLIPS_DIR`.
6. Copy `ENV.OPENAI_API_KEY` into `process.env.OPENAI_API_KEY` if `process.env` lacks it (for SDKs that read `process.env` directly).

**Depends on:** `dotenv`, Node `fs` / `path` / `url`. Env vars: `OUTPUT_DIR`, `MH_AGENT_YT_CLIPS_DIR`, `OPENAI_API_KEY`, plus any key other modules read through `ENV`.

**Used by:**
- `ENV`: `index.ts`, `projects.ts`, `agents.ts`, `agentRuntime.ts`, `runners.ts`, `concurrency.ts`, `youtubeShort.ts`, `youtubeSubagents.ts`, `prompts.ts`, `projectContext.ts`.
- `OUTPUT_DIR`: `index.ts`, `projects.ts`, `inputMedia.ts`, `prompts.ts`, tests `workflows.lipsync.test.ts` and `workflows.retry.test.ts`.
- `REQUIRED_ENV_KEYS`, `REQUIRED_SYSTEM_COMMANDS`, `MH_AGENT_YT_CLIPS_DIR`: `projects.ts` (`missingConfiguration`, `missingSystemDependencies`, clip saving).
- `YOUTUBE_REVIEW_PROMPT_SET_PATH`: `index.ts`, `projects.ts` (`loadYoutubeReviewPromptSet`).
- `OPENAI_TEXT_PRICING_USD_PER_1M`: `usageCost.ts`.
- TTS pace and narration constants: `prompts.ts`. Model, voice, and max-turn defaults: `projectContext.ts`, `agents.ts`, `media.ts`.

**Gotchas:**
- `ENV` is a snapshot at import. Later changes to `process.env` or `.env` do not show in `ENV` until restart.
- Importing this module has side effects: it creates `OUTPUT_DIR` and changes `process.env`.
- `REQUIRED_ENV_KEYS` is not a strict list. `missingConfiguration` in `projects.ts` skips keys by audio provider and by per-request credentials, and adds `ELEVENLABS_API_KEY` for the ElevenLabs provider.
- Pricing covers only `gpt-5.5` and `gpt-5.4`. `pricingKeyForModel` in `usageCost.ts` maps `openai/<model>` and `<model>-*` names onto these keys and throws for other names; `pricingForModel` catches the throw and returns `null`.
