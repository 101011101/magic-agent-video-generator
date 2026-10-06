# Subsystem 5: Solver

> Status: solving model decided in chat. Algorithm and format not designed. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md), [04-operations-splitter.md](04-operations-splitter.md)
> Tool specs: [magic-hour-tools.json](../../tests/fixtures/magic-hour-tools.json), [magic-hour-tools.html](../../research/magic-hour-tools.html)

**Problem:**
- After the splitter runs, the system has pieces. The solver must put the pieces together into a solution.
- The solver returns a completed tool-call ordering:
  - which tools are called,
  - with which inputs,
  - how the outputs connect to the inputs of later tools.
- The ordering is a recommendation. It is not executed by the solver.
- The ordering must be checkable before execution.
- The ordering must connect to a studio (a place where the user sees and edits the chain).

**Solving model (decided in chat):**
- A goal is an AND of true/false conditions (see [01-types.md](01-types.md)).
- The solver looks for a tool that makes as many open conditions true as possible.
- **Hypothesis step:** assume the tool gets perfect inputs. If the tool then outputs the truth needed, it can satisfy the abstract goal.
- Once a tool can satisfy the abstract goal with perfect inputs, solve its inputs. Each input becomes a sub-goal.
- Recurse until each input comes from an original input or from another tool.
- A tool only gets credit for conditions its spec covers. Example: a video tool not specified for text does not make the text condition true. Another tool must solve the text conditions.
- Example (grandma waving with a cookie):
  - An image-to-video tool can make the video with grandma waving, if its start frame already has the correct grandma, cookie and background.
  - The start frame is the sub-goal. A sub-tool finds the correct grandma, an image tool changes her clothes if needed, and an image tool makes the start frame with the correct background matrix.
  - The video tool maintains the background. It does not make the text correct, so a text tool solves the text conditions.
  - Sound has no Magic Hour tool. An unbound tool with the correct type signature (for example `music_score: (mood, duration) → AudioTrack`) lets the plan complete. The binding is decided at execution.
- Long videos with scenes: the same process recurses on the long operational PRD. No tool satisfies all of it, so it breaks down until a tool can satisfy an abstract part with perfect inputs.

**Three cases for a piece:**
1. **A tool solves it.**
2. **Nothing solves it, so break it down.** This is the default.
3. **Nothing solves it, so get more information.** This applies when the types of a tool align with most of the piece, and only a few inputs are missing.
- Open question: how to separate case 2 from case 3 exactly. Candidate (not decided): case 3 applies when the missing input can come only from an original source (a real person's photo, a brand asset, a fact, a preference); otherwise the missing input is a sub-goal (case 2).

**MVP assumption:** tool specs are good enough. Order, clobbering and confidence are post-MVP. See [../post-mvp.md](../post-mvp.md).

**Questions to answer:**
- What algorithm does the backward search use, and how does it rank tools ("makes the most conditions true")?
- What does the solver return when it cannot solve a piece?
- How do the solver and the splitter alternate?
- How is the ordering checked before execution?
- What format does the ordering use, so a studio can display and edit it?

**Ideas raised (not decided):**
- Loop: split as little as possible → solve → if a piece fails, re-split only that piece (scoped) → solve again.
- The solver is part of operations. Operations uses the state manager.

**Inputs:** pieces from the splitter, tool specs, theorem library.

**Outputs:** a checkable tool-call ordering with connected inputs and outputs.
