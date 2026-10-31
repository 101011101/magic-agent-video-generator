# T-031 · The benchmark: a fixed set of briefs run every time, scored by the gates

status:     open
priority:   high
subsystem:  results, lib (a new `V2/bench/`)

what:
A test set that runs on every change and says whether the system got better or worse, in numbers, on the free tier.

1. **The cases**, `V2/bench/cases/<id>.json`: the brief, the tier (free by default), the answers to T-030's questions
   (so no case waits on a human), the tool or kind expected, and the checks. First set, one per kind of request the
   feedback named:
   - `ad-topgun`: the Top Gun brief, 30 s, 16:9 (the film chain);
   - `drama-vanderbilt`: the Vanderbilt brief (fact mode, Commons references);
   - `short-9x16`: a 15 s product short for TikTok (portrait, captions in safe margins);
   - `podcast-2min`: T-032;
   - `image-one`: one image from a sentence;
   - `image-edit`: change one thing in a supplied picture;
   - `swap-face`: a face or character swap on a supplied clip;
   - `captions`: subtitles on a supplied clip;
   - `ask-first`: a brief that cannot be made without two questions; the check is that exactly those questions are
     asked and nothing is paid;
   - `follow-up`: a second message on a finished run ("make the ending darker") that must change only the frames it
     names and pay only for them.
   Agentic-loop cases, zero or near-zero credits, checked on the transcript rather than the picture:
   - `chain-3`: "make a picture of X, then put it on a mug, then animate it": three tools in order, each fed the last
     result, one question at most across the whole chain;
   - `refer-back`: four messages where "it", "the first one" and "the ending" must resolve to the right asset in the
     session;
   - `confident-infer`: a message that states nothing about platform but says "for TikTok captions": the sheet infers
     9:16 above the threshold and asks nothing; the reply shows the inferred value;
   - `budget-stop`: a request whose estimate exceeds the cap: the agent states the cost, stops, pays nothing;
   - `tier-up`: a request that needs references in image-to-video: the agent names the paid model it would need, the
     cost, and waits for a yes;
   - `wrong-tool`: a message the planner is likely to misroute (an "edit" that is really a new image): the check is the
     tool chosen and the question asked.
   The cases are in `V2/bench/cases/` (written 2026-10-31, twenty of them in three groups: extraction, source, tools)
   with `V2/bench/README.md` saying how they run: a **proxy user**, a text model holding the case's answer sheet, answers
   only what the agent asks; the transcript and the agent's sheet are then checked against the expectations.
2. **The checks** come from the gates that exist: people, room, geometry, load, style, bars, the clip gate, the
   screenplay checks; plus per case: questions asked, tool chosen, credits spent against a cap, wall time, and for
   images and swaps a vision check against the instruction. Each check is pass/fail with a number where there is one
   (first-attempt pass rate per gate, retries per still, SSIM of clip ends to stills).
3. **The runner**, `node V2/bench/run.mjs [--case id] [--tier free] [--paid]`: runs the zero-credit cases (`ask-first`,
   `--until screenplay` on every film case) on every change; the paid cases on demand under one cap for the whole set.
   Writes `V2/bench/results/<date>-<short sha>/index.html` (every case with its output, checks and cost) and
   `scores.json`; `V2/bench/README.md` keeps the trend table, one row per run, and the last run's outputs are the
   examples we show.
4. **A diff**: `node V2/bench/compare.mjs <run a> <run b>` (from `src/compare.js`) puts two runs of the same case side by
   side with the checks that changed.

why:
The feedback of 2026-10-31: "you should be creating a benchmark of test sets that you run every time. I haven't seen
anything like that." Today `V2/tests/` are unit checks on one fixture and the only measure of a change is one person
looking at one film. The gates were built for exactly this and are not wired to a fixed set. The original repo had a
capabilities matrix test and ten video cases (`evals/`, still named in the gitignore, gone from the tree).

acceptance:
The ten cases in the tree with their checks; one full run on the free tier at or under about 2,500 credits (the film
cases are the bulk, about 1,000 for the ad at 480p); the results page and the trend row; then a second run after one
change (for example T-030) showing the diff. The zero-credit subset finishes in under five minutes and runs before
every commit that touches `V2/src`.
