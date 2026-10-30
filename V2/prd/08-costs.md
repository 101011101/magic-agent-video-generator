# 8. Costs

Per item, Magic Hour credits:

| item | credits | note |
|---|---|---|
| still, nano-banana-pro, 2k | 200 | an attempt; a retry is another 200 |
| crop of the master used directly | 0 | used in every Top Gun run; a crop below 50% of the master's width is painted from, 200 |
| music bed | 1 per second | 30 for a 30-second film |
| text-to-video sequence | 96 per rendered second on wan-3.0 | rendered at the grid length above the shots' total, 1.4× longer with `--speed-up` |
| plate, generated | 200 | only when no usable empty photograph is on record |
| clip, wan-3.0, 720p, audio | 96 per second | 30 s of clips = 2,880 |
| clip, veo3.1 with audio | 120 per second measured in the dialogue test | audio adds credits |
| lip sync, lite | about 1 per frame | design; a 30-second film about 900 |
| text, vision and TTS calls | 0 credits | OpenAI usage, not metered here |

A 30-second static dialogue film of six shots: five stills (1,000) plus 30 s of clips (2,880), about 3,900 when every item
passes first time. With crops in place of the singles and the three-shot, the same film would paint two stills and crop or
re-render the rest.

The vanderbilt6 run, the first full pass of the v2 structure, cost 7,112 credits, of which about 2,000 is in things still
in use: the two walk-in keyframes, the walk-in clip, and the three dialogue keyframes repainted from the master. The rest
went to the first film built on the wallpaper keyframes, to clip remakes the identity gate forced, to two keyframes the
exact-thirds gate rejected for nothing, and to one clip render orphaned by a crash (ticket T-007). The ledger before that
run stood at 119,864 credits across all earlier runs.

The first V2 run (`vanderbilt`, 2026-10-30) reached the keyframe prompts at zero credits: 18 text and vision calls on the
first pass, 3 on the second after the plate check and the narration field were added, none on the third, which only
re-planned. V2 keeps its own ledger at `V2/runs/ledger.json`, starting from zero.

Rules that bound spending: `CLEANED_CAP` is a hard cap on the ledger total; a job is reserved before it is posted; a POST is
never retried; the pipeline stops before the first still and before the first clip unless told to continue; gates do not
remake; `--no-generate` records what would be generated instead of spending.

**The V2 ledger on 2026-10-30, by run** (all Top Gun runs share one story and bank; sheets were made once):

| run | credits | what |
|---|---|---|
| vanderbilt | 1,000 | one plate, four stills; no clips (the two-shot undecided) |
| topgun | 7,488 | 5 sheets, 16 stills with 4 repaints, 9 pinned clips; the first film |
| topgun2 | 11,510 | 20 stills (10 of them an unasked repaint, restored), 11 pinned clips, 3 text-to-video variants, one 15-s sequence, music; the second film |
| topgun3 | 8,102 | 20 stills with 6 repaints, three sequences, music; the third film |

A 30-second ad costs about 4,000 in stills and 3,000 in clips once its sheets exist; the repaints and variants of a day of
building the rules are the rest.
