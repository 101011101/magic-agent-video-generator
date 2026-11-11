# T-043 · The shape judgement and the proposed working tree for complex tasks

status:     dry prototype 2026-10-31 (`plan.js`: shape single | tree | film; tree nodes with inputs naming other nodes; the film chain instantiated; the tree drawn with arrows in the UI and the bench page)
priority:   high
subsystem:  agent, frontend

what:
1. **Shape** in the plan call (`backend/agent/plan.js`): `single`, `tree` or `film`, from the desired state against the
   current state (`prd/11-agent.md`). The checks that decide it are stated in the prompt and tested by the bench:
   several elements that must coexist, text on the picture, variants, a sequence → tree; a story → film; else single.
2. **The proposed tree**: for `tree`, the planner's steps form a graph: a node's `inputs` name the nodes whose
   `produces` it takes; leaves are generations or edits of one element; composes take several; variants come last.
   For `film`, the nodes are the fixed chain (story, screenplay, keyframes, clips, film) from the catalogue, with the
   sheet's answers as parameters, never invented.
3. **The drawing**: the tree as layers with arrows (`frontend/index.html`, `bench/page.js`), each node a compact tool
   block; a node clicked opens its block; a block edited marks its dependents stale (T-045).
4. **Memory**: the session's `assets/` holds one file per node under the node's `produces` name (T-044 writes the
   placeholders there; the real tools will write the same paths).

why:
The user's design of 2026-10-31: a custom tool that proposes potential worktrees, only the order to build things and
the tools, drawn with arrows so the user can audit it under the same rules as a finished run; creative direction
becomes sub-problems through that structure.

acceptance:
The bench's composed cases (`V2/bench/cases/cx-*`) come back as trees with the expected node count and a compose
step that takes two or more produced nodes; the simple cases stay single; the film cases are the five-node chain.
The tree renders with arrows on the bench page and in the chat.
