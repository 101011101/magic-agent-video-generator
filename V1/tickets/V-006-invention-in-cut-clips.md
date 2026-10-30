# V-006 — Cut clips invent content (no end frame to pin them)
**Status:** open
**Cost:** 0 to test the prompt fix; one clip per arm to test pinning
**Blocked by:** V-002

## Problem
A clip with a start frame only drifts away from its keyframe as it plays. Probe clip 8 lit a fire that is cold in slide 8 and in every other kitchen frame — a continuity error the next visit to the kitchen would contradict.

## Evidence
`runs/goldilocks-v1/clips/clip-8.mp4`, frames at 2–5 s, vs `frames/s8-a2.png`. QA reported first ≈ start 0.995 only.

## Done when
QA also compares the LAST frame of a cut clip with its start keyframe (static parts), and two fixes are tried on clip 8: (a) the prompt lists what must not change ("the fireplace stays cold and dark"), (b) end frame = start frame (a "hold" clip). The better one becomes the cut rule.
