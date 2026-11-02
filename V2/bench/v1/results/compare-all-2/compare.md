# Agent vs the Magic Hour MCP · the films (direct generation, then the chain), then the 152 micro tasks on the latest loop, judged afresh

Micro tasks: the agent side is the newest record per item from the other session's runs (the loop with facts about every file, a pre-flight on paper, skills per tool, crop/compose/filter by code, lettering read back and fixed, one-face swaps, open questions asked); the MCP side is the mcp-1 run with its failed items re-graded by the current grader; every pair judged afresh. Films: direct generation (ours, one or two generations) and the keyframe chain, each against the MCP's single call.

162 items, the same prompt to both. Agent records from direct and agent and real-1 and real-2 and real-3 and real-4 and real-5 and real-6 and real-7 and real-8 and real-9 and real-10 and real-11 and real-12 and real-13 and real-14 and latest; MCP baseline from mcp-film-1 and mcp-film-2 and mcp-film-3 and mcp-film-4 and mcp-1 (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate). Joined from compare-film-direct (the films, direct generation, 6) and compare-film-1 (the films, the keyframe chain, 4) and compare-mcp-2 (the micro tasks, 152), in that order.

**Head to head: the agent wins 72, the MCP wins 74, 16 ties → win rate 49% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 97 (60%) | 66 (41%) |
| mean score | 75 | 62 |
| delivered a file | 148 | 137 |
| credits | 15083 | 15683 |
| minutes of item time | 94 | 161 |
| questions asked (for information) | 14 | 16 |
| asked the user to approve or proceed | 0 | 1 |
| calls refused by the free-plan gate | — | 3 |
| steps planned / tool calls | 374 | 691 |

| Part | Items | Agent wins | MCP wins | Ties | Win rate | Agent pass | MCP pass | Agent mean | MCP mean | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| The films, direct generation (compare-film-direct) | 6 | 2 | 4 | 0 | 33% | 0 | 1 | 43 | 50 | 4234 | 4224 |
| The films, the keyframe chain (compare-film-1) | 4 | 0 | 4 | 0 | 0% | 0 | 1 | 42 | 59 | 1719 | 1344 |
| The micro tasks (compare-mcp-2) | 152 | 70 | 66 | 16 | 51% | 97 | 64 | 78 | 63 | 9130 | 10115 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 4 | 0 | 1 | 42 | 59 | 0 | 4 | 0 | 0% | 1719 | 1344 |
| A. Single images | 24 | 24 | 20 | 98 | 89 | 8 | 16 | 0 | 33% | 190 | 290 |
| B. Image edits | 26 | 24 | 16 | 94 | 80 | 9 | 16 | 1 | 36% | 130 | 295 |
| C. Faces and characters | 12 | 10 | 8 | 86 | 88 | 1 | 7 | 4 | 13% | 1828 | 759 |
| D. Short video | 18 | 5 | 3 | 60 | 52 | 12 | 6 | 0 | 67% | 1918 | 2828 |
| E. Editing the user's video | 18 | 7 | 0 | 54 | 12 | 13 | 2 | 3 | 87% | 324 | 707 |
| F. Sound | 7 | 1 | 1 | 59 | 38 | 5 | 1 | 1 | 83% | 45 | 65 |
| G. Composed pieces | 16 | 9 | 3 | 75 | 53 | 9 | 7 | 0 | 56% | 840 | 875 |
| H. Ads and reels | 13 | 4 | 3 | 60 | 53 | 8 | 4 | 1 | 67% | 2684 | 3048 |
| J. Conversation | 18 | 13 | 10 | 83 | 72 | 5 | 7 | 6 | 42% | 1171 | 1248 |

## What the MCP side did

Models it chose: qwen-image-2.1 ×67, ltx-2.5 ×34, minimax-h3 ×17, flux-schnell ×10, flux-2-klein ×6.
Tools it called (steps): edit_image ×83, generate_image ×46, create_video_from_text ×40, create_video_from_image ×13, detect_faces ×8, add_subtitles_to_video ×6, generate_music ×6, edit_video ×3, remove_image_background ×2, swap_face_in_photo ×2, swap_face_in_video ×2, upscale_image ×1, create_meme ×1.

