# The operational prompt (text-to-video)

The Magic Hour guide says: specify the subject, one action, camera move, framing and mood; request only audio and
duration the model supports; then review the actual result. The prompt that works is ONE prose paragraph, under 2,000
characters, in this order:

1. FORMAT: the duration, the kind of piece, the subject, the aspect, in one sentence.
   "Create a 16-second cinematic advertisement for Petal & Stem, a small neighbourhood flower shop. Widescreen 16:9."
2. LOOK: medium, light, mood, the texture of the world, in one sentence. For action, the look line also carries the
   ENERGY in plain words ("tight, fast-paced editing, roaring engines, cars accelerating hard, streetlights streaking
   past"): the model renders the pace it is told, and a race described calmly comes out slow.
   "Photorealistic, intimate, warm natural dawn sunlight, soft golden highlights, authentic lived-in neighbourhood."
3. CONTINUITY: how many shots, and what stays the same across them, in one sentence.
   "Four coherent shots with natural edits, same florist, shop and bouquet throughout."
4. BEATS: timed ranges that together cover the whole duration, in order. Each beat, in this order: the time range,
   the framing, the subject with one identifying detail, ONE action, one environment detail, the camera or lens.
   "0–4 seconds: exterior medium-wide shot at dawn, an adult florist in a sage-green apron unlocks and opens the
   wood-and-glass shop door, warm sunlight on the flower buckets beside the entrance."
   One action per beat. Never two things happening. Never a thing that must appear later mentioned early.
   The request's own verbs are the beats' actions and each gets its own beat: "arranges a bouquet" is a beat of hands
   placing stems, and wrapping is a different action; do not merge two of the request's actions into one beat.
   When possession changes, the beat ends with the new state stated plainly: "the customer now holds the bouquet, the
   florist's hands are empty".
   The last beat is a separate establishing shot with no new action: the place alone, or the people standing still.
   Every beat has a camera MOVE (push, slow orbit, lateral slide, ease back, handheld follow), never "stationary" or
   "locked-off" except the final hold. Name the key object concretely once (blush pink roses, cream flowers, brown
   kraft paper), not "a bouquet"; the model renders nouns it is given.
   A beat is 3–6 seconds, so a 16-second clip has 3–5 beats and a 30-second clip 5–8. Two-second beats make a
   cut every two seconds, which the model renders as a jumble; the shot count in CONTINUITY equals the beat count.
5. EXACT WORDS: any lettering the video must show, quoted once, inside the beat where it is seen.
   "clear tasteful shop sign reads exactly 'Petal & Stem'."
6. SOUND (only when audio is on): ambient, or the character of music, or the spoken lines quoted with their time
   range and who speaks. Narration and dialogue are the expensive part of the budget; keep them short.
7. HOLD: the last beat ends on a still, readable image. "Hold on the storefront for the final two seconds."
8. GRADE: colour treatment and pacing, one short sentence. "Gentle cinematic colour grade, calm uplifting pacing."
9. NEGATIVES: one line, last, only what the model would otherwise add. "No voiceover, no subtitles, no text overlays."

Quality words are descriptive, never technical: cinematic, photorealistic, shallow depth of field, natural hands and
anatomically correct movement, realistic textures. No resolution words, no "8k", no seeds, no camera brands.

Never: shot-list headings, a separate negatives block, a constraint on every sentence, "do not show X" for things that
appear later, repeating a sentence, a sign mentioned in a beat where it must not be seen.

Budget: about 450 characters go to format, look, continuity, hold, grade and negatives. The rest is beats, about 200
characters each. Compress the story into the beats; do not paste it.

# Image-to-video (a start frame is supplied)

Same slots, same order, two changes:
- FORMAT shrinks to the duration and "matching the source image" (the aspect is the image's).
- LOOK becomes PRESERVE: name what the image already fixes and must stay: "Preserve the woman's face, dark hair in a
  low bun and cream jacket, and the bouquet of yellow, magenta, cream and red flowers in pale paper, exactly as in the
  image; keep the morning light and the doorway."
- The first beat describes the image as it is and the first motion out of it, so the model continues the picture
  instead of cutting away. Later beats may cut, with the continuity sentence naming the same people and the bouquet by
  the same words every time.

# When people carry the scene (a handoff, a conversation, a reunion)

The MCP's scene 2 clip read as more alive than ours with the same still route. The differences were in the prompt:
- ONE continuous shot with a very slow push in, not five cuts in 16 seconds. On image-to-video every cut abandons the
  start frame; one shot keeps the faces and lets a performance develop.
- Performance verbs and eye lines in every beat: "exchanging warm eye contact", "he smiles warmly and reaches out with
  both hands", "they exchange affectionate smiles", "she steps close beside him". Behaviour, not inventory.
- A physically ordered action: "only after he has a firm grip does she release it".
- PRESERVE is three anchors per person (hair, one garment, one detail) and one line for the object, said once. The
  identity is in the start frame; a 600-character inventory repeated in every beat buys nothing and starves the beats.
- End on the faces: "a stable medium two-shot showing both faces and the bouquet, hold three seconds", not a wide
  establishing shot of people standing still.
- Framing: the seed still should be a medium shot where faces are large enough to act; a medium-wide doorway reads
  as staging.

# A sequence inside a film (case 2)

- Say the PLACE first and relationally: "inside the Resolute's bridge: narrow steel interior, slanted front windows
  overlooking a cold grey ocean". Never list the ship's exterior or the sea as things to preserve in an interior clip;
  the model will build them. Only the bible entries that appear in this clip go in.
- People from a start frame get their positions: "Vale at left, the lookout in the centre, the helmsman at right".
- A distant thing gets its scale and where it is seen: "a tiny silhouette on the horizon through the windows".
- Lines are short and distinct, one per beat ("Enemy cruiser on the horizon!" … "Fire!"), never one line for the
  whole clip; with audio on, a single quoted line is repeated by the model.
- The last sentence states the clip's place in the film: "clip 1 of 3: end on the order; no guns firing, that is the
  next clip".
