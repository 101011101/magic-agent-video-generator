# T-001 · Crop-based punch-ins

status:     open
priority:   high
subsystem:  state, keyframes

what:
When a shot is a tighter view of the scene's master from the same side, cut the keyframe out of the master instead of
asking the painter for a new picture. The people gate on the master returns each person's horizontal position and
vertical extent; from the shot's size and the people in frame, code computes the crop box (knees up for a medium-wide,
chest up for a medium-close, head and shoulders for a close), keeps 16:9, clamps to the image. If the crop is at least
about 60% of the master's width it is the keyframe as it stands, at no cost. If it is smaller, it goes to the painter as
image 1 with the edit branch: "this exact framing, re-render at full detail", portraits only for the people in it whose
faces the crop shows too small. The still record says `from: crop:<master>`.

why:
The image editor is not a camera. Given the whole room as image 1 and asked for a medium-wide of the same instant, it
repainted the room and moved the fireplace to the right of both windows (vanderbilt6, s1-5-r1); asked for a single of
Vanderbilt from the Lincoln single, it kept the composition and swapped the man (s1-4, first build). A crop of the master
is the room's own pixels.

acceptance:
On the vanderbilt6 screenplay the three dialogue keyframes are produced as crops of s1-2 (the three-shot used directly, the
two singles painted from their crops), the room gate passes all three without the arrangement flags of 2026-10-30, and the
cost of the three is at most 400 credits.
