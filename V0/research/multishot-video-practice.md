# Research: Consistent Multi-Shot AI Video in Practice

> Collected 2026-10-07 by a research agent (web search cap reached; some vendor API details unverified). Input for [pipeline-v2](../prod/pipeline-v2/README.md). Labels: [E] evidence, [S] vendor/secondary claim, [I] inference, [U] unverified.

**Bottom line for our measured problems:**
- Seams jump because each keyframe was an edit of the previous keyframe. Build keyframes from fixed references (character sheet, one clean plate per location). For a true continuation, use the actual last frame of the previous clip [I].
- Clips miss end frames. Give an end frame only for planned transitions with near-identical composition; otherwise start frame + prompt, then hard cuts between camera setups [I]. First/last-frame control works best with one clear subject and similar composition in both frames [S].
- Identity drift and location leaks: condition on entities (character crop, location plate), not whole previous frames. Whole-frame memory ties a character to the background and lighting of its first appearance and leaks it into new scenes (EM-Vid) [E]. Keep an explicit per-shot entity list (EntityBench) [E]. Gate with face similarity and a VLM checklist; best-of-N [E].

**Products [mostly S unless marked]:**

| Tool | Consistency features | Notes |
|---|---|---|
| Seedance 2.0 (on Magic Hour) | up to 9 image / 3 video / 3 audio references; 4–15 s; multi-shot in one generation; first/last frame mode [E] | On Runware, frames and references cannot be combined in one request [E]; Magic Hour [U] |
| Seedance 2.5 | up to 30 s; more references and cuts | docs not fetched [U] |
| Kling 3.0 | Multi-Shot and Custom Multi-Shot (text + duration per shot); start/end frames; Elements from 2–4 images [E] | Elements + frames in API [U] |
| Veo 3.1 | up to 3 reference images; first/last frame; Extend +7 s from the final second, 720p [E] | references and first/last frame not in the same request [E] |
| Gemini Omni Flash | generation + conversational editing, 3–10 s, extend to 40 s [E] | quality unknown |
| Runway Gen-4/4.5 | reference images for character and location | |
| Sora 2 | discontinued (API closed 2026-09-24) [E] | do not design around it |
| LTX Studio | script → scenes → shots; reusable Elements (@Name) | |
| Higgsfield | Popcorn storyboard (up to 8 frames); Soul ID from 20+ photos | |
| Luma Ray3 Modify | video-to-video with start/end keyframes + character reference, keeps motion [E] | re-skin a drifted clip |
| Wan 3.0 | claims 6 shots / 30 s per generation | independent check: shot counts often wrong; props drift before faces |

**Techniques:**
- Character sheet / turnaround (front, 3/4, profile, back + face and mid close-ups), locked before video [S].
- Storyboard first, then shots (LTX, Popcorn, VGoT, Captain Cinema, AniMaker) [E].
- Extend from the real last frame for continuous action; separate generations + hard cuts for new camera setups [I].
- Shot grammar hides discontinuities: alternate shot sizes, ≥30° angle change at cuts, re-establish after location change, cut on action, J/L audio, B-roll inserts; no crossfades inside a scene [I].
- Best-of-N with a reviewer that sees neighbouring shots: +7.1% (AniMaker) [E].
- QC: VLM critic against script and references with repair before acceptance; worst-case identity, not mean (GroundShot) [E]; face-embedding similarity (ArcFace) [E].

**Why image edits shift composition:** instruction editors regenerate every pixel; "keep everything else" is soft; chained edits compound drift (FLUX Kontext measured it) [E]. Fixes: mask inpainting + paste-back of original pixels; structure conditioning (depth/pose); never chain edits — branch every edit from the canonical image [I].

**Research systems [E]:** VideoGen-of-Thought (identity-preserving keyframes, cross-shot smoothing); MovieAgent (hierarchical director roles); AniMaker (best-of-N, MCTS, context-aware reviewer); Captain Cinema (top-down keyframe plan, then fill); Long Context Tuning (attention across all shots of a scene); ShotAdapter, NVIDIA Video Storyboarding; FilmWeaver (shot memory + temporal memory); EM-Vid (entity-centric memory beats whole-frame memory); GroundShot (generate in reference-optimal order: clear close-ups first; VLM critic + repair); EntityBench (per-shot entity schedules).

**Recommended architecture (agent's inference):**
1. Script → shot list with an entity schedule and a link type per shot: CUT, CONTINUOUS, TRANSITION. LLM lint: every entity declared; one description per location; shot sizes alternate.
2. Bible, generated once and frozen: character sheet, one clean plate per location (one landmark each), wardrobe and props. Verify (face similarity, VLM checklist, landmark count); human approves.
3. Keyframes: CUT → fresh image from bible references (no editing from the previous keyframe); CONTINUOUS → actual last frame of the accepted previous clip. 2–4 candidates; VLM + face gate.
4. Video: CUT → start frame + motion prompt (no end frame), or reference mode; CONTINUOUS → from the real last frame; TRANSITION → start + end only when compositions match, end made by mask inpainting. 2–3 takes; QC per clip; context-aware pick.
5. Edit in ffmpeg: trim, hard cuts on action, continuous audio bed, B-roll over failed seams.
6. Final QC: VLM pass against the entity schedule; identity timeline.

**Open:** Magic Hour Seedance 2.0 reference support and frames/references exclusivity; Kling 3.0 Elements + frames; no public end-frame accuracy benchmark (run our own A/B); Nano Banana Pro reference limits (docs conflict).

**Sources:** alphaxiv.org/abs/2605.23610 (EM-Vid) · alphaxiv.org/abs/2606.20799 (GroundShot) · papers.cool/arxiv/2605.15199 (EntityBench) · arxiv.org/html/2506.10540v2 (AniMaker) · arxiv.org/html/2412.02259v2 (VGoT) · arxiv.org/html/2503.07314v1 (MovieAgent) · arxiv.org/html/2507.18634v1 (Captain Cinema) · arxiv.org/abs/2503.10589 (LCT) · research.nvidia.com/labs/par/video_storyboarding · arxiv.org/html/2512.11274v1 (FilmWeaver) · arxiv.org/pdf/2506.15742 (FLUX Kontext) · runware.ai/docs/models/bytedance-seedance-2-0 · magichour.ai/api/seedance-2-0 · kling.ai/quickstart/klingai-video-3-model-user-guide · ai.google.dev/gemini-api/docs/veo · ai.google.dev/gemini-api/docs/omni · ai.google.dev/gemini-api/docs/image-generation · techcrunch.com/2025/12/18/luma-releases-a-new-ai-model-that-lets-users-generate-a-video-from-a-start-and-end-frame · atlascloud.ai/blog/tips/wan-3.0-multi-shot-consistency · invideo.io/blog/ai-filmmaking · ltx.studio/blog/how-to-create-a-consistent-character · higgsfield.ai/blog/how-to-keep-ai-persona-consistent-higgsfield-popcorn · blog.google/technology/google-deepmind/ancestra-behind-the-scenes
