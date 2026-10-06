# Subsystem 5: Solver

> Status: core loop decided in chat. Search algorithm and output format not designed. Parent: [vision.md](../vision.md)
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

**Core loop (decided in chat):**
1. The operational spec becomes a checklist of true/false conditions. These are the atoms.
2. Each epoch, look for a non-join tool that makes every condition true, given perfect inputs.
3. The join tool is the last tool picked at every epoch. A join tool (stitch in time, mux for audio layers, overlay or composite for visual layers) passes its inputs through and assumes each input is perfectly true. It splits the goal into nested goals.
4. Each nested goal has its own sub-conditions. Repeat until every condition ends at a leaf.
- Mixed-media inputs are conditions that are already true. They pass through.
- Chunk boundaries are not tool boundaries. One tool call can cover several chunks (example: grandma's three chunks in one image-to-video call).

**Leaves:** every input requirement ends at one of these:
- **Given input:** an upload already makes the conditions true.
- **Generated input:** another tool makes it true (recurse).
- **Research:** only a public original source can supply it (a fact, a public asset).
- **Ask:** only the user can supply it (a private photo, a brand asset, a preference).

**Hard and soft credit (nature field approved, to be evaluated):**
- **Hard credit:** the atom is in the tool's signature.
- **Soft credit:** the atom is not in the signature. A cheap LLM reads the tool's `nature` field and judges whether the tool can make the condition true, with a confidence. Example: a video generator that accepts a prompt can likely do a fade.
- The solver prefers hard credit. It uses soft credit when no tool has hard credit.
- Rigid conditions (an exact logo, exact text) need hard credit.
- Soft-credit answers can be cached per tool and atom.

**The plan is a graph, not a tree (decided in chat):**
- A continuous dependency is a shared node: the end frame of chunk n is the start frame of chunk n+1.
- A shared entity is a shared root node: every chunk with the keeper points to one keeper binding (see bindings in [01-types.md](01-types.md)).
- A join knows the order from its ordered inputs. It knows the dependencies from the shared nodes.
- Execution follows the graph: shared and earlier nodes first, independent nodes in parallel.
- **Re-anchor to the root:** every generation conditions on the root binding (the original reference). Never chain generated → generated for identity. A continuous chunk uses the previous end frame for continuity and the root reference for identity.

**Generative vs. deterministic for the same condition:**
- A video generator can do fades and moves from a prompt (soft credit), but it redraws every frame, may distort a logo, and gives no transparency.
- A deterministic editing tool is exact.
- Rigid conditions use the tool that maintains them (deterministic for exact logos and text). Loose conditions can use the generator.

**Worked examples:** [solver-traces.md](../solver-traces.md) (grandma, logo fade, lighthouse).

**Three cases for a piece:**
1. **A tool solves it.**
2. **Nothing solves it, so break it down.** This is the default.
3. **Nothing solves it, so get more information.** This applies when the types of a tool align with most of the piece, and only a few inputs are missing.
- Case 3 is the research or ask leaf: the missing input can come only from an original source. Anything a tool can produce stays a sub-goal (case 2).

**MVP assumption:** tool specs are good enough. Order, clobbering and confidence are post-MVP. See [../post-mvp.md](../post-mvp.md).

**Questions to answer:**
- What algorithm does the backward search use, and how does it rank tools? Candidate MVP order: fewest uncovered conditions, then fewest new sub-goals, then cost.
- When several joins apply (mux, stitch, composite), does their order matter?
- How does the solver read an upload into conditions (for example, a vision model describes it once)?
- Is the rule "public → research, private or preference → ask"?
- Can a split happen inside one chunk (two edit tools in sequence), or only across segments and layers?
- What does the solver return when it cannot solve a piece?
- How do the solver and the splitter alternate?
- How is the ordering checked before execution?
- What format does the ordering use, so a studio can display and edit it?

**Ideas raised (not decided):**
- Loop: split as little as possible → solve → if a piece fails, re-split only that piece (scoped) → solve again.
- The solver is part of operations. Operations uses the state manager.

**Inputs:** pieces from the splitter, tool specs, theorem library.

**Outputs:** a checkable tool-call ordering with connected inputs and outputs.
