# T-046 · The film chain as a tool of the agent: one dependency rule, a library entry, the session's notes, real estimates

status:     open
priority:   high
subsystem:  state, edit, agent, frontend, lib

## The user's request (2026-10-31)

> just double check if this pipeline would be compatible with the new agentic loop thing, the work tree dependencies
> vs state manager, and importantly if the pipeline can be audited as part of the tool auditing process of the ui ux
> workflow. If I am not mistaken we have auto mode, accept edits, and manual, which means that the parts of the
> pipeline would be audited and stopped if necessary, but also bits of it can be edited, there is also a directory to
> keep track of the assets so things can be edited

what:
The check is written up in `prd/11-agent.md` ("The film chain as a tool") and `prd/13-worktree.md` ("Checked against
the pipeline on topgun9"). What it found to build:

1. **One dependency rule, in the state manager.** `State.dependents(id)` returns the hard closure (image 1; the clips
   AND the sequences pinned on a still; a shot's stills; a plate's first stills) and the soft takers (the frame
   before, a portrait, a prop picture, the style sheet, a voice sample). `pipeline.mjs` (`--retry`, `--only`,
   `--restore`, `--retry root-`) and `worktree.js` both call it; what `--only` does today becomes the rule (hard
   remade, soft kept and marked "built with an older reference"); the Workflow view shows the set the pipeline would
   remake, no other.
2. **Sequences are invalidated like pinned clips.** Today `makeSequences` returns as soon as `K.sequences[key].clip`
   exists (`edit.js` line 139) and the retry loop deletes only `K.made` (`pipeline.mjs` line 127): after
   `--retry s7-2 … --until film` the sequences of 6–9 and 10–11 and the film would be kept from the old frames. A
   sequence records the files it was pinned on and is remade when any of them changed, as a pinned clip is
   (`edit.js` line 67). Read in the code; the ninth film's sequences were made after its last repaint, so no run has
   hit it.
3. **The re-run estimate prices the remake from the registry** (one still at the profile's cost, a sequence at its
   seconds times the rate), not the recorded spend with its attempts: s7-2's view says 8,032 credits where the remake
   of its eleven dependents is about 2,000.
4. **A library entry.** `pipeline.mjs` guards its program (`import.meta.url` against `process.argv[1]`) and exports
   `runPipeline(opts)`: the flags as an object, `say` as a callback, the exit code returned. Until then the server
   spawns it per stage (`node V2/backend/composer/pipeline.mjs --label … --until …`), one spawn per label at a time (the run's
   `.lock` refuses a second writer), with `CLEANED_CAP` set to the ledger total plus the card's approved amount so the
   pipeline's own guard enforces the card's number.
5. **Notes belong to the session.** Comments and flags move from `runs/<label>/notes.json` (where `server.mjs` writes
   them today) to `sessions/<id>/notes.json` with the run label on each note, as `12-frontend.md` has it; `runs/` stays
   the pipeline's alone.
6. **Estimates after the screenplay come from the pipeline.** The film card's cost is the planner's guess (one still
   per 2.5 s of film: 2,400 for a 30-second film on nano at 2k) until `--until keyframes` has run, then the pipeline's
   count (the ninth film: 20 stills, 4,000; printed as "if all painted N credits"; `--dry` lists the jobs one by one).
7. **Explicit go for paid stages in every mode.** A text stage (story, screenplay, state, prompts) may run on silence;
   generated sheets, paint and clips wait for Run, in `ask` and in `auto` alike (`11-agent.md`).
8. **A dry run leaves the record as it was.** Today `--dry --retry <id>` moves the painted entry into the attempts and
   saves before the estimate (`pipeline.mjs` lines 125–128, then `finish`), so the next real run repaints the still
   unasked. With `--dry` the retry bookkeeping is computed and printed, not written.

why:
The user's question of 2026-10-31, after the chat, the tool blocks and the Workflow view were built in a parallel
session. Measured on the live server for `topgun9`: the tree's dependents of s6-2 are 13 where the pipeline's are 2;
of s3-1, 19 against 3; of the range plate, 25 against 17; `rerun_credits` counts every attempt. Read in the code: a
repainted still does not remake the sequence pinned on it, and a dry retry alters the record.

acceptance:
On `topgun9`: selecting s6-2 in the Workflow view shows two hard dependents (the sequence of 6–9 and the film, 216
credits) and eleven soft takers marked; `--retry s6-2 --dry --until film` prints the same two and leaves `run.json`
byte-identical; a test in `tests/edit.test.mjs` with a repainted still shows its sequence remade; a film started from
a card runs stage by stage, waits before paint and before clips in both modes, and the ledger matches the card's
number; `notes.json` is absent from `runs/`.
