# V3 — video composition is one tool inside the agentic loop

Written 2026-11-02 from the conversation that followed the flower-shop comparison (our key-reference pipelines
scored 70 and 44 against the MCP's 87–88 with one ltx-2.5 call).

## The principle

The agentic loop (V2: sheet → plan → execute, with its tools: trim, assemble, text overlay, voice, music, check) already
handles cutting, trimming, overlays, sound and sizing. Video composition does not redo any of that. Video composition is
**only** the part the loop cannot do by itself: turn natural language into a story and get clips made from it. Anything
that must happen to the clips afterwards (a title card, a cut, a music bed, a 9:16 resize) goes back into the loop.

So video composition handles the more complicated requests only, and it handles them by funnelling them into a small
number of atomic cases:

| Case | What it is | Status |
|---|---|---|
| 1 | **Text only.** Natural language → story → one prose prompt → one text-to-video call (what the MCP does) | build first |
| 2 | **Several clips.** The story is longer than one call can hold (over 60 s on ltx-2.5), or has parts that must be separate. Split the story into clips; each clip is then a case 1 (first clip) or a case 3 (every clip after the first, which must carry on from the previous one) | build third |
| 3 | **A specific thing.** Case 1 plus requirements on the clip: a specific reference (a face, a product, a logo, a place) or a required first frame | build second |

Case 2 does not make video. It only splits and then directs each part to case 1 or case 3. Once case 3 works, case 2 is
a router plus a state manager.

## What sits around the cases, not inside them

The seed bank (asset bank), the state manager and the beat logic from V2's film pipeline are **tools the agent has when
it needs them**, not stages every video passes through:

- **Asset bank** — only for seeding: the user's attachments and stills we make on purpose for a case 3 clip.
- **State manager** — what is theoretically in each clip so far (people, place, props, light, exact words shown, the
  last frame), so case 2 can hand case 3 the right references by timestamp.
- **Beats** — the timed beats live inside the prose prompt (the MCP's shape), not as a separate screenplay object.

Together they make video composition. Separately, each is reachable from the loop when a step needs it.

## What we keep from the MCP, and what we add

Keep: one prose prompt in the shape the MCP's chat model writes, ltx-2.5 with no references for text only, the
"review the real result" step. See `04-mcp-reference.md` for the exact guide text, the prompt shape and the limits.

Add: a story step before the prompt (the MCP has none), a VLM review with one regeneration, continuity between clips
by frames (the MCP has no frame extraction and no concat), and the loop's tools for everything after the clips.

Old versions stay: `V2/backend/composer`, `V2/backend/keyref`, `V2/backend/keyref2` are untouched. V3 is a new tree.
