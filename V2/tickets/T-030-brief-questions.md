# T-030 · The brief questions: what every story and screenplay must answer, and asking the user when the brief does not

status:     open
priority:   high
subsystem:  story, assets, screenplay, results

## The user's request (2026-10-31)

> for the conversational stuff what we are going to do is in the asset bank portion itself and during the story writing
> + screenplay, we will have a couple sets of broad questions every screenplay and story should answer such as theme,
> subtle messaging, image size, content platform, target audience, etc. If the original natural language prompt can
> answer it then there is no problem, if it's ambiguous then it will ask the user some more questions for those points.

what:
A fixed list of questions the film must answer before the story is written, filled from the brief where the brief
answers them and asked of the user where it does not. The structures:

1. **The brief sheet**, a schema in `story/story.js` with one field per question. First list:
   - `theme`: what the film is about underneath (the screenplay's `theme` field is then given, not invented);
   - `message`: the subtle messaging, what the viewer should come away believing, never said out loud;
   - `audience`: who it is for (age, interest, what they already know);
   - `platform`: where it plays (TikTok, Reels, YouTube, broadcast, a pitch deck); it decides the next three;
   - `aspect` and `size`: 16:9, 9:16, 1:1 and the resolution; today `IMAGE.aspect_ratio` and the video body in
     `lib/jobs.js` are fixed at 16:9;
   - `length`: seconds (today `--total`);
   - `kind`: ad, drama, trailer, documentary, explainer, music video, short, podcast (today guessed by `film-kind`);
   - `register`: tone and the register of the voice (formal, playful, deadpan);
   - `language` of the lines and captions;
   - `must_include`: people, products, places, lines or captions the user named; `must_avoid`;
   - `call_to_action` and `brand` for ads; `sources` the user wants respected for fact films;
   - `materials`: pictures or audio the user is supplying (today `--reuse` and the Commons search; a supplied portrait
     should enter the bank as the record of that person);
   - `direction` (added 2026-10-31, `prd/11-agent.md` branch V): `stated` | `free` | `needed`; `needed` always asks
     (message, tone, the ending for a drama) before the story is written; `free` never asks and shows what it chose.
   And in the element table (`assets.js`), the real/not-real boolean becomes a three-way `source`: `research` |
   `user` | `invented`; a `user` element without a supplied material asks for it; a `research` element whose search
   finds nothing usable asks rather than generates. The questions run in the tree's order (goal first, then the
   branch), before any creative call.
2. **The brief check**, one text call before the research gate: for every field, the value, `source: stated | inferred |
   unknown`, and a confidence. `stated` passes. `inferred` with high confidence passes and is shown. `unknown`, or
   `inferred` below the threshold, becomes a question. Questions are few, specific to the brief ("Is this for TikTok or
   YouTube? It decides portrait or landscape.") and never more than five; the rest take the defaults in the sheet
   (16:9, 30 s, English) and say so.
3. **The asking.** `pipeline.mjs` writes `runs/<label>/questions.json` and stops when a question is open; `--answers
   questions.json` (edited) or `--answer platform=tiktok,audience=…` resumes; `--ask` asks in the terminal. The agent
   layer (T-034) asks in conversation. Answers are part of the run record (`L.brief_sheet`) and of the story's reuse key:
   the same brief with different answers is a different story.
4. **Where the answers go.** Story: audience, message, register, kind, must-include. Assets: aspect and size into
   `IMAGE` and the video body; supplied materials into the bank as records. Screenplay: theme given; platform sets
   `PACING` and the caption safe margins (a 9:16 short keeps text out of the top and bottom bands). Results page: the
   sheet at the top, with which answers were stated, inferred or asked.
5. **The asset bank** gets the same treatment for elements: when an element's look is ambiguous in the brief (which
   F-35, whose face), the bank check asks rather than guesses, with the Commons candidates shown as the choices.

why:
The feedback of 2026-10-31: the agent must be able to ask. Today the pipeline infers everything from one sentence; the
Top Gun brief never said platform, audience or aspect, and the film is 16:9 at 30 s by default. The research gate
already asks itself two questions in `story.js`; this generalises it and sends the open ones to the user.

acceptance:
On the two existing briefs the check lists which fields are stated, inferred and unknown; the Top Gun brief asks about
platform, audience and message and nothing else; a brief that states everything asks nothing. A run with `--answer`
shows the answers in the story and screenplay prompts and on the results page, and a 9:16 answer produces 9:16 stills
and clips. Text calls only; no credits beyond a run that was going to happen anyway. The benchmark (T-031) carries one
brief whose only purpose is to trigger questions.
