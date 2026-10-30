# T-022 · Does the keyframe CONTEXT keep the shot's action text?

status:     open (a decision for the user)
priority:   medium
subsystem:  keyframes

what:
Decide between (a) the current CONTEXT block, which names the shot's action labelled "during the shot, after this frame:
… none of that has happened yet" or "before this frame: … all of that is complete", and (b) CONTEXT without the action
text (scene heading, first or last frame of shot n, moment, tone only), as the 2026-10-30 decision "never the action
paragraph" reads. Measure on the painted V2 stills: does any first frame show its shot's action already happening? Then
keep one form.

why:
The old-ideas review (`V2/drafts/review-old-ideas.md`) found the labelled action text contradicts the written rule and
measured the leak (events painted early) as a real risk in the `cleaned/` runs; the labelled form was added so the painter
knows what the frame leads into. Both have a case; the rule and the code must say the same thing.

acceptance:
One form in the template and in `05-keyframes.md`; a test asserts it; the decision logged in `10-decisions.md`.
