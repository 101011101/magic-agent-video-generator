# tests — small runnable checks

Run them all from the repository root, or any one of them:

```
node V2/tests/run.mjs            # every *.test.mjs, one line each, one total; exit 1 if any failed
node V2/tests/<name>.test.mjs    # one file; each "ok" line is a check
```

They spend no credits and make no model calls; everything they need is in `fixtures/`.

| fixture | what it is |
|---|---|
| `fixtures/vanderbilt6-run.json` | a real run record: the brief, research, story, elements, bank entries, the v2 screenplay "An Outright Gift" with tone, moment and doing, the cast lines, the KF2 plan, the painted stills' gate results, the clip records |

What the scripts check, by subsystem:

- **screenplay**: the schema builds from the fixture's elements; `checkScript` passes the fixture's screenplay (timing on
  the grid, every element in every frame, thirds only with an action, beats inside shots) and fails deliberately broken
  copies (an 11-second shot, a missing person, a third change without an action).
- **state**: the single pass over the fixture's screenplay produces the expected stills (five distinct frames for six shots,
  shots 2, 4 and 6 sharing the Lincoln single), the expected environment references (plate, edit, master; never a single as
  the base of a new setup), the expected off-frame sentences and relation sentences.
- **keyframes**: the template renders the fixture's frames to prompts that contain no walls, light, camera-position or
  fixture prose, name a portrait only where the state manager says, and say "exactly N people" with N from the frame.
- **edit**: the clip prompt carries CAST lines with features, seconds relative to the clip, and the policy-safe variant
  strips features and keeps the lines verbatim; subtitles from the lines land at 4.0–8.8, 9.0–15.0, 17.0–20.6, 21.0–27.8,
  28.0–29.6 s for the fixture.
- **lib**: the duration grid per model; the job signature changes when a prompt or an input changes and not otherwise.
- **audit** (`audit.test.mjs`, synthetic elements and scripts, ffmpeg for the media cases): the edge cases the 2026-10-30
  logic review found and the code now handles: shot numbers renumbered across the film and repeats refused; a title card is
  a whole shot and never the next still's image 1; `visible` outside its enum; the sfx rule (quoted sentences and the words
  narration or voice-over are errors, a bare "says" a note); a return to a place with the cast changed lists who is gone
  and what changed, while a punch-in with people merely off frame does not; no crop from degenerate boxes and no shrink
  through the head; day and night scenes are different stills; labels never throw and never collide; `policySafe` touches
  only CAST; tied subtitle lines share a card; the bars gate (thin bars noted, 5% flags); the stitch takes the highest frame
  rate, gives a silent part a track and crops thin bars; a non-numeric `CLEANED_CAP` refuses to load; a clip built on a
  flagged still waits; a written camera move is an error and an old script's scene music is lifted to the film header;
  references are capped at four with worn and attached things dropped and no image numbers in the element lines; the
  master is the wide sharing the most elements; the music bed mixes under a film with a duck window and an arc cut.

A test prints what it checked and exits non-zero on the first failure. Add a fixture rather than calling a model.
- **execute** (`execute.test.mjs`, a picture made by ffmpeg, the cap set from the ledger so nothing reaches Magic
  Hour): a code tool that throws fails the step with the tool's words and the run goes on without crashing; a step
  whose input is missing is refused before any call; an unwired tool writes a placeholder marked simulated; the cap
  refuses a 120-credit clip with the figures; a bare text in `inputs` is moved into the prompt; the paid gate refuses
  before reserving, releases a reservation when the provider fails and records the error, returns a cached result
  without a call, and lists costs in estimate mode. Its `note` lines record what the executor does where T-051 is
  still open: an independent step after a failure is left "proposed", a dependent one "waiting", a cap refusal and a
  tool error are both "failed", a placeholder is "done".
- **execution** (`execution.test.mjs`, against `fake-magichour.mjs`: a stand-in Magic Hour on 127.0.0.1 that answers
  the client's routes at once, hands back real small media, charges the catalogue's credits, and can be scripted per
  route to error, stay queued for n looks, return an empty download, or refuse an upload; a temporary ledger through
  `CLEANED_LEDGER`, the fake through `MAGIC_HOUR_BASE`): the happy chain picture → clip → crop with the bodies, the
  one upload, the charges per step, the ledger and exec.json as they should be; the same plan again is two cache hits;
  a provider error fails the step, charges nothing, leaves the job pending, and the rerun resumes it, reads the error
  and posts anew; a job whose poll died is resumed with one charge and no second post; the cap halfway through a
  plan; a slow job polled twice; an empty download that was charged; a failed upload that posts nothing; a face swap
  in all-faces mode with two uploads; music and captions priced by the seconds. About ten seconds, no network beyond
  localhost. Its `note` lines: a resumed step shows 0 credits while the ledger took the charge; "failed" covers both
  an unpaid refusal and a paid job with no usable file.

