# Research: Programmatic Video Editing Layer

> Collected 2026-10-06 by a research agent. Input for the editing tools in [tool-signatures.json](../tests/fixtures/tool-signatures.json) and the solver ([05-solver.md](../docs/subsystems/05-solver.md)). **[unverified]** = not confirmed from a source.

**Answer:** no option covers generation + editing + project state. The dependency graph with partial re-runs exists only in our solver.

| Option | Generation | Editing | Project state |
|---|---|---|---|
| ffmpeg (8.1), editly, MoviePy, Rendi | – | joins, reformat, audio: yes. Motion graphics, designed text: weak | – |
| Remotion, HyperFrames | – | keyframed layers, exact text: yes. Joins: OK but slow | – |
| Shotstack, Creatomate, JSON2Video (hosted) | partial (Shotstack sells some AI) | JSON timeline; weaker keyframes (Shotstack: no scale tween documented) | templates only |
| VEED OpenEdit (beta) | via Fabric API / MCPs | HTML-based, agent-driven, no timeline | agent session only |
| OpenMontage (AGPLv3) | 60+ providers | Remotion + HyperFrames + FFmpeg | stage checkpoints, agent-led, not a dependency graph |

**Identities from our notes:**
- **HyperFrames:** HeyGen, Apache-2.0, no render fees. Video as HTML + GSAP/CSS/Lottie, rendered by headless Chrome + ffmpeg. Pre-1.0 (v0.8.x).
- **OpenEdit:** VEED, agent-driven editing, no GUI or timeline, own renderer (closed binaries, PolyForm Shield). Beta.
- "Open Edit timeline → HyperFrames graphics → FFmpeg export" matches no single product. Closest: OpenMontage [unverified].

**Remotion:**
- React video. `interpolate`/`spring` keyframes, real browser text, alpha export (ProRes 4444, WebM).
- Async: `calculateMetadata()` (once per render: fetch data, set duration and size), `delayRender` (30 s default timeout, retries).
- Model calls must not run inside a render. Magic Hour jobs take minutes; timeouts and retries would re-trigger them.
- No asset store or render cache.
- Render: Node `renderMedia` (self-run queue) or Lambda (about $0.017 per 1-min video, compute only).
- Licence: free for up to 3 people. Companies: $0.01 per render with a $100/month minimum (Automators) or $25 per seat (Creators). Every chunk render counts.
- Chrome renders every frame: slower than ffmpeg. Keep footage out of compositions.

**ffmpeg:** covers every operation (trim, concat, xfade, overlay with alpha, scale/pad/crop, amix, sidechaincompress ducking, mux). Fast, free, deterministic. Keyframed motion needs `t` expressions (painful). `drawtext` is weak for designed typography. Do not use fluent-ffmpeg (archived May 2025).

**Others:** editly (stale since Dec 2022), MoviePy (slow), Motion Canvas (stalled), Revideo (unclear status), OTIO (interchange only, cannot render; useful as an optional export to Resolve/Premiere).

**How Remotion fits the solver (agent proposal):**
- The solver runs all Magic Hour jobs before any render.
- Each editing node → a composition ID + zod-validated props (resolved asset URLs, keyframes).
- One render per chunk or overlay. Cache key = hash(composition + props + code version + asset hashes). An edit re-renders only downstream nodes.
- Final assembly in ffmpeg: concat, xfade at boundaries, overlay alpha renders, audio mix with ducking, mux. ffmpeg owns all audio.

**Recommendation (agent proposal, not decided):**
- Solver: state, graph, caching, Magic Hour orchestration.
- ffmpeg: joins, reformat, audio, mux.
- Remotion (default) or HyperFrames (Apache-2.0, LLM-friendly HTML, pre-1.0): keyframed layers and exact text.
- Optional: OTIO export for human finishing.
- Study OpenMontage's design (checkpoints, cost caps); do not depend on it (AGPL, agent-led).

**Sources:** github.com/heygen-com/hyperframes · hyperframes.heygen.com · github.com/veedstudio/open-edit · veed.io/newsroom/openedit-by-veed · github.com/calesthio/OpenMontage · remotion.dev/docs (calculate-metadata, delay-render, offthreadvideo, compare-ssr, lambda/cost-example, license/faq, export-opentimeline) · remotion.pro/license · github.com/mifi/editly · pypi.org/project/moviepy · github.com/fluent-ffmpeg/node-fluent-ffmpeg · shotstack.io/pricing · creatomate.com/pricing · json2video.com/pricing · rendi.dev/pricing · github.com/AcademySoftwareFoundation/OpenTimelineIO
