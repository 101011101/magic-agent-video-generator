# Direct generation vs the Magic Hour MCP · the films

6 items, the same prompt to both. Agent records from direct; MCP baseline from mcp-film-1 and mcp-film-2 and mcp-film-3 and mcp-film-4 (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 2, the MCP wins 4, 0 ties → win rate 33% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 0 (0%) | 1 (17%) |
| mean score | 43 | 50 |
| delivered a file | 6 | 6 |
| credits | 4234 | 4224 |
| minutes of item time | 0 | 14 |
| questions asked (for information) | 0 | 0 |
| asked the user to approve or proceed | 0 | 0 |
| calls refused by the free-plan gate | — | 0 |
| steps planned / tool calls | 6 | 29 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 6 | 0 | 1 | 43 | 50 | 2 | 4 | 0 | 33% | 4234 | 4224 |

## What the MCP side did

Models it chose: ltx-2.5 ×5, minimax-h3 ×1.
Tools it called (steps): create_video_from_text ×9.

## Where the MCP won (4)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 100 pass (192 cr) · A offers a clear, simple widescreen soil cutaway with downward roots, an upward shoot, visible light, and no text. B includes conspicuous, malformed captions, d
- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (720 cr) · Both show consistent, live-action-looking hosts at microphones in warm, widescreen studios. B has a slightly stronger video-podcast presentation through headpho
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (240 cr) · Both show steaming coffee on wood and the exact closing words in widescreen. A better sustains the warm, quiet specialty-coffee mood with its rustic mug, golden
- **I93a** Night ride, a 60 s single take · agent 37 (1440 cr) vs MCP 39 (1440 cr) · A visibly delivers the bridge opening and a café-door arrival with the rider putting a foot down, while retaining a similar yellow jacket and bicycle. B has con

## The agent's clearest wins (top 2 of 2)

- **I92a** Citric acid cycle, a 60 s explainer · agent 34 (1450 cr) vs MCP 24 (1440 cr) · A clearly depicts a loop inside a recognizable mitochondrion, includes the requested title, and shows several relevant molecule labels, including Acetyl-CoA and
- **I46a** Meet the Real F-35A · agent 34 (192 cr) vs MCP 34 (192 cr) · A provides the correctly spelled, legible aircraft title and a clearer runway-to-liftoff progression with relatively consistent aircraft styling. Both fall shor

## Both failed (5)

- **I46a** Meet the Real F-35A · agent: The clip shows a runway departure with correct factual narration, but the aircraft is inaccurate and inconsist · MCP: The widescreen clip shows a runway departure and flight with correct English narration, but garbled labels and
- **I90a** Two economists, a 30 s video podcast · agent: A convincing, cosy two-host video podcast delivers the economic disagreement and friendly ending, but a garble · MCP: The clip looks like a polished, cosy two-host video podcast, but its supplied speech omits Leo's position and 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: The visuals deliver the warm coffee ritual and correct branded end card, but unsolicited Japanese dialogue pre · MCP: A warm, visually polished coffee ad delivers the requested mug lift and closing slogan, but the brand name is 
- **I92a** Citric acid cycle, a 60 s explainer · agent: A widescreen mitochondrion diagram has the requested title and loop, but corrupted labels, misleading pathway  · MCP: The 60-second widescreen clip shows a circular diagram, but garbled labels and incoherent narration make it un
- **I93a** Night ride, a 60 s single take · agent: The clip shows a yellow-jacketed courier cycling along wet nighttime streets, but contains forbidden speech an · MCP: The clip depicts the requested rainy bicycle journey and café arrival, but prohibited speech and dusk-like lig

