# The keyframe chain vs the Magic Hour MCP · the films

5 items, the same prompt to both. Agent records from agent; MCP baseline from mcp-film-1 and mcp-film-2 and mcp-film-3 (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 1, the MCP wins 4, 0 ties → win rate 20% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 0 (0%) | 1 (20%) |
| mean score | 39 | 52 |
| delivered a file | 5 | 5 |
| credits | 4379 | 2784 |
| minutes of item time | 0 | 10 |
| questions asked (for information) | 0 | 0 |
| asked the user to approve or proceed | 0 | 0 |
| calls refused by the free-plan gate | — | 0 |
| steps planned / tool calls | 5 | 23 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 5 | 0 | 1 | 39 | 52 | 1 | 4 | 0 | 20% | 4379 | 2784 |

## What the MCP side did

Models it chose: ltx-2.5 ×4, minimax-h3 ×1.
Tools it called (steps): create_video_from_text ×7.

## Where the MCP won (4)

- **I46a** Meet the Real F-35A · agent 29 (287 cr) vs MCP 34 (192 cr) · B better conveys a conventional runway takeoff followed by flight, with more realistic aircraft proportions and broadly consistent views. A has two correct labe
- **I47a** Seed Growth With Supplied Narration · agent 37 (242 cr) vs MCP 100 pass (192 cr) · A is a much clearer simple animated explainer: the soil cutaway shows water at the seed, downward roots, and an upward shoot reaching toward visible sunlight. B
- **I90a** Two economists, a 30 s video podcast · agent 42 (775 cr) vs MCP 42 (720 cr) · B offers a cleaner, more convincing live-action podcast presentation, with consistent hosts, prominent microphones, and a cosy studio. A’s captions provide stro
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (415 cr) vs MCP 58 (240 cr) · A more convincingly delivers the warm dawn atmosphere, steaming handmade mug, wooden table, and restrained specialty-coffee aesthetic. Its final frame clearly d

## The agent's clearest wins (top 1 of 1)

- **I92a** Citric acid cycle, a 60 s explainer · agent 29 (2660 cr) vs MCP 24 (1440 cr) · A provides a much clearer loop inside a recognizable organelle and a readable caption identifying oxaloacetate regeneration and NADH production. B’s distorted l

## Both failed (4)

- **I46a** Meet the Real F-35A · agent: The widescreen clip presents the three correct labels, but shows a distorted aircraft suspended over a runway  · MCP: The widescreen clip shows a runway departure and flight with correct English narration, but garbled labels and
- **I90a** Two economists, a 30 s video podcast · agent: The film achieves a warm, live-action podcast setting with consistent hosts, but delivers only one audible lin · MCP: The clip looks like a polished, cosy two-host video podcast, but its supplied speech omits Leo's position and 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: A warm coffee spot with the correct branded closing line, but an unrequested two-mug pouring sequence replaces · MCP: A warm, visually polished coffee ad delivers the requested mug lift and closing slogan, but the brand name is 
- **I92a** Citric acid cycle, a 60 s explainer · agent: The video presents a mitochondrial cycle diagram with English narration, but inaccurate explanations and garbl · MCP: The 60-second widescreen clip shows a circular diagram, but garbled labels and incoherent narration make it un

