# T-041 · Explain: one grey line on every heading, slideshow and node, assembled from the graph

status:     dry prototype 2026-10-31 (`worktree.js` EXPLAIN by node type; shown in the Workflow view)
priority:   medium
subsystem:  agent, frontend, results

what:
Every heading, every slideshow and every node in the Workflow view, the sidebar tree and the results pages carries
a short line in grey, or a question mark that opens it, saying what the thing does in relation to the rest:

- stage headings: what the stage takes and hands on ("keyframes: one painted still per distinct frame of the
  screenplay; the clips are pinned on them");
- slideshows: what the set is ("the eight plates: the empty places every frame is painted into");
- nodes: the node's role from its edges ("the last frame of shot 7, painted from s7-1, which the sequence of shots
  6 to 9 is pinned on; flagged by the geometry gate").

The line is assembled by code from the node's type, its inputs' roles and its dependents, in `worktree.js`
(`explain(node, graph)`). Never written by hand, never by a model: it is true to the graph by construction. The
frontend shows it on hover and on the selected node; the results pages print it under each heading.

why:
The user's request of 2026-10-31: everything will have headings, with a grey text beside or a question mark to
explain quickly what this tool call does in relation to everything else.

acceptance:
Every node type in `worktree.js` has an explain template; the Workflow view for `topgun9` shows a line on every
section, slideshow and selected node; a reader who has not seen the pipeline can say, from the lines alone, why
`s7-2` exists and what breaks if it changes.
