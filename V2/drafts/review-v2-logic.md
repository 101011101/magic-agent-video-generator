# V2 pipeline: review of logic errors and edge cases

Written 2026-10-30 (02:15). Read-only review of everything under `V2/src` against `V2/prd/00-overview.md` (and 03, 04, 05,
07) with the run records `V2/tests/fixtures/vanderbilt6-run.json`, `V2/runs/vanderbilt/run.json` and a copy of
`V2/runs/topgun/run.json`. No paid call was made; the OpenAI and Magic Hour keys were not used; `pipeline.mjs` was not run.
Both existing tests pass (`node V2/tests/state.test.mjs`, `node V2/tests/edit.test.mjs`).

The tree was being edited during the review. Line numbers refer to the files as they stood at 02:16:45 (state.js
`be681170`, pipeline.mjs `82f870f4`, keyframes.js `68f3ee7b`, edit.js `ccf22c9c`, jobs.js `b8a4ccd3`, media.js `a63f5a32`,
sound.js `0b9cdf89`, template.js `28eeb005`, screenplay.js `56f4236c`, results.js `65e5975b`, captions.js `3ab57e2a`,
llm.js `527139c3`, magichour.js `c1eccd53`, first 8 hex of md5). One finding I had drafted (narration files keyed by
position) was fixed by the 02:10 edit to `sound.js` and is not listed; the 02:16 edit (a dry-run branch after each paid
call, and `roomCheck` comparing against the still's own image 1) fixes none of the findings below.

Probe scripts (throwaway, runnable with `node`) are in `/Users/arviny/.claude/jobs/0c446f70/tmp/audit/`: `h.mjs` (a
synthetic element table and script builder), `probe-plan.mjs`, `probe-plan2.mjs`, `probe-crop.mjs`, `probe-crop2.mjs`,
`probe-name.mjs`, `probe-checks.mjs`, `probe-paint.mjs` (paintKeyframes with a stub painter and stub gates),
`probe-edit.mjs`, `probe-stitch2.mjs`, `probe-fps.mjs`, `probe-jobs.mjs` + `probe-cap.mjs` (Jobs.paid with a stub call,
no inputs, so nothing is uploaded or posted), `probe-results.mjs` (results.js with `fs.writeFileSync` intercepted so
nothing lands under `V2/results`), `probe-misc.mjs`. "Probe" below names the script and case that reproduces the finding.

Counts: **4 high, 14 medium, 18 low** (36 findings).

---

## High

### H1. Shot numbers are only unique within a scene, but every table is keyed by the bare number

**Where.** `state/state.js` 41 (`uses` strings), 44 (`byShot[h.n]`), 60–61 (`prev` from `h.n < s.shot` across all
scenes), 66 (`clips` from `byShot[h.n]`); `keyframes/template.js` 21 (`shots.find((h) => h.n === still.shot)` over every
scene's shots); `edit/edit.js` 43 (`K.made[c.n]`), 45 and 49 (`clips/s${c.n}.mp4`), 46 (`K.attempts["clip-N"]`);
`pipeline.mjs` 70–71, 73 (`--retry clip-N`, `--accept clip-N`); `screenplay/screenplay.js` 70–118 (`checkScript` has no
uniqueness check) and 32–57 (`scriptPrompt` never says to number shots across the film).

**Scenario.** The screenplay call numbers shots per scene. The real V2 `vanderbilt` run did exactly that (scene 1 shot 1,
scene 2 shot 1, scene 3 shots 1–2); the `topgun` run happened to number globally.

**What happens.** Confirmed on the live record: `V2/runs/vanderbilt/state.json` maps the clips of scene 1 shot 1, scene 2
shot 1 and scene 3 shot 1 all to `s3-1`/`s3-1`; every still's `prev` is null; `keyframes.txt` prompts `s2-1` (scene 2,
10–16 s) and `s3-1` (scene 3, 16–22 s) as "the whole of shot 1 (0–10 s)" with scene 1's action text, and those prompts
were painted (400 credits). Had the run reached `--until film`: `K.made[1]` is set by whichever "shot 1" the pool renders
first, the other two are skipped as already made, `stitchFilm` repeats that one clip three times with the wrong lengths,
`clips/s1.mp4` is one file for three shots, and `--retry clip-1` cannot name a shot.

**Fix.** Give shots a film-wide key (renumber globally in `writeScript` after the call, or key `byShot`, `clips`, `K.made`,
file names and the `clip-N` ids by `${scene}-${n}`), make `checkScript` error on a shot number used twice in the film, and
tell the screenplay call that shot numbers run across the whole film.

**Probe.** `probe-plan.mjs` P1 (synthetic) and P1b (the live record; `checkScript` passes it with no error).

### H2. A title card becomes the environment (image 1) of the next still in its place

**Where.** `state/state.js` 50–51 (`samePlace`/`before` include card stills), 57 (the master search, and since 02:10 the
`|| last` fallback), 58–59 (`card` is decided after `env`); `keyframes/keyframes.js` 25 (`resolve("env:<card>")` returns
`K.painted[card].file`, the black PNG), 36–37 (no boxes on a card, so the paint branch); `keyframes/template.js` 38 (the
painter is told "image 1: the scene as it stands, the place and everyone in it; nothing in it changes").

**Scenario.** A scene opens on a title card (a shot with nobody and nothing in frame and a caption in its window), then
its first real shot. With a wide card the card is found as the master; with any other size the `|| last` fallback picks it.
Only a card as the last shot of its place (the topgun run) escapes.

**What happens.** The first real still of the scene is painted from the black card instead of the plate, with the
relation sentence "Image 1 is this place as last seen, a close shot of the same instant: Alice is not in image 1", at 200
credits, and the room gate then compares it with the plate.

**Fix.** Decide `s.card` before choosing `env`, and exclude card stills from `samePlace`, from the master search and from
the `last` fallback, so the still after a card takes the plate (or the latest non-card still).

**Probe.** `probe-plan.mjs` P8 (wide card), `probe-plan2.mjs` Q1 (close card; prints the REFERENCES block), `probe-paint.mjs`
A (the stub painter receives `stills/s1-1-card.png` as image 1).

### H3. An exception after a clip is rendered kills the process while sibling renders are in flight

**Where.** `edit/edit.js` 48–59: the `try` covers only `jobs.video` (50–51); `clipEnds`, `frames`, `clipCheck` and
`transcribe` (53–56) run outside it. `transcribe` (32–36) runs ffmpeg with `execFileSync` unguarded (only the fetch has a
`.catch`). The pool (41) is a `Promise.all` of workers, so one throw rejects `makeClips`, which is awaited at top level in
`pipeline.mjs` 86. `magichour.js` 36 `fetchJob` is never called and `pending` (jobs.js 63) is never read anywhere.

**Scenario.** A clip comes back without an audio stream (a model that does not honour `audio: true`, or a failed render),
or `clipCheck`'s vision call fails after its three attempts, or returns an empty/refusal output (`llm.js` 48 parses outside
the retry).

