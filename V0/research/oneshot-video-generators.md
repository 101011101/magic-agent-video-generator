> 30-agent research workflow, 2026-10-07 (run wf_f8f8ca0b-9ff). Tags: [E] evidence, [V] vendor claim, [I] inference, ⚠ disagreement.

# One-shot video generators in 2026: why our clip joins look choppy and what to change

Synthesis of 30 research-agent findings. Date: 2026-10-07.
Tags: **[E]** = evidence (measured, from docs, or from a paper). **[V]** = vendor claim, not verified. **[I]** = inference by an agent or by this synthesis. **⚠** = agents disagree.
Coverage caveat: about half of the agents ran out of web-search budget. They worked from pages they fetched directly. Reddit and X were not reachable. Practitioner evidence comes mostly from one outlet (Curious Refuge).

---

## 1. Bottom line

- **Most leading products are agent layers, not models.** InVideo, Manus, Genspark, Runway Agent, Higgsfield Supercomputer, OpenArt Director and Krea Agent route each shot to third-party models (Seedance 2.x/2.5, Kling 3.0, Veo 3.1, Wan 3.0, Nano Banana). [E] https://techcrunch.com/2024/11/14/tiger-global-backed-invideo-introduces-gen-ai-based-video-creation , https://www.krea.ai/docs/user-guide/agent/overview
- **They avoid stitch joins. They do not polish them.** The 2026 leaders generate a scene as one call, with several cuts inside it (Seedance 2.5 up to 30 s, Kling 3.0 up to 6 shots in 15 s, Runway multi_shot_video 3-5 shots in 15 s, MiniMax H3). For continuous action they use video-conditioned extend, not image-to-video from a still. [E] https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026 , https://docs.dev.runwayml.com/api/
- **Over-generate, then cut short.** InVideo keeps about 5 s of each 15 s Seedance clip (164 clips → 41 shots). Practitioners budget 3-10 takes per usable shot and an average shot length of about 2.5 s. Short shots and cut-on-action hide defects. [V] https://invideo.io/faq/how-many-frames-do-you-need-to-storyboard-for-ai-video/ , [E] https://curiousrefuge.com/blog/what-do-ai-films-cost
- **Identity comes from structured references on every call, not from chaining.** Products keep a persistent project context (character, location and prop sheets) and attach it to each generation (InVideo Context, LTX Elements, Kling Elements, Higgsfield Elements, Luma Master Reference Assets). Last-frame chaining alone does not hold identity. [E] Pictory and Fliki docs; OpenMontage Seedance skill.
- **Finishing hides the remaining seams:** one continuous music bed, audio crossfades and J/L cuts, one grade, one grain pass, overlays rendered in code (Manus, HeyGen HyperFrames, InVideo Editor). A plain concat has none of these. [E]
- **No product ships automatic QC for seams or identity.** Humans still pick takes and do the final cut (InVideo, Genspark's DESO, Manus "80-90% first cut", Runway). The only cross-agent benchmark (Physion-Arc 1.0) found that identity collapses at scene boundaries and that some failures appear only after stitching. Automatic QC is the open gap. [E] https://rajrajhans.com/bookmarks/372/
- **Our own choppiness comes mainly from timing bugs in our stitch, not from the models.** Measured on p4-lighthouse-test2-chain: the 30→24 fps frame drop, a held frame plus a snap in the last 2 frames, a duplicated frame at each join, and a ~5-frame ease-in. The crop itself is correct. These are fixable in ffmpeg for free. [E] local measurement (agents 21 and 22).

---

## 2. Why our joins look choppy, and the fixes

### 2.1 Measured causes (run `p4-lighthouse-test2-chain`)

| # | Cause | Evidence | Severity |
|---|---|---|---|
| 1 | Stitch forces 30 fps wan-3.0 clips to `fps=24`. This drops 1 frame in 5. | [E] Per-frame YDIF repeats `[2,2,2,4-5]`. Spikes at frames 187/191/195/199/203/207 ≈ 14 vs a 4-10 baseline. Seen in both n1.mp4 and n2.mp4. | High. It judders through every clip, not only at joins. |
| 2 | End-frame snap. Frame 88 = frame 87 (PSNR 64-65 dB), then frame 89 jumps (15-20 dB). | [E] n7, n31 (n11: both frames ≈19 dB) | High at every join |
| 3 | Duplicate handoff. B[0] ≈ A[-1] (35-36 dB), so the frame plays twice. | [E] | Medium |
| 4 | Motion ease-in from a still. Frames 1-6 of a clip are at 40-51 dB vs 24-31 dB mid-clip. | [E]. Matches MotionCanvas (arXiv 2502.04299) and StoryMem: one frame carries no velocity. | High. This is the "motion reset". |
| 5 | Colour and grain re-rendered in each clip | [E] Join spikes YAVG 13-60 vs a 2-8 baseline | Medium-high |
| 6 | Odd output sizes (1278×720, 1280×718), then `pad`, give 1 px black edges. Fit crops drift between 1276 and 1278 from hop to hop. | [E] ffprobe | Low |
| 7 | Possible framing morph mid-clip | [E] Spikes 37 and 36 at frames 182 and 254, away from any join | Unconfirmed |
| — | **The crop is not the cause.** | [E] SSIM keyframe→frame 0 = 0.976 with `--fit-frames` vs 0.872 without. Zoom sweep at joins peaks at 1.000 ±0.005. | — |

⚠ **Agents disagree on the crop.** The Higgsfield, LTX, Runway, Kling and seam agents suspected a crop/scale mismatch [I]. The two agents that measured it found no zoom jump [E]. Follow the measurement. Agent 21 proposes recropping to 2720×1530 or 2560×1440. Agent 22 says keep `--fit-frames` (2730×1536) and make one canonical master size. Both changes are harmless. The canonical master size matters more.

⚠ **Fixing the edges.** Agent 21 says crop then scale, keeping the aspect ratio. Agent 22 says stretch straight to 1280×720 with no pad, because 0.16% anamorphic distortion is invisible. Either removes the black edge.

### 2.2 Fixes, ranked by evidence ÷ effort

| Rank | Fix | Concrete settings | Evidence | Effort |
|---|---|---|---|---|
| 1 | Keep the native fps | Stitch filter: `scale=1280:720:flags=lanczos,setsar=1,fps=30` (execute.mjs:283). If 24p is required, use `minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`, RIFE 4.25, or Topaz Apollo/Chronos. Never drop frames. | [E] measured | Minutes |
| 2 | Trim the snap and the duplicate | Continuation clips: `trim=start_frame=1,setpts=PTS-STARTPTS`. Clips followed by a continuation: `trim=end_frame=88`. | [E] measured | Minutes |
| 3 | Hand off from a smooth frame | `src/continuity.js`: take frame N-3 (`select=eq(n\,87)`), not `-sseof -0.5`. Extract as PNG at native size with no further crop. | [E] measured, Wan2GP tail-quality note | Minutes |
| 4 | One canonical geometry | Crop keyframes once (2730×1536), then lanczos to 1920×1080 (or the model's input size) before upload. Use the same size for extracted last frames. Better: request native 16:9 at the delivery size. | [E] measured drift; LTX, Runway and Higgsfield all render at the delivery ratio | Hours |
| 5 | Normalize once, concat with the filter, encode once | Same fps, size, `yuv420p`, SAR 1 and timebase for every clip. Tag `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`. Use the concat **filter**, not demuxer stream copy (trac #7939). Encode once with libx264 at CRF 15-18. | [E] OpenEdit apply-edl.ts refuses mixed fps or colour tags | Hours |
| 6 | Hide the ease-in | Generate each clip 0.5-1 s longer. Trim heads where flow is below ~40-50% of the clip median (≈4-8 frames). Prompt the motion as "already in motion, same direction and speed". Cut on action. | [E] ease-in measured; [V] InVideo "frame three"; thresholds [I] | Hours |
| 7 | Colour and grain unification | Per clip: `color-matcher --method hm-mvgd-hm` (or mkl) against the scene's hero keyframe (not the previous clip). Use one transform per clip, then bake it to .cube for `lut3d=...:interp=tetrahedral`. Then apply one show LUT and one grain pass over the whole timeline: `noise=alls=4-6:allf=t+u`. | [E] tools exist; params [I] | ~1 day |
| 8 | Short crossfade on **continuous joins only** | `xfade=transition=fade:duration=0.12-0.33:offset=<lenA−d>`. Keep it only if the join spike drops toward the 2-5 baseline. | ⚠ see below | Hours |
| 9 | Audio glue | 40 ms `acrossfade` on every join, one music bed, one ambience bed across continuous chains, J/L offsets of 6-24 frames. | [E] OpenEdit and Pictory practice | ~1 day |
| 10 | Multi-frame continuation instead of a still | Use a provider extend with ≥1 s of context: Wan 2.7 `first_clip` (2-10 s) plus `last_frame`, LTX-2.3 extend (`context` 1-20 s, $0.10/s), Veo 3.1 extend (last 24 frames, +7 s, 720p), Seedance 2.x video refs. | [E] all native extends use a frame window; MotionCanvas, StoryMem | Days (new provider) |
| 11 | Generative bridge for a bad seam | Cut 4-8 frames on each side. Regenerate the gap with first+last-frame I2V (`end_image_file_path` on wan-3.0), or use LTX Retake (2-3 s window across the cut). | [E] VACE Join, LTX Retake docs | Days |
| 12 | Plan fewer continuous joins | Apply the 30° rule: a cut must change shot size by ≥1 step or angle by ≥30°. Otherwise make the shot truly continuous. Limit chains to ~3 hops before re-anchoring. | [E] film grammar; FramePack drift after 5-6 rounds | Solver change |

⚠ **Crossfades.** OpenMontage uses 0.3-0.5 s fades. The seam and editing agents say to use hard cuts by default, 4-8 frames only on slow shots, and that long fades ghost moving subjects. Focal and Pictory show that fades mask seams but do not fix them. Recommendation: A/B test with the join metric.

⚠ **Head-trim length.** Measured ease-in is ~5 frames (agent 22). Other suggestions: InVideo trims 2 frames [V], creators trim 0.5-1 s [I], Manus trims 4-8 frames [I]. Tune it per clip with a flow trace.

**Reference stitch for one continuous join (A→B):**
```
[0:v]trim=end_frame=88,setpts=PTS-STARTPTS,scale=1280:720:flags=lanczos,setsar=1,fps=30,setparams=colorspace=bt709[a];
[1:v]trim=start_frame=1,setpts=PTS-STARTPTS,scale=1280:720:flags=lanczos,setsar=1,fps=30,setparams=colorspace=bt709[b];
[a][b]concat=n=2:v=1:a=0[v];  [v]lut3d=show.cube,noise=alls=5:allf=t+u[out]
```

---

## 3. Product teardown

| Product | Pipeline | Consistency method | Joins | Audio | Strengths | Failures |
|---|---|---|---|---|---|---|
| **InVideo** Agent One/Two + Editor (Sep 2026) | Claude/Gemini/GPT harness. Script → 6-9 angle character sheets → 6-image environment batches → 9-panel moodboard → 3-panel grids → Seedance 2.0 multi-shot → NLE | Persistent Context (7 sections), sheets before video, role agents (DOP, costume) share state | Over-generate 15 s, keep ~5 s. One frame per beat. First/last frame called "legacy". Colour room and transitions in the NLE. | ElevenLabs/Minimax (unverified), 16M stock tracks, mixer buses | Fast draft. Agent splits shots it judges too dense to render (e.g. 18 cuts in 15 s). | Credit burn, ~75% chat-edit success, 3/6 scenes usable on the first pass, generic scripts, $315-750/min [V] |
| **Manus** (Meta) | Research → script → Seedance 2.5 shots + code-rendered motion graphics → TTS, music cues, SFX → multi-track project | Prompt text only. No mechanism found. | Short hard cuts (~1.4 s in Emberkeep). HUD overlay and type system unify clips. | TTS, 7 mood cues, ducking, 118 SFX | Visual QC by screenshot on code renders | Showcase is mostly code-built. No photoreal narrative sample. |
| **Genspark** | LLM loop over 80+ tools. Images first, then I2V. MoA best-of-4 across models. | One chat thread as world bible | Extend, first/last frame, basic timeline. No smoothing. | Music Agent (model unknown) | Per-shot routing. Low-res draft, then final. | ~1,000 credits per failed video. Showcase used an outside editor. |
| **Focal** (shut down Sep 2026) | Wizard: plot → style → characters → key visuals → chapters → keyframes → I2V → TTS → lip sync | `includeIds` + `referenceImageMids` | Shader transitions (black_fade default), interpolation, rate-stretch to fit VO | Stock music only | Entity-first order. Client code exposes `startVideoMid`. | Its own docs list character and voice drift. Rated 2.3/5. Model sprawl. |
| **LTX Studio** | Script → scenes/shots → @Elements → stills (FLUX/Nano Banana) → I2V per panel → timeline | Elements bind at the image stage only | Per-shot I2V (same as ours). Own FAQ admits transition issues. | Music + SFX generated | API: Extend (≤20 s context), Retake, multi-shot LTX-2.5, Reframe | Consistency "okay". Missed @tag causes drift. MP4-only export. |
| **Higgsfield** | Popcorn storyboard → (old) last-frame chaining; (new) Cinema Studio 4.0 on Seedance 2.5 | Project Elements, 50 refs, Soul ID (20-80 photos of real people) | Single-pass multi-shot. Extend fwd/back, Transition, re-roll one shot. | Native in the same pass, Seed Audio | Closed camera vocabulary, draft 480p → 1080p | Admits face drift. Billing and throttling complaints. |
| **Runway** | Agent → Multi-Shot recipe (3-5 shots/15 s) → Aleph 2.0 edit → timeline. Router resells Wan 3, Seedance, Veo. | @tag refs (≤3), still-first | One-pass cuts. Aleph keyframe propagation across cuts (≤30 s). ProRes/PNG intermediates. | seed_audio, ElevenLabs SFX | `dryRun` cost estimate, Enhance Frame Rate | Gen-4.5 I2V is first-frame only. Palette drift. Weak 9:16. |
| **Google Flow / Veo 3.1** | Shot-by-shot clips + Scenebuilder | Ingredients (3 refs) | Extend from the last 24 frames (+7 s ×20, 148 s, 720p). Omni 1.1 uses 10 s of context. | Always on. Voice extends only if present in the last 1 s. | Video-conditioned continuation | ⚠ Extend flicker on Veo 3 (Goldhaber). Drift after 4-5 hops. Timeline is basic. |
| **Kling 3.0/Omni** | Model: ≤6 shots/15 s per call | Elements (frontal + 1-3 angles, or video, + voice) | In-call cuts share grain and audio | Native dialogue, no music | Native multi-shot | Transitions "a little clunky". Identity "coherent enough". **Magic Hour API exposes neither multi-shot nor Elements.** |
| **Luma** Ray 3.2 / Agents | Keyframes (≤64), extend via `generation_id`, Modify, Reframe | Master Reference Assets. Character ref only on Ray3. | Extend from the generation, not a decoded frame | None in T2V/I2V | Mid-clip keyframes, low-strength Modify unify pass | No character ref on 3.14/3.2 |
| **OpenMontage** (OSS) | Coding agent + YAML stages + 100 tools | Seedance "locks" (lens, count, screen direction, state monotonicity), 3-plate sheets | Dip fades, 1.5% push, global grade | Pixabay → Freesound → ElevenLabs; LUFS targets | Strong prompt doctrine | CostTracker never instantiated. Gates unenforced. Its own forced fps=30 conversion causes judder. |
| **VEED OpenEdit / HyperFrames** | Agent CLI: EDL → one ffmpeg encode; HTML overlays rendered with a virtual clock | — | Hard concat. 40 ms audio crossfade. Refuses mixed fps or colour tags. | Sidechain duck (0.03/8/20/600) | Frame-grid snapping, contact-sheet QC, 2 s segment cache | `concat-videos` forces fps=30 |
| **HeyGen / Synthesia / Mirage** | VO first → audio-driven A-roll + B-roll + HTML scenes | Pinned avatar/voice ID, style paragraph | Hard cuts or fades on sentences, covered with B-roll | VO master clock | Best-of-N scorer (Express-Eval) | Style drift without a style lock |
| **Pictory / Lumen5 / Fliki** | Sentence = scene. Stock or AI visual. Ken Burns. | Pictory `visualContinuity` = **our method** (last frame → next first) | One transition family, one music bed | One track, auto fades | Audio-first timing | Literal stock matches. "Slideshow" look. |
| **Others** (OpenArt Director, Vidu Agent, Pippit, Krea, Utopai) | Clarify → plan → approve → batch → regenerate per shot | Entity extraction, 2×2 keyframe grids (Utopai) | Multi-shot-native models | VO + music on a timeline | Krea High effort: self-review and retry | ⚠ Physion-Arc winner disputed (Runway vs InVideo vs Frameo) |

---

## 4. Technique catalogue by stage

**Planning**
- Hierarchical plan: story → scenes (split on location, time or beat) → shots. [E] MovieAgent arXiv 2503.07314
- Per-shot fields: shot_size, angle, lens_mm, one camera_move, one action beat, axis_side, per-character screen_x, transition_in enum, duration_s, location_id, azimuth. [E/I] FilmAgent, Sora 2 guide
- Critic loop on the shot list: 2 critics, ≤3 rounds, 1 judge. Camera score 2.07 → 3.53. [E] arXiv 2501.12909
- Script rules: ~5 s or 3-6 s per shot, one action, one move, insert shots as transitions, no doorway transitions. [E] MAViS arXiv 2508.08487
- Duration defaults: 2-4 s for ads, 3-6 s for narrative. Practitioner average shot length ≈ 2.5 s. [E]
- Pre-flight feasibility check: split beats with too many cuts (InVideo). [V]

**References and bible**
- Character sheet: hero portrait + ¾L + ¾R + full-body front/back. ≤6 refs. Neutral grey or white background, even light. One asset per wardrobe or damage state. "Rule of 10" recognisability test. [E] Runway resources, OpenMontage, Luma
- Location record: a clean plate with no characters, per lighting state. 3-6 named anchors as fixed text. Pre-generate the reverse plate. Add a state version. [E/V] invideo FAQ, Higgsfield 2026-07-27
- Optional 3D route: World Labs Marble API (plate → Gaussian splat in ~5 min, then render exact azimuths). [E] https://docs.worldlabs.ai/api
- Restate a verbatim identity block in every prompt. Never paraphrase it. Never write "same as before". [E] Runware Kling docs, Atlas
- Leak rule: references = f(location_id, state, view). Never use a cross-location reference. [I]

**Keyframes**
- nano-banana-pro on Magic Hour accepts 9 extra reference images and `aspect_ratio: 16:9`. [E] https://docs.magichour.ai/api-reference/image-projects/ai-image-editor
- Select references by field-of-view overlap and semantic similarity, not by recency. [E] Context-as-Memory, Captain Cinema
- Gate each keyframe before I2V: identity cosine + checklist. Keyframe retries cost far less than video retries. [E] Video-T1 early rejection

**Video generation**
- Pin both ends (`end_image_file_path`). Supported on wan-3.0, kling-3.0, seedance-2.x, veo3.1 (≤8 s), ltx-2.5. Not on minimax-h3. [E]
- A framing change is a cut, not a move inside a clip. If both ends differ a lot, add mid keyframes (Luma ray-3.2 `keyframe_indexes`). [E]
- Single-pass multi-shot for a scene: Kling `multi_prompt` + `shot_type='customize'`, Seedance 2.5 time-coded prompts, Runway recipe, HoloCine (non-commercial). [E]
- Use explicit camera enums. Use positive "lock" phrasing. [E] OpenMontage, Higgsfield

**Continuation**
- Condition on a window of frames: Veo 24 frames, SkyReels 17 overlap, VACE 16-24, LTX `context` 1-20 s, Wan 2.7 `first_clip` 2-10 s, SVI 5 motion frames. [E]
- Add light noise to the context (SkyReels `addnoise_condition`=20, keep <50). [E]
- Hop budget: 2-4 hops (~30 s), then re-anchor with a fresh reference keyframe. [E] FramePack, Kling community reports
- Splice at the original frames. Colour-match only the new frames. [E/I]
- Interpolate when the next environment is established. Extrapolate when it is new. [E] A2RD arXiv 2605.06924

**Editing and pacing**
- Trim heads and tails with a motion-energy trace (tblend/YAVG or RAFT). [E]
- Cut on action and on downbeats. Enforce a minimum shot length. [E] Beat This! (GTZAN beat F1 89.1)
- J/L cuts as first-class EDL fields. B-roll inserts cover bad joins. [E]
- Code-rendered titles, HUD and captions (HyperFrames, Remotion). [E]
- Global grade + grain after the stitch. Use 10-bit or ProRes intermediates where available. [E]

**Audio**
- `audio: true` on Magic Hour costs no extra credits on wan-3.0, seedance-2.x, ltx-2.5 and minimax-h3. Prompt for diegetic sound only, "no music". [E] https://docs.magichour.ai/api-reference/models
- Music: ElevenLabs `music_v2_5` `composition_plan` (≤30 chunks of 3-120 s, durations enforced on v2). Fallbacks: Stable Audio 2.5, Lyria 3.5/RealTime. Suno/Udio have no official API (unverified). [E]
- VO first: ElevenLabs TTS `/with-timestamps` sets shot durations. Use `previous_request_ids` + seed for continuity. [E]
- Mix: VO −16 LUFS, bed −28 to −24, duck −12 dB, −1 dBTP, two-pass loudnorm. [E] OpenMontage, FilMaster
- ⚠ Ducking settings: OpenEdit uses 0.03/8/20 ms/600 ms. The audio agent suggests attack 10 / release 350. Tune by ear.

**QC**
- Tier 1 (deterministic): VBench custom_input (subject/background consistency, motion smoothness, dynamic degree), face crop cosine (ArcFace/AntelopeV2) against the sheet, per-join seam metrics. [E]
- Tier 2: VLM yes/no checklist from the shot spec, pairwise comparison with order swap. Do not use absolute 1-10 VLM scores: GPT-5/Gemini-2.5/Claude-4 get 26-29% exact vs 44% for VideoScore2. [E] arXiv 2509.22799
- Reranking: VideoReward (MIT, MQ head 74.7%) or VideoScore2. Both sample at 2 fps, so they cannot see seams. [E]
- Score motion as well. A consistency-only critic cuts dynamic degree by ~20% (MAViS). [E]
- Repair: re-roll one shot, Face Swap Video, Character Replace, LTX Retake. [E]
- ⚠ Licensing: InsightFace weights are non-commercial. MMAudio weights are CC-BY-NC. HoloCine is CC BY-NC-SA.

---

## 5. Model capability matrix (reconciled, Oct 2026)

| Model | Start / end frame | Refs | Native extend | In-call multi-shot | Max s/call | fps | Res | Audio | ~$/s (720p) | On Magic Hour? |
|---|---|---|---|---|---|---|---|---|---|---|
| **Wan 3.0** | ✓ / ✓ | img/video/audio (counts unknown; fal R2V) | ✗ found | prompt cues only | 30 (MH: 2-10, 15, 20, 25, 30) | **30** (measured) ⚠ possibly interpolated | 480p-1080p | ✓ (free on MH) | 0.10 | ✓ (MH 720p only per our rate table ⚠ docs list 1080p) |
| Wan 2.7 | first_clip + last_frame | ✓ (not with frames) | **continuation 2-10 s ctx** | — | 15 total | ? | 720p/1080p | ? | ? | ? (DashScope) |
| **Kling 3.0 / Omni** | ✓ / ✓ | Elements 1-7 (3 with frames) | +4-5 s (unverified for 3.0) | ✓ ≤6 shots | 15 | ? | 720p/1080p/4K | ✓ +50% | 0.11-0.34 | Model ✓, **multi-shot/Elements ✗** |
| **Veo 3.1** | ✓ / ✓ (≤8 s on MH) | 3 (forces 8 s) | **+7 s ×20, 148 s, 720p, last 24 frames** | timestamp prompting | 8 | **24** | 720p-4K | always on | 0.20-0.40 (Lite 0.05) | ✓ (extend ✗) |
| Gemini Omni 1.1 Flash | ✓ / ✓ | 3 s video refs | **10 s ctx, ≤40 s** | — | 10 | ? | 360p-4K | — on MH | 360p ≈ ⅓ of 720p | ✓ |
| **Seedance 2.0** | ✓ / ✓ | 9 img + 3 vid + 3 audio | ✗ (2.5 has extend) | prompt-level | 15 | 24 | 480p-4K | ✓ | 0.36 (Runway) | ✓ |
| **Seedance 2.5** | ✓ / ✓ | **50** | ✓ (wrappers) | ✓ montage/tempo | 30 | 24 | 480p/720p native, 1080p | ✓ joint | 0.30-0.47 | ✓ (ref fields ✗ in MH I2V) |
| **LTX 2.3 / 2.5** | ✓ / ✓ | Elements (Studio) | **2.3 Pro: 2-20 s, ctx ≤20 s, $0.10/s** | 2.5 ✓ 2-4 shots ⚠ | 20 (MH 2.5: 60) | 24/48 | 1080p-2160p | ✓ | 0.06-0.17 | ltx-2.5 ✓ |
| **Luma Ray 3.2** | ✓ / ✓, ≤64 keyframes | none on 3.2 | ✓ via generation_id (SDR) | ✗ | 5/10 | ? | 360p-1080p, HDR | ✗ | 0.06 (720p) | ✗ |
| **MiniMax H3** | ✓ / ✓ (fal) | 9 img + 3 vid + 3 audio | — | ✓ | 15 (MH 30) | ? | 480p-4K | ✓ | 0.05-0.16 | ✓ (**no end frame**) |
| Runway Gen-4.5 | first only | — | ✗ | Recipe (separate) | 10 | ? | 720p/1080p | — | 0.12 | ✗ |

Conflicts and notes:
- ⚠ Kling per-shot minimum is 3 s (Magnific) vs 1 s (fal). Atlas lists a "10 s max", which contradicts the 15 s spec.
- ⚠ LTX-2.5 multi-shot was ignored in a practitioner test (Curious Refuge 2026-08-16), although the docs support it.
- ⚠ Seedance 2.5 multi-beat clips sometimes come out in the wrong order (MindStudio). Manus therefore says to keep one shot per generation. This conflicts with the "group into one call" advice from Higgsfield, Runway and Kling.
- ⚠ Veo 3.1 preview models may shut down on 2026-10-22. This is a third-party claim. Verify it.
- ⚠ The Magic Hour API has no extend endpoint. Its I2V endpoint has no reference field. Seedance and Kling reference or multi-shot features need fal, Runway, or the official APIs.
- ⚠ Mixing models: OpenMontage says lock one I2V model per piece (continuity score 0.9 vs 0.4). InVideo and Genspark route per shot. The two can be reconciled: use one model within a continuous chain or scene, and route per scene.

---

## 6. Recommended architecture: pipeline v2

### Step by step

| # | Step | What to verify |
|---|---|---|
| 0 | **Brief → format defaults** (ad 20-60 s at 2-4 s/shot; short at 3-6 s/shot; aspect fixed once) | Cost estimate shown before spend |
| 1 | **Creative director: story → scenes → shots** with typed fields (§4 Planning) plus `join_type ∈ {continuous, cut, cut_on_action, reverse, insert}` and an `audio_plan` | Lint: no jump cuts (<1 size step and <30°), no axis flips, one move and one action per shot, chain ≤3 hops. Critic loop ≤3 rounds. |
| 2 | **Audio first**: VO via TTS-with-timestamps. Music via ElevenLabs `composition_plan` chunks per scene at a fixed BPM. | Shot durations snapped to VO words and beats. Chunks ≥3 s. |
| 3 | **Bible**: character sheets (5 views), location clean plates per state, reverse plates, prop sheets → state solver registry | Rule-of-10 identity test. Plates contain no characters. |
| 4 | **Keyframes** at native 16:9 canonical size. References = sheets + nearest-azimuth plate + approved anchor stills from the same location only. | Face cosine vs hero (threshold calibrated). VLM checklist. Background similarity vs plate. Size exactly canonical. |
| 5 | **Route per scene.** Continuous chain → wan-3.0 first+last (or a multi-frame extend provider). Dialogue or multi-cut scene → test Kling/Seedance multi-shot via fal. Cut → fresh keyframe. | Model and version pinned and logged per shot |
| 6 | **Generate long, draft cheap**: +0.5-1 s padding, 480p or cheap tier first, N=2-3 for hero or failed shots | Draft QC before the final render |
| 7 | **Per-clip QC**: VBench custom_input, face crop cosine at 2 fps (min and median), dynamic degree, scdet for unintended cuts | Re-roll or repair (face swap, character replace) on failure |
| 8 | **Conform**: ffprobe; same fps (30), size, pix_fmt, bt709 tags; head and tail trim from the flow trace; drop B[0]; handoff from N-3 | Assert width, height, SAR, fps and timebase are equal |
| 9 | **Seam QC per join**: duplicate frame (>50 dB), pop (>3× local median), RAFT flow ratio (0.5-2×) and direction (<45°), Lab ΔE, DINOv2 A[-1]↔B[0], zoom/phase alignment = 1.000 | Fail → bridge clip, re-trim, or B-roll insert |
| 10 | **Finish**: colour-match each clip to the scene hero → show LUT → one grain pass → code overlays → audio mix (diegetic clip audio with crossfades + ambience bed + VO + ducked music, loudnorm) → single encode | Loudness JSON, TransNetV2 SCA vs shot list, final contact sheet |
| 11 | **Output**: MP4 + timeline manifest (EDL/OTIO, per-shot provider/model/seed) | A single-shot fix re-renders only the stitch |

### Top 10 changes by expected quality impact

1. **Stitch at native 30 fps** (or motion-compensated conversion). Removes judder in every clip. [E measured] Effort: minutes.
2. **Trim the end snap and the duplicate first frame. Hand off from frame N-3.** [E measured] Effort: minutes.
3. **Add continuous audio**: music bed + ambience across joins + 40 ms crossfades + J/L cuts. This also fills the missing music provider (ElevenLabs Music v2.5). [E product convergence]
4. **Add a grade and grain unification pass** (color-matcher → LUT → one grain layer) and a single encode with bt709 tags. [E tools; I effect]
5. **Add a bible plus reference injection on every keyframe call** (character sheets, location plates, leak rule). Main fix for identity and location drift. [E]
6. **Plan joins in the solver**: 30° rule, cut-on-action, chain ≤3 hops, framing change = cut. Fewer fragile continuous joins. [E]
7. **Automatic QC**: keyframe gate + per-clip + per-seam metrics, with targeted re-roll and best-of-2-3 only on failures. Nobody ships this; it is our gap to win. [E/I]
8. **Multi-frame continuation for true continuous shots**: A/B test Wan 2.7 `first_clip` and LTX-2.3 extend against wan-3.0 last-frame I2V on 10 joins, using the flow-ratio metric. [E method]
9. **Scene-level multi-shot generation** for dialogue and coverage via fal Kling 3.0 / Seedance 2.5. Removes joins inside a scene. ⚠ "clunky" transitions and wrong ordering reported. [E/V]
10. **Generate long, then trim** (+0.5-1 s), plus a cheap draft tier before the final render. [E InVideo, Higgsfield, Runway]

---

## 7. Open questions and cheap tests

| Question | Cheap test |
|---|---|
| How much choppiness remains after fixes 1-2? | Re-stitch p4 at 30 fps with the trims. Re-run the tblend/YAVG trace. The 4-frame periodicity must disappear, and join spikes should approach the 2-8 baseline. (~1 h, $0) |
| Is wan-3.0 natively 30 fps or interpolated? | Probe more clips for equal consecutive-frame diffs (n31 pattern). Ask Magic Hour. |
| What are frames 182 and 254 in n2? | Inspect a contact sheet. Morph or legitimate motion? |
| Best head-trim length? | Sweep 0/2/4/6/8 frames on 6 joins. Score with the flow ratio. Do a blind A/B. |
| Crossfade or hard cut on continuous joins? | 3 variants (none, 4 frames, 8 frames) × 6 joins. Blind pairwise. |
| Does multi-frame context beat a still for us? | 10 joins: wan-3.0 last frame vs LTX-2.3 extend ($0.10/s) vs Wan 2.7 continuation. Metrics: flow ratio, ΔE, face cosine. |
| Does Magic Hour expose seedance-2.x refs, Kling Elements, or extend anywhere? | Ask support / read the endpoint index. Otherwise add a fal adapter. |
| Does `audio: true` on wan-3.0 obey "no music"? | 5 clips, Whisper and a listening check. |
| Identity thresholds? | Embed same-character vs different-character keyframe pairs from past runs. Set the reject line between the two distributions. |
| Is multi-shot in one call good enough for narrative? | One 15 s dialogue scene on Kling 3.0 (fal) vs Seedance 2.5 vs our chain. Blind preference. |
| Which commercial face embedding is safe to use? | Licensing decision needed (InsightFace weights are non-commercial). |
| ⚠ Music before or after picture lock? | Audio-first (Pictory, HeyGen, LTX) vs post-lock (OpenMontage #351, FilMaster). Test one ad each way. |
| Are the 2026-10-22 Veo deprecation, Kling extend for 3.0, and Suno API real? | Verify before building on them. |

Other contradictions to track: Physion-Arc #1 is claimed by Runway, InVideo and Frameo, and no Physion report was verified. LTX "IC-LoRA = identity" marketing conflicts with its own docs. Soul ID photo counts range from 3 to 80. The VEED "no headless browser" claim conflicts with its code. VBench motion-smoothness scales are not comparable across papers.

---

## 8. Sources (deduplicated, grouped)

**Local measurement:** `current/tests/state-manager/runs/p4-lighthouse-test2-chain/` (n1, n2, n7, n11, n15, n19, n31, n45, *-fit.png); `current/prod/state-manager/execute.mjs` (L170-180, L283); `src/continuity.js` (L14).

**Products:**
- InVideo: https://invideo.io/faq/what-is-invideo-agent-one-and-what-makes-it-stand-out-as/ , https://invideo.io/faq/how-many-frames-do-you-need-to-storyboard-for-ai-video/ , https://invideo.io/faq/why-is-cutting-on-a-still-frame-between-ai-generated/ , https://invideo.io/faq/how-do-you-generate-a-shotreverse-shot-pair-with/ , https://invideo.io/news/introducing-invideo-editor/ , https://kingy.ai/invideo-agent-one-review-the-ai-filmmaker-that-finally-remembers-what-youre-making/
- Manus: https://manus.im/features/video , https://manus.im/blog/introducing-video-editor
- Genspark: https://www.genspark.ai/tools/ai-video-generator , https://www.genspark.ai/blog/the-age-of-solo-filmmaking
- Focal: https://focalml.com/docs/quality-modes , https://focalml.com/sunset
- LTX: https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-extend , https://docs.ltx.io/models/ltx-2-5 , https://ltx.io/blog/how-to-storyboard
- Higgsfield: https://higgsfield.ai/changelog , https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026
- Runway: https://docs.dev.runwayml.com/api/ , https://runway.com/news/introducing-aleph-2-and-edit-studio
- Google: https://ai.google.dev/gemini-api/docs/veo , https://support.google.com/flow/answer/16935718 , https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-omni-1-1-flash/
- Kling: https://kling.ai/quickstart/klingai-video-3-model-user-guide , https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-v3-pro.md , https://magichour.ai/api/kling-3-0-omni , https://www.atlascloud.ai/blog/guides/kling-3-0-review
- Luma: https://docs.agents.lumalabs.ai/guides/videos/generation/ , https://lumalabs.ai/learning-center/articles/character-consistency-techniques
- OpenMontage: https://github.com/calesthio/OpenMontage (issues #210, #723)
- VEED / HeyGen: https://github.com/veedstudio/open-edit , https://github.com/heygen-com/hyperframes
- Template generators: https://developers.heygen.com/docs/overview.md , https://docs.synthesia.io/reference/create-video.md , https://docs.pictory.ai/guides/ai-generated-visuals/visual-continuity.md , https://fliki.ai/whats-new/character-consistency
- Other agents: https://rajrajhans.com/bookmarks/372/ (Physion-Arc), https://frameo.ai/news/frameo-ranks-1-on-physion-arc

**Models and APIs:**
- Magic Hour: https://docs.magichour.ai/api-reference/video-projects/image-to-video , https://docs.magichour.ai/api-reference/models
- Wan: https://fal.ai/models/alibaba/wan-3.0/image-to-video , https://docs.comfy.org/zh/built-in-nodes/Wan2VideoContinuationApi
- Seedance: https://fal.ai/models/bytedance/seedance-2.5/reference-to-video
- LTX: https://fal.ai/models/fal-ai/ltx-2.3/extend-video/llms.txt
- MiniMax: https://fal.ai/models/minimax/h3/image-to-video
- Pricing: https://docs.dev.runwayml.com/guides/pricing/
- 3D locations: https://docs.worldlabs.ai/api

**Research:**
- MotionCanvas arXiv 2502.04299
- SVI https://github.com/vita-epfl/Stable-Video-Infinity
- SkyReels-V2 https://github.com/SkyworkAI/SkyReels-V2
- FramePack https://lllyasviel.github.io/frame_pack_gitpage/
- HoloCine arXiv 2510.20822
- StoryMem arXiv 2512.19539
- OneStory arXiv 2512.07802
- A2RD arXiv 2605.06924
- Captain Cinema arXiv 2507.18634
- LCT arXiv 2503.10589
- ShotPlan https://huggingface.co/papers/2607.17675
- MovieAgent arXiv 2503.07314
- FilmAgent arXiv 2501.12909
- MAViS arXiv 2508.08487
- FilMaster arXiv 2506.18899
- AniMaker arXiv 2506.10540
- VGoT arXiv 2412.02259
- GEN3C arXiv 2503.03751
- Stand-In arXiv 2508.07901

**Evaluation and QC:**
- VBench https://github.com/Vchitect/VBench
- EntityBench arXiv 2605.15199
- VideoReward https://github.com/KwaiVGI/VideoAlign
- VideoScore2 arXiv 2509.22799
- VISTA arXiv 2510.15831
- Video-T1 arXiv 2503.18942
- VideoRepair arXiv 2411.15115
- FVMD arXiv 2407.16124
- TransNetV2 https://github.com/soCzech/TransNetV2
- ShotBench arXiv 2506.21356

**Editing, colour, audio:**
- ffmpeg filters https://ffmpeg.org/ffmpeg-filters.html , https://trac.ffmpeg.org/ticket/7939
- Colour matching https://github.com/hahnec/color-matcher
- Interpolation https://github.com/hzwer/Practical-RIFE
- Beat tracking https://github.com/CPJKU/beat_this
- Upscaling https://github.com/ByteDance-Seed/SeedVR , https://docs.topazlabs.com/video-ai/filters/frame-interpolation
- Music and TTS https://elevenlabs.io/docs/api-reference/music/compose , https://ai.google.dev/gemini-api/docs/music-generation
- Foley https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley

**Practitioners:**
- https://curiousrefuge.com/blog/what-do-ai-films-cost
- https://curiousrefuge.com/blog/wan3-review
- https://curiousrefuge.com/blog/how-to-change-camera-angles-with-ai
- https://curiousrefuge.com/blog/the-best-ai-workflow-for-a-2d-live-action-film
- https://eastondev.com/blog/de/posts/ai/20251207-veo3-long-video-guide/
- https://bengoldhaber.substack.com/p/working-notes-google-veo3-flow