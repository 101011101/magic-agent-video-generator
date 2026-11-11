# T-020 · Matching sound to video: at generation time or afterwards

- status: open · priority: high · subsystem: sound, edit
- what: document and test the two ways a line reaches a clip. AT GENERATION: the video model performs the line itself from a descriptor (wan-3.0 audio free, veo3.1 and kling-3.0 audio paid); lips, timing and voice come together; the voice is sampled fresh per clip. AFTERWARDS: the clip is made silent or its audio dropped, the line is produced separately (a preset or bank voice by TTS), and joined by lip sync (T-019), or the clip's own dialogue is converted to the bank voice by speech-to-speech conversion if an endpoint exists (timing and lips kept). Narration is always afterwards: one TTS voice mixed under the film at the stitch (built).
- why: the user asked which is right; the answer is measured, not argued: consistency across clips versus performance quality and cost.
- acceptance: one dialogue scene produced both ways (and converted, if conversion exists); a results page with the versions side by side, the speaker-similarity numbers across clips, the transcription results and the credits; the decision written into PRD.md §10.
