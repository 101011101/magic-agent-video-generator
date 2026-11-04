# V4 · PRD (2026-11-02)

V4 is the agreed design in `general/04-pipeline-design.md`, built as small as it can be. It does what the Magic Hour
MCP does, with a sheet that asks the user non-technical questions until every parameter is confidently derived, a few
deterministic guards, and a video tier that writes a story and makes clips with at most one reference each.

## Goals
1. Simple requests take the fewest calls: guide → one prompt → one call → review. No planner tree.
2. Every parameter a tool needs is derived from the user or asked for in plain words ("where will this be posted?"
   not "what aspect ratio?"), while exact answers ("9:16") are accepted. Nothing is made up.
3. Direction changes mid-conversation re-route cleanly; strange answers are handled without breaking.
4. Video: story (setting + one paragraph per clip) → questions → clips. A clip takes at most ONE reference: the
   previous clip's last frame when it continues the previous clip, a user picture (priority person › copy › product
   › environment) or a clean generated still when it does not, nothing otherwise.
5. Honest: when something is outside the free tier or the one-reference rule, the agent says so.

## Non-goals
Multi-reference image editing, key frames, composites, the V2 planner tree, paid models.

## The loop (one turn)
```
messages + attachments
  → INTENT (LLM): the tier (simple | pictures | video), the tool, the parameter sheet
        each parameter: value, source (user | derived | default | missing), the plain question if missing
  → if any required parameter is missing → ask (≤ 3 questions a turn, non-technical) → next turn
  → GUARDS (code): types, model grid, one reference (priority), exact text → overlay, cap
  → MAKE: tier 1/2: prompt from the guide → one call → VLM review (one retry)
          tier 3: story → (questions) → per clip: prompt from setting + paragraph + guide → call → last frame → next
  → deliver + the record
```

## Universal question bank (parameter → plain question → accepted answers)
| parameter | question | accepts |
|---|---|---|
| aspect | Where will this be shown or posted? | platform names, "landscape/portrait/square", exact ratios |
| seconds | How long should it be? | seconds, "short", "a reel", "about 15" |
| exact_words | Should any words appear on it? Which, exactly? | the words, "none", "something catchy" (then we write) |
| sound | Should it have sound: music, a voice, or silent? | any; "your call" → silent for images, music for reels |
| language | What language for the voice/captions? | any |
| which_one | Which person/picture do you mean? | a description, "the first one" |
| reference_role | Which attached picture matters most (the person, the logo, the product, the place)? | names |
| look | Any look in mind (realistic, illustrated, a brand colour)? | any; "your call" allowed |
| budget | — (never asked; the cap is a guard) | |

Questions are asked only when the tool needs the parameter and it cannot be derived. "Your call" is a valid answer.

## Guards (code)
types in/out per tool · aspect/duration/resolution on the chosen model's grid · one reference per call with the
priority order and a clean-reference check · exact text in images: qwen; in video: overlay after · audio off → strip
the sound bed · credit cap · a refusal list (a real person in an endorsement, a minor, a trademark).

## Tests (`V4/tests`)
Eleven simple items (product 2, copy/poster 2, general edit 3, person 2, references 2) and three videos (text-only
clip, one-reference clip, a three-clip zoo ad with a voice-over and a specific logo on the last clip). Each item has a
VAGUE brief with an answer sheet (dry run: conversation only, no credits; checks that the right questions are asked,
that direction changes re-route, that strange answers are survived, and that the predicted tool is right) and a FULL
brief (no back-and-forth; the tool runs; credits).

## Done when
Dry: every item reaches a confident sheet or a justified question in ≤ 3 turns; strange-answer scripts do not crash
or fabricate. Full: every item produces its deliverable with the predicted tool, within the estimate, and the pages
show inputs, questions, parameters with their sources, calls, outputs and the review.
