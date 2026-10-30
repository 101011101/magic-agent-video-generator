# Magic Hour API Tool Catalog

- Accessed: 2026-10-05. API: "Magic Hour API beta", base `https://api.magichour.ai`, bearer token auth.
- Machine-readable twin: `current/tests/fixtures/magic-hour-tools.json`.
- Category rule (inferred): generative = model makes new pixels/audio/text; deterministic = no new content (analysis, cutout, caption overlay, file ops).
- Basis tags: [D] = documented, [I] = inferred. "unverified" = not confirmed in official docs.
- All create calls are async: response `{id, credits_charged}` → poll `GET /v1/{video|image|audio}-projects/{id}` → `downloads[].url` (expires 24h). Statuses: queued, rendering, complete, error, canceled. Webhooks: `*.started`, `*.completed`, `*.errored`.
- Inputs: public URL with extension, Magic Hour library URL, or `file_path` from upload-urls (uploads kept 7 days). Upload size: free 200MB, creator 2GB, pro 5GB, business 10GB.
- Every create endpoint accepts optional `name`. Video costs: estimate at create, corrected on completion; failed jobs refunded.

## Summary

| Tool | Category | Inputs → Output | Maintains | Mutates | Key limits |
| :- | :- | :- | :- | :- | :- |
| Image-to-Video | generative | image → video | first frame = input image (subject identity, composition, style at t=0) [I]; last frame = end_image_file_path when given [D]; aspect ratio of input image [I] | adds motion, camera movement and environmental effects over time [D]; adds generated audio when audio=true [D]; subject identity can drift in later frames [I] | 1-60s; res 360p/480p/720p/1080p/4k |
| Text-to-Video | generative | text prompt → video | nothing from prior state (creates new content); prompt content only [I]; identity of referenced subjects when references are passed [I] | creates all visual content, motion, and optional audio [D] | 1-60s; res 360p/480p/720p/1080p/4k; AR 16:9/9:16/1:1 |
| AI Talking Photo | generative | image + audio → video | face likeness (realistic mode: 'maintains likeness well') [D]; prompted mode: slightly lower likeness [D]; background and framing of photo [I] | mouth/lip motion synced to audio, head pose and expressions [D]; scene can change per prompt in prompted mode [D]; adds the input audio as soundtrack [I] | dur: max_realistic 300, max_prompted 45; res plan-dependent; hard cap 720p (resolution-limits page) |
| Lip Sync | generative | video (file or YouTube) + audio → video | video content, person identity, body, background, camera motion [I]; frame rate up to max_fps_limit [D] | lip/mouth movements to match audio [D]; audio track replaced with input audio [I] | end_seconds - start_seconds; res follows input (inferred) |
| Face Swap Video | generative | video (file or YouTube) + face image(s) → video | expressions, head movements, lighting [D]; body, pose, background, camera motion, audio [I] | face identity of target face(s) [D] | end_seconds - start_seconds; res service/plan managed |
| Video-to-Video | generative | video (file or YouTube) + style enum (+opt prompt) → video | original motion and structure [D]; timing, composition, camera motion [I] | visual style / rendering of every frame [D]; frame rate halved with fps_resolution=HALF [D]; identity detail of people may change [I] | end_seconds - start_seconds; res service/plan managed; hard cap 1472px; dims divisible by 64 |
| AI Video Editor | generative | text prompt + video → video | unedited content, motion, framing [I] | objects, colors, scene details or style named in prompt (remove/replace objects, recolor, restyle) [D] | dur: gemini-omni-1.1 3-10, ltx-2.5 0.5-20 (OpenAPI), ltx-2.3 0.5-45 (tool page); res 480p/720p/1080p |
| AI Video Translator | generative | video → video | visuals, speaker identity [I]; speaker voice timbre (unverified) [I] | spoken language of audio track [D]; lip movements (unverified) [I] | 1-30s; res 480p/720p/1080p |
| Animation | generative | prompt or audio (+opt image, audio) → video | start image as first frame when provided [D] | art style, content evolves over time per transition_speed [D]; camera motion per camera_effect [D]; adds audio track when audio given [I] | end_seconds; res custom width x height, 64px min, 1472px hard cap; AR any via width/height |
| Audio-to-Video | generative | audio (+opt image) → video | audio segment duration and timing [D]; reference image as initial frame [D]; audio track kept in output (unverified) [I] | creates visuals matching audio and prompt [D] | end_seconds - start_seconds; res 480p/720p/1080p |
| Character Replace | generative | video + character image → video | replace mode: scene, background, motion of source video [D]; animate mode: character appearance from image [D] | replace mode: subject identity/appearance becomes reference character [D]; animate mode: motion transferred from video onto character image [D] | dur: kling-3.0_replace 3-10, kling-3.0_animate 3-30, wan-animate no max documented; res 480p/720p/1080p |
| Auto Subtitle Generator | deterministic | video → video | all video frames and audio apart from caption overlay [I] | adds caption text overlay [D] | end_seconds - start_seconds; res follows input (inferred) |
| AI Image Generator | generative | text prompt → image | nothing from prior state; new content [I] | creates full image from prompt [D] | res 640px/1k/2k/4k; AR 1:1/16:9/9:16 |
| AI Image Editor | generative | image[] + text prompt → image | regions and subjects not named in the instruction [I]; subject identity (model-dependent; not guaranteed) [I] | content, style or composition named in prompt; can compose multiple references [D] | res 640px/1k/2k/4k; AR auto/16:9/9:16/4:3/3:2/1:1/4:5/2:3 |
| Face Swap Photo | generative | target image + face image(s) → image | facial expression, lighting, image quality [D]; pose, body, hair, background, composition [I] | face identity [D] | res plan-dependent longest edge: free 576, creator 1024, pro 1472, business 4096 |
| Head Swap | generative | body image + head image → image | target body, pose, scene [D] | whole head incl. face, hair, broader head details [D] | res <= 2048px longest edge, plan-capped |
| Body Swap | generative | person image + scene image → image | scene, background, composition [D]; person identity and appearance from person image [D] | person in the scene [D]; pose may adapt to scene (inferred) [I] | res 640px/1k/2k/4k |
| AI Clothes Changer | generative | person image + garment image → image | pose, lighting, background [D]; face identity [I] | clothing in selected garment region [D] | res plan-capped; hard cap 1472px |
| AI Headshot Generator | generative | image → image | facial features and identity [D] | background, attire, lighting, framing to headshot [D] | res plan-capped; hard cap 1344px |
| AI Face Editor | generative | image → image | realistic proportions, lighting, identity [D]; background, clothing [I] | expression, eye gaze, mouth shape, head pose [D] | res plan-dependent |
| AI Image Upscaler | generative | image → image | content and composition [D]; aspect ratio [I]; detail (preserve mode) [D] | resolution (2x/4x) [D]; detail enhanced (balanced) or reinterpreted (creative) [D] | res input <= 4096x4096; output = input x scale_factor; AR unchanged |
| Image Background Remover | deterministic | image → image | subject at full quality [D]; dimensions [I] | background removed (alpha) or replaced [D] | res follows input (inferred); AR unchanged |
| Photo Colorizer | generative | image → image | content, structure, composition [I] | color [D] | res plan-dependent (unverified); AR unchanged (inferred) |
| AI GIF Generator | generative | text prompt → animation (image project) | nothing from prior state; no image input [D] | creates new short animation [D] | not settable |
| AI Meme Generator | generative | text prompt → image | template image [D] | panel text generated for topic [D] | AR template-defined |
| AI QR Code Generator | generative | text content + style text → image | encoded content / scannability (goal, must test) [D] | visual style [D] | AR 1:1 (inferred) |
| AI Voice Generator | generative | text prompt → audio | script text [D] | creates speech audio in chosen voice [D] | set by text length (max 1000 chars) |
| AI Voice Cloner | generative | audio + text prompt → audio | voice timbre, intonation, speaking patterns of sample [D] | spoken content (new text) [D] | set by text length (max 1000 chars) |
| Face Detection | deterministic | image or video → face list | input media unchanged (analysis only) [I] | - | - |
| Generate Asset Upload URLs | deterministic | file type + extension → upload URL + file_path | file bytes [I] | - | - |

