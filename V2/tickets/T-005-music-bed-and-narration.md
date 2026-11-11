# T-005 · Music bed and narration

status:     done 2026-10-30 (narration: TTS from the narrator preset mixed under the film; music: one film-level bed from the FILM cue, mixed and ducked at the stitch; first heard in the Top Gun rerun)
confirmed:  2026-10-30, reference/magic-hour-api-sheet.md: /v1/ai-music-generator takes a prompt, a duration of 15 to 300 s and optional lyrics or instrumental, 1 credit per second; the API has no sound-effects endpoint (web app only)
priority:   medium
subsystem:  sound, edit

what:
Two renderers: a music bed from the scene's `music` cue through Magic Hour's `/v1/ai-music-generator`, mixed under the
stitched film at a level that leaves the voices clear; narration from `vo` beats (T-004) spoken by TTS and mixed under
at their seconds. For a music-led film, the track's beat grid drives the cuts. Keep TTS plus `/v1/lip-sync` as the
fallback when one voice must hold across clips.

why:
Sound today is whatever the clip model performs: dialogue, ambience and effects, which was enough for the Vanderbilt film.
Ads, documentaries, explainers, trailers and storybooks need a bed and a narrator, and the clip model cannot keep one
voice from clip to clip (the veo3.1 dialogue test followed the descriptors but changed voice between clips).

acceptance:
The vanderbilt6 film with a bed under it and the source note spoken as narration over the last shot; the dialogue still
heard by the transcription check; the credits for music and TTS stated.