Calls the free-plan gate refused:
- 3× insufficient credits: this call needs about n credits and n remain of 

## Where the MCP won (74)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 100 pass (192 cr) · A offers a clear, simple widescreen soil cutaway with downward roots, an upward shoot, visible light, and no text. B includes conspicuous, malformed captions, d
- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (720 cr) · Both show consistent, live-action-looking hosts at microphones in warm, widescreen studios. B has a slightly stronger video-podcast presentation through headpho
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (240 cr) · Both show steaming coffee on wood and the exact closing words in widescreen. A better sustains the warm, quiet specialty-coffee mood with its rustic mug, golden
- **I93a** Night ride, a 60 s single take · agent 37 (1440 cr) vs MCP 39 (1440 cr) · A visibly delivers the bridge opening and a café-door arrival with the rider putting a foot down, while retaining a similar yellow jacket and bicycle. B has con
- **I46a** Meet the Real F-35A · agent 29 (287 cr) vs MCP 34 (192 cr) · B better conveys a conventional runway takeoff followed by flight, with more realistic aircraft proportions and broadly consistent views. A has two correct labe
- **I47a** Seed Growth With Supplied Narration · agent 37 (242 cr) vs MCP 100 pass (192 cr) · A is a much clearer simple animated explainer: the soil cutaway shows water at the seed, downward roots, and an upward shoot reaching toward visible sunlight. B
- **I90a** Two economists, a 30 s video podcast · agent 42 (775 cr) vs MCP 42 (720 cr) · B offers a cleaner, more convincing live-action podcast presentation, with consistent hosts, prominent microphones, and a cosy studio. A’s captions provide stro
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (415 cr) vs MCP 58 (240 cr) · A more convincingly delivers the warm dawn atmosphere, steaming handmade mug, wooden table, and restrained specialty-coffee aesthetic. Its final frame clearly d
- **A01b** Premium Candle Product Shot · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · A delivers a more convincing luxury retail image through amber glass, restrained branding, a gold lid, and coordinated warm lighting. Its candle remains dominan
- **A01c** Square White Background Sneaker · agent 100 pass (5 cr) vs MCP 100 pass (5 cr) · Both show exactly one complete white sneaker without props or graphics. A offers a more balanced composition and clearer stitching, laces, and sole texture, mak
- **A01d** Exact Brand Name on Label · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both show amber glass bottles with attached cream labels and correctly spelled, integrated VELORA lettering. A better fulfills the hand-soap request through its
- **A02a** Exact Headline for Coffee Post · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B delivers the exact, clearly readable headline with no extra text in a cleaner, warmer composition. Its uncluttered background and classic cup-and-saucer prese
- **A02b** Write the Cleanup Headline · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both meet the requirements with square, friendly beach illustrations and clear embedded text. B has a catchier headline, an effective supporting call to action,
- **A02c** Instagram Plant Shop Announcement · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B combines lush, clearly visible potted plants with an uncluttered cream background and an elegant, readable headline containing the exact requested text. Both 
- **A02d** Headline Above the Coach · agent 94 pass (5 cr) vs MCP 100 pass (20 cr) · B provides a cleaner, more upbeat composition with the exact headline comfortably inside the canvas and fully separated from the coach’s face. Both depict a smi
- **A03a** Community Picnic With Complete Details · agent 94 pass (5 cr) vs MCP 100 pass (20 cr) · Both include the exact required wording and correct portrait proportions, but A is substantially more polished and cheerful, with cohesive colors, clear typogra
- **A03b** Four Clearly Separated Flyer Blocks · agent 100 pass (5 cr) vs MCP 100 pass (20 cr) · A has four clearly separated, legible text blocks, a stronger typographic hierarchy, and warm lanterns framing a dark-blue background. B includes the required w
- **A04b** Somewhere Quiet and Hopeful · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B more naturally balances quiet and gentle hope through its spacious sky, still pond, restrained palette, and warmly glowing windows. A also meets the request w
- **A04d** Cup Left of the Laptop · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B better matches the requested simple illustration style and keeps all surfaces free of text. Both have the correct object placement and clear spacing, but B's 
- **A05a** LinkedIn Headshot From Park Photo · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · Both provide a centred square headshot, navy blazer, plain grey background, and fully visible curly hair. A has more convincing skin texture and sharper, more n
- **A05b** Make My Photo Look Professional · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both deliver clean professional portraits with short grey hair, realistic facial texture, collared shirts, blazers, and unobtrusive backgrounds. A has slightly 
- **A05d** Choose The Right Headshot Subject · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both show a single short-haired blonde woman in a square portrait with unobtrusive backgrounds and convincing lighting. A has the edge for its complete blazer-a
- **A06b** Exact Spelling For Repair Logo · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both spell KwickFixx correctly with black lettering, white backgrounds, and no extra text. B better satisfies the small-wrench requirement, with a compact orang
- **A06d** Three Distinct Cycling Logo Options · agent 87 pass (30 cr) vs MCP 94 pass (30 cr) · Both deliver three separate square images with the correct name and clearly different symbols. B offers cleaner, flatter, more reproducible logo designs, with a
- **B07c** Warmer Colours Only · agent 94 pass (5 cr) vs MCP 87 pass (10 cr) · A gives the sky, mountains and reflections a gentler, warmer balance while preserving the scene’s natural appearance. B retains the overall composition but intr
- **B07d** Change Only the Bottle · agent 100 pass (5 cr) vs MCP 38 (10 cr) · A recolors the entire bottle consistently to a dark forest green while retaining a matte finish and clear surface details. B leaves the handle black and shows m
- **B09a** Bottle on a Kitchen Counter · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both show a matte black bottle on a light stone counter in a tidy modern kitchen, with square framing and no added text. A has a cleaner, more cohesive setting 
- **B09b** Beach Background for My Portrait · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · Both provide a square head-and-shoulders beach portrait with sand and blue sea. A has more natural skin texture, restrained color, and more convincing fine hair
- **B09c** Sneaker on Studio White · agent 87 pass (5 cr) vs MCP 87 pass (10 cr) · A provides the cleaner, more natural studio product shot with a restrained grounding shadow. Both show the whole sneaker and recognizable details without clutte
- **B10a** Portrait From a Seventies Film · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B delivers a more convincing 1970s film-still look through muted warm colours and restrained grain while keeping facial detail, dark curls, sweater texture and 
- **B10c** Car Photo in Black and White · agent 100 pass (0 cr) vs MCP 81 (10 cr) · Both are fully neutral black and white and show essentially the same car and street composition. B has slightly crisper car details and background texture. With
- **B10d** Fox Mascot in Reference Style · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B preserves a friendly, clearly orange-hooded fox with comfortable space around its entire body. Its striped sun, palm silhouettes, neon grid, and pink-to-teal 
- **B11a** Quiet Caption Over The Lake · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A adds the exact caption in clean, readable white lettering near the bottom while leaving the wide landscape unobstructed. B also has correct text and full fram
- **B11b** Chalkboard Outside The Café · agent 100 pass (5 cr) vs MCP 94 pass (10 cr) · A presents “COFFEE TO GO” more clearly and cleanly on a convincing freestanding chalkboard. Both preserve the wide storefront, awning, and outdoor seating; B ha
- **B11c** Shocked Cat Monday Meme · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both meet the text, styling, square-format, and unobstructed-eye requirements. A has slightly cleaner placement, leaving more separation between the captions an
- **B11d** Something Catchy For Coffee · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A delivers a warm, readable caption with elegant typography placed entirely above the cup. B also has suitable wording, but its bulky translucent panel intrudes
- **B12a** Square Crop Keeps Whole Sneaker · agent 52 (0 cr) vs MCP 100 pass (10 cr) · B is square, shows the entire naturally proportioned sneaker, and presents a continuous floor and background. A also keeps the sneaker visible, but its conspicu
- **B12d** Left Edge Sneaker Stays Visible · agent 100 pass (0 cr) vs MCP 52 (10 cr) · Both are square and retain the complete sneaker, but B presents it larger and centrally with balanced, consistent padding. A’s asymmetric layout and differently
- **B13a** Restore a Faded Family Scan · agent 94 pass (5 cr) vs MCP 43 (10 cr) · A retains the sepia appearance and the same visible family grouping and setting while providing substantially clearer faces, clothing, and natural tonal separat
- **B13b** Sharpen a Blurry Dog Photo · agent 94 pass (5 cr) vs MCP 52 (10 cr) · A plainly provides clearer facial features, fur, and body edges while retaining natural photographic texture and the same visible pose, background, and full fra
- **C14b** Which Friend Gets My Face · agent 94 pass (20 cr) vs MCP 90 (10 cr) · B's final wide image preserves the man's appearance, clothing, beach scene, and framing while localizing the visible facial change to the woman on the right. A 
- **C15a** Five Second Talking Face Swap · agent 94 pass (240 cr) vs MCP 84 (270 cr) · A’s video frames closely match the portrait’s facial features across both expressions, with a coherent, aligned face and preserved kitchen framing. B shows a di
- **C16a** Fox Mascot Across Three Scenes · agent 94 pass (15 cr) vs MCP 100 pass (30 cr) · Both deliver three separate square, text-free cartoons with a consistent orange-hoodie fox and all requested settings. B has clearer bicycle construction, a mor
- **C16b** My Dog In Three Places · agent 100 pass (15 cr) vs MCP 100 pass (30 cr) · B more convincingly maintains the same face, ears, muzzle and build across the three settings, with clearer fur detail and more balanced lighting. Both deliver 
- **C16c** Invent A Courier Then Reuse · agent 35 (25 cr) vs MCP 91 (25 cr) · B closely preserves its original robot’s distinctive head, single amber eye, antenna, chest panel, articulated limbs, boots and mailbag across both follow-ups. 
- **C17a** Photo Speaks My Short Script · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · Both show the curly-haired woman in square, caption-free frames with changing mouth positions. A looks more natural and expressively friendly, while B's open-mo
- **C17b** Write My Talking Sale Pitch · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · A shows distinct speech-like mouth positions and facial movement, making it more convincing as a talking presenter. B looks nearly static. Both are square, depi
- **D18a** Bottle Turns Slowly in Place · agent 42 (144 cr) vs MCP 94 pass (144 cr) · B keeps the bottle's body, table contact, and framing more consistent while the lid visibly changes orientation. It also matches the requested duration exactly.
- **D20c** Make My Photo Reel Fun · agent 73 (0 cr) vs MCP 94 pass (192 cr) · B visibly adds a cheerful scrapbook frame and sparkle doodles while keeping the woman’s face unobscured, better delivering the requested fun vibe. A preserves r
- **D22a** Make a Cat Then Animate · agent 30 (125 cr) vs MCP 26 (125 cr) · B provides a cleaner, anatomically coherent cat with one visibly repositioned tail, a blue scarf, and a sunny square windowsill composition, at the requested du
- **D22b** Animate the Lighthouse Just Made · agent 23 (149 cr) vs MCP 42 (149 cr) · B matches the requested duration and visibly shows the lighthouse beam changing across the water, alongside changing waves. Both retain their respective earlier
- **D22c** Keep My Robot Recognizable · agent 41 (125 cr) vs MCP 58 (125 cr) · B preserves its original illustrated robot and cartoon style, including the single large eye, yellow body and purple boots, and meets the stated five-second dur
- **D23c** Coffee Clip Exact URL Ending · agent 32 (125 cr) vs MCP 34 (192 cr) · Both show a vertical close-up of coffee pouring into a ceramic cup, and both fail the crucial URL requirement. A nevertheless provides a clean black end card wi
- **E24d** Make Those Captions TikTok Bold · agent 0 (53 cr) vs MCP 27 (336 cr) · the MCP side delivered a file; the agent delivered nothing
- **E25b** Portrait Cut for Two Speakers · agent 37 (0 cr) vs MCP 28 (240 cr) · A fails the vertical-format requirement but keeps both actual speakers' faces fully visible. B achieves portrait framing at the expense of the conversation itse
- **F30c** Exactly Fifteen Seconds of Music · agent 41 (15 cr) vs MCP 94 pass (15 cr) · by the grader's score (41 vs 94)
- **G33a** Shocked Face Gaming Thumbnail · agent 100 pass (10 cr) vs MCP 81 (10 cr) · A has a better-composed shocked face, vibrant gaming-style effects, and exceptionally readable text without obscuring the face. Both display exactly “ONE LAST T
- **G33b** Morning Video Frame Thumbnail · agent 100 pass (10 cr) vs MCP 83 (10 cr) · A’s finished thumbnail more closely preserves the shown woman’s face and hands while adding the exact headline in large, high-contrast letters beside her. Its g
- **G34b** Five Tips Five Separate Slides · agent 52 (50 cr) vs MCP 52 (60 cr) · Both omit two required slides, but B clearly better matches the requested clean blue-and-white design, with cohesive typography, readable text, and relevant ill
- **G34c** One Print Style Across Plants · agent 34 (40 cr) vs MCP 25 (40 cr) · B much better satisfies the central consistency requirement: matching sage-and-cream treatment, borders, serif lettering, textured paper, pot shapes and aligned
- **G37b** Rescheduled Event Across All Formats · agent 37 (285 cr) vs MCP 21 (280 cr) · A correctly updates both images to '24 October 2027' while closely preserving their original designs and remaining details. Although its pack is incomplete, B's
- **G38a** Three Matching Mug Listing Photos · agent 34 (15 cr) vs MCP 39 (30 cr) · B offers a more convincing sage-green mug, a clearly breakfast-themed setting, and a sharper close-up showing the rim and glaze texture. Its mug remains visuall
- **G39b** Monday Meme From Scratch · agent 90 (20 cr) vs MCP 100 pass (10 cr) · Both deliver legible Monday jokes with fitting reaction images. A has tighter framing and a direct pairing between the incredulous expression and the joke about
- **H40a** Black Bottle Product Reel · agent 47 (390 cr) vs MCP 37 (370 cr) · B offers a cleaner, sharper studio presentation, a consistent matte-black bottle, and a convincing detail close-up. A has conspicuous gibberish text and less po
- **H41b** Service Ad Without Source Assets · agent 58 (202 cr) vs MCP 52 (192 cr) · A communicates the core transformation much more clearly: readable scattered tasks become a readable, timed daily plan, with a calm blue-and-white design. B inc
- **H42a** Café Reel From Owner Photos · agent 45 (231 cr) vs MCP 94 pass (216 cr) · B better preserves the storefront, striped awning and outdoor tables, with warmer, more characterful typography. Both show the exact requested opening and closi
- **H43a** Casual Talking Camera Testimonial · agent 0 (0 cr) vs MCP 52 (230 cr) · the MCP side delivered a file; the agent delivered nothing
- **J49a** Warmer Without Recreating The Scene · agent 94 pass (10 cr) vs MCP 27 (15 cr) · Both preserve their original framing, objects and background details and remain square. A delivers a more coherent, clearly warmer colour balance while retainin
- **J49b** Bigger Headline Same Poster · agent 94 pass (20 cr) vs MCP 94 pass (20 cr) · A more faithfully preserves the original serif lettering, headline centre and coffee illustration. Although its enlargement falls short, it better satisfies the
- **J50a** Make the First One Square · agent 58 (10 cr) vs MCP 100 pass (25 cr) · B retains the existing fox’s exact pose, character details, warm colours and delicate watercolour setting. A fits a fox and crescent into a square without text,
- **J51a** Switch to TikTok Before Making · agent 49 (144 cr) vs MCP 94 pass (144 cr) · A better captures the cosy illustrated mood through warm wood tones, softer rendering, and a balanced windowsill composition. Both show vertical framing, rain, 
- **J51b** Resize Finished Clip Without Remaking · agent 44 (192 cr) vs MCP 30 (192 cr) · A keeps the entire cartoon composition and exact title clearly visible. Although it fails the vertical resize requirement, B achieves a vertical frame by sacrif
- **J52a** Night Market Poster and Reel · agent 58 (207 cr) vs MCP 45 (202 cr) · B’s reel is substantially cleaner and more polished, with all five exact text strings clearly readable and visible steam animation behind them. A supplies both 
- **J55a** Full Creative Control Within Brief · agent 94 pass (144 cr) vs MCP 100 pass (144 cr) · Both visibly deliver a tiny robot watering a recognizable sunflower. A edges ahead with an exact six-second duration, a clearer stream reaching the soil beside 