- Counts: 26 generative, 4 deterministic, 30 total.

## Image-to-Video

- Endpoint: `POST /v1/image-to-video`
- SDK: JS: client.v1.imageToVideo.create() / .generate(); Python: client.v1.image_to_video.create() / .generate()
- Category: generative
- Purpose: Animate a still image into a video clip, optionally guided by a prompt and an end frame.
- Inputs:
  - `assets.image_file_path` (image, required): file URL or file_path from POST /v1/files/upload-urls; start image
  - `assets.end_image_file_path` (image, optional): last frame; not supported by minimax-h3, wan-2.2; veo3.1/veo3.1-lite need duration <= 8s; kling-2.6 end frame 1080p only
  - `end_seconds` (number, required): duration 1-60; allowed values per model (see limits)
  - `model` (enum, optional): see models; default 'default'
  - `resolution` (enum, optional): 360p, 480p, 720p, 1080p, 4k; per-model support; default 720p paid / 480p free
  - `audio` (boolean, optional): audio: boolean, default false. Not supported: gemini-omni-1.1, kling-2.6, wan-2.2. Extra credits: kling-3.0, seedance-1.5, veo3.1, veo3.1-lite. Free: ltx-2.5, minimax-h3, seedance-2.0, seedance-2.0-mini, seedance-2.5, wan-3.0.
  - `style.prompt` (text prompt, optional): motion/scene prompt
- Models/variants: `default`, `kling-3.0`, `ltx-2.5`, `seedance-2.0-mini`, `wan-3.0`, `seedance-2.5`, `gemini-omni-1.1`, `minimax-h3`, `wan-2.2`, `seedance-1.5`, `seedance-2.0`, `veo3.1-lite`, `sora-2`, `veo3.1`, `kling-2.6`, `ltx-2.3`. Default: default (= kling-3.0 on paid tiers, ltx-2.5 on free tier)
- duration_s: min: 1; max: 60
  - per_model: `gemini-omni-1.1` integer 3-10; `kling-2.6` 5, 10; `kling-3.0` integer 3-15; `ltx-2.5` integer 1-60; `minimax-h3` integer 1-30; `seedance-1.5` integer 4-12; `seedance-2.0` integer 4-15; `seedance-2.0-mini` integer 4-15; `seedance-2.5` integer 4-30; `veo3.1` 4, 6, 8, 16, 24, 32, 40, 48, 56; `veo3.1-lite` 4, 6, 8, 16, 24, 32, 40, 48, 56; `wan-2.2` 3-10, 15; `wan-3.0` 2-10, 15, 20, 25, 30; `sora-2` 4, 8, 12, 24, 36, 48, 60 (models page only; unverified in OpenAPI); `ltx-2.3` 1-10, 15, 20, 25, 30 (models page only)
- resolutions: 360p, 480p, 720p, 1080p, 4k
- resolutions_per_model: gemini-omni-1.1: 360p, 720p, 1080p, 4k; kling-2.6: 720p, 1080p; kling-3.0: 720p, 1080p, 4k; ltx-2.5: 480p, 720p, 1080p; minimax-h3: 480p, 720p, 1080p; seedance-1.5: 480p, 720p, 1080p; seedance-2.0: 480p-4k (OpenAPI) vs 480p, 720p (models page); seedance-2.0-mini: 480p, 720p; seedance-2.5: 480p-1080p (OpenAPI) vs 480p, 720p (models page); veo3.1: 720p, 1080p; veo3.1-lite: 720p, 1080p; wan-2.2: 480p, 720p, 1080p; wan-3.0: 480p, 720p, 1080p; sora-2: 720p (models page)
- aspect_ratio_note: No aspect_ratio field; output shape follows input image (inferred).
- other: Legacy values still accepted: ltx-2, kling-2.5, kling-1.6, seedance, kling-2.5-audio, veo3.1-audio (-audio = base model + audio:true).
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: Credits/second of output x end_seconds. 360p/480p/720p/1080p/4k: gemini-omni-1.1 48/-/144/192/384; ltx-2.3, ltx-2.5, minimax-h3, wan-2.2 -/24/48/72/-; kling-2.6 -/-/36/72/-; kling-3.0 -/-/48/72/240 (+24 audio at 720p/1080p, +48 at 4k); veo3.1-lite -/-/48/72 (+24 audio); veo3.1 -/-/96/120 (+24 audio); seedance-1.5 -/30/60/90 (audio 2x); seedance-2.0-mini -/96/192; seedance-2.0 -/144/288; seedance-2.5 -/288/576; sora-2 720p 120. Formula: duration x output fps x resolution multiplier. Create response gives an estimate; final value on get-details. Failed jobs refunded.
- Maintains: first frame = input image (subject identity, composition, style at t=0) [I]; last frame = end_image_file_path when given [D]; aspect ratio of input image [I]
- Mutates: adds motion, camera movement and environmental effects over time [D]; adds generated audio when audio=true [D]; subject identity can drift in later frames [I]
- Limits / failure modes:
  - Paid default (kling-3.0) does not support 480p.
  - Unsupported duration/resolution combination per model is rejected (inferred).
  - Free resolution limited; higher resolutions need paid plan.
- Source: https://docs.magichour.ai/api-reference/video-projects/image-to-video

## Text-to-Video

- Endpoint: `POST /v1/text-to-video`
- SDK: JS: client.v1.textToVideo.create() / .generate(); Python: client.v1.text_to_video.create() / .generate()
- Category: generative
- Purpose: Generate a video clip from a text prompt.
- Inputs:
  - `style.prompt` (text prompt, required): 1-20000 chars
  - `end_seconds` (number, required): duration 1-60; allowed values per model
  - `aspect_ratio` (enum, optional): 16:9, 9:16, 1:1; gemini-omni-1.1, veo3.1, veo3.1-lite: 16:9, 9:16 only
  - `model` (enum, optional): see models; default 'default'
  - `resolution` (enum, optional): 360p, 480p, 720p, 1080p, 4k; per-model support; default 720p paid / 480p free
  - `audio` (boolean, optional): audio: boolean, default false. Not supported: gemini-omni-1.1, kling-2.6, wan-2.2. Extra credits: kling-3.0, seedance-1.5, veo3.1, veo3.1-lite. Free: ltx-2.5, minimax-h3, seedance-2.0, seedance-2.0-mini, seedance-2.5, wan-3.0.
  - `references` (array of {name, file_path}, optional): 1-10 items; fields have no description in docs (unverified: reference images for reference-to-video models)
