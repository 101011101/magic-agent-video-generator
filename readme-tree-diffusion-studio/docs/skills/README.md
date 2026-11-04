# `docs/skills`

Skill pages: the operating procedures an agent reads on connect and follows for the whole session when it drives Diffusion Studio over MCP.

## Parts

| Part | Role |
| --- | --- |
| `editor.md` | The default skill. Sections: **Footage analysis** (probe → waveform/filmstrip → `media_listen` → `media_transcribe` → `media_grab`), **The editing loop** (write a brief, lay A-roll as JSX, layer B-roll, symlink media into `assets/`, poll `context`), **Compositing** (visual budget defaults to 0, no darkening for legibility, easing by intent, house style as fallback), **Verification** (`check` → `capture` → reconcile with brief; never export to verify), **Best practices** (`<sequence>` wrapping, `@inspect` consts, Three.js in `<surface>`, `media_segment` + `<mask>`, `<html>` with paused anime.js, captions last, `diffusion open -b <dir>`), **Docs** and **Examples** link lists. |
| `watch.md` | Read-only skill for answering questions about footage. Sections: **Watching footage** (same analysis ladder as `editor.md`, plus `yt-dlp` audio-only download for page URLs), **Matching depth to the question** (probe for duration; waveform/filmstrip for pacing; transcript for speech; `media_listen` for non-speech audio; frames only for what is seen), **Answering** (ground every claim in evidence, anchor to `MM:SS` timestamps, hand edits to the `editor` skill). |

## How it works

- `docs/INSTRUCTIONS.md` names both pages and their trigger conditions. `apps/desktop/src/dapi/docs.ts` `instructions(docsDir)` returns that file verbatim plus the docs path on every MCP connect, so the agent reads the skill page first.
- Both skills share one analysis ladder: `media_probe` decides which tracks exist; `media_waveform` and `media_filmstrip` give structure; `media_listen` or `media_transcribe` give content; `media_grab` samples frames at the timestamps audio found.
- `editor.md` continues into the edit: the project is a folder of JSX, `open` once, write files, save; the app recompiles. `check` and `capture` verify; `screenshot` and `logs` debug.
- `watch.md` stops at answering. It states that changing footage is `editor.md`'s job.
- `editor.md` routes to the rest of the docs: easings guide before animating, house style when no brand is given, walkthroughs as worked examples, JSX and tool references as the authority.

## Interfaces

- Depends on: MCP tools named in the text (`media_probe`, `media_waveform`, `media_filmstrip`, `media_listen`, `media_transcribe`, `media_grab`, `media_segment`, `context`, `open`, `check`, `capture`, `screenshot`, `logs`), documented in [../reference/tools/README.md](../reference/tools/README.md).
- Depends on: [../guides/prompts/README.md](../guides/prompts/README.md) (`media-listen.md`), [../guides/motion/README.md](../guides/motion/README.md) (`easings.md`), [../guides/walkthroughs/README.md](../guides/walkthroughs/README.md), [../brand/README.md](../brand/README.md), [../reference/jsx/README.md](../reference/jsx/README.md), [../examples/README.md](../examples/README.md).
- Used by: `docs/INSTRUCTIONS.md` (lists `skills/editor.md` and `skills/watch.md`); `apps/desktop/src/dapi/docs.test.ts` asserts the repo's `INSTRUCTIONS.md` names both pages; `apps/desktop/scripts/stage-docs.mjs` ships this folder inside the app.
- Used by: `apps/desktop/src/dapi/server.ts` `DapiServerDeps.docsDir` comment says the staged docs include "the skill headers" for every session. Unclear from source how skill headers are parsed beyond `INSTRUCTIONS.md`.

Up: [../README.md](../README.md)
