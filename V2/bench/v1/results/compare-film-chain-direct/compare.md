# The pipeline's two modes · direct generation vs the keyframe chain

5 items, the same prompt to both. Agent records from direct; MCP baseline from agent (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 4, the MCP wins 1, 0 ties → win rate 80% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 0 (0%) | 0 (0%) |
| mean score | 44 | 39 |
| delivered a file | 5 | 5 |
| credits | 2794 | 4379 |
| minutes of item time | 0 | 0 |
| questions asked (for information) | 0 | 0 |
| asked the user to approve or proceed | 0 | 0 |
| calls refused by the free-plan gate | — | 0 |
| steps planned / tool calls | 5 | 0 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 5 | 0 | 0 | 44 | 39 | 4 | 1 | 0 | 80% | 2794 | 4379 |

## What the MCP side did

Models it chose: minimax-h3 ×5.
Tools it called (steps): film ×5.

## Where the MCP won (1)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 37 (242 cr) · A narrowly wins by avoiding text and visibly showing downward roots and an upward shoot. B shows a clearer seed-to-sprout progression toward overhead light, but

## The agent's clearest wins (top 4 of 4)

- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (775 cr) · A offers cleaner, more convincing live-action imagery with consistent hosts, prominent microphones, and a cosy studio. B provides useful visible dialogue and a 
- **I46a** Meet the Real F-35A · agent 34 (192 cr) vs MCP 29 (287 cr) · A provides a substantially more realistic runway rotation and airborne continuation with a consistent aircraft design. B visibly shows the two fact labels corre
- **I92a** Citric acid cycle, a 60 s explainer · agent 34 (1450 cr) vs MCP 29 (2660 cr) · A more closely follows the requested presentation: a labelled loop inside a recognizable mitochondrion, the correct title, and visible acetyl-CoA and ATP text. 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (415 cr) · B better captures the quiet specialty-coffee mood with a steaming ceramic mug, wooden table, and soft dawn light. Its restrained end card clearly displays the e

## Both failed (5)

- **I46a** Meet the Real F-35A · agent: The clip shows a runway departure with correct factual narration, but the aircraft is inaccurate and inconsist · MCP: The widescreen clip presents the three correct labels, but shows a distorted aircraft suspended over a runway 
- **I47a** Seed Growth With Supplied Narration · agent: The eight-second widescreen clip has the correct voice-over, but prohibited garbled captions and an unclear, f · MCP: The eight-second clip has the correct narration but shows an already-sprouted, morphing plant rather than a cl
- **I90a** Two economists, a 30 s video podcast · agent: A convincing, cosy two-host video podcast delivers the economic disagreement and friendly ending, but a garble · MCP: The film achieves a warm, live-action podcast setting with consistent hosts, but delivers only one audible lin
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: The visuals deliver the warm coffee ritual and correct branded end card, but unsolicited Japanese dialogue pre · MCP: A warm coffee spot with the correct branded closing line, but an unrequested two-mug pouring sequence replaces
- **I92a** Citric acid cycle, a 60 s explainer · agent: A widescreen mitochondrion diagram has the requested title and loop, but corrupted labels, misleading pathway  · MCP: The video presents a mitochondrial cycle diagram with English narration, but inaccurate explanations and garbl

