# `docs/guides`

Task know-how for agents: one motion reference (easings), one prompt-pattern page (`media_listen`), and two end-to-end editing walkthroughs (podcast clip, talking head). Linked from `docs/skills/editor.md` and `docs/skills/watch.md`.

## Parts

| Part | Role |
| --- | --- |
| [motion/](motion/README.md) | `easings.md`: six cubic-beziers in mirrored pairs (`snappyOut`, `expoOut`, `snappyIn`, `expoIn`, `outIn`, `inOut`) with use cases; rule to alternate ease-in/ease-out across a cut; "keep energy in the frame" guidance; pixel-snapping section (no sub-pixel rendering; a move under ~1 px/frame stutters, so check travel ÷ frames before committing). |
| [prompts/](prompts/README.md) | `media-listen.md`: how to write prompts for the `media_listen` tool. Be specific, ask for timestamps, refer to moments as `MM:SS`. Five example prompts (summarize, explain moments, key events with timestamps, transcribe, identify music). |
| [walkthroughs/](walkthroughs/README.md) | End-to-end editing recipes. `podcast-clip.md`: cut a 1–3 h multi-speaker recording to one 25–35 s vertical short (audio-only `yt-dlp` pass, windowed `media_listen` search, padded `--download-sections` download, optional `useTicker` speaker framing, `classic` captions). `talking-head.md`: cut a single-speaker recording to a gapless chronological A-roll (`media_transcribe` + `media_waveform` + `media_grab` pick takes, cursor-chained `takes[]` in `<For>`, optional Inter 84/500 `<text>` hook, optional `whisper` captions). |

## How it works

- Skill pages route here. `docs/skills/editor.md` links `motion/easings.md` ("read before animating anything"), both walkthroughs, and `prompts/media-listen.md`. `docs/skills/watch.md` links `prompts/media-listen.md`.
- Walkthroughs follow the same loop the skills define: analyze media with `media_*` tools, write JSX, save (app recompiles), verify with `check` and `capture`, add captions last.
- Both walkthroughs use the same scene shape: `<stage camera={[0.25, 0, 0, 0.25, 235, 70]}>` → `<scene ... height={1920} fill="black" active>` (1080×1920) → `<sequence name="A-roll">` → `<video>` clips placed by `start`/`sourceIn`/`sourceOut`.
- `talking-head.md` states the timeline rule: a gap in a `<sequence>` freezes or blanks the frame, so kept silence lives inside clips (extend `sourceOut` or open `sourceIn`), never as a timeline gap.
- `podcast-clip.md` states the segmenting rule: `media_listen` `start`/`end` define a window; returned timestamps are relative to `start`, so add the offset back to get absolute source time.
- `easings.md` values differ from the four anchors in `docs/brand/video.md`; the brand set applies only when no other style is given.
- No download tool exists; walkthroughs shell out to `yt-dlp` (also stated in `docs/reference/tools/README.md`).

## Interfaces

- Depends on: tool pages in [../reference/tools/README.md](../reference/tools/README.md) (`media_listen`, `media_waveform`, `media_transcribe`, `media_grab`, `media_probe`, `check`, `capture`); JSX pages in [../reference/jsx/README.md](../reference/jsx/README.md) (`<stage>`, `<scene>`, `<sequence>`, `<video>`, `<text>`, `<captions>`, `useTicker`, keyframe easing); `solid-js` `<For>`; external `yt-dlp` and ffmpeg.
- Used by: `docs/skills/editor.md` (all four pages), `docs/skills/watch.md` (`prompts/media-listen.md`), `docs/reference/tools/media/listen.md` (links `prompts/media-listen.md`). Staged into the app with `docs/` by `apps/desktop/scripts/stage-docs.mjs` (see [../README.md](../README.md)).
- Not referenced by any `apps/*` or `packages/*` source file.

Up: [../README.md](../README.md)
