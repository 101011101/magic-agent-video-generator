# T-025 · Sequences: one clip per run of shots, keyframes as references

status:     built 2026-10-30; to be exercised on the Top Gun attack scene
priority:   high
subsystem:  edit, state

what:
`--clips seq`: group consecutive shots of a scene up to 15 seconds, render each group as one text-to-video clip on wan-3.0
with every keyframe as an ordered named reference and the hard cuts stated in the text, trim to the shots' total at the
stitch. Then decide the default per film kind from a side-by-side with the pinned clips: motion quality, how far the first
and last frames sit from the stills (SSIM), identity, cost. Open after that: letting the writer plan sequences directly
(a shot group as a screenplay unit), and camera moves within a sequence now that nothing is pinned.

why:
Clip 7 of the second Top Gun film: the two pinned stills came from two camera positions and the jets pivoted mid-clip;
every 3-second clip of both films feels slow. The user's proposal: give the video model more frames and more seconds and
let it make the cuts. The API supports it (text-to-video with ten references, up to 30 seconds on wan-3.0).

acceptance:
Scene 7 of the second film (four shots, 12 seconds) rendered as one 15-second sequence trimmed to 12, beside the four
pinned clips, on the run page; the default written into `07-edit.md`. Cost about 1,440 credits for the sequence.
