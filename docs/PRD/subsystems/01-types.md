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
- What is the exact boundary between the creative director and operations? Which elements must exist before the video moves to operations?
- Is the script itself a type with fields (idea, scenes, spoken parts, auxiliary elements, dynamic specs), or free text?
- Who produces a dynamic-spec state? Example: who analyzes the music and makes the tempo state?
- Where do ballpark timings become exact timestamps?
- Which parameters are rigid by default when the user does not mention them?
- For each video type: which tools and which original inputs are necessary? Example: an anime video of Sam Altman needs a Sam Altman reference.
