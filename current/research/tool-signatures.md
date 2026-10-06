# Tool Signatures

- Machine-readable twin: `current/tests/fixtures/tool-signatures.json`. Source: `magic-hour-tools.json` maintains/mutates. Accessed 2026-10-05.
- `atom ← slot`: the output atom comes from that input slot. `makes true`: the tool sets the atom. `drops`: input atom with no output guarantee; the solver gives no credit.
- `?` = optional slot. Entity atoms apply per entity. "all other atoms" = every in-scope atom not listed elsewhere on the line.
- Atoms the prompt names win over pass-through for AI Image Editor and AI Video Editor.

| Atom | Scope | Definition |
| :- | :- | :- |
| identity | entity | Who the entity is: face and recognizable likeness (for a product or logo: its brand identity). |
| head_hair | entity | Hair and head shape outside the face. |
| body | entity | Body build, skin and proportions. |
| wardrobe | entity | Clothing and accessories the entity wears. |
| expression | entity | Facial expression and eye gaze. |
| pose_action | entity | Body and head pose, and the motion or action over time. |
| speech_sync | entity | Mouth motion matches the speech_audio track. |
| voice | entity | Voice timbre and speaking manner of the entity. |
| background | scene | Setting and environment behind the entities. |
| lighting | scene | Light direction, quality and colour on the scene. |
| props | scene | Objects in the scene that are not entities or wardrobe. |
| camera | scene | Framing, shot size, angle and camera motion. |
| style | scene | Visual rendering: art style, palette, colour grade. |
| text | layer | On-screen text and graphic overlays: captions, titles, logos. |
| speech_audio | layer | Spoken-word audio: words, language, timing. |
| music | layer | Music track. |
| sfx | layer | Sound effects and ambient sound. |
| media_type | format | Output media: image, video, audio or data. |
| duration | format | Length in seconds. |
| aspect | format | Aspect ratio. |
| resolution | format | Pixel dimensions. |
| frame_rate | format | Frames per second. |

**Video output**

- **Image-to-Video** [mixed]: image_file_path: all image atoms; end_image_file_path?: all image atoms; style.prompt?: pose_action, expression, camera → video (identity, head_hair, body, wardrobe, background, lighting, props, style ← image_file_path (t=0; end_image_file_path at t=end when given); aspect ← image_file_path; makes true: media_type, pose_action, expression, camera, duration, resolution; drops: image_file_path.text, end_image_file_path.text)
- **Text-to-Video** [mixed]: style.prompt: identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, text; references?: identity → video (identity ← references (inferred; field undocumented; when given); makes true: media_type, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, duration, aspect, resolution; no guarantee: text, speech_sync, voice, speech_audio, music, sfx, frame_rate)
- **AI Talking Photo** [mixed]: image_file_path: all image atoms; audio_file_path: all audio atoms; style.prompt?: background, camera, pose_action → video (all other atoms ← image_file_path; voice, speech_audio, music, sfx ← audio_file_path; duration ← audio_file_path [start_seconds, end_seconds]; makes true: media_type, speech_sync, expression, pose_action; drops: image_file_path.text, image_file_path.resolution)
- **Lip Sync** [mixed]: video_file_path: all video atoms; audio_file_path: all audio atoms → video (all other atoms ← video_file_path; voice, speech_audio, music, sfx ← audio_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, speech_sync)
- **Face Swap Video** [mixed]: video_file_path: all video atoms; image_file_path?: identity; face_mappings[].new_face?: identity → video (identity ← image_file_path (all-faces) | face_mappings[].new_face (individual-faces, per entity); all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type)
- **Video-to-Video** [mixed]: video_file_path: all video atoms; style.prompt?: style → video (all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, style, frame_rate; drops: video_file_path.voice, video_file_path.text, video_file_path.speech_audio, video_file_path.music, video_file_path.sfx, video_file_path.resolution)
- **AI Video Editor** [mixed]: video_file_path: all video atoms; style.prompt: props, background, style, wardrobe, lighting → video (all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, props, background, style, resolution; drops: video_file_path.voice, video_file_path.text, video_file_path.speech_audio, video_file_path.music, video_file_path.sfx, video_file_path.frame_rate)
- **AI Video Translator** [inferred]: video_file_path: all video atoms → video (all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, speech_audio, speech_sync, resolution; drops: video_file_path.music, video_file_path.sfx, video_file_path.frame_rate)
- **Animation** [mixed]: style.prompt?: background, props, pose_action, lighting; style.art_style_custom?: style; audio_file_path?: all audio atoms; image_file_path?: all image atoms → video (voice, speech_audio, music, sfx ← audio_file_path; makes true: media_type, background, props, pose_action, lighting, style, camera, duration, aspect, resolution, frame_rate; drops: image_file_path.identity, image_file_path.head_hair, image_file_path.body, image_file_path.wardrobe, image_file_path.expression, image_file_path.text)
- **Audio-to-Video** [mixed]: audio_file_path: all audio atoms; image_file_path?: all image atoms; style.prompt?: background, props, style, pose_action, camera → video (identity, head_hair, body, wardrobe, lighting, aspect ← image_file_path (initial frame; when given); voice, speech_audio, music, sfx ← audio_file_path; duration ← audio_file_path [start_seconds, end_seconds]; makes true: media_type, background, props, style, pose_action, camera, expression, resolution; drops: image_file_path.text)
- **Character Replace** [mixed]: video_file_path: all video atoms; image_file_path: all image atoms → video (identity, head_hair, body, wardrobe ← image_file_path; all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, resolution; drops: video_file_path.voice, video_file_path.text, video_file_path.speech_audio, video_file_path.music, video_file_path.sfx, video_file_path.frame_rate, image_file_path.text)
- **Auto Subtitle Generator** [mixed]: video_file_path: all video atoms → video (all other atoms ← video_file_path; duration ← video_file_path [start_seconds, end_seconds]; makes true: media_type, text)
- **AI GIF Generator** [mixed]: style.prompt: identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, text → video (makes true: media_type, identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style; no guarantee: text, speech_sync, voice, speech_audio, music, sfx, duration, aspect, resolution, frame_rate)

