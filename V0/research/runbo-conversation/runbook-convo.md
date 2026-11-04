# Magic Agent Video Generator — Conversation Runbook

Source: Codex conversation about `magichourhq/magic-agent-video-generator` and the follow-up MVP (`runshouse/magic-video`).

## 1. Assessment of the original repo

- Verdict: ship a focused Magic Agent beta inside Magic Hour. Use this repo as a prototype to extract from. Do not deploy it unchanged.
- Core: one director agent (OpenAI Agents SDK, optional OpenRouter) + conventional software. No trained model. No proven multi-agent advantage.
- Pipeline: request → clarify → scene plan → TTS + scene images → animate / talking portrait → FFmpeg assembly → saved project for edits.
- Separate YouTube footage search-and-assembly workflow (~16% of ~18,700 backend lines).
- Fair comparison is Codex + Magic Hour MCP + FFmpeg, not a plain LLM. Magic Hour MCP already exposes generation, upload, wait, and result tools.
- Value: convenience, consistency, fewer user decisions. Creative-quality edge over a general agent is unproven.

| Part | Verdict |
|---|---|
| Audio timing, clip normalization, final assembly | Keep |
| Provider-job recovery, asset reuse | Keep |
| Saved scenes, timeline, selective regeneration | Keep, strengthen |
| Product/character reference propagation | Keep, fix inconsistencies |
| Scripts, clarification, tool selection | Ordinary LLM capability |
| Keyword-based "creative quality" rules | Mixed, brittle |
| Large repeated prompts | Condense and measure |
| YouTube pipeline | Defer |
| Multiple TTS providers, model settings | Cut for v1 |
| Canned product-script fallback | Remove |

- Routing defects (reproduced):
  - "Create an image of a bird" → asks which image to edit.
  - "Thumbnail for YouTube video" → asks video length.
  - "How much does a 10s video cost?" → selects video generation.
  - "Take me to face swap" → asks for source media.
  - Upload + "Animate this photo" → still asks which image. Cause: pre-LLM classifier ignores the uploaded-assets field.
- Capability catalog: 5 groups implemented, 11 marked planned. Unsupported requests do not route to the working Magic Hour tool.
- Quality-control defects:
  - "Inspect render" checks files and status. It does not watch the video.
  - Scene regeneration drops reference images → identity drift risk.
  - Fallback inserts canned claims (for example, phone charging on a desk lamp).
  - No text/logo overlay or music-bed tools. Prompt forbids text, logos, captions.
- 510 tests pass. No paid generation in verification. No output benchmark.
- Target design: one conversational model → validated action or scene plan → deterministic execution → editable result.
- v1 request types: advice/navigation, one-tool create/edit, bounded multi-step creation.
- Hosting gaps: no auth, ownership checks, durable scheduling, idempotency, cancellation. Reuse Magic Hour account, upload, billing, project, storage.
- Related issue: PD-173 (in progress).

## 2. Running examples

- Launch: `cp .env.example .env && ./dev.sh` → UI `:3000`, API `:8000`. Needs Node, npm, FFmpeg, FFprobe.
- Real video needs: Magic Hour key, OpenAI or OpenRouter key, ElevenLabs / Hume / Fish Audio key.
- Free sanity check: send `make me stuff`. Expect a clarification question and no credit spend.
- Gap: no tracked sample projects, outputs, or evaluation prompts. YouTube path also needs `yt-dlp` and a YouTube API key.

## 3. Architecture decision

- Do not build on the prototype. Start with: general agent + Magic Hour MCP/native APIs + curated skills.
- MCP = atomic operations. Skills = how to combine operations. Agent = intent + tool choice. App code = billing, auth, state, retries, rendering.
- First skills: animate an image, talking photo, short product promo.
- Each skill defines: trigger, required inputs, necessary questions, models/defaults, constraints, credit quote, tool sequence, retry rules, completion criteria.
- Port from prototype: scene plans, narration duration checks, audio-source separation, reference chaining, job recovery, scene reuse, selective regeneration, timeline assembly.
- Discard: regex router, giant director prompt, canned fallbacks, YouTube (v1), user-facing provider config, 3 TTS integrations, prompt-only rules.
- Proof metric: same model + tools with vs. without skills. Measure action selection, success rate, usable first result, time and credits per usable result, follow-up edits, 7-day repeat use.

