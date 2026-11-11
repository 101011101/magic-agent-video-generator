# T-045 · Editing a proposed or finished tree propagates to its dependents

status:     dry prototype 2026-10-31 (a parameter change on a done node marks its dependents stale in the session; re-simulate remakes the stale set)
priority:   high
subsystem:  agent, frontend

what:
1. In the session, a step's `inputs` and `params` are editable from its block (T-038). When a step that has run is
   edited, the server marks it and every step reachable from it (by produces → inputs) `stale`; the UI shows stale
   as amber.
2. Run-all remakes only the stale set, in order; everything else keeps its output (the simulation today; the real
   tools through the job cache later).
3. A node removed from a proposed tree removes its dependents' edge to it; a node whose input is re-pointed takes
   the new node's output; both are edits of the plan, saved and shown.
4. Same rule for a finished run (`T-040`): re-run from a node remakes its dependents only.

why:
The user's design of 2026-10-31: the working tree can be edited and revised, and changes propagate as agreed.

acceptance:
On the simulated Instagram case, changing the headline node's text marks the compose and the two variants stale and
leaves the loaf edit and the background untouched; Run-all remakes exactly those three.