- Models/variants: `default`, `kling-3.0`, `ltx-2.5`, `seedance-2.0-mini`, `wan-3.0`, `seedance-2.5`, `gemini-omni-1.1`, `minimax-h3`, `wan-2.2`, `seedance-1.5`, `seedance-2.0`, `veo3.1-lite`, `sora-2`, `veo3.1`, `kling-2.6`, `ltx-2.3`. Default: default (= kling-3.0 on paid tiers, ltx-2.5 on free tier)
- duration_s: min: 1; max: 60
  - per_model: `gemini-omni-1.1` integer 3-10; `kling-2.6` 5, 10; `kling-3.0` integer 3-15; `ltx-2.5` integer 1-60; `minimax-h3` integer 1-30; `seedance-1.5` integer 4-12; `seedance-2.0` integer 4-15; `seedance-2.0-mini` integer 4-15; `seedance-2.5` integer 4-30; `veo3.1` 4, 6, 8, 16, 24, 32, 40, 48, 56; `veo3.1-lite` 4, 6, 8, 16, 24, 32, 40, 48, 56; `wan-2.2` 3-10, 15; `wan-3.0` 2-10, 15, 20, 25, 30; `sora-2` 4, 8, 12, 24, 36, 48, 60 (models page only; unverified in OpenAPI); `ltx-2.3` 1-10, 15, 20, 25, 30 (models page only)
- resolutions: 360p, 480p, 720p, 1080p, 4k
- resolutions_per_model: gemini-omni-1.1: 360p, 720p, 1080p, 4k; kling-2.6: 720p, 1080p; kling-3.0: 720p, 1080p, 4k; ltx-2.5: 480p, 720p, 1080p; minimax-h3: 480p, 720p, 1080p; seedance-1.5: 480p, 720p, 1080p; seedance-2.0: 480p-4k (OpenAPI) vs 480p, 720p (models page); seedance-2.0-mini: 480p, 720p; seedance-2.5: 480p-1080p (OpenAPI) vs 480p, 720p (models page); veo3.1: 720p, 1080p; veo3.1-lite: 720p, 1080p; wan-2.2: 480p, 720p, 1080p; wan-3.0: 480p, 720p, 1080p; sora-2: 720p (models page)
- aspect_ratios: 16:9, 9:16, 1:1
- other: Legacy values still accepted: ltx-2, kling-2.5, kling-1.6, seedance, kling-2.5-audio, veo3.1-audio (-audio = base model + audio:true).
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: Credits/second of output x end_seconds. 360p/480p/720p/1080p/4k: gemini-omni-1.1 48/-/144/192/384; ltx-2.3, ltx-2.5, minimax-h3, wan-2.2 -/24/48/72/-; kling-2.6 -/-/36/72/-; kling-3.0 -/-/48/72/240 (+24 audio at 720p/1080p, +48 at 4k); veo3.1-lite -/-/48/72 (+24 audio); veo3.1 -/-/96/120 (+24 audio); seedance-1.5 -/30/60/90 (audio 2x); seedance-2.0-mini -/96/192; seedance-2.0 -/144/288; seedance-2.5 -/288/576; sora-2 720p 120. Formula: duration x output fps x resolution multiplier. Create response gives an estimate; final value on get-details. Failed jobs refunded.
- Maintains: nothing from prior state (creates new content); prompt content only [I]; identity of referenced subjects when references are passed [I]
- Mutates: creates all visual content, motion, and optional audio [D]
- Limits / failure modes:
  - Prompt adherence and character consistency across separate calls not guaranteed (inferred).
  - references field semantics undocumented.
- Source: https://docs.magichour.ai/api-reference/video-projects/text-to-video

## AI Talking Photo

- Endpoint: `POST /v1/ai-talking-photo`
- SDK: JS: client.v1.aiTalkingPhoto.create() / .generate(); Python: client.v1.ai_talking_photo.create() / .generate()
- Category: generative
- Purpose: Animate a portrait image so the face speaks a supplied audio track.
- Inputs:
  - `assets.image_file_path` (image, required): file URL or file_path from POST /v1/files/upload-urls; clear face, >= 512x512 recommended
  - `assets.audio_file_path` (audio, required): file URL or file_path from POST /v1/files/upload-urls
  - `start_seconds` (number, required): >= 0; start of audio segment
  - `end_seconds` (number, required): >= 0.1; segment max 300s (realistic) / 45s (prompted)
  - `style.generation_mode` (enum, optional): realistic (default), prompted; deprecated: pro, standard, stable, expressive
  - `style.prompt` (text prompt, optional): only used in prompted mode
  - `max_resolution` (number, optional): caps larger output dimension; clamped to plan max
- Models/variants: `realistic`, `prompted`. Default: realistic
- duration_s: max_realistic: 300; max_prompted: 45
- resolutions: plan-dependent; hard cap 720p (resolution-limits page)
- aspect_ratio_note: Follows input image (inferred).
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 20 credits/second (prompted), 48 credits/second (realistic); duration = end_seconds - start_seconds. Estimate at create, final on completion.
- Maintains: face likeness (realistic mode: 'maintains likeness well') [D]; prompted mode: slightly lower likeness [D]; background and framing of photo [I]
- Mutates: mouth/lip motion synced to audio, head pose and expressions [D]; scene can change per prompt in prompted mode [D]; adds the input audio as soundtrack [I]
- Limits / failure modes:
  - Needs a clear, front-facing face; profiles reduce quality.
  - No text input in schema despite summary text; generate audio first with AI Voice Generator.
- Source: https://docs.magichour.ai/api-reference/video-projects/ai-talking-photo

## Lip Sync

- Endpoint: `POST /v1/lip-sync`
- SDK: JS: client.v1.lipSync.create() / .generate(); Python: client.v1.lip_sync.create() / .generate()
- Category: generative
- Purpose: Re-animate the lips of a person in a video to match a new audio track.
- Inputs:
  - `assets.video_source` (enum, required): file, youtube
  - `assets.video_file_path` (video, optional): required if video_source=file; file URL or file_path from POST /v1/files/upload-urls
  - `assets.youtube_url` (file URL, optional): required if video_source=youtube
  - `assets.audio_file_path` (audio, required): file URL or file_path from POST /v1/files/upload-urls
  - `start_seconds` (number, required): >= 0
  - `end_seconds` (number, required): > start_seconds
  - `max_fps_limit` (number, optional): >= 1; output keeps input fps if lower
  - `style.generation_mode` (enum, optional): lite (default), standard, pro; standard/pro need Creator+
- Models/variants: `lite`, `standard`, `pro`. Default: lite
- duration_s: end_seconds - start_seconds; no max documented
- resolutions: follows input (inferred)
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 1 credit/frame (lite, standard), 2 credits/frame (pro). Example: 10s at 30fps lite ~ 300 credits.
- Maintains: video content, person identity, body, background, camera motion [I]; frame rate up to max_fps_limit [D]
- Mutates: lip/mouth movements to match audio [D]; audio track replaced with input audio [I]
- Limits / failure modes:
  - Needs visible, front-facing face; extreme head motion or occlusion reduce quality.
  - Best with single speaker; audio and video should be similar length.
- Source: https://docs.magichour.ai/api-reference/video-projects/lip-sync

## Face Swap Video

- Endpoint: `POST /v1/face-swap`
- SDK: JS: client.v1.faceSwap.create() / .generate(); Python: client.v1.face_swap.create() / .generate()
- Category: generative
- Purpose: Replace faces in a video with a face from an image.
- Inputs:
  - `assets.video_source` (enum, required): file, youtube
  - `assets.video_file_path` (video, optional): required if video_source=file; gif accepted here only
  - `assets.youtube_url` (file URL, optional): required if video_source=youtube
  - `assets.face_swap_mode` (enum, optional): all-faces (default), individual-faces
  - `assets.image_file_path` (image, optional): source face; required for all-faces
  - `assets.face_mappings` (array of {original_face, new_face}, optional): max 5; required for individual-faces; original_face from face detection
  - `start_seconds` (number, required): >= 0
  - `end_seconds` (number, required): > start_seconds
  - `style.version` (enum, optional): v1, v2, default (default)
