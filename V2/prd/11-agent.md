# 11. The agent: conversation in front, tools behind, the session in between

Written 2026-10-31 from the user's decisions of that day (T-030, T-033, T-034; the feedback of 2026-10-31 in
`../drafts/`). Nothing in this file is built. The film chain of `00-overview.md` is unchanged; it becomes one tool.

## What it is

One subsystem, `src/agent/`, that every request enters through. It reads the message, decides which tools the request
needs, makes sure the universal questions are answered with confidence, asks the user only for what is still ambiguous,
states the cost, runs the tools on the cheapest models that can do the job, shows the result, and keeps the session so
the next message can change what was just made.

```
message ─► SESSION    load sessions/<id>/session.json: messages, assets made, runs started, the sheet so far, credits
        ─► SHEET      the question tree, in order: Q0 the goal, then the branch's questions; each filled from the
                      message and the session (stated), inferred with a confidence, or unknown; the asset a message
                      refers to ("it", "the ending", "the second picture") is resolved here against the session
        ─► ASK        anything unknown or below the threshold: at most a few questions in one message, specific, with
                      the default named; stop here until answered. Nothing creative has run yet.
        ─► PLAN       desired state (from the sheet) against current state (the materials): the shortest path of tool
                      groups between them, each in-between state named, each tool's model from the registry by tier
        ─► COST       the estimate from the registry and the cap; above the threshold, wait for a yes
        ─► RUN        the tools through lib/jobs.js (cache, cap, ledger); for a video this is where creative direction
                      and asset sourcing begin: the film tool is pipeline.mjs with the sheet as its answers
        ─► CHECK      the tool's gates: flag only, never remake
        ─► SHOW       the result, what it cost, what can be changed; write the session; next message
```

The order matters: questions before planning, planning before anything creative. The sheet decides what is wanted;
the plan decides which tools and parameters get there; only then does a story get written or an asset sourced.

## The questions come first, in order

Nothing creative runs until the questions are answered. The first question decides which questions follow, so the
sheet is a tree, not a list: the goal first, then the branch's own questions, each filled from the message and the
session (stated), inferred with a confidence, or asked. Only when the branch's questions are all answered with
confidence does a tool run, and for a complete video that is the moment the story is written.

How every question is filled, in this order: (1) the message states it; (2) the session states it (an earlier answer,
a supplied file); (3) the agent infers it above the threshold and says so in the reply; (4) it is asked. A question is
never asked for what (1) to (3) answered, and never asked when the branch does not need it.

### Q0 · The goal

What is the output? One of:

| goal | what the user wants | branch |
|---|---|---|
| **video** | a complete piece with a story: an ad, a short, a drama, a podcast, a trailer, a documentary | V |
| **image** | one picture, or a few | I |
| **change** | something done to an asset that exists: an edit, a swap, captions, an upscale, a style, a range of a film | C |
| **sound** | speech, a voice, music, a dub | S |
| **find** | a fact, a reference picture, an estimate; nothing made | F |

Stated by the words ("make me an ad", "swap", "add subtitles"); inferred from the materials (a clip plus "my face" is a
change); asked when neither ("make something cool"). A verb alone does not decide it: "edit me a picture of a
lighthouse" with no asset is **image**.

### Branch V · a complete video

In this order, because each narrows the next:

1. **kind**: ad, short, drama, podcast, explainer, documentary, music video, trailer. Usually implied by the goal's
   words and the platform; sets the pacing table and which later questions apply (a podcast asks for speakers, an ad
   for the call to action).
2. **platform**: TikTok, Reels, Shorts, YouTube, broadcast, a deck, none. Sets `aspect` (9:16 or 16:9), the caption
   safe margins, and the length conventions. Default 16:9 if nothing implies a platform.
3. **length**: seconds. Default by kind and platform (15 s short, 30 s ad, 2 min podcast).
4. **audience**: who it is for. Default general; inferred from the platform and the subject more often than asked.
5. **direction**: the creative stance, one of `stated` (the brief gives tone, ending, style, or message), `free` (the
   brief says surprise me, your call), `needed` (neither). `needed` is the one branch value that always asks, because
   a story written on a guess is the most expensive thing to redo. The questions under it: the message (what the
   viewer comes away with), the tone, and for a drama the turn or the ending.
