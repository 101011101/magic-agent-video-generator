# `docs/reference/tools`

Reference for the 18 agent tools: the surface contract (MCP + `diffusion` CLI, names, results, errors, shared types) in `README.md`, plus one page per tool with its fields, output shape, and failure cases.

## Parts

| Part | Role |
| --- | --- |
| `README.md` | Index. Two surfaces for one catalog: MCP at `http://127.0.0.1:3274/mcp` (Streamable HTTP; `tools/list` carries these descriptions as JSON Schema 2020-12; stdio-only clients bridge with `mcp-remote`) and CLI `diffusion` (alias `dapi`; `--help` prints the same field help). Catalog lives in `packages/dapi`. Naming rules: `_` = CLI space (`media_grab` -> `diffusion media grab`, `media` alias `m`); first field = positional; other fields = kebab-case options. Result contract: one JSON object (`structuredContent` + text block over MCP; stdout on CLI); image tools write PNGs and return paths, inline over MCP when <=4 images and <=1 MB each. Error contract: sentence message; `isError: true` over MCP; stderr + exit `1` on CLI; app must be running. Tool table, five tool groups, `yt-dlp` note for downloads, shared types `Asset`, `Time`, `NodeId`. |
| `open.md` | `open` / `diffusion open [path]`. Opens or creates a project folder: creates missing folder, writes `index.tsx` with an empty stage when no entry file, adds `projectId` / `displayName` / `main` / `scripts` to `package.json` when no record. Leaves existing files and `.js`/`.jsx` projects alone. CLI also launches the app (macOS, Windows); `-b, --background` keeps it headless. Output `{ id, name, dir }`. |
| `context.md` | `context` / `diffusion context` (alias `ctx`). No input. Reports only what the JSX cannot say: `rootDir`, `projectDir`, `currentTime` (playhead, seconds, active scene), `fontFamilies` (registered in the world), `generations[]` (`generate.*` state: `generating` / `failed` / `done`, `asset` library path), `masks[]` (`media_segment` background tracks: `loading` / `tracking` / `done` / `failed`, `progress`, `src`, `image`). Poll it to wait without blocking. |
| `capture.md` | `capture` / `diffusion capture <id>`. Renders scene frames offscreen at scene size, fresh mount, forward-only evaluation (same frames an export encodes). Default: contact sheets up to 12 cells (`perSheet`), max 2576x1456, timecode labels dropping zero segments (`08s10f`, `0f`); `separate` writes 720p PNG per position. `times` relative to workarea start. Output `{ images: [{ timecode, path }] }` under `dapi-capture-*` temp dir unless `output`. Scenes only; asset pixels -> `media_grab`. |
| `check.md` | `check` / `diffusion check <id>`. Structural analysis of a node subtree, no render, no credits. `stats` (`nodes`, `byKind`, `depth`, `duration`) + `issues[]` with codes `black-frames`, `no-visuals`, `never-visible`, `zero-duration`, `transparent`, `source-error`; `ranges` in seconds relative to node start. Coverage: video/image/html/shape/text/caption draw; scene background, audio, clip paths, adjustment layers do not. CLI exits `1` on error-severity issues. |
| `export.md` | `export` / `diffusion export <id> [output]`. Full encode of a scene workarea (video + audio). Settings from `diffusion.export.<id>` in project `package.json` (format `mp4`/`webm`/`ogg`/`mov`; video codec, bitrate, fps, resolution; audio codec, sampleRate, bitrate); default 1080p H.264 MP4 + AAC. Output path extension picks container and swaps incompatible codecs (Opus for WebM/Ogg, VP9 for WebM). Default path `exports/<id>.<format>`. One export at a time; CLI waits up to 60 min. Output `{ path, width, height, duration, size, config }`. |
| [media/](media/README.md) | Seven `media_*` pages: `probe`, `grab`, `filmstrip`, `waveform`, `transcribe`, `listen`, `segment`. Inspect a file by path (absolute/URL always; library path needs open project). All local and free except `listen` (credits, sign-in). `segment` writes the `.mask` file for `<mask src>`. |
| `models.md` | `models` / `diffusion models [type]`. Lists generation model ids for `generate.*` with constraints: `durations`, `aspectRatios`, `features` (`start-frame`, `end-frame`, `audio`) for video. Filter `image` / `video` / `audio`. No tool generates. |
| `voices.md` | `voices` / `diffusion voices`. No input. `{ voices: [{ id, label, description }] }` for `generate.voice`. |
| `fonts.md` | `fonts` / `diffusion fonts`. Local machine fonts, valid `fontFamily` on `<text>`. Filters `family`, `weights`, `style`, `limit` (default 50). Output `{ families: [{ family, variants: [{ weight, style, source }] }], total }`. Contrast: `context.fontFamilies` = registered in the open project. |
| `logs.md` | `logs` / `diffusion logs`. Last 2000 console entries buffered in the main process across reloads. Filters `tail` (default 100), `level`, `since` (ms; pass last `ts` for deltas), `contains`. Entries `{ ts, level, message, source }`, oldest first; messages cut at 4000 chars. Export and generation progress appear here. |
| `screenshot.md` | `screenshot` / `diffusion screenshot`. Full app window PNG from the window buffer (works when hidden). File `diffusion-studio_<date>_<time>.png`. Output `{ path, width, height }`. For composition checks use `capture`. |
| `report.md` | `report` / `diffusion report <title>` (alias `issue`). Files a public GitHub issue on `diffusionstudio/editor` via authenticated `gh` CLI, no review step. Body = `body` + `## Repro` (`commands`) + `## Environment` (app, platform, electron) + `## App logs` (`logs` tail, default 50; `0` omits). Runs in main process; no project needed. Output `{ url }`. |

