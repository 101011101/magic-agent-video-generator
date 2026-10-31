# T-044 · Simulated tools: every node runs perfectly and makes a placeholder, so the loop can be tested at zero credits

status:     dry prototype 2026-10-31 (`src/agent/simulate.js`; `bench/run.mjs --simulate`; `POST /session/:id/simulate`)
priority:   high
subsystem:  agent, bench

what:
1. `simulate(plan, dir)`: runs a plan's nodes in topological order; each node "succeeds" and writes a placeholder
   image to `assets/<produces>.svg` carrying its name, tool, model and the names of its inputs (so a composed
   placeholder visibly lists what went into it); the node gets `output` and state `done`.
2. The bench runner takes `--simulate`: after the dry plan, the simulation runs into
   `bench/results/<dir>/sim/<case>/`, and the page shows the tree with the placeholders in the nodes.
3. The chat has a Run-all control on a proposed tree that calls the simulation; outputs appear inside their blocks
   and in the sidebar tree under `assets/`.
4. The same code path later calls the real tools: `simulate` and `execute` share the ordering, the memory layout
   and the propagation; only the call differs.

why:
The user's request of 2026-10-31: for the testing, pretend the tool calls work perfectly and do exactly what we
want, with placeholder images, so the tree and the loop can be seen working.

acceptance:
`node V2/bench/run.mjs --simulate --case cx-insta-post,tool-edit-not-generate,ex-embedded-full` writes a page where
each case shows its tree with a placeholder in every node, the composed node's placeholder names its inputs, and the
session's `assets/` mirrors the tree.
