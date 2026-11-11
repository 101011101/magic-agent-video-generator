# T-032 · A podcast through the pipeline

status:     open
priority:   medium
subsystem:  story, screenplay, sound, edit, state

what:
A new film kind, `podcast`, that runs the same chain and exercises what the ad never did: minutes of dialogue, a few
setups reused many times, voices that must hold across dozens of clips, and audio that sets the length rather than the
shot list.

1. **Story.** The brief sheet (T-030) gives the topic, the speakers (two or three; name, role, register), the length
   (2 to 10 minutes) and the platform. The story is the conversation's arc: the segments, who leads each, the turn.
2. **Screenplay.** `PACING.podcast`: shots of 5 to 15 seconds or the longest the clip model allows; the screenplay is
   the transcript, one line per turn with the speaker, and the camera alternates between three setups only: the wide
   of the table and a single per speaker, cutting on the speaker and holding on reactions. The screenplay checks add:
   every line has a speaker from the cast; no setup beyond the three; a cut on every speaker change or every N seconds.
3. **State.** The three setups are three stills, painted once and reused for every clip (the state manager's reuse of
   a repeated frame already does this); the only continuity is who leans, who holds the mug, the clock.
4. **Sound.** Voices from the bank, one TTS pass per line (T-013, T-018); the line's audio length sets the clip's
   `end_seconds`, not the other way round; lip-sync through T-019 or through a clip model that takes a voice reference
   (minimax-h3, wan-3.0, seedance 2.x) in sequence mode; room tone from T-014; no music bed, or a bed on the intro and
   outro only.
5. **Edit.** Sequences of the same setup joined without a cut (T-025); the 16:9 episode plus a 9:16 cut of one segment
   for the platform, which is the first test of the aspect field.

why:
The feedback of 2026-10-31 asked for more than one kind of example. A podcast is cheap on pictures (three stills) and
expensive on exactly the things the ad hid: voice consistency over minutes, lip-sync, clip length driven by audio, and
long sequences. It is also the one kind where the free video models' weaknesses (fine motion, 480p) matter least.

acceptance:
One two-minute episode from one brief on the free tier, about 3,000 credits at 480p (120 s at 24 a second, plus three
stills), in `V2/runs/podcast-<label>/` with its results page: speaker identity held on every clip by the people gate,
the transcript matching the audio (the clip gate's transcription), lip-sync judged by eye per clip, the 9:16 cut
produced. It then becomes the `podcast-2min` case of the benchmark (T-031).
