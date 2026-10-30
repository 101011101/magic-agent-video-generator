# V2/reference

Reference material for the V2 pipeline: facts about third-party services, gathered from their official documentation, so that design decisions can cite a source instead of memory.

| File | What it holds |
| --- | --- |
| `magic-hour-api-sheet.md` | Every tool Magic Hour exposes through its REST API (42 operations on 39 paths), grouped as video generation, image generation and editing, faces and people, audio, and utilities. For each endpoint: path and method, request fields with allowed values, models with durations, resolutions, aspect ratios, audio, end-frame and reference support, input constraints, response, credit cost and stated policy limits. Ends with "What this means for the V2 pipeline", a list of what the docs do not say, and the full source list. Compiled 2026-10-30 from docs.magichour.ai, magichour.ai/api, the terms of service, the FAQ and help.magichour.ai; nothing in it was verified against the live API. |

Conventions: anything a source did not state is marked "not found in docs" rather than inferred; figures that come from the web app rather than the API are labelled "web app". Re-check `https://docs.magichour.ai/api-reference/models.md` and `https://magichour.ai/changelog` before relying on prices or model lists, since both change monthly.
