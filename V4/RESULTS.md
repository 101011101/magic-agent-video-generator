# V4 first run (2026-11-02)

Dry suite (0 credits): 19 conversations, all 14 items ended on the expected tool; the direction change re-routed and
was flagged; strange answers were re-asked more simply, never fabricated. Transcript evaluator (with the attachment
readings supplied): 14 pass, 1 borderline, 3 fail. The fails: a look chosen without asking (our rule allows "look" as
a stated default; the evaluator does not), and one strange-answer run that drafted poster lines from "put the usual
stuff on it" (rule tightened: exact words are never drafted without explicit permission).

Full suite without the zoo ad (848 credits, one attempt each, no retries):

| Item | Tool | Credits | Review | By eye |
|---|---|---|---|---|
| S01 perfume on marble | edit_image | 10 | fail | bottle redrawn rather than kept |
| S02 black bottle | generate_image | 10 | pass | clean product shot |
| S03 open mic poster | generate_image | 10 | fail (wanted 3:4) | all three lines exact, retro look, 9:16: good |
| S04 20% off post | generate_image | 10 | pass | |
| S05 warmer | edit_image | 10 | fail | warmer, but the picture was re-rendered, not adjusted |
| S06 remove the crowd | edit_image | 10 | fail | crowd gone, car kept, background invented: usable |
| S07 trim | trim_video | 0 | — | 0–6 s, correct |
| S08 face swap | swap_face_in_photo | 10 | — | the grey-shirt man's face on the braided man: works |
| S09 animate portrait | create_video_from_image | 144 | fail | she is the same person, motion slight: usable |
| S10 car on the bridge | create_video_from_image | 240 | fail | **the bridge never appears**: the car photo was the start frame and its show scene persisted |
| S11 poster on a billboard | edit_image | 10 | fail | poster placed, lettering softened |
| V01 waves at sunset | create_video_from_text | 240 | fail (motion subtle) | a good vertical sunset-beach clip with surf sound |
| V02 animate the perfume | create_video_from_image | 144 | fail (rotation slight) | bottle kept, light moves, rotation small |

Findings:
1. The VLM reviewer is stricter than the eye on motion and on "re-rendered vs adjusted"; its fix sentences are useful
   but its pass/fail should not be the verdict alone. Keep both on the page.
2. The free editor re-renders rather than adjusts (S01, S05, S11): expected after `general/01`. For "warmer" a colour
   filter in ffmpeg would beat the model; worth a deterministic path for tone-only edits.
3. **S10 is the one-reference rule's known cost**: with a start frame, whatever is in the frame persists. For "X in
   place Y" where X is a product/person photo, the right call on the free tier is minimax-h3 with X as a NAMED reference
   and Y in words (the clip then builds the place), not image-to-video from X. V4 wires only the start-frame path; the
   named-reference path exists in V3 (`case3.mjs --mode refs`) and should move into `make.js` for tier 2.
4. Costs matched the estimate (843 estimated, 848 spent; the face swap is 10 not 5).

## V4 vs the MCP on the same thirteen briefs (`V4/runs/compare-mcp.html`)

The MCP got the identical full briefs and attachments; 853 account credits. Pairwise VLM verdict, random order:

| Item | V4 | MCP | Verdict |
|---|---|---|---|
| S01 perfume on marble | edit_image | edit_image (qwen) | MCP, slight |
| S02 black bottle | generate_image (qwen) | generate_image (klein, 5 cr) | MCP, clear |
| S03 open mic poster | generate_image | generate_image (qwen) | MCP, clear |
| S04 sale post | generate_image | generate_image (qwen) | **V4, clear** |
| S05 warmer | edit_image | edit_image (qwen) | **V4, clear** |
| S06 remove the crowd | edit_image | edit_image (qwen) | MCP, clear |
| S07 trim to 6 s | trim_video (ffmpeg) | **made nothing** (no trim tool) | V4 by default |
| S08 face swap | swap_face_in_photo | swap_face_in_photo | tie |
| S09 animate portrait | image-to-video (ltx) | image-to-video (ltx) | MCP, clear |
| S10 car on the bridge | image-to-video from the car photo | **text-to-video on minimax-h3 with the car as a named reference** | MCP, decisive |
| S11 poster on billboard | edit_image | edit_image (qwen) | MCP, clear |
| V01 waves at sunset | text-to-video (ltx) | text-to-video (ltx) | **V4, slight** |
| V02 animate the perfume | image-to-video (ltx) | edit then image-to-video (154 cr) | **V4, clear** |

