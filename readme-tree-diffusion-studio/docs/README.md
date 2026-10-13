# `docs`

The agent-facing manual: skills, JSX and tool reference, guides, runnable examples, and a house-style brand kit, shipped inside the desktop app and handed to every MCP client on connect.

## Parts

| Part | Role |
| --- | --- |
| `INSTRUCTIONS.md` | Entry page. Tells a connected agent which skill page to read first (`skills/editor.md` default, `skills/watch.md` for footage questions). |
| [skills/](skills/README.md) | Workflow playbooks. `editor.md`: analyze, generate, compose, verify (probe → waveform/filmstrip → listen/transcribe → grab; A-roll then B-roll; `check` + `capture`, no export). `watch.md`: read-only footage Q&A with timestamps. |
| [reference/](reference/README.md) | Authoritative API. `jsx/`: the pseudo-SVG project markup (`<stage>`, `<scene>`, elements, paints, timing, keyframes, `generate.*`, `@inspect` variables, lifecycle, errors). `tools/`: one page per tool (`open`, `context`, `capture`, `check`, `export`, `media_*`, `models`, `voices`, `fonts`, `logs`, `screenshot`, `report`) as served over MCP and the `diffusion` CLI. |
| [guides/](guides/README.md) | Task know-how. `motion/easings.md`: six cubic-bezier easings. `prompts/media-listen.md`: prompt patterns for `media_listen`. `walkthroughs/`: end-to-end recipes (`podcast-clip.md`, `talking-head.md`). |
| [examples/](examples/README.md) | Eleven self-contained project entry files (`01-basics.tsx` … `11-redraw.tsx`), each default-exporting a `<stage>` with one `<scene>`. Cover sequences, genai, `useTicker`, `<htmlPaint>`, anime.js, three.js, WebGPU, `<shaderPaint>`, `@inspect`, TypeGPU, Redraw. `tsconfig.json` typechecks them with `jsxImportSource: @diffusionstudio/jsx`. |
| [brand/](brand/README.md) | Fallback house style, used only when the brief supplies none. `design.md`, `voice.md`, `video.md`, `library.md` (catalog). `assets/`: `components/` (`tokens.ts`, `title-card.tsx`, `lower-third.tsx`, `callout.tsx`, `media-grid.tsx`), `compositions/` (`product-demo.tsx`, `product-tour.tsx`, `end-card.tsx`), plus empty `audio/`, `fonts/`, `imagery/` slots (`.gitkeep`). |

## How it works

- `apps/desktop/scripts/stage-docs.mjs` copies this tree verbatim into `apps/desktop/docs`; `forge.config.ts` (`extraResource`) ships it as `Contents/Resources/docs`. Layout is preserved because pages link to each other by relative path.
- On MCP connect, `apps/desktop/src/dapi/docs.ts` (`instructions()`) sends `INSTRUCTIONS.md` text plus the on-disk docs path. Agents then read the rest as plain files. Docs are read-only for agents.
- `INSTRUCTIONS.md` → skill page → skill page links into `reference/`, `guides/`, and `brand/` as needed.
- Skills describe the loop: `open` a project folder, write JSX (the source is the document), save, verify with `check`/`capture`, `export` only when asked.
- `reference/tools/README.md` states the surface contract: one tool catalog (`packages/dapi`) exposed as MCP at `http://127.0.0.1:3274/mcp` and as the `diffusion` CLI; `_` in a tool name is a CLI subcommand space.
- `brand/README.md` routes by task (design / copy / video / assets) and tells agents to reuse `library.md` items before creating new ones.
- `examples/` run by copying one file into a project folder as the entry and calling `open`. Some need extra packages (`three`, `typegpu`, `redraw`) or generation credits.

## Interfaces

- Depends on: `packages/jsx` (JSX types for `examples/tsconfig.json`); `packages/dapi` tool catalog (tool pages document it); `tsconfig.base.json`.
- Used by: `apps/desktop/scripts/stage-docs.mjs` (staging), `apps/desktop/forge.config.ts` (`extraResource`), `apps/desktop/src/dapi/docs.ts` (serves `INSTRUCTIONS.md`), `apps/desktop/src/projects.ts` (links to `reference/jsx`, `reference/tools`, `examples` in generated project text), `apps/desktop/src/dapi/docs.test.ts`. Root `README.md` points to `skills` via `npx skills add diffusionstudio/skills`.
- Related tree nodes: [../apps/desktop/README.md](../apps/desktop/README.md), [../packages/dapi/README.md](../packages/dapi/README.md), [../packages/jsx/README.md](../packages/jsx/README.md).

Up: [../README.md](../README.md)
