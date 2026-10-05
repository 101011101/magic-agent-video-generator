# Conversation Breakdown

Source: [runbook-convo.md](runbook-convo.md).

| # | Big idea | Ask | Outcome |
|---|---|---|---|
| 1 | Evaluate the Magic Agent repo | Explain the repo. Rate quality and value against a normal LLM or Codex. Find the valuable parts. Say if it can be condensed. Say if a chatbot should ship that calls Magic Hour tools and routes users. | Do not ship as-is. Keep the execution logic. Cut the router and canned fallbacks. |
| 2 | Choose the base architecture | Build on the repo, or use Codex + MCP + packaged skills? | General agent + Magic Hour MCP + skills. Code owns billing, state, rendering. |
| 3 | Build a light MVP | New repo on the personal account. One-line start or simple chat GUI. Easy to test. Quality like InVideo. | `runshouse/magic-video` built. Output quality poor. |
| 4 | Decide the agent runtime and cost | Does the OpenAI Agents API help? What does it cost? Implement it. Use Codex usage instead of API billing. | No platform fee. ~$0.10–$0.25 per director turn. Magic Hour credits dominate. Codex directed the test renders. |
| 5 | Fix output quality | Real AI voice. No overlapping audio. Web search for current events. Follow Magic Hour MCP and skills best practices. Real motion. Better video models. | Research gate, audio-first timing, one audio stream, export validation, H3 vs. LTX comparisons. |
| 6 | Diagnose H3 artifacts | Explain blurry crowd faces. Read the tool-worker scripts. File a Linear ticket with the video and reproduction IDs. | Cause: dense crowd + 480p + motion + worker optimizations. Fix: shot routing + face QC. Ticket ENG-5153. |
| 7 | Stay state of the art | Define the SOTA path. Implement all changes at 70%+ confidence. | PR #2 and PR #3: per-shot model router, 12-frame QC, one repair max, scene-edit MCP tools, asset memory. |

## What to build

A chat-first AI video generator:

- Input: a short prompt (for example, "psu vs marshall").
- Output: a publishable video at InVideo level.
- Researches and cites facts before it writes the script.
- Uses the best Magic Hour models. Follows the Magic Hour MCP and skills rules.
- Selects a source for each shot: real footage, generated clip, or still.
- Checks each generated clip. Repairs or rejects bad clips.
- Uses one high-quality voice. No overlapping audio.
- Edits single scenes by chat. Does not re-render unchanged scenes.
- Starts with one command. Easy to test.
- Later: runs inside Magic Hour and routes users to existing tools.

Not done yet:

- Real footage retrieval (no licensing provider).
- Blinded quality benchmark.
- Voice catalog.
- Verified paid render on current `main`.
