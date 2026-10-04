# Subsystem 4: Operations Splitter

> Status: problem statement only. Design is not started. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md), [02-creative-director.md](02-creative-director.md)

**Problem:**
- The creative director is the natural-language splitter. It produces the script and its elements.
- Operations needs a separate splitter. It breaks the script and its elements into pieces that tools and theorems accept.
- The operations splitter can be completely new, or inspired by the creative director.
- The pieces must add up to be equivalent to the script.
- Each piece must carry its context and its dependencies (example: a previous scene, a starting frame, an environment matrix).

**Questions to answer:**
- How does the operations splitter break the script into pieces?
- How much splitting does it do?
- How does the system prove that the pieces add up to the script (the matching join)?
- How is the splitter scoped, so it re-splits only one piece, not the full script?
- What does it do when it finds missing context? (See [03-context-resolution.md](03-context-resolution.md).)

**Idea raised (not decided):**
- The splitter does as little splitting as possible. The solver runs next. If the solver cannot solve a piece, the splitter runs again on that piece only.

**Moved:** contradictions in the request are now exposed by the creative director (the natural-language splitter).

**Inputs:** the script and its elements, context, scope.

**Outputs:** pieces with context, dependencies and a join.
