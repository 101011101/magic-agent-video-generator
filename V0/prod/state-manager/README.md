# State Manager (prototype)

> Natural language → story → change-based operational chunks → true/false conditions → solver → tool-call plan. Tools are assumed to work perfectly; nothing is executed. Specs: [05-solver.md](../../docs/subsystems/05-solver.md), [01-types.md](../../docs/subsystems/01-types.md).

**Run:** `node current/prod/state-manager/run.mjs [--only <case id>]` → `current/tests/state-manager/state-manager.html` and `out/<case>.json`. Needs `OPENAI_API_KEY` (env, `current/tests/state-manager/.env` or `current/tests/creative-director/.env`). LLM answers are cached in `current/tests/state-manager/cache/`.

**Execute:** `node current/prod/state-manager/execute.mjs --case <id> --label <name> [--segments N] [--reuse runA,runB] [--dry-run]` → `current/tests/state-manager/runs/<case>-<label>/`. Flags and env are listed at the top of `execute.mjs`.
- `--scene-chain`: a scene = consecutive shots that continue (same location + depends on the previous shot). Shot 1 of a scene uses the planned start and end frames. Each later shot starts on the real last frame of the previous clip (ffmpeg). Its end frame is an image edit of that real frame, with the clean references of the characters and products it shows. Shots in one scene run in order. Scenes run in parallel. A cut keeps planned frames. Without the flag, the planned-frame behaviour is unchanged.
- `--fit-frames`: centre-crop video input images to the output aspect before upload. `--max-seconds N`: cap clips for test runs.
- `MH_END_FRAME_MODEL=wan-3.0` is the measured best end-frame model (first/last frame SSIM 0.98–0.99, real motion). kling-3.0 scores the same but crossfades. veo3.1-lite holds a still frame and accepts end frames only up to 8 s. seedance-1.5 is at 0.75–0.82. gemini-omni-1.1 is at 0.65–0.70.
- Continuity check: after each run, `run.json.continuity` and the run page give SSIM (grayscale 640×360) for the first frame vs the start image, the last frame vs the end image, and each seam. Values below 0.9 are flagged; cut seams are not judged. `node current/prod/state-manager/check.mjs <run folder> [--write]` re-checks an earlier run.

**Files:**
- `src/signatures.js`: loads the 22-atom vocabulary and 40 tool signatures from the fixtures, plus proposed fixes (atoms `visibility` and `layer_position`, tools `canvas` and `layer_composite`, patches to `fade` and `transform`). Applies the editor rule: edit tools keep what their main input provides unless the prompt names it.
- `src/atomize.js`: step 3. One GPT-6.1 Sol call per case, strict JSON schema: bindings, uploads (conditions already true), segments of conditions, layers.
- `src/solver.js`: steps 4–5. Backward search; non-join tools first; join tools (audio mux → text overlay → stitch → layer composite) last; leaves (given, ask, research, authored); shared nodes; execution levels.
- `src/judge.js`: soft credit. A cheap LLM reads a tool's `nature` and judges one condition.
- `src/render.js`: the HTML report.
- `src/continuity.js`: frame extraction and SSIM checks for executed runs.

**Solver rules found while testing (all in `src/solver.js`):**
- Continuous chunks merge into one segment group; cuts split groups. One tool call can cover a group.
- Reference-only atoms (identity, head_hair, body, voice) cannot be re-made by a prompt; they pass through from a binding. Each entity gets its own reference input when a tool accepts several (image editor, text-to-video references).
- Progress rule: a non-join tool must make at least one condition true.
- An input slot may not carry only format atoms (duration, aspect…).
- A goal equal to one of its ancestors is a cycle (no progress).
- Cost search: every qualifying tool's full subtree is built and costed (generative or unbound call 1, our deterministic call 0.5, ask/research 2, unsolved 100); the cheapest is kept and cached per goal.
- Soft credit is asked only for non-rigid conditions, when a tool leaves at most 4 conditions uncovered.
- `visibility` and `layer_position` are for graphic overlays only (logos, text, shapes); scene content uses props, pose_action, lighting.
- Landmark-first: a video segment with bound entities is animated from landmark frames (image-to-video). Text-only video tools are for pure scenery.
- A fictional entity is bound by the first image that makes it. Text-to-image makes the first landmark frame with as many conditions as possible; later frames take that frame as their reference and the image editor sets the rest.
- End frame = start frame + changes: the image editor edits the shared start frame and sets only the changed conditions.
