# 2. Assets

**Purpose.** Produce the element table and one reference per element that must look the same every time it is drawn, then
the facts about those references that later stages query: the cast lines, the voice bank, the plate descriptions.

**Module.** `src/assets/assets.js`, `runAssets({ log, run, jobs, reuse, map, generate })`; the plate descriptions are
`State.describePlaces()` in `src/state/state.js`, called by the pipeline right after the assets stage.

**Inputs.** The story (and in nonfiction mode the research looks), the mode, optionally an earlier run to reuse
(`--reuse <dir>`), optional explicit reuse mappings (`--map new-id=old-id,…`), and whether generation may spend
(`--no-generate` turns it off).

**Calls and outputs.**

1. *Element table* (text, effort medium, from the story). Schema per element
   `{ id (lowercase slug), name, aka, kind: character | prop | place | fixture, real: bool, searches: [str], look }`.
   `look` is what never changes (build, face, clothing of the period, material, style), never a state. `searches` are 2–4
   Wikimedia Commons search strings from specific to plain. Fixtures are the fixed things of a place the action uses (a
   doorway, a counter, a fireplace). In fiction mode every element is forced to `real: false` with no searches. **built**.
   (The `scenes` list of the `cleaned/` schema is gone: the screenplay, not the element table, says who is in which scene.)
2. *Medium* (text, effort low). Schema `{ person, object, place, cell, frame, treatment }`: the medium as the noun of every
   image prompt ("A studio photograph of a real person", "A period-accurate live-action documentary photograph of"), a closing
   sentence for a frame, and the treatment line that names colour or monochrome, grain and finish once. The medium must be
   the grammatical noun of the prompt; "reference sheet of a character ... photographic footage" gave figurines and cartoons
   in the bakery runs. **built**.
