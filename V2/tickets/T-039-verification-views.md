# T-039 · Verification views in the chat: story, screenplay blocks with comments, keyframe slideshow with flags

status:     dry prototype 2026-10-31 (the three views over an existing run folder, comments and flags saved to the session); wiring a flag to a retry is design
priority:   high
subsystem:  frontend, agent, results

what:
Three renderings the agent sends into the chat when it asks "does this look right?" or the user asks to see them
(`12-frontend.md`):

1. **Story**: title, style line, the prose by paragraph; in nonfiction each paragraph with its fact numbers and
   sources. One action: a comment on a paragraph.
2. **Screenplay**: one block per scene (n, place, time, synopsis, tone, line), the shots as rows (seconds, size,
   moment, the lines, the captions); a comment box on every block and row. A comment is a message to the agent tied
   to the scene or shot (`{scene, shot, text}` in the session), and the next plan starts from it: a revised
   screenplay for that scene, with the changed rows marked.
3. **Keyframes**: a slideshow, one still per slide with scene, shot, size, the gate's verdict and finding, the
   attempts as thumbnails (click to compare), and under it the images it was sent and the prompt; arrows and keys
   to move; a "looks wrong" button with a note, which is a message tied to the still (`{still, text}`); the agent
   answers with a retry card for that still and what hangs from it.
4. **Clips and the film**: the same slideshow with the video and the transcription.
5. **The sheet view**: the universal questions as a table with how each was filled; editable; an edit is a message.

why:
The user's design of 2026-10-31: verification put into nicer formatting, keyframes as a slideshow in chat, the story
and the screenplay formatted, scene blocks the user can click and comment on, keyframes the user can click when they
look wrong.

acceptance:
The three views render for `topgun9` from its run folder; a comment on scene 7 and a flag on `s7-2` land in the
session with their ids; then, to build, the flag produces a retry card for `s7-2` and the stills built from it, and
the comment produces a screenplay revision card for scene 7 only.