**What happens.** ffmpeg exits 234 ("Output file does not contain any stream"), `execFileSync` throws, the module's
top-level await rejects, Node exits 1: no `finish()`, no results page, the clip is not recorded in `K.made`, and the clips
the other two workers were polling are left on Magic Hour's side with their ids in `pending` and nothing to collect them.
This is ticket T-007's scenario; the ticket says the per-item catch is built, but it does not cover the post-render steps.

**Fix.** Wrap the whole per-clip body (render and checks) in the try so a failure records `{ error }` for that clip only;
guard `transcribe` with `ffprobe` for an audio stream (or `-map 0:a?`); on start-up or before posting, look at
`pending[key]`, `fetchJob` it and download/record a completed job instead of re-posting.

**Probe.** `probe-edit.mjs` E4 (the exact ffmpeg arguments on a video-only clip: status 234). The propagation is by code
reading (`pool` → `Promise.all` → top-level await).

### H4. A non-numeric `CLEANED_CAP` removes the credit cap entirely

**Where.** `lib/jobs.js` 16 (`Number(process.env.CLEANED_CAP || 8000)`), 59 (`… + cost > CAP` is false when `CAP` is NaN).

**Scenario.** `CLEANED_CAP=3,000`, `3k`, `2000credits`, or any typo. (`""` falls back to 8000; `"0"` correctly blocks
everything; `"  100 "` works.)

