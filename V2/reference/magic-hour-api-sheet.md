# Magic Hour API — reference sheet

Compiled 2026-10-30 from the official docs (docs.magichour.ai, OpenAPI version "beta"), the cost calculator page (magichour.ai/api), the terms of service, the FAQ and the help centre. Every endpoint the API exposes is covered: 42 operations on 39 paths. Where a page does not state something, the sheet says "not found in docs" rather than guessing. Figures marked "web app" come from changelog or FAQ entries about the browser product and may not match API behaviour.

Contents

1. Conventions shared by every endpoint
2. Plans, credits and limits
3. Video generation
4. Image generation and editing
5. Faces and people
6. Audio
7. Utilities (upscalers, files, saved items, account, project status, webhooks)
8. Processing times
9. What this means for the V2 pipeline
10. Gaps: what could not be found
11. Sources

---

## 1. Conventions shared by every endpoint

| Item | Value |
| --- | --- |
| Base URL | `https://api.magichour.ai` |
| Auth | `Authorization: Bearer <api_key>`; keys are created in the Developer Hub, shown once, no scopes, rotation recommended every 90 days. Example keys use the prefix `mhk_live_`. |
| Content type | `application/json` |
| Asset inputs | Every `*_file_path` field accepts either (a) the `file_path` returned by `POST /v1/files/upload-urls`, (b) a direct public or pre-signed URL whose path ends in a supported extension (HTTPS recommended; no cookies or headers are forwarded), (c) a Magic Hour library URL for your own account (`https://magichour.ai/my-library?videoId=…`, `?imageId=…`, `?audioId=…`), or (d) a saved-item `file_path` from `GET /v1/saved-items` "in a compatible asset field" (the docs do not say which fields qualify). |
| Create response | `{ "id": string, "credits_charged": integer }` for every create endpoint. |
| Status polling | `GET /v1/video-projects/{id}`, `GET /v1/image-projects/{id}`, `GET /v1/audio-projects/{id}`. Status values: `draft`, `queued`, `rendering`, `complete`, `error`, `canceled`. Suggested polling: 3 s (image, audio), 5 s (short video), 10 s (video over 30 s), with backoff; webhooks recommended in production. |
| Downloads | `downloads[]` of `{ url, expires_at }`; signed URLs last 24 hours; re-GET the project for a fresh URL instead of regenerating. Retention is "varies by feature"; keep your own copies. |
| Credit charging | Credits are deducted when the job is queued. Per-frame tools charge an estimate and settle to frames actually rendered; per-second tools charge the final amount upfront. Failed jobs are refunded (`credits_charged` is updated). Cancellation (web app only; no API cancel) refunds video jobs while queued or rendering. |
| Errors | `400 invalid_request`, `401 unauthorized`, `402 insufficient_credits` / `subscription_required` / `plan_upgrade_required`, `404 not_found`, `422 unprocessable_entity`, `500 internal_server_error`. Body is `{ code, message }`. Job-level `error.code` values seen in docs: `no_source_face`, `invalid_file_format`, `invalid_video_file`, `file_too_large`, `insufficient_credits`, `invalid_parameters`, `processing_timeout`, `content_policy_violation`, `text_too_long`, `invalid_voice`, `invalid_audio_path`, `invalid_image_path`, `invalid_video_path`, `invalid_audio_file`, `invalid_image_file`, `invalid_video_file`, `invalid_youtube_url`, `unknown_error`. |
| Rate limits | Not published anywhere in the docs, help centre or terms ("Magic Hour does not publish one consolidated universal table"). API jobs do not count against web-app concurrency limits; they may queue. |
| Idempotency | No idempotency key. If a create call times out, check project history before resubmitting; a repeat creates a second job and spends credits again. |
| Mock server | SDKs can target a hosted mock server that returns sample data and charges nothing (Python `Environment.MOCK_SERVER`, Node `Environment.MockServer`). |
| SDKs | Python (`magic_hour`), Node/TypeScript (`magic-hour`), Go, Rust; plus cURL/PHP/Java samples. SDK `wait_for_completion` / `download_outputs` options are client-side, not API fields. |

Supported input formats (from the upload-URLs page and the inputs guide):

| Type | Extensions |
| --- | --- |
| video | mp4, m4v, mov, webm |
| audio | mp3, wav, aac, flac, webm, weba, m4a, opus, ogg, oga, aiff, amr |
| image | png, jpg, jpeg, jpe, jfif, heic, heif, webp, avif, jp2, tiff, tif, bmp |
| gif | gif, webp, webm — "only supported for face swap API `video_file_path`" (the upload `type` enum has no `gif` value) |

Output formats (container, codec, bit depth) are not stated anywhere in the docs. Examples show `.mp4` video, `.png` image and `.wav` audio download URLs.

---

## 2. Plans, credits and limits

Credits are the single unit. One job's price = the credit figures below; dollars depend on how credits were bought.

| Plan | Monthly | Annual | Credits | Upload cap | Longest edge (older tools) |
| --- | --- | --- | --- | --- | --- |
| Free / Basic | $0 | — | 400 at signup; 100/day claimable, max 7 claims (unlimited daily claims while subscribed) | 200 MB | 576 px |
| Creator | $19 | $144 ($12/mo) | 12,000/mo or 144,000/yr | 2 GB | 1,024 px |
| Pro | $39 | $300 ($25/mo) | 25,000/mo or 300,000/yr | 5 GB | 1,472 px |
| Business | $99 | $792 ($66/mo) | 70,000/mo or 840,000/yr | 10 GB | 4,096 px |

- Usage-based billing (monthly invoice, setup via support@magichour.ai): per credit, banded by monthly volume — Creator $0.0012 → $0.0006, Pro $0.00195 → $0.000975, Business $0.0025 → $0.00125 (0% to 50% off across six bands: ≤100k, ≤1M, ≤5M, ≤10M, ≤50M, 50M+). Invoices may issue early at a per-account threshold (one example: $500).
- Effective subscription price: about $0.001 per credit on annual plans ($144/144,000), $0.0016 on monthly Creator.
- Credits never expire; packs and subscriptions share one balance with the API. Credit packs (prices "vary by active offer") grant commercial use and watermark-free exports but not paid-plan models, resolutions, upload caps or web concurrency.
- Free plan on the API: 480p video / 640px images only; only models flagged free; FAQ says free exports are 480p with a watermark and free clips are 3 s (web); API docs do not state an API watermark rule.
- Resolution gating is per tool, not one pixel cap. Fixed caps regardless of plan: AI Headshot 1,344 px; AI Clothes Changer 1,472 px; AI Talking Photo 720p; Video to Video and Animation 1,472 px (Video to Video also needs width and height divisible by 64).
- Commercial use requires a paid subscription, a credit-pack purchase or a usage-based agreement (terms of service, last revised 2026-10-03). You own the outputs "subject to these Terms and applicable law"; Magic Hour says it does not train on your content.
- Content rules (terms + help centre, apply to all tools): no sexual content involving minors; no sexually explicit or intimate content of a real person without consent (including AI likenesses); no adult content or gore in prompts or uploads; no impersonation; you must hold "the rights and consents required by law" for any person's face, voice or likeness; no hateful imagery, graphic violence, illegal activity, harassment, or copyrighted/trademarked material. Moderation is category-based and may false-positive; the API returns `content_policy_violation` on images; the FAQ says Text-to-Video has a word blocklist and the image generator screens prompts. Whether blocked jobs are refunded is not stated. Public figures, celebrities and deepfakes are not named as separate categories.

---

## 3. Video generation

All video create endpoints return `{id, credits_charged}` and are polled at `GET /v1/video-projects/{id}` (section 7.4).

### 3.1 Model table for text-to-video and image-to-video

Credits are per output second. "—" means the resolution is not offered. Reference columns apply to `POST /v1/text-to-video` only; the end-frame column applies to `POST /v1/image-to-video` only.

