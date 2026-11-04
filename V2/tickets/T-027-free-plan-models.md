# T-027 · Run on the free-plan models: which ones, what they cost, how well they stand in

status:     open
priority:   medium
subsystem:  lib, keyframes, assets, edit, screenplay

what:
A `--tier free` setting (or the existing `--still` and `--model` flags plus a resolution flag) that routes every paid
Magic Hour call to a model the Free plan accepts, at the resolution it allows, and a measured run of the Top Gun brief on
that routing against `topgun3`. The structures that change:

- `IMAGE` in `lib/jobs.js` and the `"2k"` literal in `keyframes/keyframes.js` become per-tier: free is `640px`.
- `COST.image` in `lib/jobs.js` is a flat 200; it becomes a table per image model so the ledger and `--dry` are right
  (free editors are 5 to 10 credits an image).
- `VIDEO_RATE` in `lib/jobs.js` carries one rate per model; it becomes per resolution (ltx-2.5 and minimax-h3 are 24 at
  480p, 48 at 720p, 72 at 1080p).
- the carrier cap in `state/state.js` (`worthy`, the prominence sort) takes the editor's input limit as its ceiling, so a
  still never sends more references than the model accepts.
- `GRID` in `screenplay/screenplay.js` already has ltx-2.5 and minimax-h3; nothing to add.

Today's paid calls, from the `topgun3` record (8,102 credits), and the free stand-in for each:

| call | today | credits | free stand-in | credits | what changes |
|---|---|---|---|---|---|
| keyframes and generated sheets, `ai-image-editor` | nano-banana-pro, 2k, up to 9 extra inputs (4 used since the cap) | 25 jobs, 5,000 | flux-2-klein, 640px, 5 extra inputs | 5 each, about 125 | the only free editor that takes the plate plus three carriers; 640px longest edge is below the 1280 px film |
| | | | qwen-image-2.1 or qwen-edit, 640px, 2 extra inputs | 10 each | measured best framing of the five editors; needs the carrier cap at 2 |
| plates and character sheets, `ai-image-generator` | nano-banana-pro | 3 jobs in `topgun` | flux-2-klein, z-image-turbo, flux-schnell, 640px | 5 each | reused across runs, so rarely paid |
| clips, `text-to-video` with references | wan-3.0, 720p, audio, up to 10 references | 3 sequences, 32 s, 3,072 | minimax-h3, 480p, audio included, 1 to 30 s, references of images, video and audio | 24 a second, about 770 | the only free model that takes the stills, portraits and voice samples as `@name` references |
| clips, `image-to-video` pinned on two stills | wan-3.0 | (the `topgun` and `topgun2` path) | ltx-2.5, 480p, audio included, 1 to 60 s, end frame | 24 a second | no documented references, so voice references are lost on this path |
| music bed, `ai-music-generator` | 30 s | 30 | the same | 30 | the sheet does not say whether the Free plan may call it; the run will tell |
| text, vision, TTS | OpenAI | 0 Magic Hour credits | unchanged | 0 | |

A `topgun3`-sized run on the free routing is about 1,000 credits against 8,102. The Free plan's allowance (400 at signup,
100 a day for seven days) covers one such run; the output is 480p, watermarked on the web app (the API rule is not
stated), and not licensed for commercial use. Creator and above may call the same models at 720p and 1080p for twice and
three times the per-second rate, with no watermark and commercial rights, so "free models" is also a cost tier on a paid
plan, not only a plan.

why:
The user's question on 2026-10-30: what does free mean, and are the free models worse. The answer from the record:

- `V1/runs/exp-vanderbilt2` (29 Oct) put the same reframe through five editors with the same references and prompt.
  qwen-image-2.1 (20 credits) and seedream-v5-pro gave the tightest true two-shots with the room's door, curtains and
  clock where the base had them, sides and the handshake held; nano-banana-pro (200) and gpt-image-2 framed wider;
  flux-2-klein (10) added a fourth man and lost Lincoln's face. So the cheap editor that takes enough inputs is the one
  that failed identity, and the one that held identity takes only two inputs.
- `V1/runs/exp-bakery/i2v` (28 Oct): one 10 s ltx-2.5 clip at 480p held the room, camera, four people and their
  clothes for the full clip with no face drift and landed the emotional beat; it failed on who holds what and how many,
  the same failures as the expensive grids. The note there: spending more per clip does not fix the bookkeeping.
- Nothing has measured minimax-h3, and nothing has measured any free model inside the V2 chain (pinned ends, the people
  and room gates, the style gate, the sequence path with voice references).

acceptance:
The Top Gun brief rerun with `--reuse topgun3` on the free routing, both clip paths (minimax-h3 text-to-video with
references; ltx-2.5 image-to-video pinned), as `V2/runs/topgun-free/`. A table in `V2/drafts/` against `topgun3`: people
gate and room gate pass rates on first attempt, retries per still, clip gate verdicts, SSIM of clip ends to their stills,
identity and texture by eye on the results page, credits and wall time. Then a decision in `10-decisions.md`: free routing
as the development tier (iterate on screenplay, state and prompts at an eighth of the cost) and paid for finals, or not.
Cost about 1,000 credits on a free account, or 2,000 at 720p on Creator for a like-for-like resolution.