- Models/variants: `v1`, `v2`, `default`. Default: default
- duration_s: end_seconds - start_seconds; no max documented; test 5-10s first
- resolutions: service/plan managed
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 24 credits/second at 24fps (frame-based; final on completion).
- Maintains: expressions, head movements, lighting [D]; body, pose, background, camera motion, audio [I]
- Mutates: face identity of target face(s) [D]
- Limits / failure modes:
  - error code no_source_face when source face undetected.
  - Extreme head motion, occlusion, small faces reduce quality.
  - v1: weaker identity preservation; v2: stronger.
- Source: https://docs.magichour.ai/api-reference/video-projects/face-swap-video

## Video-to-Video

- Endpoint: `POST /v1/video-to-video`
- SDK: JS: client.v1.videoToVideo.create() / .generate(); Python: client.v1.video_to_video.create() / .generate()
- Category: generative
- Purpose: Restyle a video with a preset art style (style transfer).
- Inputs:
  - `assets.video_source` (enum, required): file, youtube
  - `assets.video_file_path` (video, optional): required if video_source=file
  - `assets.youtube_url` (file URL, optional): required if video_source=youtube
  - `start_seconds` (number, required): >= 0
  - `end_seconds` (number, required): > start_seconds
  - `style.art_style` (enum, required): 75 presets, e.g. Studio Ghibli, Pixar, Lego, Cyberpunk, Oil Painting, Van Gogh, No Art Style
  - `style.version` (enum, optional): v1, v2, default
  - `style.prompt_type` (enum, optional): default, custom, append_default
  - `style.prompt` (text prompt, optional): required if prompt_type custom/append_default
  - `style.model` (enum, optional): Dreamshaper, Absolute Reality, Flat 2D Anime, Soft Anime, Kaywaii, Western Anime, 3D Anime, default
  - `fps_resolution` (enum, optional): FULL, HALF (default)
- Models/variants: `Dreamshaper`, `Absolute Reality`, `Flat 2D Anime`, `Soft Anime`, `Kaywaii`, `Western Anime`, `3D Anime`, `default`. Default: default
- duration_s: end_seconds - start_seconds; no max documented
- resolutions: service/plan managed; hard cap 1472px; dims divisible by 64
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 48 credits/second at 24fps (frame-based). HALF fps halves frames (inferred).
- Maintains: original motion and structure [D]; timing, composition, camera motion [I]
- Mutates: visual style / rendering of every frame [D]; frame rate halved with fps_resolution=HALF [D]; identity detail of people may change [I]
- Limits / failure modes:
  - Fast/chaotic motion and unstable lighting reduce quality.
  - Not for content changes (e.g. 'add a person').
- Source: https://docs.magichour.ai/api-reference/video-projects/video-to-video

## AI Video Editor

- Endpoint: `POST /v1/ai-video-editor`
- SDK: JS: client.v1.aiVideoEditor.create() / .generate(); Python: client.v1.ai_video_editor.create() / .generate()
- Category: generative
- Purpose: Edit an existing video clip from a natural-language instruction.
- Inputs:
  - `assets.video_file_path` (video, required): file URL or file_path from POST /v1/files/upload-urls
  - `style.prompt` (text prompt, required): edit instruction
  - `start_seconds` (number, optional): default 0
  - `end_seconds` (number, required): clip length per model (see limits)
  - `model` (enum, optional): gemini-omni-1.1, ltx-2.5, ltx-2.3, gemini-omni (deprecated)
  - `resolution` (enum, optional): 480p, 720p, 1080p; default 480p free / 720p paid
- Models/variants: `gemini-omni-1.1`, `ltx-2.5`, `ltx-2.3`. Default: gemini-omni-1.1 (paid); free tier default conflicts: OpenAPI says ltx-2.5, models/tool pages say ltx-2.3
- duration_s: gemini-omni-1.1: 3-10; ltx-2.5: 0.5-20 (OpenAPI); ltx-2.3: 0.5-45 (tool page)
- resolutions: 480p, 720p, 1080p
- resolutions_per_model: gemini-omni-1.1: 720p, 1080p; ltx: 480p, 720p, 1080p
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: Frame-based; rate not listed on models page (unverified). Estimate at create, final on completion.
- Maintains: unedited content, motion, framing [I]
- Mutates: objects, colors, scene details or style named in prompt (remove/replace objects, recolor, restyle) [D]
- Limits / failure modes:
  - Multiple unrelated edits in one prompt reduce consistency.
  - Fast-moving details may break; review full clip.
- Source: https://docs.magichour.ai/api-reference/video-projects/ai-video-editor

## AI Video Translator

- Endpoint: `POST /v1/ai-video-translator`
- SDK: JS: client.v1.aiVideoTranslator.create() / .generate(); Python: client.v1.ai_video_translator.create() / .generate()
- Category: generative
- Purpose: Translate the speech in a video into another language.
- Inputs:
  - `assets.video_file_path` (video, required): file URL or file_path from POST /v1/files/upload-urls; contains speech
  - `target_language` (enum, required): 53 languages, e.g. English, Spanish, Chinese (Simplified), Hindi, Japanese
  - `start_seconds` (number, optional): default 0
  - `end_seconds` (number, required): clip 1-30s
  - `resolution` (enum, optional): 480p (default), 720p, 1080p; 720p+ paid
- duration_s: min: 1; max: 30
- resolutions: 480p, 720p, 1080p
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: Frame-based; rate not listed (unverified).
- Maintains: visuals, speaker identity [I]; speaker voice timbre (unverified) [I]
- Mutates: spoken language of audio track [D]; lip movements (unverified) [I]
- Limits / failure modes:
  - No tool guide page; behavior beyond schema unverified.
- Source: https://docs.magichour.ai/api-reference/video-projects/ai-video-translator

## Animation

- Endpoint: `POST /v1/animation`
- SDK: JS: client.v1.animation.create() / .generate(); Python: client.v1.animation.create() / .generate()
- Category: generative
- Purpose: Create a stylized, camera-effect animation from a prompt, optional start image and optional audio.
- Inputs:
  - `fps` (number, required): >= 1
  - `end_seconds` (number, required): output duration, >= 0.1
  - `width` (number, required): >= 64; max plan-dependent, hard cap 1472px
  - `height` (number, required): >= 64; max plan-dependent, hard cap 1472px
  - `style.art_style` (enum, required): 47 presets incl. Custom, Pixar, Studio Ghibli Film Still, Cyberpunk, Photograph, Directed by AI
  - `style.art_style_custom` (text prompt, optional): required if art_style=Custom
  - `style.camera_effect` (enum, required): 52 presets e.g. Simple Zoom In, Pan Left, Tilt Up, Slideshow, '* - Audio Sync', Directed by AI
  - `style.prompt_type` (enum, required): custom, use_lyrics, ai_choose (last two need audio)
  - `style.prompt` (text prompt, optional): required if prompt_type=custom
  - `style.transition_speed` (number, required): 1-10
  - `assets.audio_source` (enum, required): none, file, youtube
  - `assets.audio_file_path` (audio, optional): required if audio_source=file
  - `assets.youtube_url` (file URL, optional): required if audio_source=youtube
  - `assets.image_file_path` (image, optional): first frame