## The agent's clearest wins (top 12 of 72)

- **E25a** Keep Her Centred in Portrait · agent 100 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **D20d** Mixed Sizes Without Cropping · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E26a** Pick the Best Ten Seconds · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27b** Choose Music That Fits · agent 94 pass (30 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27a** Warm Music for Morning Tips · agent 94 pass (30 cr) vs MCP 5 (15 cr) · B provides a 10.1-second clip showing the woman in the kitchen-table setting, consistent with the requested video. A delivers nothing usable. Although the image
- **E27c** Music Beneath the Radio Calls · agent 94 pass (30 cr) vs MCP 5 (15 cr) · B delivers a seven-second cockpit clip with visible radio-dialogue subtitles, including 'Rook, you with me?', whereas A delivers nothing usable. The frames cann
- **E29a** Fox Logo Throughout the Clip · agent 100 pass (5 cr) vs MCP 16 (5 cr) · B shows the woman at the kitchen table with a small, unclipped fox in the top-right, visible padding, no white rectangular background, and no obstruction of her
- **G37a** Night Market Event Pack · agent 94 pass (265 cr) vs MCP 16 (260 cr) · B supplies all three requested formats, with the exact event details legible and unclipped. Its 10-second reel shows changing lantern and market imagery while k
- **F31a** Calm Voice Reading Supplied Script · agent 76 (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **J49c** Shorter Clip Same Opening · agent 94 pass (192 cr) vs MCP 20 (192 cr) · B meets the requested five-second duration and retains a widescreen, text-free pond scene. Neither fully satisfies the edit-only instruction: A is unshortened, 
- **A03d** Long Venue Address Preserved Exactly · agent 100 pass (20 cr) vs MCP 27 (20 cr) · B delivers the requested clean black-and-cream 4:5 flyer with the correct headline, date, time, and complete readable address. A adds extra headline text and co
- **A06c** Transparent Moon Bakery Logo · agent 94 pass (10 cr) vs MCP 29 (15 cr) · A clearly displays the exact name “Mooncrumb” in dark navy beneath an intact gold crescent. Although its apparent white background fails the transparency requir

## Both failed (52)

- **I46a** Meet the Real F-35A · agent: The clip shows a runway departure with correct factual narration, but the aircraft is inaccurate and inconsist · MCP: The widescreen clip shows a runway departure and flight with correct English narration, but garbled labels and
- **I90a** Two economists, a 30 s video podcast · agent: A convincing, cosy two-host video podcast delivers the economic disagreement and friendly ending, but a garble · MCP: The clip looks like a polished, cosy two-host video podcast, but its supplied speech omits Leo's position and 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: The visuals deliver the warm coffee ritual and correct branded end card, but unsolicited Japanese dialogue pre · MCP: A warm, visually polished coffee ad delivers the requested mug lift and closing slogan, but the brand name is 
- **I92a** Citric acid cycle, a 60 s explainer · agent: A widescreen mitochondrion diagram has the requested title and loop, but corrupted labels, misleading pathway  · MCP: The 60-second widescreen clip shows a circular diagram, but garbled labels and incoherent narration make it un
- **I93a** Night ride, a 60 s single take · agent: The clip shows a yellow-jacketed courier cycling along wet nighttime streets, but contains forbidden speech an · MCP: The clip depicts the requested rainy bicycle journey and café arrival, but prohibited speech and dusk-like lig
- **I46a** Meet the Real F-35A · agent: The widescreen clip presents the three correct labels, but shows a distorted aircraft suspended over a runway  · MCP: The widescreen clip shows a runway departure and flight with correct English narration, but garbled labels and
- **I90a** Two economists, a 30 s video podcast · agent: The film achieves a warm, live-action podcast setting with consistent hosts, but delivers only one audible lin · MCP: The clip looks like a polished, cosy two-host video podcast, but its supplied speech omits Leo's position and 
- **I91a** Cabin Coffee, 10 s YouTube ad · agent: A warm coffee spot with the correct branded closing line, but an unrequested two-mug pouring sequence replaces · MCP: A warm, visually polished coffee ad delivers the requested mug lift and closing slogan, but the brand name is 
- **C15c** Two Coworkers Two Replacement Faces · agent: The woman resembles her supplied portrait, but neither male coworker matches the man's portrait, leaving half  · MCP: The agent produced only face-detection previews and clarification requests, leaving the requested two-face vid
- **C16c** Invent A Courier Then Reuse · agent: The two attractive storybook scenes fulfill the requested settings, but the mushroom scene changes the robot i · MCP: The two follow-up pictures clearly depict the requested scenes in a consistent storybook style, but the initia
- **D18b** Portrait With Subtle Natural Motion · agent: The portrait remains recognizable and visually consistent, but noticeable sideways sway exceeds the requested  · MCP: The silent clip keeps her recognizable and shows a blink-like eyelid change, but an obvious progressive zoom v
- **D18c** Lake Clouds and Water Moving · agent: The lake scene remains recognizable and stable with gentle water motion, but rapid cloud evolution, changing s · MCP: The lake has gentle animated ripples and moving clouds, but a pronounced push-in, changing light, and incorrec
- **D19a** Dog Catches a Flying Frisbee · agent: A realistic golden retriever runs through a grassy park and ends with a red frisbee in its mouth, but the requ · MCP: A realistic golden retriever catches an identifiable red frisbee in a grassy park, but the camera moves instea
- **D19c** Hands Fold a Paper Sheet · agent: The realistic overhead clip shows plausible hands folding and smoothing blue paper, but the extra folds and en · MCP: The realistic overhead clip shows a convincing blue-paper fold and crease pressing, but uses a white surface i
- **D21a** Quiet Lake Website Loop · agent: A calm, fixed-view mountain lake at dusk with subtle water movement suits the background brief, but the clip r · MCP: The clip provides a calm, fixed mountain-lake view with subtle ripples, but it includes unwanted audio and exc
- **D22a** Make a Cat Then Animate · agent: The sunny square animation shows the requested cat blinking and swishing a tail, but the cat has two tails and · MCP: The square clip attractively depicts the requested cat and shows tail movement, but the standalone picture is 
- **D22b** Animate the Lighthouse Just Made · agent: The clip shows a stable striped lighthouse at dusk with moving surf, but lacks the requested watercolor appear · MCP: The dusk lighthouse scene shows moving surf and a sweeping beam, but the requested watercolor appearance is no
- **D22c** Keep My Robot Recognizable · agent: The robot visibly waters the seedlings, but the glossy 3D rendering fails the requested drawing style and the  · MCP: The cartoon robot visibly tips its red can and waters the plants, but the malformed boots and pot–leg overlap 
- **D23a** Mountain Morning Opening Title · agent: The correct title and attractive moving sunrise lake scene are present, but the title card lasts too long. · MCP: The clip has an attractive misty sunrise lake scene, but the title is misspelled and remains onscreen too long
- **D23c** Coffee Clip Exact URL Ending · agent: The coffee pour looks appropriate, but the end card has the wrong background and a severely cropped URL. · MCP: The coffee pour and black end card are present, but the URL is garbled and split across two lines, requiring a
- **E24b** Spanish Subtitles For This Clip · agent: The footage and English speech appear preserved, but the Spanish overlay is an unrelated request rather than a · MCP: not-made
- **E24c** Silent Clip Subtitle Check · agent: The agent avoided fabricating speech or presenting subtitles but failed to clearly report that the clip has no · MCP: The agent meets all four must-haves, although the transcript does not substantiate its specific claim that the
- **E24d** Make Those Captions TikTok Bold · agent: not-wired:video-edit, not-made:not-wired · MCP: The final clip has large, readable English captions and keeps her face clear, but it fails the requested verti
- **E25b** Portrait Cut for Two Speakers · agent: The clip is portrait and caption-free, but its crop favours the central man instead of framing the questioner  · MCP: The output is a 10-second landscape group shot rather than a vertical edit that centres each speaker during th
- **E25c** Vertical Speaker Cut With Captions · agent: The centred vertical edit includes the complete spoken wording in short captions, but the captions need strong · MCP: The clip has readable captions below her face, but it fails the central requirement to make the video 9:16.
- **E26b** Cut Out the Boring Parts · agent: not-wired:video-edit, not-made:not-wired · MCP: not-made
- **E28a** Add My Supplied Voiceover · agent: The kitchen-table video has a voice-over and no visible added captions, but the narration omits the required o · MCP: not-made
- **E28b** Write Narration From The Clip · agent: The 10-second office clip has English narration, but it describes the coworkers' movements instead of explaini · MCP: not-made
- **E28c** Fit Narration To Seven Seconds · agent: The seven-second output retains cockpit imagery but fails the audio replacement and includes prohibited dialog · MCP: not-made
- **E29b** Append a Clean End Card · agent: The end card has the correct, readable centered text, but appears too early and cuts short the requested cockp · MCP: not-made
- **E29c** Subtle Handle Watermark Throughout · agent: The correct handle is consistently readable, but it appears as a large bottom-center label with a dark box rat · MCP: not-made
- **F30b** Upbeat Reel Music Default · agent: A 15-second music WAV is delivered, but the supplied transcription does not establish its energy, opening timi · MCP: A 15-second audio file was delivered, but the supplied transcription does not establish its upbeat character, 
- **F31a** Calm Voice Reading Supplied Script · agent: The standalone WAV contains the exact script but runs slightly short; vocal delivery and background silence ca · MCP: not-made
- **F31b** Two Voices Trading Short Lines · agent: The seven-second audio contains only A's two lines and omits both of B's replies, making the requested convers · MCP: not-made
- **F32a** Twenty Second Podcast Intro · agent: A 20-second audio file was delivered, but its reported speech replaces the entire requested introduction with  · MCP: The delivered audio is 20 seconds long, but its transcribed speech replaces the requested introduction with a 
- **F32b** Tiny Forests Two Host Segment · agent: A 100-second audio file has a relevant, conversational opening, but the supplied transcript is incomplete and  · MCP: not-made
- **G34b** Five Tips Five Separate Slides · agent: Five correctly ordered, readable, illustrated slides were delivered, but the requested blue-and-white palette  · MCP: Five readable blue-and-white slides were delivered, but slide 4 repeats the first tip instead of saying 'Set a
- **G34c** One Print Style Across Plants · agent: The four correctly named plants are recognizable, but the set fails the requested consistency in palette, bord · MCP: Three attractive, closely matched plant slides were delivered, but the required opening Monstera slide is miss
- **G35b** Imagine My Kitchen Renovation · agent: The comparison is neatly presented and mostly matches the requested finishes, but it removes original plumbing · MCP: The labeled comparison delivers the requested renovation finishes, but replaces the original photo with a reco
- **G36b** Readable Sale Copy Every Size · agent: The three coordinated leafy ads use the requested formats and readable addresses, but the landscape needs corr · MCP: The two supplied ads are readable and visually coordinated, but the requested three-format set is incomplete a

