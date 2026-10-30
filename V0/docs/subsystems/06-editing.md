# Subsystem 6: Editing

> Status: problem statement only. Design is not started. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md), [05-solver.md](05-solver.md)

**Problem:**
- A user changes an existing video. Example: "in the second scene the guy's shirt is green, make it red, leave everything else alone".
- The system must change only what the edit affects.
- The system must run only the tool calls that the change requires.

**Idea raised (not decided):**
- Editing uses the same solver.
- The edit changes a part of the solved tree. The change propagates through the tree.
- Where the change propagates, the system runs the necessary calls. The rest of the tree is reused.

**Questions to answer:**
- How does the system locate the part of the tree that a natural-language edit refers to?
- How does a change propagate: along which dependencies, and where does it stop?
- How does the system handle vague feedback with no clear target? Example: "it looks dull and dragging".
- How does the system keep two versions? Example: "the other one was better, but keep the new ending".

**Inputs:** the solved tree of the existing video, the edit request.

**Outputs:** a changed tree and the tool calls that the change requires.
