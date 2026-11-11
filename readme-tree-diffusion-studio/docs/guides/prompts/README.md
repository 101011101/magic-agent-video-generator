# `docs/guides/prompts`

Prompt-writing guidance for the AI-backed media tools; today it covers only `media_listen`.

## Parts

| Part | Role |
| --- | --- |
| `media-listen.md` | Explains that `media_listen` puts a multimodal model in front of an audio track and answers a prompt about it; with no prompt it returns a general description. Rules: be specific about what you want; ask for timestamps so the answer aligns to the timeline; refer to moments as `MM:SS` (e.g. `01:15`). Five example prompts: 3-sentence summary, explain examples at `00:05` and `00:10`, key events with timestamps, transcribe with timestamps, name the music track with start/end. |

## How it works

- The agent reaches this page from the "Listen to the audio" step in `docs/skills/editor.md` and `docs/skills/watch.md`, or from the tool reference `docs/reference/tools/media/listen.md`.
- It shapes the `prompt` argument of `media_listen` with a stated goal and an explicit timestamp request. Returned timestamps then feed `media_grab` `times` or the segment offsets used in the podcast walkthrough.

## Interfaces

- Depends on: the `media_listen` tool, documented at [../../reference/tools/README.md](../../reference/tools/README.md) (`media/listen.md`: costs credits, needs a signed-in account, takes `start`/`end` windows).
- Used by: `docs/skills/editor.md` and `docs/skills/watch.md` (linked from the analysis ladder and the Examples/Prompts list); `docs/reference/tools/media/listen.md` links back to it as "the prompt guide"; `docs/guides/walkthroughs/podcast-clip.md` applies the pattern with a clip-finding prompt. No code references it.

Up: [../README.md](../README.md)