## 4. MVP build history (`runshouse/magic-video`)

| Step | Change | Result |
|---|---|---|
| v1 | Chat → storyboard → video, references, narration, captions, music, logos, still previews, saved projects | No keys; no end-to-end render |
| v2 | HyperFrames editing, MCP tools (inspect → edit → render → inspect), research, keyframe rejection, speech-timed captions | Better presentation; not InVideo parity |
| v3 | Agents API director session (`c9051fa`), `OPENAI_AGENT_MODE=responses` fallback | No API key; unverified |
| Comparison | Codex as director, Magic Hour for media | Baseline 828 credits vs. Codex 876. Codex better structure. Output 10–11s instead of 20s |
| Voice fix | Replace macOS Samantha voice with Magic Hour AI Voice Generator | +33 credits. Audio better, visuals weak |
| "psu vs marshall" #1 | No web search, two overlapping voiceovers | Failure |
| "psu vs marshall" #2 | Web search → PSU 45–0 on Sept 5; one audio stream | Factual. Stack: Codex → web → Magic Hour REST → FFmpeg (bypassed MVP) |
| v4 (`b2e0893`) | Mandatory research, opened-source citations, Magic Hour voice, audio-first timing, provider audio stripped, duration/stream validation, `nano-banana-2-lite` + `ltx-2.3` | Merged as `b6d6a15` |
| PSU rerun | Official photos, 41.9s, 64 credits | Correct, but static |
| PSU motion | LTX 2.3 clips, 25s, 1,528 credits | Poor visual quality |
| PSU H3 (`e327f47`) | MiniMax H3, 1080p default | Better than LTX 2.3. 743 credits |
| Castle Itter (H3) | 24s, 1080p, 1,929 credits | Cinematic reconstruction |
| Castle Itter (LTX 2.5, `9d7f3bf`) | LTX 2.5 1080p default | More stable, less dynamic. 1,728 credits |
| 3 topics LTX 2.5 480p | Berlin Wall, Venus, Lake Nyos, 16s each | 1,512 credits |
| 3 topics H3 480p | 30s each | 2,480 credits. Richer motion, slower |
| PR #2 (`a03837a`) | Shot-aware prompts, 6-frame clip QC, rejected clips blocked | No paid render |
| PR #3 (`82d4536`) | Per-shot router, 12-frame review, one repair max, new MCP tools, asset labels | No paid render |

- PR #3 router: identity/products → Seedance 2.0; action → Kling 3.0; crowds/realism → Seedance 2.5; long/repair → LTX 2.3.
- PR #3 new MCP tools: `inspect_scene`, `revise_scene`, `replace_scene_asset`, `label_asset`.
- Not shipped (below 70% confidence): stock/archive downloads, benchmark winner claims, new voice catalog, full timeline editor.

## 5. Cost model

- Agents API: no platform fee. Cost = model tokens + built-in tools + optional hosted sandbox.
- GPT-5.4: $2.50/M input, $15/M output. Web search: $0.01/call + content tokens.
- One director turn: ~$0.10–$0.25 before media.
- Multi-agent default can exceed $1 per video before media.
- Magic Hour credits dominate cost.
- Codex/ChatGPT subscription usage cannot pay for standalone Agents API calls.
- Policy: one director agent, one optional review pass, explicit approval for paid generation, deterministic re-edits, render on own workers (not OpenAI sandbox).

## 6. Production stack recommendation

```
Magic Hour chat UI
  → OpenAI Agents API (director)
  → web search + Magic Hour skills + Magic Hour creation MCP
  → Open Edit timeline → HyperFrames graphics → FFmpeg export
  → mandatory audiovisual QA → UI
```

