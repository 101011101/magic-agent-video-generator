# T-054 · The goal solver: goal types from the sheet, a path search over contracts, and "no path" said up front

status:     open (drafted 2026-11-01)
priority:   high
subsystem:  agent, planner, preflight

why:
Today the planner model is the solver: one call writes the whole tree. Code only predicts it on paper (pre-flight, T-049)
and, since 2026-11-01, sends the findings back once for a revision. Nothing can show that a goal is unreachable with
the tools we have. B07a wants a realistic recolour with the background pixel-exact: image-edit guarantees `background:
approximate`, while a code recolour guarantees `background: exact` but `edit: crude`. No path reaches both, and the agent
should say so instead of failing quietly. A03d wants 108 exact characters: the image tool's limit is about 40 per line,
text-overlay has no limit, so the address belongs to text-overlay.

what:
1. **The goal as types**, from the sheet:
   - kind, aspect, length (including a change's range: "the first 5 seconds" is 5 s, done in pre-flight);
   - sound, alpha;
   - required elements with attributes (the name "Mooncrumb" exact, navy; person 2's identity = the portrait);
   - preserved elements (everything else: exact | perceptual).
2. **A search over contracts** (T-053) from the current state (T-052 nodes) to the goal: each tool is an operator from typed
   inputs to typed outputs, with guarantees. It isn't algebra over pixels; it's a small graph search over types and declared
   properties, and it is only as true as the contracts.
3. **The planner model still writes the creative parts:** prompts, which concept, the wording. The search checks or completes
   the skeleton:
   - which tool carries each required element (the address → text-overlay);
   - which requirement no path can meet (exact background under a realistic edit).

   The unmet requirement goes into `say` before anything runs, with the closest path ("the background will be
   regenerated and look the same, not pixel-identical").
4. **Pre-flight stays** as the check on the final tree, and its revision loop stays (one round).

prd changes:
- `prd/11-agent.md`: a section "Solving": the goal types, the search, what the model does and what code does, how an
  unreachable goal is told to the user.
- `prd/04-state.md`: goal state and current state are the same node and element schema (T-052).

code changes:
- new `backend/agent/solve.js` (goal from sheet, search over contracts, explain no-path);
- `agent/plan.js`: the planner receives the skeleton and the unmet requirements;
- `agent/preflight.js`: driven by contracts (T-053);
- `agent/agent.mjs`: the order sheet → solve → plan → pre-flight.

test set changes:
- bench v1:
  - each item's answer sheet gets `goal_types` (kind, size, length, required and preserved elements, exact | perceptual);
  - the grader reports "unreachable on the free tier, said so" as its own outcome (T-051's outcome enum);
- B07a, B07d and similar must-haves say "perceptual" for the preserved background. This needs the user's OK: it turns
  B07a from a fail into a pass, as the best possible.

done when: on bench v1, every "model limit, no path" item is announced in `say` before running, and A03d's split is
produced by the search, not by a prompt rule.
