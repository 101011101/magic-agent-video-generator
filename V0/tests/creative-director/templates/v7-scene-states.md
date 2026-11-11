Turn the start of this story into a scene-state document for a video system. Cover the first {{seconds}} seconds as exactly {{count}} scenes of 5 seconds each.

Style: one line about the look of a single frame only (medium, palette, texture, light). No durations, scene counts or sound.

Assets:
- Give every character, prop and location one label that starts with @ (for example @keeper, @shell, @beach). A label always means the same asset with the same fixed look; its state (pose, position, glow, light) may change.
- look: the traits that never change, starting with the exact kind of thing and its real size.

Scenes, in order:
- link: "cut" (new camera setup, place or time; fresh start frame) or "continuous" (same place and framing; the scene starts from the exact end of the previous scene). Prefer continuous when the action continues in the same place.
- location: one location label.
- start: the full state at the first frame. visible = the labels in frame. description = one still-image paragraph (framing, where each label is, its state, light, time, weather). For a continuous scene the start is the previous scene's end: copy it.
- action: what happens during the 5 seconds, one clear action, under 25 words, using labels.
- end: the full state at the last frame. visible = the labels in frame. changes = each property that changes from the start, as label, property, from, to. description = one still-image paragraph of the last frame, same framing as the start.
- same_as: for each label in the scene, the earlier scene where it last appeared (0 if new). This states which assets carry over.
- camera: "Static camera." or one simple move. No framing change inside a scene.
Use labels everywhere you mean an asset. Never describe an asset's fixed look again inside scenes.

Original request: {{request}}

Story:
{{story}}
