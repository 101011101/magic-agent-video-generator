# bench/mcp — the MCP baseline: Magic Hour's own MCP, as is, on the same prompts

The user's rule (2026-11-01): "another baseline you should use as the benchmark is just our MCP as is. So, wherever you
want to use this, let's say ChatGPT, install our MCP and just give it the exact same prompt you give your agent. And
yours should knock the MCP out of the water every single time. I want to see the differences."

## What runs

`run.mjs` takes every bench v1 item (`bench/v1/items`, the same files the agent is run on) and gives its messages, word
for word, to an off-the-shelf chat model with Magic Hour's hosted MCP server (`https://mcp.magichour.ai/`, 48 tools)
connected through OpenAI's remote-MCP tool, and nothing else: no catalogue, no sheet, no planner, no state manager, no
code tools, no gates. The chat model is the one the agent itself runs on (`lib/llm.js` MODEL), so the comparison is
between the two systems and not between two models. The same proxy user answers its questions from the same answer
sheet (and says "yes, go ahead" when it asks for a go), up to three rounds, like `bench/v1/run.mjs`.

The record it writes has the shape `bench/v1/run.mjs` writes, so the same grader (`bench/v1/grade.mjs`), report
(`report.mjs`) and audit page (`view.mjs`, `serve.mjs`) read it unchanged. Every MCP call (name, arguments, output,
error) and every gate decision is kept in the record; the finished files are downloaded into
`sessions/mcp-<prefix>-<id>/assets/`.

## The free plan, emulated

