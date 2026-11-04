# T-035 · Editing: plan the PRD before building it

status:     open (planning only; build after the agent runs)
priority:   medium
subsystem:  edit, agent, state

what:
A PRD file, `prd/14-editing.md`, that says how an edit works before any code: the output fed back as an input with a
time range and an instruction, and the tools that act on it. The questions the file must answer:

1. **Provenance decides the route.** An asset a run made re-enters the run: the instruction maps to shots and seconds
   through `state.json`, `--retry` on those items, `--only` on what was built from them, everything else cached. A
   supplied asset, or a whole-frame change, goes to a tool over the asset (image editor, character replace, lip sync,
   upscaler, the video editor endpoint) with the range as the tool's seconds. Write both paths with one example each.
2. **The time range.** How "the ending", "at 0:12", "the part where he turns" become a clip id and a second range;
   what happens when a range crosses a cut or a sequence boundary.
3. **What an edit may touch.** Only what the instruction names; the rest of the film is bit-identical. The check: a
   frame-by-frame diff outside the range is zero.
4. **Continuity after an edit.** A changed still invalidates the stills painted from it and the clips pinned on it;
   the state manager already knows the chain; the PRD states the rule and its cost.
5. **The session record.** The original is kept; the edit is a new asset with its parent; "undo" is choosing the
   parent again.
6. **Costs.** Per route, from `08-costs.md`; the benchmark's `tool-follow-up-edit` case as the measure.

why:
The user's decision of 2026-10-31: editing is its own subsystem, done after the agent; it can be treated as refeeding
the output as input with timestamps, since tools exist for it. Writing the PRD first keeps the agent's session record
and the state tables shaped for it (parents, ranges, the shot map) so nothing has to be redone.

acceptance:
`prd/14-editing.md` written and listed in `00-overview.md`; the session schema in `11-agent.md` carries `parent` on
every asset; no code.
