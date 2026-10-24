# Pipeline v2

> Status: first working version (2026-10-07). Built on the litmus tests (`current/research/litmus/`). Fixes come from `current/prod/state-manager/DIAGNOSIS.md`.

**Run:** `node current/prod/pipeline-v2/run.mjs --case p4-lighthouse [--scenes 4] [--label v1] [--plan-only]`. Output: `current/tests/pipeline-v2/runs/<case>-<label>/index.html`.

**Steps:**
1. The creative director makes the story (v3a) and the change-based chunks (v5b). These are unchanged.
2. The shot planner (`templates/v6-shot-list.md`, 1 LLM call) makes a bible (characters, props, locations, one style line) and a shot list. A shot has a link (cut / continuous), a location, the visible names, a start-frame description (cuts only), one action, a camera line and a duration of 5 or 10 s.
3. Bible references: one clean image for each name that appears in 2 or more scenes of the run.
4. Cut: a fresh start frame from the references (image editor), or text-to-image when the frame needs no reference. The previous frame is never used.
5. Continuous: the clip starts from the real last frame of the previous clip.
6. Clips: wan-3.0, 720p, start frame only, no end frame.
7. Stitch: native 30 fps, exact 1280×720, hard joins, no trims.

**Rules:** one action per clip. No end frames. A framing change is a cut. Prefer continuous shots. A scene has at most 3 shots. Prompts come from the shot list, not from conditions.

**Not used from v1:** the atomizer, the solver and the condition-built prompts (diagnosis defects 1–15).

**Open:** prop scale and look (the shell renders too large); uploads and `ask` leaves (only generated entities so far); audio and text layers; vision-model check per clip.
