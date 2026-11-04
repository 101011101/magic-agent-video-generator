# T-049 · Facts for everything in the session, a pre-flight on paper, and plain checks after each step

status:     in progress (first version built 2026-11-01; not yet committed)
priority:   high
subsystem:  agent, state, executor, bench

what:
The agent tree had no state of what is in what: the planner saw material file names, and nothing compared an output
with what its step was for. Of the 67 bench items still failing, 23 broke in our executor and 21 in the planner's
reasoning, and in many the agent could not have known (a silent clip, two faces, a setting the tool ignores).

1. **Facts** (`backend/agent/facts.js`). Every material gets code facts (kind, size and shape, length, sound none /
   silent / present, transparency and how much is kept) and one vision call with fixed questions (people and where
   they are, the main subject, the words verbatim, the background), cached by content hash in
   `materials/.facts.json`. The planner reads MATERIALS as `name — facts; people: …; words: …`. Every step's output
   gets its code facts, kept on the step and on the session asset (`assets[].facts`).
2. **Pre-flight** (`backend/agent/preflight.js`), before any tool is called. The plan runs on paper: each tool turns
   its inputs' properties into its output's by what the tool and executor actually do (image-to-video drops sound,
   talking-photo takes the speech's length, background-remove drops lettering, assemble hard-cuts). The end is compared
   with the goal from the sheet (kind, aspect, length, transparency, sound), and the user's colours and quoted words
   must reach some prompt. Findings go on `plan.preflight` and each step. Not a gate.
3. **Step checks** (`stepCheck`), no model calls: the output exists; its kind is what the tool makes; it is not
   byte-identical to its input (nothing was done); aspect and seconds match the step's params; transparency asked
   is there and keeps the picture's marks; sound asked to be kept is present. A mismatch sets the node to `flagged`
   with the reason; the run goes on.
4. **Goal check** (`goalCheck`) after the run: the deliverables against the sheet's length and size
   (`plan.goal_check`).
5. **Question first.** The planner names the questions a plan depends on, answers them from the facts, and only when
   it cannot, adds a `check` step (vision, one specific question, never a general review) whose answer is put into
   the prompt of the step that needs it.

done when:
- the bench page shows, per step, "on paper" against "measured", the pre-flight findings and the goal check (done);
- pre-flight on the 66 failing plans flags the ones a type check can see (13 of 66 at first: lettering lost to the
  cutter, palettes that reach no prompt, dissolves assemble cannot do) with no false flags on passing items (to check);
- a rerun of the failures with the planner reading facts.

not in scope: gates that stop a run (later, in the production version).
