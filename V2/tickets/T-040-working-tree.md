# T-040 · The working tree: the workflow as a graph, dependents, re-run from any node

status:     dry prototype 2026-10-31 (`backend/agent/worktree.js`: the graph from a run folder or a session, dependents, the re-run estimate; the Workflow view); re-running from the view is to build
priority:   high
subsystem:  agent, state, results, frontend

what:
1. **The graph** (`prd/13-worktree.md`), built by code from the records: a run's `run.json` (jobs with inputs and
   files; stills with scene and shot; the screenplay's scenes and shots; the bank) and a session's `session.json`
   (steps with inputs and outputs). Nodes carry type, stage, inputs with roles, parameters, the prompt file, outputs
   with attempts and the gate verdict, cost, and the explain line (T-041).
2. **Dependents**: the transitive closure along the edges from any node; the re-run estimate as the sum of the
   dependents' costs from the registry.
3. **Re-run from a node** (to build): the node re-runs with its parameters, edited or not, and its dependents are
   remade in order; nothing else is touched. For a run this is `--retry <still> --only <dependents>` driven from the
   view; for a session step it is the step's tool again with the same inputs, then every later step that took its
   output. A re-run writes new attempts, never over the old; the old output stays selectable.
4. **The Workflow view** in the chat (`frontend/index.html`): stages as sections with a heading and an explain; nodes of
   one type as a slideshow; a node selected shows its inputs, its outputs, its prompt by name, its dependents
   highlighted, and the re-run estimate with one action.
5. **The sidebar tree** is the same graph as a directory; selecting there selects in the view.

why:
The user's design of 2026-10-31: the whole agentic workflow must be auditable, and when something was done wrong
the user selects that portion and re-runs the tool, since every output is attached to its tool call; what depends
on it is remade, what does not is left alone. The state manager is micro, for one film; this is macro, for all of
the agent's work.

acceptance:
The Workflow view for `topgun9` shows every stage; selecting `s7-2` highlights the stills painted from it, the
sequence of shots 6 to 9 and the film, with an estimate that matches `08-costs.md`; selecting scene 3 highlights
only scene 3's stills and their clips. Then, to build, one re-run of `s7-2` from the view produces a new attempt and
remakes exactly the highlighted set, verified against the ledger.
