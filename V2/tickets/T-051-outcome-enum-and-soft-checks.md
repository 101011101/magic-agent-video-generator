# T-051 · One outcome word per item, a tally per run, and soft versus hard writer problems

status:     open (staged for review 2026-11-01)
priority:   medium
subsystem:  agent, edit, results, screenplay, bench

what:
Two pieces of hygiene lifted from a review of Imagination Studio (T-050, items 4 and 5). Neither adds a capability;
both make what already happens legible and consistent.

1. **An outcome enum on every made item.** Today a node or clip carries `done | failed | flagged`, and three facts a
   reader needs are spread over other fields or lost: were credits spent, does a file exist, is it in the deliverable.
   One word fixes all three, derived by code, never by the model:

   | outcome    | credits spent        | file exists | in the deliverable | set when |
   |------------|----------------------|-------------|--------------------|----------|
   | passed     | yes                  | yes         | yes                | the job ran and every gate passed |
   | unchecked  | yes                  | yes         | yes                | the job ran and a gate could not run (no faces, no sound, no vision answer) |
   | cached     | no (an earlier run)  | yes         | yes                | the signature cache returned it (`lib/jobs.js`) |
   | flagged    | yes                  | yes         | no, until accepted | the job ran and a gate failed; `--accept` turns it into passed |
   | refused    | no                   | no          | no                 | the cap, a missing input or a missing endpoint stopped it before any call |
   | broken     | yes or partial       | no          | no                 | Magic Hour returned an error or no file |
   | simulated  | no                   | placeholder | no                 | the tool had no wired endpoint (`simulate.js`) |
   | removed    | n/a                  | n/a         | no                 | the user deleted it from the session |

   Structure that changes: `outcome` on `plan.steps[i]` (executor), on `K.made[n]` and `K.painted[id]` (pipeline), and
   on `assets[]` in the session. The tool card and the results page show the word; `done | failed | flagged` stays as
   the live state while a step runs and is replaced by the outcome when it settles.

2. **A tally line per run.** SHOW and the results page close with one line counted from the outcomes, for example
   "7 of 9 passed, 1 flagged (clip 4: drift), 1 refused (cap), 0 credits wasted". Written by code from the counts.
   The agent's words may introduce it, never produce the numbers.

3. **Soft versus hard problems in the screenplay check.** `checkScript` returns one list of errors and the writer is
   re-asked up to twice for all of them; any left stops the run. Split it: a hard error (timing off the grid, an element
   missing from a frame, a line with no speaker) is re-asked twice and stops; a soft one (a cast list that names
   someone the prompt does not, a line that could be a beat) is re-asked once, and the second answer stands. Reason: a
   guessed fix for a soft problem is worse than the shot as written, and a stop over it costs a whole run.
   Structure that changes: `checkScript` returns `{ errors, soft, notes }`; the revise loop in `pipeline.mjs` sends
   both lists, counts rounds per list, stops only on `errors`.

why:
From reading, not from a run of ours. Two things a fixed enum prevents, both seen while reading our own records: a
step refused by the cap and a step that rendered and failed its gate both read as "failed", though one cost nothing
and the other spent credits and left a file; and the closing words of a turn are the model's, so the counts in them
are not checked against anything. The soft split comes from the Director's `brain()` in Imagination Studio, which
added it after two refusals over a guessed cast stopped whole runs.

acceptance:
- every node on the live bench page and every clip on a results page shows exactly one outcome word, and the three
  facts in the table can be read from it alone (a spot check of ten items against the record);
- the tally line's counts equal the node counts on the same page, for every session of one live bench run;
- bench checks can assert `outcomes_expected` (a map of step → outcome) and at least `tool-budget-stop` uses it
  (refused, not failed);
- a screenplay with one soft problem is re-asked once and the run proceeds; one with a hard error still stops after
  two rounds (a unit test each, no credits).
Zero credits.
