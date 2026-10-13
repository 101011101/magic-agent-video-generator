# `packages/dapi/src/tools`

One file per dapi tool: the name, title, agent-facing description, and zod `input` / `output` / `result` schemas that the app serves over MCP, the CLI derives commands from, and the renderer validates against. Definitions only; no handler code lives here.

## Parts

| Part | Role |
|---|---|
| `open.ts` | `open`: open or create a project folder in the running app. Input `dir`. Output `id`, `name`, `dir`. Renderer. |
| `context.ts` | `context`: report `rootDir`, `projectDir`, `currentTime`, `fontFamilies`, `generations` (`GenerationRow`), and background `masks` (`MaskRow`). `result` carries a mask contact sheet as `png` bytes; `output` carries its `image` path. Exports types `GenerationRow`, `MaskRow`. Renderer. |
| `capture.ts` | `capture`: render frames of a scene at `times` (`NonNegativeTime[]`) to PNG contact sheets or separate images. Input `SceneId` + `sheetFields` + `outputDirField`, refined by `checkSheetOptions`. `result` is `TimecodedImage[]` (bytes); `output` is `{ images: ImageRef[] }` (paths). Renderer. |
| `check.ts` | `check`: static analysis of a `NodeId` subtree, no render. Exports `CheckIssueCode` enum (`black-frames`, `no-visuals`, `never-visible`, `zero-duration`, `transparent`, `source-error`) and `CheckIssue` (`code`, `severity`, `message`, `node?`, `ranges?`). Output `stats` (`nodes`, `byKind`, `depth`, `duration`) + `issues`. Renderer. |
| `export.ts` | `exportScene` (tool name `export`): encode a scene to video. Exports `ExportFormat` (`mp4`, `webm`, `ogg`, `mov`) and `ExportSettings` (`format`, `video{enabled,codec,bitrate,fps,resolution}`, `audio{enabled,codec,sampleRate,bitrate}`), mirroring `diffusion.export.<id>` in the project `package.json`. Output `path`, `width`, `height`, `duration`, `size`, `config`. Renderer. |
| `media-probe.ts` | `mediaProbe` (`media_probe`): container and per-track metadata of an `AssetPath` without decoding. Output is a `looseObject` with `format`, `duration`, `tags`, `tracks[]` (`id`, `type`, `codec`, `language`, `firstTimestamp`, `duration`). Renderer. |
| `media-grab.ts` | `mediaGrab` (`media_grab`): decode frames of a video by `times` (signed `Time[]`), `count`, or `auto` scan, within an optional `start`/`end` window, at `FrameQuality` (`small`, `medium`, `large`, `fullres`). Exports `FRAME_CAP = 100`; `uncapped` lifts it. `superRefine` rejects `times`+`count`, `auto`+`times`, a window without `count`/`auto`, and over-cap counts; then runs `checkWindow` and `checkSheetOptions`. Same `result`/`output` shape as `capture`. Renderer. |
| `media-transcribe.ts` | `mediaTranscribe` (`media_transcribe`): speech to a timed transcript. Exports `TranscriptWord` (`text`, `start`, `end`) and `TranscriptSegment` (`text`, `words`). `result` is `{ segments }`; `output` is `{ path, segments: int, words: int }` after the server writes the JSON. Renderer. |
| `media-filmstrip.ts` | `mediaFilmstrip` (`media_filmstrip`): thumbnail grid PNG across a window. Exports `previewFields` (`windowFields` + `output` + `scale`), shared with waveform. `result` `{ png }`; `output` `{ path }`. Renderer. |
| `media-waveform.ts` | `mediaWaveform` (`media_waveform`): waveform PNG with silence ranges. Reuses `previewFields`. `result` `{ png, silences }`; `output` `{ path, silences }`. Renderer. |
| `media-listen.ts` | `mediaListen` (`media_listen`): prompt a multimodal model on an audio track within a window. Output `result?`, `start?`, `end?`. Needs a signed-in account. Renderer. |
| `media-segment.ts` | `mediaSegment` (`media_segment`): SAM 2.1 object segmentation and tracking to a `.mask` file. Exports `SEGMENT_MODELS` (`tiny`, `small`, `base-plus`, `large`), `WEAK_IOU = 0.5`, `segmentSpan` (`model`, `frameRate`, `start`, `end`, `frames`), `segmentFound` (`bbox`, `area`, `score`, `iou`, `lost[]`, `weak[]`). Input: `path`, `time`, `points`, `exclude`, `box`, `preview`, `start`, `end`, `model`, `output`. `superRefine` requires points or a box, validates box order and bounds, forbids `start`/`end`/`output` on a preview, and keeps `time` inside the tracked span. `result` carries `png` and `mask` bytes; `output` carries `image`, `path`, `src`, `state` (`tracking` \| `done`). Renderer. |
| `models.ts` | `models`: list generation models. Exports `ModelInfo` (`type` image/video/audio, `id`, `name`, `durations?`, `aspectRatios?`, `features?` start-frame/end-frame/audio). Input `type?`. Renderer. |
| `voices.ts` | `voices`: list speech voices for `generate.voice`. Exports `VoiceInfo` (`id`, `label`, `description`). Renderer. |
| `fonts.ts` | `fonts`: list local font families. Exports `FontFamily` (`family`, `variants[{weight, style, source}]`) and `FONT_LIMIT = 50`. Input `family?`, `weights?`, `style?`, `limit?`. Output `families`, `total`. Renderer. |
| `logs.ts` | `logs`: recent app console output. Exports `LOG_TAIL = 100`, `LOG_MESSAGE_MAX = 4000`. Input `tail?`, `level?` (`LogLevel`), `since?`, `contains?`. Output `{ entries: LogEntry[] }`. Main process. |
| `screenshot.ts` | `screenshot`: PNG of the whole app window. Input `outputDirField`. `result` `{ png, width, height }`; `output` `{ path, width, height }`. Renderer. |
| `report.ts` | `report`: file a GitHub issue on `diffusionstudio/editor` via `gh`. Exports `ISSUE_LOG_TAIL = 50`. Input `title`, `body?`, `commands?`, `logs?`. Output `{ url }`. Main process. |
| `tools.test.ts` | Vitest: input refinements (`media_grab`, `capture`, `media_filmstrip`, `media_listen`, `logs`, `export`, `media_segment`) and `output` vs `result` shape splits (`context`, `media_transcribe`, image tools). |