**Image output**

- **AI Image Generator** [mixed]: style.prompt: identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, text → image (makes true: media_type, identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, aspect, resolution; no guarantee: text)
- **AI Image Editor** [mixed]: image_file_paths[0]: all image atoms; image_file_paths[1..]?: identity, wardrobe, props, background, style; style.prompt: wardrobe, expression, pose_action, background, lighting, props, camera, style → image (identity, head_hair, body ← image_file_paths[0] (or image_file_paths[n] when the prompt says so); text ← image_file_paths[0]; makes true: media_type, wardrobe, expression, pose_action, background, lighting, props, camera, style, aspect, resolution)
- **Face Swap Photo** [mixed]: target_file_path: all image atoms; source_file_path?: identity; face_mappings[].new_face?: identity → image (identity ← source_file_path (all-faces) | face_mappings[].new_face (per entity); all other atoms ← target_file_path; makes true: media_type; drops: target_file_path.resolution)
- **Head Swap** [mixed]: body_file_path: all image atoms; head_file_path: identity, head_hair, expression → image (identity, head_hair, expression ← head_file_path; all other atoms ← body_file_path; makes true: media_type, resolution)
- **Body Swap** [mixed]: person_file_path: identity, head_hair, body, wardrobe, expression, pose_action; scene_file_path: all image atoms → image (identity, head_hair, body, wardrobe, expression ← person_file_path; background, lighting, props, camera, style, text, aspect ← scene_file_path; makes true: media_type, pose_action, resolution)
- **AI Clothes Changer** [mixed]: person_file_path: all image atoms; garment_file_path: wardrobe → image (wardrobe ← garment_file_path (region per garment_type; other regions from person); all other atoms ← person_file_path; makes true: media_type; drops: person_file_path.resolution)
- **AI Headshot Generator** [mixed]: image_file_path: all image atoms; style.prompt?: background, wardrobe, lighting, camera, style → image (identity ← image_file_path; makes true: media_type, background, wardrobe, lighting, camera, style; drops: image_file_path.head_hair, image_file_path.body, image_file_path.expression, image_file_path.pose_action, image_file_path.props, image_file_path.text, image_file_path.aspect, image_file_path.resolution)
- **AI Face Editor** [mixed]: image_file_path: all image atoms → image (all other atoms ← image_file_path; makes true: media_type, expression, pose_action; drops: image_file_path.resolution)
- **AI Image Upscaler** [mixed]: image_file_path: all image atoms; style.prompt?: style → image (all other atoms ← image_file_path; makes true: media_type, resolution)
- **Image Background Remover** [mixed]: image_file_path: all image atoms; background_image_file_path?: background → image (all other atoms ← image_file_path; background ← background_image_file_path (when given; else transparent alpha); makes true: media_type; drops: image_file_path.props, image_file_path.text)
- **Photo Colorizer** [mixed]: image_file_path: all image atoms → image (all other atoms ← image_file_path; makes true: media_type, style)
- **AI Meme Generator** [mixed]: style.topic: text → image (makes true: media_type, text, identity, head_hair, body, wardrobe, expression, pose_action, background, lighting, props, camera, style, aspect, resolution)
- **AI QR Code Generator** [mixed]: content: text; style.art_style: style, background → image (makes true: media_type, text, style, background; no guarantee: identity, head_hair, body, wardrobe, expression, pose_action, lighting, props, camera, aspect, resolution)

