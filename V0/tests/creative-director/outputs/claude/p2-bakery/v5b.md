# Sweet Crumbs — Operational Chunks

## Baseline (first frame)

- **Characters:**
  - Baker: woman in a cream apron, hands floured. Same face, hair and apron in every shot she appears in.
  - (Introduced later: woman customer with a scarf; father and young daughter. Each keeps the same look once introduced.)
- **Location:** inside the Sweet Crumbs bakery. Flour-dusted wooden counter, a single row of warm pendant lights above it, ovens behind, front windows dark.
- **Objects:** soft round of dough on the counter, flour in the air.
- **Time of day:** just before 7am, still dark outside.
- **Lighting:** warm pendant light only; pools of amber light over the counter, dark windows.
- **Palette:** warm ambers, creams, browns, wood tones.
- **Style:** live-action, cinematic food commercial; shallow depth of field, close-ups on texture.
- **Audio:** low hum of the ovens; soft, warm music bed starts under it.
- **On-screen text:** none.
- **Aspect ratio:** not specified in the request — default 16:9 (deliver 9:16 / 1:1 crops if needed for social).
- **Total duration:** exactly 20 seconds.

## Chunks

**Chunk 1 — Kneading before dawn**
- Quote: "It is still dark outside, just before seven. Inside Sweet Crumbs, a single row of warm pendant lights glows over a flour-dusted wooden counter. The ovens hum. A baker in a cream apron presses her palms into a soft round of dough, folding it over itself with practiced, easy movements. Flour lifts into the air and hangs in the light like fine snow."
- Signpost: implicit (opening)
- Changes:
  - dough: round → pressed and folded over itself
  - flour: on counter → lifted, hanging in the light like fine snow
- Type: continuous
- Duration: ~3.5 s
- On-screen text and audio: oven hum and music bed start.
- Depends on: none

**Chunk 2 — Out of the oven**
- Quote: "An oven door swings open and a wave of heat rolls out. Inside, a tray of croissants has turned deep golden, their layers puffed and crackling. Beside them, a loaf of sourdough splits along its scored top, the crust blistered and dark at the edges. The baker slides the tray out and sets it on the cooling rack. Steam rises from everything."
- Signpost: implicit
- Changes:
  - framing: counter → oven
  - oven door: closed → open, heat shimmer rolling out
  - croissants: (newly seen) deep golden, puffed, crackling layers
  - sourdough: scored → split along the score, blistered dark crust
  - tray: in oven → on cooling rack
  - steam: none → rising from everything
- Type: cut
- Duration: ~3.5 s
- On-screen text and audio: oven door opening sound, crackle of crust.
- Depends on: Chunk 1

**Chunk 3 — Morning, the first customer**
- Quote: "Morning arrives. Pale blue light fills the front windows. The display case is now full: glossy fruit tarts, cinnamon rolls swirled with white icing, rows of cookies with crisp edges, a tall chocolate cake with a single slice already missing. The bell above the door rings. A woman steps in from the street, pulls off her scarf, and breathes in. Her shoulders drop. She smiles before she has even reached the counter."
- Signpost: "Morning arrives"
- Changes:
  - time of day: before 7am, dark → morning
  - front windows: dark → filled with pale blue light
  - lighting: pendant only → pendant + cool blue daylight from windows
  - framing: oven → front of shop / display case
  - display case: (newly seen) full — glossy fruit tarts, cinnamon rolls with white icing, crisp-edged cookies, tall chocolate cake with one slice missing
  - door: closed → opened, bell rings
  - customer woman: absent → steps in, scarf on → scarf off, tense → shoulders drop, neutral → smiling
- Type: cut
- Duration: ~4.5 s
- On-screen text and audio: door bell rings; music lifts slightly.
- Depends on: Chunk 2

**Chunk 4 — Father and daughter**
- Quote: "At a small table by the window, a father and his young daughter share a cinnamon roll. The girl tears off the soft center, and a thin ribbon of icing stretches between her fingers. She laughs. Her father brushes a crumb from her cheek. Outside, the street is waking up, but in here everything feels slow and warm."
- Signpost: implicit
- Changes:
  - framing: display case → small table by the window
  - father and daughter: absent → seated, sharing a cinnamon roll
  - cinnamon roll: whole → center torn out, icing stretching between her fingers
  - daughter: neutral → laughing
  - crumb on her cheek: present → brushed away by father
  - street outside: empty → waking up (soft background activity)
- Type: cut
- Duration: ~4.5 s
- On-screen text and audio: girl's laugh.
- Depends on: Chunk 3 (same morning light and interior)

**Chunk 5 — End card**
- Quote: "The light settles. The bakery's warm tones soften behind a clean end card. The text appears, crisp and centered, spelled exactly: **Sweet Crumbs — Open 7am–3pm, 12 Elm St** The card holds for the final seconds, and the ad ends at twenty seconds."
- Signpost: "The light settles"
- Changes:
  - background: sharp bakery interior → softened/blurred warm tones
  - end card: absent → present, clean, text centered
- Type: continuous (soft transition from Chunk 4's interior into the card)
- Duration: ~4 s (16 s → 20 s)
- On-screen text and audio:
  - Text starts, crisp and centered, spelled exactly character for character: **Sweet Crumbs — Open 7am–3pm, 12 Elm St** (em dash after "Crumbs", en dash in "7am–3pm", no period at the end). Render as a text overlay, not generated inside the image, so no letter is misspelled.
  - Text holds unchanged until the end.
  - Music resolves and ends at exactly 20 s.
- Depends on: Chunk 4

Total: ~20 seconds.
