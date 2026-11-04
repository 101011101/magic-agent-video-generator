# Case 1 — text only

Natural language → story → one prose prompt → one ltx-2.5 call → VLM review. Build this first; nothing else until the
flower brief scores level with the MCP's 87–88 under the same judge.

## Is it as simple as story + guide?

Almost. The guide itself is three generic lines (see `04-mcp-reference.md`); what does the work is the **prompt
shape** the MCP's chat model wrote, so "guide" below means our `guide.md`: the MCP's three lines plus the shape, written
as rules. Four things are not trivial and are the whole of the engineering:

1. **The story must be grounded before it is compressed.** The MCP skips this and gets away with it on short fictional
   briefs. We keep it because non-fiction (a real aircraft, a real place) needs a research call, and because the story
   is the record case 2 splits and case 3 constrains. The story is prose with a few fields, no shots.
2. **2,000 characters.** The API rejects longer prompts (confirmed: "style.prompt must be at most 2000 characters";
   the schema's 20,000 is wrong). The prompt writer compresses the story into the shape; it does not paste it.
3. **Sound is a decision, not a default.** ltx-2.5 makes audio at no extra credit. The MCP set `audio:false` for the
   flower ad and `audio:true` for the podcast with the lines in the prompt. The story's `sound` field decides; narration
   and dialogue go in the prompt as quoted lines with time ranges.
4. **Review and one retry.** The MCP reviews by eye. We put 3–5 frames to a VLM against the beats, regenerate once with
   the failures appended, then return either way.

Exact text (a sign, a name) goes in the prompt as a quoted string once, as the MCP does. If the user needs a caption, a
URL or a lower third, that is not case 1's job: the loop adds it after with the overlay tool.

## The steps

```
compose(brief)
  1. story   = storyOf(brief, materials)          one LLM call; research first if kind = non-fiction
  2. route   → case 1                              seconds ≤ 60, nothing specific, no first frame
  3. prompt  = promptOf(story, guide.md)           one LLM call; must be ≤ 2,000 chars, checked in code; rewritten once if over
  4. clip    = textToVideo({model: "ltx-2.5", end_seconds, aspect_ratio, resolution: "480p", audio, prompt})
  5. review  = vlm(frames(clip, beats), story)     pass → return; fail → steps 3–5 once more with review.failures
  6. return  {clip, story, prompt, review, state: [{clip, people, place, props, light, words, last_frame}]}
```

## The prompt shape (what goes in guide.md)

In this order, one paragraph, under 2,000 characters:

1. Duration, aspect, look, light, mood, in one sentence. "A 16-second cinematic advertisement … 16:9. Photorealistic,
   warm natural dawn sunlight, inviting atmosphere."
2. One continuity sentence naming what stays the same. "Four coherent shots, same florist, shop and bouquet throughout."
3. Timed beats covering the whole duration, each with framing, **one** action and a camera move.
   "0–4 seconds: exterior medium-wide, the florist unlocks the wood-and-glass door, warm light on the flower buckets."
4. Exact words quoted once, at the beat where they appear. "shop sign reads exactly 'Petal & Stem'."
5. Sound, if any: ambient, music character, or the spoken lines with their time ranges and who says them.
6. An ending hold. "Hold on the storefront for the final two seconds."
7. One negatives line, last. "No voiceover, no subtitles, no other text overlays."

What the MCP's prompts never do, and ours must not either: a shot list with headings, a separate negatives block, a
constraint on every sentence, "do not show X" for things that should appear later, mentioning the sign in a beat where it
must not be seen.

## The flower test

Brief (bench item I94a): "A 16-second widescreen ad for Petal & Stem, a small neighbourhood flower shop: the florist
opens the shop at dawn and arranges a bouquet, then hands it to a smiling customer at the door; warm, natural light; end
on the shop front."

- Cost: 384 credits, 768 with the retry.
- Judge: the same pairwise vision judge as `bench/mcp/compare.mjs`, against `results/mcp-flower` (87–88).
- Pass: level or better. If not, the diff is in the prompt text, which is saved beside the clip, so compare prompts
  side by side before changing anything else.

## Measured

**Run 1 (`V3/runs/v3-flower-1`, 2026-11-02).** Story → route (case 1) → prompt of 1,422 characters, 4 beats → ltx-2.5,
16 s, 384 credits, 39 s to render → review → judge. Judge: **72 against the MCP's 87**, MCP a clear pairwise win.
What went wrong, from the frames: the prompt writer compressed "arranges a bouquet" into "folds paper around a gathered
bouquet", so no arranging was ever asked for; and the final establishing shot still had the handoff going on in it, so
the ending did not clear. Our review saw both (beat 2 action "no", beat 4 action "no", last frame holds "no") and still
passed the clip, because the pass rule only checked subject presence and the exact words. The sign read "Petal & Stem"
exactly in every frame it appeared in; the MCP's opening sign read "Peal & Sten".

Fixes before run 2: the guide now says the request's own verbs each get a beat and may not be merged, a possession
change states its end state, and the last beat is a separate establishing shot with no new action; and pass is decided
in code (every beat's subject present and action seen, every exact string exact, same people and place, a held last
frame), not by the reviewing model.

**Run 2 (`V3/runs/v3-flower-2`).** Same story (the LLM cache returned it unchanged), new guide → prompt of 1,677
characters, 5 beats, a stated possession change, a separate establishing shot. Review passed under the code rule.
Judge: **80 against the MCP's 87**, MCP still a clear pairwise win: "the florist already holding a finished bouquet
while opening", arranging still absent. Root cause found by comparing the three prompts side by side: the loss was in
the **story step**, not the prompt. The story's progression said "gathers flowers and finishes a paper-wrapped bouquet";
the prompt writer followed the story, so neither prompt ever asked for arranging. The MCP has no story step, so the
brief's verb "arranging" survived into its beat 2. Other differences against the MCP's prompt: ours named the florist
by her apron in every beat and said "stationary camera" in three beats where the MCP gave each beat a camera move and
named the flowers (blush pink roses, cream flowers, brown kraft paper).

Fixes before run 3: the story's progression must carry the request's own actions verbatim, one line each, never
merged or softened into a result; the prompt writer now also sees the request itself and takes the beats' actions from
it; every beat gets a camera move; the key object is named concretely once. These are in `compose.mjs` and `guide.md`.

## Audio test: the street race (`V3/runs/v3-race-1`, 2026-11-02)

Brief: a 16 s night street race with sound; a starter counts down "three, two, one, go", two cars launch, each driver
shouts one short line while racing, end on the winner crossing the finish. Audio on (ltx-2.5, no extra credit). The
review transcribes the clip with whisper-1 (timed segments) and checks each quoted line against the transcript.

| Attempt | Transcript | Visual review | Credits |
|---|---|---|---|
| clip-1 | [0–2.5 s] "Three, two, one, go!" · [6.6–15.8 s] "Keep up! Not tonight!" | fail: no starter at the line (a digital countdown board instead), no finish stripe, the ending still moving | 384 |
| clip-1-retry (failures folded in, 1,915 chars) | [0–5.6 s] "Three, two, one, go!" only | fail: the same three, and now the drivers' lines are gone | 384 |

Chosen: clip-1 (more beats met). Findings:
- **Speech works on ltx-2.5 and lands on time**: the countdown at 0–2.5 s as asked, the two lines inside their 6–10 s
  window. Whisper merged the two shouts into one segment, so per-speaker timing needs a finer check.
- **Audio is not stable across generations**: the retry, with the same quoted lines at the same times, rendered the
  countdown only. One generation's speech says nothing about the next one's.
- **The visual asks that failed were the specific ones**: a human starter between the cars, a painted finish stripe, a
  winner by half a hood. The model substituted a countdown clock and an open road. The retry prompt named them more
  precisely and still did not get them. This is the ceiling of one text-to-video call on the free model, not a prompt
  problem to keep chasing; the fix is case 3 (a start frame that already contains the starter and the stripe).
- Two code bugs found and fixed on this run: the retry prompt was not length-checked (2,071 chars → HTTP 400) and a
  rerun of a label did not carry its paid jobs (now it does; the first clip was reused at 0 credits).

**The MCP on the race brief (`V2/bench/v1/results/mcp-race`, `V2/sessions/mcp-mr1-I95a`).** One ltx-2.5 call, 16 s,
audio on, 384 credits, 74 s end to end. Transcript: [0–4 s] "Three, two, one, go!" [9–10 s] "Try to keep up!"
[11–12 s] "Not a chance!" — each line separately timed. Judge with transcripts: **MCP 73, ours 62**, MCP a clear
pairwise win: a visible human starter, clearly modified cars, separately timed taunts, a checkered finish line crossed;
its own flaw is a duplicated car and a direction flip in the last shot. Ours: countdown exact, both taunts heard but
merged in one window, a countdown board instead of a starter, no finish, "cars look slow".

Why ours looks slow, from the two prompts: the MCP's prompt spends words on energy and physics ("tight, fast-paced
coherent cinematic editing", "tire squeal", "roaring engines and shifting gears", "low tracking shot racing alongside",
"accelerating", "realistic high-energy action, dynamic headlights, believable vehicle physics", a "checkered finish
line"); ours described the race calmly ("neck-and-neck", "parallel tracking", "sweeping lateral slide") with the energy
only in the sound sentence. The model renders the pace it is told. Guide updated: for action the look line carries the
energy in plain words. The MCP also gave each line its own beat and its own close-up ("quick interior closeup of the
red-car driver … shouting exactly"), where we put both shouts in one beat; that is why its lines came out separately
timed and ours merged.

## Where case 1 ends (after the flower and race tests)

One free text-to-video call (ltx-2.5, 480p) is good at: one or two people, one place, slow or steady motion, atmosphere
and texture, one exact sign, short spoken lines. It fails, with either prompt, at: several moving objects that must
persist (cars spawn and flip direction), cause-and-effect physics (a launch, an overtake, a line crossed by a margin),
fast subject plus fast camera, speech attributed to specific people on cue. The flower ad is four gentle events and
scores 80–87; the race is four hard events and scores 62–73 with both prompts, the MCP's extra cars included.

Routing rule to add: a sequence with more than one moving subject that must persist, or an exact spatial event, or more
than one speaker, is not a case 1 at 16 s. It goes to case 2 as one event per clip of 4–6 s (countdown; launch; a taunt;
the finish), each clip started from a still that already has the right count of cars and the starter or the stripe in
it (case 3). That is the pipeline's reason to exist; the test just drew the line.