6. **must include / must avoid**: names, lines, captions, products, a call to action for an ad.
7. **materials**: what the user is giving (pictures of a person or a product, a logo, a voice sample, a clip) and what
   each is the record of.

Then the chain as `00-overview.md` has it, with two changes inside it:

- **Story** keeps its gate (fiction or nonfiction; research needed or not) and now receives `direction`: with
  `stated` it follows, with `free` it invents and the reply shows what it chose, with `needed` it does not run until
  the direction questions are answered.
- **Assets** gives every element a three-way **source** instead of the real/not-real boolean: `research` (documented
  somewhere public: Commons, the web), `user` (only the user has it: my cousin's truck, my dog, my product), `invented`
  (a fictional person, place or thing, generated from its look). The element call decides the three-way value; a
  `user` element with no supplied material asks for it; a `research` element whose search finds nothing usable falls
  back to asking, never to generating a stand-in. Supplied materials from question 7 enter the bank as the record of
  the element they match.

### Branch I · an image

1. **subject**; 2. **direction** (stated, free, needed, as in V, but the questions under `needed` are style and
mood, not an ending); 3. **platform** or **size** (aspect and resolution; default 1:1 or the platform's); 4. **real
things in it** (a person, a product, a place): each gets the same three-way source as an element, and a `user`
source means a supplied picture becomes image 1 of an edit rather than a generation from words; 5. **count**.
The tool is a generation when nothing is supplied and an edit when a material is the base.

### Branch C · a change to an asset

1. **the asset**: supplied in this message, named from the session ("the second one", "the ending"), or missing
   (asked). Its **provenance** (made by a run here, or supplied) decides the route (`T-035`).
2. **the change**, which picks the tool group below: identity (a face, a head, a body, a character), content (add or
   remove or alter something in the frame), look (style, colour, grade, colourise), form (upscale, reframe, outpaint,
   background), speech (captions, translation, dub, lip-sync), time (cut, join, trim).
3. **the reference**, only for identity changes: the face or character to put in. Supplied; or a real, public person
   (`research`; the agent says it will not swap a real person's face without their material and consent); or fictional
   (`invented`: a character sheet is made first, then the swap).
4. **the range**: the whole asset or a part (seconds for a clip, a region for a picture). Default whole.
5. **keep the rest**: default yes; the check is that nothing outside the range changed.

### Branch S · sound

1. **what**: speech from text, a voice for a character, music from a cue, a dub of a clip; 2. **the voice**: a preset
(the bank's), a clone from a supplied sample, or the request to sound like a real person (declined; a preset that
fits instead); 3. **length** or the text itself; 4. **attach to an asset?**: if yes it becomes a `C` change (lip-sync,
dub) on that asset after the sound is made.

### Branch F · find

Zero credit: a Commons or web search, a cost estimate, a question about a run. No sheet beyond the subject.

### The universal fields, and where each branch uses them

| field | V | I | C | S |
|---|---|---|---|---|
| goal (Q0) | yes | yes | yes | yes |
| subject | yes | yes | the asset | the text or cue |
| materials | yes | if a real thing | the asset, the reference | the sample |
| platform and aspect | yes | size | no (the asset's) | no |
| audience | yes | rarely | no | no |
| length | yes | no | the range | yes |
| direction / message | yes | yes | the change | the voice |
| must include / avoid | yes | yes | keep the rest | no |

A field a branch marks "no" is never asked on that branch. That is what keeps a face swap at zero questions.

## The tools, in groups

Every Magic Hour endpoint in `../reference/magic-hour-api-sheet.md` plus the pipeline's own code, abstracted by what
they do to state: each tool takes a current state (nothing, a picture, a clip, a sound) and produces a desired one.
The planner reasons in these groups first and picks the endpoint second; the registry (`lib/models.js`) picks the
model by tier.

| group | from → to | endpoints (free model where one exists) | pipeline code |
|---|---|---|---|
| **make** | nothing → picture / clip / sound | image generator (flux-2-klein, qwen); text-to-video (ltx-2.5, minimax-h3); music generator; voice generator; headshot, gif, meme, qr | — |
| **compose** | a brief → a film | — | the film chain: story, assets, screenplay, state, keyframes, clips, stitch; the podcast kind |
| **animate** | picture (+ sound) → clip | image-to-video (ltx-2.5, minimax-h3); talking photo; audio-to-video; lip-sync | sequences, pinned clips |
| **change identity** | picture / clip → same with another person | face swap photo, face swap video, head swap, body swap, clothes changer, face editor, character replace | — |
| **change content** | picture / clip → same with something altered | image editor (flux-2-klein, qwen-edit); video editor; animation (video-to-video style) | `--retry` / `--only` on a run's stills and clips |
| **change form** | picture / clip → same, bigger, cleaner, reframed | image upscaler, video upscaler, background remover, photo colorizer | the bars crop, the stitch |
| **speech** | clip (+ text) → clip with words | auto subtitle, video translator, dubbing, lip-sync, voice cloner | subtitle and caption cards |
| **find** | a question → an answer, zero credit | — | Commons search, web research, the cost estimate |
| **inspect** | an asset → a verdict, zero credit | — | the gates, the transcription, the plate check |

How the planner uses them: the desired state comes from the branch's answers (a 9:16 10-second clip of this serum,
with my logo, for Instagram); the current state is the materials (one photo of the serum); the plan is the shortest
path of groups between them (change content: logo onto the photo → animate: photo to clip; or compose, if there is a
story), with each in-between state named so the user sees it before paying. A path that needs a group no free model
serves is where the tier question is asked.

## Models: cheapest that can

The session's tier is `free` unless the user set another. A tool resolves its model from the registry: the cheapest
model on the tier that has the inputs, resolution and length the request needs. The agent moves up one tier only when:

1. the request needs what no free model has (a resolution, a reference count, a length, a feature such as references in
   image-to-video);
2. the tool's gate has flagged the same item twice on the current model and the user asked to try again;
3. the user says so.

Each move is said, with the cost, before it is paid. The agent's own calls (plan, sheet) use the smallest text model
that passes the benchmark's zero-credit cases; the film chain's text calls keep their own model.

## Editing (a separate subsystem, designed here, built later)

The user's reading: an edit is the output fed back as an input, with the time range and the instruction, to a tool
that can act on it. That holds, with one split by where the asset came from:

- **An asset this session made from a run** (a film, a still, a clip): the edit re-enters the run. The instruction is
  mapped to shots and seconds through `state.json` (which clip covers 0:12, which still it was pinned on), the agent
  runs `--retry` on those items and `--only` on what was built from them, and everything else is cached and unpaid.
  This keeps continuity (the tables, the references, the voices) that a video-to-video edit of the rendered film would
  lose, and it costs only the changed shots.
- **A foreign asset, or a whole-frame change** (the user's own clip; "make it all warmer"; a face swap over the whole
  film): the edit is a tool over the asset: image editor, character replace, lip sync, upscaler, the video editor
  endpoint, with the time range as the tool's start and end seconds. The result is a new asset in the session; the
  original is kept.

Both routes are the same to the user: name the thing, the part, the change. The agent picks the route from the session
record: made here, or supplied.

## The session

`sessions/<id>/session.json`, resumable like a run:

- the messages, in order, with the sheet as it stood after each;
- the assets: file, the tool and inputs that made it, the job, the cost, the run label where there is one; "the last
  image" and "the ending" resolve against this list;
- the runs started (labels under `runs/`), so `edit-run` can reach them;
- the tier, the cap, the credits spent in this session.

## What the user sees

A terminal loop first: `node V2/src/agent/agent.mjs [--session id] [--tier free]` reads a line, answers, loops. Every
reply is short: what was understood (the sheet's inferred values), the questions if any, the estimate before paid
work, the result with its page or file and cost, and one line of what can be changed. The same functions sit behind an
HTTP route later for the chat workspace in `archived/frontend`.

## Costs

Text calls only until a tool runs. A small job on the free tier is 5 to 50 credits. The film tool is `08-costs.md`'s
figure for the tier. The session cap defaults to 1,000 credits and the confirmation threshold to 500; both are flags.

## What is built, and what is not

Nothing. The pieces that exist and are reused: the registry and tiers (`lib/models.js`), the job layer (`lib/jobs.js`),
the film chain, the gates, the run record as the model for the session, the API sheet (`../reference/`) as the source
of the tool catalogue, and the archived clarification slots and capability catalogue in `archived/server/src/` as the
ancestors of the sheet and the catalogue. Tickets: T-030 (the brief sheet), T-031 (the benchmark that proves it),
T-033 (the small jobs), T-034 (the agent). Editing is its own ticket when the agent runs.
