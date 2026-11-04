# T-016 · Voice consistency check across clips

- status: open · priority: medium · subsystem: sound, state
- what: a gate like the identity gate for faces: for each character, compare the voice in every clip against the voice bank sample (a speaker-similarity score, or an audio-capable model asked whether two samples are the same speaker) and flag clips that drift; keep the transcription check for the words and add a loudness check.
- why: the clip gate looks at frames only; nothing checks the voices.
- acceptance: a per-clip voice verdict in run.json next to identity; flags only, no remakes.