**Audio output**

- **AI Voice Generator** [documented]: style.prompt: speech_audio → audio (makes true: media_type, speech_audio, voice; no guarantee: music, sfx, duration)
- **AI Voice Cloner** [documented]: audio_file_path: all audio atoms; style.prompt: speech_audio → audio (voice ← audio_file_path; makes true: media_type, speech_audio; drops: audio_file_path.music, audio_file_path.sfx, audio_file_path.duration)

**Data output**

- **Face Detection** [inferred]: target_file_path: all image atoms → data (identity ← target_file_path (one face crop per detected entity))
- **Generate Asset Upload URLs** [inferred]: none → data (no atom change)

**Not offered by Magic Hour**

- **music_score** (unbound) [inferred]: brief: music → audio (makes true: media_type, music, duration; no guarantee: voice, speech_audio, sfx)
- **sound_effects** (unbound) [inferred]: brief: sfx → audio (makes true: media_type, sfx, duration; no guarantee: voice, speech_audio, music)
- **text_overlay** (ours, deterministic) [inferred]: base: all video atoms; text: text → video|image (all other atoms ← base; text ← base (existing) + text slot (added))
- **logo_overlay** (ours, deterministic) [inferred]: base: all video atoms; logo: text → video|image (all other atoms ← base; text ← base (existing) + logo (added))
- **fade** (ours, deterministic) [inferred]: base: all video atoms → video|image (all other atoms ← base)
- **transform** (ours, deterministic) [inferred]: base: all video atoms → video|image (all other atoms ← base; makes true: camera)
- **crop_reformat** (ours, deterministic) [inferred]: base: all video atoms → video|image (all other atoms ← base; makes true: camera, aspect, resolution)
- **trim** (ours, deterministic) [inferred]: base: all video atoms → video|image (all other atoms ← base; makes true: duration)
- **stitch** (ours, deterministic) [inferred]: segments[i]: all video atoms → video (all other atoms ← segments[i] over its time range [t_i, t_i + duration_i]; media_type ← segments[*]; makes true: duration)
- **audio_mix_mux** (ours, deterministic) [inferred]: video: identity, head_hair, body, wardrobe, expression, pose_action, speech_sync, background, lighting, props, camera, style, text, media_type, duration, aspect, resolution, frame_rate; speech?: voice, speech_audio; music?: music; sfx?: sfx → video (all other atoms ← video; voice, speech_audio ← speech; music ← music; sfx ← sfx)

**Join tools**

- stitch joins segments in time: each segment keeps its atoms in its own time range.
- audio_mix_mux joins layers: visual atoms ← video, voice and speech_audio ← speech, music ← music, sfx ← sfx.
- The solver splits a goal into per-segment or per-layer sub-goals and joins the results with these tools.

**Open gaps**

- No atom covers opacity or layer visibility over time (fade).
- Text-to-Video `references` semantics are undocumented.
- AI Video Translator: only the language change is documented; the rest is inferred.
- Audio pass-through is undocumented for Video-to-Video, AI Video Editor and Character Replace; mux the source audio back.