Tally: V4 5 (one by default), MCP 7, tie 1. Same tools on nine of thirteen; the differences that decided items were
prompts (S02, S03, S06, S11: the MCP's image prompts were judged closer to the request) and one routing choice (S10:
the MCP put the car in as a minimax named reference and let the clip build the bridge; V4 used the car photo as a
start frame and the bridge never appeared). V4 won where its prompt or its deterministic tool was the better fit
(S04, S05, V01, V02, S07).

Next two changes, in order: (1) tier 2 routes "X in place Y" with a photo of X to minimax-h3 named-reference
text-to-video (the V3 `--mode refs` path) instead of image-to-video; (2) the image prompt writer gets the MCP's
habit of restating the request's nouns and the exact words first, then the look.

## S10 rerun under the two-reference rule (small tasks may carry two references)

Intent now routes "this car across this bridge" to create_video_from_text on minimax-h3 with `@product` and
`@environment` as named references (the start-frame route only continues the picture it is given). 240 credits.
By eye: the Tourbillon's exact body, ice-blue and black, drives across the Golden Gate from a front three-quarter at
0.5 s to a rear three-quarter at 9.5 s, towers and cables behind, no crowd, no show stand. This is the clip the MCP
made on its first try, now from our pipeline with the same mechanism. Prompt: "Use references as likeness guides, not
pasted photos. Preserve @product's exact body shape…; discard display platform, crowd and original setting."

## The zoo ad: V4 vs the MCP (`V4/runs/zoo.html`)

| | V4 | MCP |
|---|---|---|
| Route | story (setting + 3 paragraphs) → 3 text-only clips of 15 s on ltx-2.5 → logo still (qwen, 10 cr) as clip 3's one reference → join → TTS voice-over mixed under | one 45 s ltx-2.5 call, audio on, narration quoted inside the prompt (its first attempt exceeded 2,000 chars and was refused; it shortened and retried) |
| Credits | 1,090 | 1,080 |
| Lions | lion on a wall at sunrise, wide and small | lion and lioness on rocks at golden hour, close: the better shot |
| Penguins | two penguins at a pool, clean | penguins and a giraffe superimposed, a double exposure at 27 s |
| Giraffe | giraffe at acacias, then dissolve to the card | folded into the penguin shot |
| End card | "Ridgeview Zoo", antelope mark, "Open daily 9–5 · Kids under 5 free", exact and held | "Rigedvew Zoo / Opdeview Zo", a walking giraffe mark, "Open daily · Kids under 5 ⟨garbled⟩ free" |
| Voice-over | 45 s TTS, the whole script, clear | 9 s of compressed speech at the start: "This weekend, make room for wonder. Start your day with lions, meet penguins, at feeding time, and look up at our giraffes. Bring your!" then nothing |

Reading: for a 45 s piece with a voice-over and an exact end card, the split pipeline wins on the things the brief
checks (three distinct animals in order, exact lettering, a full narration) and loses one shot on beauty (its lions).
The MCP's single call cannot carry 45 s of narration (ltx-2.5 squeezes it into the first seconds) nor exact lettering,
and at 45 s it merged two scenes. The independent-clip reference slot (a generated still for the card) did its job.

## Zoo ad, second cut: clips grouped by key idea, the card as its own clip (`V4/runs/zoo.html`)