- Port from original repo: `sceneAudio.ts`, `audioPerformance.ts`, `planReadiness.ts`, `sceneContinuity.ts`, `timeline.ts`, `renderState.ts`, `usageCost.ts`, `voices.ts`, `media.ts`.
- Magic Hour MCP guidance: AI Image Editor → Image-to-Video; `nano-banana-2-lite` for images; `ltx-2.3` for image-to-video; reuse references; AI Voice Generator for narration; let sentences finish; text-to-video only when consistency does not matter.
- Skill discipline: define quality target, check live schema and cost, approve one start frame first, one action + one camera move per clip, submit each paid job once and persist ID, watch full clip, decide per audio source, captions last, inspect full export.
- Request flow: freshness gate + web search → media-rights decision → audio first (lock narration) → storyboard around narration → motion (provider audio off, verify streams) → structured timeline edit.
- Audio contract: one speech owner per scene (`voiceover` | `on_camera` | `native` | `silent`). Speech-detect clips before placing under narration.
- Export gate: one narration source, no unexpected speech, final word present, no truncation, measured loudness, captions match facts, duration matches, claims map to sources, full playback reviewed.
- Infra: existing Next.js app, Postgres state, durable queue with idempotency, private object storage, Open Edit workers, observability, server-side secret vault.
- Load MCP tools through tool search or a compact profile (~44 tools in full catalog).
- Ship gate: blinded eval of 20 each — current-event, product ad, talking-head, explainer, revision. Compare full stack, general agent, original Magic Agent, reduced planner.

## 7. H3 artifact diagnosis (ENG-5153)

- Symptom: Berlin Wall crowd shot, faces unreadable.
- Cause: H3 detail collapse on dense crowds at 480p. Faces ~10–25 px. Camera motion + crowd motion + 10s duration.
- Tool-worker config:
  - H3 480p generates at 800×448, then upscales (`dimensions.py:5`).
  - Lanczos + H.264 CRF 16 (`worker.py:195`).
  - 10 steps, Turbo LoRA strength 0.6 (`i2v.py:18`).
  - Pruned int8 model; Qwen encoder NVFP4-AWQ (`i2v.json:108`).
  - No face-detail or temporal-identity QC.
- Fix: shot routing + face-aware QC. Not face restoration.
  - Historical crowd/event → real archival or stock footage.
  - 1–3 people → H3 at 720p/1080p, 3–5s.
  - Landscape/object → H3 or LTX, 480p allowed.
  - Talking face → lip-sync model.
- QC reject rules: >~5 prominent faces, median face width <~40 px, face disappears, landmark drift, duplicate faces, melted hands, temporal blur.
- Worker experiment: same source/prompt/seed at 720p; int8 + Turbo + 10 steps vs. base H3 with more steps. Confidence: medium.
- Ticket ENG-5153: embedded video, screenshot, failing project `cmucclc6e00iwka01ngyzt9f2`, keyframe project `cmucbxwuc00s5kh01xn8197gm`, prompts, model, 480p, 10s, credits, component video IDs, failure at 00:20–00:30. Related: ENG-4144, ENG-5073.

## 8. Staying state of the art

- Moat: per-shot choice of source, model, and repair. Not one model, not prompt prose.
- Priority:
  1. Quality router + generated-video evaluator.
  2. Stock/licensed footage search with provenance.
  3. Character/product/voice asset memory.
  4. Shot-level edit and repair tools.
  5. Weekly champion/challenger model evaluation.
  6. Richer timeline UI.
- Capability registry per model: operations, limits, strengths, known failures, cost, latency, benchmark score per shot category.
- Repair: max 1–2 targeted repairs, then surface weak shot to user.
- Eval suite: single face, multiple people, crowds, products/logos, fast action, historical, talking characters, camera moves, stylized, long continuity.
- Promotion metrics: pairwise preference, first-pass usable-shot rate, clip acceptance, regeneration rate, time to first cut, cost per accepted second, P95 latency.
- Remaining SOTA gaps: real footage retrieval, temporal eval (face tracking, identity embeddings, optical flow, audio QC), licensed voice catalog with audition and pronunciation, beat-aware music, editable timeline UI.
- Avoid: more personas, subagents, prompt prose, loosely connected MCPs.

## 9. Open items

- No fresh paid render on current `main` (PR #2, PR #3).
- No licensing provider chosen for stock/archive footage.
- No blinded benchmark run.
- InVideo-level quality not proven.
- Production redistribution of official photos needs media rights.
