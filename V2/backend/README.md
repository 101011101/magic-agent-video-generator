# backend — the code: composer, agent, lib, tools

One folder per subsystem, in pipeline order, plus the shared library. Each module exports functions that take and return
plain data; `composer/pipeline.mjs` wires them and owns the run folder. See `../prd/00-overview.md` and the per-subsystem files under
`../prd/` for what each subsystem must do.

| module | role |
|---|---|
| `lib/env.js` | paths (`RUNS`, `RESULTS`, the cache) and API keys from the environment or the repository `.env` |
| `lib/llm.js` | OpenAI Responses API calls with strict JSON schema, optional images and tools, a disk cache keyed on everything that shapes the answer, a `salt` to force a fresh call |
| `lib/jobs.js` | every paid Magic Hour call: signature cache so a resumed run pays nothing twice, the credit cap and ledger, uploads, the job record with prompt and inputs; a pending job is resumed before anything is posted; the ledger is locked across labels with in-flight reservations; the cap must be a number |
| `lib/magichour.js` | the Magic Hour REST client: create a job, poll it, download the output, upload a file; a POST is never retried; `pollJob` resumes a job by id |
| `lib/media.js` | ffmpeg helpers: frames, SSIM, crops, the stitch; `bars` (letterbox detection), `hasAudio`, `fps`; the stitch crops thin bars, takes the highest rate, adds silent tracks |
| `lib/captions.js` | caption and subtitle cards (AppKit through `osascript`) and their compositing; subtitles timed from the screenplay's lines |
| `composer/story/story.js` | the research gate (sets `mode`), the research round with web search, the story from the facts |
| `composer/assets/assets.js` | the element table, the medium, procurement (Wikimedia Commons with a vision pick, generation with a style reference, reuse), the cast feature lines, the voice descriptors, the plate descriptions |
| `composer/screenplay/screenplay.js` | the shooting-script schema, the one call that writes it, the code checks, the text renderer; `normalizeShots` (film-wide numbers) |
| `composer/state/state.js` | the state manager: one pass over the screenplay into `state.json` (elements, places, stills, clips), the environment-reference and portrait rules, the queries the templates use, the three gates; cards never image 1; the room gate against image 1; crop guards; unique labels |
| `composer/keyframes/template.js` | the keyframe prompt template: FRAME, PEOPLE, CHANGES, REFERENCES, RULES, filled from the state tables |
| `composer/keyframes/keyframes.js` | painting: attempts, crops of the master for punch-ins, the people and room gates, the review loop; the bars gate; stale ids moved to attempts; a retried direct crop is painted |
| `composer/sound/sound.js` | the narration track and mix; the music bed (`musicBed`, one film-level track) and its mix with ducking and arc cuts (`mixMusic`); subtitles and captions re-exported |
| `composer/edit/edit.js` | the clip prompt, rendering through `jobs`, the clip gate, the stitch with overlays; the guarded per-clip body; chains checked; cards by code only when both stills are cards |
| `composer/pipeline.mjs` | the CLI: `--brief`, `--label`, `--reuse`, `--until`, `--retry`, `--accept`, `--recheck`, `--dry` |
| `composer/film-page.js` | writes `../results/<label>-film/index.html`: the finished product, the film first, then the cut shot by shot with its clip, its two keyframes, what is said and shown; `node V2/backend/composer/film-page.js <label>` |
| `composer/results.js` | writes `../results/<label>/index.html` from a run folder: the screenplay, every keyframe with its inputs and attempts, the clips, the film, the costs |

Rules for code here: no model writes a prompt after the screenplay; templates are transcriptions; gates flag and never
remake; a paid call always goes through `lib/jobs.js`.


| `agent/` | the conversation and the tools: `sheet.js` (the question tree), `plan.js` (shape and the proposed tree), `catalogue.js`, `worktree.js`, `simulate.js`, `execute.js` (the real tools through `lib/jobs.js`), `server.mjs` (the local app serving `../frontend`) |
| `tools/` | custom tools by code, zero credits (`text-overlay`), merged into the catalogue |
