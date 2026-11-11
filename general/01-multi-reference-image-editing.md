# Multi-reference image editing on the free tier: do not

Research note, 2026-11-02. Applies to any pipeline on Magic Hour's free plan, ours or the MCP's: both call the same
`/v1/ai-image-editor` endpoint with the same models. Evidence: `V3/runs/reftest-1` (our calls), `V3/runs/v3-student-1/refs/start-image`
(our calls), `V2/sessions/mcp-ms5-I99c` (the MCP's own key frame), `V3/runs/v3-ship-1/refs/bridge_real` (our composites).

## The rule

- **One reference into an image edit is fine.** A place photo as a start frame, a single person placed into a room, a
  still edited into the next scene: all held today.
- **Two or more references into an image edit is not.** The free editors cannot hold two identities and a room at once.
  Faces come out "partly" at best, the staging is never right, and chaining (room + A, then output + B) degrades every
  earlier face. So: do not build key frames from several references, and avoid the free image editors whenever the job
  carries more than one reference. Put the identities into the video call instead (minimax-h3 takes up to nine named
  references and kept five faces in one clip today) or accept one reference per still.

## What was measured

The free still models that take more than one input: qwen-image-2.1 (2 inputs, 10 cr), qwen-edit (2 inputs, 10 cr),
flux-2-klein (5 inputs, 5 cr). Tests: two references (a real classroom + a real man as the teacher), three (+ a real
young man as Evan); all at once where the model allows, 1+1 chain where it does not; one long per-input prompt in the
MCP's style for every call; a VLM check against the room photo and each face.

| Test | Credits | Room | Teacher | Evan | Staging |
|---|---|---|---|---|---|
| 2 refs, qwen-image-2.1, all at once | 10 | partly | yes | — | partly |
| 2 refs, qwen-edit, all at once | 10 | yes | partly | — | partly |
| 2 refs, flux-2-klein, all at once | 5 | yes | partly | — | partly |
| 3 refs, qwen-image-2.1, 1+1 | 20 | yes | yes | partly | partly |
| 3 refs, qwen-edit, 1+1 | 20 | yes | partly | **no** | no |
| 3 refs, flux-2-klein, all at once | 5 | yes | yes | partly | partly |
| 3 refs, flux-2-klein, 1+1 | 10 | partly | **no** | **no** | partly |

Earlier the same day: a five-reference frame built by four sequential qwen edits (40 cr) came out as placed cut-outs;
the MCP's five-reference frame on flux-2-klein in one call (5 cr) was the best of the day but still "partly" on faces.

## Readings

1. Nothing reached "yes" on every face with two or more people. The only model with any hope is flux-2-klein, all
   inputs in one call: cheapest, the only output that looks like a photograph, but faces approximate and extras invented.
2. qwen-image-2.1 keeps a single face best and pastes it; qwen-edit is the weakest on faces.
3. Never chain flux-2-klein: a second pass loses every earlier face.
4. Staging ("hands the paper", "looks up") does not come from a still prompt on these models; it comes from the video prompt.
5. Resolution: everything is 640px on the free plan; a start frame made this way is also the ceiling of the clip's detail.

## What to do instead

- Identity: named references in the video call (minimax-h3), one head-and-shoulders crop per person, in colour,
  uniform format, each named at first mention with its look. Five held in one clip today.
- Place: the place photo as the start frame (ltx-2.5 image-to-video), one reference, and the people by words or by
  minimax references.
- A still that must show several specific people is a paid-model job (nano-banana, gpt-image, seedream take 9 inputs).

## flux-2-klein, all at once, 3 / 4 / 5 references (`V3/runs/reftest-2`, 15 credits)

| Refs | Elements | Room | Faces (VLM) | Extra people | By eye |
|---|---|---|---|---|---|
| 3 | room + Maya + Leo | yes | Maya partly, Leo partly | 0 | coherent, the room exact; the two sit at desks looking at the board, not at each other; faces small and in profile; Leo generic |
| 4 | room + teacher + Evan + Maya | partly | teacher yes, Evan yes, Maya yes | 1 | the best frame of the series: the teacher handing the sheet to Evan (braids, patterned sweater), Maya at the right; one extra girl behind; desks rearranged |
| 5 | room + teacher + Evan + Maya + Leo | partly | teacher yes, Evan yes, Maya yes, Leo partly | 2 | six people: Maya duplicated, Leo replaced by a generic young man; lockers moved; the handoff itself fine |

Reading: flux-2-klein all at once is not fried the way the chains are. At 3–4 references it gives a coherent,
photographic frame with the room kept and the people recognisable as types (and, for the named man, as the man); at 5
it starts duplicating and editing the room. Staging is always "partly". So the rule stands with one exception:

**Rule.** With one reference, edit freely. With two or more, do not use the free image editors for anything whose
value is the identity of the people, and never chain. The one permitted use is flux-2-klein with every reference in a
single call, at most four inputs, as a START FRAME only, where the faces need only be approximate because the video
step carries identity by its own named references. A still that is itself the deliverable with several specific
people is a paid-model job.

## Reference + text vs reference + reference (`V3/runs/reftest-3`, the MCP, 100 account credits, 2026-11-02)

Nine arms, three scenes, each element either attached as a picture or given as a 100-word VLM description of that
picture. The MCP chose qwen-image-2.1 for every arm and passed every attached picture as an input (two inputs for
room + man, three for lake + man + pot: so qwen-image-2.1 accepts more than the two inputs our registry lists).
Each output was checked against the REAL picture of every element.

| Scene | Arm | Place | Person / object | By eye |
|---|---|---|---|---|
| 1 Vanderbilt in the classroom | classroom pic + man as text | exact | a 19th-century man with sideburns, not him | the room; a type, not the person |
| | man pic + classroom as text | generic old classroom | **him** (face and hair from the daguerreotype) | the person; a type of room |
| | both pictures | **exact** | **him** | both carried, one coherent image |
| 2 Tourbillon at the Golden Gate | bridge pic + car as text | the bridge | a Chiron-like Bugatti, not the Tourbillon | 100 words did not make the Tourbillon |
| | both pictures | the bridge | **the Tourbillon** (C-line, ice blue, grille) | both carried |
| 3 Twain, pot, Moraine Lake | lake pic + two texts | exact | Twain-like man; generic carved pot | types |
| | lake pic + Twain text, then + pot text (1+1) | exact | Twain-like; generic pot | no better than one call |
| | Twain pic + two texts | Moraine-like lake | **Twain**; generic pot | the person carried, the place a type |
| | three pictures | **exact** | **Twain**; **the pot** (bands, the four-lobed motif, the lug) | all three carried |

Readings:
1. **A description carries the type, a picture carries the identity.** In every scene the text arm produced the right
   kind of man, car, pot or room and never the specific one; the picture arm produced the specific one.
2. **Reference + reference beat reference + text in all three scenes**, including the three-picture arm. So the
   earlier "2+ is fried" reading was too broad. What broke in `reftest-1/2` was several FACES in one frame (two or
   three people) and chaining. One person plus a place plus an object, all as pictures in one qwen call, held.
3. The 1+1 chain bought nothing over a single call with both texts.

## The rule, revised

- A picture whenever the identity of a thing matters; a description only when the type is enough.
- One image-edit call with all the pictures, on qwen-image-2.1 when there is at most ONE face among them (place +
  person + object held at three inputs); flux-2-klein all at once, ≤ 4 inputs, when a start frame with several
  approximate people is wanted. Never chain.
- Two or more FACES that must each be exact in one still: not on the free tier. Carry people into the video step as
  minimax-h3 named references instead (five held in one clip), or use a paid editor.
