# T-048 · The MCP baseline: Magic Hour's own MCP, as is, on the same prompts, against the agent

status:     done (first numbers); open: the fixes it points at
priority:   high
subsystem:  bench

## The user's request (2026-11-01)

> yo can you get some tickets done, read the PRDs and the current tickets we are going to be building benchmarks mainly
> for the micro tasks and some stuff for the film related things, remember only free models
>
> Also, another baseline you should use as the benchmark is just our MCP as is. So, wherever you want to use this, let's
> say ChatGPT, install our MCP and just give it the exact same prompt you give your agent. And yours should knock the
> MCP out of the water every single time.
>
> I want to see the differences

what:
1. **The baseline runner**, `V2/bench/mcp/run.mjs`: every bench v1 item's messages, word for word, to an off-the-shelf
   chat model (the agent's own model, so only the system differs) with Magic Hour's hosted MCP server connected
   through OpenAI's remote-MCP tool and nothing else; the same proxy user and answer sheet; the record in the shape
   the agent's runner writes, so `bench/v1/grade.mjs`, `report.mjs`, `view.mjs` and `serve.mjs` read it unchanged.
2. **The free plan as a gate.** The key is a creator account; the benchmark is free models only. Every create call
   passes an approval gate that refuses paid models, resolutions above 640px / 480p, 4x upscales and spend beyond a
   free account's 400 credits per item, with the reason a free key would get. The balance tool and the delete tools
   are hidden; every other MCP tool is offered. Every call and every decision is in the record.
3. **The comparison**, `V2/bench/mcp/compare.mjs`: per item, both outputs side by side with both grades; a pairwise
   vision judge (both outputs in a fixed random order, the earlier picture shown for follow-ups) picks one; totals per
   group: pass, mean score, wins, win rate, credits, time, questions, the MCP's approval rounds and refused calls, the
   models it chose. `compare.md` is the text report; `index.html` the page.
4. **Film briefs**, `V2/bench/mcp/film/`: the briefs the pipeline has already made films for on the free tier
   (the economists' podcast, 775 credits), as bench items with the pipeline's film as the agent record, so the judge
   sees a 30-second multi-shot film next to the MCP's answer to the same brief. The bench's own film briefs (group I)
   on the MCP side; their agent side is the pipeline, run one brief at a time with a go.

why:
The agent's benchmark (`bench/v1`, 152 items) measured the agent against its own expectations. The user's bar is the
product's own MCP in a chat client: if the agent does not beat that on the same prompt, the agent is not worth its
complexity. The comparison is also the first measurement of what the agent adds in practice: fewer questions, no
approval round per job, code tools for text and crops, chains, gates.

acceptance:
`mcp-1`: all 152 micro items on the MCP side, graded with the same grader; `compare-mcp-1/compare.md` with the win
rate per group and the lists of where the MCP won and where both failed; the econ film pair judged; `prd/15-benchmark.md`
carries the MCP baseline in its baselines table and the first numbers; the runs table in `bench/mcp/README.md`.

## Built (2026-11-01)

The runner, the gate, the comparison and the film items. Probe: the chat model reached the MCP through OpenAI and read
the account (creator, 86,744 credits, 0 spent). Smoke (A01d, B07a, J49a): 35 credits, the balance moved by exactly
35; the MCP chose qwen-image-2.1 and flux-schnell at 640px on its own; A01d passed (VELORA spelled right), B07a 76
(details outside the car changed), J49a 27 (text in the book). The gate test (`--item-cap 3`): the call was refused,
the model reported "3 credits remaining, the lowest-cost image needs 5" and made nothing. The full micro pass is
`mcp-1`.

## The MCP arm complete (2026-11-01, later)

`mcp-1`: 152 items, 57 pass (38%), mean 60, 10,115 credits (a first pass to a 6,000 cap, then the last 29 items). The
agent's first real pass (`real-1`) was 47 pass (31%), mean 58, 9,314 credits. By group, the MCP arm is ahead on single
images (20 vs 13 pass), image edits (16 vs 13), short video (3 vs 1), composed pieces (3 vs 0) and sound (1 vs 0); the
agent is ahead on editing the user's video (4 vs 0: the MCP has no crop, trim, mix or text-to-speech and said so),
ads (2 vs 1), conversation (8 vs 7) and refusals (5 of 5 vs 0 of 5). The pairwise comparison and the film pairs are in
`V2/bench/v1/results/compare-mcp-1/` and `compare-film-1/`. One finding on the pipeline side: run from `--brief`, the
film chain makes a 30-second film whatever length the brief states (`--total` defaults to 30 and nothing reads the
brief's "8-second"); the benchmark's film driver (`bench/mcp/film/drive.sh`) now passes the item's length.

## The film pairs (2026-11-01, later still)

Four briefs through both: the pipeline on the free tier (flux-2-klein 640px stills, minimax-h3 480p) driven by
`bench/mcp/film/drive.sh` at the brief's length, and the MCP. The MCP won all four by the pairwise judge (two clear,
two slight): economists 42 vs 42, Cabin Coffee 58 vs 58, F-35A 29 vs 34, seed explainer 37 vs 100; credits 1,719 vs
1,344. The chain's structural wins (exact text by code overlay, narration it writes and times, gates that stop on the
free model's failures) did not outweigh the free still model's pictures. The paid still model made the ninth Top Gun
film; the free-tier chain has not yet beaten one text-to-video call on a one-scene brief. Two pipeline findings: the
film length is `--total` (default 30) and nothing reads it from the brief; the grader's transcription of an 8 s mix is
unreliable (it heard Italian in an English line that measures 10 dB above the bed).

## The comparison (2026-11-01, `results/compare-mcp-1/`)

152 items: agent 90 pass (59%) vs MCP 57 (38%); mean 75 vs 60; credits 8,275 vs 10,115; pairwise 73–68, 11 ties. The
user's bar ("knock the MCP out of the water every single time") is not met: the agent wins where its structure is the
difference (editing the user's video 13–2, sound 5–1, conversation 11–5, ads 8–4, refusals 5 of 5 vs 0) and loses on
single images 7–17, edits 8–16 and faces 3–7, where both pass and the judge prefers the MCP's picture. What the
records point at, for the agent's owners:
1. **The free tier's still model.** The chat model chose qwen-image-2.1 for 67 of 112 image calls; the agent's free tier
   paints on flux-2-klein (`TIERS.free.still`) unless `params.lettering` is set. qwen is 10 credits, "good" lettering,
   and the judge preferred its product shots and edits. A tier whose default still is qwen-image-2.1 (or a planner rule
   that picks it for product, label and headline work) is the single biggest lever on groups A, B and C.
2. **Faces.** The MCP calls detect_faces and swaps the right face (7–3); the agent's face work loses on identity.
3. **Composed pieces** are even (7–8): the agent's overlays and crops win on exact text; the MCP's single edit_image
   wins on the picture.
4. **Films on the free tier**: four of four to one text-to-video call; the chain needs a better free still model before
   its structure can show (the paid films did show it).