## How it works

- Every file calls `defineTool({...})` from `../tool.ts`. `defineTool` is identity with inference: it keeps the literal `name` and exact schema types.
- Each tool sets `environment`: `"renderer"` when it needs the open project, the engine, or browser media APIs; `"main"` (`logs`, `report`) when it needs the file system or a child process.
- Tools compose shared blocks from `../schemas.ts` (`NodeId`, `SceneId`, `AssetPath`, `Bytes`, `TimecodedImage`, `ImageRef`, `outputDirField`, `sheetFields` + `checkSheetOptions`, `windowFields` + `checkWindow`, `LogLevel`, `LogEntry`) and `../time.ts` (`Time`, `NonNegativeTime`, `TIME_FORMS`). `Time` parses seconds, `"45f"`, or `"MM:SS"` to seconds via `parseTime` from `@diffusionstudio/jsx`.
- `output` is what the caller receives (JSON structured content). `result` is what the handler returns when it differs: bytes for images (`capture`, `media_grab`, `media_filmstrip`, `media_waveform`, `screenshot`, `media_segment`, `context` masks) or the full transcript (`media_transcribe`). The desktop server converts `result` to `output` by writing files (`apps/desktop/src/dapi/present.ts`).
- Cross-tool reuse inside this dir: `media-waveform.ts` imports `previewFields` from `media-filmstrip.ts`; `context.ts` imports `segmentSpan` and `segmentFound` from `media-segment.ts` to shape `MaskRow`.
- Input `superRefine` blocks enforce cross-field rules at parse time, so handlers receive valid args. `tools.test.ts` pins these rules.
- `../catalog.ts` imports all 18 tools into the ordered `catalog` array (project loop, media inspection, then app/machine utilities) and derives `ToolName`, `ToolArgs`, `ToolOutput`, `ToolResult`, `toolByName`, `isToolName`.

## Interfaces

- Depends on:
  - `packages/dapi/src/tool.ts` (`defineTool`, `Tool`, `Environment`)
  - `packages/dapi/src/schemas.ts` (shared field and refinement helpers)
  - `packages/dapi/src/time.ts` (`Time`, `NonNegativeTime`, `TIME_FORMS`)
  - `zod` v4; `@diffusionstudio/jsx` `parseTime` (through `time.ts`) — see [../../../jsx/README.md](../../../jsx/README.md)
- Used by:
  - `packages/dapi/src/catalog.ts`: builds the `catalog` array and name-keyed types.
  - `packages/dapi/src/index.ts`: re-exports constants (`FRAME_CAP`, `SEGMENT_MODELS`, `WEAK_IOU`, `ISSUE_LOG_TAIL`, `LOG_TAIL`, `LOG_MESSAGE_MAX`, `FONT_LIMIT`) and named types (`CheckIssue`, `ExportSettings`, `ModelInfo`, `VoiceInfo`, `FrameQuality`, `TranscriptSegment`, `FontFamily`, `GenerationRow`, `MaskRow`, and per-tool `*Request` / `*Result` aliases).
  - `apps/web/src/dapi/handlers/*.ts`: one renderer handler per renderer tool, typed `ToolHandler<N> = (args: ToolArgs<N>, ctx) => Promise<ToolResult<N>>` (`apps/web/src/dapi/handler.ts`, `ServedToolName` excludes `logs` and `report`).
  - `apps/desktop/src/dapi/handlers/logs.ts`, `report.ts`: main-process handlers for the two `"main"` tools.
  - `apps/desktop/src/dapi/present.ts`: maps `result` bytes to `output` paths per tool name.
  - `apps/desktop/src/dapi/server.ts`, `tools-session.ts`, `renderer-calls.ts`: serve the catalog over MCP and route calls by `environment`.
  - `apps/cli/src/cli-client.ts`, `mcp-proxy.ts`: CLI commands and MCP proxy typed by the catalog.

Up: [../README.md](../README.md)
