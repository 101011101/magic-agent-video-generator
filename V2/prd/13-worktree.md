# 13. The working tree: the whole agentic workflow as a graph that can be audited and re-run

Written 2026-10-31 from the user's description of that day. The state manager (`04-state.md`) is micro: it holds
the tables of one film, who is in which frame, what each still was painted from. The working tree is macro: every
tool call the agent made, in any session, with its inputs, its parameters and its outputs, and the edges between
them, so that the whole workflow can be read, any part of it re-run, and only what depends on that part remade.

## What it is

A directed graph. A **node** is one tool call (or one quantum of a text stage, see below) with:

- its type and stage (story · screenplay · assets · keyframes · clips · edit · a small job);
- its inputs: the nodes whose outputs it took, in order, with each one's role (the plate, a portrait, the previous
  still, the start frame);
- its parameters (model, resolution, seconds, aspect) and its prompt, by file name;
- its outputs, attached to it: the file, the attempts, the gate's verdict;
- its cost and when it ran;
- its **explain**: one line of what this call does in relation to everything else.

An **edge** is an output used as an input. The graph is built from what already exists: a run's `run.json` (every
job records its inputs and its file) and a session's `session.json` (every step records what it took and made).
Nothing is recorded twice; the tree is a reading of the records.

## Quantised text stages

A story or a screenplay is one call but many outputs. For dependencies to be drawn at the right grain, the text
stages are quantised into nodes of their own: the story is one node; the screenplay is one node per **scene** and one
per **shot** under it; the sheet (the universal questions) is one node per field. A still then depends on its shot,
a shot on its scene, a scene on the story; a change to scene 7 invalidates the stills of scene 7's shots and the
clips pinned on them, and nothing in scene 3. The same quantisation is what the screenplay view's blocks are
(`12-frontend.md`): a comment on a block is a comment on a node.

## Audit

Every node can be opened: what it took, what it was told (the prompt file), what it made, what the gate said, what
it cost. Nodes of the same type are aggregated into one **slideshow** with a heading (the eight plates, the
twenty-one keyframes, the four sequences); the slideshow is the audit view of that stage.

## Explain

Every heading, every slideshow and every node carries a short grey line, or a question mark that opens one, saying
what this thing does in relation to the rest: "the empty place every frame of scene 1 is painted into"; "the last
frame of shot 7, which the clip of shots 6 to 9 is pinned on"; "the voice sample the sequence takes as a reference
for Vega's lines". The text is assembled by code from the node's type and its edges, never written by hand and
never by a model, so it is always true to the graph.

## Re-run with dependencies

Selecting a node and asking for it again:

1. the tree computes the **dependents**: every node reachable from it along the edges (the stills painted from
   this still, the clips pinned on them, the film);
2. it shows them, with the cost of remaking them from the registry, and leaves everything else untouched;
3. on the user's word the node re-runs with its parameters (edited if the user edited them) and the dependents are
   remade in order; every node outside that set keeps its output, because the job cache makes an unchanged call
   free (`lib/jobs.js`).

This is `--retry` and `--only` made visible and general: the same rule for a still, a scene, a plate or a small
job's edit. A node with no dependents (the last clip, a one-off image) re-runs alone.

## Where it lives

`backend/agent/worktree.js` builds the graph from a run folder or a session; the server serves it (`/tree/run/:label`,
`/tree/session/:id`); the frontend renders it as the Workflow view: stages as sections, each with its heading and
explain, each type as a slideshow, a node selectable to show its dependents and the re-run estimate. The sidebar's
tree (`12-frontend.md`) is the same graph as a directory.

## Built

The dry prototype of 2026-10-31: the graph from any run folder (story, scenes, shots, bank assets, stills with
their attempts, sequences, music, film) and from a session; explain lines by type; dependents and the re-run
estimate; the Workflow view. Re-running from the view is design (T-040).

## Proposed trees: the plan for a complex task is a working tree (added 2026-10-31)

The planner judges the **shape** of every request before it picks tools:

- **single**: one element, one tool (a logo on a mug, a face swap, captions). The plan is one node, or a short chain.
- **tree**: more than one element must coexist, or text goes on the picture, or there are variants or a sequence (an
  Instagram post with a product, a headline and a logo; a carousel; a product on a new background; a thumbnail).
  The plan is a **proposed working tree**: the sub-elements to make or edit first, the compose steps that take them,
  the variants after; every node a tool call with its inputs naming the nodes it takes; the order is the tree's
  topological order. Creative direction turns into this structure and nowhere else: the direction fields feed the
  tree call, the tree's leaves are simple problems, and the planner picks a tool per leaf.
- **film**: anything with a story. The tree is known and fixed: story → screenplay → keyframes → clips → film, with
  the asset bank hanging from the story and every keyframe from its shot (`00-overview.md`). The planner does not
  invent it; it instantiates it with the sheet's answers.

The proposed tree is shown before anything runs, as nodes with arrows (`12-frontend.md`): the user audits it the way
they audit a finished run, because it follows the same tool rules and the same shapes. A node's parameters can be
changed, a node removed, an input re-pointed; a change marks the node's dependents stale and they are remade when the
tree runs; nothing upstream is touched.

