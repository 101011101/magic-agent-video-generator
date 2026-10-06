# Subsystem 4: Operations Splitter

> Status: problem statement only. Design is not started. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md), [02-creative-director.md](02-creative-director.md)

**Problem:**
- The creative director is the natural-language splitter. It produces the story and its operational chunks.
- Operations needs a separate splitter. It breaks the operational chunks into pieces that tools and theorems accept.
- The operations splitter can be completely new, or inspired by the creative director.
- The pieces must add up to be equivalent to the story.
- Each piece must carry its context and its dependencies (example: a previous scene, a starting frame, an environment matrix).

**Input from the creative director (decided in chat):**
- The operational chunks exist to make this splitter's work easier.
- Each chunk holds the exact quote from the story it describes.
- Two chunk formats are under test (see [02-creative-director.md](02-creative-director.md)):
  - **A. Straight operational chunks:** each chunk lists its full state.
  - **B. Change-based chunks:** a baseline state, then per chunk only the changes (`property: from → to`), continuous or cut, and depends on.
- With format B, the held state is the state set by the first operational frame. In the state transformation, only the listed changes happen. Everything else stays the same (ceteris paribus).

**Atomization (decided in chat):**
- The splitter turns an operational chunk into an AND of true/false conditions (see [01-types.md](01-types.md)).
- Each element that changes gets an atom. Elements that do not change get no atom. A few universal atoms (example: background, filtering) can be added.
- Atomization is a simple inference. A cheap model can do it. It maps each free-text change onto the atom vocabulary in [tool-signatures.json](../../tests/fixtures/tool-signatures.json).
- The baseline counts as changes from nothing, so baseline elements that matter (identity, background) get atoms.
- Long videos: the splitter recurses on the long operational PRD until each piece can be satisfied by a tool with perfect inputs (see [05-solver.md](05-solver.md)).

**Splitting is a join tool (decided in chat):**
- The splitter breaks a goal by picking a join tool (stitch, mux, overlay or composite) as the last tool of an epoch, when no other tool covers every condition. See the core loop in [05-solver.md](05-solver.md).
- The join's signature passes its inputs through, so the pieces add up to the goal by construction.
- Splitting happens only when needed. Chunk boundaries are not tool boundaries.

**Questions to answer:**
- How is the splitter scoped, so it re-splits only one piece, not the full story?
- What does it do when it finds missing context? (See [03-context-resolution.md](03-context-resolution.md).)
- With format A, how does the splitter find the changes between chunks?

**Idea raised (not decided):**
- The splitter does as little splitting as possible. The solver runs next. If the solver cannot solve a piece, the splitter runs again on that piece only.

**Moved:** contradictions in the request are now exposed by the creative director (the natural-language splitter).

**Inputs:** operational chunks, context, scope.

**Outputs:** pieces with context, dependencies and a join.
