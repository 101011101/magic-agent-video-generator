# V2 — Product requirements, overview: natural language → story → screenplay → keyframes → clips → film

Written 2026-10-30 from the `V1/` work of 26–30 October (the bakery ad, the Vanderbilt runs vanderbilt2 to vanderbilt6)
and the decisions taken with the user in that period; restructured into one file per subsystem the same day. Everything
marked **built** exists in `V2/src` and has run; **built, not yet exercised** means the code is in `V2/src` and passes the
tests but no paid run has gone through it; **design** has not been coded. Numbers are measured ones; where there is no
measurement the text says so.

Files in this directory, in pipeline order:

| file | subsystem |
|---|---|
| `00-overview.md` | this file: the data flow, the principles, one paragraph per subsystem |
| `01-story.md` | natural language → story, with the research gate that sets the mode |
| `02-assets.md` | the element table, procurement, the cast lines, the voice bank, the plate descriptions |
| `03-screenplay.md` | the shooting script: schema, rules, checks |
| `04-state.md` | the state manager: the tables, the reference rules, the gates, the review loop |
| `05-keyframes.md` | the keyframe prompt template and painting |
| `06-sound.md` | voices, narration, ambience, effects, subtitles, captions; the options |
| `07-edit.md` | clips, the clip gate, the stitch, the narration mix |
| `08-costs.md` | credits per item and per film |
| `09-status.md` | what is built, built but not yet exercised, and design only |
| `10-decisions.md` | the dated decisions log |

## Models and services

Used everywhere unless a section says otherwise:

- Text and vision: OpenAI Responses API, model `gpt-6.1-sol`, strict JSON schema output, disk cache keyed on model, call name,
  schema, prompt, images, effort, tools and an optional salt (`src/lib/llm.js`). Not metered in credits here.
- Stills: Magic Hour `/v1/ai-image-editor`, model `nano-banana-pro`, 2k, 16:9 (`src/lib/jobs.js`, `src/lib/magichour.js`).
- Clips: Magic Hour `/v1/image-to-video`, model `wan-3.0`, 720p, audio on, a start and an end frame.
- Narration and voice samples: OpenAI text-to-speech, model `gpt-4o-mini-tts`, one preset voice per speaker (`src/sound/sound.js`,
  `src/assets/assets.js`).
- Captions and subtitles: cards rendered by the system text engine (AppKit through `osascript`) and composited by ffmpeg
  (`src/lib/captions.js`); the Homebrew ffmpeg has no `drawtext`.
- Credits are Magic Hour credits. Every paid call goes through `Jobs`, which reserves against `CLEANED_CAP` and a ledger
  across runs before it posts, never retries a POST (the server may already have charged it), records the job id under
  `pending` as soon as the server returns it, and records the finished job with its prompt and inputs so a run can resume
  without paying twice.

## The data flow

```
brief ─► STORY        research gate → (research round) → story               mode = nonfiction | fiction
      ─► ASSETS       element table → procurement (Commons | generate | reuse) → cast lines → voice bank
                      → plate descriptions (the state manager's place table)
      ─► SCREENPLAY   one call: scenes → shots → a first and a last frame per shot for EVERY element,
                      timed beats (action, lines, narration, effects)
      ─► STATE        one pass over the screenplay: state.json (elements, places, stills, clips);
                      the queries every later stage asks; the gates
      ─► KEYFRAMES    one prompt per distinct frame, assembled by code; painted or cropped; gated
      ─► EDIT         clips: pinned on two keyframes, from the first only, text-to-video with the frames as references,
                      or SEQUENCES (one clip per run of shots, every keyframe a reference, cuts in the text, up to 15 s,
                      across scenes, faster playback for fast shots); gated; stitched with the music bed; captions, subtitles,
                      the narration mixed under
      ─► SOUND        voices inside the clips; narration by one preset voice; music is design
```

What each stage hands to the next:

- STORY hands a title, a style line, the prose story, the mode, and in nonfiction the numbered facts with sources.
- ASSETS hands the element table (the only ids the screenplay may use), the bank (one reference per element with its
  provenance), the medium sentences, the cast feature lines, the voice bank, and the plate descriptions.
- SCREENPLAY hands the shooting script, checked in code.
- STATE sits in the middle: it reads all of the above once and writes the tables (`state.json`); KEYFRAMES and EDIT never
  reason about the screenplay themselves, they ask the state manager which images a frame gets, who is in it, what changed,
  how a cut relates to the shot before it. Every painted still and rendered clip is recorded back into the same tables.
- KEYFRAMES hands painted stills (or crops of the master) with the gate verdicts. Each prompt carries the state
  manager's memory: the scene synopsis, the scene so far, the previous frame's state, what image 1 shows, and the film's
  style sheet as a reference.
- EDIT hands clips with the gate verdicts, then the film.

## Where the gates are, and the rule

Six gates, code plus one vision call each, all in the state manager (`04-state.md`), and one at procurement
(`02-assets.md`):

- the sheet check on every generated reference sheet (nothing its description excludes, no prominent extra);
- the people gate on every still (count, left-to-right order, the boxes for crops; the order only when identities can be
  told apart, the count not enforced for people the screenplay puts far away inside something);