The benchmark runs on free models only. The key in `.env` is a creator account, so the free plan is emulated with
OpenAI's approval gate: every create call is shown to the runner before it runs and refused, with the reason the API
would give a free key, when it names a paid model (the free image models are those with `plan: "free"` in
`lib/models.js`; the free video models are ltx-2.5 and minimax-h3, which the MCP's own description names), a
resolution above the free plan's (640px images, 480p video), a 4x upscale, or more credits than a free account has
(400 at signup, `--item-cap`). Read-only tools (guides, waits, fetches, uploads) run without approval. Two things are
hidden from the model because they would contradict the emulation: the account-info tool (it would say "creator,
86,000 credits") and the delete tools. Everything else the MCP offers is offered. The system prompt states the plan's
limits once, the way a connector's setup page would; the user prompt is the item's, untouched.

Attachments: the item's fixtures are uploaded to the account once (`uploads.json`, free) and the user message carries
each one as `[Attached: name — Magic Hour file_path: …]`, with the picture itself shown to the model; that is what a
user attaching a file to a chat gets, and what the MCP's tools need.

## Compare

`compare.mjs --mcp <results> --agent <results>[,<results>] [--judge]` puts the two arms side by side per item: the
prompt, both outputs, both grades, the chains, credits, time, questions (the MCP's approval rounds counted apart), the
calls the gate refused, and a verdict. With `--judge`, a pairwise vision judge sees both outputs in a fixed random order
(a follow-up item also sees what each side had made before) and picks one; without a judge, or where one side made
nothing, the verdict is made-vs-not or the grader's score. It writes `compare.md` (the numbers and the lists), `compare.json`
and `index.html` (served by `bench/v1/serve.mjs` at `http://localhost:4748/compare-<run>/`). The agent arm is the newest
record per item across the folders given (`real-1,latest`).

## Film briefs

`film/items/` holds briefs in the bench item schema (the economists' podcast the pipeline had already made on the free
tier, and the live bench's Cabin Coffee ad); `film/agent/` holds the pipeline's finished film as a bench record
(`film/record.mjs --item I91a --run bench-cabin-10s`), so the pairwise judge sees the pipeline's film next to what the
MCP makes of the same brief. `run.mjs --items V2/bench/mcp/film/items --groups I` runs the MCP side; `film/drive.sh I46a
bench-I46a-8s` runs the pipeline side on the free tier at the item's length, handling the gates' stops the way the user
does by hand (retry the flagged ids once, then accept), every pass in the log.

**The four pairs (2026-11-01, `results/compare-film-1/`):** the MCP wins all four. Economists 30 s: 42 vs 42, the judge
leans to the MCP's single ltx-2.5 clip on polish (the pipeline's film has garbled table lettering and a duplicated mug;
neither delivers Leo's lines). Cabin Coffee 10 s: 58 vs 58, the MCP's clip wins on atmosphere; the pipeline's "Wake up
slow" is exact where the MCP wrote "Cabin Cofee". F-35A 8 s: 29 vs 34; the pipeline's three labels are exact by code
overlay and its narration is the right English (the grader's transcription of the 8 s mix misheard it), but the
free-model still shows a distorted jet hanging over the runway; the MCP's minimax clip has a takeoff roll and real
narration with garbled labels. Seed explainer 8 s: 37 vs 100, clear MCP win, one minimax call. Credits: pipeline 1,719,
MCP 1,344. On the free tier, for briefs of one scene and under 15 seconds, one well-prompted text-to-video call beats
the chain of klein stills and pinned clips; the chain's wins are the exact overlays, the narration it controls and the
gates that stopped it 6 to 8 times per film on flux-2-klein's failures.

## What the MCP arm did on the micro groups (mcp-1)

By the grader: A single images 20/24 pass, B edits 16/26, C faces 6/12, D short video 3/18, E editing the user's video
0/18 (it said it cannot crop, trim, mix music under a clip or add a voice-over, and did nothing in 11 of 18), F sound
1/7 (no text-to-speech in the MCP), G composed pieces 3/16, H ads 1/13, J conversation 7/18. It refused none of the
five should-refuse items (a celebrity's face into an ad, a minor's photo, a trademark). It asked 13 questions for
information over 152 items and asked once for a go. It chose qwen-image-2.1 and flux-schnell for images, ltx-2.5 and
minimax-h3 for video, on its own; the gate refused no call in the micro pass. Tool calls: 83 edit_image, 46
generate_image, 26 create_video_from_text, 13 create_video_from_image, 8 detect_faces, 6 subtitles, 6 music, 3
edit_video, 2 face swaps on photos, 2 on video.

## Agent vs MCP on the micro groups (`results/compare-mcp-1/`, 2026-11-01)

Agent records: the newest per item from `real-1` and `latest`. By the grader: agent 90 pass (59%) vs MCP 57 (38%);
mean 75 vs 60; credits 8,275 vs 10,115; 88 vs 142 minutes. Pairwise: agent 73, MCP 68, 11 ties. By group (agent wins–MCP wins): A single images 7–17, B edits 8–16, C faces 3–7,
D short video 10–8, E editing the user's video 13–2, F sound 5–1, G composed 7–8, H ads 8–4, J conversation 11–5.
Read it as: the agent is far ahead on pass rate and on anything that needs a cut, a crop, a mix, a voice, a chain or a
refusal; on a single picture both pass and the judge prefers the MCP's, which the chat model made on qwen-image-2.1
(67 of its image calls) where the agent's free tier paints on flux-2-klein.

## Runs

| run | items | spend | notes |
|---|---|---|---|
| mcp-smoke | 3 | 35 | the first pass through the plumbing; A01d pass, B07a and J49a fail |
| mcp-denytest | 1 | 0 | the gate with a 3-credit cap: the call refused, the model reports it and makes nothing |
| mcp-1 | 152 | 10,115 | the micro groups A–H and J, 4 at a time, 142 min of item time; 57 pass (38%), mean 60; graded with `bench/v1/grade.mjs`, report in `results/mcp-1/report.md`, audit page `results/mcp-1/index.html`; the first pass stopped at a 6,000 cap after 123 items and the last 29 (H, J) ran in a second pass with the same prefix |
| mcp-film-2 | 4 | 984 | the bench's film briefs I45a–I48a: one text-to-video call each (minimax-h3 or ltx-2.5, 8–15 s, 480p); I47a and I48a pass, I45a and I46a fail (garbled labels, wrong aircraft; dialogue where silence was asked) |
| mcp-film-1 | 2 | 960 | the economists' podcast (30 s, ltx-2.5, 720 credits; the first call was refused by the API for a prompt over 2,000 characters) and Cabin Coffee (10 s, ltx-2.5, 240; "Cabin Cofee" on the end card) |
