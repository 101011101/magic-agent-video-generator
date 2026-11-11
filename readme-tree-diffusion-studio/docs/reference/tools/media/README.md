# `docs/reference/tools/media`

Reference pages for the seven `media_*` tools: one page per tool that inspects a media file by path (probe, frames, filmstrip, waveform, transcript, semantic listen, object mask) over MCP or the `diffusion media` CLI.

## Parts

| Part | Role |
| --- | --- |
| `probe.md` | `media_probe` / `diffusion media probe <path>`. Container + per-track metadata (format, duration, tags, codec, estimated fps/bitrate) demuxed locally with mediabunny. No decode, no credits. Output shape marked "not yet stable". Any asset type accepted; images/transcripts return `format: null`, no tracks. |
| `grab.md` | `media_grab` / `diffusion media grab` (alias `sample`). Decodes frames to PNG contact sheets (up to 12 cells, timecode-labelled `08s10f`) or one PNG per frame (`separate`). Three exclusive sampling modes: `times` (negatives count from end), `count` (even spacing), `auto` (2 fps scan, keeps new visual states, needs WebGPU, cap 30). `quality` is a pixel budget (`small` 384², `medium` 768², `large` 1536², `fullres`). 100-frame cap unless `uncapped`. Sheet max 2576x1456. Output `{ images: [{ timecode, path }] }`. |
| `filmstrip.md` | `media_filmstrip` / `diffusion media filmstrip` (alias `film`). Grid of evenly sampled thumbnails over a `start`/`end` window, each row with an `HH:MM:SS:FF` ruler, fixed canvas; `scale` (0.25–4) trades cell size for density. Video only. Output `{ path }`. |
| `waveform.md` | `media_waveform` / `diffusion media waveform` (alias `wave`). Audio peaks over time as PNG with `HH:MM:SS:FF` ruler; silent stretches drawn red and returned as `silences: [{ start, end }]` in absolute seconds. Audio of a video or a standalone audio file (ruler at nominal 30 fps). |
| `transcribe.md` | `media_transcribe` / `diffusion media transcribe`. Writes timed transcript JSON (`segments[].text`, `segments[].words[].{text,start,end}` in seconds); returns `{ path, segments, words }`. Cached per app session by file content. Fails with `No speech detected` when there is no speech. |
| `listen.md` | `media_listen` / `diffusion media listen`. Sends the audio track (of an audio or video file) to a multimodal model with an optional `prompt` and `start`/`end` window; returns `{ result, start?, end? }`. Costs credits; needs sign-in (`sign-in-required` otherwise). Links to `docs/guides/prompts/media-listen.md`. |
| `segment.md` | `media_segment` / `diffusion media segment` (alias `mask`). SAM 2.1 object segmentation and tracking on local GPU. Prompts on frame `time`: `points`, `exclude`, `box` in 0..1 frame space. `preview` writes only an annotated PNG; without it tracks `start`–`end` and writes a `.mask` file for `<mask src>`. Into an open project's library the track runs in background (`state: "tracking"`, poll `context.masks`); elsewhere it blocks until `state: "done"`. Returns `bbox`, `area`, `score`, `iou`, `lost`, `weak` spans. Models: tiny (83 MB) to large (475 MB), downloaded on first use. |

## How it works

- Every page has the same layout: intro paragraph, name table (MCP tool, CLI command, CLI aliases), `## Input` field table (name, type, CLI flag, description), behaviour notes, `## Output` TypeScript shape, `## Errors` list.
- All seven share the `path` field: absolute path or URL works with or without an open project; a library path like `b-roll/clip.mp4` needs an open project.
- `start`/`end`/`times`/`time` take the shared `Time` type from `docs/reference/tools/README.md` (seconds, `45f`, `MM:SS`); results report plain seconds.
- Windowed tools (`filmstrip`, `waveform`, `grab` with `count`/`auto`, `listen`, `segment`) clamp `end` to the asset duration and fail when `start >= end`.
- Image tools (`grab`, `filmstrip`, `waveform`, `segment`) write PNGs under the system temp dir by default (`dapi-grab-*`, `dapi-filmstrip-*`, `dapi-waveform-*`) and return paths; over MCP images at most 1 MB (up to four for `grab`) also arrive inline.
- Two timecode conventions, both documented: `grab` labels drop zero segments (`08s10f`, `0f`); `filmstrip`/`waveform` rulers use fixed-width `HH:MM:SS:FF`.
- Cost split: `probe`, `grab`, `filmstrip`, `waveform`, `transcribe`, `segment` run locally with no credits; `listen` costs credits and needs a signed-in account.
- The recommended workflow (from `docs/skills/editor.md`): `probe` first, then `waveform`/`filmstrip` for overview, `listen` and `transcribe` for audio, `grab` at the timestamps they point to, `segment` when a mask is needed.
- Page text mirrors the tool `description` and field `.describe()` strings in `packages/dapi/src/tools/media-*.ts` (checked for `media-grab.ts`); the same catalog feeds MCP `tools/list` and `diffusion <cmd> --help`.

## Interfaces

- Depends on:
  - `docs/reference/tools/README.md` — shared `Time`/`Asset` types, naming rules (`media_grab` -> `diffusion media grab`, `media` group alias `m`), result and error delivery. See [../README.md](../README.md).
  - `docs/reference/tools/capture.md` — `grab.md` contrasts asset pixels with composited capture.
  - `docs/reference/tools/context.md` — `segment.md` points to `context.masks` for background track progress.
  - `docs/reference/jsx/styles.md#mask` — `segment.md` shows the `<mask src>` the `.mask` file feeds.
  - `docs/guides/prompts/media-listen.md` — prompt patterns linked from `listen.md`.
  - Documented implementation: tool schemas in `packages/dapi/src/tools/media-{probe,grab,filmstrip,waveform,transcribe,listen,segment}.ts`; handlers in `apps/web/src/dapi/handlers/media-*.ts`; CLI in `apps/cli/src/index.ts`.
- Used by:
  - `docs/reference/tools/README.md` tool table (rows 6–12) and "Media inspection" / "Masks" sections.
  - `docs/reference/tools/capture.md` (links `media/grab.md`), `docs/reference/tools/context.md` (links `media/probe.md`, `media/segment.md`).
  - `docs/reference/jsx/styles.md` (links `media/segment.md`), `docs/reference/jsx/timing.md` (links `media/grab.md`).
  - `docs/skills/editor.md`, `docs/skills/watch.md`, `docs/guides/walkthroughs/{podcast-clip,talking-head}.md` reference the tools by name.
  - Agents connected to the app: `docs/reference/tools/README.md` says the MCP server instructions give the path of these docs in the installed app. How the docs are bundled into the app: unclear from source.

Up: [../README.md](../README.md)