- duration_s: end_seconds; no max documented
- resolutions: custom width x height, 64px min, 1472px hard cap
- aspect_ratios: any via width/height
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 24 credits/second at 24fps; estimate from fps x end_seconds.
- Maintains: start image as first frame when provided [D]
- Mutates: art style, content evolves over time per transition_speed [D]; camera motion per camera_effect [D]; adds audio track when audio given [I]
- Limits / failure modes:
  - Stop-motion/morphing style; not photoreal continuous motion (inferred).
  - Audio must cover end_seconds.
- Source: https://docs.magichour.ai/api-reference/video-projects/animation

## Audio-to-Video

- Endpoint: `POST /v1/audio-to-video`
- SDK: JS: client.v1.audioToVideo.create() / .generate(); Python: client.v1.audio_to_video.create() / .generate()
- Category: generative
- Purpose: Generate a video driven by an audio track, with optional reference image and prompt.
- Inputs:
  - `assets.audio_file_path` (audio, required): file URL or file_path from POST /v1/files/upload-urls
  - `assets.image_file_path` (image, optional): reference for initial frame
  - `style.prompt` (text prompt, optional): visual style/scene
  - `start_seconds` (number, optional): default 0
  - `end_seconds` (number, required): > start_seconds
  - `resolution` (enum, optional): 480p, 720p, 1080p; default 720p paid / 480p free
- duration_s: end_seconds - start_seconds; no max documented
- resolutions: 480p, 720p, 1080p
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 24 credits/second at 480p, 48 at 720p, 72 at 1080p.
- Maintains: audio segment duration and timing [D]; reference image as initial frame [D]; audio track kept in output (unverified) [I]
- Mutates: creates visuals matching audio and prompt [D]
- Limits / failure modes:
  - Prompt conflicting with reference image degrades output.
- Source: https://docs.magichour.ai/api-reference/video-projects/audio-to-video

## Character Replace

- Endpoint: `POST /v1/character-replace`
- SDK: JS: client.v1.characterReplace.create() / .generate(); Python: client.v1.character_replace.create() / .generate()
- Category: generative
- Purpose: Replace a person in a video with a reference character, or animate the character with the video's motion.
- Inputs:
  - `assets.video_file_path` (video, required): file URL or file_path from POST /v1/files/upload-urls
  - `assets.image_file_path` (image, required): reference character
  - `start_seconds` (number, optional): default 0
  - `end_seconds` (number, required): > start_seconds
  - `model` (enum, optional): wan-animate (default), kling-3.0
  - `resolution` (enum, optional): wan-animate: 480p, 720p; kling-3.0: 720p, 1080p; default lowest on plan
  - `style.mode` (enum, optional): replace, animate
  - `style.selection_mode` (enum, optional): auto (default), point (wan-animate only)
  - `style.points` (array of {position_x, position_y, time_seconds}, optional): required if selection_mode=point
- Models/variants: `wan-animate`, `kling-3.0`. Default: wan-animate
- duration_s: kling-3.0_replace: 3-10; kling-3.0_animate: 3-30; wan-animate: no max documented
- resolutions: 480p, 720p, 1080p
- Output: video; video file via downloads[].url (container unverified; likely mp4)
- Cost: 48 credits/second at 480p, 96 at 720p (kling-3.0 1080p rate unverified).
- Maintains: replace mode: scene, background, motion of source video [D]; animate mode: character appearance from image [D]
- Mutates: replace mode: subject identity/appearance becomes reference character [D]; animate mode: motion transferred from video onto character image [D]
- Limits / failure modes:
  - Occlusion breaks tracking.
  - kling-3.0 rejects points (picks main person).
  - Multiple people: use point selection.
- Source: https://docs.magichour.ai/api-reference/video-projects/character-replace

## Auto Subtitle Generator

- Endpoint: `POST /v1/auto-subtitle-generator`
- SDK: JS: client.v1.autoSubtitleGenerator.create() / .generate(); Python: client.v1.auto_subtitle_generator.create() / .generate()
- Category: deterministic
- Purpose: Transcribe speech in a video and burn styled captions into it.
- Inputs:
  - `assets.video_file_path` (video, required): file URL or file_path from POST /v1/files/upload-urls
  - `start_seconds` (number, required): >= 0
  - `end_seconds` (number, required): > start_seconds
  - `style.template` (enum, optional): karaoke, cinematic, minimalist, highlight
  - `style.custom_config` (object, optional): font (Google Fonts), font_size, font_style, text_color, highlighted_text_color, stroke_color, stroke_width, vertical_position, horizontal_position; template or custom_config required
- duration_s: end_seconds - start_seconds; no max documented
- resolutions: follows input (inferred)
- Output: video; video with burned-in captions; no SRT/VTT export
- Cost: ~4.8 credits/second at 24fps.
- Maintains: all video frames and audio apart from caption overlay [I]
- Mutates: adds caption text overlay [D]
- Limits / failure modes:
  - No language parameter.
  - Noise, music, multiple speakers reduce transcription accuracy.
  - Font may not support language.
- Source: https://docs.magichour.ai/api-reference/video-projects/auto-subtitle-generator

## AI Image Generator

- Endpoint: `POST /v1/ai-image-generator`
- SDK: JS: client.v1.aiImageGenerator.create() / .generate(); Python: client.v1.ai_image_generator.create() / .generate()
- Category: generative
- Purpose: Generate images from a text prompt.
- Inputs:
  - `style.prompt` (text prompt, required): min 1 char
  - `image_count` (number, required): 1-16; allowed counts per model (1; 1-4; or 1, 4, 9, 16)
  - `model` (enum, optional): see models; default 'default'
  - `aspect_ratio` (enum, optional): 1:1 (default), 16:9, 9:16
  - `resolution` (enum, optional): 640px, 1k, 2k, 4k (longest edge), auto (deprecated, default)
  - `style.tool` (enum, optional): 35 presets e.g. general (default), ai-logo-generator, thumbnail-maker, movie-poster-generator, ai-photo-generator
- Models/variants: `default`, `z-image-turbo`, `flux-2-klein`, `nano-banana-2-lite`, `nano-banana-2`, `krea-2`, `gpt-image-2.5-flare`, `gpt-image-2`, `seedream-v5-pro`, `seedream-v4`, `nano-banana`, `nano-banana-pro`, `flux-schnell`. Default: default (server-chosen; changes over time)
- resolutions: 640px, 1k, 2k, 4k
- resolutions_per_model: flux-schnell: 640px, 1k, 2k; flux-2-klein: 640px, 1k, 2k; z-image-turbo: 640px, 1k, 2k; seedream-v4: 640px-4k; seedream-v4.5: 640px-4k; seedream-v5-pro: 640px, 1k, 2k; nano-banana: 640px, 1k; nano-banana-2-lite: 640px, 1k; nano-banana-2: 640px-4k; nano-banana-pro: 1k, 2k, 4k; gpt-image-2: 640px-4k; gpt-image-2.5-flare: 640px-4k; krea-2: 640px, 1k; qwen-edit: 640px, 1k, 2k
- aspect_ratios: 1:1, 16:9, 9:16
- other: Free plan: 640px and free models only (flux-schnell, flux-2-klein, z-image-turbo, krea-2). Deprecated: seedream.
- Output: image; image_count image files via downloads[] (format unverified)
- Cost: Per image, from (lowest resolution): flux-schnell 5, flux-2-klein 5, z-image-turbo 5, krea-2 10, qwen-edit 10, seedream-v4 40, gpt-image-2 50, nano-banana 50, nano-banana-2-lite 50, seedream-v4.5 50, seedream-v5-pro 75, nano-banana-2 100, gpt-image-2.5-flare 100, nano-banana-pro 150. Higher resolution costs more; x image_count. Exact per-resolution rates unverified.
- Maintains: nothing from prior state; new content [I]
- Mutates: creates full image from prompt [D]
- Limits / failure modes:
  - Vague or conflicting prompts reduce quality.
  - Identity consistency across calls not guaranteed (inferred).
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-image-generator

