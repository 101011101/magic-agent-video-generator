# The pipeline's two modes · direct generation vs the keyframe chain

4 items, the same prompt to both. Agent records from direct; MCP baseline from agent (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 3, the MCP wins 1, 0 ties → win rate 75% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 0 (0%) | 0 (0%) |
| mean score | 47 | 42 |
| delivered a file | 4 | 4 |
| credits | 1344 | 1719 |
| minutes of item time | 0 | 0 |
| questions asked (for information) | 0 | 0 |
| asked the user to approve or proceed | 0 | 0 |
| calls refused by the free-plan gate | — | 0 |
| steps planned / tool calls | 4 | 0 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 4 | 0 | 0 | 47 | 42 | 3 | 1 | 0 | 75% | 1344 | 1719 |

## What the MCP side did

Models it chose: minimax-h3 ×4.
Tools it called (steps): film ×4.

## Where the MCP won (1)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 37 (242 cr) · A narrowly wins by avoiding text and visibly showing downward roots and an upward shoot. B shows a clearer seed-to-sprout progression toward overhead light, but

## The agent's clearest wins (top 3 of 3)

- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (775 cr) · A offers cleaner, more convincing live-action imagery with consistent hosts, prominent microphones, and a cosy studio. B provides useful visible dialogue and a 
- **I46a** Meet the Real F-35A · agent 34 (192 cr) vs MCP 29 (287 cr) · A provides a substantially more realistic runway rotation and airborne continuation with a consistent aircraft design. B visibly shows the two fact labels corre
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (415 cr) · B better captures the quiet specialty-coffee mood with a steaming ceramic mug, wooden table, and soft dawn light. Its restrained end card clearly displays the e

## Both failed (4)

- **I46a** Meet the Real F-35A · agent: The clip shows a runway departure with correct factual narration, but the aircraft is inaccurate and inconsist · MCP: The widescreen clip presents the three correct labels, but shows a distorted aircraft suspended over a runway 
- **I47a** Seed Growth With Supplied Narration · agent: The eight-second widescreen clip has the correct voice-over, but prohibited garbled captions and an unclear, f · MCP: The eight-second clip has the correct narration but shows an already-sprouted, morphing plant rather than a cl
- **I90a** Two economists, a 30 s video podcast · agent: A convincing, cosy two-host video podcast delivers the economic disagreement and friendly ending, but a garble · MCP: The film achieves a warm, live-action podcast setting with consistent hosts, but delivers only one audible lin
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: The visuals deliver the warm coffee ritual and correct branded end card, but unsolicited Japanese dialogue pre · MCP: A warm coffee spot with the correct branded closing line, but an unrequested two-mug pouring sequence replaces

