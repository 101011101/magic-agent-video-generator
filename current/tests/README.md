# Tests

**Sections:**
- [prompt-set/](prompt-set/video-prompts.md): 51 test prompts in 17 groups. Each prompt has expected handling. Local viewer in `prompt-set/viewer/`.
- [creative-director/](creative-director/README.md): creative director experiment. Templates, runner, samples (GPT-6.1 Sol, Claude Opus 5.5) and comparison pages.
- [fixtures/](fixtures/): machine-readable inputs for code tests.

**Fixtures** (rebuild with `node current/tests/fixtures/build-fixtures.mjs`):
- `prompts.json`: the 51 prompt-set prompts (group, prompt, uploads, expected handling, provenance) and the 9 creative director requests.
- `operational-chunks.json`: 30 operational-chunk samples (request, model, format A or B, story path, chunks path). Inputs for state splitter tests.

**Use for state management:**
- Feed `operational-chunks.json` entries to the operations splitter.
- Compare format A (`A-straight`) and format B (`B-change`) on the same request and model.
