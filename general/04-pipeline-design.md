# The pipeline design (agreed 2026-11-02)

Three tiers. A request is routed by what it needs, and the aim at every tier is the fewest calls that make the thing.

## Tier 1 · simple: do what the MCP does

Text prompt, or text plus at most one picture, one deliverable. Image generation, an image edit with one reference,
a single clip of up to 60 s with at most one reference, music, a voice line, a face swap on one photo, an upscale,
background removal, subtitles, a caption, a trim, a cut or a fade between existing clips.

Logic, identical to the MCP's loop: read the guide for the workflow → write one prompt (for images: a full
description, qwen-image-2.1 when words appear; for a clip: the measured prose shape) → one call → review the real
result. Our only additions:
- **the sheet**: fill every field we can from the natural language (duration, aspect, exact words, sound, the one
  reference), and ask follow-up questions only for what cannot be derived (a missing date, which of two people);
- **deterministic guards**: input and output types match the tool, aspect and duration are on the model's grid,
  the credit cap, the one-reference rule, exact text goes through the overlay tool rather than the generator, a
  sound bed is stripped when no sound was asked for.

Edits of an existing clip are this tier. They are tools, not video creation: no story, no sequences.

## Tier 2 · specific pictures: the MCP's tools, our selection rules

The user attached pictures and wants them used. Choose the tool by what is attached (face swap, head swap, character
replace, image-to-video, talking photo, product shot…) with the same guards and follow-up questions, and:
- **at most ONE reference goes into any generation call**, chosen in this order: person › brand or copy (logo,
  label, sign) › product › environment;
- every other attached picture is turned into words: its commonly understood name when it is a well-known thing (the
  Golden Gate Bridge, a Bugatti Tourbillon), a VLM description when the model has likely never seen it;
- a reference is **clean** only if no free image editor touched it: the user's photo, a web photo, or a text-to-image
  result made from a full description with no picture attached.

## Tier 3 · video production

Anything that needs a story: several scenes, several clips, a narrative longer than one call.
1. **Story**: natural language → a setting block (places relationally, each person with 2–4 anchors, light and grade)
   and one paragraph per clip; questions to the user about the story where the sheet has gaps.
2. **Fiction or not**: a well-known real thing is named by its common name; an unfamiliar real thing gets a VLM
   description of a found photo; invented things are described once and the words reused verbatim in every clip.
3. **Sequences → clips**: each clip is a Tier 1 call (setting + its paragraph + the guide). The only reference a clip
   may take is the LAST FRAME of the previous clip, or a user-supplied start frame for clip 1 (one reference, the
   priority order above). Nothing else: no key frames, no composites, no multi-reference calls.
4. **Join**: the clips go back to the loop for cuts, fades, sound, captions and sizes (Tier 1 tools).

## The edges, so nothing falls between the tiers

- A new scene inside a film (the previous last frame is the wrong place): that clip takes no reference and relies on
  the repeated setting words. Measured: this holds types (the MCP's three-clip student film), not a specific face.
- A specific person who must appear across several clips: their photo is clip 1's single reference; later clips
  carry them by last frame while the scene continues, and by words when the scene changes. If that is not enough, it
  is a paid-tier job, and the agent says so.
- Two things that each need a picture (a person and a product): person wins the single reference slot; the product
  becomes words; if the product's look is the point, it gets its own clip where it is the reference.
- Exact lettering in video: a prompt may ask for it once (signs hold about half the time); anything that must be
  exact is overlaid by the tool afterwards.
- Spoken lines: one short line per beat; with audio off, strip minimax's bed; with audio on, transcribe and check.
- Over 60 s of one continuous scene: split at a beat boundary and continue from the last frame.

## What the MCP has (48 tools), and what we add

Create: generate_image, edit_image, create_video_from_text, create_video_from_image, create_animation,
create_video_from_audio, create_gif_or_short_video, create_talking_photo, create_spoken_ad_video, create_lip_sync_video,
generate_music, generate_headshot, create_meme, create_qr_code. Transform: swap_face_in_photo, swap_head_in_photo,
swap_face_in_video, replace_character_in_video, place_person_in_scene, change_clothes_in_photo, edit_face_in_photo,
edit_video, restyle_video, translate_video, add_subtitles_to_video, upscale_image, upscale_video,
remove_image_background, colorize_photo, detect_faces. Plumbing: get_workflow_guide, waits, fetches, uploads, projects.

We wrap the same calls and add what it cannot do: text-to-speech, text overlay with exact words, trim, cut, fade,
concat, music under speech, frame extraction (for the last frame), a VLM review with one retry, the ledger.
