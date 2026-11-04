# Free text-to-image: generic prompt vs hyper-descriptive prompt (the MCP, `V3/runs/reftest-4`, 65 credits, 2026-11-02)

Question from `02-one-reference-rule.md`: is a free text-to-image result good enough to be a "clean" first reference?
Five real sources from Commons (a perfume bottle, a WPA park poster, Yosemite Tunnel View, a Ferrari on a Hong Kong
street at night, a café interior), each asked for twice with no picture attached: a short generic prompt, and a
150–220-word VLM description of the source. The MCP chose the model each time. A VLM scored each result against the
source (0–100 usable as a stand-in), and we looked.

| Subject | Generic: model, score | Described: model, score | What the described one got |
|---|---|---|---|
| luxury (perfume) | flux-2-klein, 28 | qwen-image-2.1, **73** | the torso bottle, frosted pink, "TIREZ / PULL" tag legible; the loop oversized |
| poster (WPA) | flux-schnell, 32 | qwen-image-2.1, **65** | flat screen-print style, every line of lettering correct, the bison seal; palette and composition shifted |
| park (Yosemite) | flux-schnell, 47 | z-image-turbo, **78** | El Capitan glowing, Half Dome, mist in the valley; textures soft |
| night cars | flux-schnell, 16 | qwen-image-2.1, **64** | white convertible, red roof, "OPPA" plate, yellow building, sedan behind; bumper warped |
| café | flux-2-klein, 26 | flux-schnell, 48 | counter, pendants, stools; the barista's face and the equipment smeared |

Readings:
1. **The description is worth 30–50 points every time.** Generic prompts give a plausible stock image of the type;
   the description gives the source's composition, palette, props and even its lettering.
2. **qwen-image-2.1 is the model when words matter.** It rendered "TIREZ / PULL", "OPPA" and the whole poster
   caption correctly; flux-schnell garbled plates and signs.
3. **Quality ceiling: 640px, soft textures, occasional warped parts** (bumper openings, a loop, a smeared barista).
   Good enough for a start frame of a place or a product; not good enough where a face or fine mechanical detail is
   the point.

Rule from this: a free text-to-image result counts as a clean first reference when (a) the prompt is a full
description, not a line; (b) the model is qwen-image-2.1 if any lettering is involved; (c) the subject is a place,
a product or a designed graphic, not a specific face. Costs 5–10 credits a try, so make two and pick by VLM.

**Noted as a method: VLM-to-image is fine.** Read the source with a VLM into a full description, generate from the
description with no picture attached. That is the clean path for places, products and graphics. People are tested
separately in `V3/runs/reftest-5`.

## People: name only vs unnamed hyper-description (`V3/runs/reftest-5`, 60 credits)

Five public-domain portraits (Vanderbilt, Twain, Lincoln, Einstein, Curie). Arm 1: "a photorealistic colour portrait
of <name>". Arm 2: a 1,400-character description of the face with no name. No picture attached either way. The MCP
picked z-image-turbo for eight of ten and qwen-image-2.1 for two. VLM score against the real portrait:

| Person | Named | Described | By eye |
|---|---|---|---|
| Vanderbilt | 55 | 56 | both a generic 1850s gentleman with sideburns |
| Twain | 59 | **67** | described: white mane, moustache, cream suit, bow tie; the type exactly, the face not his |
| Lincoln | **73** | 53 | named: a plausible Lincoln (beard, bow tie, gaunt face); described: a different bearded man |
| Einstein | **74** | 60 | named: unmistakably Einstein; described: an old man with wild white hair |
| Curie | 52 | 57 | both a generic older woman in dark clothes |

Readings:
1. **A name works only for faces the model has memorised** (Einstein, Lincoln), and then it works well. For anyone
   less photographed (Vanderbilt, Curie here) the name gives a type.
2. **A description never rebuilds a specific face.** It reliably rebuilds the TYPE: age, hair, facial hair, clothing,
   era, expression, pose and light, often strikingly (Twain's silhouette). The face itself is a new person every time.
3. So for people the clean-reference path is: a real photograph when the person must be that person; a described
   invented character when a consistent type is enough (and the description is then reused verbatim in every clip,
   which is what held the MCP's three-clip student film together). Descriptions do not substitute for a photo of a
   specific face, and names only do for the very famous.