Rule added (from the user): after the story, group clips into calls. Consecutive clips that continue the same place
and moment merge into one call when they fit the model's maximum (one take); longer runs chain by last frame; a clip
that does not continue the previous one starts a new call with its own reference. An end card is always its own 4–6 s
clip from its still, never a start frame. The zoo became four calls: lions 15 s, penguins 15 s, giraffe 10 s (no
reference, review PASS), card 5 s from the still (lettering exact, held). Film 45 s with a 39 s voice-over, no timestamps.

Cost of the cut: 360 (giraffe + card) plus an unintended 360: the first rerun regenerated clip 1 because the clip brief
carried "CLIP n OF N" and N had changed from 3 to 4, which changed the prompt and so the job's cache key. The brief no
longer carries the total. Ledger 110,662 of 110,800.

## The barber reconnection (`V4/runs/barber.html`, story in `V4/tests/barber-story.json`)

A 10 s seed clip was made from clip 1 of a two-clip story (240 cr). The "lost" second half was then asked for in two
arms: informed (the whole story given with the clip) and blind (the clip only, "continue whatever is happening").

| Arm | Mechanism | Credits | Score | What happened |
|---|---|---|---|---|
| V4 informed | last frame as start frame, ltx-2.5 image-to-video | 240 | 58 | cape adjusted, hand mirror shown, shoulders brushed; Dev never stands, no handshake |
| V4 blind | the same, with a VLM reading of three frames proposing the continuation | 240 | 38 | Marcus smooths the cape, Dev stays seated |
| MCP informed | asked for a still of the last frame first ("I can't extract the clip's final frame"); on "your call" used minimax-h3 with the whole seed VIDEO as `@original` | 240 | **81** | cape off, hand mirror, Marcus brushes the chair as Dev turns to the door; the mirror reflection wrong |
| MCP blind | minimax-h3 with the seed video as `@source`, "continue naturally" | 240 | 38 | works around the neckline, Dev stays seated |

Readings:
1. Everyone kept continuity (same shop, same two men, picks up at the last frame): yes on all four.
2. With the story in hand, the MCP's video-as-reference on minimax-h3 carried more of the paragraph than our
   last-frame start on ltx-2.5. A video reference gives the model the motion and the room, not one frozen pose; our
   start frame locked Dev in the chair and the clip stayed there. **Add a video-reference route**: for "extend this
   clip", minimax-h3 with the clip itself as a named reference (≤ 15 s of it, per the schema) and the last frame's
   description in words; keep image-to-video for stills.
3. Blind, both reached 38: a continuation nobody described is a continuation of the pose, not of the story. The story
   is worth 20–40 points; it should be kept alongside every clip the pipeline makes, which is the state record.
4. The MCP could not read the clip and said so; it asked for a still. Our VLM read of the clip was accurate (it saw the
   cape being gripped) but the start-frame mechanism did not let that reading move the scene on.

## The vague user: V4's dry runs vs the MCP, gated (every paid call refused, so its attempted call is the record)

Same 13 vague briefs, same proxy answer sheet. V4: `V4/runs/dry-*`. MCP: `V2/bench/v1/results/mcp-intent/I*.json`.

| Item | V4 asked | V4 sheet | MCP asked | MCP attempted call |
|---|---|---|---|---|
| S01 perfume for the website | nothing | edit, no aspect | nothing | edit_image, 1:1 |
| S02 black bottle | where posted → 1:1 | 1:1 | nothing | generate_image, 1:1 (guessed) |
| S03 open mic poster | the words, where | 3:4, exact words | **the words, date, venue** | generate_image 9:16 with the user's words |
| S04 sale post | where, words | 1:1, "20% OFF…" | nothing | generate_image 1:1, invented its own copy |
| S05 warmer | nothing | edit | nothing | edit_image |
| S06 remove the crowd | nothing | edit | nothing | edit_image |
| S07 cut this down | the range | 0–6 s | **how short, which part** | no call: "can't trim", gave ffmpeg |
| S08 face swap | whose face | teacher → braids | **which way round** | swap_face_in_photo |
| S09 animate her | motion, sound | 6 s silent | nothing | image-to-video **5 s**, audio off (guessed) |
| S10 car on bridge | seconds, sound | 10 s silent | nothing | text-to-video minimax @car @bridge, **5 s** (guessed) |
| S11 poster on billboard | nothing | edit | nothing | edit_image |
| V01 waves | where, length, sound | 9:16, 10 s, ambient | nothing | text-to-video **16:9, 5 s, audio on** (all guessed; the user wanted TikTok, 10 s, wave sound) |
| V02 animate the perfume | motion, length, sound | 6 s silent | nothing | image-to-video 5 s |

