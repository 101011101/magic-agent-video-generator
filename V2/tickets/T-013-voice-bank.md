# T-013 · Voice bank: one fixed voice per character

- status: open · priority: high · subsystem: assets, sound
- what: identity has two halves, face and voice. The assets stage keeps a voice entry per character next to the portrait: the descriptor from research (documented where the record says anything: Lincoln high and reedy, Kentucky; otherwise plausible for age and origin), and a short approved voice sample (TTS from the descriptor, or a library voice chosen to match), fixed once and reused for every line of the film. The state manager's elements table carries it.
- why: the video model samples a new voice per clip; the same man sounds different from cut to cut. The sample is the audio analogue of the portrait.
- acceptance: run.json bank entries have voice {descriptor, sample file, source}; the user approves samples like portraits; every clip prompt and every TTS line derives from the same entry.
