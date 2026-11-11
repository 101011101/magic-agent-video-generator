# runs — raw results

One folder per run label, written only by the pipeline. Nothing here is edited by hand; the pages in `../results/` are
regenerated from these folders.

```
runs/<label>/
  run.json            the run record: brief, mode, research, story, elements, medium, bank, cast lines, voices, screenplay,
                      the plan (stills and clips with their prompts and references), every job (prompt, inputs, credits),
                      every call, gate results per attempt, the summary
  state.json          the state manager's tables: elements, places with fixtures, stills, clips
  shooting-script.txt the screenplay as text, for reading
  frames.txt          every keyframe prompt as assembled, with its images and what it is painted from
  clips.txt           every clip prompt as assembled
  refs/               reference pictures procured from Wikimedia Commons (with provenance in run.json)
  roots/              generated references: character sheets, plates
  stills/             painted keyframes; every attempt is kept: s1-3.png, s1-3-r1.png, s1-3-r2.png …
  clips/              rendered clips (s1.mp4, s1-r1.mp4 …), the sampled frames the clip gate looked at, the stitched film
                      (film-raw.mp4, film.mp4 with captions and subtitles), caption and subtitle cards
```

The credit ledger across runs lives beside the run folders as `ledger.json`; `CLEANED_CAP` is checked against its total
before any paid call.

A run folder can be resumed: every paid job is cached by the signature of its prompt and inputs, so rerunning the same
command pays nothing for what already exists and continues from the first missing item.
