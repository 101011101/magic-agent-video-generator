# T-019 · Lip sync: inputs, cost, and where it sits

- status: open · priority: medium · subsystem: edit, sound
- confirmed 2026-10-30 (reference sheet): /v1/lip-sync takes a video and an audio file; 1 credit per frame in lite and standard, 2 in pro; max_fps_limit lowers the frame count and the cost; a still with a voice goes to the talking-photo tool instead (20 credits per second prompted, 48 realistic).
- what: Magic Hour's lip-sync endpoint takes a VIDEO clip and an AUDIO track (the voice) and returns the clip with the mouth re-animated to that audio; modes lite and pro; about 1 credit per frame in lite (a 4-second clip at 30 fps is about 120 credits; a 30-second film about 900). The clip is generated with its own audio muted or stripped, the line is made by TTS from the character's voice (T-013, T-018), and the two are joined here.
- why: this is the path that guarantees one voice per character across every clip, at the price of a second pass per clip and the loss of the video model's own vocal performance.
- acceptance: a function in src/sound or src/edit that takes (clip, audio) and returns the synced clip with its cost recorded; tested on one dialogue clip of vanderbilt6; the result compared by ear and by the transcription check against the in-clip version.