| Model | Resolutions | `end_seconds` grid | Aspect ratios (T2V) | Audio (`audio: true`) | End frame (I2V) | References (T2V) | 360p | 480p | 720p | 1080p | 4k | Plan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `kling-3.0` (paid default) | 720p, 1080p, 4k | any integer 3–15 | 9:16, 16:9, 1:1 | yes; +24/s at 720p and 1080p, +48/s at 4k | 720p, 1080p, 4k | images and videos; count not stated in API docs (web app: 1 video + up to 4 images) | — | — | 48 | 72 | 240 | paid |
| `ltx-2.5` (free default) | 480p, 720p, 1080p | any integer 1–60 | 9:16, 16:9, 1:1 | yes; included | 480p, 720p, 1080p | not documented | — | 24 | 48 | 72 | — | free (480p) and paid |
| `minimax-h3` | 480p, 720p, 1080p | any integer 1–30 | 16:9, 9:16, 1:1 | yes; included | 480p, 720p, 1080p | images, videos, audio | — | 24 | 48 | 72 | — | free (480p) and paid |
| `wan-3.0` | 480p, 720p, 1080p | 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30 | 16:9, 9:16, 1:1 | yes; included | 480p, 720p, 1080p | images, videos, audio | — | 48 | 96 | 180 | — | paid at every resolution |
| `wan-2.2` | 480p, 720p, 1080p | 3, 4, 5, 6, 7, 8, 9, 10, 15 | 9:16, 16:9, 1:1 | no | not supported | not documented | — | 24 | 48 | 72 | — | not stated |
| `gemini-omni-1.1` | 360p, 720p, 1080p, 4k | any integer 3–10 | 16:9, 9:16 | no | 360p, 720p, 1080p, 4k | images and videos, up to 10 | 48 | — | 144 | 192 | 384 | not stated |
| `kling-2.6` | 720p, 1080p | 5, 10 | 9:16, 16:9, 1:1 | no | 1080p only | not documented | — | — | 36 | 72 | — | not stated |
| `veo3.1` | 720p, 1080p | 4, 6, 8, 16, 24, 32, 40, 48, 56 | 9:16, 16:9 | yes; +24/s | 720p, 1080p; duration must be ≤ 8 s | images only, up to 3; requires `end_seconds` = 8 | — | — | 96 | 120 | — | not stated |
| `veo3.1-lite` | 720p, 1080p | 4, 6, 8, 16, 24, 32, 40, 48, 56 | 9:16, 16:9 | yes; +24/s | 720p, 1080p; duration ≤ 8 s | not documented | — | — | 48 | 72 | — | not stated |
| `seedance-1.5` | 480p, 720p, 1080p | any integer 4–12 | 9:16, 16:9, 1:1 | yes; 2× base rate | 480p, 720p, 1080p | not documented | — | 30 | 60 | 90 | — | not stated |
| `seedance-2.0-mini` | 480p, 720p | any integer 4–15 | 9:16, 16:9, 1:1 | yes; included | 480p, 720p | images, videos, audio | — | 48 | 120 | — | — | not stated |
| `seedance-2.0-fast` | 480p, 720p | any integer 4–15 | 9:16, 16:9, 1:1 | yes; included | 480p, 720p | images, videos, audio | — | 84 | 180 | — | — | paid (changelog) |
| `seedance-2.0` | 480p, 720p, 1080p, 4k | any integer 4–15 | 9:16, 16:9, 1:1 | yes; included | 480p, 720p, 1080p, 4k | images, videos, audio | — | 96 | 216 | 528 | 1104 | not stated |
| `seedance-2.5` | 480p, 720p, 1080p | any integer 4–30 | 9:16, 16:9, 1:1 | yes; included | 480p, 720p, 1080p | images, videos, audio | — | 168 | 336 | 840 | — | paid |
| `sora-2` | 720p | 4, 8, 12, 24, 36, 48, 60 | not found in docs | yes; included | not found in docs | not found in docs | — | — | 120 | — | — | not stated |

Video-reference rates (per output second, replacing the base and audio rate when a video is supplied in `references`):

| Model | 480p | 720p | 1080p | 4k |
| --- | --- | --- | --- | --- |
| `kling-3.0` | — | 96 | 144 | — |
| `seedance-2.0-mini` | 72 | 144 | — | — |
| `seedance-2.0-fast` | 96 | 216 | — | — |
| `seedance-2.0` | 96 | 216 | 672 | 1320 |
| `seedance-2.5` | 192 | 408 | 1008 | — |

Notes on the table:

- `default` resolves to `kling-3.0` on paid tiers and `ltx-2.5` on the free tier; the paid default does not support 480p.
- Legacy values still accepted but not documented: `ltx-2.3`, `ltx-2`, `kling-2.5` (routes to `kling-2.6`), `kling-1.6`, `seedance` (routes to `seedance-1.5`). `kling-2.5-audio` and `veo3.1-audio` equal the base model with `audio: true`.
- Cost = per-second rate × `end_seconds`; docs describe the underlying formula as duration × output fps × resolution multiplier, so `credits_charged` on create is an estimate corrected after render. Worked examples from the docs: `kling-3.0` 5 s 720p no audio = 240 credits (audio on = 360); `ltx-2.5` 5 s 480p = 120 credits.
- The docs do not say which models' audio is dialogue versus ambience; they give no dialogue prompt syntax. The UGC Ad endpoint (section 5.9), which exists to make a person speak a script, is restricted to `kling-3.0`, `ltx-2.5` and `veo3.1`.
- `end_seconds` has a global schema range of 1–60; per-model grids above are narrower.
- The models page notes "first/last-frame control" for `gemini-omni-1.1` and "end-frame control" for `wan-3.0` without further detail; the per-model end-frame column comes from the image-to-video schema.

### 3.2 `POST /v1/text-to-video`

Generates a clip from a prompt, optionally guided by named reference media.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `end_seconds` | yes | number | 1–60; must be on the model's grid (table 3.1) |
| `style.prompt` | yes | string | 1–20,000 chars; mention references as `@name` |
| `model` | no | enum | table 3.1; default `default` |
| `resolution` | no | enum | `360p`, `480p`, `720p`, `1080p`, `4k`; default 720p paid / 480p free |
| `aspect_ratio` | no | enum | `16:9`, `9:16`, `1:1`; per-model support in table 3.1 |
| `audio` | no | boolean | default false; per-model support and surcharge in table 3.1 |
| `references[]` | no | array | 1–10 items; each `{ name, file_path }`; `name` matches `^[A-Za-z][\w-]*$` (no `@`); every reference must be mentioned in the prompt and every mention must have an entry. Media types per model: images and videos (`gemini-omni-1.1` up to 10, `kling-3.0`), images+videos+audio (`minimax-h3`, `seedance-2.0`, `-mini`, `-fast`, `seedance-2.5`, `wan-3.0`), images only up to 3 (`veo3.1`, which then requires `end_seconds` = 8). Other models: not documented. |
| `name` | no | string | default `Text To Video - dateTime` |

No start-frame or end-frame field. Cost: table 3.1. Returns `{id, credits_charged}`. Policy: prompt blocklist (FAQ) and the general content rules in section 2.

### 3.3 `POST /v1/image-to-video`