**What happens.** Every paid call passes the cap check: the only spend guard silently disappears for the whole run.

**Fix.** Validate at import: `if (!Number.isFinite(CAP) || CAP < 0) throw new Error("CLEANED_CAP must be a number")`.

**Probe.** `probe-jobs.mjs` (child `probe-cap.mjs` with `CLEANED_CAP=abc`: "passed the cap check, would POST now").

---

## Medium

### M1. Degenerate people boxes produce corner crops that are then painted as "this exact framing"

**Where.** `state/state.js` 113 (any truthy box is used; the `bottom > 0` filter at 121 applies only to off-frame people),
114–118; `keyframes/keyframes.js` 38–50 (a crop under the threshold goes to the painter as image 1 with the crop prompt).

**Scenario.** The people gate's convention is "zeros if absent" (state.js 145). A master accepted with `--accept` after the
gate missed someone, or a gate answer with `top >= bottom`, or a box missing for one of two in-frame people.

**What happens.** Zero box → `{x:0, y:0, w:0.3, h:0.3}`: the top-left 30% of the master is cut and, being under
`cropDirect`, painted for 200 credits as "the same instant re-rendered at full detail". Two in frame with one zero box →
`{0,0,1,1}`: the whole master is used directly as the "medium" punch-in, so the cut shows the same picture. `top >= bottom` →
a 30% box near the bottom. A missing box for one of two → the crop frames only the other.

**Fix.** Drop ids whose box has `bottom <= top` (or `bottom === 0`) before computing; when any in-frame person lacks a usable
box, return null so the still is painted from the master.

**Probe.** `probe-crop.mjs` C2–C4; `probe-paint.mjs` B (the stub painter receives `stills/s1-2-crop.png`, box w 0.3).

### M2. The off-frame exclusion can shrink the crop through the in-frame person's head

**Where.** `state/state.js` 122 (`fits` checks horizontal centres only, ±0.05), 124–125 (`nh = nw` and `y` re-centred by
half the shrink).

**Scenario.** A punch-in with off-frame people whose gate boxes fall inside the first box on both sides.

**What happens.** Worst case found by random search: medium-wide on one person (x 51, top 3, bottom 96) with off-frame
people at x 38 and 69: the box goes from `{0.098, 0, 0.824}` to `{0.44, 0.317, 0.19}`, a 19%-wide chest crop whose top is
29% of the frame height below the top of the head. 869 of 20,000 random crops put the crop top below an in-frame head;
2,644 leave an in-frame centre within 5% of a crop edge (half a body cut).

**Fix.** Keep the vertical anchor when shrinking (`y = max(0, top - 0.06)` rather than re-centring) and refuse a shrink whose
height no longer covers `top - 0.06 … top + keep·h` (fall back to painting from the master).

**Probe.** `probe-crop.mjs` C8 (counts and examples), `probe-crop2.mjs` (worst case).

### M3. A shot whose first frame is a card and whose last frame has people is rendered as a static card

**Where.** `screenplay/screenplay.js` 92 (the card note is only for `first`; both frames are checked separately, so
first-empty-with-caption plus last-with-people passes); `state/state.js` 43–44 (two stills), 58 (the start still is a card);
`edit/edit.js` 44–45 (`K.painted[c.start].card` alone selects the static branch; the end still is ignored).

**What happens.** Card start, painted end: a 4-second static title card, the painted end frame never used (and its 200
credits wasted). Painted start, card end: image-to-video is asked to animate a scene into a black card.