## AI Image Editor

- Endpoint: `POST /v1/ai-image-editor`
- SDK: JS: client.v1.aiImageEditor.create() / .generate(); Python: client.v1.ai_image_editor.create() / .generate()
- Category: generative
- Purpose: Edit or combine one or more input images from a text instruction.
- Inputs:
  - `assets.image_file_paths` (image[], optional): max 10 (schema); per-model max additional images 1-9; marked optional in schema but needed for edits
  - `style.prompt` (text prompt, required): 1-15000 chars
  - `model` (enum, optional): see models
  - `image_count` (enum, optional): 1 (default), 4, 9, 16
  - `aspect_ratio` (enum, optional): auto (default), 16:9, 9:16, 4:3, 3:2, 1:1, 4:5, 2:3
  - `resolution` (enum, optional): 640px, 1k, 2k, 4k, auto (deprecated)
- Models/variants: `default`, `qwen-edit`, `flux-2-klein`, `nano-banana-2-lite`, `nano-banana-2`, `krea-2`, `gpt-image-2.5-flare`, `gpt-image-2`, `seedream-v5-pro`, `seedream-v4.5`, `seedream-v4`, `nano-banana`, `nano-banana-pro`. Default: default (server-chosen; changes over time)
- resolutions: 640px, 1k, 2k, 4k
- resolutions_per_model: flux-schnell: 640px, 1k, 2k; flux-2-klein: 640px, 1k, 2k; z-image-turbo: 640px, 1k, 2k; seedream-v4: 640px-4k; seedream-v4.5: 640px-4k; seedream-v5-pro: 640px, 1k, 2k; nano-banana: 640px, 1k; nano-banana-2-lite: 640px, 1k; nano-banana-2: 640px-4k; nano-banana-pro: 1k, 2k, 4k; gpt-image-2: 640px-4k; gpt-image-2.5-flare: 640px-4k; krea-2: 640px, 1k; qwen-edit: 640px, 1k, 2k
- aspect_ratios: auto, 16:9, 9:16, 4:3, 3:2, 1:1, 4:5, 2:3
- other: Max additional input images: flux-2-klein 5, krea-2 1, qwen-edit 2, others 9. Input 512x512+ recommended.
- Output: image; image file(s) via downloads[] (format unverified)
- Cost: Per image, from (lowest resolution): flux-schnell 5, flux-2-klein 5, z-image-turbo 5, krea-2 10, qwen-edit 10, seedream-v4 40, gpt-image-2 50, nano-banana 50, nano-banana-2-lite 50, seedream-v4.5 50, seedream-v5-pro 75, nano-banana-2 100, gpt-image-2.5-flare 100, nano-banana-pro 150. Higher resolution costs more; x image_count. Exact per-resolution rates unverified.
- Maintains: regions and subjects not named in the instruction [I]; subject identity (model-dependent; not guaranteed) [I]
- Mutates: content, style or composition named in prompt; can compose multiple references [D]
- Limits / failure modes:
  - Multiple edits in one instruction reduce accuracy.
  - Identity drift on people (inferred).
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-image-editor

## Face Swap Photo

- Endpoint: `POST /v1/face-swap-photo`
- SDK: JS: client.v1.faceSwapPhoto.create() / .generate(); Python: client.v1.face_swap_photo.create() / .generate()
- Category: generative
- Purpose: Replace face(s) in a target image with a source face.
- Inputs:
  - `assets.target_file_path` (image, required): image that receives the face
  - `assets.face_swap_mode` (enum, optional): all-faces (default), individual-faces
  - `assets.source_file_path` (image, optional): required for all-faces
  - `assets.face_mappings` (array of {original_face, new_face}, optional): max 5; required for individual-faces
- resolutions: plan-dependent longest edge: free 576, creator 1024, pro 1472, business 4096
- Output: image; image file via downloads[].url (format unverified)
- Cost: 10 credits per image (charged at create, refunded on failure).
- Maintains: facial expression, lighting, image quality [D]; pose, body, hair, background, composition [I]
- Mutates: face identity [D]
- Limits / failure modes:
  - no_source_face error.
  - Small/obscured faces, extreme angles, lighting mismatch.
- Source: https://docs.magichour.ai/api-reference/image-projects/face-swap-photo

## Head Swap

- Endpoint: `POST /v1/head-swap`
- SDK: JS: client.v1.headSwap.create() / .generate(); Python: client.v1.head_swap.create() / .generate()
- Category: generative
- Purpose: Place a head from one image onto the body in another image.
- Inputs:
  - `assets.body_file_path` (image, required): keeps body, pose, scene
  - `assets.head_file_path` (image, required): head reference
  - `max_resolution` (number, optional): caps larger dimension; max 2048, clamped to plan
- resolutions: <= 2048px longest edge, plan-capped
- Output: image; image file via downloads[].url (format unverified)
- Cost: 10 credits per image.
- Maintains: target body, pose, scene [D]
- Mutates: whole head incl. face, hair, broader head details [D]
- Limits / failure modes:
  - Angle, lighting, proportion mismatch; occluding hair/hands/hats; cropped heads.
- Source: https://docs.magichour.ai/api-reference/image-projects/head-swap

## Body Swap

- Endpoint: `POST /v1/body-swap`
- SDK: JS: client.v1.bodySwap.create() / .generate(); Python: client.v1.body_swap.create() / .generate()
- Category: generative
- Purpose: Place a person from one image into a scene image, replacing the scene's person.
- Inputs:
  - `assets.person_file_path` (image, required): person to insert
  - `assets.scene_file_path` (image, required): scene/background
  - `resolution` (enum, required): 640px, 1k, 2k, 4k
- Models/variants: `nano-banana-2-lite (640px/1k)`, `nano-banana-2 (2k/4k)`. Default: chosen by resolution
- resolutions: 640px, 1k, 2k, 4k
- Output: image; image file via downloads[].url (format unverified)
- Cost: From 50 credits at 640px, rising with resolution (exact rates unverified).
- Maintains: scene, background, composition [D]; person identity and appearance from person image [D]
- Mutates: person in the scene [D]; pose may adapt to scene (inferred) [I]
- Limits / failure modes:
  - Overlap/occlusion in scene, pose/angle/lighting mismatch, low-quality inputs.
- Source: https://docs.magichour.ai/api-reference/image-projects/body-swap

## AI Clothes Changer

- Endpoint: `POST /v1/ai-clothes-changer`
- SDK: JS: client.v1.aiClothesChanger.create() / .generate(); Python: client.v1.ai_clothes_changer.create() / .generate()
- Category: generative
- Purpose: Dress a person in a garment from a reference image (virtual try-on).
- Inputs:
  - `assets.person_file_path` (image, required): person
  - `assets.garment_file_path` (image, required): garment; flat lay or mannequin best
  - `assets.garment_type` (enum, optional): entire_outfit (default), upper_body, lower_body, dresses (deprecated)
- resolutions: plan-capped; hard cap 1472px
- Output: image; image file via downloads[].url (format unverified)
- Cost: 25 credits per image.
- Maintains: pose, lighting, background [D]; face identity [I]
- Mutates: clothing in selected garment region [D]
- Limits / failure modes:
  - Obstructed clothing (crossed arms), poor lighting, busy backgrounds.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-clothes-changer

