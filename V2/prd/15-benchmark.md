# 15. The benchmark: what we test, how we grade it, where the cases come from

Draft 2026-10-31, for discussion before anything is built or run.

## Why this exists

The reviewer's ask, in his words: "we care about the output primarily", "create a benchmark set and share outputs
using it", "describe things for me and give me your assessment", free models only.

What we have now (`V2/bench/`, 41 cases) mostly grades the **process**: did the agent ask the right question, pick
the right tools, plan the right shape. That stays, as one layer, because it costs nothing. But it never says whether the
picture, the clip or the film is any good. This benchmark is built around the **output**.

## Principles

1. **Output first.** Every case that makes something is graded on the thing made, not on the plan.
2. **Free tier only.** Every case runs on the free models (flux-2-klein 640px, minimax-h3 / ltx-2.5 at 480p, the free
   tools). A case that cannot be done on the free tier says so and is scored on whether the agent says so.
3. **Fixed and versioned.** The cases, fixtures and answer sheets are frozen per benchmark version (`bench v1`). A run
   is always "agent version X on bench v1", so numbers compare across weeks.
4. **Three graders, in order of cost:** deterministic checks, a model judge with a rubric, a person. Each is used only
   where the cheaper one cannot decide.
5. **A baseline on every case.** A score means nothing alone. Each case is also done the simple way, so the report can
   say what the agent adds.
6. **The report is words and numbers.** A short written assessment and a scoreboard, sent as text. Outputs stay
   available for anyone who wants to look, but nobody has to.

## The case space

Every case is a point on five axes. The set is chosen to cover each value of each axis at least twice, not every
combination.

| Axis | Values |
|---|---|
| **What is wanted** | image from text · image edit · image to video · text to video · video edit (captions, crop/resize, trim, swap) · sound (music, voice-over) · composed piece (post, thumbnail, carousel, before/after) · short-form ad or reel (10-30 s) · narrative film (30-60 s) · podcast / talking head |
| **How clearly it is said** | everything stated · implied (platform implies size) · vague · contradictory · impossible on the free tier · should be refused |
| **What the user brings** | nothing · one picture · several pictures · a clip · a clip with speech · an ambiguous "it" |
| **How the conversation goes** | one message · a follow-up change · refers back to an earlier output · changes their mind · two goals in one message |
| **Constraints** | a platform's spec · exact words that must appear · a real brand or person · a credit budget · a deadline-style "quick" |

## The suites

| Suite | Cases | What is graded | Credits per run (free tier) | When it runs |
|---|---|---|---|---|
| **S0 conversation** | ~40 (the current set, extended) | questions asked, tools chosen, plan shape | 0 (simulated tools) | every change |
| **S1 single outputs** | ~30 | the image, edit, clip or sound made | ~400-600 | every change to a tool, a prompt or the planner |
| **S2 composed pieces** | ~15 | the finished post, thumbnail, carousel, captioned reel | ~300-500 | weekly, and before sharing numbers |
| **S3 multi-turn** | ~10 | the final output after 2-4 messages, and that untouched parts stayed the same | ~200-400 | weekly |
| **S4 video pipeline** | 8 briefs | each stage's output and the finished film | ~150-400 per brief at 10-15 s, 480p | only with a go, and per stage (see below) |

### S1 single outputs (examples)

- Image from text: one stated, one vague, one with exact words that must be spelled right, one with a count ("three
  red balloons"), one with a spatial relation ("cup left of the laptop").
- Image edit: change one thing and keep the rest; remove an object; change the style; put words on a sign in the scene.
- Image to video: animate a product photo; animate a portrait without the face drifting.
- Text to video: one action, one camera move, one with a person.
- Video edit: subtitles on a clip with speech; crop 16:9 to 9:16 keeping the subject; face swap on a photo.
- Sound: a 15 s music bed in a stated mood; a voice-over of a given line.
- Refusals and limits: a real person's face swapped into an ad (refuse); 4K requested on the free tier (say what it
  can do instead).

### S2 composed pieces (examples)

Instagram post with a headline; YouTube thumbnail with a face and three words; three-slide carousel that reads as a
set; before/after from two photos; product on a new background; a 15 s reel from five photos with captions; a poster
with a date and place that must be exact.

### S3 multi-turn (examples)

Make, then "make it warmer" (only colour changes); make, then "the second one" (resolves to the right asset); make,
then "actually for TikTok" (resizes, does not remake); make a picture, then animate it, then add music (each step feeds
the next); change of mind mid-plan.

### S4 video pipeline

Eight briefs, each 10-15 s so one full run stays affordable:

