# Sixty — Operational Chunks

**Required before production:** the request says the video must have Dad in it, but no photos were uploaded. Dad's identity is locked to the uploaded reference photos. Please upload at least one clear, recent, front-facing photo of him, plus any older photos for the memory moments. His name or nickname is optional (otherwise the text says "Dad").

## Baseline (first frame)

- **Character — Dad** (locked): appearance taken only from the uploaded reference photos (face, build, hair). Turning 60. Holding a coffee mug. Same face in every present-day shot; younger versions in the memories must be recognizably the same man (darker hair).
- **Environment:** backyard patio strung with paper lanterns; hand-painted banner reading **Happy 60th, Dad!**; long table with mismatched plates, a jug of lemonade, and a cake in the center with a big candle-shaped **60** piped in frosting; lit candles on the cake; back door of the house.
- **Time of day:** Saturday morning.
- **Lighting:** warm morning sunlight spilling across the patio.
- **Palette:** warm sunny yellows, soft pastels from the lanterns and plates.
- **Style:** warm, cinematic, realistic; gently nostalgic.
- **Audio:** upbeat, gently nostalgic music — acoustic guitar with a little swing.
- **On-screen text:** banner text is part of the scene (**Happy 60th, Dad!**), spelled exactly.
- **Aspect ratio:** not specified in the request — default 16:9 (9:16 for phone sharing if preferred).
- **Total duration:** exactly 20 seconds.

## Chunks

**Chunk 1 — The surprise**
- Quote: "A warm Saturday morning. Sunlight spills across a backyard patio strung with paper lanterns and a hand-painted banner that reads **Happy 60th, Dad!** A long table is set with mismatched plates, a jug of lemonade, and a cake in the center, its frosting piped with a big candle-shaped **60**. Upbeat, gently nostalgic music plays — something with acoustic guitar and a little swing. Dad walks out through the back door, still holding his coffee mug. He stops. His eyebrows go up. A surprised laugh breaks out of him, and he shakes his head the way dads do when they are pretending not to be moved."
- Signpost: implicit (opening)
- Changes:
  - Dad: absent → walks out through the back door with his mug → stops
  - Dad's expression: neutral → eyebrows up → surprised laugh → shaking his head, pretending not to be moved
- Type: continuous (one shot, or establishing patio shot then cut to Dad at the door)
- Duration: ~5 s
- On-screen text and audio: music starts; banner text **Happy 60th, Dad!** visible in scene.
- Depends on: none

**Chunk 2 — Memories**
- Quote: "Memories drift in around him like old photographs coming to life: Dad younger, with darker hair, holding a baby in a hospital blanket; Dad teaching a kid to ride a bike down a quiet street, running behind with one hand on the seat; Dad at the grill on a summer evening, waving a spatula like a conductor's baton. Each moment glows for a beat and then softens back into the present."
- Signpost: implicit ("Memories drift in")
- Changes:
  - scene: present-day patio → three memory vignettes, each glowing in like an old photograph coming to life, then softening back to the present:
    1. Dad: 60 → younger, darker hair; holding a baby in a hospital blanket
    2. Dad: younger → teaching a kid to ride a bike down a quiet street, running behind with one hand on the seat
    3. Dad: at the grill on a summer evening, waving a spatula like a conductor's baton
  - look: present-day color → warm, slightly faded, photo-like glow
  - (If older photos are uploaded, build each vignette from them.)
- Type: cut (three quick memory transitions)
- Duration: ~6 s (~2 s each)
- Depends on: Chunk 1 (returns to Chunk 1's end state after each memory)

**Chunk 3 — Blowing out the candles**
- Quote: "Back on the patio, Dad leans over the cake. The candles flicker. He takes a big breath, cheeks puffed, and blows them all out in one go. Smoke curls upward and he grins, proud of himself. Confetti bursts into the air and drifts down around his shoulders."
- Signpost: "Back on the patio"
- Changes:
  - scene: memories → present-day patio
  - Dad: standing at the door → leaning over the cake, cheeks puffed → blowing → grinning, proud
  - candles: lit, flickering → blown out, smoke curling upward
  - confetti: none → bursting into the air → drifting down around his shoulders
- Type: cut
- Duration: ~4 s
- Depends on: Chunk 1

**Chunk 4 — The toast**
- Quote: "He raises his mug like a toast, looks right at us, and smiles — a little teary, very happy."
- Signpost: implicit
- Changes:
  - Dad's mug: at his side → raised like a toast
  - Dad's gaze: at the cake → straight into the camera
  - Dad's expression: proud grin → a little teary, very happy smile
- Type: continuous
- Duration: ~2 s
- Depends on: Chunk 3

**Chunk 5 — Final words**
- Quote: "The final words appear across the warm sunlight: **Happy 60th Birthday, Dad!** The video ends at twenty seconds."
- Signpost: implicit ("The final words appear")
- Changes:
  - on-screen title: absent → present across the warm sunlight
- Type: continuous (text over the end of Chunk 4's shot)
- Duration: ~3 s (17 s → 20 s)
- On-screen text and audio:
  - Text starts, spelled exactly: **Happy 60th Birthday, Dad!** (use his name or nickname instead of "Dad" only if the user provides one). Render as a text overlay.
  - Music resolves and ends at exactly 20 s.
- Depends on: Chunk 4

Total: 20 seconds.
