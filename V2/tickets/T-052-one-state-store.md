# T-052 · One state store for every workflow: an asset graph with element records; the film's tables become a view of it

status:     open (drafted 2026-11-01)
priority:   high
subsystem:  state, agent, composer

why:
Two state systems today. The film's state manager (`composer/state/state.js`) is solid but specific to films: it builds
places, stills and clips tables from a screenplay, then answers continuity questions (which references to send, who is
off-frame, which environment a still is painted from) and runs the people and room gates. The agent's trees have only
`session.json` (materials, assets, turns, plan steps), plus, since T-049, code-measured facts per file and a one-time
vision description per material, as flat strings. Nothing records what is IN an asset as structured elements (the
crescent, the word "Mooncrumb", the woman on the right), nor what each tool did to them. So nothing can reason "the
cut-out kept the crescent and dropped the word", or "the swap changed person 2's face and kept person 1's".

what:
1. **One store per session** (`sessions/<id>/state.json`, code in `backend/state/`). Nodes are assets (materials, step
   outputs, film stills and clips). Each node holds:
   - `facts` (measured by code, T-049);
   - `elements`: `[{ id, kind: person|object|text|mark|ground|place, where (box or side), attrs: {colour, words, identity, …}, source: measured|seen|declared|carried }]`;
   - `from`: `{ tool, inputs, params }`, the edge that made it.
2. **Element records come from three places.** The vision description of a material (`seen`). What a tool declares it
   did, carried from inputs through its contract (T-053): a recolour carries every element and changes one `attrs.colour`;
   a swap changes `person[k].identity`; a cut-out keeps the elements inside its mask. And tools that return data:
   face detection's faces, the read-back's lettering, a check's answer. Each record says its source, so a carried claim
   is never confused with a measured one.
3. **The film's tables become a view.** `places`, `stills` and `clips` are computed from the same nodes (a still is a node
   with frame and camera attrs; a place is an element of kind place with its plate). The continuity queries (`refs`,
   `offFrame`, `cropFor`, the gates) keep their code and read the store. Workflows take only what they need: the planner
   reads asset facts and elements; the film reads its view.
4. **Migration:** the film keeps writing `state.json` in its run folder; the session store links to it by run id until the
   view replaces it. No change to the film's outputs.

prd changes:
- `prd/04-state.md`: a section "One store": the node, element and edge schema; the film tables as a view; sources of a record.
- `prd/11-agent.md`, "The session": the session's assets are nodes of the store; the planner reads elements, not only names.
- `prd/13-worktree.md`: a tree's node output is a store node; re-running a node replaces it and marks dependents stale (as now).

code changes:
- new `backend/state/store.js` (load, save, addNode, carry(elements, contract, params), query), `backend/state/elements.js`
  (from `seen`, from tool returns);
- `agent/facts.js` writes into the store; `agent/execute.js` adds a node per step output with `from` and carried elements;
- `composer/state/state.js`: read and write through the store behind the same API (step 3).

test set changes:
- bench v1: per item, record the final node's elements in the run record and show them on the page;
- new state tests (`tests/state/`): carry through crop, recolour, swap and cut-out on fixtures; the film's state.json for
  topgun9 is identical when rebuilt through the view.

done when: the A06c and C14b runs show, on the page, which elements the output has and where each came from, and the
film test reproduces its tables through the view.