3. *Procurement*, per element, places first, then the rest:
   - **Reuse** (`--reuse <old run dir>`): the earlier run's bank entry is copied when the element matches: the same id; else
     `--map new-id=old-id` names the match explicitly; else the same kind with the same common name (`aka`) and, for a place,
     the same interior or exterior sense; else the same normalised name. The entry keeps its provenance plus `reused_from`.
     **built, not yet exercised** beyond the first V2 run (the White House interior reused the generated `mansion-int` plate of
     vanderbilt2 through `--map white-house=mansion-int`; Vanderbilt's portrait matched by name).
   - **Real things** (nonfiction): Wikimedia Commons, through its search API (file namespace, image info with a 1024-px
     thumbnail, licence, date, artist). Search strings are pooled, the model's then "<name> portrait" / "<name> photograph"
     / "<name> <decade>" then the bare name, because "Cornelius Vanderbilt portrait 1860 1865" found nothing and
     "Cornelius Vanderbilt portrait" found the Brady daguerreotypes. Up to 10 candidates are downloaded and ONE vision call
     picks the best depiction of the thing itself (not a map, a page of text, a statue, a replica, a two-up or stereograph
     card) or none. Provenance (title, page, licence, date, artist, why) is kept in the bank. **built**.
   - **The plate check** (`plateUsable`, one vision call on the picked candidate, places only): a Commons picture used as a
     plate must be an empty view of the place, with at most two distant people and no crowd or event, and, when the story's
     style is live-action, documentary or photographic, a photograph: an engraving pulls every frame painted into it to line
     art. A rejected pick falls through to generation. Added after the first V2 run accepted an 1862 engraving of a crowded
     ballroom as the White House interior and a Harper's Weekly battery with 24 soldiers as Hampton Roads. **built**.
   - **Candidates in turn, and the record kept** (2026-10-30): a place's Commons candidates are tried in rank order, up to
     three, until one passes the plate check; the first pick alone once lost the real F-35 cockpit to an exterior
     photograph with two people in it. When no candidate is usable as an empty plate but a real picture of the place
     exists, that picture is kept as the place's `record` and the plate is generated FROM it ("this real place, emptied
     of people, as a set"), so the look comes from the record and not from words. **built, not yet exercised**.
   - **Generated** (fiction, or a real thing with no usable record): a character as a full-length studio photograph on a
     plain light-grey backdrop; a place as an empty plate "of" the place; every later plate edited against the first accepted
     generated plate as the style reference so plates made apart cannot drift to sepia (PRD v4 §4b, "style is state"). With
     `--no-generate` the entry is recorded as `pending-generation` instead and nothing is spent; the next run without the flag
     generates it. **built**.
   - **Props are pictured too**: a real prop from Commons, else generated like a character (the medium's object noun, the
     whole thing from the side in its natural setting, the style reference for the colour treatment). The state manager can
     only hold a thing consistent through a picture it can send: the Top Gun warship, an invented prop left as text, was
     painted as a different ship in the wide, on the cockpit screen, and again on the next screen frame. An earlier run's
     text-only prop is procured on the next run; `--no-generate` records `pending-generation`. **built and run** (the Top Gun warship sheet).
   - **Text only**: fixtures, which their place's plate carries. **built**.
   - **A generated sheet is checked against its own look** (`sheetMatchesLook`, one vision call): anything the description
     rules out that is nonetheless in the picture, and any prominent thing the description never mentions, flag the sheet;
     the run stops after the assets stage and the user says `--retry root-<id>` (a fresh sheet, the earlier one kept in
     `bank_attempts`) or `--accept root-<id>`. The image model put an offshore platform on an open-sea plate whose look
     said "no coastal landmarks or buildings", and the platform was then "missing" from every wide painted from it.
     **built, not yet exercised**.
4. *Cast feature lines* (vision, effort low, one call per portrait, no salt): at most 15 words of telling features that tell
   this person from the others in the film (hair, beard or whiskers, glasses, build), never clothes or expression. These name
   the portraits in every prompt ("white side-whiskers, no glasses"), because two bearded men in dark coats were confused when
   named by name alone. **built**.
5. *Voice descriptors* (text, effort low, one call): one performable line per character (pitch, pace, accent, timbre) from
   the record where it says anything, else plausible for the person's age and origin; the V2 call asks for no commentary about
   sources, because the `cleaned/` lines carried phrases like "plausible rather than documented" into the clip prompts.
   **built**.
6. *The voice bank* (text, effort low, one call; then one TTS call per voice). From the descriptors, a model picks a
   ready-made OpenAI TTS preset for each character and one for the narrator, from `alloy`, `ash`, `ballad`, `coral`, `echo`,
   `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse` (each described to it by gender, pitch and manner), and writes a one-line
   delivery instruction (pace, tone, accent colouring, age). No impersonation of a real person's actual voice, only a
   plausible performance. A short sample per voice is rendered once with `gpt-4o-mini-tts` for approval,
   `runs/<label>/sound/voice-<id>.mp3` (the narrator reads the title; a character reads his name and the story's first
   sentence). The choice is stored as a property of the asset:
   `bank[id].voice = { provider: "openai-tts", preset, instructions, descriptor, why, sample, sample_text }`; the narrator is a
   bank entry of its own, `bank.narrator = { source: "voice-only", voice }`. The state manager's elements table carries it
   (`04-state.md`). A preset is stable by construction: the same voice reads every line of that character. **built, not yet
   exercised**.
7. *Plate description* (vision, effort low, one call per plate, in `State.describePlaces`): walls, floor, light, and every
   fixture and piece of furniture with its side of the picture (left, centre, right), depth (foreground, middle, background)
   and a short detail. This fills the state manager's place table and is given to the screenplay call as `seen`, so shots
   are staged around the real furniture. The first Vanderbilt screenplay asked for "an arm's length from Lincoln" across a
   centre table it did not know existed. **built**.

**Special preparation cases** (from `drafts/CASES.md` §A–B), all **design**: items (an archival photograph, a packshot, a
logo, shown as-is with a move done by ffmpeg); screens (an app, a slide deck, a game; its state is what it shows, rendered
or captured separately and composited); products with states (raw, baked, wrapped) as props with a `condition`; music tracks
with a beat grid.

**Rules.** Identity references are fixed for the whole film; a person's face and clothes never come from a previous frame.
A plate is an empty photograph of the place. Reject stereograph cards, mounts, two-up images and text pages in the pick
(ticket T-012: the exterior plate chosen for Vanderbilt in `cleaned/` was a stereograph, "two near-identical side-by-side
views"; the V2 pick prompt names two-up and stereograph cards as rejections, not yet exercised on that case).

**Checks.** The vision pick; the plate check; the medium set check from the bakery work (medium, single subject, major miss)
is not carried into V2 yet.

**Cost.** Commons: none. Generated: 200 credits per sheet or plate at 2k. Text, vision and TTS calls: none in credits.

**Status.** Built for people and places; the plate description, the plate check, reuse with `--map`, and the voice bank are
built, the last three exercised only as far as the first V2 run went (text and samples, no painting); items, screens,
products are design.