- the room gate on every painted still (the arrangement against image 1 of the paint, told what the frame may show);
- the bars gate on every still, by code (black letterbox or pillarbox bars; thin ones cropped at the stitch);
- the style gate on every painted still (the medium and finish against the film's style sheet, faults only);
- the load gate on every painted still with something carried (what hangs from each host against what the screenplay puts
  on it, from the structured `on` field);
- the clip gate on every clip or sequence (count where countable, order where distinguishable, identity drift across
  frames sampled at two per second), plus the transcription of spoken lines.

They **flag only**. A flagged still stops its chain before clips; a flagged clip stops the stitch. Nothing is remade on its
own. The user looks at the item in the results page and says `--retry`, `--accept` or `--recheck`; `--dry` runs everything
but the paid calls and lists what they would cost.

## Principles

All of them decisions the user made during the work (dated in `10-decisions.md`):

1. **One creative document.** After the story, the screenplay is the only place a model makes a creative choice. Every
   keyframe prompt and every clip prompt is a transcription of it by code. No model writes a prompt after the screenplay.
2. **Never edit a generated prompt by hand.** A wrong prompt is fixed by changing the structure that produced it: a schema
   field, a rule in the call, a template, a query. "Macro fixes on the structure as a whole, never micro fixes."
3. **The reference carries the look; the text says only the moment, the positions and the changes.** A keyframe prompt does
   not describe walls, light, the camera's position or the fixtures: image 1 holds them. It says what the moment is, where
   the people are relative to each other, what changed since image 1, and which image supplies which face.
4. **Gates flag, people decide.** Every painted still and every rendered clip is checked by code and a vision call; a failed
   check marks the item for review and stops the next stage. Nothing is remade automatically. The user looks and says
   `--retry` or `--accept`.
5. **Nothing is paid without an explicit go.** The pipeline stops before the first still unless told to paint, and before the
   first clip unless told to film. Reruns of text-only stages are allowed when the structure changes, and are announced.
6. **State is kept in tables, not in prose.** Who is in which frame, where, what is behind them, which still was painted from
   which, which voice a character has, lives in `state.json` and is queried; it is never re-derived by a model.

## The subsystems in one paragraph each

**Story** (`01-story.md`, `src/story/story.js`). A small gate call decides whether the brief needs facts; that sets the mode
of the whole run. In nonfiction a research round with web search returns numbered facts and the documented looks, and the
story is written from those facts only, cited paragraph by paragraph. In fiction the story is written from the brief and is
where invention happens, so the screenplay can keep its rule of adding nothing.

**Assets** (`02-assets.md`, `src/assets/assets.js`). The story is read into an element table: characters, props, places,
fixtures, each with what never changes about it. Real things are referenced from Wikimedia Commons with a vision pick and
their provenance; a Commons picture used as a plate must be an empty photograph; the rest are generated with the medium as
the noun of the prompt and a style reference; an earlier run's bank can be reused. Then the cast lines (a feature line per
portrait), the voice descriptors, the voice bank (a ready-made preset voice per character and one for the narrator, with a
rendered sample), and the plate descriptions that fill the state manager's place table.

**Screenplay** (`03-screenplay.md`, `src/screenplay/screenplay.js`). One call turns the story into the shooting script:
scenes with their place, tone, the 180-degree line and the blocking; shots with their camera, seconds on the clip model's
grid and a moment; and for every shot a first and a last frame for every element, in frame or off, with positions, pose,
hands and what each person is doing; the timed action, lines, narration and effects between them. Code checks timing,
presence, continuity and vocabulary before anything is paid.

**State manager** (`04-state.md`, `src/state/state.js`). One pass over the screenplay produces the tables: the elements with
their properties (reference, feature line, voice), the places with what their plates contain, the distinct stills with who is
in them and what each is painted from, the clips. It answers the templates' questions (which images, who needs a portrait,
who is off frame, how the cut relates, where to crop the master) and runs the gates.

**Keyframes** (`05-keyframes.md`, `src/keyframes/`). One short prompt per distinct still, assembled from the tables:
FRAME, PEOPLE, CHANGES, REFERENCES, RULES, with no prose about the room. A still is painted from the plate, edited from the
previous still, or, for a tighter setup, cut from the painted master and used as it is or re-rendered at full detail.

**Sound** (`06-sound.md`, `src/sound/sound.js`). Dialogue, ambience and effects are performed inside the clips by the video
model from the screenplay and the voice descriptors. Narration is produced afterwards by one preset voice and mixed under the
film. Subtitles come from the lines by code; captions are overlay cards. The voice bank fixes a preset per character;
dialogue by TTS plus lip sync, voice conversion, room tone per scene, loudness and a voice gate are the open options.

**Edit** (`07-edit.md`, `src/edit/edit.js`). One clip per shot, pinned on its two stills, from a prompt that carries the cast
feature lines, the moment, the timed beats and the sound; the clip gate; the stitch at 1280×720 with the captions at the top
and the subtitles at the bottom; the narration mixed under at the end.
