# Cases 2 and 3 (sketch; build after case 1 passes)

## Case 3 — a specific thing (build second)

Case 1 with requirements on the clip. Two kinds of requirement, two mechanisms:

| Requirement | Mechanism | Model |
|---|---|---|
| A required first frame (continuation from a previous clip, or a still the user approved) | image-to-video with `image_file_path` as the start frame; optionally `end_image_file_path` | ltx-2.5 |
| A specific likeness that must appear somewhere in the clip (a face, a product, a logo) | `references: [{name, file_path}]` and `@name` in the prompt at the beat where it appears | minimax-h3 (≤ 30 s) |

Preference order: a start frame first. One good still carries identity, place and light into the whole clip, and
ltx-2.5 handles it. References only when the thing must appear mid-clip and a start frame cannot carry it. We saw
minimax paste a reference still in literally as a shot; the MCP's reel prompts ask for exactly that ("preserve the actual
café … show each supplied photo"), so when it must not be pasted the prompt says the reference is a likeness, not a shot.

Where the still comes from (the seed): the user's attachment, or a still we make on purpose with the image tools (the
MCP's image-editor guide: "Animate the accepted still … rather than recreating its identity from a text prompt"). The
asset bank is only this: the seeds. It is never consulted for continuity between clips.

Prompt shape is case 1's, plus: the first beat describes the start frame as it is (so the model continues it rather than
cutting away), and each `@name` is used once, at its beat.

## Case 2 — several clips (build third)

Not a video maker. A splitter and a state manager:

1. `split.js`: the story → spans. Each span ≤ 60 s (ltx-2.5) or ≤ 30 s (when references are needed). Split at scene
   changes in the story, never mid-action. Each span records what it must carry from the previous one (people, place,
   props, light) and what changes.
2. First span → case 1 (or case 3 if it has specifics).
3. Each later span → case 3 with: the previous clip's **last frame** as the start frame, the state record's descriptions
   repeated in the continuity sentence, and any references the span names.
4. `state.js` after every clip: VLM reads the clip (what is actually in it, where people stand, light, props, the exact
   words visible) and the last frame is saved. The next span is written against what was actually made, not what was
   planned.
5. The clips return to the loop, which assembles them (dissolve or hard cut from the story), adds sound and anything else.

