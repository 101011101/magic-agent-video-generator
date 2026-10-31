# V2 — the film pipeline, rebuilt clean

Natural language → story → assets → screenplay → state tables → keyframes → clips → film. The design is in `prd/`, one file
per subsystem, starting with `prd/00-overview.md`; the decisions behind it are in `prd/10-decisions.md`. Everything before V2 (`V1/`, `V0/`) is archived and carries an `ARCHIVED.md`;
it is reference material, nothing in it is run.

## Layout

| folder | what is in it |
|---|---|
| `prd/` | the product requirements: `00-overview.md` for how the subsystems work together, then one file per subsystem, costs, what is built, decisions (`PRD.md` is a pointer) |
| `backend/` | the code: `composer/` (the film chain: story, assets, screenplay, state, keyframes, sound, edit, the CLI `pipeline.mjs`, the page writers), `agent/` (the conversation, the planner, the working tree, the executor, the server), `lib/` (shared: env, llm, jobs, Magic Hour client, media, captions, the model registry), `tools/` (custom tools by code) |
| `frontend/` | the chat page (`index.html`), the tree drawing (`dag.js`), the test scripts (`scripts.js`); served by `backend/agent/server.mjs` |
| `tests/` | small runnable test scripts (`state`, `edit`, `audit`) and the fixtures they use (a real run record from vanderbilt6; synthetic scripts for the audit cases) |
| `runs/` | raw results, one folder per run label: `run.json`, `state.json`, references, stills, clips; never edited by hand |
| `results/` | organised results: one HTML page per run, regenerated from `runs/` by `backend/composer/results.js` |
| `drafts/` | draft code and draft design material: `CASES.md`, the archived PRDs, sketches not yet in `prd/` |
| `tickets/` | one file per ticket; the open tickets are the to-do list |

Each folder has its own `README.md` saying what belongs there.

## Running

```
cd /Users/arviny/Downloads/Code/magic-agent-video-generator
CLEANED_CAP=<ledger total + what you approve> node V2/backend/composer/pipeline.mjs \
  --brief "An interesting true fact about Cornelius Vanderbilt, as a 30-second live-action film." \
  --label vanderbilt7 \
  --until keyframes
```

Flags:

- `--brief "…"` the natural-language brief; `--label <name>` the run folder under `runs/`.
- `--reuse <old run dir>` import an earlier run's asset bank when the element ids match, so plates are not paid for twice.
- `--until story | assets | screenplay | state | keyframes | paint | film` where to stop. `keyframes` writes every keyframe
  prompt and the state tables and stops before the first still is painted; `paint` paints the stills and stops before the
  first clip; `film` makes the clips and the stitch.
- `--retry s1-3,clip-2` remake the named items (every earlier attempt stays on disk; anything built on a retried still is
  forgotten); `--accept s1-3,clip-2` keep flagged items as they are; `--recheck s1-3` run the gates again on a still as
  painted, after a gate's criterion changed; `--dry` sends no paid call and lists each job a real run would send with its
  cost (the text and vision calls still run); `--clips pinned|start|t2v|seq` picks how shots become clips, with
  `--seq-across`, `--max-seq`, `--speed-up`, `--voice-refs`, `--only clip-N`; `--parallel N` limits the clips sent at once
  (all by default).
- `--tier paid|cheap|free` picks the model profile (`paid`: nano-banana-pro 2k and wan-3.0 720p, every film so far; `cheap`:
  flux-2-klein 2k and minimax-h3 720p, the free-flagged models at paid resolutions; `free`: the same models at the free
  plan's 640px and 480p). `--still`, `--res`, `--model`, `--vres` override one part of it. Changing a model changes the
  pipeline through the registry (`backend/lib/models.js`): the screenplay's grid of clip lengths, how many reference images a
  paint may send, which clip modes are possible, the resolutions and every cost. `--script-from <label>` reuses another
  run's screenplay, so the same film can be made on other models and compared frame for frame;
  `node V2/backend/composer/compare.js <labelA> <labelB>` writes the two runs side by side, still by still, with gate verdicts and the
  films (`V2/results/compare-<a>-vs-<b>/index.html`).

Keys come from the environment or the repository's `.env` (`OPENAI_API_KEY`, `MAGIC_HOUR_API_KEY`). The `.env` is never
committed.

## Rules of the house

- **Gates flag only.** A failed check marks the item and stops the next stage. Nothing is remade automatically; the user
  looks at the item in the results page and says retry or accept.
- **Nothing paid without an explicit go.** The pipeline stops before the first still and before the first clip unless told
  to continue, and `CLEANED_CAP` bounds the ledger.
- **Never edit a generated prompt by hand.** Prompts are transcriptions of the screenplay and the state tables. A wrong
  prompt is fixed in the schema, the rule, the template or the query that produced it.
- **The reference carries the look.** Prompt text says what the moment is, where people are relative to each other and what
  changed; the images say what things look like.
- **Raw results are never hand-edited.** `runs/` is written by the pipeline only; `results/` is regenerated from it.

## Where the old work is

- `V1/`: the October 2026 experiments this V2 is ported from (`V1/src/`, `V1/experiments/`, the runs
  `V1/runs/exp-*`, the PRDs under `V1/docs/`). See `V1/ARCHIVED.md`.
- `V0/`: the earlier pipeline. See `V0/ARCHIVED.md`.
- `CASES.md` at the repository root, copied into `drafts/`: the media cases and the v3 schema sketch.
