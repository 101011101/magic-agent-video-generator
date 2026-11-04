# V3 architecture

## Where video composition sits

```
user message
   │
   ▼
agentic loop (V2 agent: sheet → plan → execute)
   │   tools: trim, assemble, text-overlay, voice, music, crop, filter, check, image tools …
   │
   ├── step: compose-video(brief)            ← ONE tool call among the others
   │        │
   │        ▼
   │     video composition
   │        1. story        natural language → a grounded story (who, where, when, what happens, mood, exact words,
   │                         duration, aspect, sound)          [research gate here for non-fiction]
   │        2. route        one clip ≤ 60 s and nothing specific → case 1
   │                         specific reference / first frame   → case 3
   │                         longer, or parts that must be apart → case 2 (split → case 1 then case 3s)
   │        3. clips        case 1: story + prompt rules → prose prompt → ltx-2.5 → VLM review (≤ 1 retry)
   │                         case 3: as case 1, with a start frame or references, model chosen by what it needs
   │        4. return       the clip file(s) + the state record (what is in each clip) to the loop
   │
   └── later steps (if the plan has them): assemble the clips, add the title card, the music bed, resize …
```

The loop decides whether anything happens after the clips. Video composition never trims, overlays or mixes.

## Modules (planned files, nothing built yet)

```
V3/
  docs/                      these notes
  compose/
    story.js                 natural language → story record (one LLM call; a research call first when non-fiction)
    route.js                 story → case (code: length, references named, first-frame demanded)
    prompt.js                story (+ clip span) + prompt rules → one prose prompt ≤ 2,000 chars (one LLM call)
    clip.js                  the Magic Hour call: text-to-video (case 1) or image-to-video / references (case 3), wait, download
    review.js                VLM on 3–5 frames against the story's beats; pass / regenerate once / report
    state.js                 the state record per clip: people, place, props, light, exact words, last frame path
    split.js                 case 2: story → clip spans with what each must carry from the previous one
    guide.md                 the prompt rules (the MCP's shape, our additions), fed to prompt.js verbatim
    compose.js               the entry the loop calls: compose(brief, {materials, tier, cap}) → {clips, state}
  bench/
    flower.json              the Petal & Stem brief, judged against results/mcp-flower (87–88)
```

Reuse from V2 without copying: `V2/backend/lib/magichour.js` (upload, create, wait, download, detectFaces),
`V2/backend/lib/llm.js` (jsonCall), `V2/backend/tools/check.js` (VLM frames) and the ledger/cap.

## The story and sequence records

The story is prose plus a few fields. A sequence is the same record for the part one clip covers (for a short video, the whole story). Neither is a screenplay; neither has shots. Vocabulary: `05-macro-architecture.md`.

```json
{
  "prose": "At dawn a florist in a sage apron unlocks Petal & Stem ... ends on the shop front.",
  "kind": "fiction | non-fiction",
  "people": ["an adult florist, sage-green apron"], "place": "a small neighbourhood flower shop", "time": "dawn",
  "mood": "warm, natural light, calm", "exact_words": ["Petal & Stem"],
  "seconds": 16, "aspect": "16:9", "sound": "none | ambient | music | narration | dialogue",
  "specific": [],                       // references the user supplied or demanded (case 3 trigger)
  "first_frame": null,                  // a required first frame (case 3 trigger)
  "facts_checked": []                   // non-fiction: what the research call confirmed
}
```

## Routing (code, no LLM)

- `seconds ≤ 60` and `specific` empty and `first_frame` null → **case 1**.
- `specific` non-empty or `first_frame` set → **case 3**.
- `seconds > 60`, or the prose has parts the story marks as separate scenes that one prompt cannot hold → **case 2**:
  split into spans of ≤ 60 s (ltx-2.5) or ≤ 30 s (minimax-h3 when references are needed), first span → case 1 or 3,
  later spans → case 3 with the previous span's last frame as the start frame.

## Model choice (code)

| Need | Model | Why |
|---|---|---|
| text only | ltx-2.5 | free default, up to 60 s, 24 cr/s at 480p; the MCP's choice |
| a start frame (and optionally an end frame) | ltx-2.5 image-to-video | start and end frame both supported at 480p |
| named references in the prompt (@name) | minimax-h3 | the only free model that takes references; ≤ 30 s; pasted our still in literally once, so prefer a start frame when one frame is enough |

## Review

Three to five frames at the beat boundaries, a VLM asked per beat: is the stated subject there, the action, the exact
words (if any), and does the last frame hold. One regeneration at most, with the failures appended to the prompt as
plain sentences. Then return, pass or not, with the review attached. The loop (or the user) decides what to do with a
fail; composition does not loop forever.

## Credits

Case 1 flower: 16 s × 24 = 384. A retry doubles it. The cap stays the ledger's (103,000 at the time of writing).