Readings: the MCP asked in 3 of 13 (the poster's words, the trim range, the face direction), all good questions; V4
asked in 9 of 13. Where neither asked, the edits, both proceeded sensibly. Where the MCP did not ask and should have,
it guessed: V01 came out landscape, 5 s, with audio where the user wanted a vertical 10 s clip with wave sound; S09,
S10, V02 all defaulted to 5 s; S04 invented the sale copy. V4's gap is the mirror image: it never asks where an edit or
an animated picture will be shown, because those sheets have no aspect field (S01, S10, S11, V02); fix: aspect on
every visual tool, derived from the picture when the user does not say.

## The perfume campaign, the MCP's plan (gated; `mcp-campaign/MP01`)

It tried generate_image on qwen 16:9 first (the hero product shot), was refused, and then wrote out a plan that matches
the user's own decomposition: (1) a premium product shot; (2) the poster using "the approved bottle photograph" with the
three exact lines; (3) a 30 s film as three separate 10 s clips (dusk ritual, rain on black stone, the car at night),
the offer as typography on the last seconds, a logo end card with the exact monogram, and the voice line over the
ending. It names the bottle once and reuses the words. Two things it cannot do in that plan: carry the approved bottle
photo into the three clips as the same object (it would attach it as a minimax reference per clip), and overlay the
offer or mix the voice (it writes them into the prompts). V4's dry run on the same brief produced four calls with the
poster folded into clip 2 as a still and no separate product shot or poster file: the multi-deliverable layer is the
piece V4 lacks.

## Stage 1 of the comprehensive suite: existing assets (`V4/runs/stage1.html`)

| Item | V4 | MCP |
|---|---|---|
| D01 trim + caption | 5 s cut, caption card "Clean rooms. Clear minds.", 0 cr | regenerated the clip on its video editor, 120 cr |
| D02 join with dissolve | 19.4 s, dissolve at the cut, 0 cr | refused: no timeline editing |
| D06 warmer, pixel-identical | colour-temperature filter, 0 cr | refused: the editor regenerates pixels |
| D07 three sizes | 1:1, 9:16, 16:9 padded files, 0 cr | refused: no resize without regeneration |
| D08 ask first | full brief: poster with the exact three lines, then the Facebook size, 10 cr; VAGUE brief (dry): asked what the event was and which words, three times when the answers were strange, and only then made it | full brief: two posters with the given words, 20 cr; VAGUE brief (gated intent test): attempted a poster with invented copy, no question |
| E01 edit the zoo clips | 43 s film: four clips with dissolves, title card, music bed mixed under, 44 cr | refused: no joining, dissolves or music |

Four bugs fixed on the way (campaign sub-step paths and job handles; a words fallback for sub-steps; the overlay
rebuilt on V2's caption cards because this ffmpeg has no drawtext; joins normalise mixed clip sizes). One gap left:
the E01 title is overlaid for the whole film, not "at the start"; the overlay needs a time window (V2's tool has one).
The MCP's refusals are honest and specific; it does not pretend. On these six the comparison is not quality, it is
capability: five of six it cannot do at all.

Resize, revised (user rule): a VLM looks at the picture first and picks crop (a photo whose edges do not matter, kept
centred on a focus point), pad (the whole frame must survive), or reflow (a designed layout with words, re-composed
by the image editor at each target shape with every word kept). D07 on the WPA poster chose reflow: three
re-layouts at 10 credits each; the square one passed review, the 9:16 and 16:9 were judged not an exact re-layout
(the editor redraws rather than repositions). So reflow is the right call for posters, and the free editor is the
limit on how faithfully it re-lays out; a paid editor (nano-banana-pro, 200 cr at 2k) is the upgrade path when the
design must be preserved exactly.

## Judging by the user's intention (the method from here on; `V4/tests/intent-judge.mjs`)

For each item an LLM writes the user's INTENTION as a checklist from the user's own words (the vague opening, the answers they
gave, the full brief): 4–8 checkable points, each marked stated / answered / implied (an implied point is the obvious
expectation nobody says, e.g. a poster should look designed). A VLM then checks each side's final output against every
point, seeing the source material and all deliverables, yes / partly / no with evidence, and an overall 0–100.

Stage 1 under this judge (`V4/runs/judge-stage1.html`):

| Item | V4 | MCP |
|---|---|---|
| D01 trim + caption | 96 | 45 (regenerated clip, no caption) |
| D02 join with dissolve | 100 | 0, made nothing |
| D06 warmer | 99 (strength now follows the words: "slightly" is a nudge) | 0 |
| D07 three sizes, reflowed | 83 (second attempt, see below; all three shapes tick, the four "exactly" points are partly) | 0 |
| D08 poster + Facebook version | 100 | 97 | 97 |
| E01 zoo edit with music and title | 100 (title 0–4 s; music fades out with the picture) | 0 |
| points met | 33 yes · 4 partly · 0 no (the 4 partly are all D07) | 7 yes · 0 partly · 29 no |

### D07, why two boxes failed and what the fix was (2026-11-03)

The first reflow (kept in `runs/full-D07-v1`, 30 cr) failed its review at 9:16 and 16:9. The error was ours, not the
model's: the brief said "everything exactly unchanged, nothing cropped", which on a new canvas can only be met by
squeezing the whole poster into it, so the editor painted bars and compressed lettering. The API itself honoured the
shapes (640×640, 352×640, 640×352; free sizes round to multiples of 16). Fix: a reflow prompt shape
(`SHAPE.reflow` in `agent/guides.js`): extend the artwork in its own style to fill the new canvas edge to edge, keep
the words as one block, no bars, no mount, no squeeze. Second run (30 cr): 1:1 passes review; 9:16 is a sound poster
with a pale strip left at the bottom; 16:9 fills the banner but the lettering is small and slightly redrawn. The judge
now also sees measured sizes and durations (it had marked 352×640 as "slightly taller than 9:16"), and whether the
source clips had sound (D01's source is silent). Stage 1 after this: ours 31 yes · 6 partly · 0 no, 134 cr kept +50
discarded (30 on the first D07 reflow, 20 on an earlier D08); MCP 7 yes · 29 no, 140 cr. What is left partly is the free editor's fidelity when it redraws a design;
within the free tier there is no editor that repositions instead of repainting, so this is the ceiling for D07.

### D06 and E01 touch-ups (2026-11-03, 0 credits)

D06: the colour filter was one fixed strength (4500 K), which on the portrait turned skin orange; the judge rightly said
"stronger than subtle". The strength now follows the user's words: slightly / a bit / a touch is a nudge
(5600 K at 60%), plain "warmer" is medium, "much warmer" is a push. Measured mean RGB on the portrait: source
137/130/123, before 135/111/86, now 136/125/114. E01: the music fade-out was timed to the rounded-up music length
(44 s) rather than the film (43.08 s), so the bed was cut at half level; it now fades to silence with the last frame.
The judge also had two evidence bugs fixed: it now sees the source picture sizes (it had assumed a 640 px source was
1024 and called the output downsampled) and the measured length of the music bed (it had read the job's 19 s wall
clock as the bed's length). Stage 1 is now 33 yes · 4 partly · 0 no; the four partly are D07's "exactly" points.
The clean page has the stats on top (edits won, credits, intentions met, average score, what the MCP could do at
all) and two tabs, simple edits and conversations.

### One page, four tabs (2026-11-03): `runs/stage1-clean.html`

The zoo ad and the thirteen generation basics are now judged by the same intention checklist as stage 1 and sit on the
same page as tabs (Simple edits · The zoo ad · Generation basics · Conversations), with the overall numbers on top and
a per-case table in each tab. Two judge upgrades were needed to see what the eye sees: a timed Whisper transcript of
each output's sound (so a voice-over's tone, a finished vs cut-off sentence, and "music only" are facts: the MCP's zoo
narration stops at "Bring your!" at 9 s of 45; ours runs 37 s and ends on a full sentence) and, for trims, the source
frame at the cut point plus both frame rates (S07 had two n/a). S05 ("make it warmer") was rerun on the current
pipeline (the colour filter did not exist when it first ran; the old run is `full-S05-v1`): 46 → 95 at 0 credits.

| Tab | ours ahead | credits ours vs MCP | intentions met | average score |
|---|---|---|---|---|
| Simple edits (6) | 5, 1 tie | 134 vs 140 | 33/37 vs 7/37 | 97 vs 24 |
| The zoo ad (1) | 1 | 1810 vs 1080 (ours includes the 360-credit accidental clip-1 regeneration) | 8/8 vs 3/8 | 98 vs 65 |
| Generation basics (13) | 2, 8 ties, 3 lost (S06 crowd removal, S09 portrait animation, S11 billboard) | 838 vs 853 | 74/91 vs 66/91 | 88 vs 81 |
| All 20 | 8, 9 ties, 3 lost | 2782 vs 2073, +300 discarded | 115/136 vs 76/136 | 91 vs 63 |

The picture is unchanged from before: single-call generations are a draw (the same free models, now the same prompt
habits); the gap is everything that needs structure or editing, which the MCP either cannot do (5 of 20) or does with
the seams showing (zoo card lettering, cut-off narration).

### The page, simplified (2026-11-03, user's rules)

Four numbers on top: cases where the user got what they wanted (judge ≥ 80 and no intention missed), clear wins
(one side made nothing, or the scores are more than 15 apart; otherwise "comparable"), average credits per case with
redos not counted (only the jobs behind the kept output; the zoo's accidental clip-1 regeneration and its first
giraffe clip are out, so the zoo is 1,090 vs 1,080), and the cases the MCP could not do. Conversations get one
score each: understood / partly / missed, judged against what the user actually said in that chat plus what a careful
agent must ask before spending; details that live only in the fuller brief do not count against anyone.

Planner fixes found by that judge (all free): a video made from a picture, a request naming a destination without a
shape ("for the website"), or an edit with several pictures now asks where it goes instead of taking the picture's
shape; an edit whose change was never stated asks what should change; a designed piece (post, poster, flyer, card)
asks for the exact words unless the user quoted them; "a short clip" no longer reads as YouTube Shorts (it made S09
tall); "poster" in a request that carries pictures names the picture, not the output shape (S11); a shape the user
left to us is not asked again; and a "user" shape the model invented is treated as a guess. V02's sheet now reads
square and the start frame is fitted to the asked shape (crop or pad in the picture's own edge colour) before
image-to-video; its 144-credit rerun waits for the cap.

| | ours | MCP |
|---|---|---|
| got what they wanted (20 cases) | 16 | 9 |
| clear wins | 7 | 0 (13 comparable) |
| credits per case, no redos | 101 | 104 |
| conversations understood (13) | 13 | 5 (7 partly, 1 missed) |

Published 2026-11-03: https://magic-agent-v4-report.vercel.app (Vercel project `magic-agent-v4-report`, a self-contained
copy of `runs/stage1-clean.html` with its 61 media files; rebuild with `V4/tests/clean-page.mjs`, re-copy, `vercel deploy --prod`).
