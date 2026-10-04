# Test-Set Viewer

- Run from the repo root: `node docs/PRD/test-set/viewer/server.mjs`. No npm install is necessary (Node built-in modules only).
- Open `http://127.0.0.1:4321/`. Set the `PORT` env var to use a different port.
- **Test set** tab: reads `docs/PRD/test-set/video-prompts.md` on each reload. Filter by group, subsystem, provenance or text.
- **My prompts** tab: autosaves about 800 ms after each change to `docs/PRD/test-set/my-prompts.json` (source of truth), `my-prompts.md` and `my-prompts.csv`. Do not edit the .md or .csv by hand; the next save overwrites them.
- Server offline: edits stay in browser localStorage and upload on the next successful save.
