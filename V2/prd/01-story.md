# 1. Story

**Purpose.** Turn a brief into a story the rest of the pipeline can trust, and decide whether that story may invent.

**Module.** `src/story/story.js`, `runStory({ brief, log, run, seconds })`.

**Inputs.** The brief (one sentence to a paragraph of natural language, with the deliverable where the user gives it: "a
30-second live-action film") and the film's length in seconds.

**Calls and outputs.**

1. *Research gate* (text, effort low, `research-gate-v2`). Two separate questions, because an invented ad can star a real
   aircraft: `fiction` (are the events to be invented, a story, an advertisement, a scenario; or must the film show what
   actually happened) and `needs_research` (does any real person, place, event, vessel, aircraft, building or object appear
   whose facts or documented look matter). Schema `{ fiction: bool, needs_research: bool, confidence: int, why: str,
   queries: [str] }`. The mode written into the run is `fiction` or `nonfiction` from the first answer; research runs on the
   second, in either mode. The assets subsystem reads the mode: in fiction the people are invented (`real: false`, no
   Commons search) while a real aircraft, vessel, vehicle, building or place keeps its record.
2. *Research round* (text with the `web_search` tool, effort medium), whenever the gate says research is needed. In nonfiction it collects the facts of one episode; in fiction it collects what the real things are and can do, and the documented looks, which the invented story must respect. Schema
   `{ subject, facts: [{ n, fact, when, source }], looks: [{ thing, look, source }] }`: 6–10 verified facts around one
   episode that can be shown in the film's length, each with a date and a URL; the documented look of every real person,
   place, vessel, building or object involved, each with a source. **built**.
3. *Story* (text, effort high). Schema `{ title, style, story, fact_use: [str] }`.
   - Nonfiction (`fact-story`): every sentence must be supported by a numbered fact and `fact_use` lists which facts each
     paragraph uses; no invented event, line or object; the story names people, places, vessels and years as the facts give
     them; 120–200 words for a 30-second film. `style` is one line of visual style the assets subsystem turns into the medium.
     **built**.
   - Fiction (`fiction-story`): the same shape without the fact constraint: plain prose, only what a camera can show and a
     microphone can hear, every character, place and important object named once and used consistently, a small cast (at most
     four people) and few places (one or two), nothing the brief contradicts; `fact_use` empty. **built and run** (the Top Gun ad: "Together, On Target", reused across three runs).

**Rules.** Nonfiction: facts only, cited; the story names people, places and years as the facts give them. Fiction: the story
is where invention happens, so that the screenplay can keep its rule of adding no business.

**Checks.** None in code beyond the schema. The `fact_use` list is the audit trail.

**Cost.** Three text calls; no credits.

**Status.** Built for nonfiction. On the Vanderbilt brief the gate asked for research both times it was run: in `cleaned/`
the round returned seven facts and the documented looks and the story "I Accept Her" used them (dialogue-led); in the first V2
run (`vanderbilt`, 2026-10-30) a fresh round returned eight facts and nine looks and the story "Instead of a Price" told the
same episode in narration, which is why the screenplay needed a narration field (`03-screenplay.md`). Fiction mode is not
exercised end to end (ticket T-010).

**The story is an asset too** (added 2026-10-30). A rerun with `--reuse <old run>` and the same brief keeps the earlier
run's gate, mode, research and story, so the element table and the bank match and nothing is procured twice; a reused
story without a `kind` gets one from a small call on the brief. A fresh story once renamed every character of the Top Gun
ad and nothing in the bank matched. The story carries `kind` (drama, ad, trailer, documentary, explainer, music-video,
short), which sets the screenplay's cutting pace.