**Fix.** In `checkScript`, require both frames of a card shot to be empty (error otherwise); in `makeClips`, branch on both
stills being cards.

**Probe.** `probe-checks.mjs` K9 (passes with a note), `probe-edit.mjs` E1 (both directions).

### M4. Returning to a place with a changed cast paints from the old master as "this same instant, nothing changes"

**Where.** `state/state.js` 46–47 (the comment says "when the blocking has not changed"; the code at 50–51 has no such
test, and the ternary's two branches yield the same set), 57; `keyframes/template.js` 38 (master branch: no CHANGES block);
`state.js` 100–105 (`relation`: "the wide view of this same instant").

**Scenario.** Scene 1 in the parlour with Alice and Ben; scene 2 elsewhere; scene 3 back in the parlour, later, with Alice
alone, from a new camera.

**What happens.** The scene-3 still is painted from the scene-1 wide with REFERENCES "the place and everyone in it; nothing
in it changes. Image 1 is the wide view of this same instant: Alice is the one at the left of image 1" while PEOPLE says
"exactly 1 in frame". The painter has to choose between two instructions. (With the same camera the edit branch lists
"Ben leaves the frame" correctly.)

**Fix.** When `env` comes from another scene, add a CHANGES block to the master branch (a `deltas` of env.frame vs
still.frame) and drop "nothing in it changes"; or only reuse another scene's stills when its last frame equals this
scene's blocking, else start from the plate.

**Probe.** `probe-plan.mjs` P2.

### M5. The new `|| last` fallback paints a single from a single, while the rule text still says never

**Where.** `state/state.js` 54–57 (added 01:54–02:10) versus the module rule at 11–13 and `refs` at 84 ("painted from the
widest recent view of the scene, never from a single"); `relation` 101 ("this place as last seen, a medium-close shot of
the same instant"); PRD `04-state.md` environment rule.

**Scenario.** Any place whose first still is not a wide or medium-wide: a scene opening on a medium-close of Alice, then a
close of Ben from a new camera.

**What happens.** Ben's close is painted from Alice's medium-close with Ben's portrait: the composition-kept, man-swapped
case that produced the vanderbilt6 head swap and the rule. The comment says this is for cockpits that are only ever close;
the code applies it everywhere, and `refs`' "why", the module header and the PRD now describe a rule the code no longer
follows.

**Fix.** Limit the fallback to places with no people in the latest still (or to a place whose plate is a cockpit-like
interior flagged in the element table), else paint from the plate with the portraits; update the texts either way.

**Probe.** `probe-plan2.mjs` Q2.

### M6. An orphaned job is never reconciled; the next run pays again and loses the orphan's id

**Where.** `lib/jobs.js` 53–69 (`jobs[key]` is written only after a successful download; the charge is booked at 65 before
it, good), 63 (`pending[key]` written), 74; `lib/magichour.js` 36 (`fetchJob` has no caller); nothing reads `pending`.

**Scenario.** Poll timeout, a download failure, or the empty-download throw at 67 after the job completed and was charged.

**What happens.** The ledger is now right, but on the next run the same key has no `jobs[key]` record, the signature check
misses, a new job is posted (charged again) and `pending[key]` is overwritten with the new id, so the orphan can no longer
be found. The overview's promise that a run "can resume without paying twice" holds only for the download-succeeded path.

**Fix.** In `paid`, before posting: if `pending[key]` exists, `fetchJob` it; if complete, download and record it as the
result; if failed, delete it and mark the earlier `calls` entry; also on `calls` entries with an id and no `jobs` record.

**Probe.** Static (grep: no reader of `pending`, `fetchJob` unused).

### M7. `--retry` of a still that was a crop used directly does nothing

**Where.** `keyframes/keyframes.js` 33 (the attempt suffix), 36–46 (the crop is recomputed from the same master with the
same box and used directly again); `pipeline.mjs` 71; `lib/llm.js` 16–21 (the cache key hashes the re-encoded JPEG, which is
byte-identical).

**What happens.** `stills/s1-2-r1-crop.png` is the same bytes as `stills/s1-2-crop.png`, the people gate's cached answer
is returned, the still is flagged again, nothing is painted. The only ways out are `--accept` or `--crop-direct 1.1`.

**Fix.** When `K.attempts[s.id]` is non-empty, skip the direct-crop path (paint from the crop, or from the master).

**Probe.** `probe-paint.mjs` D (`sameBytes: true`, `sameJpgHashForLlmCache: true`, the painter never called).

### M8. The sfx wrong-slot detector errors on legitimate effects

**Where.** `screenplay/screenplay.js` 108: `/narrat|voice-?over|\bsays?\b|["“”]/` on every `sfx` text, as an
error that stops the run (exit 1).

**What happens.** "the narrator's chair creaks", "a narrative swell of strings", `the "click" of a latch`, "a man says
nothing, a door slams" all stop the build; the remedy is a new screenplay. ("a voice calls from the quay" and "Says the
bell" pass.) The action rule at 109 is a note and requires a 12-character quote; the sfx rule has neither safeguard.

**Fix.** Make it a note, or require a quoted sentence (`["“][^"”]{12,}["”]`) and whole words
`\b(narration|narrator|voice-?over)\b`.

**Probe.** `probe-checks.mjs` K2.

### M9. The film's frame rate comes from the first clip, so a film that opens on a title card drops frames

**Where.** `lib/media.js` 28, 32–33 (`rate = fps(parts[0])`, comment: forcing 24 on 30-fps clips "dropped one frame in five
and juddered"); `edit/edit.js` 45 (card clips are made with `-r 24`).

**What happens.** Card first, 30-fps clip second: the film is 24 fps and the 30-fps part goes from 90 to 72 frames, the
judder the comment describes; clip first: 30 fps, no loss.

**Fix.** Take the rate from the first non-card part (or the maximum over the parts), and render cards at that rate.

**Probe.** `probe-fps.mjs`.

### M10. A title card's caption is shown twice

**Where.** `edit/edit.js` 68 (every scene caption is overlaid from `at` for up to 4 s) and `keyframes/keyframes.js` 12, 31
(the same caption is painted into the card).

**What happens.** The card shows the text centred, and the overlay shows it again at the top, for 4 s (beyond the card's
2 s into the next shot).

**Fix.** Skip the overlay for captions whose window is a card shot, or shorten it to the card's seconds.

**Probe.** `probe-edit.mjs` E8.

### M11. `K.painted` is keyed by still id, but ids change meaning when the plan changes

**Where.** `keyframes/keyframes.js` 30 (`if (K.painted[s.id]) continue;`); `pipeline.mjs` 67; ids are positional
(`state.js` 40).

**Scenario.** The same run label re-run with `--reactions` (or after `L.script` is deleted and rewritten).

**What happens.** On the vanderbilt6 plan with `--reactions`, `s1-4` changes from the Vanderbilt close to the Lincoln
reaction frame and `s1-5` from the three-shot to the Vanderbilt close; the existing painted files are reused under the new
meaning, no repaint, wrong pictures in the clips.

**Fix.** Record the still's dedup `key` (or a hash of frame + camera + place) in `K.painted` and treat an entry whose key
differs as not painted (move it to attempts).

**Probe.** `probe-misc.mjs`.

### M12. Dependants of a still flagged later keep their frames, and their clips proceed

**Where.** `keyframes/keyframes.js` 30 (painted short-circuit) before 32 (`envFlagged`); `edit/edit.js` 44 (a clip checks
only its own two stills); `pipeline.mjs` 74 (`--recheck` can flag a master after its dependants were painted).

**What happens.** After `--recheck s1-1` flags the master, `s1-2` (edited from it) stays "ok", the run exits 2 naming only
`s1-1`, and `--accept s1-1` then lets the dependants and their clips through without anyone re-examining them; the PRD's
"a flagged still stops its chain" holds only at paint time.

**Fix.** In `paintKeyframes` (or at the end of `--recheck`), mark `K.painted[d].bad`/`stale` for every dependant of a flagged
still, and have `makeClips` check `envFlagged` for both stills.

**Probe.** `probe-paint.mjs` C.

### M13. `--recheck` applies the room gate to title cards and to stills painted from a crop

**Where.** `pipeline.mjs` 74 (`p.cropped && !p.prompt` skips the room gate only for a crop used directly, and passes no
`against`); `keyframes/keyframes.js` 53 (paint-time skips it for `mode === "crop"` and, since 02:16, compares against the
still's own image 1, `K.painted[env].file`); `state/state.js` 154–155 (`against` falls back to the plate when absent);
cards have neither `cropped` nor `prompt` checks.

**What happens.** A card is compared with the plate ("same room?") and flagged, blocking its clip until `--accept`; a still
painted from a crop gets a gate at recheck it never had at paint time; and every edited or master-based still is rechecked
against the plate although it was painted and gated against its env, so recheck and paint disagree twice over.

**Fix.** Skip the room gate when `p.card` and when `p.mode === "crop"`; pass the same `against` (the env's file) that
paint time used.

**Probe.** Static (one line).

### M14. A clip without an audio stream breaks the film in three ways

**Where.** `lib/media.js` 33–35 (`-af aresample` on a silent part is ignored; concat `-c copy`); `sound/sound.js` 31–32
(`[0:a]`); `pipeline.mjs` 94 (uncaught).

**What happens.** If the first part has no audio the film has no audio track and `mixNarration` throws
("Stream specifier ':a' … matches no streams"), uncaught after the stitch, exit 1 with no results page; if a later part has
none, the film's audio ends early and `amix duration=first` cuts the narration at that point. wan-3.0 returns audio; other
`--model` values (audio is an extra on kling and veo per `07-edit.md`) may not.

**Fix.** In `stitch`, add `-f lavfi -i anullsrc` and `-shortest` (or `-map 0:a?` with a silent fallback) so every part has
a 48 kHz stereo track; in `mixNarration` check for an audio stream first.

**Probe.** `probe-stitch2.mjs`, `probe-edit.mjs` E5/E6.

---

## Low

### L1. `name()` labels are not unique and can throw
`state/state.js` 70. Two props named "Harrow" both become "the frigate Harrow"; two characters "Ben" both "the character
Ben"; a single-word character sharing a word with a place becomes "the character Vega"; a prop whose look has none of the
listed nouns is "the object Vanderbilt"; an element without `look` throws `TypeError` (reading 'match'). Fix: when the
qualified label still collides, add the id or a look word; guard `look`. Probe: `probe-name.mjs`. (On the live record
`steamship-vanderbilt` → "the steamship Vanderbilt" and the room gate accepted it.)

### L2. `--max` below the grid minimum makes an empty grid
`screenplay/screenplay.js` 34, 71, 84; `pipeline.mjs` 25. The prompt says "seconds must be one of " and every shot then
errors "not on the grid ()" after a paid-nothing but minutes-long screenplay call. Fix: throw before the call when the
grid is empty. Probe: `probe-checks.mjs` K1.

### L3. `declared()` substring rule
`screenplay/screenplay.js` 72–76: `w.includes(v)` with short vocabulary entries (ids such as `rook`) declares "a brook" and
"the crooked door". Notes only. Probe: `probe-checks.mjs` K4.

### L4. Two lines at the same second give a zero-length subtitle
`lib/captions.js` 39–40: the first line gets `to === from` (one frame). Fix: on tied `from`, join the texts or split the
window. Probe: `probe-edit.mjs` E3.

### L5. `policySafe` gaps
`edit/edit.js` 19, 30: the CAST line of a person who "enters during the shot" has no "third at the start", so the feature
line survives the policy-safe resubmission; the first regex is not anchored to the CAST block (it rewrote a BEATS line that
happened to contain "; left third at the start"). Fix: match `; (enters during the shot|(left|centre|right) third at the
start.*)$` and apply only between CAST and the next header. Probe: `probe-edit.mjs` E2.

### L6. Argument parsing
`pipeline.mjs` 22–26: `--retry --accept s1-1` gives `RETRY = ["--accept"]`; `--until pain` (not in ORDER) silently stops
after the story (`upto()` is false for every stage); a valued flag given last yields `undefined` (brief becomes undefined);
`--max abc` is NaN. Fix: validate `--until` against ORDER, reject values beginning with `--`, Number-check. Probe: inline
(`probe-misc` run output).

### L7. Results page labels
`results.js` 28: a crop used directly shows "INPUT · as sent" (keyed on `used`, not on a job) with the never-sent paint
prompt and the planned refs; the "(a crop of the master; no prompt, nothing painted)" text is unreachable because
`pl.prompt` is always set. Line 17: the attempts strip lists `-crop.png` sources and `-card-text.png` layers as attempts
(topgun `s7-7` shows the transparent text layer). Line 10/20: `esc` leaves quotes, so a source URL containing `"` breaks the
`href`. Probe: `probe-results.mjs`; the topgun `stills/` listing.

### L8. Card retries and records
`keyframes/keyframes.js` 31: a card is always `stills/<id>-card.png` (no attempt suffix), so `--retry` overwrites it and
`attempts` points at the overwritten file; the `-card-text.png` layer stays in `stills/`; `state.js` 174 records a card as
`from: "plate"`. Probe: `probe-paint.mjs` G.

### L9. The dedup key ignores the scene's time and interior flag
`state/state.js` 38: a DAY scene and a NIGHT scene in the same place with the same camera and frame share one still.
Probe: `probe-plan.mjs` P10.

### L10. `visible` outside the three values is silently "off right"
`screenplay/screenplay.js` 11, 18 (schema-only); `state.js` 90. A hand-edited `"offscreen"` passes `checkScript` and is
reported as off right. Probe: `probe-plan.mjs` P7.

### L11. The upload cache keeps a rejected promise
`lib/jobs.js` 62: after one failed upload of a file, every later job that uses it fails immediately for the rest of the
process. Fix: `delete this.uploads[h]` on rejection. Probe: `probe-jobs.mjs`.

### L12. The ledger is read-modify-write without a lock across labels
`lib/jobs.js` 25–27, 58–59. The new per-run `.lock` (`pipeline.mjs` 29–30) stops two processes on one label, but two labels
share `ledger.json`: interleaved `book()` calls can lose an update or leave a torn file that makes the next `ledger()`
throw, and the cap check cannot see the other process's reservations (joint overshoot of up to one job each). Fix: a lock
file around the cap check and `book()`, or write via rename. Static.

### L13. Silent no-ops in the review flags
`pipeline.mjs` 69–73: `--retry`/`--accept` on an unknown id does nothing and says nothing; `--accept` flips `K.painted[id].bad`
but `L.stills[id].gate` in `state.json` stays "flagged". Static.

### L14. `--parallel 0` or a non-number
`edit/edit.js` 41; `pipeline.mjs` 25, 90: no worker is started, every clip is "waiting", and the run prints "not stitched;
rerun with --retry  or --accept ". Probe: `probe-edit.mjs` E7.

### L15. `named()` now rewrites fixture and place ids inside prose
`keyframes/template.js` 19 (changed 01:54): with the vanderbilt6 fixture (`doorway` → "doorway at left") "at the doorway"
becomes "at the doorway at left"; any fixture id that is a plain word is rewritten wherever it occurs. Probe:
`probe-misc.mjs`.

### L16. `JSON.parse` of the model output is outside the retry
`lib/llm.js` 46–48: an empty or refusal output throws at once (no retry); with H3 this ends the process during clips.

### L17. `CROP_DIRECT` is 0.5 in code and 60% in the PRD and T-001
`keyframes/keyframes.js` 16; `pipeline.mjs` 26; `05-keyframes.md`, `04-state.md`. Documentation mismatch.

### L18. Continuity notes stop at scene boundaries; narration words count against the shot
`screenplay/screenplay.js` 81 (`prev = null` per scene, although the prompt asks for word-for-word continuity across
cuts), 103 (`vo` words add to `need` although narration is not performed in the clip). Notes only. Probe:
`probe-checks.mjs` K5.

---

## Checked and found sound

- `llm.js` cache key: model, name, schema, prompt, effort, tools, salt and the re-encoded JPEG bytes of each image; the
  encoding is deterministic, so an overwritten still with new pixels gets a new key and identical pixels share one (the
  mechanism behind M7, correct in itself); `still-check-boxes` on a repainted file of the same name is not stale.
- `jobs.js`: the signature is spec plus content hashes, so a changed input under the same name re-runs; `reserved` is
  released in `finally` (0 after a throw in the probe); `CLEANED_CAP=0` blocks every call; since 02:10 the charge is booked
  before the download and an empty download throws; `start === end` uploads the file once.
- `magichour.js`: a POST is never retried; GETs retry three times; `onCreate` records the id before polling.
- `cropFor`: equal fractions keep the source aspect (the stills are 2752×1536 and the crop is scaled back to the source
  width); `need` guarantees width ≥ span + 0.3; no rounding overshoot in 20,000 random boxes, and ffmpeg's crop filter
  clamps a box that does overshoot (C9); several off-frame people are handled in turn; an "off left" person the gate places
  on the right is ignored; the current code excludes Stanton in the live `s3-1` case (box 0.31/0.57; the recorded 0.23/0.65
  predates the exclusion loop).
- `plan()`: first and last frames differing only in `doing` share one still unless `--reactions`, and are held when the
  shot has no action and no changes; a person entering mid-shot gives an edit with "enters the frame" and a portrait; a
  props-only frame is not a card and a props-only punch-in is painted (never cropped), with the prop picture when the
  frame is two sizes closer; a scene with no shots survives the pass (and errors in `checkScript` unless its seconds are 0);
  the caption window `[start, end)` is the same in `checkScript` and `plan`; `same_as` copies the camera within the scene.
- `refs`/`carried`: the plate branch sends every portrait and prop picture; the two-sizes rule; props without a bank file
  are listed under PROPS without an image and never resolved; cards return only the card ref.
- `checkScript`: scene and shot arithmetic (gaps, overruns, the film total), beats inside `[start, end)` including `vo`,
  presence of every blocking id in both frames, duplicates, `same_as` earlier in the scene, prop continuity notes.
- `edit.js`: attempt file names (`-r1`, `-p`, `-r1-p`, `-first/-last`, `-fNN`) are distinct; `policySafe` keeps names and
  positions for ordinary CAST lines; subtitles are non-overlapping apart from L4; `mixNarration` accepts mono TTS files,
  overlapping lines and a line beyond the film's end (truncated by `duration=first`, no error); `burnCaptions` with no cards
  copies; captions go to the top when subtitles are on.
- All ffmpeg and osascript calls use `execFileSync`/`spawnSync` argument arrays (no shell quoting); filter strings with
  quotes are passed verbatim.
- `results.js`: `kindOf` labels crop files and bank files correctly; backticks and `${` in prompts are inert inside the
  generated `<pre>` (the template literal is not re-evaluated); `jobOf` is per run; `writeResults` handles `state === null`
  and an empty plan.
- `pipeline.mjs`: `finish()` with `state` null; exit codes 0 (done), 1 (script errors), 2 (review), 3 (lock); `--reuse` with
  an old run lacking `elements` or the mapped id falls through to Commons/generation; the per-run lock ignores a dead pid.
- `sound.js` (02:10): narration files keyed by text, voice and instructions.
- `State.record`/`save`, `describePlaces` caching by image content, `peopleCheck` order rule, `clipCheck` with keyed frames
  (02:10), `roomCheck` with the expected props.