Animates a still image, optionally pinning the last frame.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.image_file_path` | yes | string | start image; docs recommend ≥ 720p source |
| `assets.end_image_file_path` | no | string | last-frame image; supported models and resolutions in table 3.1; Veo models need duration ≤ 8 s; `wan-2.2` unsupported; `sora-2` not stated |
| `end_seconds` | yes | number | 1–60 on the model's grid |
| `model` | no | enum | same enum as text-to-video; default `default` |
| `resolution` | no | enum | `360p`, `480p`, `720p`, `1080p`, `4k`; default 720p paid / 480p free |
| `audio` | no | boolean | default false |
| `style.prompt` | no | string | motion prompt; no length limit stated |
| `name` | no | string | default `Image To Video - dateTime` |

No `references` array and no `aspect_ratio` field (output aspect follows the input image; the docs do not state the rule). Input image size limits: not found in docs. Cost: table 3.1 (same rates as text-to-video; video-reference rates do not apply).

### 3.4 `POST /v1/video-to-video`

Restyles existing footage with a preset art style (diffusion restyle, not a prompt-edit).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_source` | yes | enum | `file`, `youtube` |
| `assets.video_file_path` | if `file` | string | input video |
| `assets.youtube_url` | if `youtube` | uri | YouTube link |
| `start_seconds` | yes | number | ≥ 0 |
| `end_seconds` | yes | number | ≥ 0.1 and > `start_seconds`; no maximum stated |
| `fps_resolution` | no | enum | `FULL` (keep input fps), `HALF` (default) |
| `style.art_style` | yes | enum | 75 presets: Minecraft, Watercolor, Pixel, Retro Sci-Fi, Lego, Origami, Ghost, Sub-Zero, Studio Ghibli, Comic, Impressionism, Master Chief, Solid Snake, Street Fighter, Hologram, GTA, Clay, Mystique, Dragonball Z, Mario, Samurai, Spartan, Boba Fett, 3D Render, Airbender, Android, Anime Warrior, Armored Knight, Assassin's Creed, Avatar, Black Spiderman, Bold Anime, Celestial Skin, Chinese Swordsmen, Cyberpunk, Cypher, Dark Fantasy, Future Bot, Futuristic Fantasy, Ghibli Anime, Gundam, Illustration, Ink, Ink Poster, Jinx, Knight, Link, Marble, Mech, Naruto, Neon Dream, No Art Style, Oil Painting, On Fire, Painterly Anime, Pixar, Power Armor, Power Ranger, Radiant Anime, Realistic Anime, Realistic Pixar, Retro Anime, Samurai Bot, Sharp Anime, Soft Anime, Starfield, The Void, Tomb Raider, Underwater, Van Gogh, Viking, Western Anime, Wu Kong, Wuxia Anime, Zelda |
| `style.version` | no | enum | `v1` (more detail, closer prompt adherence), `v2` (faster, more consistent), `default`; Studio Ghibli needs `v2` set explicitly |
| `style.prompt_type` | no | enum | `default` (style's recommended prompt; `prompt` ignored), `custom`, `append_default` |
| `style.prompt` | if custom/append | string | nullable |
| `style.model` | no | enum | `Dreamshaper`, `Absolute Reality`, `Flat 2D Anime`, `Soft Anime`, `Kaywaii`, `Western Anime`, `3D Anime`, `default` |
| `name` | no | string | default `Video To Video - dateTime` |

Output size follows the input and plan (longest edge ≤ 1,472 px, width and height divisible by 64; `width`/`height` fields are deprecated). Cost: 48 credits per second at 24 fps, i.e. 2 credits per rendered frame (FAQ: "2 credits per image"); per-frame estimate then settle.

### 3.5 `POST /v1/ai-video-editor`

Prompt-driven edit of an existing clip (object removal, scene changes, colour and lighting, restyle). The docs do not mention reframing, outpainting, camera moves or extension.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_file_path` | yes | string | one input video; no image or audio inputs |
| `style.prompt` | yes | string | ≥ 1 char |
| `start_seconds` | no | number | ≥ 0; default 0 |
| `end_seconds` | yes | number | > `start_seconds`; `gemini-omni-1.1` 3–10 s; `ltx-2.5` 0.5–60 s (30 s at 1080p) |
| `model` | no | enum | `gemini-omni-1.1` (720p, 1080p; paid default), `ltx-2.5` (480p, 720p, 1080p; free default), `gemini-omni` (deprecated → 1.1), `ltx-2.3` (→ 2.5) |
| `resolution` | no | enum | `480p`, `720p`, `1080p`; default 720p paid / 480p free |
| `name` | no | string | default `Video Editor - dateTime` |

Cost: not found in docs (the models page omits it; the web changelog says Gemini Omni editing carries a 6× credit multiplier). Per-frame billing.

### 3.6 `POST /v1/audio-to-video`

Generates a video whose length matches an audio segment, optionally from a first-frame image and a prompt. The docs do not say whether speech is lip-synced; the underlying model is not named (web app used LTX 2.3).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.audio_file_path` | yes | string | audio input |
| `assets.image_file_path` | no | string | reference image for the first frame |
| `style.prompt` | no | string | visual guidance |
| `start_seconds` | no | number | ≥ 0; default 0 |
| `end_seconds` | yes | number | ≥ 0.1; no maximum stated (web app: up to 60 s) |
| `resolution` | no | enum | `480p`, `720p`, `1080p`; default 720p paid / 480p free |
| `name` | no | string | default `Audio To Video - dateTime` |

Cost: 24 / 48 / 72 credits per second at 480p / 720p / 1080p.

### 3.7 `POST /v1/animation`

Stylised, morphing "stop-motion" animation from a prompt, an optional start image and optional audio (with audio-reactive camera effects).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `fps` | yes | number | ≥ 1; no maximum stated (examples 8–12) |
| `end_seconds` | yes | number | ≥ 0.1; audio must be at least this long |
| `width`, `height` | yes | integer | ≥ 64 each; maximum per plan, capped at 1,472 px longest edge |
| `style.art_style` | yes | enum | 47 values incl. `Custom`, Painterly Illustration, Vibrant Matte Illustration, Traditional Watercolor, Cyberpunk, 3D Render, Old School Comic, Synthwave, Futuristic Anime, Cinematic Miyazaki, Studio Ghibli Film Still, Cinematic Landscape, Photograph, Jackson Pollock, Cubist, Impressionism, Van Gogh, Woodcut, Oil Painting, Vintage Japanese Anime, Pixar, Cosmic, Pixel Art, Fantasy, Arcane, Sin City, Double Exposure, Low Poly, Art Deco, Inkpunk, Dark Watercolor, Directed by AI, and others |
| `style.art_style_custom` | if `Custom` | string | free-text style |
| `style.camera_effect` | yes | enum | 52 values incl. Simple Zoom In/Out, Dramatic Zoom In/Out, Pan Left, Pan Right, Tilt Up, Tilt Down, Slideshow, Vertigo, Heartbeat, Road Trip, Traverse, Accelerate, Speed of Light, Tron, and audio-synced variants (Zoom In - Audio Sync, Pulse - Audio Sync, Evolve - Audio Sync, …), Directed by AI |
| `style.prompt_type` | yes | enum | `custom`, `use_lyrics`, `ai_choose` (the last two need audio) |
| `style.prompt` | if custom | string | |
| `style.transition_speed` | yes | integer | 1–10 |
| `assets.audio_source` | yes | enum | `none`, `file`, `youtube` |
| `assets.audio_file_path` | if `file` | string | |
| `assets.youtube_url` | if `youtube` | uri | |
| `assets.image_file_path` | no | string | first frame |
| `name` | no | string | default `Animation - dateTime` |

Cost: 24 credits per second at 24 fps, i.e. 1 credit per frame; frames ≈ `fps` × `end_seconds`, estimated then settled.

---

## 4. Image generation and editing

All image create endpoints return `{id, credits_charged}` and are polled at `GET /v1/image-projects/{id}` (section 7.4). Credits are charged on request and refunded on error; image jobs cannot be cancelled.

### 4.1 Image model table (generator and editor)

"From" is the price of one image at the model's lowest resolution; per-resolution prices are not listed anywhere in the docs, only that cost "depends on model, resolution and image count" (one example: `nano-banana-2.1` is 50 credits for one image at 640px or 1k and 150 credits for a 4-, 9- or 16-image grid). Free plan: 640px only.

| Model | Generate | Edit | Resolutions | From (credits/image) | Plans | Generator `image_count` | Editor max additional input images |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `flux-schnell` | yes | — | 640px, 1k, 2k | 5 | free+ | 1, 2, 3, 4 | — |
| `flux-2-klein` | yes | yes | 640px, 1k, 2k | 5 | free+ | 1 | 5 |
| `z-image-turbo` | yes | — | 640px, 1k, 2k | 5 | free+ | 1, 2, 3, 4 | — |
| `krea-2` | yes | yes | 640px, 1k | 10 | free+ | 1 | 1 |
| `qwen-edit` | — | yes | 640px, 1k, 2k | 10 | free+ | — | 2 |
| `qwen-image-2.1` | yes | yes | 640px, 1k, 2k | 10 | free+ | 1, 2, 3, 4 | 2 |
| `seedream-v4` | yes | yes | 640px, 1k, 2k, 4k | 40 | creator+ | 1, 2, 3, 4 | 9 |
| `seedream-v4.5` | — | yes | 640px, 1k, 2k, 4k | 50 | creator+ | — | 9 |
| `seedream-v5-pro` | yes | yes | 640px, 1k, 2k | 75 | creator+ | 1, 2, 3, 4 | 9 |
| `nano-banana` | yes | yes | 640px, 1k | 50 | creator+ | 1, 2, 3, 4 | 9 |
| `nano-banana-2-lite` | yes | yes | 640px, 1k | 50 | creator+ | 1, 2, 3, 4 | 9 |
| `nano-banana-2` | yes | yes | 640px, 1k, 2k, 4k | 100 | creator+ | 1, 4, 9, 16 | 9 |
| `nano-banana-2.1` | yes | yes | 640px, 1k, 2k, 4k | 50 | creator+ | 1, 4, 9, 16 | 9 |
| `nano-banana-pro` | yes | yes | 1k, 2k, 4k | 150 | creator+ | 1, 4, 9, 16 | 9 |
| `gpt-image-2` | yes | yes | 640px, 1k, 2k, 4k | 50 | creator+ | 1, 2, 3, 4 | 9 |
| `gpt-image-2.5-flare` | yes | yes | 640px, 1k, 2k, 4k | 100 | creator+ | 1, 2, 3, 4 | 9 |

`default` = "the recommended model, which changes over time" (may need a paid plan). `seedream` is deprecated (use `seedream-v4`). Resolution values: `640px` (longest edge ≤ 640), `1k` (≤ 1,024), `2k` (≤ 2,048), `4k` (≤ 4,096), `auto` (deprecated; server picks the best the model and plan allow). Calculator starting prices in dollars (Business annual credits): Flux 2 Klein / Z-Image Turbo / Flux Schnell $0.005, Qwen Edit / Krea 2 $0.009, Seedream 4 $0.038, GPT Image 2 / Nano Banana / Nano Banana 2 Lite / Seedream 4.5 $0.047, Seedream 5 Pro $0.071, Nano Banana 2 / GPT Image 2.5 Flare $0.094, Nano Banana Pro $0.141 per image.

### 4.2 `POST /v1/ai-image-generator`

Text-to-image; no input images.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `image_count` | yes | integer | 1–16; per-model set in table 4.1 |
| `style.prompt` | yes | string | ≥ 1 char; no maximum stated |
| `style.tool` | no | enum | 37 art-style tools: `general` (default), `ai-anime-generator`, `ai-art-generator`, `ai-background-generator`, `ai-character-generator`, `ai-face-generator`, `ai-fashion-generator`, `ai-icon-generator`, `ai-illustration-generator`, `ai-interior-design-generator`, `ai-landscape-generator`, `ai-logo-generator`, `ai-manga-generator`, `ai-outfit-generator`, `ai-pattern-generator`, `ai-photo-generator`, `ai-sketch-generator`, `ai-tattoo-generator`, `album-cover-generator`, `animated-characters-generator`, `architecture-generator`, `book-cover-generator`, `comic-book-generator`, `dark-fantasy-ai`, `disney-ai-generator`, `dnd-ai-art-generator`, `emoji-generator`, `fantasy-map-generator`, `graffiti-generator`, `movie-poster-generator`, `optical-illusion-generator`, `pokemon-generator`, `south-park-character-generator`, `superhero-generator`, `thumbnail-maker` |
| `model` | no | enum | table 4.1 generate column; default `default` |
| `aspect_ratio` | no | enum | `1:1` (default), `16:9`, `9:16` |
| `resolution` | no | enum | `auto` (deprecated default), `640px`, `1k`, `2k`, `4k` |
| `name` | no | string | default `Ai Image - dateTime` |

Cost: table 4.1. Policy: prompts are screened; `content_policy_violation` possible. No character/identity reference input.

### 4.3 `POST /v1/ai-image-editor`

Prompt edit of one or more images (also the documented way to compose a still for the UGC Ad endpoint).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.image_file_paths[]` | yes in practice | array of string | up to 10 images; per-model cap on additional inputs in table 4.1 (1, 2, 5 or 9); inputs ≥ 512×512 px recommended; how to address individual images in the prompt is not documented (web app shows numbered labels) |
| `style.prompt` | yes | string | 1–15,000 chars |
| `image_count` | no | enum | 1, 4, 9, 16 (default 1) |
| `model` | no | enum | table 4.1 edit column; default `default` |
| `aspect_ratio` | no | enum | `auto` (default), `16:9`, `9:16`, `4:3`, `3:2`, `1:1`, `4:5`, `2:3` |
| `resolution` | no | enum | `auto`, `640px`, `1k`, `2k`, `4k` |
| `name` | no | string | default `Ai Image Editor - dateTime` |

Cost: table 4.1 (from 5 credits with `flux-2-klein`; response example 5).

### 4.4 `POST /v1/image-background-remover`

Removes the background; optionally composites onto a new background.

| Field | Req | Type | Notes |
| --- | --- | --- | --- |
| `assets.image_file_path` | yes | string | subject image |
| `assets.background_image_file_path` | no | string | resized to match the subject image, so use similar resolutions |
| `name` | no | string | default `Background Remover - dateTime` |

Cost: 5 credits per image. Output size: per plan. Input limits: not found in docs.

### 4.5 `POST /v1/photo-colorizer`

Colorizes a black-and-white image. Fields: `assets.image_file_path` (required), `name`. Cost: 10 credits per image. Limits: not found in docs.

### 4.6 `POST /v1/ai-gif-generator`

Short looping animation from a prompt (no inputs).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `style.prompt` | yes | string | 1–500 chars |
| `output_format` | no | enum | `gif` (default), `mp4`, `webm` |
| `name` | no | string | default `Ai Gif - dateTime` |

Cost: 50 credits per GIF. Output up to 1,024×1,024 (2025 changelog). Duration and fps: not found in docs. Polled as an image project.

### 4.7 `POST /v1/ai-meme-generator`

Captioned meme from a topic and a template.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `style.topic` | yes | string | 1–200 chars |
| `style.template` | yes | enum | about 100 named templates (Drake Hotline Bling, Distracted Boyfriend, This Is Fine, Surprised Pikachu, …) or `Random` |
| `style.searchWeb` | no | boolean | default false (SDK name `search_web`) |
| `name` | no | string | |

Cost: 10 credits per meme.

### 4.8 `POST /v1/ai-qr-code-generator`

Stylised QR code. Fields: `content` (required, the encoded string), `style.art_style` (required; free text, 12 suggested templates: Watercolor, Cyberpunk City, Ink Landscape, Interior Painting, Japanese Street, Mech, Minecraft, Picasso Painting, Game Map, Spaceship, Chinese Painting, Winter Village), `name`. Cost: 0 credits.

---

## 5. Faces and people

### 5.1 `POST /v1/face-swap` (face swap video)

Swaps one or more faces throughout a video or GIF.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_source` | yes | enum | `file`, `youtube` |
| `assets.video_file_path` | if `file` | string | video, or gif/webp/webm animation |
| `assets.youtube_url` | if `youtube` | uri | |
| `assets.face_swap_mode` | no | enum | `all-faces` (default; one source image replaces every face), `individual-faces` (explicit mappings) |
| `assets.image_file_path` | if all-faces | string | source face; docs recommend ≥ 512×512 face area, front-facing, unoccluded (the mode description calls this field `source_file_path`; the schema uses `image_file_path`) |
| `assets.face_mappings[]` | if individual | array ≤ 5 | `{ original_face, new_face }`; `original_face` is a path from face detection in the form `<frame>-<index>.png`; `new_face` is a portrait |
| `start_seconds` | yes | number | ≥ 0 |
| `end_seconds` | yes | number | ≥ 0.1, > start |
| `style.version` | no | enum | `v1` (skin texture, weaker identity), `v2` (faster, sharper, better hair/glasses, stronger identity), `default` |
| `name` | no | string | default `Face Swap - dateTime` |

Cost: 24 credits per second at 24 fps (1 credit per rendered frame; estimate then settle). Output size follows plan longest-edge limits; resolution does not change cost. Frame cap 100,000 frames (2025 changelog). Policy: consent for real people's likeness (section 2).

### 5.2 `POST /v1/face-swap-photo`

Swaps faces in a still image. `assets.target_file_path` (required), `assets.face_swap_mode` (`all-faces` default with `assets.source_file_path`, or `individual-faces` with `assets.face_mappings[]` ≤ 5 as in 5.1), `name`. Cost: 10 credits per image (FAQ: more at 2K and 4K on the web; API price for larger outputs not found in docs). Output size per plan.

### 5.3 `POST /v1/face-detection` and `GET /v1/face-detection/{id}`

Detects faces in an image or video so you can build `face_mappings`.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.target_file_path` | yes | string | image or video |
| `confidence_score` | no | number | 0–1 in steps of 0.05; default 0.5 |

Returns `{id, credits_charged}`; the GET returns `{ id, credits_charged, status (queued, rendering, complete, error), faces[] }` where each face has `path` (use as `original_face`) and `url` (preview). Cost: "free to use for the near future".

### 5.4 `POST /v1/head-swap`

Places a head from one image onto a body from another. `assets.body_file_path` and `assets.head_file_path` (required), `max_resolution` (integer, longest edge; omit for plan max, clamped to ≤ 2,048), `name`. Cost: 10 credits per image.

### 5.5 `POST /v1/body-swap`

Places a person into a scene image (Nano Banana 2 Lite at 640px/1k, Nano Banana 2 at 2k/4k). `assets.person_file_path`, `assets.scene_file_path` (required), `resolution` (required: `640px`, `1k`, `2k`, `4k`), `name`. Cost: 50 credits at 640px; 1k/2k/4k prices not found in docs ("50+").

### 5.6 `POST /v1/ai-clothes-changer`

Replaces an outfit using a garment photo. `assets.person_file_path`, `assets.garment_file_path` (required), `assets.garment_type` (`entire_outfit` default, `upper_body`, `lower_body`, `dresses` deprecated), `name`. Cost: 25 credits per image. Output cap 1,472 px.

### 5.7 `POST /v1/ai-face-editor`

Adjusts facial geometry with sliders. `assets.image_file_path` (required); `style.enhance_face` (boolean, default false) and 15 numeric sliders, each −100 to 100 in steps of 5, default 0: `eyebrow_direction`, `eye_gaze_horizontal`, `eye_gaze_vertical`, `eye_open_ratio`, `lip_open_ratio`, `head_roll`, `head_pitch`, `head_yaw`, `mouth_grim`, `mouth_pout`, `mouth_purse`, `mouth_smile`, `mouth_position_horizontal`, `mouth_position_vertical`. Cost: 1 credit per edit. Output size per plan.

### 5.8 `POST /v1/ai-headshot-generator`

Professional headshot from one photo. `assets.image_file_path` (required; exactly one detectable face), `style.prompt` (optional; docs recommend omitting), `name`. Cost: 50 credits per headshot. Output cap 1,344 px.

### 5.9 `POST /v1/ai-ugc-ad`

Spoken "UGC" clip: an actor image plus a script the actor speaks (text in, speech out; no audio file input, no voice choice field).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.image_file_path` | yes | string | prepared image (compose with the image editor first) |
| `script` | yes | string | ≥ 1 char; max after trimming: `kling-3.0` 2,304, `ltx-2.5` 1,804, `veo3.1` 2,500 (dialogue wrappers count toward the model prompt limit) |
| `end_seconds` | yes | number | `kling-3.0` 3–15 (integers); `ltx-2.5` 1–10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60; `veo3.1` 4, 6, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 106, 113, 120, 127, 134, 141; free plans capped at 5 s unless a credit pack was bought |
| `model` | no | enum | `kling-3.0` (paid default), `ltx-2.5` (free default), `veo3.1` |
| `resolution` | no | enum | `480p`, `720p`, `1080p`; default 720p paid / 480p free; unsupported model/plan combinations are rejected (matrix not documented) |

Cost: not found in docs (not on the models page). Voice used for the script: not documented.

### 5.10 `POST /v1/ai-talking-photo`

Makes a still portrait speak an audio track.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.image_file_path` | yes | string | front-facing portrait, ≥ 512×512 recommended |
| `assets.audio_file_path` | yes | string | speech (generate it first with the voice generator or cloner) |
| `start_seconds`, `end_seconds` | yes | number | segment of the audio; max clip 300 s (`realistic`) or 60 s (`prompted`); free account without a pack: 10 s (help centre) |
| `style.generation_mode` | no | enum | `realistic` (default; best likeness), `prompted` (scene guided by `style.prompt`, lower likeness); deprecated `pro`, `stable` (→ realistic), `standard`, `expressive` (→ prompted) |
| `style.prompt` | no | string | only used in `prompted` mode |
| `resolution` | no | enum | `480p`, `720p`; prompted defaults to 480p; realistic maps plan maximum (< 1,280 px → 480p, ≥ 1,280 → 720p); overrides deprecated `max_resolution` |
| `name` | no | string | default `Talking Photo - dateTime` |

Cost: 20 credits per second (`prompted`), 48 credits per second (`realistic`); per-frame estimate then settle. Fixed output cap 720p.

### 5.11 `POST /v1/lip-sync`

Re-animates the mouth of a person in an existing video to match new audio.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.audio_file_path` | yes | string | any supported audio format; clear single-speaker speech |
| `assets.video_source` | yes | enum | `file`, `youtube` |
| `assets.video_file_path` | if `file` | string | FAQ: MP4/MOV up to 4K (web) |
| `assets.youtube_url` | if `youtube` | uri | |
| `start_seconds`, `end_seconds` | yes | number | ≥ 0 / ≥ 0.1, end > start; frame cap 120,000 frames (2025 changelog); help centre: up to 30 minutes for standard and pro |
| `max_fps_limit` | no | number | ≥ 1; caps output fps (input fps kept if lower); lowering it lowers cost |
| `style.generation_mode` | no | enum | `lite` (default, 1 credit/frame), `standard` (1 credit/frame; needs visible mouth movement in the opening seconds), `pro` (2 credits/frame; same requirement; Creator, Pro, Business only) |
| `name` | no | string | default `Lip Sync - dateTime` |

Cost: 1 credit per rendered frame (`lite`, `standard`), 2 per frame (`pro`); example from docs: 10 s at 30 fps in `lite` ≈ 300 credits. Output resolution follows the input and plan. Still images must go through talking photo instead.

### 5.12 `POST /v1/character-replace`

Replaces a person in a video with a character from a reference image, or transfers the video's motion onto the character.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_file_path` | yes | string | source video |
| `assets.image_file_path` | yes | string | reference character image |
| `start_seconds` | no | number | ≥ 0; default 0 |
| `end_seconds` | yes | number | > start; `kling-3.0` replace 3–10 s, animate 3–30 s; `minimax-h3` 1–60 s; `wan-animate` up to 60 s |
| `model` | no | enum | `wan-animate` (default; 480p, 720p), `kling-3.0` (720p, 1080p), `minimax-h3` (480p, 720p, 1080p) |
| `resolution` | no | enum | `480p`, `720p`, `1080p`; default lowest the plan allows for the model; 720p/1080p need a paid plan |
| `style.mode` | no | enum | `replace` (default), `animate` |
| `style.prompt` | no | string | ≤ 2,000 chars; `kling-3.0` and `minimax-h3` only |
| `style.selection_mode` | no | enum | `auto` (default), `point` (`wan-animate` both modes; `minimax-h3` replace only, 422 in animate; `kling-3.0` rejects points) |
| `style.points[]` | if `point` | array | `{ position_x ≥ 0, position_y ≥ 0, time_seconds ≥ 0 }` in source-frame pixels and source timeline |
| `name` | no | string | default `Character Replace - dateTime` |

Cost per output second: `wan-animate` 48 (480p) / 96 (720p); `kling-3.0` 48 (720p) / 72 (1080p); `minimax-h3` 24 / 48 / 72 (480p / 720p / 1080p).

---

## 6. Audio

Audio create endpoints return `{id, credits_charged}` and are polled at `GET /v1/audio-projects/{id}` (section 7.4).

### 6.1 `POST /v1/ai-voice-generator`

Text-to-speech with a fixed preset voice.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `style.prompt` | yes | string | 1–1,000 chars; punctuation drives pacing |
| `style.voice_name` | yes | enum | a fixed list of several hundred names, taken verbatim from the endpoint page: real people (e.g. Elon Musk, Barack Obama, Donald Trump, Morgan Freeman, Taylor Swift, David Attenborough, Gordon Ramsay, Joe Rogan, Mark Zuckerberg, Vladimir Putin, Queen Elizabeth II, Winston Churchill, Albert Einstein, Marilyn Monroe), fictional and animated characters (Homer Simpson, Darth Vader, Shrek, Mario, Goku, GLaDOS, HAL 9000), streamers and athletes (MrBeast, PewDiePie, LeBron James, Cristiano Ronaldo); example value `Elon Musk` |
| `name` | no | string | default `Voice Generator - dateTime` |

No language, descriptor, speed, emotion or custom-voice parameter. Named real people are offered, not refused; two presets (Dove Cameron, Davido) were removed on 2026-10-23 and now fail validation; the web app's Characters feature dropped celebrity presets on 2026-10-13 and defaults to a curated voice "Ashley" (not visible in the API enum). Cost: 0.1 credit per character of `prompt`, rounded up (19 chars → 2 credits; 1,000 chars → 100 credits). Output format: not stated (example download `.wav`). Audio error codes: `text_too_long`, `invalid_voice`.

### 6.2 `POST /v1/ai-voice-cloner`

Text-to-speech in a voice cloned from a reference sample (not speech-to-speech).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.audio_file_path` | yes | string | reference sample: ≥ 3 s, one speaker, clean, conversational; longer clean samples improve quality; format list not stated beyond supported audio types |
| `style.prompt` | yes | string | 1–1,000 chars to speak |
| `name` | no | string | default `Voice Cloner - dateTime` |

No persistent voice id is returned; each request sends its own sample (the web app can save cloned voices, and `GET /v1/saved-items?type=voice` exposes saved voices with a `file_path`). No language parameter. Cost: 0.1 credit per character, rounded up. Consent: terms require the rights and consents the law demands for a person's voice; no API-side refusal rule is documented.

### 6.3 `POST /v1/ai-music-generator`

Music from a text description, with optional lyrics or instrumental output.

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `duration` | yes | integer | 15–300 seconds |
| `style.prompt` | yes | string | genre, mood, instruments; no max stated |
| `style.lyrics` | no | string | custom lyrics; omit for AI lyrics; ignored when instrumental |
| `style.instrumental` | no | boolean | default false |
| `name` | no | string | default `AI Music Generator` |

`additionalProperties: false` (unknown fields rejected). Cost: 1 credit per requested second (15–300 credits). Output format, number of tracks, lyric languages: not stated.

### 6.4 `POST /v1/auto-subtitle-generator`

Transcribes speech and burns timed subtitles into the video (no SRT/VTT export, no translation, no language parameter).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_file_path` | yes | string | file only (no YouTube field) |
| `start_seconds`, `end_seconds` | yes | number | ≥ 0 / ≥ 0.1, end > start |
| `style.template` | one of template/custom | enum | `karaoke`, `cinematic`, `minimalist`, `highlight` |
| `style.custom_config` | one of template/custom | object | `font` (Google Fonts family), `font_size` (px; auto from resolution if omitted), `font_style` (e.g. `normal`, `italic`, `bold`), `text_color` (hex), `highlighted_text_color`, `stroke_color`, `stroke_width` (px), `vertical_position` (e.g. `top`, `center`, `bottom`), `horizontal_position` (e.g. `left`, `center`, `right`). Fields override the template; without a template `font`, `text_color`, `vertical_position`, `horizontal_position` are required. Allowed values for style/position fields are not enumerated. |
| `name` | no | string | default `Auto Subtitle - dateTime` |

Cost: about 4.8 credits per second at 24 fps (0.2 credits per frame; estimate then settle). Supported languages: "multiple", not listed.

### 6.5 `POST /v1/ai-video-translator`

Translates the speech in a short clip into another language (dubbing).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_file_path` | yes | string | |
| `start_seconds` | no | number | ≥ 0; default 0 |
| `end_seconds` | yes | number | clip must be 1–30 s |
| `target_language` | yes | enum | 53 names: English, Chinese (Simplified), Chinese (Traditional), Hindi, Spanish, Arabic, French, Afrikaans, Bengali, Bulgarian, Catalan, Croatian, Czech, Danish, Dutch, Estonian, Finnish, German, Greek, Gujarati, Hebrew, Hungarian, Indonesian, Italian, Japanese, Kannada, Kazakh, Korean, Latvian, Lithuanian, Malay, Malayalam, Marathi, Norwegian, Persian, Polish, Portuguese, Punjabi, Romanian, Russian, Serbian, Slovak, Slovenian, Swahili, Swedish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, Vietnamese, Welsh |
| `resolution` | no | enum | `480p` (default), `720p`, `1080p` (paid) |
| `name` | no | string | default `Video Translator - dateTime` |

Lip sync of the dubbed audio: not mentioned. Voice preservation: not mentioned. Cost: not found in API docs (the web Create flow charges 48 credits per processed second, changelog 2026-08-20).

### 6.6 `GET /v1/audio-projects/{id}` and `DELETE /v1/audio-projects/{id}`

GET returns `{ id, name, status, type, created_at, enabled, credits_charged, downloads[], error }`. `type` values listed: `VOICE_GENERATOR`, `VOICE_CLONER`, `MUSIC_GENERATOR`, plus web-app-only `AUDIO_TRANSLATOR`, `VOICE_CHANGER`, `VIDEO_TO_AUDIO`, `SOUND_EFFECT_GENERATOR`. DELETE returns 204 and is irreversible.

Audio tools with no API endpoint (web app only): voice changer (speech-to-speech), sound effect generator (up to 60 s, launched 2026-09-18), audio translator, video-to-audio.

---

## 7. Utilities

### 7.1 `POST /v1/ai-image-upscaler`

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.image_file_path` | yes | string | input ≤ 4,096×4,096 px |
| `scale_factor` | yes | number | `2` or `4` (4× needs Creator, Pro or Business) |
| `style.mode` | no | enum | `preserve` (fast pipeline, 1×), `balanced` (default; creative pipeline, 2×), `creative` (2×; only mode that uses `style.prompt`), `pro` (deprecated → preserve) |
| `style.prompt` | no | string | creative mode only |
| `name` | no | string | default `Image Upscaler - dateTime` |

Cost per image: 2× preserve 25, 2× balanced/creative 50, 4× preserve 100, 4× balanced/creative 200.

### 7.2 `POST /v1/ai-video-upscaler`

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `assets.video_file_path` | yes | string | ≤ 4,000 frames, ≤ 30 fps (changelog 2026-10-20) |
| `start_seconds` | no | number | ≥ 0; default 0 |
| `end_seconds` | yes | number | > start |
| `resolution` | yes | enum | `720p`, `1080p` (sets the short side), `2k`, `4k` (sets the long side); aspect ratio preserved; paid plans only; a target at or below the source may return the clip unchanged while still charging |
| `name` | no | string | default `Video Upscaler - dateTime` |

Cost: not found in docs.

### 7.3 `POST /v1/files/upload-urls`

Returns pre-signed PUT URLs for Magic Hour storage (optional; direct URLs work without it).

| Field | Req | Type | Allowed values / constraints |
| --- | --- | --- | --- |
| `items[]` | yes | array ≥ 1 | each `{ type: video \| audio \| image, extension }`; `extension` matches `^[a-z0-9]+$`, no dot; see the format table in section 1; no item maximum stated |

Response `items[]` of `{ upload_url, expires_at, file_path }` in request order. Upload with `PUT <upload_url>` and the raw bytes as the body (no Content-Type needed); upload shortly before use; the URL lifetime is given only by `expires_at`. Size limits per plan: Free 200 MB, Creator 2 GB, Pro 5 GB, Business 10 GB (a search snippet of an older help-centre revision showed 100 MB / 1 GB / 2 GB / 3 GB; the live article shows the larger figures). Not charged.

### 7.4 Project status and deletion

| Endpoint | Returns |
| --- | --- |
| `GET /v1/video-projects/{id}` | `id`, `name`, `status`, `type`, `created_at`, `width`, `height` (−1 = ignore), `enabled`, `start_seconds`, `end_seconds`, `credits_charged` (estimate until complete), `fps` (estimate until complete), `error { code, message }`, `downloads[] { url, expires_at }` |
| `GET /v1/image-projects/{id}` | `id`, `name`, `status`, `type`, `image_count`, `created_at`, `enabled`, `credits_charged`, `error`, `downloads[]` |
| `GET /v1/audio-projects/{id}` | as in 6.6 |
| `DELETE /v1/video-projects/{id}`, `DELETE /v1/image-projects/{id}`, `DELETE /v1/audio-projects/{id}` | 204; permanent; no refund or cancellation semantics documented |

Video `type` values: ANIMATION, AUTO_SUBTITLE, VIDEO_TO_VIDEO, FACE_SWAP, TEXT_TO_VIDEO, IMAGE_TO_VIDEO, LIP_SYNC, TALKING_PHOTO, VIDEO_UPSCALER, VIDEO_EDITOR, CHARACTER_REPLACE, VIDEO_TRANSLATOR, AUDIO_TO_VIDEO, UGC_AD, and web-app-only AVATAR, VIDEO_COLORIZER, VIDEO_WATERMARK_REMOVER, VIDEO_COLOR_GRADER, MUSIC_VIDEO, EXTEND, VIDEO_EXPANDER. Image `type` values include web-app-only GENERATIVE_FILL, AI_SELFIE, AI_INFLUENCER, IMAGE_ENHANCER, PHOTO_EDITOR, IMAGE_COLOR_GRADER, STORYBOARD, IMAGE_EXPANDER.

### 7.5 `GET /v1/saved-items`

Lists reusable assets saved in the web app. Query: `type` (`character`, `reference`, `voice`, `moodboard`, `brand_kit`), `limit` (1–100, default 20), `cursor`. Returns `items[] { id, type, name, assets[] { file_path, media_kind (IMAGE | VIDEO | AUDIO), is_primary, url (24 h signed), url_expires_at } }` and `next_cursor`. `file_path` values are durable and can be passed to "a compatible API asset field instead of re-uploading"; the docs do not list which fields. There is no API to create saved items.

### 7.6 `GET /v1/account`

No parameters. Returns `id`, `email`, `tier` (`free`, `creator`, `pro`, `business`; `free` when past due), `credits` (balance incl. packs), `subscription` (null for free, pack-only and usage-based accounts) with `name`, `status` (`active`, `past_due`), `price { amount (minor units), currency }`, `discount { percent_off, amount_off }`, `billing_interval` (`month`, `year`, null), `current_period_end`, `cancel_at_period_end`.

### 7.7 Webhooks

Registered in the Developer Hub (no API), one public HTTPS URL per webhook, events selected at creation, secret shown once.

| Event | Fires when | Payload (`type` + `payload`) |
| --- | --- | --- |
| `video.started` / `image.started` / `audio.started` | job moves to rendering (fast image modes may skip it) | the project-details object (`id`, `status`, `type`, `created_at`, `width`, `height` or `image_count`, `credits_charged`, `downloads`, `error`) |
| `video.completed` / `image.completed` / `audio.completed` | render succeeded | `id`, `status: "complete"`, `type`, `credits_charged`, `downloads[] { url, expires_at }`, `error: null` |
| `video.errored` / `image.errored` / `audio.errored` | render failed | `id`, `status: "error"`, `downloads: []`, `error { code, message }` |

No event fires on cancellation (poll for `canceled`). Signature: headers `magic-hour-event-signature` (HMAC-SHA256 hex) and `magic-hour-event-timestamp` (Unix seconds); signed string is `{timestamp}.{raw_body}`; verify with a constant-time compare and reject timestamps outside ±300 s. Return 2xx. Retry policy, timeouts and payload size limits: not found in docs.

---

## 8. Processing times (median of successful API jobs, Aug–Oct 2026, not an SLA)

| Endpoint | p50 | Endpoint | p50 |
| --- | --- | --- | --- |
| text-to-video | 25 s | ai-image-generator | 4 s |
| image-to-video | 33 s | ai-image-editor | 10 s |
| ai-talking-photo | 41 s | ai-image-upscaler | 17 s |
| auto-subtitle-generator | 52 s | face-swap-photo | 5 s |
| ai-video-editor | 1 m 11 s | head-swap | 18 s |
| audio-to-video | 1 m 11 s | body-swap | 27 s |
| face-swap (video) | 1 m 17 s | ai-headshot-generator | 16 s |
| lip-sync | 1 m 30 s | ai-clothes-changer | 10 s |
| animation | 2 m 46 s | ai-face-editor | 2 s |
| character-replace | 5 m 23 s | image-background-remover | 5 s |
| video-to-video | 6 m 26 s | photo-colorizer | 10 s |
| ai-voice-generator | 4 s | ai-gif-generator | 26 s |
| ai-voice-cloner | 1 m 11 s | ai-meme-generator | 6 s |

Not measured on the page: ai-video-upscaler, ai-video-translator, ai-ugc-ad, ai-music-generator, face-detection.

---

## 9. What this means for the V2 pipeline

**Identity references for people (images).** `POST /v1/text-to-video` is the only generator with a general `references[]` array: name an image (no `@`), mention it as `@name` in the prompt; `kling-3.0` and `gemini-omni-1.1` (up to 10) take images and videos, `minimax-h3`, `seedance-2.0`/`-mini`/`-fast`, `seedance-2.5` and `wan-3.0` take images, videos and audio, `veo3.1` takes up to 3 images and then only at `end_seconds` = 8. `POST /v1/image-to-video` has no references, only the start image and an optional end image, so identity comes from the still; `POST /v1/character-replace` (one reference image), `POST /v1/face-swap` / `face-swap-photo` / `head-swap` / `body-swap` and `POST /v1/ai-image-editor` (up to 10 input images, per-model cap 1–9) are the other ways to put a specific face into a shot.

**Voice references (audio).** Only `text-to-video` with `minimax-h3`, the `seedance-2.0` family, `seedance-2.5` or `wan-3.0` accepts an audio file as a named reference; `POST /v1/ai-voice-cloner` takes a ≥ 3 s sample and returns speech, not a reusable voice id; `lip-sync`, `ai-talking-photo` and `audio-to-video` consume a finished speech track rather than a reference. Saved voices from the web app appear in `GET /v1/saved-items?type=voice` with a `file_path`, but the docs do not say which fields accept them.

**Pinning a start and an end frame.** Only `POST /v1/image-to-video` does it, via `assets.image_file_path` plus `assets.end_image_file_path`, on `gemini-omni-1.1`, `kling-3.0`, `ltx-2.5`, `minimax-h3`, `seedance-1.5`, `seedance-2.0`/`-mini`/`-fast`, `seedance-2.5`, `wan-3.0` (all their resolutions), `kling-2.6` (1080p only) and `veo3.1`/`veo3.1-lite` (clips ≤ 8 s); `wan-2.2` cannot, `sora-2` is undocumented, and `text-to-video` has no frame fields at all.

**Native dialogue audio and cost.** Set `audio: true` on `text-to-video` or `image-to-video`; audio is included in the base rate on `ltx-2.5` (24/48/72 credits per s at 480p/720p/1080p), `minimax-h3` (24/48/72), `wan-3.0` (48/96/180), `seedance-2.0-mini` (48/120), `-fast` (84/180), `seedance-2.0` (96/216/528/1104), `seedance-2.5` (168/336/840) and `sora-2` (120 at 720p); it costs extra on `kling-3.0` (+24 per s at 720p/1080p → 72/96, +48 at 4k → 288), `veo3.1` (+24 → 120/144), `veo3.1-lite` (+24 → 72/96) and `seedance-1.5` (×2 → 60/120/180); `gemini-omni-1.1`, `kling-2.6` and `wan-2.2` have no audio. The docs never say which of these produce spoken dialogue versus ambience, but the scripted-speech endpoint `POST /v1/ai-ugc-ad` runs only on `kling-3.0`, `ltx-2.5` and `veo3.1`, which is the strongest signal of where dialogue works.

**What the voice generator offers.** `POST /v1/ai-voice-generator` is preset-only: a fixed `voice_name` enum of several hundred named voices, most of them real people (Elon Musk, Morgan Freeman, Barack Obama, Taylor Swift and so on) plus fictional characters, with no descriptor or "designed" voices, no language, speed or emotion controls, a 1,000-character limit and 0.1 credit per character; named real people are not refused by the API (the terms put consent on you, and two celebrity presets were removed in October 2026, so the list can shrink without notice). Cloning is `POST /v1/ai-voice-cloner` (sample + text, 0.1 credit per character, no stored voice id).

**Speech-to-speech conversion.** None in the API; a `VOICE_CHANGER` project type exists only in the web app, so voice conversion of an existing performance has to be done elsewhere or rebuilt as text through the cloner.

**Sound effects or ambience.** No API endpoint; the web app's Sound Effect Generator (`SOUND_EFFECT_GENERATOR`, up to 60 s) is not exposed, and the nearest API options are `POST /v1/ai-music-generator` with `style.instrumental: true` (15–300 s, 1 credit per s) or the included audio track of a video model.

**What the music generator takes.** `POST /v1/ai-music-generator` takes `style.prompt` (free-text genre, mood, instruments), an integer `duration` of 15–300 s (1 credit per second), optional `style.lyrics` (custom words; omit for AI lyrics) and `style.instrumental` (true drops vocals and ignores lyrics); output format is not stated.

**What lip sync takes and costs.** `POST /v1/lip-sync` takes an audio file plus a video (`file` or `youtube`), `start_seconds`/`end_seconds`, an optional `max_fps_limit`, and `style.generation_mode` `lite`/`standard` at 1 credit per rendered frame or `pro` at 2 (so 10 s at 30 fps ≈ 300 or 600 credits); `standard` and `pro` need visible mouth movement in the opening seconds, and stills must go through `POST /v1/ai-talking-photo` instead (20 credits per s `prompted`, 48 per s `realistic`, 480p or 720p).

**Reframing, camera, outpainting or crop.** There is no dedicated API tool: `POST /v1/ai-video-editor` is prompt editing (objects, scene, colour, restyle) with no documented reframe or outpaint, `ai-video-upscaler` keeps the aspect ratio, and `text-to-video` only chooses `aspect_ratio` (16:9, 9:16, 1:1) at generation time; for stills `POST /v1/ai-image-editor` can re-output at `auto`, 16:9, 9:16, 4:3, 3:2, 1:1, 4:5 or 2:3. Video Expander, Extend, Image Expander and Generative Fill are web-app-only project types, and `POST /v1/animation` offers pan/tilt/zoom `camera_effect` presets only inside its stylised stop-motion output.

**Subtitle tool inputs.** `POST /v1/auto-subtitle-generator` takes one `assets.video_file_path`, `start_seconds`/`end_seconds`, and either a `style.template` (`karaoke`, `cinematic`, `minimalist`, `highlight`) or a `style.custom_config` (Google Font name, size, style, text and highlight colours, stroke colour and width, vertical and horizontal position); it transcribes without a language parameter, burns the captions in (no SRT/VTT), and costs about 4.8 credits per second at 24 fps.

**Upload limits.** `POST /v1/files/upload-urls` issues PUT URLs per file (`type` video/audio/image + extension; mp4/m4v/mov/webm, a dozen audio types, a dozen image types) and the per-plan size caps are 200 MB free, 2 GB Creator, 5 GB Pro, 10 GB Business; any public or pre-signed direct URL with a file extension works without uploading, and download URLs last 24 hours.

---

## 10. Gaps: what could not be found

- Credit cost for `POST /v1/ai-video-editor`, `POST /v1/ai-video-upscaler`, `POST /v1/ai-video-translator` and `POST /v1/ai-ugc-ad` (none on the models page or endpoint pages; only web-app figures exist for the translator and editor).
- Per-resolution image prices beyond the "from" column; Body Swap prices at 1k/2k/4k; Face Swap Photo prices at 2K/4K.
- `sora-2` aspect ratios, end-frame and reference support, and plan tier (only its 720p/duration/audio/120-credit row exists).
- Plan tier for most video models other than `ltx-2.5`, `minimax-h3` (free), `kling-3.0`, `seedance-2.5`, `wan-3.0`, `seedance-2.0-fast` (paid).
- Reference counts for `kling-3.0` and the seedance/minimax/wan models in the API (only the web changelog gives 1 video + 4 images for Kling 3.0); how to address individual input images in `ai-image-editor` prompts; which API fields accept saved-item `file_path`s.
- Which video models produce spoken dialogue versus ambience, and any dialogue prompt syntax.
- Output container/codec/bitrate for video, image format, audio format and sample rate.
- Input image dimension limits for image-to-video, talking photo and swaps (only recommendations); maximum clip length for video-to-video, face swap video, lip sync and audio-to-video beyond the frame caps quoted from the changelog.
- Rate limits, concurrency caps, webhook retry policy, upload-URL lifetime, output retention period.
- Whether blocked (moderated) jobs are refunded; any explicit celebrity or public-figure rule (the terms only require legally sufficient consent for a person's face, voice or likeness).
- The complete `voice_name` enum is reproduced only on the endpoint page; the GIF generator's duration and fps; the meme template list beyond the examples given.
- January–April 2026 changelog entries (behind a "Load more" control not reachable by fetch).

---

## 11. Sources

Documentation index and overview

- https://docs.magichour.ai/llms.txt
- https://docs.magichour.ai/llms-full.txt
- https://docs.magichour.ai/introduction.md
- https://docs.magichour.ai/api-reference/overview.md
- https://docs.magichour.ai/api-reference/models.md
- https://docs.magichour.ai/api-reference/processing-times.md
- https://docs.magichour.ai/api-reference/openapi.json
- https://docs.magichour.ai/get-started/authentication.md
- https://docs.magichour.ai/integration/overview.md
- https://docs.magichour.ai/integration/inputs-and-outputs.md
- https://docs.magichour.ai/integration/development-and-testing.md
- https://docs.magichour.ai/integration/webhook/overview.md
- https://docs.magichour.ai/integration/webhook/event-types.md
- https://docs.magichour.ai/integration/webhook/secure-handler.md
- https://docs.magichour.ai/webhook-reference/overview.md

Video project endpoints

- https://docs.magichour.ai/api-reference/video-projects/text-to-video.md
- https://docs.magichour.ai/api-reference/video-projects/image-to-video.md
- https://docs.magichour.ai/api-reference/video-projects/video-to-video.md
- https://docs.magichour.ai/api-reference/video-projects/ai-video-editor.md
- https://docs.magichour.ai/api-reference/video-projects/audio-to-video.md
- https://docs.magichour.ai/api-reference/video-projects/animation.md
- https://docs.magichour.ai/api-reference/video-projects/ai-ugc-ad-generator.md
- https://docs.magichour.ai/api-reference/video-projects/ai-talking-photo.md
- https://docs.magichour.ai/api-reference/video-projects/lip-sync.md
- https://docs.magichour.ai/api-reference/video-projects/face-swap-video.md
- https://docs.magichour.ai/api-reference/video-projects/character-replace.md
- https://docs.magichour.ai/api-reference/video-projects/auto-subtitle-generator.md
- https://docs.magichour.ai/api-reference/video-projects/ai-video-translator.md
- https://docs.magichour.ai/api-reference/video-projects/ai-video-upscaler.md
- https://docs.magichour.ai/api-reference/video-projects/get-video-details.md
- https://docs.magichour.ai/api-reference/video-projects/delete-video.md

Image project endpoints

- https://docs.magichour.ai/api-reference/image-projects/ai-image-generator.md
- https://docs.magichour.ai/api-reference/image-projects/ai-image-editor.md
- https://docs.magichour.ai/api-reference/image-projects/ai-image-upscaler.md
- https://docs.magichour.ai/api-reference/image-projects/image-background-remover.md
- https://docs.magichour.ai/api-reference/image-projects/photo-colorizer.md
- https://docs.magichour.ai/api-reference/image-projects/ai-gif-generator.md
- https://docs.magichour.ai/api-reference/image-projects/ai-meme-generator.md
- https://docs.magichour.ai/api-reference/image-projects/ai-qr-code-generator.md
- https://docs.magichour.ai/api-reference/image-projects/face-swap-photo.md
- https://docs.magichour.ai/api-reference/image-projects/head-swap.md
- https://docs.magichour.ai/api-reference/image-projects/body-swap.md
- https://docs.magichour.ai/api-reference/image-projects/ai-clothes-changer.md
- https://docs.magichour.ai/api-reference/image-projects/ai-face-editor.md
- https://docs.magichour.ai/api-reference/image-projects/ai-headshot-generator.md
- https://docs.magichour.ai/api-reference/image-projects/get-image-details.md
- https://docs.magichour.ai/api-reference/image-projects/delete-image.md

Audio, files and account endpoints

- https://docs.magichour.ai/api-reference/audio-projects/ai-voice-generator.md
- https://docs.magichour.ai/api-reference/audio-projects/ai-voice-cloner.md
- https://docs.magichour.ai/api-reference/audio-projects/ai-music-generator.md
- https://docs.magichour.ai/api-reference/audio-projects/get-audio-details.md
- https://docs.magichour.ai/api-reference/audio-projects/delete-audio.md
- https://docs.magichour.ai/api-reference/files/generate-asset-upload-urls.md
- https://docs.magichour.ai/api-reference/files/face-detection.md
- https://docs.magichour.ai/api-reference/files/get-face-detection-details.md
- https://docs.magichour.ai/api-reference/files/list-saved-items.md
- https://docs.magichour.ai/api-reference/account/get-account-details.md

Billing

- https://docs.magichour.ai/billing/overview.md
- https://docs.magichour.ai/billing/resolution-limits.md
- https://docs.magichour.ai/billing/subscription-pricing.md
- https://docs.magichour.ai/billing/usage-based-pricing.md

Tool guides

- https://docs.magichour.ai/tools/video-tools.md
- https://docs.magichour.ai/tools/image-tools.md
- https://docs.magichour.ai/tools/audio-tools.md
- https://docs.magichour.ai/tools/video/text-to-video.md
- https://docs.magichour.ai/tools/video/image-to-video.md
- https://docs.magichour.ai/tools/video/video-to-video.md
- https://docs.magichour.ai/tools/video/video-editor.md
- https://docs.magichour.ai/tools/video/audio-to-video.md
- https://docs.magichour.ai/tools/video/animation.md
- https://docs.magichour.ai/tools/video/talking-photo.md
- https://docs.magichour.ai/tools/video/lip-sync.md
- https://docs.magichour.ai/tools/video/face-swap-video.md
- https://docs.magichour.ai/tools/video/character-replace.md
- https://docs.magichour.ai/tools/video/auto-subtitle-generator.md
- https://docs.magichour.ai/tools/audio/voice-generator.md
- https://docs.magichour.ai/tools/audio/voice-cloner.md
- https://docs.magichour.ai/tools/image/image-editor.md
- https://docs.magichour.ai/tools/image/image-generator.md

Changelog (docs.magichour.ai/changelog.md and /changelog/2025.md redirect here)

- https://magichour.ai/changelog
- https://magichour.ai/changelog/2025

Magic Hour site

- https://magichour.ai/api
- https://magichour.ai/terms-of-service
- https://magichour.ai/faq

Help centre

- https://help.magichour.ai
- https://help.magichour.ai/en/articles/12612619-tool-limitations-resolution-length-and-credit-costs
- https://help.magichour.ai/en/articles/12613225-api-documentation-and-integration-guide
- https://help.magichour.ai/en/articles/8350794-api-pricing-calculator-and-usage-based-billing
- https://help.magichour.ai/en/articles/12612555-understanding-credits
- https://help.magichour.ai/en/articles/15011080-generation-failed-stalled-canceled-or-produced-a-blank-result-what-happens-to-credits
- https://help.magichour.ai/en/articles/15011113-what-content-is-not-allowed-on-magic-hour
- https://help.magichour.ai/en/articles/12612784-why-was-my-generation-blocked-or-flagged-by-content-moderation
- https://help.magichour.ai/en/articles/12613246-commercial-use-watermarks-and-your-rights
- https://help.magichour.ai/en/collections/19748323-developers-api
- https://help.magichour.ai/en/collections/19748324-company-policies
- https://help.magichour.ai/en/collections/16098638-account-plans-credits
