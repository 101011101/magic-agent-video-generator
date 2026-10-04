# Subsystem 2: Creative Director

> Status: responsibilities and direction only. Design is not started. Parent: [vision.md](../vision.md), [architecture.md](../architecture.md)
> Depends on: [01-types.md](01-types.md). Hands off to operations: [04-operations-splitter.md](04-operations-splitter.md), [05-solver.md](05-solver.md).
> Research: [story-structure-literature.md](../research/story-structure-literature.md), [copywriting-structures.md](../research/copywriting-structures.md)

**Problem:**
- A request arrives in natural language. Operations needs a description of the goal.
- The creative director describes the goal: what the video must be.
- Scene states describe a scene. The creative director describes the goal for each scene.
- The creative director is the natural-language splitter.

**General responsibilities:**
- Read the request, the uploads and the existing context.
- Write the script: the story, the idea the video disseminates.
- Make the authorial choices. Example: does the story request spoken parts?
- Break the script into:
  - spoken content (only if the story requests it),
  - scenes, each with a description of its goal,
  - auxiliary elements. Examples: subtitles, logos, music.
- Set dynamic specs. Examples: tempo, spikes, visual elements.
- Give heuristics: ballpark timings and an explanation of what must be built. No exact timestamps.
- Split natural language into parts that add up to the original request.
- Give each part its context and its dependencies.
- Expose contradictions in the request.
- Use context resolution when a value is absent. See [03-context-resolution.md](03-context-resolution.md).
- Hand the script and its elements to operations.

**Direction (from chat):**
- The creative director is unrestricted by tools. It never names a tool. It describes what, not how.
- Three layers:
  1. **Arc:** a sequence of blocks, like the structure of an essay.
  2. **Blocks:** essay text, one block per part of the arc. LLMs are good at essays and their structure.
  3. **Functional requirements:** each block is split into requirements by how it is delivered. Examples: visual, text, audio, timing.
- The functional requirements pass to the state manager (operations).
- The interface between the creative director and operations is the functional requirements.

**Caveats (from chat):**
- Unrestricted creativity stays faithful to the user. Rigid values are locked first. The creative freedom is everything around them.
- The creative director can request something that no tool chain can deliver. Operations must answer "cannot be met, closest option is …". The creative director then revises only that block.
- Structural correctness is not quality. Quality comes from three places: the writing, the tool choice per requirement, and verification of the output.

**From research (not decided):**
- Minimal story (Prince): state A → event → state B. B differs from A and is caused by the event.
- The subject that changes can be a character (narrative) or the viewer (copy, explainer, mood piece).
- Narrative and copy frameworks share roles. Core: Open → Turn → Close, plus Meaning. Copy core: Hook → Value → Action.
- Optional roles (Identify, Tension, Proof, Offer) are switched on by parameters: audience awareness level, market sophistication, form, objective.
- A scene turns at least one value (McKee). Scenes connect with "therefore" or "but" (Parker & Stone).
- Short-form video: the hook lands in the first 1–3 s. Copy must read with no sound.

**Questions to answer:**
- How does the creative director work, step by step?
- What is its output format?
- How does it keep rigid values unchanged through the essay text?
- Must each requirement cite the block sentence it came from (for coverage checks and edits)?
- Is a block a scene? One block can need two scenes, and two blocks can share a scene. Who splits blocks into scenes: the creative director or the operations splitter?
- Where do requirements that span all blocks live? Examples: identity, a music bed, tempo, total duration.
- What fields does a functional requirement have? Candidates: channel, statement, rigid or fluid, source sentence, dependencies.
- What does it do with a contradiction it exposes?
- Does the user approve the script before operations starts?

**Inputs:** request, uploads, existing context.

**Outputs:** the script and its elements, as functional requirements.
