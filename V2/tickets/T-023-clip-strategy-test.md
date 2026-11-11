# T-023 · Pinned end frame, start frame only, or text-to-video with references

status:     built 2026-10-30 (`--clips pinned|start|t2v`, `--only clip-N`, variants kept and shown); the measured test is still to run
priority:   high
subsystem:  edit, state

what:
On one fast action shot (the Top Gun release, shot 7 of the first film, rewritten under the still-camera rule), render
the same clip three ways and compare: (a) image-to-video pinned on the first and last stills, as built; (b) image-to-video
from the first still only, the next shot's first frame then painted from the clip's actual last frame instead of a
painted end still (the stills chain runs through the clips, so painting and rendering interleave); (c) text-to-video on
wan-3.0 with the stills and portraits as named references (@name) and no pinned frame, which allows clips up to 30 s. Score
each on: the first and last frames against the stills (SSIM), the identity gate, motion quality by eye, and cost (a 4 s
clip is 384 credits on wan-3.0 in every mode; (b) saves the 200-credit end still per shot).

why:
The user's reading of the first Top Gun film: the pinned end frame fights the physics of a fast shot, and the clips feel
slow. The screenplay and prompt causes (a written camera move, no pace, nine references) are fixed; what remains is
whether pinning both ends is the right default for action, and whether text-to-video with references is a better tool for
long or fast shots.

acceptance:
Three clips of the same shot in `V2/runs/<label>/clips/`, their scores in a table in `V2/drafts/`, and the default chosen
per shot pace (for example: pinned for dialogue and held shots, start-only or text-to-video for fast ones) written into
`07-edit.md` and `10-decisions.md`. Cost about 1,200 credits.
