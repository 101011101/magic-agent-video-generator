# Subsystem 1: Types and Parameters

> Status: problem statement, decisions so far, and draft for discussion. Parent: [vision.md](../vision.md)
> This is the first subsystem. It is the basis for context resolution, the splitter, the solver and editing.
> It replaces the former "proposition schema" subsystem.

**Problem:**
- Every goal, tool input and tool output is a type.
- The system needs a fixed set of types and their parameters.
- Some parameters exist on every video. These form the base type.
- The rest of the context does not fit a standard parameter. It stays free context. Magic Hour tool models already handle free context well.
- The system must decide how parameters and context group. Examples: identity as specific parameters, the background as an environment matrix.

**Decided in chat:**
- Types are the first subsystem to solve.
- Context that does not fit a parameter category stays free context for the tool models.
- **Every video has a script.** Every video has a story, even a plain one.
- **A script is a story.** It is the idea the video disseminates.
  - It does not require spoken words or text.
  - It can request spoken parts. The story and its authorial choices decide this.
  - It holds heuristics: ballpark timings and an explanation of what must be built. It does not hold exact timestamps.
- The script breaks into:
  - spoken content (only if the story requests it),
  - scenes,
  - auxiliary elements. Examples: subtitles, logos, music.
- The script can hold dynamic specs. Examples: tempo, spikes, visual elements. Operations uses them to add sound and to set timing.
- A dynamic spec can be a separate state. Example: scenes match the tempo of a piece of music. The music state then fulfills the timing parameters of the video.
- **Scenes are state machines.** A scene has many states. Its states connect to the other scenes.
- **Two roles, two different things:**
  - **Creative director:** writes the script.
  - **State manager / solver (operations):** takes the script and its elements, and builds the video.
- Operations ensures the elements are correct. Example: the entities are correct.
- Tools close gaps between the current state and the required state. Examples:
  - The input image has the correct face but the wrong clothing. A tool changes the clothing.
  - A tool layers subtitles.
  - A tool layers logos.

**State model: conditions and atoms (decided in chat):**
- A state is a set of conditions. Each condition is true or false: does it match the desired state?
- The goal is an AND of conditions. Truth values distribute onto sub-components. Example:
  - `Operational PRD?` → false.
  - The splitter gives an equivalent: `Video? ∧ Grandma[grandma context matrix]? ∧ Cookie? ∧ Background[matrix]? ∧ Sound[matrix]? ∧ Text[matrix]?`.
  - The text matrix includes text alignment and similar details.
  - Each part is true or false. Each matrix breaks into its own conditions.
- **Atoms for an operational PRD are the elements that change.** Each element that changes gets an atom.
- Elements that do not change need no atom. A tool does not change an element unless asked.
- A small set of universal atoms can be added. Examples: background, filtering.
- A tool changes one thing at a time, in most cases. The solver checks that those changes align with what is asked.
- Atomization is a simple inference. A cheap model can decide, from a tool's spec, whether the tool maintains a given context condition.

**Tool types (decided in chat):**
- A tool type shows what it changes and what it maintains, and from which input each output property comes.
- Example of a hypothetical video tool:
  - Inputs:
    - start frame: individual 1 face + individual 1 body + background 1 + text 1
    - end frame: individual 1 face + individual 1 body + background 1 + text 1
    - face swap: individual 2 face + individual 2 body + background 2
  - Output: video with individual 2 face + individual 1 body + background 1.
  - Text 1 is not in the output. The tool is not specified for text, so text is not expected.
- A tool spec states which elements it changes and how confident it is. See [../post-mvp.md](../post-mvp.md).
- **Nature field (approved for the tool signature, to be evaluated):** each signature has a `nature` text: what the tool fundamentally does, what its prompt and settings can steer, and what it cannot do. It covers capabilities that are in the tool's nature but not listed in its signature. Example: a video generator that accepts a prompt can likely do a fade. See [05-solver.md](05-solver.md) for how the solver uses it.
- Current fixture: [tool-signatures.json](../../tests/fixtures/tool-signatures.json) (40 signatures over a 22-atom draft vocabulary).

**Bindings: consistency of entities and matrices (decided in chat):**
- An entity is a binding, like a variable. Examples: `grandma := upload`, `keeper := Image Generator output` (generated once).
- Every condition on that entity must trace back to the same binding through pass-through links.
- Once an entity is bound, no tool may make its identity true again. A new identity is a new type (`grandma′ ≠ grandma`), so the condition fails.
- Matrices are bindings too. Examples: the kitchen (background matrix), the painterly style, the green cardigan. A new kitchen is a new type.
- All bound types are held constant to each other. If a previous type is not the same as a new type, they are not the same.
- Real entities (the user's grandmother) bind to an original input. Fictional entities (the lighthouse keeper) bind to a tool output, generated once and reused.

**Open (vocabulary gaps from the solver traces, see [../solver-traces.md](../solver-traces.md)):**
- No atom for visibility (opacity over time). The `fade` tool makes nothing true.
- No atom for the position of one layer or element. `camera` covers the whole frame only.

**Draft for discussion (proposal, not confirmed):**
- Video layers that scene states can carry:
  - **Entities:** characters, products, objects. Identity lives here.
  - **World:** environment matrix (location, time of day, lighting, palette, weather).
  - **Composition:** shot size, angle, camera move, subject placement, action.
  - **Look:** visual style (photoreal, anime, 3D), colour grade.
- **Delivery** parameters on every video: duration, aspect, resolution, frame rate.
- Hierarchy: Script → Scenes → Shots → Frames.
- An image is a single frame: entities, world, composition and look, without time, sound or editing.

**Questions to answer:**
- What states does a scene state machine have? Examples: start state, end state, key states.
- How do scenes connect? Examples: a continuous handoff (end frame to start frame), a cut that shares entities, an unrelated cut.
- What is the exact boundary between the creative director and operations? Direction: the story and its operational chunks exist before the video moves to operations (see [02-creative-director.md](02-creative-director.md)).
- If change-based chunks (format B) win: what is the type of the baseline state, and what is the type of a change (`property: from → to`, continuous or cut)?
- Are camera and framing moves part of the state, or a separate kind of parameter? The tests show them as changes.
- Is the script itself a type with fields (idea, scenes, spoken parts, auxiliary elements, dynamic specs), or free text?
- Who produces a dynamic-spec state? Example: who analyzes the music and makes the tempo state?
- Where do ballpark timings become exact timestamps?
- Which parameters are rigid by default when the user does not mention them?
- For each video type: which tools and which original inputs are necessary? Example: an anime video of Sam Altman needs a Sam Altman reference.
