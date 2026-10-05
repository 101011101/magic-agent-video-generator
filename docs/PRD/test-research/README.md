# Test Research: Creative Director Samples

> Samples to choose the creative director's output format. See [02-creative-director.md](../subsystems/02-creative-director.md).

**Test basis (decided in chat):**
- Tests use operational chunks of stories.
- Model: GPT-6.1 Sol (OpenAI API, effort high).
- Two chunk formats run on the same story. Only the chunking prompt differs:
  - **A. Straight operational chunks** (`v3b`): full state per chunk.
  - **B. Change-based chunks** (`v5b`): a baseline, then only the changes per chunk. Held = the state of the first operational frame.
- The comparison decides which format is better.

**Earlier exploration (complete):**
- Questions: one-shot script vs. structured prompt → script; story → chunks vs. a director's shooting script; GPT-6.1 Sol vs. Claude Opus 5.5.
- Result: story → operational chunks chosen. Findings are in [02-creative-director.md](../subsystems/02-creative-director.md).

**Variants (prompt templates in `templates/`):**
1. `v1` one-shot script.
2. `v2a` structured prompt → `v2b` script.
3. `v3a` story → `v3b` straight operational chunks (format A).
4. `v4` director's shooting script.
5. `v3a` story → `v5b` change-based chunks (format B).

**Inputs:** `requests.json` (6 requests from the test set).

**Pages:**
- [gpt-chunk-compare.html](gpt-chunk-compare.html): GPT story, then format A and format B side by side. The test basis.
- [story-to-changes.html](story-to-changes.html): story and format B, both models.
- [results.html](results.html): all variants, both models.

**Run:**
- GPT: put `OPENAI_API_KEY=...` in `docs/PRD/test-research/.env` (gitignored), then `node docs/PRD/test-research/run-gpt.mjs`. Optional: `GPT_MODEL`, `GPT_EFFORT` (default `gpt-6.1-sol`, `high`), `--only <id>`, `--force`. Cached steps are skipped.
- Claude: written by Claude Code subagents (Opus 5.5) from the same templates. Not raw API calls.
- Pages: `node docs/PRD/test-research/build-html.mjs [--focus | --compare-gpt]`.

**Outputs:** `outputs/<gpt|claude>/<request id>/<step>.md`. GPT token usage in `meta.json`.

**Cost so far (GPT):** about $0.76 for 42 calls.

**Caveats:**
- The Claude samples come from agents with a working context, not from clean single API calls.
- `claude/p4-lighthouse/v5b` was edited by the agent: its first draft totalled about 130 s and was rescaled to 120 s.