## AI Headshot Generator

- Endpoint: `POST /v1/ai-headshot-generator`
- SDK: JS: client.v1.aiHeadshotGenerator.create() / .generate(); Python: client.v1.ai_headshot_generator.create() / .generate()
- Category: generative
- Purpose: Create a professional headshot from a photo of one person.
- Inputs:
  - `assets.image_file_path` (image, required): exactly one detectable face; face area >= 512x512 recommended
  - `style.prompt` (text prompt, optional): omit for default professional style
- resolutions: plan-capped; hard cap 1344px
- Output: image; image file via downloads[].url (format unverified)
- Cost: 50 credits per headshot.
- Maintains: facial features and identity [D]
- Mutates: background, attire, lighting, framing to headshot [D]
- Limits / failure modes:
  - Fails without exactly one detectable face (inferred from requirement).
  - Sunglasses, masks, profiles reduce quality.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-headshot-generator

## AI Face Editor

- Endpoint: `POST /v1/ai-face-editor`
- SDK: JS: client.v1.aiFaceEditor.create() / .generate(); Python: client.v1.ai_face_editor.create() / .generate()
- Category: generative
- Purpose: Adjust expression, gaze and head pose of a face with numeric sliders.
- Inputs:
  - `assets.image_file_path` (image, required): clear frontal face, >= 512x512 recommended
  - `style.enhance_face` (boolean, optional): default false
  - `style.<control>` (number, optional): -100..100 step 5, default 0: eyebrow_direction, eye_gaze_horizontal, eye_gaze_vertical, eye_open_ratio, lip_open_ratio, head_roll, head_pitch, head_yaw, mouth_grim, mouth_pout, mouth_purse, mouth_smile, mouth_position_horizontal, mouth_position_vertical
- resolutions: plan-dependent
- Output: image; image file via downloads[].url (format unverified)
- Cost: 1 credit per edit (endpoint text says '1 frame').
- Maintains: realistic proportions, lighting, identity [D]; background, clothing [I]
- Mutates: expression, eye gaze, mouth shape, head pose [D]
- Limits / failure modes:
  - Large slider values look unnatural; best one change at a time.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-face-editor

## AI Image Upscaler

- Endpoint: `POST /v1/ai-image-upscaler`
- SDK: JS: client.v1.aiImageUpscaler.create() / .generate(); Python: client.v1.ai_image_upscaler.create() / .generate()
- Category: generative
- Purpose: Upscale an image 2x or 4x with AI detail recovery.
- Inputs:
  - `assets.image_file_path` (image, required): max 4096x4096
  - `scale_factor` (number, required): 2 or 4; 4 needs Creator+
  - `style.mode` (enum, optional): preserve, balanced (default), creative; pro deprecated -> preserve
  - `style.prompt` (text prompt, optional): creative mode only
- Models/variants: `preserve`, `balanced`, `creative`. Default: balanced
- resolutions: input <= 4096x4096; output = input x scale_factor
- aspect_ratios: unchanged
- Output: image; image file via downloads[].url (format unverified)
- Cost: 2x: 25 (preserve) / 50 (balanced, creative); 4x: 100 / 200.
- Maintains: content and composition [D]; aspect ratio [I]; detail (preserve mode) [D]
- Mutates: resolution (2x/4x) [D]; detail enhanced (balanced) or reinterpreted (creative) [D]
- Limits / failure modes:
  - Amplifies JPEG artifacts; cannot recover missing detail; text-heavy images weak.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-image-upscaler

## Image Background Remover

- Endpoint: `POST /v1/image-background-remover`
- SDK: JS: client.v1.imageBackgroundRemover.create() / .generate(); Python: client.v1.image_background_remover.create() / .generate()
- Category: deterministic
- Purpose: Cut out the subject; optionally composite it on a new background.
- Inputs:
  - `assets.image_file_path` (image, required): file URL or file_path from POST /v1/files/upload-urls
  - `assets.background_image_file_path` (image, optional): new background; resized to match input
- resolutions: follows input (inferred)
- aspect_ratios: unchanged
- Output: image; PNG with alpha (no background given); composited image otherwise
- Cost: 5 credits per image.
- Maintains: subject at full quality [D]; dimensions [I]
- Mutates: background removed (alpha) or replaced [D]
- Limits / failure modes:
  - Fine hair on busy backgrounds, transparent objects, low subject/background contrast.
- Source: https://docs.magichour.ai/api-reference/image-projects/image-background-remover

## Photo Colorizer

- Endpoint: `POST /v1/photo-colorizer`
- SDK: JS: client.v1.photoColorizer.create() / .generate(); Python: client.v1.photo_colorizer.create() / .generate()
- Category: generative
- Purpose: Add realistic color to a black-and-white or grayscale photo.
- Inputs:
  - `assets.image_file_path` (image, required): file URL or file_path from POST /v1/files/upload-urls
- resolutions: plan-dependent (unverified)
- aspect_ratios: unchanged (inferred)
- Output: image; image file via downloads[].url (format unverified)
- Cost: 10 credits per image.
- Maintains: content, structure, composition [I]
- Mutates: color [D]
- Limits / failure modes:
  - Complex scenes give variable results; damaged scans reduce accuracy.
- Source: https://docs.magichour.ai/api-reference/image-projects/photo-colorizer

## AI GIF Generator

- Endpoint: `POST /v1/ai-gif-generator`
- SDK: JS: client.v1.aiGifGenerator.create() / .generate(); Python: client.v1.ai_gif_generator.create() / .generate()
- Category: generative
- Purpose: Generate a short animated GIF from a text prompt.
- Inputs:
  - `style.prompt` (text prompt, required): 1-500 chars
  - `output_format` (enum, optional): gif (default), mp4, webm
- duration_s: not settable
- Output: animation (image project); gif, mp4 or webm
- Cost: 50 credits per GIF.
- Maintains: nothing from prior state; no image input [D]
- Mutates: creates new short animation [D]
- Limits / failure modes:
  - No image input; no custom duration.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-gif-generator

## AI Meme Generator

- Endpoint: `POST /v1/ai-meme-generator`
- SDK: JS: client.v1.aiMemeGenerator.create() / .generate(); Python: client.v1.ai_meme_generator.create() / .generate()
- Category: generative
- Purpose: Write meme text for a topic on a fixed meme template.
- Inputs:
  - `style.topic` (text prompt, required): 1-200 chars
  - `style.template` (enum, required): Random or ~100 named templates (e.g. Drake Hotline Bling, Distracted Boyfriend)
  - `style.searchWeb` (boolean, optional): default false; search_web in Python SDK
- aspect_ratios: template-defined
- Output: image; image file via downloads[].url (format unverified)
- Cost: 10 credits per meme.
- Maintains: template image [D]
- Mutates: panel text generated for topic [D]
- Limits / failure modes:
  - Vague topics produce weak memes.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-meme-generator

## AI QR Code Generator

- Endpoint: `POST /v1/ai-qr-code-generator`
- SDK: JS: client.v1.aiQrCodeGenerator.create() / .generate(); Python: client.v1.ai_qr_code_generator.create() / .generate()
- Category: generative
- Purpose: Generate an artistic, scannable QR code.
- Inputs:
  - `content` (text, required): URL or text encoded
  - `style.art_style` (text prompt, required): preset (Watercolor, Cyberpunk City, Ink Landscape, Interior Painting, Japanese Street, Mech, Minecraft, Picasso Painting, Game Map, Spaceship, Chinese Painting, Winter Village) or free text
