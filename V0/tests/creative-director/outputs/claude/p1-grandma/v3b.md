# Grandma's Wave: Operational Chunks

The story is one continuous 5-second moment from a single photo. I split it into three chunks so each action beat can be checked on its own. In production they should be generated as **one continuous image-to-video clip** from the uploaded photo, so there are no cuts. Each chunk's end frame is the next chunk's start frame.

---

**Chunk 1: Still moment**
- **Duration:** ~1.0 s (0.0–1.0 s)
- **Visual:** The uploaded photo comes to life. Grandma sits in the armchair, looking at the camera with her neutral expression from the photo. Barely-there motion: dust drifting in the sunbeam, a soft breath, a natural blink at most. Framing and camera position match the photo exactly. The camera is static.
- **On-screen text:** None
- **Audio:** Quiet room tone. No narration, no dialogue. No music (none requested).
- **Entities:**
  - *Grandma* (identity locked to the uploaded photo): elderly woman, short white hair, round glasses, green cardigan buttoned to the middle with slightly fuzzy cuffs. Same face, same features, same clothes, same body position in the chair.
  - *Armchair*: same chair, same position as in the photo.
- **Environment:** Sunlit living room, afternoon. Warm sunlight from the window falls in a stripe across the armchair. Visible drifting dust. Warm, golden palette, as in the photo.
- **Depends on:** None. The first frame **is** the uploaded photo.
- **Source:** "Afternoon sun pours through the living-room window and settles in a warm stripe across the armchair. Dust drifts slowly in the light. Grandma sits as she always does, deep in the cushions… Her green cardigan is buttoned to the middle, the wool slightly fuzzy at the cuffs." / "For a heartbeat she is still, looking straight ahead with that calm, neutral expression…"

**Chunk 2: The smile**
- **Duration:** ~1.5 s (1.0–2.5 s)
- **Visual:** Her eyes crinkle behind the glasses first. Then a slow, genuine smile spreads, her cheeks lift, and her whole face softens. Her hands stay on the chair arms. Her head stays in place. The camera stays static.
- **On-screen text:** None
- **Audio:** Room tone continues. Optional very soft ambient (no added music).
- **Entities:** Grandma, as in Chunk 1. The smile must look like **her** smile. Do not change face shape, teeth, glasses or hair. Reflections in the glasses stay consistent.
- **Environment:** Same as Chunk 1, with no change in light.
- **Depends on:** Chunk 1 end frame (continuous, no cut).
- **Source:** "Then something changes. The corners of her eyes crinkle first, behind the glasses, and the smile follows — slow and genuine, lifting her cheeks and softening her whole face."

**Chunk 3: The wave and hold**
- **Duration:** ~2.5 s (2.5–5.0 s)
- **Visual:** Still smiling, she lifts her right hand from the arm of the chair to about shoulder height, palm open. She waves 2–3 gentle side-to-side motions, unhurried. Her head tilts very slightly. The cardigan sleeve slides a little down her wrist. The wave settles, her hand pauses in the air, and she holds the smile through the last ~1 second. The camera stays static.
- **On-screen text:** None
- **Audio:** Room tone. Optional faint fabric rustle on the wave.
- **Entities:** Grandma, as in Chunks 1–2. Her right hand must have correct anatomy (five fingers, natural proportions). The cardigan sleeve stays green with the same texture.
- **Environment:** Same as Chunk 1. Only the dust and Grandma move.
- **Depends on:** Chunk 2 end frame (continuous, no cut).
- **Source:** "Her right hand rises from the arm of the chair. It lifts to about shoulder height, palm open, and she waves — two or three gentle side-to-side movements… Her head tilts very slightly as she does it. The cardigan sleeve slides a little down her wrist." / "She holds the smile as the wave settles, her hand pausing in the air for a final second… Nothing else moves except the drifting dust and the warmth in her face."

---

## Global requirements

- **Total duration:** about 5 seconds ("like 5 seconds"). Target 5.0 s.
- **Source and identity:** Animate **this photo**. The uploaded photo is the first frame and the identity reference. Grandma must look exactly like herself throughout: face, short white hair, round glasses, green cardigan, pose and armchair. No beautification, de-aging or restyling.
- **Required actions:** She **smiles** and she **waves**. Both must be clearly visible.
- **Aspect ratio:** Keep the uploaded photo's original aspect ratio and framing. Do not crop or extend.
- **Camera:** Static, locked to the photo's viewpoint. No cuts. One continuous shot.
- **Style:** Photorealistic. Match the photo's color, grain and lighting. Subtle, natural motion only. The background stays still except for drifting dust.
- **Audio:** No narration, dialogue or music was requested. Use quiet room tone only, or deliver silent.
- **Lighting and palette:** Warm, golden afternoon sunlight from the window, as in the photo. Constant across the clip.
