# T-017 · Which voice strategy holds: in-clip, conversion, or TTS plus lip sync

- status: open · priority: high · subsystem: sound
- update 2026-10-30 (from reference/magic-hour-api-sheet.md): Magic Hour's API has NO speech-to-speech voice conversion and no sound-effects endpoint (web-app only), so option (b) is out unless another provider is added; the test is (a) in-clip voices vs (c) TTS from the bank preset plus lip sync at 1 credit per frame (lite), with max_fps_limit to cut cost.
- what: on one dialogue scene, compare (a) voices generated inside the clips from descriptors (today), (b) each clip's dialogue converted to the character's bank sample by speech-to-speech voice conversion (timing and lips unchanged), (c) lines made by TTS from the bank sample and the clip lip-synced to them (Magic Hour lip sync, about 1 credit per frame). Measure same-speaker similarity across clips, transcription accuracy, lip-sync quality by eye, and cost.
- why: the right answer depends on what Magic Hour and the OpenAI audio endpoints actually offer; (b) is the cleanest if a conversion endpoint exists, because the clip keeps its own performance.
- acceptance: a results page with the three versions side by side and the numbers; a decision recorded in the PRD decisions log.
