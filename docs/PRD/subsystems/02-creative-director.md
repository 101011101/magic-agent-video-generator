# Subsystem 2: Creative Director

> Status: direction chosen, output format under test. Parent: [vision.md](../vision.md), [architecture.md](../architecture.md)
> Depends on: [01-types.md](01-types.md). Hands off to operations: [04-operations-splitter.md](04-operations-splitter.md), [05-solver.md](05-solver.md).
> Research: [story-structure-literature.md](../research/story-structure-literature.md), [copywriting-structures.md](../research/copywriting-structures.md)
> Tests: [test-research/](../test-research/README.md)

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

**Direction (decided in chat):**
- The creative director is unrestricted by tools. It never names a tool. It describes what, not how.
- Two LLM calls:
  1. **Story:** the request becomes a clean copy, in prose. It describes the environment, characters, action and mood. It keeps dialogue to a minimum.
  2. **Operational chunks:** a separate call splits the story into operational chunks.
- The story is the essay. The operational chunks are the functional requirements.
- The operational chunks exist to make the state splitter's work easier. They are the interface to operations.
- Each chunk holds the exact quote from the story that it describes.
- The chunks can be revised from the clean copy. A change to a story sentence rebuilds only the chunks that quote it.
- Change detection is the job of the operational call, not the story call. The story stays natural. The operational prompt focuses on changes and signposts (transition words such as "then", "but", "as night falls").
- This subsystem is replaceable. How AI-like the prose sounds is not important now. A better writing tool can replace it later.
- Proof in theory: the subsystem only needs to output text that splits into chunks. Then the state solver can be built.

**Operational chunk formats under test:**

| Format | Content | Test variant |
|---|---|---|
| **A. Straight operational chunks** | Each chunk lists its full state: visual, on-screen text, audio, entities, environment, depends on, source quote. Global requirements at the end. | `v3b` |
| **B. Change-based chunks** | A baseline (the full state of the first operational frame), then per chunk: quote, signpost (or "implicit"), changes as `property: from → to`, continuous or cut, duration, text and audio only when they change, depends on. | `v5b` |

- In format B, "held" is not written. Anything a chunk does not change stays as the baseline set it. The held state is a fact for the operations side: in the state transformation, everything else stays the same (ceteris paribus).
- The test decides which format is better.

**Test basis (decided in chat):**
- Tests use operational chunks of stories.
- Model: GPT-6.1 Sol (OpenAI API, effort high).
- Both formats (A and B) run on the same story, so only the chunking prompt differs.
- Comparison page: [gpt-chunk-compare.html](../test-research/gpt-chunk-compare.html).

**Findings from the first tests:**
- Exact wording survived in every sample. Example: the bakery end card.
- A one-shot script with no context assumes a human films the video. The prompts must state that the output feeds AI production tools.
- Many state changes in natural prose have no signpost. The operational call must detect implicit changes.
- Chunk durations drift from the requested total. Example: a first draft of 130 s for a 120 s film. Code must check the total.
- Camera and framing moves appear as changes. Whether they are state is an open question in [01-types.md](01-types.md).
- When context is missing, the chunks flag it. Example: the birthday video is blocked until a photo of the father is uploaded.

**Caveats (from chat):**
- Unrestricted creativity stays faithful to the user. Rigid values are locked first. The creative freedom is everything around them.
- The creative director can request something that no tool chain can deliver. Operations must answer "cannot be met, closest option is …". The creative director then revises only that part of the story.
- Structural correctness is not quality. Quality comes from three places: the writing, the tool choice per requirement, and verification of the output.

**From research (not decided):**
- Minimal story (Prince): state A → event → state B. B differs from A and is caused by the event.
- The subject that changes can be a character (narrative) or the viewer (copy, explainer, mood piece).
- Narrative and copy frameworks share roles. Core: Open → Turn → Close, plus Meaning. Copy core: Hook → Value → Action.
- Optional roles (Identify, Tension, Proof, Offer) are switched on by parameters: audience awareness level, market sophistication, form, objective.
- A scene turns at least one value (McKee). Scenes connect with "therefore" or "but" (Parker & Stone).
- Short-form video: the hook lands in the first 1–3 s. Copy must read with no sound.

**Questions to answer:**
- Which chunk format is better: A or B?
- How does the creative director keep rigid values unchanged through the story text?
- Is a chunk a scene? Who splits chunks into scenes: the creative director or the operations splitter?
- What does it do with a contradiction it exposes?
- Does the user approve the story before operations starts?

**Inputs:** request, uploads, existing context.

**Outputs:** the story (clean copy) and its operational chunks.
