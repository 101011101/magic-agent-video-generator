# Review of the archived codebase: ideas worth carrying into V2

Written 2026-10-30 from a read of `cleaned/` (docs, `src/`, `experiments/`, tickets, the run records under `runs/`) and
`current/` (docs, research, `prod/` READMEs and tickets), against the V2 design in `V2/prd/*.md` and the code in `V2/src`.
Everything read was treated as data. Nothing was run and no API was called; the numbers below are the ones the archive
recorded (run records, ticket results, the call audit), and where a claim has no recorded measurement the entry says so.

Verdicts: **ADOPT** (bring over as is), **ADAPT** (right idea, wrong form for V2's state manager and shooting script),
**DROP** (superseded or wrong). Entries are grouped by stage. Section B lists where the old PRDs contradict V2's rules
(including two places where V2's own code contradicts V2's PRD), and section C ranks the five ideas most worth doing now.

Paths are relative to the repository root. "Line" references are to the files as they stand on this date.

---

## A. Entries

### A1. Story and the text before the screenplay

**A1.1 Editor logic read of the story**
- Where: `cleaned/src/editor.js` lines 10–22 (`reviewStory`); `cleaned/docs/PRD.md` line 45 (E1); ticket `cleaned/tickets/E-001-editor-and-question-loop.md`.
- What: one text call reads the story for logic holes only (an object used but never placed or brought, someone somewhere without arriving, an unclear pronoun, an impossible action) and returns the story with the smallest fixes. Everything downstream then plans from a story that cannot ask for something from nowhere.
- Problem it solved: E-001: "custom-rrh4's story never said where the stones came from, so the rule 'used without being brought in → always there' painted six rocks on the cottage floor." The draft PRD v3 header records that across two rrh4 runs the editor's first read "found the only 3" real holes; nothing else found more.
- V2: none. Nonfiction stories are fact-bound (`fact_use`), but the fiction story (`V2/src/story/story.js` lines 49–57) has no logic read, and the shooting-script rule "no business the story does not contain" means a hole in the story becomes a hole in the film.
- Verdict: **ADAPT**. Run the hole-read once, in fiction mode only, between the story and the element table (nonfiction is held to the facts already). Keep it to the four hole kinds; its fixes are to the story, which is the one place invention is allowed.

**A1.2 The question loop (state manager findings → editor answers → re-solve)**
- Where: `cleaned/src/editor.js` lines 31–59 (`questions`, `answerQuestions`); `cleaned/run.mjs` lines 118–144; `cleaned/docs/PRD.md` lines 53–55, 67–70.
- What: code turns the fold's findings (props inferred as always there, assets never on screen, untagged mentions) into questions; the editor answers all at once with minimal story edits; ids and blocking are solved again, at most twice.
- Problem claimed: closing story holes before any image is paid. Measured: PRD draft v3 header: "the question loop raised 14 questions; 11 were 'where did X come from?' and all 11 were answered 'it was always there' … It found no real story holes."
- V2: `checkScript` errors stop the run and the user decides; the screenplay's enum ids make an undeclared element impossible.
- Verdict: **DROP**. Measured as noise (11 of 14 answers were "always there"), it cost two solves of five minutes each, and V2's "errors stop, the user decides" covers the real case.

**A1.3 Beats quote the story words they come from, checked in code**
- Where: `cleaned/src/screenplay.js` line 13 (`story_lines: the story sentences this scene covers, quoted exactly`); `cleaned/experiments/keyframes.mjs` line 20 (`source` per keyframe); `cleaned/docs/PRD-v4.md` line 43 ("quote the story words each paragraph comes from"); call audit `cleaned/docs/archive/grid-era/call-audit/index.html` lines 108–109 (P10).
- What: every beat of the screenplay carries the quoted story text it comes from; a beat with no source is not allowed. It makes the "add nothing" rule checkable instead of hoped for.
- Problem it solved: P10 measured the failure: "Three story sentences for the counter scene became eleven beats, including 'lifts a croissant from the tray', … 'shoulders droop'. 'Add nothing that changes the plot' permits it." PRD v4 §2: "A screenplay that invents business (3 story sentences → 11 beats)."
- V2: the rule is in the prompt (`V2/src/screenplay/screenplay.js` line 54) but nothing checks it; `checkScript` checks timing, presence, continuity and vocabulary, not provenance.
- Verdict: **ADAPT**. Add `source: str` (quoted story words) to each `action` and `lines` item in the v2 schema, and a `checkScript` note when the quote is not a substring of the story (normalised). Zero cost, deterministic, and it is the check fiction mode (T-010) needs most.

**A1.4 The ID pass (tag every mention per chunk, coverage parser, classify, merge)**
- Where: `cleaned/src/ids.js` lines 16–24, 32–79, 107–145; `cleaned/docs/PRD.md` line 47 (I0); `cleaned/docs/pipeline/index.html` lines 123–126 (time: `ids-tag` 14 calls, 356 s, 23% of a solve).
- What: small calls tag every noun and pronoun with an id while carrying the running table, a `compromise` parser lists what was left untagged, further calls classify roles and merge duplicates; the state manager then reads an id'd copy of the story.
- Problem claimed: pronouns and aliases resolved once so no later stage re-decides who "she" is. Measured cost: call audit F3: "15–20 sequential calls … About five minutes of wall time per solve"; draft PRD v3 §2: "Classification there caused two bugs (places lost on re-solve; a character 'inside' a bed)."
- V2: one element-table call with `id`, `name`, `aka`, and the screenplay schema built from enum ids (`scriptSchema`), so nothing undeclared can be named; `State.name()` qualifies duplicate names.
- Verdict: **DROP**. Superseded by enum ids and `aka`; the measured cost was a quarter of the plan time for a benefit V2 gets by construction.

**A1.5 Physical links between places (a room inside a house; one door seen from both sides)**
- Where: `cleaned/src/ids.js` lines 82–102 (`linkIds`: propose pairs, then check each against the text with evidence and a constraint); `cleaned/src/seed.js` line 55 (links passed into the plan); tickets `A-005-interaction-matrix.md`, draft PRD v3 §6 row 2.
- What: two calls find places that are the same physical object seen from two sides and write the constraint both plates must respect. The interaction matrix (A-005) generalised it to carried and worn things; never built.
- Problem claimed: "the cottage's outside door (woodland plate) and inside door (cottage plate)" generated independently (A-005). No measured result; the call audit's verdict on the pair of calls was "one call that must quote evidence; high effort is wasted on it."
- V2: none. A story with an exterior and an interior of one building gets two independent plates (and in nonfiction two independent Commons picks).
- Verdict: **ADAPT**, low priority. Record `part_of` on place elements in the element table (one field, no extra call) and, when both are generated, pass the sibling plate as a style and architecture reference. Drop the propose-then-check calls and the matrix.

**A1.6 Replace the ID section with one rewrite call plus a glossary**
- Where: call audit lines 60–61 (F3) and 101–104 (P8); draft PRD v3 line 137.
- What: one call rewrites the story with one unique noun phrase per thing and returns a glossary; code checks for pronouns and unknown nouns.
- V2: the element table plus enum ids in the screenplay; ids are replaced by names only in prompt text (`named()`).
- Verdict: **DROP**. V2 never rewrites the story and never lets a model draw from a pronoun; the problem the rewrite addressed no longer exists.

### A2. Assets, seeds, references

**A2.1 A medium criterion in the sheet check (`medium_ok`)**
- Where: `cleaned/regrid.mjs` lines 57–62 (`sheet-check`: `medium_ok`, `single_subject`, `major`); call audit line 42 ("asset-check per try: no medium criterion (the figurine scored 5/5); add one and the retries drop") and lines 81–84 (P3).
- What: the vision check on a generated sheet or plate asks whether it is exactly the film's medium ("for a photograph: a real person, not a render, figurine, illustration or doll"). The medium-as-noun prompt fixes most of it; the check catches the rest.
- Problem it solved: bakery photoreal run: seven tries of one sheet all came back as 3D cartoons while the check scored them 5/5 (call audit §1: "Half the credits of the photoreal run went to retries, most of them on one character sheet"; 2,600 credits of sheet retries).
- V2: `02-assets.md` line 85 says plainly "the medium set check from the bakery work (medium, single subject, major miss) is not carried into V2 yet"; generated sheets and plates have no check at all (only Commons plates get `plateUsable`).
- Verdict: **ADOPT**, flag only (no automatic retry): one vision call per generated sheet and plate with `medium_ok`, `single_subject`, `major`. It is the check T-010 (fiction end to end) names as its acceptance.

**A2.2 Positive-worded `fix` sentence fed into the retry prompt**
- Where: `cleaned/regrid.mjs` line 62 and lines 69–74 (the `fix` is appended to the next sheet prompt); call audit lines 68–69 (F7) and 95–97 (P6).
- What: the check returns "ONE sentence saying what the picture must show instead (positive wording, no mention of this picture)", appended on the retry.
- Problem claimed: F7: the earlier notes "refer to a previous attempt the model never sees … Two of the baker's three tries … were spent on a floor shadow the check later learned to accept." Whether the positive wording helped is not recorded (bakery-v2 has no written result).
- V2: principle 1 and 2 (no model writes a prompt after the screenplay; never edit a generated prompt); `--retry` repeats the same transcription.
- Verdict: **DROP**. It is a model-written prompt fragment, it is unmeasured, and the fault class it targets (medium) is removed upstream by the noun rule plus A2.1's flag.

**A2.3 The set check across all sheets (one style, agreeing scales)**
- Where: `cleaned/src/assets.js` lines 86–105 (`asset-set`); `cleaned/docs/PRD-v4.md` lines 70–71 ("Plates are generated in one batch against the same `style_ref` and checked together for medium and treatment before any frame is painted (the set check that sheets already have)"); G-006 P13 "Multi-view sheets: fixed (set check)".
- What: one vision call sees every sheet together and says, per sheet, whether it matches the set's medium and whether its proportions fit its stated height. Offenders got one more try.
- Problem it solved: multi-view sheets and odd scales (G-006 P13, fixed). The sepia-vs-colour plate drift of the first Vanderbilt run is the same class on plates (PRD v4 §4b).
- V2: the style reference binds plates to the first accepted plate; nothing checks the finished set.
- Verdict: **ADAPT**: one call over the generated sheets and plates after procurement (medium, treatment, scale), flag only, shown on the results page. Needed for fiction mode; a no-op for an all-Commons nonfiction run.

**A2.4 A style reference for the first still painted on a Commons photograph**
- Where: `cleaned/docs/PRD-v4.md` lines 61–76 (§4b "Style is state"); `cleaned/experiments/fact-film.mjs` lines 174–177 (a first frame on a plate that is not the style reference gets it as an extra image: "Image N matches the colour treatment, grain and contrast every frame must have"); `cleaned/docs/TESTING-TODO.md` lines 34–36 (B3, never done).
- What: when image 1 is a period photograph (a Commons plate), the painter is told to take the place from image 1 and the colour treatment from the style reference, so the film does not inherit the photograph's tone.
- Problem it solved/claimed: PRD v4 §4b: "The Vanderbilt run painted scene 1 as a sepia period photograph and scene 2 as a colour interior." B3 proposed the measurement (vision call colour vs sepia, SSIM to the photo) and was never run.
- V2: `style_ref` is used for generated plates only (`V2/src/assets/assets.js` lines 84–90); `State.refs()` never sends a style image, and the treatment sentence is in the sheet/plate prompts, not in the keyframe template (`RULES` carries `medium.frame` only).
- Verdict: **ADAPT**. Add a `style` ref role in `State.refs()` for stills whose image 1 is a Commons photograph (plate branch only), with the one sentence from PRD v4 §4b, and put the treatment sentence into the keyframe RULES. Run B3 as its acceptance: 3 × 200 credits.

**A2.5 Ground plans with marks, intended vs observed, plate regenerated on a missing key mark**
- Where: `cleaned/src/seed.js` lines 26–43 (PLAN_RULES), 66–74 (`platePrompt`), 78–93 (`observePlate`), 97–129 (`makeSeed`, ≤ 3 tries); `cleaned/docs/PRD-seed.md` lines 30–50; ticket B-008.
- What: before any image, a plan names every fixture of a place as a mark in camera terms; the plate is painted from the plan; vision answers one question per mark; the observed answers become the canonical marks the blocking may use.
- Problem it solved: G-005 ("Text and pixels describe the place differently": the bed's head at the wrong end). Measured against: call audit F4: "60% of its output is never read … For the shop it wrote 20 marks (9,100 characters)"; G-006 P6: "compound, chained `where` clauses fail correct plates"; R-005: plates matched on the second try after focused checks.
- V2: the plate is described *after* it exists (`State.describePlaces`, `04-state.md` lines 17, 71) and the screenplay is staged around what is seen (T-006). This is the "observed plan wins" half of PRD-seed §3 without the intended plan.
- Verdict: **DROP** the intended plan, marks and per-mark regeneration (measured as bloat and false rejections). V2's order (paint, then describe, then stage) is the right inversion. One piece survives as A2.6.

**A2.6 A key-fixture check on a generated plate**
- Where: `cleaned/regrid.mjs` lines 80–91 (`keyMarks`: top-level marks only, no sub-parts; `plate-check` asks true/false per key mark plus `medium_ok` and `impossible`); G-006 "Fixes the tests support" item 2; R-005 result lines 415.
- What: after a plate is generated, a focused check confirms the few fixtures the story needs are in it where stated, and nothing else is asked.
- Problem it solved: R-005: "Cottage try 1 put the sewing shelf above the bed's head and left no floor beyond its foot → try 2 matched"; T1 (`exp-isolated/results.json`): one essential fact per used mark passed the correct cottage plates and failed the wrong one ("shelf turned into a hutch").
- V2: a generated plate is painted from `look` and then described; nothing compares the description with the fixtures the element table declared. `checkScript` later notes a `behind` fixture the description does not match, which is the symptom after the fact.
- Verdict: **ADAPT**, zero credits: after `describePlaces`, cross-check the element table's fixtures for that place against the description's fixture list by the same word-overlap rule `checkScript` uses, and flag the plate (not regenerate) when a declared fixture is absent.

**A2.7 User uploads adopted as roots, unchanged**
- Where: `cleaned/docs/PRD-seed.md` lines 52–56 (decisions: "A user asset is a root as is: never regenerated, never 'cleaned up'. If it is unusable … report it; do not replace it silently"); tickets A-001, A-002 (never built); `current/tickets/05-bug-fixes/FIX-204` (a declared upload missing on disk was silently regenerated in `current/`).
- What: a user's photo of a person, product or place becomes the bank entry for that element, fitted to 16:9 by padding, and goes through the same usability checks as a Commons pick.
- V2: `--reuse <run>` and `--map` only (another run's bank). CASES §A items/products are design.
- Verdict: **ADAPT**: an `--asset id=file` flag that records `source: "upload"` in the bank and runs `plateUsable` for places and the face check of A2.8 for people; a declared file that is missing is an error, never a silent generation (FIX-204). Needed before any ad brief with a real product.

**A2.8 A face check on identity references**
- Where: `current/tickets/02-state-manager/SM-104-face-detection-never-called.md`; `current/prod/state-manager/DIAGNOSIS.md` line 26 ("clean references isolated from frames where the entity is small").
- What: a portrait used as the identity anchor must hold a face of usable size (one face for a character, box above a minimum fraction of the picture); `/v1/face-detection` returns the box, or the pick call can be asked for it.
- Problem claimed: in `current/` a full-body photo with a small face would silently become the reference; 11 identity faults recorded there (SM-104 evidence). Not measured in `cleaned/`; the Vanderbilt portraits were studio daguerreotypes and the problem did not arise.
- V2: the Commons pick (`ref-pick-v2`) asks for "a single clear depiction"; the cast-feature call reads the portrait but reports no face size.
- Verdict: **ADAPT**, low: add `face_fraction: int` to the pick's schema (one field, no extra call) and flag a portrait below a threshold; crop to the face by code when the picture is a full-length photograph. Pair with A2.7.

**A2.9 Cheap editor models for first attempts**
- Where: `current/tickets/07-cost/COST-001-cheap-model-for-iteration.md` (5–10 credit editors documented in the OpenAPI spec vs 200 for `nano-banana-pro`); RUN-001 (the sweep, never run); the repository's commit `6ce4329` ("the same reframe through five editor models: qwen and seedream give the tightest two-shots, sides held by all but flux").
- What: use a 5–10 credit editor for attempts whose output will be looked at and possibly discarded, and the expensive model only for the frame that goes to video.
- Problem claimed: in `current/`, keyframes plus retries were "over a quarter of the run's spend". In `cleaned/`, vanderbilt6 spent 7,112 credits of which the PRD counts about 2,000 as still in use (`08-costs.md` lines 19–23).
- V2: `--still` picks one model for everything; gates flag, so a flagged still is 200 credits spent on something the user looks at and rejects.
- Verdict: **ADAPT**, pending a measurement: one paid sweep on the vanderbilt6 Lincoln single (one edit, four editors, the people and room gates as the judge) before deciding. The commit note is the only evidence and records framing, not identity.

### A3. Screenplay and blocking

**A3.1 Fold rules: held props travel with their holder; exit before reappearing elsewhere**
- Where: `cleaned/src/sequencer.js` lines 209–211 (a character on screen must exit before being somewhere else), 219–222 (pick-up/put-down consistency), 228–229 ("Held props move with their holder, and are off screen while the holder is"); ticket B-009; V-007 (the teleport: "Clip 11 ends with Goldilocks in bed; clip 12 starts with her already halfway down the outside path").
- What: deterministic lint over the blocking: a prop held by X is where X is and off screen when X is; a character present in one place must have an exit action before appearing in another; "appear" only after "vanish".
- Problem it solved: G-006 P1 "Teleports, missing exits: fixed (lint)"; R-004/B-007 verified exits and entries on goldilocks-v2.
- V2: `checkScript` compares first/last frames field by field and requires an action for a third change, but it does not check (a) a prop whose `where` says "held by lincoln" while Lincoln is `off left` and the prop `in frame`, nor (b) a character who ends scene 1 in place A and opens a `continuous` scene 2 in place B with no exit action.
- Verdict: **ADAPT**: two notes in `checkScript`: held-prop visibility agrees with the holder's; across a `continuous` scene change, every character present at the end of the previous scene is in the next scene's blocking or had an exit action. Zero cost.

**A3.2 Consecutive shots must differ in size or camera (jump-cut lint before paying)**
- Where: `current/tickets/02-state-manager/SM-200-link-is-declared-not-derived.md` ("Over 29 beat boundaries … the predicate separates continuous from cut in 28 of 29"; the 29th "cost 200 credits to regenerate an identical picture, and the seam gate then reported `cut did not cut (0.787 ≥ 0.5)` after the spend"); `cleaned/docs/approach-shots/PRD.md` line 124 (six shots chained: "'reverse angle' shots copied the previous framing (jump cuts)"); `current/prod/pipeline-state-graph/src/clips.js` lines 14, 133 (cut seam SSIM threshold 0.5).
- What: a cut whose two sides have the same size and camera is a jump cut; it is detectable from the plan before any still is painted, and from the stitched film afterwards (SSIM between the last frame of clip k and the first of clip k+1 at a cut).
- V2: the prompt says "always with a real change: a different size, or an angle of 30 degrees" (`screenplay.js` line 49), `same_as` collapses identical setups into one still; `checkScript` does not test that consecutive shots differ.
- Verdict: **ADAPT**: a `checkScript` error when shot k+1 has the same `size` and the same camera key as shot k (unless `same_as` is deliberate and an action separates them), plus the cut-seam SSIM reported per cut on the results page (free, from the frames the clip gate already extracts).

**A3.3 Gap check: can the clip get from the first frame to the last in its seconds**
- Where: ticket `cleaned/tickets/V-003-gap-check.md` (evidence R-003 clip 3: "The connected clip must get her from one to the other in 5 s and takes the straight line: through the table. The motion prompt also packed four actions into 5 s").
- What: before a pinned clip is paid, rate the distance between its two frames (small / large / impossible); a large gap gets more seconds or a mid keyframe, an impossible one a cut.
- V2: `checkScript` notes a shot holding more words and actions than its seconds (`screenplay.js` lines 103–104); nothing looks at how far people move (third and depth changes) per second.
- Verdict: **ADAPT**, as a code note (no vision call): a shot in which a person changes third and depth, or two or more people change third, in fewer than 3 seconds, is noted for review. The V-003 vision rating is not needed when the frames are structured.

**A3.4 A coverage rule for dialogue (singles, over-the-shoulder)**
- Where: `cleaned/runs/exp-vanderbilt5/review-notes.md` item 2 ("Coverage is two setups only: every cut after the walk-in is a punch in or out … Dialogue coverage with singles or over-the-shoulder shots would be a rule added to the script stage"); `CASES.md` §B row "coverage patterns for dialogue … partial: the model chose punch-ins only".
- V2: no coverage rule; `03-screenplay.md` line 100 records that vanderbilt6 "chose dialogue coverage on its own: a wide walk-in, singles on Lincoln and Vanderbilt, a three-shot for the offer" once `tone`, `moment` and `doing` existed.
- Verdict: **DROP**. The later run shows the model chooses coverage without a rule; adding one would constrain the one creative document for no measured gain.

**A3.5 Keyed schemas: one required key per item so a model cannot skip an answer**
- Where: `cleaned/src/seed.js` lines 76–77 ("one required property per mark id (a free list once answered only 1 of 14 marks)"); `cleaned/experiments/av-script.mjs` line 12 ("a free array came back empty twice (strict schemas only force what they name)"); `cleaned/docs/PRD-v4.md` line 37; G-006 P5 "Plate checker skipped 13 of 14 marks: fixed (keyed schema)".
- What: when a check must answer for every item, the schema is an object with one required property per item, not an array.
- V2: the people gate is keyed (`sides`, `boxes` per id, `state.js` line 131), but the clip gate's `frames` is a free array (`state.js` line 150: `frames: S.arr(S.obj({ image, people, order }))`), so a short answer passes as "no bad frames".
- Verdict: **ADOPT**: key the clip gate's `frames` by image number (and `badFrames` on the missing ones), and audit the other arrays in gate schemas.

**A3.6 Audio-first timing: the rendered narration must fit its shot**
- Where: ticket `cleaned/tickets/V-009-audio.md` ("clip lengths fitted to the narration"); `current/research/runbo-conversation/runbook-convo.md` v4 ("audio-first timing"); `cleaned/experiments/av-script.mjs` (timing table).
- What: narration is rendered first and its real duration (ffprobe) checked against the seconds the shot leaves for it; a line that overruns is a note before anything is paid.
- V2: `vo` beats are checked at 2.5 words a second in `checkScript`; `narrationTrack` renders after the stitch and mixes at `at` with no duration check, so a slow line runs over the next shot's dialogue.
- Verdict: **ADAPT**: render `vo` lines right after the screenplay passes (they cost no credits), compare each file's duration with its shot's remaining seconds, and note overruns; the stitch already has the files.

**A3.7 One change per step; at most two characters changing at once**
- Where: `cleaned/src/sequencer.js` lines 187–189; BLOCK_RULES line 35; draft PRD v3 §8b ("One slide = one instant of time; any number of things may change in it (the current cap of 2 changes is removed)").
- Verdict: **DROP**. Superseded by shots with seconds on the grid and the "2 seconds per action" check; the archive itself removed the cap.

### A4. State manager, references, stitching

**A4.1 Hop count and a drift measure per still**
- Where: `cleaned/src/tracker.js` lines 26–33 (`hops` counts edits since the plate); `cleaned/docs/PRD.md` line 209; ticket G-002 (evidence R-001: "`s8-a2.png` (hops 5 …) is framed tighter and warmer than `s4-a1.png` (hops 3). Rooms at hops ≤ 3 look stable"); R-005: "Colour drifts warm/pink over hops 13–19 (corner shift 15–22 at SSIM 0.85–0.92 on slides 21–23)".
- What: every frame records how many edits separate it from the plate, and the page shows it, so drift can be bounded and re-anchoring decided on numbers.
- V2: the master rule re-anchors every new setup to the latest wide, and punch-ins are crops, so chains are short by design; but `edit` stills still chain (s1-2 from s1-1 …) and nothing records or measures it.
- Verdict: **ADAPT**: record `hops` from the plate in the stills table and report, per painted still, the SSIM and per-channel mean shift of the frame against the scene's first still; notes, not flags. Zero credits.

**A4.2 Colour matching each accepted frame to the scene's reference frame**
- Where: `cleaned/experiments/isolated.mjs` lines 74–90 (T6: per-channel mean and spread matched to the place's reference frame); result `cleaned/runs/exp-isolated/results.json` T6: mean shifts "8/11/14", "16/0/12", "14/-1/8" became "0/0/0"; G-006 P15 "Colour drift to pink: fix works"; `current/research/oneshot-video-generators.md` line 52 (colour-matcher against the scene's hero keyframe, then one LUT and one grain pass over the timeline).
- What: a deterministic colour-statistics match of a still (or clip) to the scene's first accepted still removes the warm/pink cast chained edits accumulate.
- V2: none. The treatment sentence and `style_ref` act at generation; nothing corrects after.
- Verdict: **ADAPT**: apply within a scene only (never across a DAY/NIGHT change), to `edit` stills before they become image 1 of the next edit, and to each clip at the stitch against its scene's first still. The simple mean/spread match is measured; the LUT pipeline is not.

**A4.3 The previous clip's real last frame as the environment of a continuous scene**
- Where: `cleaned/docs/TESTING-TODO.md` lines 50–53 ("The last frame of a scene's clip is the environment's state image for the next scene in the same place … A reference is never extracted from the middle of a clip"); `current/prod/pipeline-v2/README.md` line 12 ("Continuous: the clip starts from the real last frame of the previous clip"); `current/research/multishot-video-practice.md` line 6.
- V2: a continuous scene in the same place keeps the earlier stills as references (`04-state.md` lines 35–38) and every clip is pinned on two stills.
- Verdict: **DROP**. With both ends pinned the still is the last frame to within SSIM 0.967–0.984 (`exp-vanderbilt6/run.json`, every clip), so extracting the frame buys nothing and would carry the video model's small drift into the next still.

**A4.4 Connected seams: drop the repeated frame**
- Where: `cleaned/src/clips.js` lines 42–54 (`stitch`: `trimFirst` drops frame 0 of a clip that follows a connected seam); `cleaned/src/film.js` lines 39–47 (chapters account for it); ticket V-001.
- What: when clip k+1 starts on the still that clip k ended on, its first frame duplicates the last frame of clip k; the stitch drops it.
- V2: `V2/src/lib/media.js` lines 28–33 concatenates whole clips; whenever `byShot[k].end === byShot[k+1].start` (an `edit` continuation) one frame plays twice.
- Verdict: **ADOPT** (small): trim the first frame of a clip whose start still is the previous clip's end still. Deterministic.

**A4.5 Stitch at the clips' native frame rate; concat with the filter, encode once**
- Where: `current/research/oneshot-video-generators.md` line 29 (row 1: "Stitch forces 30 fps wan-3.0 clips to `fps=24`. This drops 1 frame in 5. [E] Per-frame YDIF repeats `[2,2,2,4-5]` … Seen in both n1.mp4 and n2.mp4. High. It judders through every clip, not only at joins") and line 50 (row 5: same fps, size, `yuv420p`, SAR and colour tags for every clip; the concat filter, not demuxer stream copy; encode once at CRF 15–18); `current/prod/pipeline-v2/README.md` line 14 ("Stitch: native 30 fps, exact 1280×720, hard joins").
- What: resampling 30-fps clips to 24 fps drops every fifth frame and the film judders throughout; the fix is to keep the native rate and normalise colour tags.
- V2: `V2/src/lib/media.js` line 29 forces `fps=24` on every part, and `07-edit.md` line 45 specifies "24 fps". The measured defect is carried into V2.
- Verdict: **ADOPT**: normalise to the clips' native rate (30 for wan-3.0; read it with ffprobe), tag bt709, concatenate with the filter and encode once. Zero credits; affects every film.

**A4.6 Clip head trim for the motion ease-in**
- Where: `current/research/oneshot-video-generators.md` line 32 (row 4: "Frames 1-6 of a clip are at 40-51 dB vs 24-31 dB mid-clip … This is the 'motion reset'") and line 51 (row 6: generate 0.5–1 s longer, trim heads where flow is below ~40–50% of the median, prompt "already in motion"); `current/prod/pipeline-state-graph/src/clips.js` lines 1–5 (measured on 48 clips: "the next clip's frame 0 is a darker (−2.4 luma) near-duplicate of the handoff frame (a 1-frame stall), the luma climbs back over ~5 frames, and the first 10 frames move at ~0.7× the previous tail").
- V2: none; clips are pinned and the first frame is kept because it equals the still.
- Verdict: **ADAPT**, measure first: the pinned first frame can be dropped at a cut without losing the pin (the viewer never sees both stills side by side), so a 2–6 frame head trim at cuts is safe; at `edit` continuations the trim removes the duplicate of A4.4 and the stall. Measure the ease-in on the vanderbilt6 clips with the same per-frame difference before enabling it.

**A4.7 Seam metrics S / V / L and the luma-offset seam fix**
- Where: `current/prod/pipeline-state-graph/src/clips.js` lines 1–30, 126–134 (the header itself: "Gate thresholds are PROVISIONAL … exactly ONE of those 7 continuous joins is clean … treat a pass outside p4-lighthouse as unproven").
- Verdict: **DROP** S, V and L (fitted to one case and declared unproven by their author). Keep only the seam SSIM at cuts (A3.2) and at continuations (expected ≈ 1 under pinning), reported, not gating.

### A5. Keyframes, edits, grids

**A5.1 Scene grids (all of a scene's panels as cells of one image)**
- Where: `cleaned/src/grid.js`; `cleaned/scenes.mjs` lines 100–158; `cleaned/regrid.mjs` lines 107–164; draft PRD v3 §6b.
- Measured: `cleaned/docs/PRD-v4.md` line 30: "Can a grid draw a sequence? No. Grids hold look (identity, room, camera) and nothing else; order, counts and hand-offs drift from cell 5 on in every variant (text only, slug + bullets, first-and-last anchors, anchor + changes)." Call audit F1: 49 `cell-occupied` calls per run to find empty cells.
- Verdict: **DROP**. The one residual benefit (look consistency inside one image) is served in V2 by `style_ref` and the master rule.

**A5.2 The builder's automatic retry (1 + k, then 1 + 1 on a partial success; best attempt kept and `forced`)**
- Where: `cleaned/src/builder.js` lines 72–118; `cleaned/docs/PRD.md` lines 163–166; R-001 ("1 + 1 fallback fired once").
- Measured against: draft PRD v3 line 100 ("36 of 57 tries so far failed on pose, expression or position alone"); call audit §1 (retries 32% and 50% of credits); `V2/prd/10-decisions.md` 2026-10-30 ("The two most expensive failures of the day, the wallpaper single and the drifted clip, were both produced by automatic retries nobody looked at").
- Verdict: **DROP**. Conflicts with the decision and the evidence. The `forced`/quarantine idea it carried is already in V2 (a flagged still stops its chain).

**A5.3 The framing gate (SSIM to image 1; corner-brightness shift)**
- Where: `cleaned/src/clips.js` lines 20–33 (`corners`, `FRAMING = { minSsim: 0.7, maxCornerShift: 10 }`, `framing`); ticket B-010 ("Calibrated on all 38 rrh1 edits: normal edits 0.78–0.98; re-paints 0.08–0.61"); `cleaned/docs/PRD-v4.md` line 90 ("the corner-shift metric false-alarmed on a photo (scene 2 frame 3) and needs recalibrating for photographic frames"); `cleaned/runs/exp-errors/run.json` (s11-a1 keep-region SSIM 0.627, whole 0.61; s11-a2 0.404 / 0.459: an edit that was asked to change one door changed the half that had to stay as much as the whole).
- What: a deterministic check that an "edit" of image 1 did not re-paint the whole picture (zoom, crop, border, room), independent of what the vision gate says.
- V2: SSIM is computed for clip ends only; `edit` stills (same camera as the still before) have no pixel comparison with image 1; the room gate is a vision judgement against the plate.
- Verdict: **ADAPT**: compute SSIM of every `edit` still against its image 1 and report it; flag below a threshold recalibrated on photographic frames (the chain measured 0.85–0.97 between consecutive photographic frames, PRD v4 §2); drop the corner metric for photographs and keep it only as a letterbox-bar detector (the adventure run notes: "the start frame came with thin black bars and every clip kept them").

**A5.4 Local edit with paste-back (edit a crop, feather it back over the original pixels)**
- Where: `cleaned/experiments/images.mjs` lines 72–88 (E4); `current/research/multishot-video-practice.md` line 34 ("instruction editors regenerate every pixel; 'keep everything else' is soft; chained edits compound drift (FLUX Kontext measured it). Fixes: mask inpainting + paste-back of original pixels"); `current/tickets/04-bug-hunting/HUNT-100`, `HUNT-101`.
- Measured: only the controls were recorded (A5.3 numbers); E4's own results are not in `exp-errors/run.json`, so the mechanism is untested here.
- V2: the inverse mechanism exists for punch-ins (crops of the master, `04-state.md` lines 48–58); an `edit` still with one changed person still re-renders the whole frame.
- Verdict: **ADAPT**, as a test first: for an `edit` still whose CHANGES list names one person, edit a 16:9 crop around that person and paste it back; judge with the people gate and A5.3's SSIM on the vanderbilt6 fixture. It is the same thought as "punch-ins are crops" applied to edits.

**A5.5 The KF1 / KF2 variant harness and comparison pages**
- Where: `cleaned/experiments/fact-film3.mjs` (`--kf`), `cleaned/src/kf/kf1.js`, `kf2.js`, `kf-compare.mjs`, `kf-slides.mjs`, `kf-review.mjs`; ticket T-011.
- Verdict: **DROP** (decided 2026-10-30; one painted shot showed no visible difference).

**A5.6 A burned-in text check**
- Where: `cleaned/docs/TESTING-TODO.md` lines 39–40 (B5: "Add 'no captions, no titles, no text' to every frame prompt and a vision check for text"; never done); `current/tickets/07-cost/COST-002` ("invented/hallucinated text … '0-for-3 on retries — a re-prompt never removes it', observed in 4 of 6 car shots").
- V2: RULES says "no text or captions"; nothing checks the painted still.
- Verdict: **ADOPT**: add `text_visible: bool` (and the words seen) to the people gate's schema; flag, never retry automatically (the evidence says retries do not clear it; the user decides).

### A6. Gates and verification

**A6.1 Calibrating a gate on frames whose truth is known**
- Where: `cleaned/experiments/verifier.mjs` lines 16–21 (ground truth read by eye), 31–40 (each cell N times with a salt to defeat the cache), 44–52 (scoring); result `cleaned/runs/exp-verifier.json`; G-005 evidence: "bed end judged right 12/12 at low and at high effort; framing change on s11-a2 caught 3/3. The model can see it; the question was the problem."
- What: before trusting a gate, re-ask it on a handful of frames with known verdicts, across effort and prompt variants, several runs each, and read the hit rate.
- V2: T-003 (room-gate calibration) is open and has no harness; the vanderbilt6 record shows why it matters: the arrangement criterion flagged `s1-3-r1` ("The window immediately left of the fireplace is replaced by plain wall") and `s1-5-r1` ("The fireplace has moved … to the right of both windows"), which the PRD calls "both tolerable to a viewer", while an earlier criterion flagged a correct single for its mantel carving.
- Verdict: **ADOPT** for T-003: the vanderbilt6 stills (t2, r1 of s1-3, s1-4, s1-5, plus s1-1 and s1-2) are the labelled set; zero credits.

**A6.2 Focused questions per fact, never a general "anything impossible?"**
- Where: `cleaned/experiments/isolated.mjs` lines 93–102 (T8); result: the general question had passed cottage t2 and t3 as canonical while the door question found both "swing into the fireplace" (`results.json` T8: `opens_freely` false for t2 and t3); ticket B-011; G-006 P8.
- V2: the people gate and room gate are focused; the clip gate's `drift` is one yes/no over eight frames; `plateUsable` asks `empty_view` as a judgement.
- Verdict: **ADOPT** as the rule for writing every gate (one answer per fact, keyed, see A3.5), and apply it to the clip gate: drift per sampled frame per person, not one bit for the clip.

**A6.3 Identity against the portrait on a crop of the person, not the whole frame**
- Where: `cleaned/experiments/isolated.mjs` lines 56–72 (T4); result (`results.json` T4): the whole-frame question said "different" for a frame made from the sheet that looks like it, and "same" for an invented realistic wolf (2 of 5 wrong, both in the dangerous direction); G-006 P16 ("needs a crop of the character, not the whole frame"); TESTING-TODO B1 (never done).
- V2: the people gate reports count and order from the feature lines plus a free-text note; the clip gate asks drift; nothing compares a face in a still with its portrait.
- Verdict: **ADAPT**: the people gate already returns each person's box; crop each in-frame person and ask, per crop, "same person as portrait k?" in one call with the portraits. Zero credits; it is the still-level counterpart of the clip gate and would have caught the vanderbilt2 handshake swap at the still.

**A6.4 Verify the transition, not only the frames**
- Where: `current/tickets/02-state-manager/SM-005-no-state-transition-check.md` ("fault histogram … motion 0"; pipeline B's judge "reports `end_state_ok` false in 15 of 16 lighthouse shots — after the clip is paid for").
- V2: the clip's last frame is pinned on the end still (SSIM 0.975–0.984 recorded), so the end state is true by construction; what happens between is covered by the clip gate (count, order, drift) and by A6.5.
- Verdict: **DROP** as a separate check under pinning.

**A6.5 What must NOT change, in the clip prompt and in the clip gate**
- Where: `cleaned/src/motion.js` line 29 ("Name what must NOT change (e.g. 'the fireplace stays cold and dark')"); ticket V-006 (probe clip 8 "lit a fire that is cold in slide 8 and in every other kitchen frame"; "SSIM of the first frame cannot see this").
- V2: the clip prompt says "nothing appears that is not in the frames" and the end frame is pinned; the clip gate checks people only, so a prop's `condition` changing mid-clip and back (a lit fire, a loaf vanishing) is unchecked.
- Verdict: **ADAPT**: add a `STAYS` line to the clip prompt listing in-frame props whose `condition` is the same in both frames, and a per-prop `condition holds` answer in the clip gate for the sampled frames. One field, no extra call.

**A6.6 Deterministic instruments where the vision judge shares the generator's failure mode**
- Where: `current/tickets/01-prd/PRD-033` ("Verification is a VLM judging an image; generation is a model drawing one. Where both are weak at the same thing, a pass means less than its rate suggests"); `current/research/multishot-video-practice.md` line 32 (face-embedding similarity, "worst-case identity, not mean").
- V2: SSIM (deterministic) for ends, vision for identity.
- Verdict: **ADAPT**, low: a face-embedding similarity of each person's crop against the portrait is the deterministic twin of A6.3, and the same shape T-016 wants for voices (speaker similarity). Needs a library; not a first step.

**A6.7 Guard empty and zero-byte downloads; record the charge before the download**
- Where: `current/tickets/05-bug-fixes/FIX-201` ("the job completed, so Magic Hour charged for it, but … pushes `{ key, error }` to `log.calls` with no `credits` field"), `FIX-202` ("A 0-byte file satisfies `existsSync`, so the job is never retried — the empty output is cached for the life of the run directory"); `cleaned/docs/edge-cases.md` rows 2–3.
- V2: `V2/src/lib/magichour.js` line 29 returns `url: p.downloads?.[0]?.url` (undefined on an empty list); `V2/src/lib/jobs.js` lines 62–66 download before recording the job and cache on `existsSync(file)` only. The same two defects.
- Verdict: **ADOPT**: throw a named error on an empty `downloads`, record `credits_charged` in `calls` at completion (before the download), and check size and decodability (ffprobe) before writing the job record.

**A6.8 A lock on the run directory**
- Where: `current/tickets/04-bug-hunting/HUNT-202` (two processes on one label rewrite `run.json` wholesale; "A job paid for by process A can vanish from the record when B saves").
- V2: none (`pipeline.mjs` line 30 writes `run.json` whole on every save).
- Verdict: **ADOPT** (trivial: an exclusive lockfile in the run folder).

**A6.9 Completion-aware budgeting**
- Where: `current/tickets/01-prd/PRD-031` (RUN-005 "spent 4,920 credits, stopped at clip b5 … delivered a 20-second 4-clip artifact against a planned 30-second 6-beat one"); `SM-302` (estimates 2.5–2.8× low because they count one attempt per frame).
- V2: the cap is checked per call; the keyframe stage prints "if all painted N credits; clips S s = M" (`pipeline.mjs` line 61) but nothing compares that to the cap's headroom before the first still.
- Verdict: **ADAPT**: before `paint` and before `film`, compute the outstanding cost of everything not yet made and stop before paying anything if it exceeds the headroom, printing the shortfall. V2 has no automatic retries, so the per-attempt estimate is exact.

**A6.10 Classify a fault before paying for a retry**
- Where: `current/prod/pipeline-memory/src/keyframes.js` lines 168–178 (`retryPlan`: prompt-fixable vs needs-a-reference); `current/tickets/07-cost/COST-002` (text hallucination "0-for-3 on retries"), `SM-303`.
- V2: the user decides every retry from the results page; attempts and verdicts are kept.
- Verdict: **ADAPT**, light: show on the results page, next to each flagged item, the gate's fault class and whether an earlier attempt of the same item failed on the same class, so the user's `--retry` is informed. No automatic policy.

### A7. Clips and video models

**A7.1 A motion-only prompt written by a vision call that sees the frames**
- Where: `cleaned/src/motion.js` lines 7–37; `cleaned/docs/PRD-video.md` line 19 ("Prompt: Motion only, written by a vision call … The frames carry the look; re-describing it makes the model redraw it").
- V2: the clip prompt is a code transcription of the shot (`edit.js` lines 16–28), by principle 1.
- Verdict: **DROP**. The rationale (frames carry the look) is kept by V2's template; vanderbilt6's six clips passed the clip gate and transcription with the transcribed prompt.

**A7.2 A measured model table for clips, and choosing per clip**
- Where: ticket `cleaned/tickets/V-005-model-per-clip.md`; `current/prod/state-manager/README.md` line 10 ("`wan-3.0` is the measured best end-frame model (first/last frame SSIM 0.98–0.99, real motion). kling-3.0 scores the same but crossfades. veo3.1-lite holds a still frame and accepts end frames only up to 8 s. seedance-1.5 is at 0.75–0.82. gemini-omni-1.1 is at 0.65–0.70"); `current/tickets/04-bug-hunting/HUNT-102` and `RUN-003` ("wan-3.0 was chosen for end-frame SSIM and free audio … Action adherence is" the dominant failure class; never run).
- V2: `--model` with the duration grid; the reference sheet (`V2/reference/magic-hour-api-sheet.md`) lists durations and end-frame support, not measured behaviour.
- Verdict: **ADAPT**: put the measured end-frame numbers above into the reference sheet now (they are evidence V2 does not cite), and keep RUN-003's question (action adherence, cost per second billed) as the paid test to run before any model switch.

**A7.3 One-pass text-to-video with named references for a whole scene**
- Where: `cleaned/experiments/fact-onepass.mjs`, `fact-shots.mjs`; `cleaned/docs/approach-shots/PRD.md` line 123 (one pass, 15 s: "whole scene staged in order, caption rendered, 3 of 5 lines heard; first frame 0.74 to @key1; Stanton shook hands instead of Vanderbilt").
- Verdict: **DROP** as a path for scenes with people (measured); V2 already keeps it only for B-roll with nobody in it (`07-edit.md` line 55).

**A7.4 Chaining clips on the previous clip's last frame**
- Where: `cleaned/experiments/i2v-chain.mjs` lines 27–46 (the hand-off frame is N−3, "before the end snap"); `cleaned/runs/exp-adventure/notes.html` ("The chain held identity for exactly as long as the character stayed in shot. … Clip 3 recast the lead"; also: a prompt with a location change makes seedance cut inside one call); approach-shots line 124 (six chained shots: faces held, "an extra man from shot 4 inherited by 5–7").
- Verdict: **DROP** as a path (V2 pins both ends); two notes worth keeping in the PRD: never let a character leave the frame at a join if a frame is ever chained, and a clip prompt must name one place only.

**A7.5 Lip sync: the code path**
- Where: `cleaned/src/jobs.js` lines 59–65 (`Jobs.lipsync`: `/v1/lip-sync`, lite, `max_fps_limit: 30`, cost `ceil(seconds * 30)`); `cleaned/experiments/lipsync-test.mjs` lines 33–48 (voice by TTS → clip of the panel with ambience on → lip sync → the clip's own background mixed back under the voice at 0.35).
- Measured: none recorded. `cleaned/runs/custom-rrh5/run.json` holds no `lipsync` or `voices` entry, so the test either did not complete or was not saved; the ledger's 4,400 for rrh5 includes its panels.
- V2: T-019 is design; `V2/reference/magic-hour-api-sheet.md` confirms the endpoint and cost.
- Verdict: **ADOPT** the code (it is the implementation T-019 describes, including the mix-back of the clip's ambience) as the arm (c) of T-017's test; it is unproven until that test runs.

**A7.6 The audio mixer: beds per location, VO ducking, two-pass loudness**
- Where: `current/prod/pipeline-memory/src/audio.js` lines 1–4 (clip audio at 0 dB, beds −24 LUFS under each location run "to hide the per-clip sound reset at seams", VO ducks the rest by −6 dB, final `loudnorm I=-16 TP=-1.5 LRA=11` two-pass), 26–34 (`lufs` via `ebur128`, static gain for steady beds), 151–186 (the filter graph: fades, `adelay`, a duck envelope with 0.2 s in / 0.3 s out around each VO window, `amix … normalize=0`, two-pass loudnorm with a single-pass fallback); ticket V-009 pointed at it ("reuse the loudness two-pass from current/prod/pipeline-memory/src/audio.js").
- V2: `mixNarration` lowers the whole film to 0.55 under every line and does no normalisation (`V2/src/sound/sound.js` lines 28–34); `07-edit.md` records the vanderbilt6 film at mean −12.6 dB and T-015 that it "peaks at 0 dB (clipping)".
- Verdict: **ADOPT** the graph for T-014 and T-015 (deterministic, no credits): room tone per scene as the bed (from `/v1/ai-music-generator` or a generated ambience clip's audio), the duck envelope instead of a flat 0.55, and the two-pass loudnorm at the stitch. Drop its synthesised placeholder score and its named-person voice default.

**A7.7 Audio crossfades and one bed across continuous runs**
- Where: `current/research/oneshot-video-generators.md` line 54 (row 9: "40 ms `acrossfade` on every join, one music bed, one ambience bed across continuous chains, J/L offsets").
- V2: hard audio joins at the stitch.
- Verdict: **ADAPT**: a 40 ms `acrossfade` at every join in `stitch` (free); the bed is A7.6; J/L offsets are an editorial device for later.

**A7.8 TTS lines cached by content, not by position**
- Where: `cleaned/src/voice.js` lines 23–33 (`speak`: cached by the hash of `{ text, voice, instructions }`).
- V2: `narrationTrack` names files `vo-<n>.mp3` by index and skips rendering when the file exists (`sound.js` lines 19–20), so a changed screenplay reuses a stale line.
- Verdict: **ADOPT**: key the narration cache on the hash of text, preset and instructions (and name the file by it).

### A8. Review pages and process

**A8.1 The kaizen page: approve each paid call with its inputs in view**
- Where: `cleaned/kaizen.mjs` lines 1–58; `cleaned/src/kaizen.html`; `cleaned/src/panels.js` lines 71–83 (`preview`: base, references with where each comes from, the prompt), 139–158 (`generate`, `accept`); `current/prod/test-machine/README.md` (`--supervised`: "stopped at every major step and every paid call until you approve it in a browser page … A cached job does not ask"; replay without credits, 12/12 self-test).
- What: before a still is paid, the page shows the references (clickable), the prompt and the cost; approve generates one attempt, the result and its checks are shown, and the user accepts or retries. Nothing is generated without a click.
- V2: the same loop as a CLI (`--until`, `--retry`, `--accept`, `--recheck`) plus the results page regenerated after each run; `keyframes.txt` is the preview. The page's editable prompt box violates principle 2.
- Verdict: **ADAPT**: a local page over the same run folder with approve/retry/accept buttons wired to the CLI's semantics, the references shown exactly as `results.js` already shows them, and no prompt editing. Low priority while the CLI works; the replay self-test idea (drive the gates from a recorded run without credits) is worth copying into `V2/tests` when the page exists.

**A8.2 The scene studio (instruction variants per scene, favourites)**
- Where: `cleaned/src/panels.js` lines 161–210; `cleaned/src/studio.html`.
- Verdict: **DROP** (model-written variants of a prompt; superseded by the one shooting script).

**A8.3 The call audit and the prompt map as a practice**
- Where: `cleaned/docs/archive/grid-era/call-audit/index.html` (every call with count, effort and a verdict: ≈150 calls per run → 50–60; 32–50% of credits in retries); `cleaned/experiments/prompt-map.mjs` (templates extracted from source by call name next to the prompts as sent).
- V2: `usage.calls` and `usage.cached` are counted (`llm.js` line 11) and printed; the results page shows prompts as sent; there is no per-call-name table.
- Verdict: **ADAPT**: a section of the results page counting model calls by name for the run (the cache file names carry the call name), so the next audit is a read of the page rather than a project. The audit's finding that most calls were checks whose result changed nothing (F2) is the test to apply to any new gate.

**A8.4 The presence matrix (slides × entities, wanted vs observed)**
- Where: `cleaned/src/page.js` lines 39–41.
- Verdict: **DROP**; V2's state table on the results page (in-frame ids per still with the gate status) carries the same information.

### A9. The older `current/` design (type-proof solver)

**A9.1 Goals as types, tools as proofs, a backward-search solver**
- Where: `current/docs/vision.md`, `current/docs/architecture.md`; `current/prod/state-manager/DIAGNOSIS.md` (19 confirmed defects); `current/tickets/02-state-manager/SM-101` ("Retire `solver.js` … a perfect search over a tool set that regenerates instead of transforms still regenerates"); `current/docs/architecture-gaps.md` A1–A2 (binary satisfaction with "accept-forced" as 75% of outcomes; "a diffusion model maintains nothing deterministically. Its spec is a prior, not an inference rule").
- Verdict: **DROP**. The archive's own gap analysis is the reason; V2's screenplay-plus-tables is the replacement.

**A9.2 Tool signatures: what each tool preserves**
- Where: `current/prod/state-manager/src/signatures.js` (22 atoms, 40 tools, "which properties the tool maintains"); SM-100.
- V2: learned empirically and written as rules ("The image editor is not a camera", punch-ins are crops; i2v pins ends).
- Verdict: **DROP** the machinery; the two rules V2 has are the whole of what the signatures proved useful for.

**A9.3 The pass-through path as the default (use existing pixels before generating)**
- Where: `current/tickets/02-state-manager/SM-105` (grandma run: zero generated frames, 480 credits, reward 94.4 against 62.5–72.3 for generated runs; stated caveat: one 5-second clip), `SM-102` (37 paid generations vs 24 deterministic ops in four runs).
- V2: exactly this for punch-ins (`CROP_DIRECT`, `cropFor`).
- Verdict: already in V2; the numbers are evidence worth citing on T-001.

**A9.4 Role is per beat, not per entity (a lighthouse is a place in one shot and an object in another)**
- Where: `current/docs/architecture-gaps.md` A3; `PRD-022`.
- V2: the element table has one `kind` per element; the Vanderbilt cutaway made Hampton Roads the place and the steamship a prop, which worked.
- Verdict: **DROP**; the case is served by declaring both an exterior place and a prop when a story needs them.

### A10. The TESTING-TODO items never done, and what became of each

| item (`cleaned/docs/TESTING-TODO.md`) | status | where it lands |
|---|---|---|
| A1 one pass per scene at scene length | run once at 15 s (3 of 5 lines, 0.74 first frame) | dropped (A7.3) |
| A2 clip-to-clip join on the last frame | superseded by pinning both ends | dropped (A4.3) |
| A3 cut every ~10 s with a size change | in V2's shot rules and grid | in V2 |
| A4 seam fillers (dissolve, insert, nothing) | never run; no seam problem recorded under pinning | not needed; A7.7's 40 ms audio crossfade is the audible half |
| A5 model duration table | done (V2 `GRID`, reference sheet) | in V2 |
| B1 keyframe vs reference identity and state check | never run | A6.3 |
| B2 pinned pairs where it matters | superseded (all pinned) | in V2 |
| B3 treatment control (style ref on a Commons photo) | never run | A2.4 |
| B4 reference pick rejects stereographs | prompt changed, not exercised | T-012 |
| B5 burned-in text check | never run | A5.6 |
| S1 shot-level screenplay vs the three-document split | decided 2026-10-29 | in V2 |

### A11. Already in V2, with earlier evidence worth citing in its tickets

- Medium as the noun of the prompt (`V2/src/assets/assets.js` lines 41–45): evidence `cleaned/experiments/bakery-tests.mjs` S1 and PRD v4 line 36.
- Portraits only where needed (T-002): `cleaned/runs/exp-isolated/results.json` T3 ("all 6 re-paints on steps that added nobody but passed sheets of characters already in the frame") and T5 ("same edits without those sheets: 4/4 kept framing, Red ×1", SSIM 0.898–0.95 to the base). This is stronger evidence than the vanderbilt6 reasoning T-002 cites.
- Quarantine (a flagged still stops its chain): `current/tickets/01-prd/PRD-030` and `SM-300` describe the failure of not having it.
- Captions as overlays, subtitles by code, the research gate with web search, the Commons pick with provenance, `style_ref`, the credit cap with reservation, the signature cache, the pending-job record, the title card by code, the policy-safe resubmission: all in V2 with their origins in `cleaned/`.
- Duration on the model's grid: `cleaned/experiments/fact-shots.mjs` line 22–23 is where the snap-to-grid began; `PRD-023` in `current/` is the fixed-5-second failure it corrects.

---

## B. Where the old PRDs contradict V2's rules, and which is right

1. **Identity from the bank, always** (`cleaned/docs/approach-shots/PRD.md` lines 100–103; `V2/prd/10-decisions.md` 2026-10-29, superseded the next day) vs V2's portrait rule (a portrait only for someone not in image 1 or framed two sizes closer; `04-state.md` lines 41–46). PRD v4 lines 17–18 ("a sheet for anyone not yet in a frame") agree with V2, so the contradiction is between the two 29 October documents only. **V2 is right**: T3/T5 above measured that sheets of people already in the base caused every re-paint and the duplicated Red; the chain's identity swap (vanderbilt2 handshake) happened with portraits sent only on entry *and* no identity gate, which V2's clip gate and A6.3 cover. Watch the "two sizes" threshold on the first paid V2 run.
2. **Audio off in every clip** (`cleaned/docs/PRD-video.md` line 23: "each clip's sound would be invented independently and clash at cuts") vs V2 audio on (`06-sound.md`). **V2 is right** for dialogue (free on wan-3.0, every vanderbilt6 line transcribed correctly), and PRD-video's concern is real: it is exactly T-014 (room tone per scene) and A7.6.
3. **Automatic retries** (PRD.md S4 up to 3 attempts; PRD v4 §5 one retry; approach-shots line 103 "a wrong third or count is one retry") vs V2 flag-only. **V2 is right**: the retry share was 32–50% of credits in the bakery audit, 36 of 57 tries in rrh4 failed on criteria later judged notes, and the two costliest vanderbilt6 failures were unwatched retries.
4. **The frame is the state; no text state** (`cleaned/docs/PRD.md` lines 15–28) vs V2 "state is kept in tables" (`00-overview.md` principle 6). **V2 is right**: draft PRD v3 and B-009 already conceded "two descriptions of one state that can disagree (G-005)"; the shooting script makes the text the single source and the pixels its carrier, and vanderbilt6's screenplay passed with zero continuity notes.
5. **Edit chains from the latest frame** (PRD.md thesis 3; PRD v4 §1) vs V2's master rule and crops. **V2 is right**: approach-keyframes line 26 ("once a frame goes wrong, every frame after it inherits the fault"), the head swap, and R-005's slide 12 re-painted room inherited by every later slide.
6. **Grids are better than chains** (draft PRD v3 §6b) vs PRD v4 §2 ("grids hold look and nothing else"). **PRD v4 and V2 are right**; the draft was overturned by its own measurements.
7. **The screenplay has no camera directions** (PRD v4 line 44) vs V2's shooting script with camera fields. **V2 is right** (vanderbilt3 lost the staging between documents, `10-decisions.md` 2026-10-29).
8. **The motion prompt is written by a vision model** (PRD-video line 19) vs V2 "no model writes a prompt after the screenplay". **V2 is right** in principle and not yet contradicted by a measurement; if clip quality drops on a moving-camera case (T-004), the comparison is one clip each way.
9. **Seeds only when needed; props from text** (draft PRD v3 §6) vs V2 (every character gets a portrait or sheet; props text-only). Aligned on props; V2 is stricter on characters, which the identity evidence supports.
10. **Scene time required** (`03-screenplay.md` schema) vs `CASES.md` §C ("meaningless for interiors without windows, screens, studios … optional"). **CASES is right**; it is part of T-004.
11. **"Music: no Magic Hour endpoint"** (ticket V-009, `current/prod/pipeline-memory/src/audio.js` line 3) vs `V2/reference/magic-hour-api-sheet.md` (`/v1/ai-music-generator`, 1 credit per second, confirmed 2026-10-30). **V2 is right**; the old note is stale.
12. **V2's own code vs V2's PRD, keyframe template.** `05-keyframes.md` lines 16–31 and 58–63 specify FRAME, PEOPLE, CHANGES, REFERENCES, RULES with "Never the action paragraph, never a synopsis" (approach-shots line 62) and the decision of 2026-10-30 ("intention at an instant … never the action paragraph: those painted events that had not happened"). `V2/src/keyframes/template.js` lines 22–26 prepend a CONTEXT block that includes the shot's action text ("During the shot, after this frame: … None of that has happened yet in this frame"). The measured failure this rule came from (a handshake before the handshake, a baked loaf before the oven) was a prompt that named the event and told the painter it had not happened yet. **The PRD and the decision are right**; the test in `V2/tests/state.test.mjs` asserts no walls or camera prose but not the absence of action text. Fix the template (or make the PRD say why the labelled action is safe) before the first paid V2 still.
13. **V2's own code vs V2's PRD, the crop threshold.** `04-state.md` line 53 and `05-keyframes.md` line 80 say a crop is used directly "at 60% or more of the master's width"; `V2/src/keyframes/keyframes.js` line 16 sets `CROP_DIRECT = 0.5` ("1,000 px of a 2k master") and `pipeline.mjs` line 26 defaults `--crop-direct` to 0.5. One of them should change.
14. **A sceptical note on the clip gate's headline.** `04-state.md` line 86 says the clip gate "caught Stanton turning into Vanderbilt mid-clip while both pinned ends matched (first frame 0.967, last 0.975)". In `cleaned/runs/exp-vanderbilt6/run.json` those SSIMs belong to the kf1 clip 1, whose record carries no identity verdict, and every kf2 clip record (including the attempts forgotten by `--retry`) says `drift: false`. The catch may be real and unrecorded; before the gate's wording is trusted, re-run it on that clip with `--recheck` and keep the verdict in the record.
15. **The stitch at 24 fps.** `07-edit.md` line 45 fixes the stitch at 24 fps; the measured judder (A4.5) says that is the one number in the stitch that should not be fixed.

---

## C. The five ideas most worth adopting now

1. **Stitch at the clips' native frame rate, drop the duplicate frame at continuations, 40 ms audio crossfades** (A4.5, A4.4, A7.7). Measured: forcing 30-fps wan-3.0 clips to 24 "drops 1 frame in 5 … judders through every clip". It is in V2's `media.js` today, it costs nothing, and it is in every film the pipeline will ever make.
2. **The four library fixes**: keyed clip-gate schema (A3.5), empty/zero-byte download guards with the charge recorded first (A6.7), narration cached by content hash (A7.8), a run lock (A6.8). Each has a recorded failure behind it ("a free list once answered only 1 of 14"; FIX-201/202; HUNT-202) and each is an hour of work in `V2/src/lib`.
3. **Beats quote their story source, checked in code** (A1.3). The one measured leak in the "no business" rule (3 story sentences → 11 beats) has no check in V2; it is the check fiction mode needs before T-010 pays for anything, and it is deterministic.
4. **A calibration harness and focused, keyed questions for the gates** (A6.1, A6.2, A6.3). The verifier-sensitivity method measured 12/12 and 3/3 where the pipeline's question had failed; T-003 is open with the labelled vanderbilt6 stills already on disk; and the people gate's boxes make the per-person identity crop free.
5. **The audio mixer from `pipeline-memory`** (A7.6): beds per scene, a duck envelope under narration, two-pass `loudnorm` at the stitch. The vanderbilt6 film peaks at 0 dB; the code exists, is deterministic, and closes T-014 and T-015 at no credit cost.

Next in line, each needing a small paid measurement first: the medium check on generated sheets for T-010 (A2.1), the style reference on a Commons plate (A2.4, 600 credits), SSIM reporting on edit stills (A5.3, free), colour matching within a scene (A4.2, free), and the lip-sync path as arm (c) of T-017 (A7.5).

---

## Counts

Entries with a verdict: **ADOPT 12 · ADAPT 27 · DROP 21** (60 entries). A9.3 and the items in A11 are already in V2 and carry no verdict.

ADOPT (12): A2.1, A3.5, A4.4, A4.5, A5.6, A6.1, A6.2, A6.7, A6.8, A7.5, A7.6, A7.8.
ADAPT (27): A1.1, A1.3, A1.5, A2.3, A2.4, A2.6, A2.7, A2.8, A2.9, A3.1, A3.2, A3.3, A3.6, A4.1, A4.2, A4.6, A5.3, A5.4, A6.3, A6.5, A6.6, A6.9, A6.10, A7.2, A7.7, A8.1, A8.3.
DROP (21): A1.2, A1.4, A1.6, A2.2, A2.5, A3.4, A3.7, A4.3, A4.7, A5.1, A5.2, A5.5, A6.4, A7.1, A7.3, A7.4, A8.2, A8.4, A9.1, A9.2, A9.4.
