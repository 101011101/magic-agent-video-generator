# T-057 · Bench grading: perceptual "unchanged", transparency shown properly, wrong tests fixed, pre-flight in the report

status:     open (drafted 2026-11-01; parts done the same day)
priority:   medium
subsystem:  bench

why:
Of the 67 failures audited on 2026-11-01, 8 were not failures at all (6 grader, 2 spec), and some fail only by a
pixel-exact reading of "leave the rest alone" that no free tool can meet (B07a).

what:
1. **Grader:**
   - transparent PNGs shown on light and dark grounds, and only when the alpha channel actually has transparent pixels (done);
   - every deliverable counted, including outputs that feed later steps and earlier turns;
   - speech judged from audio level and a transcript only when there is speech (the transcriber invents words on music);
   - denser frame sampling for clips.
2. **Specs:**
   - B10c (done) and D18c (5:3 fixture vs 16:9);
   - F30b length; J51a plan-only turn;
   - B07a and similar "unchanged" must-haves become perceptual (needs the user's OK).
3. **Report:** the bench page shows pre-flight findings, on paper vs measured per step, and the goal check (done).
   The run report counts what pre-flight would have caught.

prd changes:
- `prd/15-benchmark.md`, "How each output is graded": perceptual vs exact preservation; transparency display; the
  outcome enum (T-051).

code changes:
- `bench/v1/grade.mjs` (grounds: done; deliverables; speech);
- `bench/v1/items/*.json` (specs);
- `bench/v1/view.mjs` and `compare-view.mjs` (done).

test set changes: as above; one regrade of real-1 to measure how many failures were the grader.
