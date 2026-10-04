# Magic Agent Architecture

> Overall abstraction and how the subsystems fit. Details: [vision.md](vision.md), [subsystems/](subsystems/).

**The abstraction:**
- A creative AI, unrestricted by tools, describes the video it wants.
- A state manager makes that description real with whatever operations give the highest quality: model generation, image generation, slide creation, and others.
- Creativity and operations are two different things. They meet at one interface: functional requirements.

```
User ⇄ Caller agent (Codex / Magic Hour chat)
            │  Magic Hour MCP
            ▼
┌───────────────────────────────────────────────────────────────┐
│ CREATIVITY: Creative director                    (what)        │
│   request → script (story) → arc → blocks → functional reqs   │
├──────────────── interface: functional requirements ───────────┤
│ OPERATIONS: State manager / solver                (how)        │
│   types → split → solve → resolve context → tool-call ordering │
│   → execute → verify → trace                                   │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
Tools: Magic Hour generation (image, video, voice, …), slides, transforms (crop, filter, stitch), …
            ▼
Video
```

- Position: the system is the engine behind the Magic Hour MCP. A general agent calls it.
- This is a ground-up rebuild of the current repo. The LLM role changes.

## Creativity: the creative director

**Nature:**
- It describes the goal: what the video must be.
- It is unrestricted by tools. It never names a tool.
- It stays faithful to the user. Rigid values are locked first.
- It is the natural-language splitter.
- Every video has a script. A script is a story: the idea the video disseminates. It does not require spoken words.
- Direction: an arc of blocks (like an essay) → essay text per block → functional requirements per block, by delivery channel (visual, text, audio, timing).

**How it works:** [not designed yet]. See [02-creative-director.md](subsystems/02-creative-director.md).

## Operations: the state manager / solver

**Nature:**
- It makes the functional requirements real.
- It picks the operation that gives the highest quality for each requirement. One requirement can be met by generated video, a still image, a slide, or a text overlay.
- It closes gaps between the current state and the required state. Example: the input image has the correct face but the wrong clothing; a tool changes the clothing and keeps the face.
- New tools add to operations only. The creative side does not change.

**How it works (from [vision.md](vision.md); subsystem designs are not started):**
1. **Types:** everything is a type. A goal is a type. A type is a record of typed parameters. Context that fits no parameter stays free context for the tool models.
2. **Tools are proofs:** a tool spec states its input types, its output type and the properties it maintains. A split tool and a join tool together prove equivalence.
3. **Split:** the operations splitter breaks the requirements into pieces with context and dependencies. It splits as little as possible.
4. **Solve:** try the highest level first. If a tool or a saved theorem accepts the full piece, apply it. If not, split the piece again (scoped) and recurse.
5. **Resolve context:** for an absent value, an LLM answers "do you know X?" with a value or "no". A "no" means missing context; the system asks the user.
6. **Ordering:** the solver returns a checkable tool-call ordering: which tools, which inputs, how outputs connect. It is a recommendation. It can connect to a studio.
7. **Execute:** tool calls start only after the ordering is complete.
8. **Verify and trace:** the solved term keeps its parts and is the trace. The final product is verified against the requested type. A failure traces back to the tool that failed.
9. **Remember:** solved paths are saved as theorems. Tool failures are tracked retrospectively.
10. **Edit:** an edit changes part of the solved tree. The change propagates. Only the affected calls run again.

## Between the two halves

- The creative director can request something that no tool chain can deliver. Operations answers "cannot be met, closest option is …". The creative director then revises only that block.
- Structural correctness is not quality. Quality comes from:
  - the writing (creative director),
  - the tool choice per requirement (operations),
  - verification of the output (operations; the checker comes after the MVP).

## Subsystems

| # | Subsystem | Half | Role | Status |
|---|---|---|---|---|
| 1 | [Types and parameters](subsystems/01-types.md) | both | The type vocabulary for scripts, scenes and requirements | Decisions + draft |
| 2 | [Creative director](subsystems/02-creative-director.md) | creativity | Request → script → functional requirements | Not designed |
| 3 | [Context resolution](subsystems/03-context-resolution.md) | both | Present / inferred / missing values | Problem statement |
| 4 | [Operations splitter](subsystems/04-operations-splitter.md) | operations | Requirements → pieces that tools accept | Problem statement |
| 5 | [Solver](subsystems/05-solver.md) | operations | Pieces → checkable tool-call ordering | Problem statement |
| 6 | [Editing](subsystems/06-editing.md) | operations | Change propagates through the solved tree | Problem statement |

**Supporting material:**
- [vision.md](vision.md): the type-proof model in full, with open gaps.
- [research/](research/): story structure (literature) and copywriting structures.
- [test-set/](test-set/): 51 test prompts in 17 groups, with a local viewer.