The open question (the user's): how multi-clip context is kept. The answer we are testing: frames, not references. The
last frame carries the visual state; the state record carries the words. If a later span needs something from an
earlier clip that is not in the last frame (a person who left the shot), it is found by timestamp in the state record,
a frame is pulled from that clip, and it goes in as a reference on minimax-h3. That is the only time references come
from previous clips.

Test after case 3: one longer story, 2–3 clips, the same judge, and a continuity check (same person, same place, same
light across the cuts).

## Measured: scene 2 with a perfect reference (`V3/runs/v3-flower2-1`, 2026-11-02)

The state manager was bypassed: the reference was picked by hand (clip 1 of `v3-flower-2` at 12 s, the customer in
profile holding the bouquet) and given on the command line. Brief: she carries the same bouquet home and gives it to
her partner, a man with short grey-flecked hair in a navy sweater, at their front door.

| Step | What happened | Credits |
|---|---|---|
| reference read (VLM) | woman, dark hair in a low bun, cream jacket; bouquet yellow/magenta/cream/red in pale paper | 0 |
| seed still 1 (qwen-image-2.1 edit of the frame) | checker: bouquet same; face "older/different"; the partner came out as a woman | 10 |
| seed still 2 | checker: bouquet same; partner right; face "resembles the florist"; used anyway (no third) | 10 |
| clip 2 (ltx-2.5 image-to-video from still 2, 16 s) | identity vs the reference: customer **yes**, bouquet **yes**; same people and place yes; the one failure: no held last frame | 384 |
| retry | refused by the credit cap | 0 |

By eye the clip holds: the same woman (bun, earring, jacket), the same bouquet, one consistent grey-haired man in a navy
sweater, a real handoff, warm morning light. The seed checker was stricter than the clip reviewer on the face (the
reference shows her in profile, so "same person" is a hard call from a still); the second still was close enough that
the clip's own identity check passed on every carried item.

What this says: with the right frame in hand, **still from the frame → image-to-video** carries a person and an object
into a new scene on the free tier. The weak link is the seed still's face when the reference is a profile; the fix is
picking a frame with the face visible (the state manager's job) or two reference frames into the editor.

**Why the MCP's scene 2 felt more alive (both prompts on the page).** Two causes we can act on and one we cannot:
(1) its prompt is one continuous shot with a slow push in, ours cut five times in 16 s, which on image-to-video throws
away the start frame at the first cut; (2) its words are behaviour ("exchanging warm eye contact", "smiles warmly and
reaches out with both hands", "exchange affectionate smiles", "only after he has a firm grip does she release it") and
its ending is a medium two-shot on the faces, where ours spent about 600 of 1,995 characters on a preserve inventory
(earring, patch pockets, every flower colour) repeated per beat and ended on a wide shot of two people standing still;
(3) it ran on minimax-h3, which renders faces and small performance more readily than ltx-2.5 at 480p. The guide now
has a section for people-carried scenes. The model choice stays ltx-2.5 for text-only; for a seeded people scene
minimax-h3 image-to-video at the same 24 cr/s is worth an A/B.

## What case 2 is, exactly (2026-11-02)

Case 2 is sequencing. It makes no video. Its parts, in the order they run:

1. **One story, one bible.** The whole story once, then a BIBLE: every person, place and object that appears in more
   than one clip gets an id and two to four visual anchors, plus one line of light and grade. The same words are
   pasted into every sequence's prompt, so clips that share nothing but words still match (the ship in clip 2 is the
   ship the bridge crew in clip 1 are standing in).
2. **The split.** Sequences of 10–20 s at scene changes, each with its own prose, progression, sound, and a `carries`
   list: what comes from which earlier sequence and how (same place and people as a new scene there; the same object
   seen again, e.g. on a screen; a direct continuation of the last frame).
3. **Routing per sequence.** A sequence with a reference in hand goes to case 3 (seeded still → image-to-video); one
   without goes to case 1 with the bible's words. References are hand-picked for now; the state manager will pick them.
4. **Order and dependencies.** Clips run in order; a clip that carries from earlier ones runs after they exist, and the
   references for it are frames of those clips (clip 3 of the battleship: the bridge from clip 1 as the seed, the ship
   from clip 2 as the second editor input for the screen).
5. **The join.** A plain cut between clips here (ffmpeg concat); dissolves, a music bed and sound design belong to
   the loop's assemble tool, not to composition.

Not in case 2: the state manager (frame picking by timestamp, "what is in clip k"), a cross-clip review of the whole
film, and sound continuity across clips. Those come after this test.

Battleship test plan: three clips, clip 1 bridge (case 1), clip 2 exterior firing (case 1, the bible's ship), clip 3
bridge again (case 3: seed = a clip 1 frame of the bridge and crew, second input = a clip 2 frame of the ship for the
screen). Credits: 3 × 15 s × 24 = 1,080 plus stills, about 1,100; with one retry each about 2,200.

## Battleship clip 1, case 1 vs case 3 (`V3/runs/v3-ship-1-s1-case1`, `…-s1-case3`, 2026-11-02)

Same sequence record, same bible, same judge. Case 1 from words alone; case 3 from a premade bridge still
(`V3/runs/v3-ship-1/refs/bridge_crew.png`, qwen-image-2.1, 10 credits, all five bible ids met) used directly as the
start frame. Each arm took its one retry; neither passed its own review.

| | case 1 (words) | case 3 (premade still as start frame) |
|---|---|---|
| judge | 39 | 64, **clear pairwise win** |
| the bridge | an open deck at sea, no windows, no screen | the narrow steel bridge, slanted windows, chart table, lamps, amber screen, all held |
| the crew | three people, the lookout's look lost, helmsman at a wheel | Vale, lookout (red headset), helmsman (braid) identical to the still in every frame |
| the actions | Vale looks through binoculars; the fire command not established | pointing one beat late and by the wrong person; the cruiser appears as a translucent ghost ship floating inside the bridge |
| speech | "Fire main battery!" spoken 3–4 times in 15 s | not transcribed (case 3 has no transcription yet) |
| credits | 720 | 360 + 10 + 360 |

Findings:
- **A premade reference still as the start frame is the way to open a scene.** Identity and the room held for all
  15 s; words alone lost the room entirely.
- **What the start frame does not contain, the model invents badly.** The still had no window view of the sea, so
  when the prompt said "the enemy cruiser on the horizon" the model composited a ghost yacht into the bridge. The
  reference still for an interior must include what the beats will look at (a window with the horizon), or the clip must
  not ask to see it (the pointing and the screen are enough; the cruiser is clip 2's).
- **A quoted line with audio on loops.** One line quoted once for a 15 s clip came back three to four times. Either
  give the line a 2 s beat and silence elsewhere, or turn audio off and let the loop add the voice.
- Case 3 needs the transcription and lines check that case 1 has.

**The MCP on the same clip 1, both arms (`V2/bench/v1/results/mcp-ship`, page `V3/runs/v3-ship-1/four-way-s1.html`).**
Same must-haves, same judge: V3 words 43 · V3 still 63 · **MCP words 73 · MCP still 79**. The MCP won every pairwise
(decisive against our words arm). With the still attached it did exactly our case 3: image-to-video from the still on
ltx-2.5, one continuous shot. The still helped both systems (+20 ours, +6 theirs). Its speech: "Enemy cruiser on the
horizon!" at 0–4 s and "Fire!" at 14 s, two distinct lines; ours repeated one line.

Why our bridge ended up in the open (words arm): our prompt pasted the WHOLE bible, including `sea` and `resolute` (a
dark-gray dreadnought with twin turrets) as things to "preserve", for a clip that is entirely inside the bridge. The
model obliged and built the ship's exterior. The MCP's first sentence was the place, said relationally: "On the
battleship Resolute's bridge: narrow steel interior, slanted front windows overlooking a cold gray ocean". That one
sentence is why its bridge is enclosed with the sea through the glass.

Everything else the MCP's prompts did that ours did not:
- only the bible entries that appear in this clip; the helmsman "stays at helm" (a role, not just a look);
- positions from the start frame: "Captain Vale at left … lookout in center … helmsman at right";
- scale and placement for the distant thing: "the distant cruiser is a tiny silhouette on the ocean horizon through
  the windows" (ours said "visible beyond the windows" and got a ghost yacht inside the room);
- the clip's place in the film: "First clip of a continuing film: no battle montage, no guns firing; end on the order";
- two short distinct lines, one per beat, and "End on her composed face".

These go into the guide and the sequencer now: a sequence prompt carries only its own bible entries; places are stated
relationally; a start frame's people get left/centre/right; distant things get scale and where they are seen; every
sequence prompt ends with its place in the film and what belongs to the next clip.

## A proper start frame: real place + generated characters (`V3/compose/keyframe.mjs`, 2026-11-02)

Our first bridge still came from one text-to-image call. The MCP's text-only clip still beat the clip seeded from it,
and the judge's words were "convincing production design" for the MCP. So the key frame is built in parts now:

1. **A real place** from Wikimedia Commons: search with `filetype:bitmap` (plain queries return PDFs and "Kew Bridge"),
   a VLM picks the best interior of the kind named in the bible, people in the photo are allowed. Picked: the USS
   Kitty Hawk's navigation bridge (public domain). One edit clears the people (10 credits), checked.
2. **Each character on its own**: qwen text-to-image from the bible's look, three-quarter view, plain grey background,
   checked against the look (10 each; all three met on the first try).
3. **Composite one at a time**: qwen edit with two inputs (the frame so far + the character), "place that exact person
   from image 2 into image 1 … keep everything already in image 1"; checked after each step for presence, likeness,
   scene kept and earlier people kept (10 each; all yes).

60 credits for the frame. Judged by eye: a real bridge with windows, consoles and a brass helm; the three characters
recognisable but studio-lit and lined up, so the frame reads as a composite. Whether that matters to the video model
is the test: our case 3 and the MCP both ran from this frame (`v3-ship-1-s1-case3b`, `mcp-ship2/I97c`).

## Clip 1 from the real-bridge key frame: three arms (2026-11-02)

Same frame (`refs/bridge_real/frame-3-helmsman.png`), same 15 s, audio on, ltx-2.5 image-to-video everywhere.

| Arm | Last step | Identity vs the frame | Actions | Speech |
|---|---|---|---|---|
| ours C (`v3-ship-1-s1-case3b`) | sequence record + rules | all five yes | fail both attempts: nobody points, binoculars timing off | one line |
| ours D (`v3-ship-1-s1-plain`) | **plain clip brief + guide, nothing else** (the MCP's step) | all five yes | fail both attempts: the same two beats | one line |
| MCP (`mcp-ship2/I97c`) | its own | the three kept; **a fourth person appeared at the wheel** | binoculars, cruiser through the windows, a live radar screen | "Enemy crews are on the horizon!" then "Main battery, open fire!" twice |

Scores and pairwise verdicts: `V3/runs/v3-ship-1/scores-s1-real/scores.json` (filled in below when judged).

What the frame did: the room held for everyone, and nobody drew a ghost ship inside the bridge this time; the frame has
windows with sea behind them, so the cruiser had somewhere to be. What it did not do: make the model perform the
pointing and the binocular raise on cue. Ours asked for them in order and got stillness; the MCP got the binoculars and
the screen but invented a fourth sailor. The composite's stiffness (three people lined up, studio-lit) carried into
every clip as stillness.

Scores (same must-haves, same judge): **ours C 46 · ours D (plain brief) 64 · MCP 64.** Pairwise: D beats C clearly
(the layer removal is worth 18 points on the same frame); the MCP beats D clearly on action (the lookout points, the
binoculars go up and down, a prominent screen) while losing on the fourth sailor and green graphics. Page:
`V3/runs/v3-ship-1/real-frame-s1.html`. All seven clip 1 arms, by score: ours words 43 · ours still 63 · MCP words 73
· MCP still 79 · ours real frame 46 · ours real frame + plain brief 64 · MCP real frame 64.

So: the premade generated still (79 for the MCP) beat the real-bridge composite (64 for the MCP) for the same system.
The composite's stillness cost more than its realism gained. Next frame: generate the still in one pass from the bible
(as `refs.mjs` does) but with the people mid-action and the window view in it, or composite onto the real place with
the characters posed, not lined up.

## The student film, clip 1: words only vs three portraits as @references (2026-11-02)

Story from `film.mjs` (setting block + one paragraph per clip). Clip 1 paragraph fed verbatim to both arms.

| Arm | Call | Identity | Score on the paper | Review |
|---|---|---|---|---|
| A words only (`v3-student-1-c1`) | ltx-2.5 text-to-video, two attempts, 720 cr | the three match the setting's anchors | "385/" then "3/00" | fail: pointing, nudge, covering, the score |
| B three portraits (`v3-student-1-c1-refs`) | **minimax-h3 text-to-video with @evan @maya @leo** (gpt-image-2 portraits, one attempt, 360 cr) | **every frame matched every portrait** (nine yes) | **"38/100" legible** at 4.5 s and in the last frame | fail on one point: the palm leaves the score showing |

B is the best clip of the day: Maya pointing at "38/100", Leo grinning beside her, the right faces, the right clothes,
the classroom behind. The references were not pasted in as shots; they were used as likenesses, which is what the
prompt told the model ("likenesses, not shots to paste in") and what the portraits' plain-grey backgrounds allowed.
Page: `V3/runs/v3-student-1/ab-c1.html`.

What this says about case 3's two mechanisms: a start frame holds a room and a composition; named references hold
people. For a people scene with a readable prop, references on minimax-h3 beat a composite start frame on ltx-2.5,
at the same 24 credits a second. The earlier paste-in failure (the flower still rendered as a shot) came from a full
scene used as a reference; portraits on a plain background do not get pasted.

## The MCP given only the one-line student request (`mcp-student/I98a`, page `V3/runs/v3-student-1/mcp-autonomous.html`)

One turn, no questions, no approvals asked: guide → three `create_video_from_text` calls on ltx-2.5, 15 s each, audio
off, no references → three waits → three download links. 1,080 credits, 101 s. It did not join the clips (it has no
tool for that) and said so by handing back three links. Continuity came from words alone: every prompt opened with
the same character sentence ("a 17-year-old male student with short dark curly hair, medium brown skin, navy zip
hoodie over a plain gray T-shirt") and the same two classmates ("a boy with straight blond hair in a burgundy
sweatshirt and a girl with a dark ponytail in a green sweater"). By eye: the student is recognisably the same person in
all three clips, the classmates the same pair in clips 1 and 3, the classroom close but not identical; "4/100" and
"96/100" both legible in red. Its prompts are 1,058–1,231 characters, shorter than ours, with one sentence of
character, one of place and four beats.

That is the bar for case 2 with no references: a repeated character sentence carries identity across clips better
than our bible paste did, because it is one sentence, said the same way, at the top of every prompt.

How the MCP kept identity across its three clips, from its record: nothing was shared between the calls except text.
No references, no frames, no seeds; three independent ltx-2.5 generations. Each prompt restates the same character
clause near its top, nearly verbatim ("a 17-year-old male student with short dark curly hair, medium brown skin, navy
zip hoodie over a plain gray T-shirt"; "a boy with straight blond hair in a burgundy sweatshirt and a girl with a dark
ponytail in a forest-green sweater"), the same look words (natural daylight, muted colors, subtle film grain) and the
same prop ("red '42/100'" carried into clip 2 on the desk). Identity here is low-variance description: a rare, specific
combination of age, skin, hair, garment and colour narrows what the model draws so much that independent samples look
like the same person. It is not identity preservation: the faces differ in detail between clips 1 and 3 and the
classroom changes. It holds for a type; it would not hold for a real person's photograph. That is what references are for.

## The MCP with five references on one clip (`mcp-student2/I99a`, page `V3/runs/v3-student-1/mcp-five-refs.html`)

Attached: a stock studio portrait of an adult (Commons, CC BY-SA 4.0, "Young man, studio portrait") as the TEACHER,
the three gpt-image-2 portraits, and a real classroom (Queen's College, CC BY-SA 4.0). One `create_video_from_text`
on **minimax-h3** with all five as `@TEACHER @EVAN @MAYA @LEO @CLASSROOM`, 15 s, audio off, 360 credits, 144 s.

Its prompt: one continuous shot; one sentence per reference saying what it is "exclusively" and what to preserve
(face, hair, garment); the room's specifics named from the photo (narrow brown desks with metal frames, grid windows,
green board right, green lockers left); positions of the four people; an elevated three-quarter aisle angle so faces,
gestures and the paper are visible; five timed beats; "exactly four main characters".

Result, by eye: the real man is recognisably the teacher (face, curly brown hair, grey long-sleeve, jeans); the room is
the Queen's College classroom (glass-block upper windows, green lockers, green board); Evan, Maya and Leo match their
portraits; "38/100" in red, legible at 10 s with Maya's finger on it; Leo smirks, Maya covers her grin, Evan covers the
score at 14 s. The whole paragraph's action, in order, in one take. The best clip of the day on either system.

What it establishes: a real photograph carries a real face into a minimax-h3 clip as a named reference, the same way
the generated portraits do, and a photo of a real room carries the room. The MCP's prompt pattern for references is the
one to copy: one "@X is exclusively X: preserve …" sentence per reference, the place's specifics named from its photo,
positions stated, a camera angle chosen so the references are seen.

## The MCP with five WEB references (`mcp-student3/I99b`, page `V3/runs/v3-student-1/mcp-web-refs.html`)

Same brief, same room photo and the same teacher photo as the run above, but the three students are web photos
approved by the user: Evan = a full-body modelling shot (crouching, braids, patterned sweatshirt), Maya = a studio
portrait with an umbrella and props, Leo = a 1920s black-and-white archive portrait (the prompt asked for colour and
present-day clothes). minimax-h3, five `@names`, 360 credits, 135 s. The chat model's prompt was right: every name
mapped to the right file, each with a "preserve …" sentence, "no umbrella", "render him in full colour".

Result: the **roles swapped**. The man from the teacher photo sits at the desk as the student holding "38/100"; a
woman who is in no reference hands out the paper as the teacher; Maya is right (fringe, blouse and vest, pointing);
Evan (braids) sits in the back; Leo does not appear. The room and the score are right.

Against the run with uniform generated portraits (all four right): the difference is the references themselves. The
portraits were uniform head-and-shoulders on plain grey; the web photos are a crouching full body, a propped studio
pose and a monochrome plate. With mixed references the model keeps the room and the faces it can read but assigns
them to roles by its own prior (the adult in the plain shirt becomes the protagonist). So: **crop every person
reference to head-and-shoulders on a plain background before it goes in**, and keep the references uniform; a
black-and-white reference should be colourised first. That answers the earlier cropping question: yes, for role
mapping, not for likeness.

Sound on that clip: the call had `audio: false` and the prompt said "silent, no dialogue", and minimax-h3 still returned
an AAC track peaking at -14 dB with murmured speech that whisper transcribes as French ("T'as quand même lâché",
"Merci"). It is the model's invented room tone, not anything from the references or the brief. The MCP hands such a
file back as is; our case 3 strips the track when the story asks for no sound (added after the flower hum). A muted
copy sits beside the original on the page.

## Our references mode on the same five web references (`v3-student-1-c1-webrefs`)

Same request text as the MCP's I99b, same five files as `@teacher @evan @maya @leo @classroom`, minimax-h3, audio
off (sound bed stripped). **Roles kept**: identity teacher yes, Evan yes, Maya yes, Leo yes, classroom yes on attempt
1 (Leo "unclear" on the retry). Leo came out in colour with the swept-back hair of the 1920s plate, in a grey
sweatshirt, pointing; "38/100" legible under Evan's hands at 4.5 s. Both attempts failed only on gesture detail (an
elbow nudge, a tableau that keeps moving). 720 credits. Where the MCP's run with the identical inputs swapped the
teacher into the student's seat, ours did not; the one visible difference in the prompts is that ours describes each
@name with the VLM's reading of that photo at its first mention ("@teacher, light-skinned, short wavy brown hair, faint
stubble, grey long-sleeved shirt and blue jeans"), which pins the name to the face before the action starts.

## One start image from the five references (`V3/runs/v3-student-1/refs/start-image`, page `index.html` there)

The user's test of whether references cost quality: build ONE start image from the five, then animate it on ltx-2.5
with no references. The first step, measured:

| Method | Calls | Credits | Result (VLM-checked) |
|---|---|---|---|
| qwen-image-2.1, sequential (room, +teacher, +evan, +maya, +leo), two inputs a call | 4 | **40** | every person present; teacher and Maya "like reference", Evan and Leo "partly"; room kept at every step |
| flux-2-klein, all five inputs in one call | 1 | 5 | nicer light, but the teacher became a woman and Evan lost his twists: identities not kept |

By eye the 40-credit composite is a usable start frame: the real room, the teacher standing in the aisle in the grey
shirt, Evan front-left with the twists and the patterned sweatshirt, Maya centre with the fringe, Leo at the back. Its
weaknesses: the people read as placed rather than photographed (scale and light not quite the room's), Leo is at the
lockers instead of beside Maya, and nobody is yet doing the first action. The second step (ltx-2.5 image-to-video from
it, 360 credits) was not run: the ledger stood at 107,669 of 108,000.

## The MCP's key frame from the same five references (`mcp-student4/I99c`, page `V3/runs/v3-student-1/mcp-keyframe.html`)

One `edit_image` call on **flux-2-klein, all five pictures as inputs, 5 credits, 46 s**. Result: one coherent frame,
the Queen's College room (lockers, grid windows, green board), the teacher in the grey shirt handing a face-down
paper to Evan (braids, patterned sweater) at an aisle desk, Maya at the next desk (fringe, white blouse, dark vest),
Leo at the right as a young man in colour. Better than both of ours: the 40-credit sequential qwen build (people
placed, scale and light off, Leo by the lockers) and our own 5-credit klein one-shot (teacher became a woman).

Why theirs worked and ours did not, from the prompts: the MCP's edit prompt is about 1,800 characters and addresses
each input by number and role, "Reference image 1 is the actual room, not just inspiration: preserve its …",
"Reference image 2 is the TEACHER: preserve his precise face, short curly brown hair …", "Reference image 3 is EVAN
…", with the staging (who stands where, what is in whose hand, face down, "capture the handoff just before Evan takes
the paper") and what to drop (umbrella, lettering). Ours capped the edit prompt at 450–500 characters and said "place
that exact person from image 2 into image 1", and the sequential build added four rounds of regeneration drift.

Rules taken: a multi-reference key frame is ONE call on the model that takes the most inputs (flux-2-klein, five),
with a long prompt that names every input by number and role, says what to preserve from each, stages the frame, and
lists what to drop. No sequential compositing. `composite.mjs` and `keyframe.mjs` are superseded by that.

## One reference, one action (`v3-classroom-wipe`, 2026-11-02)

The classroom photo as the start frame, ltx-2.5 image-to-video, 10 s, no sound, "a caretaker wipes the desks". 240
credits, 33 s. The first frame is the photograph; by 4.5 s a caretaker in a dark work shirt is bent over a front-row
desk wiping it with a green cloth; the last frame has him walking the row, the room still exactly the room. The review
failed it on beat detail (he came up the middle aisle, not the window side; the first wipe landed a beat late). As a
clip it is clean. One reference at a time on the free tier is reliable; the trouble today was mixing reference formats
and my own compositing, not the model count. The practical shape for a people scene in a real place: the place photo
is the start frame, people enter as uniform head-and-shoulders references on minimax-h3 when identity must match, or a
single long-prompted klein frame when staging matters; clips of about 10 s with one action each.

## Reference-count test, the free editors (`V3/runs/reftest-1`, 80 credits, 2026-11-02)

Two refs (room + teacher) direct on each; three refs (room + teacher + Evan) by the 1+1 chain on the two-input
models, both ways on flux-2-klein; the same long per-input prompt every time; VLM checks.

| Test | Credits | Room | Teacher | Evan | Staging | Note |
|---|---|---|---|---|---|---|
| 2ref qwen-image-2.1 direct | 10 | partly | **yes** | — | partly | best face; framing and desks shifted; cut-out look |
| 2ref qwen-edit direct | 10 | yes | partly | — | partly | room exact; face approximate; papers wrong |
| 2ref flux-2-klein direct | 5 | yes | partly | — | partly | room exact; face approximate; an extra student |
| 3ref qwen-image-2.1 chain | 20 | yes | **yes** | partly | partly | both present; teacher looks away; Evan's face softer |
| 3ref qwen-edit chain | 20 | yes | partly | **no** | no | Evan's face wrong, curly hair |
| 3ref flux-2-klein direct | 5 | yes | **yes** | partly | partly | the most photographic frame; two extra background students; Evan already holding a sheet |
| 3ref flux-2-klein chain | 10 | partly | no | **no** | partly | chaining on klein loses both faces |

Readings: (1) klein with all refs in ONE call is the best frame per credit and the only one that looks like a
photograph rather than a cut-out, but faces are "partly" and it adds extras. (2) qwen-image-2.1 keeps the best face
likeness but pastes; its chain survives two people. (3) qwen-edit is the worst on faces. (4) Chaining on klein
destroys likeness; never chain klein. (5) Nobody gets the staging fully right from a still prompt ("teacher looks
away", "Evan already has a sheet"). For a start frame, the face does not need to be exact if the people then go in as
minimax references; for a still that is the deliverable, qwen-image-2.1 for the face, one person per call.

The reference-count research moved to `general/01-multi-reference-image-editing.md` (the repo-level note): one
reference into an image edit is fine; two or more is not, except flux-2-klein all at once (≤ 4 inputs) as a start frame
whose faces are allowed to be approximate. Key frames from several references are off the table on the free tier.

`reftest-3` (the MCP, reference + text vs reference + reference, nine arms) revised the multi-reference rule: pictures
carry identity, descriptions carry type; one qwen call with place + one person + one object as three pictures held;
the breakage is several faces in one still, and chaining. See `general/01-multi-reference-image-editing.md`.