## How it works

- Every page has the same shape: intro paragraph (the tool `description` served over MCP and `--help`), name table (MCP tool, CLI, aliases), `## Input` field table (Field, Type, CLI flag, Description), behaviour sections, `## Output` TypeScript shape, `## Errors`.
- `README.md` defines once what pages assume: `Time` input format (`1.5`, `45f`, `1:30`), results in plain seconds, `NodeId` with `file:id` disambiguation, PNG-on-disk + inline-over-MCP delivery, and the error delivery per surface.
- The project loop the index prescribes: `open` once -> edit JSX files (the source is the document; no tool pushes content) -> `context` for playhead, generation and mask state -> `check` (structural, instant) then `capture` (visual, one frame) to verify -> `export` only when asked.
- Node-id tools (`capture`, `check`, `export`) share id resolution rules and the `No project open` error. `capture` and `export` accept scenes only; `check` accepts any node.
- Async work is polled, never awaited: `generate.*` via `context.generations`, `media_segment` library tracks via `context.masks`, export progress via `logs` with `since`.
- Declaration lists (`models`, `voices`, `fonts`) supply valid ids for JSX props (`generate.*` model id, `generate.voice` id, `fontFamily`); generation itself happens on mount, not via a tool.
- App/machine tools (`logs`, `screenshot`, `report`) need no open project; `report` reuses the `logs` buffer and warns that entries go to a public issue.
- Cross-links inside the dir: `capture.md` <-> `media/grab.md`, `capture.md` <-> `check.md` <-> `export.md`, `context.md` -> `fonts.md`, `media/probe.md`, `media/segment.md`, `report.md` -> `logs.md`, every project tool -> `open.md`.
- Cross-links out: `README.md` -> `../jsx/README.md`, `../jsx/generate.md`, `../jsx/media.md`, `../jsx/timing.md`; `context.md` -> `../jsx/errors.md#failed-sources`; `fonts.md` -> `../jsx/text.md`, `../jsx/fonts.md`; `models.md` / `voices.md` -> `../jsx/generate.md`.
- Text drift check: `packages/dapi/src/tools/report.ts` description says "dapi version" / "dapi commands"; `report.md` says "diffusion version" / "diffusion commands". Names differ, meaning matches.

## Interfaces

- Depends on:
  - `packages/dapi/src/tools/{open,context,capture,check,export,models,voices,fonts,logs,screenshot,report,media-*}.ts` — the zod schemas and descriptions these pages mirror. See [../../../packages/dapi/README.md](../../../packages/dapi/README.md).
  - Handlers the pages describe: renderer tools in `apps/web/src/dapi/handlers/*.ts`; main-process tools `logs`, `report` in `apps/desktop/src/dapi/handlers/`. MCP server `apps/desktop/src/dapi/server.ts`; CLI `apps/cli`. See [../../../apps/desktop/README.md](../../../apps/desktop/README.md), [../../../apps/cli/README.md](../../../apps/cli/README.md).
  - `docs/reference/jsx/` for the markup the tools read (`generate.md`, `media.md`, `timing.md`, `errors.md`, `text.md`, `fonts.md`, `styles.md#mask`). See [../jsx/README.md](../jsx/README.md).
- Used by:
  - `docs/skills/editor.md` (links `README.md` as "Tool reference"); `docs/guides/prompts/media-listen.md`; `docs/guides/walkthroughs/`.
  - `apps/desktop/src/projects.ts` line 644: generated project text links the GitHub URL of `README.md`.
  - Root `README.md` line 214 links `README.md`.
  - Agents over MCP: server instructions give the installed-app path of these docs (staged by `apps/desktop/scripts/stage-docs.mjs`, see [../../README.md](../../README.md)).

Up: [../README.md](../README.md)
