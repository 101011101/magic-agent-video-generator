# T-004 · v3 screenplay fields

status:     open (built 2026-10-30: the film's kind from the story with pacing by kind; pace per shot; film-level music with an arc; the still-camera check)
priority:   medium
subsystem:  screenplay, state, keyframes, edit

what:
Extend the shooting-script schema as sketched in `../drafts/CASES.md` §D: a FILM header with kind, medium, aspect
(16:9, 9:16, 1:1), cutting rule (content, beat, step, jump) and hook; elements of kind screen, item, track; an optional
scene time; a line that may be a subject and the camera, or none; per shot a kind (live, to-camera, insert, screen,
broll), camera_first and camera_last with a motion kind and path, lens, held_by, vo beats, overlays by kind with an
anchor, an insert's item and move, structured changes. Add the matching checks (static shots keep their camera; overlays
inside safe margins on 9:16; a hook in shot 1 when asked) and the renderer per shot kind.

why:
The v2 schema has one camera per shot and no motion, which fits a locked-off dialogue scene and nothing that moves: a
vlog, a walk-and-talk, a push-in in an ad, a Ken Burns move over an archival still. The cases table shows the media types
differ in format, camera behaviour, shot kinds, on-screen text and audio layers, not in pipeline.

acceptance:
A walk-and-talk story through two places runs end to end with an `advance` keyframe (the camera moved within the shot)
and a clip that moves the camera; a 15-second vertical to-camera ad renders with subtitles inside safe margins and a hook
in the first 3 seconds. Costs stated per test before it runs.
