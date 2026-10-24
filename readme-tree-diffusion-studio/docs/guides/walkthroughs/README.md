# `docs/guides/walkthroughs`

Worked end-to-end editing examples: each shows the full brief → analysis → JSX → verification → captions path for one common video job.

## Parts

| Part | Role |
| --- | --- |
| `talking-head.md` | Long single-speaker recording cut to a clean chronological story. Steps: **1 Brief** (no target length → drop only silences and double takes). **2 Analysis** (`media_transcribe` every take for word times; `media_waveform` marks dead air in red and returns silent ranges; `media_grab` the first word of duplicate takes, keep the sharpest, usually the last). **3 Lay out the A-roll** (a `takes[]` list of `{ src, sourceIn, sourceOut }`, a cursor loop that assigns each `start` as the sum of prior durations, rendered with solid-js `<For>` inside `<sequence name="A-roll">` in a 1080×1920 `<scene>` under `<stage camera=[...]>`; kept pauses live inside clips, never as timeline gaps). **4 Cut points** (open on the first word; 0.3–0.5 s between sentences; butt words mid-sentence; up to 0.8 s trailing air). **5 Verification** (`check` names gaps; `capture` the first frame of every clip). **6 Visual hook** (one line of Inter 84/500 in a native `<text>`, no box, never over the head). **7 Captions** (`<captions preset="whisper" verticalAlign="bottom" start={3} sourceIn={3} />` after the hook). |
| `podcast-clip.md` | Multi-speaker 1–3 h conversation cut to one 25–35 s vertical short. Steps: **1 Brief** (self-containment is the hard requirement; 1080×1920). **2 Audio-only pass** (`yt-dlp -x --audio-format m4a`). **3 Segment the audio** (`media_listen` `start`/`end` windows chosen by waveform silences, fixed 15–30 min blocks, or a published transcript). **4 Find moments** (a strict prompt asking for start/end `MM:SS`, speaker, summary, hook rating 1–10; add the segment offset back). **5 Lock cut points** (`media_transcribe` for the hook's first word and the button's last word; `media_waveform` around the cut for breaths). **6 Download and lay out** (`yt-dlp --download-sections` with padding; `media_probe` for dimensions; node keeps source aspect scaled to scene height, `NODE_W = 1920 * (1920/1080) ≈ 3413`, centered so the scene crops it; `<video sourceIn={IN} sourceOut={OUT}>`). **7 Frame the speaker** (optional: `useTicker()` from `@diffusionstudio/jsx`, a `turns[]` table of `{ at, fx }`, `x={speakerX()}`). **8 Captions** (`<captions preset="classic" verticalAlign="center" />`, push with `offsetY={420}` if over faces). |

## How it works

- Both pages instantiate the loop in `docs/skills/editor.md`: brief first, analysis with `media_*` tools, A-roll JSX, save, `check` + `capture`, then overlays and captions last.
- `talking-head.md` is transcript-driven: word times pick `sourceIn`/`sourceOut`; the waveform separates cuttable silence from kept breaths.
- `podcast-clip.md` is search-driven: audio-only discovery with windowed `media_listen`, then a padded video download only for the chosen range.
- Both keep the timeline gapless inside one `<sequence>` and set an explicit `start` on every `<video>`.
- Caption presets differ by job: `whisper` bottom-aligned for talking head, `classic` centered for the vertical podcast clip.

## Interfaces

- Depends on: MCP tools `media_transcribe`, `media_waveform`, `media_grab`, `media_listen`, `media_probe`, `check`, `capture` ([../../reference/tools/README.md](../../reference/tools/README.md)); JSX tags `<stage>`, `<scene>`, `<sequence>`, `<video>`, `<text>`, `<captions>` and `useTicker` ([../../reference/jsx/README.md](../../reference/jsx/README.md)); solid-js `<For>`; external `yt-dlp` and ffmpeg.
- Depends on: [../prompts/README.md](../prompts/README.md) for the `media_listen` prompt pattern used in `podcast-clip.md`.
- Used by: `docs/skills/editor.md` (Examples → Video editing lists both pages). No code or test references them.

Up: [../README.md](../README.md)
