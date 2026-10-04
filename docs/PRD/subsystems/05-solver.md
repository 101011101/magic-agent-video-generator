# Subsystem 5: Solver

> Status: problem statement only. Design is not started. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md), [04-operations-splitter.md](04-operations-splitter.md)

**Problem:**
- After the splitter runs, the system has pieces. The solver must put the pieces together into a solution.
- The solver returns a completed tool-call ordering:
  - which tools are called,
  - with which inputs,
  - how the outputs connect to the inputs of later tools.
- The ordering is a recommendation. It is not executed by the solver.
- The ordering must be checkable before execution.
- The ordering must connect to a studio (a place where the user sees and edits the chain).

**Questions to answer:**
- How does the solver match pieces to tools and theorems?
- What does the solver return when it cannot solve a piece?
- How do the solver and the splitter alternate?
- How is the ordering checked before execution?
- What format does the ordering use, so a studio can display and edit it?

**Ideas raised (not decided):**
- Loop: split as little as possible → solve → if a piece fails, re-split only that piece (scoped) → solve again.
- The solver is part of operations. Operations uses the state manager. (See the two roles in [01-types.md](01-types.md).)

**Inputs:** pieces from the splitter, tool specs, theorem library.

**Outputs:** a checkable tool-call ordering with connected inputs and outputs.
