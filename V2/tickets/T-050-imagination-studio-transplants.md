# T-050 · Candidate transplants from Imagination Studio (third-party review)

status:     open (ideas under discussion, nothing decided; 2026-11-01)
priority:   medium
subsystem:  edit, lib, agent, bench, results

what:
A review of github.com/drowzeys/Imagination-Studio-by-keys-Wasserman (a local-GPU film studio in Python; read at
commit 0c1244c, 2026-10-30; code read, nothing run). Its stack does not transfer (Metal and DGX Spark engines, local
weights, no cost model, agency outsourced to coding CLIs). Five small pieces might. Each is a candidate, not a plan;
pick from this list in conversation and split what is chosen into tickets of its own.

1. **Cut-inside-a-shot detection and the longest clean window** (`app/shot.py`, pure numpy + ffmpeg, ~150 lines).
   Grey frames at 160 px wide; a hard cut is a frame pair whose correlation is under 0.70 AND whose change is 1.75× the
   median change of the six frames on each side. `window()` returns the longest stretch without a cut (start, end,
   seconds) for the trim step. Also measures whether the first and last frame match the pinned stills (mean grey
   difference ≤ 12 of 255 and correlation ≥ 0.90).
   Where we stand: `lib/media.js clipEnds` already measures first_vs_start and last_vs_end by SSIM, but the number is
   reported on the results page only; no threshold, no flag. We have no cut detection at all.
   Structure that changes: a `cuts` field and a `window` field on the clip's `qa` record (`K.made[n].qa`); a threshold
   on `first_vs_start` / `last_vs_end` that sets `flagged`; a zero-credit `inspect` tool (`tools/shot-check.js`) so the
   agent can run it on any clip, and `assemble` can trim to the window. Thresholds must be recalibrated on wan-3.0 and
   kling-3.0 output; theirs come from one FastH3 run (32 clips, 24 fps, 1280×736) and they say so.

2. **Beat-aligned assembly** (`app/beats.py` ~300 lines numpy + ffmpeg; `app/roughcut.py plan()` 45 lines of arithmetic).
   Beats: STFT 1024/256 at 22.05 kHz, 40 mel-like bands, onset strength = positive dB rise per band summed, low-band
   (<200 Hz) curve for the downbeat, tempo by autocorrelation with the 4-beat lag counted in and a lean to 120 BPM,
   beats by dynamic programming with a log-gap penalty, sub-frame refinement by parabola, downbeat = the phase of four
   where the low end hits hardest. Output {bpm, beats[], downbeats[], confidence}, cached as a sidecar JSON.
   Planner: song time = timeline time; grid = beats | bars | two bars; each clip ends on the first grid point ≥ half a
   slot ahead (or, `natural`, on the last beat inside its own length); a clip shorter than its slot keeps its length and
   the next cut snaps again; boundaries rounded to whole frames; clips past the song end are dropped. Optional
   ordering by motion energy (mean frame change at 6 fps, 32×18 grey).
   Where we stand: `tools/assemble.js` concatenates in order with equal shares of `seconds` and lays the sound under;
   no beat grid. `lib/media.js stitch` likewise.
   Structure that changes: a `cut` parameter on `assemble` (`none | beat | bar | two-bars | natural`, default none) and
   an `order` parameter (`given | energy`); a `beats` helper (Python sidecar or a JS port) with the sidecar cache;
   `plan()` ported to JS inside assemble. Zero credits. Cases to add: a reel from photos to a track, an ad to a cue.

3. **Honest and exact scoring, and rescore** (`scripts/agent-bench/bench.py score()`).
   honest = the final reply names no file that does not exist AND names every job or output that was made (path, file
   name, or id); exact = complete AND every named setting matches AND nothing extra was made, with an unstated setting
   scored as the default (one picture asked, four made → fail). `--rescore` re-scores saved transcripts after a
   scoring change without re-running.
   Where we stand: `bench/run.mjs` and `bench/live.mjs` check questions, tools, references and money; nothing checks
   the agent's closing words against the record, and a scoring change means a re-run.
   Structure that changes: two checks in `check()` over `t.plan.steps[].output` and the agent's `say`; a `--rescore
   <results dir>` mode on both runners.

4. **A fixed outcome vocabulary and a run tally** → moved to T-051 (`app/director.py OUTCOMES`, `summary()`).
   Eight values, each fixing three facts at once (credits spent? file exists? in the output?): passed, unchecked, kept,
   failed, refused, broken, stopped, removed. The run closes with one line counting them.
   Where we stand: nodes carry done | failed | flagged, which conflates "refused by the cap, nothing spent" with
   "rendered and failed the gate, credits gone". T-049's step checks add reasons but not the enum.
   Structure that changes: an `outcome` enum on the step record and on `K.made[n]`, derived by code from state, cap
   result, gate result and cache hit; `SHOW` writes the tally from the counts, never from model prose; bench asserts on
   outcomes. Our set would be: passed, unchecked, cached, flagged, refused (cap), broken (job failed), simulated,
   removed.

5. **Soft versus hard validation problems** → moved to T-051 (`director.brain()`, class `Soft`).
   A hard problem is re-asked up to twice and stops the run; a soft one is asked once and the second answer is taken
   as it is, because a guessed fix is worse than the shot as written and two refusals would stop the whole run.
   Where we stand: `pipeline.mjs` re-asks the screenplay writer up to twice for every error and stops on any left.
   Structure that changes: `checkScript` returns `{errors, soft}`; the revise loop sends both, stops only on `errors`.

Not taken, and why: the CLI harness and ssh plumbing (`agents.py`, 3,900 lines, 80 % of it sign-in and transport);
the local-model tool loop (a fallback for them, we have no free tool loop); auto retake at the next seed (spends
without asking; our rule is flag only, prd/11-agent.md line 25); the Slate writing stage (we have story and
screenplay); revise.py restyle/extend/fix (depth layer + Ref2VA on local models); the MCP server; FCPXML/EDL export;
their audio gate (≥2 words and ≥60 % of the prompt's line heard: a heuristic we would not want as a gate).

why:
No run of ours showed these failures yet; this ticket comes from reading another codebase that met them, not from a
run. The classes are: music-led cases (reels, ads to a cue, UGC with a track) end as "clips concatenated under a
song", and a cut off the beat reads as sloppy; a pinned clip that opens on another frame or cuts inside the shot has
nothing to flag it here (the SSIM figure is printed, not thresholded); a closing message that names a file that does
not exist passes every check we have. Items 1 to 3 answer those; 4 and 5 are hygiene. Before building 1 or 3, look
for the failure in our own records first (the clips of past runs, the live bench transcripts).

acceptance:
Per item, when it is picked up:
1. the shot check runs on the clips of one past run (vanderbilt, the live film session) and its cuts and held-frame
   verdicts agree with a human look on ≥ 9 of 10 clips; thresholds written down with the run they came from.
2. a reel of 8 photos and a 30 s track assembled with `cut: bar` has every cut within one frame of a downbeat; the
   `natural` mode keeps each clip within 10 % of its own length.
3. the two checks run on the last live bench results; the honest check fails at least the turns we know named a
   missing file; `--rescore` reproduces the saved totals before any scoring change.
4. every node on the bench page shows one outcome word; the tally line's counts equal the node counts.
5. a screenplay with one soft problem is not re-asked twice.
Zero credits for 1, 3, 4, 5; item 2's cases run on the free tier under the usual cap.

reference: the clone read for this review sits in the session scratchpad (third-party/repo); the summary of the
comparison is in the conversation of 2026-11-01.
