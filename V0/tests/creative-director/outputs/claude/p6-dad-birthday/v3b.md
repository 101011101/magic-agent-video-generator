# Sixty: Operational Chunks

**Blocking input:** the request says "with him in it", but no photo of Dad was uploaded. Production cannot start until the user uploads at least one clear, recent, front-facing photo of Dad. Older photos are optional, for the memory moments in Chunk 3. Without these, any "Dad" would be an invented stranger. All chunks below assume these photos are provided.

---

**Chunk 1: The surprise setup**
- **Duration:** 3 s (0–3 s)
- **Visual:** Warm Saturday morning. Backyard patio with paper lanterns and a hand-painted banner reading "Happy 60th, Dad!". Long table with mismatched plates, a jug of lemonade, and a cake in the center with a big piped "60" on top.
- **On-screen text:** banner, exact text: `Happy 60th, Dad!` (or Dad's name or nickname instead of "Dad" if the user gives one). Add as a composited or overlaid element so the spelling is exact. Cake: `60`.
- **Audio:** Upbeat, gently nostalgic music starts: acoustic guitar with a little swing.
- **Entities:**
  - *Banner*: hand-painted, same text and look in any later shot.
  - *Cake*: piped "60" and candles. Same cake in Chunk 4.
  - *Table*: mismatched plates, lemonade jug.
- **Environment:** Backyard patio, morning. Warm sunlight. Palette: warm yellows, soft pastels from the lanterns.
- **Depends on:** None
- **Source:** "A warm Saturday morning. Sunlight spills across a backyard patio strung with paper lanterns and a hand-painted banner that reads Happy 60th, Dad! A long table is set with mismatched plates, a jug of lemonade, and a cake in the center, its frosting piped with a big candle-shaped 60. Upbeat, gently nostalgic music plays — something with acoustic guitar and a little swing."

**Chunk 2: Dad walks out**
- **Duration:** 3 s (3–6 s)
- **Visual:** Dad steps out through the back door holding a coffee mug. He stops, his eyebrows go up, and he laughs in surprise. He shakes his head the way dads do when they are pretending not to be moved.
- **On-screen text:** None
- **Audio:** Music continues. Natural laugh (optional, no spoken lines needed).
- **Entities:**
  - *Dad*: identity locked to the uploaded photo(s). Age 60. Same face, hair and build in every present-day chunk. Outfit chosen here (e.g. casual shirt) stays the same in Chunks 2, 4 and 5.
  - *Coffee mug*: same mug in Chunk 5.
- **Environment:** Same patio and morning light as Chunk 1.
- **Depends on:** Chunk 1 (same patio set). Uploaded photo of Dad.
- **Source:** "Dad walks out through the back door, still holding his coffee mug. He stops. His eyebrows go up. A surprised laugh breaks out of him, and he shakes his head the way dads do when they are pretending not to be moved."

**Chunk 3: Memories**
- **Duration:** 6 s (6–12 s), three memory beats of ~2 s each
- **Visual:** Memories drift in like old photographs coming to life. Each glows for a beat, then softens back into the present:
  1. Younger Dad with darker hair holds a baby in a hospital blanket.
  2. Dad runs behind a kid on a bike down a quiet street, one hand on the seat.
  3. Dad at the grill on a summer evening, waving a spatula like a conductor's baton.
- **On-screen text:** None
- **Audio:** Music continues, slightly softer and more nostalgic.
- **Entities:** Younger Dad (must be recognizably the same man as present-day Dad). Use the user's older photos if uploaded. Otherwise, de-age from the recent photo. Baby, kid on bike, grill and spatula.
- **Environment:** Hospital room, quiet street, summer-evening backyard. Vintage photo look: warm grade, soft edges, light film grain, photo-print borders or glow.
- **Depends on:** Chunk 2 (transition out of and back into the patio). Dad's identity from the uploaded photo(s).
- **Source:** "Memories drift in around him like old photographs coming to life: Dad younger, with darker hair, holding a baby in a hospital blanket; Dad teaching a kid to ride a bike down a quiet street, running behind with one hand on the seat; Dad at the grill on a summer evening, waving a spatula like a conductor's baton. Each moment glows for a beat and then softens back into the present."

**Chunk 4: Blowing out the candles**
- **Duration:** 4 s (12–16 s)
- **Visual:** Back on the patio. Dad leans over the cake, the candles flicker, he puffs his cheeks and blows them all out in one go. Smoke curls up and he grins. Confetti bursts into the air and drifts down around his shoulders.
- **On-screen text:** None (the "60" on the cake stays visible).
- **Audio:** Music lifts. Blow, small cheer or confetti pop.
- **Entities:** Dad (as in Chunk 2). Cake (as in Chunk 1). Confetti.
- **Environment:** Same patio and morning light.
- **Depends on:** Chunk 1 (same cake and table). Chunk 2 (same Dad, same outfit).
- **Source:** "Back on the patio, Dad leans over the cake. The candles flicker. He takes a big breath, cheeks puffed, and blows them all out in one go. Smoke curls upward and he grins, proud of himself. Confetti bursts into the air and drifts down around his shoulders."

**Chunk 5: Toast and final card**
- **Duration:** 4 s (16–20 s)
- **Visual:** Dad raises his mug like a toast, looks straight into the camera, and smiles, a little teary and very happy. Final words appear over the warm sunlight and hold to the end.
- **On-screen text (exact):** `Happy 60th Birthday, Dad!` (or with his name or nickname if given). Add as an editor text overlay, not generated in the image.
- **Audio:** Music resolves and ends at 20 s.
- **Entities:** Dad (as in Chunk 2). Coffee mug (as in Chunk 2). Confetti remnants on his shoulders.
- **Environment:** Same patio, warm sunlight.
- **Depends on:** Chunk 4 end frame (continuous moment, confetti still on his shoulders). Chunk 2 (same mug).
- **Source:** "He raises his mug like a toast, looks right at us, and smiles — a little teary, very happy. The final words appear across the warm sunlight: Happy 60th Birthday, Dad! The video ends at twenty seconds."

---

## Global requirements

- **Total duration:** exactly 20 seconds.
- **Dad must be in it:** Dad must be the real person from the user's photos, recognizable in every chunk he appears in (Chunks 2–5), including the younger version in the memories. **Request photos before production.**
- **Occasion facts:** birthday video for Dad turning **60**, on **Saturday**. All "60" text must be correct.
- **Exact text:** banner `Happy 60th, Dad!`. Final card `Happy 60th Birthday, Dad!`. Add all text as overlays and check the spelling before delivery. Swap "Dad" for his name only if the user asks.
- **Delivery timing:** the video must be finished and delivered before Saturday.
- **Aspect ratio:** not specified. Ask the user, or default to 16:9. Offer 9:16 for phone sharing (WhatsApp, Instagram Stories).
- **Music:** one continuous upbeat, gently nostalgic track (acoustic guitar, a little swing) across all 20 s. No narration or dialogue.
- **Style:** warm, sunny, heartfelt, realistic. Memory beats use a vintage photograph look, then return to the warm present.
- **Optional inputs to ask for:** Dad's name or nickname, older photos for the memories, and any real family details (kids' names, his hobbies) to make the memory beats personal.
