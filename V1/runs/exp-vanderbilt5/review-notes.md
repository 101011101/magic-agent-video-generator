# Review notes (vanderbilt5, shooting script v2, before any painting)

## Status
- Built: `src/script.js` (the shooting-script call, schema, code checks, text renderer), `src/prompts.js` (still plan and the two templates: no model writes a prompt after the script), `src/captions.js` (captions as overlay cards), `experiments/fact-film3.mjs` (runner; stops before painting without `--build`).
- Run: script, checks, cast lines and every prompt assembled. Nothing painted, nothing committed. Text calls only.
- Checks passed: timing contiguous and on wan-3.0's grid, every element in every frame, thirds change only with an action, continuity across cuts copied word for word (zero notes), beats inside their shots, fixtures declared.
- Plan: 4 distinct stills for 6 shots (shots 2, 4, 6 share one still; 3 and 5 share another; shot 1 has two).

## What changed from the sketch
- The frames are `first` and `last`: the first run named the first frame `start`, which collided with the shot's start second and broke every timing check.
- Frame fields must use the painter's words (screen left/right, an arm's length, a pace): the second run wrote "0.9 metres northeast of vanderbilt". The third run used body terms throughout.

## For your judgment (none are code errors; nothing was edited by hand)
1. One scene, no exterior: the model starts at the doorway instead of outside the mansion. Faithful to the story; the earlier version had an establishing shot.
2. Coverage is two setups only: every cut after the walk-in is a punch in or out along one sightline with all three men in frame. Correct by the rules (a real size change each time) but monotonous. Dialogue coverage with singles or over-the-shoulder shots would be a rule added to the script stage, not an edit of this script.
3. Five of six clips have identical start and end stills: nobody moves during the lines, so the video model must animate speech between two identical frames. Untested here; clip 5 at 9 seconds is the one to watch.
4. Voice descriptors are wordy and carry commentary ("plausible rather than documented"); they come from the cast voice call and go verbatim into the clips.

## Build cost if approved (Magic Hour credits)
| item | credits |
|---|---|
| 4 stills at 200 | 800 |
| 30 s on wan-3.0 at 96 per second | 2,880 |
| total | 3,680 |

On approval: `--build` paints the stills (each checked by count and third, one retry), makes the 6 pinned clips, stitches, burns the three captions as overlays; then code, docs and run are committed together. On rejection: everything rolled back.