| Brief | Why it is in the set |
|---|---|
| Product ad, 15 s, 9:16 | the common commercial case; captions in safe margins |
| App or service ad, 15 s, 16:9 | screens and UI, text on screen |
| Local business (café, gym), 10 s | the user's own photos as the material |
| Event promo with a date and place | exact text that must survive |
| Short narrative, two characters, 15 s | character identity across shots |
| Fact piece with real hardware or a real place (the F-35 / Vanderbilt kind) | accuracy against references |
| Explainer with a voice-over, 15 s | sound, narration timing |
| Mood / music piece, no dialogue, 10 s | motion and pacing alone |

Graded **per stage**, so most work is cheap:

| Stage | Graded on | Grader | Credits |
|---|---|---|---|
| Story | covers the brief's must-haves; length fits the duration | rubric judge against the answer sheet's checklist | 0 |
| Screenplay | shot count and durations add up; each must-have is placed in a shot | deterministic + judge | 0 |
| Keyframes | each frame matches its shot; the same character looks the same across frames; text spelled right; no anatomy or object faults | judge (vision), OCR, pairwise identity check | ~5 per frame |
| Clips | motion matches the shot; no warping; the clip starts where its keyframe says | judge on sampled frames | ~120 per 5 s |
| Film | the whole brief: does it read as the asked-for ad or story; continuity; pacing; sound present and in sync | judge + a person on a sample | 0 beyond the above |

**Frozen upstream.** Each stage's output from a reference run is saved. Changing the keyframe stage reruns keyframes
from the frozen screenplay, without remaking the story or the clips. That way a fix to one stage is measured at the cost
of that stage only, and a full film run is the exception.

## How each output is graded

### 1. Deterministic checks (free, always first)

Size and aspect, duration, frame rate, file opens, audio track present and not silent, loudness in range, exact text
present (OCR on the frame, compared to the required words), the subject still in frame after a crop (a detector box),
the untouched area of an edit unchanged (pixel or perceptual difference outside the edit mask), credits spent within
the estimate.

### 2. A model judge with a rubric (cheap)

A vision model gets the brief, the answer sheet, the output (frames sampled from video) and a rubric of 3-6 yes/no or
1-5 questions written per case kind, for example for an image edit:

- Did the asked-for change happen? (yes/no)
- Is everything else unchanged? (1-5)
- Any visible artefact: extra fingers, melted text, warped objects? (yes/no, and where)
- Would a person accept this without a retry? (yes/no)

Rules: yes/no beats a scale; the judge explains before it scores; the judge never sees which system made the output;
for comparisons it sees two outputs side by side in random order and picks one (pairwise beats absolute scores).

### 3. A person (expensive, used to keep the judge honest)

Once per benchmark version, a person rates a sample (about 30 outputs across the suites) with the same rubric. The
judge's agreement with the person is reported. Any rubric question where the judge agrees less than ~80% of the time is
not reported as a number until the rubric is fixed. Runbo or the user is the person; a one-page rating sheet, 20-30
minutes.

## Baselines

| Baseline | What it is | What it shows |
|---|---|---|
| **One-shot** | the brief pasted straight into the single most fitting Magic Hour tool, free tier, no agent | what the agent adds over doing nothing clever |
| **Manual** | a person (or Claude by hand) using Magic Hour's tools step by step (T-036; 34 hand baselines exist) | how close the agent gets to a careful human |
| **Last version** | the previous agent version on the same bench version | whether this change helped or hurt |
| **The MCP as is** (added 2026-11-01, T-048) | the same prompt, word for word, to an off-the-shelf chat model with Magic Hour's hosted MCP connected and nothing else; the free plan emulated by a gate on every paid call; the same proxy user | what the agent adds over the product's own MCP in a chat client; the user's bar: "yours should knock the MCP out of the water every single time" |

The headline number per suite is the **win rate against the MCP baseline** (pairwise judge) plus the **pass rate** on the
deterministic checks; one-shot is the MCP's degenerate case (one call) and is read off the same records.

## Where the cases come from

| Source | Used for | Notes |
|---|---|---|
| Magic Hour's own product pages and templates | which kinds of job real users run (face swap, image to video, captions, headshots, ads) | sets the mix of S1 and S2 so it matches real use, not our guesses |
| Public image-generation prompt sets (PartiPrompts, DrawBench, GenAI-Bench, GenEval) | text-to-image cases with counting, spatial relations, text rendering | pick 10-15 prompts; they come with known hard categories |
| Public image-edit sets (MagicBrush, Emu Edit test set) | edit cases with a source image and an instruction | the source images come with them, which solves fixtures |
| Public video-generation prompt sets (VBench, EvalCrafter, T2V-CompBench) | text-to-video and image-to-video prompts by dimension (motion, identity, camera) | pick by dimension, short clips only |
| Real ad briefs, rewritten | S4 commercial briefs | product, app, local business, event; strip brand names or use made-up brands |
| Public-domain stories and real events | S4 narrative and fact briefs | fact briefs come with Commons references |
| Persona-written briefs | vague, implied and conversational phrasing | a text model writes the same need as five different people would say it (terse, rambling, wrong word); keeps the conversation suite from sounding like us |
| Our own past sessions | follow-ups and refer-backs | the real conversations from this project, anonymised |

