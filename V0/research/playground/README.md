# Playground

- Purpose: run Magic Hour tools by hand, chain outputs into later calls, and find which calls contribute to a final video.
- Start: `node current/research/playground/server.mjs`, then open http://localhost:4477.
- Key: `MAGIC_HOUR_API_KEY` env, or `current/tests/state-manager/.env`.
- Forms: generated from `openapi.json` (Magic Hour spec, fetched 2026-10-11). All 29 tools, all request fields.
- Inputs: type text, paste a ref, drag an output card onto a field, or drop a local file (becomes an `Upload` node).
- Refs: `@n3` (output 0), `@n3.1` (output 1), `@n3:first` / `@n3:last` (video frame, extracted with ffmpeg). The server uploads ref media to Magic Hour on use.
- Defaults: each run saves its body as that tool's default in `defaults.json`.
- Lineage: "Set final" on a node marks its ancestor calls as on path. Calls not on path are dead ends.
- Record: `sessions/<id>/session.json` holds every node (tool, body, input refs, resolved request, raw response, credits, time, outputs). Media goes to `sessions/<id>/media/` (gitignored).