**Memory follows the tree.** The session's `assets/` folder holds one file per node output under the node's name, so
the directory on disk and the tree on screen are the same structure. The state manager keeps the context inside the
elements (what is in a frame, what it means relationally); the working tree keeps the dependencies and the tools.

**Simulation.** For tests, the tools can be stood in for: every node "runs" perfectly and produces a placeholder
image carrying its name, tool and inputs, so the loop, the tree, the propagation and the memory layout can be
exercised at zero credits before any real call.

## Checked against the pipeline on topgun9 (2026-10-31, later)

The user asked whether the film chain and the tree agree: "the work tree dependencies vs the state manager". Measured
on the live server (`/tree/run/topgun9`): 61 nodes and 115 edges; the story, 8 scenes, 12 shots, 3 plates, 3 sheets,
8 pictures from the record, 21 stills, 3 sequences, the music, the film. Every still's image 1 resolves through its
attempts to the node it really came from (s7-2, a repair of its eighth retry, points at s1-1); the title card has no
image 1; the sequences hang from their stills and the voice sample; the film from the sequences and the music. The
tree is a true reading of `run.json`.

**Two rules of dependency exist, and they disagree.** The pipeline's (`dependents` in `pipeline.mjs`, behind
`--retry`, `--only`, `--restore` and `--retry root-<place>`) follows image 1 only: the stills painted from a still,
recursively, and the clips pinned on them. The tree's (`dependents` in `worktree.js`) follows every input: image 1,
the frame before (`prev:`), the portraits, the prop pictures, the style sheet, the voice samples. Side by side:

| selected | pipeline rule | tree | the difference |
|---|---|---|---|
| s7-2 | 11 (s7-3 to s7-10, two sequences, the film) | 11 | none |
| s7-1 | 2 (the sequence of 6–9, the film) | 2 | none |
| s6-2 | 2 | 13 | s7-1 to s7-10 and the sequence of 10–11, through `prev:` (s6-2 is the frame before s7-1 and s7-2) |
| s3-1 | 3 (s3-2, the sequence of 1–5, the film) | 19 | every later still, through the chain of `prev:` edges |
| s5-1 | 2 | 16 | the same |
| s1-1 | 16 | 23 | the seven cockpit stills, through s2-1, which took the opening wide as its frame before |
| the range plate | 17 (s1-1 and everything after it) | 25 | the cockpit plate, generated with the range plate as its reference, and the cockpit stills under it |

Both answer a real question. The tree's closure says whose inputs change (the job cache's view: a changed input is a
new call). The pipeline's chain says what must be remade for the pictures to stay consistent: a still is painted into
its image 1 and a clip onto its frames, while the frame before, a portrait or the style sheet only inform it, and a
repaint of s6-2 does not move the jets in s7-2. The pipeline's `--only` already treats the two differently: the named
dependents are remade, the rest kept and marked.

**The pipeline's rule has a hole the tree does not have.** A retried still deletes the pinned clips on it (`K.made`,
`pipeline.mjs` line 127) but never a sequence: `makeSequences` returns as soon as `K.sequences[key].clip` exists
(`edit.js` line 139) without looking at whether its frames are still the current files, where the pinned-clip path
compares them (`edit.js` line 67). After `--retry s7-2 … --until film` the two sequences and the film would be kept
from the old frames. Read in the code, not yet hit in a run: the ninth film's sequences were made after its last
repaint.

**The re-run estimate counts history, not the remake.** `rerun_credits` sums each dependent's recorded credits, which
include every attempt (s7-2's ten attempts are 2,000); the remake of s7-2's eleven dependents is eight stills and two
sequences at the registry's prices, about 2,000 credits, where the view says 8,032.

**Built (2026-10-31, later still, T-046).** One rule, read by both. `backend/lib/deps.js` names the two kinds of edge:
**hard** (image 1; a still to the clip or sequence pinned on it; a shot to its stills; a scene to its shots; a step to
its input) and **soft** (the frame before, a portrait, a prop picture, the style sheet, a voice sample); an unknown role
is hard. `State.dependents(id)` returns the hard set (the stills painted into it, recursively; the clips and the
sequences pinned on any of them; the film) and the soft set (the stills that took it as the frame before, a portrait or
a prop picture); `--retry`, `--restore` and `--retry root-<place>` remake the hard set and mark the soft set "kept
with an older reference" (`--only` may still name either). The tree classifies every edge by its role, follows the hard
ones for `dependents`, lists the soft takers as `informed`, and prices `rerun_credits` from the registry at the run's
profile (one still, a sequence at its rendered seconds, a card at nothing). On the ninth film the two now agree: s7-2
has 11 dependents at about 2,200 credits (the view said 8,032); s6-2 has 2 and informs s7-1 and s7-2; s3-1 has 3 and
informs s4-1; the range plate has 17 and informs the cockpit plate and four cockpit stills. A sequence is now pinned on
its frames like a clip (`edit.js` records the frame list and compares it; a record from before the rule reads its
refs), and a dry run writes neither the record nor the pages. Tests: `tests/worktree.test.mjs`, the dependency cases
in `tests/state.test.mjs`, the sequence cases in `tests/edit.test.mjs`.

One difference remains by design: the tree reads what was sent (the job records), the state manager what the plan
would send now. A still the plan no longer has (the ninth film's s1-2, from an earlier plan, still in the record's
stills table) is in the tree and not in the state manager's answer.
