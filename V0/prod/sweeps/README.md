# Sweeps

> Model comparisons that hold everything constant except the model. Separate from the pipelines: a sweep answers "which tool", a pipeline run answers "does the system work". Ticket: [RUN-001](../../tickets/06-runs/RUN-001-image-model-cost-sweep.md).

**Run:** `node current/prod/sweeps/run-001.mjs [--execute] [--phase generate|score|all] [--only <arm>] [--editor-source <file>]`
A bare invocation is a **dry run**: it prints every request body and the exact cost and sends nothing. `--execute` spends.

## RUN-001 — image-model cost sweep

Both pipelines buy every image from `nano-banana-pro` at 150–200 credits; images are ~48% of a run's spend (`p4-lighthouse-v1`: clips 4,800, anchors 1,800, keyframes 1,400, retries 1,200). This asks whether a 5–50 credit model holds the three properties they keep failing on at full price.

| group | ticket | models | asks |
|---|---|---|---|
| `scale` | TEST-038 (M08) | 6 generators | is the prop drawn at its stated real size |
| `text` | TEST-039 (M09) | 6 generators | can "no text" be obeyed |
| `count` | TEST-040 (M10) | 6 generators | are exactly three things drawn |
| `edit` | TEST-041 (M11) | 4 editors | is identity and place kept through an edit |

**What is held:** `aspect_ratio=16:9`, `resolution=1k`, `image_count=1`, the prompt text, and for `edit` the source frame bytes. **What varies:** the model, and nothing else. That is the point — the previous round produced 21 shots in which every variable moved at once and nothing could be attributed.

**Cost:** 1,145 at the spec's quoted floors, 1,395 if `nano-banana-pro` bills 200 as it does at 2k. With `--editor-source` (skip the generated source frame) it is 995 / **1,195**, matching the ticket exactly.

## Two phases, on purpose

`generate` spends and needs no ffmpeg. `score` needs ffmpeg — `pipeline-v2/src/vision.js` pipes every image through it — and spends nothing. Paid frames reach disk before anything can fail, so a scoring bug or a machine without ffmpeg never costs a frame. Re-run `--phase score` later; it skips arms already scored.

## Reading the result

`current/tests/sweeps/run-001/` — `results.json` and `index.html` (the variable table, each group stating what was held and what changed).

- **est.** is the spec's "from N credits/image" floor; **charged** is what Magic Hour billed. They differ.
- **not scored** means the frame exists but the judge did not run. The credits were still spent. It is not a pass.

## Caveats

- **Resolution is 1k, not the 2k the pipelines run.** 1k is the only resolution all six generator models share — `krea-2` tops out at 1k, `nano-banana-pro` starts at it. Holding resolution constant is worth more than matching production, but the `nano-banana-pro` row is then a 1k proxy. A cheap winner needs confirming at 2k before it replaces anything, and `krea-2` never can.
- **One sample per cell.** These models are stochastic; a single frame separates "usually" from "never" only when the gap is large. Treat a narrow result as a reason to repeat the arm, not as an answer.
- Its own ledger (`current/tests/sweeps/ledger.json`, cap `MH_CAP`, default 2000). Sharing pipeline-memory's would force the cap past its 22,640 lifetime spend to run a 1,195 sweep.