- aspect_ratios: 1:1 (inferred)
- Output: image; image file via downloads[].url (format unverified)
- Cost: 0 credits.
- Maintains: encoded content / scannability (goal, must test) [D]
- Mutates: visual style [D]
- Limits / failure modes:
  - Busy or low-contrast styles can break scanning.
- Source: https://docs.magichour.ai/api-reference/image-projects/ai-qr-code-generator

## AI Voice Generator

- Endpoint: `POST /v1/ai-voice-generator`
- SDK: JS: client.v1.aiVoiceGenerator.create() / .generate(); Python: client.v1.ai_voice_generator.create() / .generate()
- Category: generative
- Purpose: Text-to-speech with a preset celebrity/character voice.
- Inputs:
  - `style.prompt` (text prompt, required): max 1000 chars
  - `style.voice_name` (enum, required): 1266 preset voices (e.g. Morgan Freeman, David Attenborough)
- duration_s: set by text length (max 1000 chars)
- Output: audio; audio file via audio project downloads[] (format unverified)
- Cost: 0.1 credits per character, rounded up (max 100).
- Maintains: script text [D]
- Mutates: creates speech audio in chosen voice [D]
- Limits / failure modes:
  - No language parameter.
  - Not exposed in hosted MCP.
- Source: https://docs.magichour.ai/api-reference/audio-projects/ai-voice-generator

## AI Voice Cloner

- Endpoint: `POST /v1/ai-voice-cloner`
- SDK: JS: client.v1.aiVoiceCloner.create() / .generate(); Python: client.v1.ai_voice_cloner.create() / .generate()
- Category: generative
- Purpose: Clone a voice from a sample and speak given text with it.
- Inputs:
  - `assets.audio_file_path` (audio, required): single speaker, clean, >= 3s
  - `style.prompt` (text prompt, required): 1-1000 chars
- duration_s: set by text length (max 1000 chars)
- Output: audio; audio file via audio project downloads[] (format unverified)
- Cost: 0.1 credits per generated character, rounded up.
- Maintains: voice timbre, intonation, speaking patterns of sample [D]
- Mutates: spoken content (new text) [D]
- Limits / failure modes:
  - Noisy or multi-speaker samples degrade clone.
  - No language parameter.
  - Not exposed in hosted MCP.
- Source: https://docs.magichour.ai/api-reference/audio-projects/ai-voice-cloner

## Face Detection

- Endpoint: `POST /v1/face-detection (+ GET /v1/face-detection/{id})`
- SDK: JS: client.v1.faceDetection.create() / .generate(); Python: client.v1.face_detection.create() / .generate()
- Category: deterministic
- Purpose: List faces in an image or video to build face_mappings for multi-face swaps.
- Inputs:
  - `assets.target_file_path` (image | video, required): file URL or file_path from POST /v1/files/upload-urls
  - `confidence_score` (number, optional): 0-1, default 0.5
- Output: face list; faces[] {path '<frame>-<index>.png', url}; status queued|rendering|complete|error
- Cost: Free for now (pricing may change).
- Maintains: input media unchanged (analysis only) [I]
- Mutates: -
- Limits / failure modes:
  - Low confidence_score adds false detections; high drops faces.
- Source: https://docs.magichour.ai/api-reference/files/face-detection

## Generate Asset Upload URLs

- Endpoint: `POST /v1/files/upload-urls`
- SDK: JS: client.v1.files.uploadUrls.create(), client.v1.files.uploadFile(); Python: client.v1.files.upload_urls.create(), client.v1.files.upload_file()
- Category: deterministic
- Purpose: Get pre-signed PUT URLs and file_path values to upload local inputs.
- Inputs:
  - `items[].type` (enum, required): video, audio, image
  - `items[].extension` (text, required): video: mp4 m4v mov webm; audio: mp3 wav aac flac webm weba m4a opus ogg oga aiff amr; image: png jpg jpeg jfif heic heif webp avif jp2 tiff tif bmp; gif only for face swap video
- other: Upload size: free 200MB, creator 2GB, pro 5GB, business 10GB. Uploads deleted after 7 days.
- Output: upload targets; items[] {upload_url, expires_at, file_path}
- Cost: None documented.
- Maintains: file bytes [I]
- Mutates: -
- Limits / failure modes:
  - Upload URL expiry; unsupported extension.
- Source: https://docs.magichour.ai/api-reference/files/generate-asset-upload-urls

## Workflow endpoints (not state transforms)

- `GET /v1/video-projects/{id}`, `GET /v1/image-projects/{id}`, `GET /v1/audio-projects/{id}`: status, `downloads`, `credits_charged`, `error {code, message}`.
- `DELETE /v1/{video|image|audio}-projects/{id}`: delete output (irreversible).
- `GET /v1/account`: credit balance, plan. `GET /v1/saved-items`: saved assets with reusable `file_path`.
- Hosted MCP (`https://mcp.magichour.ai/`, 44 tools): one `*_create_*` tool per endpoint above, plus `ping`, `wait_for_{video|image|audio}_project`, `fetch_{video|image|audio}_download`. Voice generator and voice cloner are NOT exposed in MCP.

## Gaps and conflicts

- No public endpoint for: voice changer, video upscaler, video colorizer, image expander, music/sound effect generator. Project-type enums list them (VOICE_CHANGER, VIDEO_UPSCALER, MUSIC_GENERATOR, etc.), so they exist in the web app only (inferred).
- Output file formats are undocumented except background remover (PNG) and GIF generator (gif/mp4/webm). Video assumed mp4, unverified.
- AI Video Editor: OpenAPI lists `ltx-2.5` (0.5-20s) and `ltx-2.3`, free default LTX 2.5; models page and tool page say `ltx-2.3` (0.5-45s) is the free default.
- Video model resolutions: OpenAPI gives `seedance-2.0` up to 4k and `seedance-2.5` up to 1080p; models page gives both 480p/720p only.
- `sora-2` is in the model enum and models page (720p; 4-60s) but has no per-model entry in OpenAPI field docs.
- Character Replace: tool page lists only 480p/720p; OpenAPI adds `kling-3.0` at 720p/1080p. kling-3.0 rate unverified.
- Text-to-Video `references[]` {name, file_path}: no field descriptions.
- AI Talking Photo summary says "audio or text input"; schema needs audio. Docs say generate audio first with AI Voice Generator.
- AI Video Editor and AI Video Translator credit rates are not on the models page.
- AI Face Editor: endpoint text says "1 frame", models page says 1 credit.
- Exact per-resolution image credit rates and body swap rates above 640px are not published.

## Sources (accessed 2026-10-05)

- https://docs.magichour.ai/api-reference/openapi.json (OpenAPI 3.0.2, primary source)
- https://docs.magichour.ai/llms.txt
- https://docs.magichour.ai/api-reference/models.md
- https://docs.magichour.ai/billing/resolution-limits.md
- https://docs.magichour.ai/integration/inputs-and-outputs.md
- https://docs.magichour.ai/integration/model-context-protocol.md
- https://docs.magichour.ai/tools/{video,image,audio}/*.md (29 tool guides)
- https://mcp.magichour.ai/ (public tools/list, 44 tools)
- npm `magic-hour` v0.82.0 type definitions (dist/resources/v1)
- PyPI `magic-hour` v0.86.0 (resources/v1)
- Hint only: archived/server/src/magicHourCapabilities.ts (prototype used SDK v0.70)
