# Direct generation vs the Magic Hour MCP · the films

5 items, the same prompt to both. Agent records from direct; MCP baseline from mcp-film-1 and mcp-film-2 and mcp-film-3 (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 2, the MCP wins 3, 0 ties → win rate 40% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 0 (0%) | 1 (20%) |
| mean score | 42 | 52 |
| delivered a file | 5 | 5 |
| credits | 2784 | 2784 |
| minutes of item time | 0 | 10 |
| questions asked (for information) | 0 | 0 |
| asked the user to approve or proceed | 0 | 0 |
| calls refused by the free-plan gate | — | 0 |
| steps planned / tool calls | 5 | 23 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 5 | 0 | 1 | 42 | 52 | 2 | 3 | 0 | 40% | 2784 | 2784 |

## What the MCP side did

Models it chose: ltx-2.5 ×4, minimax-h3 ×1.
Tools it called (steps): create_video_from_text ×7.

## Where the MCP won (3)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 100 pass (192 cr) · A offers a clear, simple widescreen soil cutaway with downward roots, an upward shoot, visible light, and no text. B includes conspicuous, malformed captions, d
- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (720 cr) · Both show consistent, live-action-looking hosts at microphones in warm, widescreen studios. B has a slightly stronger video-podcast presentation through headpho
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (240 cr) · Both show steaming coffee on wood and the exact closing words in widescreen. A better sustains the warm, quiet specialty-coffee mood with its rustic mug, golden

## The agent's clearest wins (top 2 of 2)

- **I46a** Meet the Real F-35A · agent 34 (192 cr) vs MCP 34 (192 cr) · A provides the correctly spelled, legible aircraft title and a clearer runway-to-liftoff progression with relatively consistent aircraft styling. Both fall shor
- **I92a** Citric acid cycle, a 60 s explainer · agent 24 (1440 cr) vs MCP 24 (1440 cr) · A at least displays the exact title clearly and places a circular structure inside a recognizable mitochondrion. B has a more explicit ring but lacks meaningful

## Both failed (4)

- **I46a** Meet the Real F-35A · agent: The clip shows a runway departure with correct factual narration, but the aircraft is inaccurate and inconsist · MCP: The widescreen clip shows a runway departure and flight with correct English narration, but garbled labels and
- **I90a** Two economists, a 30 s video podcast · agent: A convincing, cosy two-host video podcast delivers the economic disagreement and friendly ending, but a garble · MCP: The clip looks like a polished, cosy two-host video podcast, but its supplied speech omits Leo's position and 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: The visuals deliver the warm coffee ritual and correct branded end card, but unsolicited Japanese dialogue pre · MCP: A warm, visually polished coffee ad delivers the requested mug lift and closing slogan, but the brand name is 
- **I92a** Citric acid cycle, a 60 s explainer · agent: The 60-second widescreen clip shows a largely unchanged mitochondrion-like diagram with the correct title, but · MCP: The 60-second widescreen clip shows a circular diagram, but garbled labels and incoherent narration make it un

