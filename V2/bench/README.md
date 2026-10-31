# bench — the test set

Cases live in `cases/<id>.json`; the runner (T-031) is not built yet. A case is: the brief, the materials the user
has, the **answer sheet** (what the user has in mind, which the brief states, implies or withholds), and what we
expect: which fields are extracted without asking, which questions are allowed or required, which tools run in what
order, the in-between states, the credits cap. `score` says in one line what passing means.

## How a case runs

The pipeline (the agent, T-034) is one side of the conversation. The other side is a **proxy user**: a text model given
the answer sheet and one rule: answer only what is asked, from the sheet, in one short message; never volunteer a field
that was not asked; if the sheet has no value for what is asked, say "your call". The transcript is the record. After
the run, the checks compare:

- **extraction**: the agent's sheet against the answer sheet, field by field, with how each was filled (stated,
  inferred, asked); a field asked that the brief stated is a fail, a field inferred wrong above the threshold is a fail;
- **questions**: count and names against `questions`, `questions_max`, `questions_required`, `never_ask`;
- **tools**: the tools called, in order, against `tools` or `tools_any`; `tools_forbidden` never appear; `state_chain`
  names the in-between assets the agent must produce or name;
- **references**: `refers_to` against the asset the agent acted on (cases with `after` run on that case's session);
- **money**: `paid_before_answers`, `paid_before_yes`, `credits_max`, `cap`.

Three groups:

- `extraction`: the same property either embedded in the text, implied, withheld, or waived ("surprise me"); does the
  agent read what is there, ask for what is not, and never ask for what it was told?
- `source`: for real things, can it be researched (Commons, the web) or must it come from the user (my cousin's truck,
  my dog)? An invented story with real hardware is both.
- `tools`: the desired state against the current state (what the user supplied), and the tools or in-between states
  that bridge them: an edit versus a generation, one call versus a chain, a swap versus a film, a verb that misleads.

Zero-credit cases (everything that ends in a question, a cost stop or a plan) run on every change. Paid cases run
under one cap on the free tier.
