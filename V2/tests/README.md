# tests — small runnable checks

Run any of them from the repository root:

```
node V2/tests/<name>.mjs
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
