# T-011 · KF1 removed from the pipeline

status:     open
priority:   low
subsystem:  keyframes

what:
V2 carries one keyframe template (`src/keyframes/template.js`, the PRD-aligned form). KF1 (references, task, changes,
context, camera, people, rules) and KF2 (create this frame, context, from these references, rules) stay in `cleaned/src/kf/`
as archived code; the `--kf` variant switch, the per-variant run folders and the comparison page are not ported.

why:
On the one shot where both were painted (vanderbilt6 shot 1) there was no visible difference; both had the same two
faults, restating the whole world every time and ignoring what image 1 carried. Keeping two variants doubles every cost
from here. The user kept KF2's order and dropped KF1 on 2026-10-30.

acceptance:
No `kf1` or `kf2` identifiers in `V2/src`; one template; the PRD §5 describes it.
