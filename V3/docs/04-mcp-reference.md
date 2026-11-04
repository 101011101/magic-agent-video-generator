# What the Magic Hour MCP actually does (reference, measured 2026-11-01/02)

Source: the live `tools/list` of https://mcp.magichour.ai/ (48 tools), the guide text the MCP returned in our runs,
and every call it made in `V2/bench/v1/results/mcp-*` (about 160 items). The MCP arm is a stock chat model with the MCP
connected and a one-paragraph system prompt (free plan, attachments already uploaded, give links at the end).

## The logic, end to end

1. `get_workflow_guide {"workflow":"video-generator"}` — static text, no credits.
2. The chat model writes **one prose prompt itself**. No story step, no template, no state.
3. `create_video_from_text` with `model: "ltx-2.5"`, `resolution: "480p"`, `audio` on or off, no references.
4. `wait_for_video_project`, `get_video_project`, hand back the link. No machine review.

## The video-generator guide, verbatim fields

- input: "A description of a new scene; use image-to-video when a specific reference image matters."
- steps:
  1. "Use text-to-video for a new scene without a required likeness; use an image reference and image-to-video when
     identity must stay consistent."
  2. "Specify the subject, one action, camera move, framing and mood. Request only audio and duration supported by the
     selected model."
  3. "Call create_video_from_text, then wait_for_video_project with the returned id and review the actual result."
- example_request: "Create a short cinematic scene of a tiny astronaut discovering a glowing forest inside a glass
  bottle, with a slow orbiting camera."
- follow_up: "Edit or subtitle the accepted result instead of paying to regenerate unchanged footage."
- review: "Check prompt adherence, continuity, audio and output settings for the selected model."
- guidance: seven generic lines (credits, async jobs, do not re-create on timeout, commercial terms) and four doc links.

Eight guides exist: video-generator, image-to-video, image-editor, video-face-swap, lip-sync, ugc-ads, talking-photo,
media-apis. All have the same fields. None mentions several clips, continuity between clips, or stitching.

Related lines from the other guides that shape its behaviour:
- image-editor follow_up: "Animate the accepted still with create_video_from_image rather than recreating its identity
  from a text prompt."
- image-to-video steps: "Describe subject motion and one camera move; preserve identity, style, lighting and aspect
  ratio from the reference." review: "Check identity, anatomy, motion and the first and last frames. Keep one clear
  action and camera move; add exact text in a separate editing step."

## The prompt it wrote for the flower ad (I94a), 1,297 characters

> Create a 16-second cinematic advertisement for Petal & Stem, a small neighbourhood flower shop. Widescreen 16:9.
> Photorealistic, intimate, warm natural dawn sunlight, soft golden highlights, authentic lived-in neighbourhood,
> inviting artisanal atmosphere. Four coherent shots with natural edits, same florist, shop and bouquet throughout.
> 0–4 seconds: exterior medium-wide shot at dawn, an adult florist wearing a sage-green apron unlocks and opens the
> wood-and-glass shop door, warm sunlight illuminating flower buckets beside the entrance. 4–9 seconds: interior
> close-ups of the florist's hands gently arranging a beautiful bouquet of blush pink roses, cream flowers and fresh
> greenery, wrapping it in brown kraft paper; delicate textures, shallow depth of field, slow smooth camera movement.
> 9–12 seconds: medium shot at the open doorway, the florist hands the finished bouquet to a smiling adult customer, a
> friendly genuine neighbourhood exchange, natural hands and anatomically correct movement. 12–16 seconds: cut to a
> welcoming straight-on exterior establishing shot of the same charming flower shop, slowly ease backward to reveal the
> entire storefront with flowers framing its door; clear tasteful shop sign reads exactly 'Petal & Stem'. Hold on the
> storefront for the final two seconds. Gentle cinematic colour grade, realistic flowers, calm uplifting pacing. No
> voiceover, no subtitles, no other text overlays.

Settings: `end_seconds 16, aspect_ratio 16:9, resolution 480p, model ltx-2.5, audio false`. 384 credits. Judge: 87–88.

## Universal properties of its video prompts (all runs)

Duration and aspect in the first sentence; one look-and-light description; a "same X throughout" sentence; numbered
time ranges covering the whole duration; one action per range; the camera stated per range; exact text quoted once;
spoken lines quoted with time ranges and the speaker when audio is on; a hold at the end; negatives last; one paragraph;
under 2,000 characters.

## Limits it hit

- **`style.prompt` max 2,000 characters.** The schema says 20,000; the API returns 400 "style.prompt must be at most
  2000 characters". Every 30 s and 60 s run failed once on this and retried shorter (3,639 → 1,854 chars on I92a). The
  second create call in those runs is that retry, not a split.
- **ltx-2.5 takes no references.** Reference support: gemini-omni-1.1, kling-3.0/4.0, minimax-h3 (images, videos,
  audio), seedance-2.x, veo3.1 (3 images, 8 s only), wan-3.0. On the free tier only minimax-h3.
- **No joining.** No concat, trim, frame extraction or overlay among the 48 tools. Over 60 s it has no path.

## Where its references came from

Only two sources, ever:
1. **The user's attachments.** All of them, named by content (`storefront`, `latte`, `barista`), on minimax-h3, with a
   timeline in the prompt: "0–2 seconds @storefront café exterior; 2–4 seconds @latte overhead latte …" and "preserve
   the actual café, objects, people … show each supplied photo individually". It asked for the paste-in on purpose.
2. **A still it made first** with `generate_image`, then `create_video_from_image` with that still's URL as the start
   frame on ltx-2.5 (the cat, the event reels, the product ad).

Never a frame from a clip it had made. It does not choose a subset; it uses what it has.

## Image-to-video on the free tier

`create_video_from_image` takes `assets.image_file_path` (start frame) and `assets.end_image_file_path` (last frame).
Both are supported on ltx-2.5 at 480p, up to 60 s. This is the continuity mechanism V3 uses between clips.

## Image-to-video: the guide and the prompt shape it produced

Guide (verbatim fields):
- input: "A reference image and a motion instruction."
- steps: 1. "Animate the approved supplied image directly when it already meets the brief. Use Image Editor only for a
  requested visual change or a source problem that prevents the shot." 2. "Describe subject motion and one camera
  move; preserve identity, style, lighting and aspect ratio from the reference." 3. "Call create_video_from_image with
  a supported model, resolution and duration, then wait_for_video_project with the returned id."
- example_request: "Animate this portrait: the pilot turns toward a distant planet as the camera slowly pushes in. Keep
  the face and outfit consistent."
- follow_up: "Keep the accepted footage for captions, lip sync or later editing. For a new shot, reuse the same
  reference image."
- review: "Check identity, anatomy, motion and the first and last frames. Keep one clear action and camera move; add
  exact text in a separate editing step."

Its image-to-video prompts (all ltx-2.5, 456–1,264 chars) keep the text-to-video slots but swap two:
- the LOOK slot becomes a **PRESERVE** slot: "Preserve the bottle shape, matte black material, cap and handle …
  Keep the table, room, windows, background, lighting and framing unchanged."
- the FORMAT slot shrinks to the aspect ("Square 1:1 composition matching the source image") because the picture
  already fixes the look.
- the first beat describes the picture as it is, so the model continues it instead of cutting away; a locked-off camera
  is stated when the frame must hold.
- longer ones (15 s product ad) still carry timed beats, exact words and sound exactly as text-to-video does.