Fixtures (the pictures and clips users bring): free-licence stock photos and clips (Pexels, Unsplash, Wikimedia
Commons) kept in `bench/fixtures/` with their licence, plus a few made once on the free tier and frozen. Each clip with
speech needs a transcript, so subtitle accuracy can be checked as word error rate.

Every case gets an **answer sheet** (what the imaginary user would say to each question) so the proxy user can answer
the agent without a person, and a **must-have checklist** (3-6 items) that the output graders score against.

## The report

One page of text, sent as a message:

1. Three to five sentences: where things are, what got better, what is broken.
2. A table per suite: cases, pass rate, win rate against one-shot, median credits, change since the last run.
3. The three worst cases, each in one line: what was asked, what came out, why it failed.
4. What I would fix next and why.

Links to the outputs are at the bottom for anyone who wants them; the assessment does not depend on looking.

## Open decisions

1. **The credit budget per full run.** S0-S3 is roughly 1,000-1,500 credits; S4 adds ~150-400 per brief. How much per
   week?
2. **Who rates the human sample:** the user, the reviewer, or both (both gives an agreement number between people too).
3. **The judge model.** A stronger judge is more expensive but the judge cost is small next to generation credits.
4. **Whether S4 runs end to end at all for now,** or only stage by stage from frozen upstream, until the stages pass on
   their own.

## Built (2026-11-01): bench v1 and the MCP baseline

**Bench v1** (`V2/bench/v1/`, built in the parallel session): 163 items from `bench/USER-CASES.md` (55 user cases, one
item per sub-case; group I, the film briefs, run apart), fixtures with a manifest, a runner through the agent server on
the free tier with the proxy user, a three-layer grader (deterministic checks, a vision judge against the item's
must-haves and exact text, the conversation), a text report, an audit page. First real pass `real-1`: 152 items, 47
pass, mean 58, 9,314 credits.

**The MCP baseline** (`V2/bench/mcp/`, T-048): `run.mjs` gives every item's messages, untouched, to the agent's own
chat model with Magic Hour's hosted MCP (48 tools) connected through OpenAI's remote-MCP tool; the free plan is
emulated with an approval gate that refuses paid models, higher resolutions, 4x upscales and spend past a free
account's 400 credits, with the reason a free key would get; the balance and delete tools are hidden, everything else
offered; the proxy user answers from the same sheet and says "go ahead" when asked for a go. The record has the agent
runner's shape, so the same grader, report and pages read it. `compare.mjs` puts the two arms side by side per item
with a pairwise judge (both outputs in a fixed random order; a follow-up item also shows what each side had made
before) and totals per group: pass, mean, wins, win rate, credits, time, questions, the MCP's approval rounds and
refused calls, the models it chose. Film briefs the pipeline already made on the free tier sit in `bench/mcp/film/`
as items with the pipeline's film as the agent record.

**First numbers (2026-11-01, `results/compare-mcp-1/compare.md`, 152 micro items, agent records the newest per item from
`real-1` and `latest`, MCP from `mcp-1`):** by the grader the agent passes 90 (59%) against the MCP's 62 (41%), mean
75 against 61, for 8,275 credits against 10,115 and 88 minutes against 142. Head to head by the pairwise judge the
agent wins 67, the MCP 69, 16 ties: a coin flip overall. Where it falls: the agent wins editing the user's video 13–2
(the MCP has no crop, trim, mix or text-to-speech and said so on 11 items), sound 5–1, ads 8–4, short video 10–8,
conversation 7–6; the MCP wins single images 17–7, image edits 16–8 and faces 7–1; composed pieces are 8–8. On images both
sides mostly pass and the judge prefers the MCP's picture: the chat model chose qwen-image-2.1 67 times (good lettering,
10 credits) where the agent's free tier paints on flux-2-klein (poor lettering, 5 credits) unless lettering is asked
for. Both refused all five should-refuse items. Both asked 16 questions for information; the MCP
asked once for a go. Film briefs on the free tier (`results/compare-film-1/`): the MCP's one text-to-video call won all
four pairs against the pipeline's chain of klein stills (details in `bench/mcp/README.md`). One long page with the films
first and then the micro items, MCP beside agent: `results/compare-all-1/` (`compare.mjs --from`).
