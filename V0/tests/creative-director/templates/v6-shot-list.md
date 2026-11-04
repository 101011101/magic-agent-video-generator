Turn this story and its operational chunks into a shot list for an image-to-video model. Each shot is one clip made from one start frame. The model gets no end frame: it shows only the motion you describe, starting from the start frame.

Bible:
- List every character, every prop that matters to the story, and every location, each with one short name and one fixed look: the traits that never change (face, age, hair, clothing; shape, colour, material; architecture, landscape). Do not put pose, action, time of day or weather in a look.
- Give one style line for the whole video (medium, palette, texture). It is added to every image.

Shots:
- One clear action per shot. A shot is 5 or 10 seconds; use 10 only for one slow action that needs it.
- link "cut": a new camera setup, a new framing, a new place or a new time. The shot gets a fresh start frame.
- link "continuous": the same place and the same framing; the action continues directly from the last frame of the previous shot. The shot starts from that real last frame.
- A change of framing is always a cut. A camera move inside a shot is allowed only if it is one simple move (slow push in, slow pan, slow tilt).
- Prefer continuous. When the next action happens in the same place with the same people and can be seen in the current framing, make it continuous, even if the chunk says cut or asks for a new framing. Use a cut only for a new place, a new time, or an action that cannot be seen in the current framing (for example a close-up detail).
- A scene is one cut shot plus the continuous shots that follow it. A scene has at most 3 shots, because the look drifts along long chains.
- start_frame (cut shots only, else ""): a still-image description of the first frame. Framing, who and what is visible and where they are, the location, time of day, light and weather. Present tense. Only things visible in the frame. Use bible names for characters, props and locations.
- action: under 25 words, present tense: who does what during the shot. Name only things visible in the shot. Do not describe looks (the start frame shows them).
- camera: one short sentence, for example "Static camera." or "Slow push in."
- visible: the bible names (characters and props) visible in the first frame of the shot. location: the bible name of the location.
- chunks: the chunk numbers this shot covers. Cover every chunk, in order. You may split or merge chunks.
- Leave out audio and score.
- Uploads: an uploaded image is a real file named u1, u2, … in the order listed. A bible entry that an upload shows gets upload = its name (else null); a fictional entry gets null. A shot whose first frame is the uploaded image itself (for example "animate this photo") gets start_upload = its name; then the shot is a cut and start_frame describes the upload. Else start_upload = null.
- On-screen text (titles, end cards, captions) is never drawn inside a shot. Put each text in layers: the exact wording (copy any text the user specified character for character), start and end in seconds of the final video, and position (center, lower third or top). A shot under an end card shows a calm background with empty space for the text.

The original user request was: {{request}}
Uploads: {{uploads}}

Story:
{{story}}

Operational chunks:
{{chunks}}
