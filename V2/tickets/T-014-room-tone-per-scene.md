# T-014 · Room tone once per scene, under every clip of it

- status: open · priority: medium · subsystem: sound, edit
- what: generate the scene's ambience once (from scene.ambience) and lay it under all its clips at the stitch, replacing or ducking each clip's own ambience; keep in-clip effects tied to beats (footsteps).
- why: each clip generates its own room tone, so every cut has an audible seam.
- acceptance: one ambience track per scene in runs/<label>/sound/; the stitched film has no level or texture jump at a cut within a scene.
