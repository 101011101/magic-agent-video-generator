# V3 macro architecture (the reference version, 2026-11-02)

This is the one to point at. `00-principle.md` has the reasoning; this has the shape.

## One sentence

The agent has a **clip composition** ability with three sub-cases, and a few **tools around it** that feed the right
references into a case and keep track of what was fed and what came out; everything else a video needs (cuts, titles,
sound, sizes) is the ordinary agentic loop.

## The picture

```
                    ┌──────────────────────────── agentic loop (V2) ─────────────────────────────┐
  user request ───► │ sheet → plan → execute                                                      │
                    │   ordinary tools: trim · assemble · text-overlay · voice · music · crop ·   │
                    │                   filter · check · image tools · …                          │
                    │                                                                             │
                    │   compose-video ◄──────────── one tool among the others                     │
                    │      │                                                                      │
                    │      ▼                                                                      │
                    │   ┌──────────────── clip composition ────────────────┐   ┌── tools around ──┐│
                    │   │ story ──► sequences ──► case per sequence        │   │ seed bank        ││
                    │   │                                                  │   │ (attachments,    ││
                    │   │   case 1  text only                              │◄──┤  stills we make) ││
                    │   │           sequence + guide → prompt → ltx-2.5    │   │                  ││
                    │   │                                                  │   │ state manager    ││
                    │   │   case 3  a specific thing  (= case 1 + inputs)  │◄──┤ (what is in each ││
                    │   │           start frame · @references · model      │   │  clip, last      ││
                    │   │                                                  │──►│  frame, words)   ││
                    │   │   case 2  several sequences (= a router)         │   │                  ││
                    │   │           split → first: case 1/3 → rest: case 3 │   │ frame picker     ││
                    │   │                                                  │   │ (by timestamp)   ││
                    │   │   review  VLM on frames, one retry               │   └──────────────────┘│
                    │   └──────────────────────────────────────────────────┘                       │
                    │      │ clips + state record                                                  │
                    │      ▼                                                                       │
                    │   later plan steps: assemble, title card, music bed, resize, captions …      │
                    └─────────────────────────────────────────────────────────────────────────────┘
```

## Vocabulary

| Word | Means | Size |
|---|---|---|
| **story** | the whole thing the user asked for, as grounded prose plus a few fields | the request |
| **sequence** | the part one clip covers: a self-contained run with its own small arc; for a short video, the whole story | one clip, ≤ 60 s |
| **beat** | one timed range inside the operational prompt: framing, one action, one camera move | 2–8 s |
| **operational prompt** | the single prose paragraph sent to text-to-video, written from a sequence and the guide | ≤ 2,000 chars |
| **guide** | the prompt rules: the MCP's three lines plus the measured prompt shape | a file, `compose/guide.md` |

Not every video is a story (a loop, a turntable, a mood piece have no plot), but every video has a **subject, a duration
and a progression**: what is on screen and what changes, second by second. The story record is written so the plot
fields may be empty and the progression never is. A story is the case where the progression has people and events.

## The three cases

| Case | In | Out | Build order |
|---|---|---|---|
| **1 text only** | one sequence, nothing specific | one clip from ltx-2.5, no references | first |
| **3 a specific thing** | one sequence + a start frame and/or named references | one clip; ltx-2.5 image-to-video for a start frame, minimax-h3 for @references | second |
| **2 several sequences** | a story too long or too varied for one clip | nothing itself: splits into sequences, sends the first to case 1 or 3 and every later one to case 3 with the previous clip's last frame | third |

Case 2 is finished when case 3 is, plus a splitter and the state manager.

## The tools around the cases

- **Seed bank.** Only for seeding a case 3 clip: the user's attachments and stills made on purpose. Never consulted
  for continuity between clips.
- **State manager.** After every clip, a VLM reads what is actually in it (people, place, props, light, exact words
  visible) and the last frame is saved. The next sequence is written against what was made, not what was planned.
- **Frame picker.** When a later sequence needs something that is not in the last frame (a person who left the shot),
  it is found by timestamp in the state record and a frame is pulled from that clip to go in as a reference. This is
  the only time references come from earlier clips.
- **Review.** Three to five frames at beat boundaries, judged per beat against the sequence. One regeneration at most.

## The operational prompt has slots

Every operational prompt fills the same slots in the same order. Case 1 fills them all from the sequence in words.
Later cases can fill some slots from other sources without changing the shape: a style can come from a reference still
read by a VLM into the look slot, or be carried by a start frame; a likeness can come in as an @reference at its beat.

| Slot | Case 1 source | Possible later source |
|---|---|---|
| format: duration, aspect | sequence fields | — |
| look: medium, light, mood, world | sequence prose | VLM reading of a style reference; a start frame |
| continuity: what stays the same | sequence people/place/props | state record from the previous clip |
| beats: time range, framing, subject, one action, camera | sequence progression | — |
| exact words, quoted once | sequence exact_words | — |
| sound | sequence sound | — |
| ending hold | always | — |
| grade and pacing | sequence mood | a style reference |
| negatives, one line, last | always | — |

See `04-mcp-reference.md` for the MCP's prompt with the slots marked.

## Revision 2026-11-02 (evening): the clip maker gets the story, not a rewrite

The first sequencer (`case2.mjs`) wrote a JSON record and later a "brief" per clip; both were rewrites, and both
changed the request's verbs and order (the flower's "arranges" became "finishes", the lookout's pointing moved after
the captain's binoculars). `film.mjs` replaces that:

```
natural language ──► STORY = SETTING block (places relationally, each person with 2–4 anchors, light and grade)
                              + one paragraph per clip (the clip's actions in order, verbs plain, lines quoted, how it ends)
                     ──► per clip: case 1 (no reference) or case 3 (a start frame)
                              the prompt writer receives EXACTLY: the setting, that clip's paragraph verbatim, the guide
                     ──► generate · review · next clip
```

Why this is the MCP's sub-case: the MCP's prompt writer receives a request paragraph and the guide and emits the
create call. Ours receives setting + paragraph (the request for this clip) and the guide and emits the prompt and the
beats. Same inputs in kind, same output in kind, same model. What still differs, by construction: (1) our guide is the
MCP's three lines plus the measured prompt shape, a superset; (2) we fix model, resolution, aspect and audio in code from
the story where the MCP picks them itself (it picked the same: ltx-2.5, 480p); (3) we ask for the beats and lines as
structured output beside the prompt, for the review. None of these changes what the writer is asked to write. The
empirical check is one MCP run given the identical setting + paragraph as its request; not run yet.
