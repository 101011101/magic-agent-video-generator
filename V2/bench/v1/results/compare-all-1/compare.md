# Agent vs the Magic Hour MCP · the films (direct generation, then the chain), then the micro tasks

162 items, the same prompt to both. Agent records from direct and agent and real-1 and latest; MCP baseline from mcp-film-1 and mcp-film-2 and mcp-film-3 and mcp-film-4 and mcp-1 (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate). Joined from compare-film-direct (the films, direct generation, 6) and compare-film-1 (the films, the keyframe chain, 4) and compare-mcp-1 (the micro tasks, 152), in that order.

**Head to head: the agent wins 69, the MCP wins 77, 16 ties → win rate 47% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 93 (57%) | 64 (40%) |
| mean score | 74 | 61 |
| delivered a file | 148 | 137 |
| credits | 15241 | 15683 |
| minutes of item time | 92 | 161 |
| questions asked (for information) | 14 | 16 |
| asked the user to approve or proceed | 0 | 1 |
| calls refused by the free-plan gate | — | 3 |
| steps planned / tool calls | 374 | 691 |

| Part | Items | Agent wins | MCP wins | Ties | Win rate | Agent pass | MCP pass | Agent mean | MCP mean | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| The films, direct generation (compare-film-direct) | 6 | 2 | 4 | 0 | 33% | 0 | 1 | 43 | 50 | 4234 | 4224 |
| The films, the keyframe chain (compare-film-1) | 4 | 0 | 4 | 0 | 0% | 0 | 1 | 42 | 59 | 1719 | 1344 |
| The micro tasks (compare-mcp-1) | 152 | 67 | 69 | 16 | 49% | 93 | 62 | 76 | 61 | 9288 | 10115 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I. Longer stories (film) | 4 | 0 | 1 | 42 | 59 | 0 | 4 | 0 | 0% | 1719 | 1344 |
| A. Single images | 24 | 24 | 20 | 98 | 89 | 7 | 17 | 0 | 29% | 190 | 290 |
| B. Image edits | 26 | 24 | 16 | 94 | 80 | 8 | 16 | 2 | 33% | 130 | 295 |
| C. Faces and characters | 12 | 10 | 8 | 86 | 88 | 1 | 7 | 4 | 13% | 1828 | 759 |
| D. Short video | 18 | 3 | 3 | 53 | 51 | 10 | 8 | 0 | 56% | 2086 | 2828 |
| E. Editing the user's video | 18 | 7 | 0 | 54 | 12 | 13 | 2 | 3 | 87% | 324 | 707 |
| F. Sound | 7 | 1 | 1 | 59 | 26 | 5 | 1 | 1 | 83% | 45 | 65 |
| G. Composed pieces | 16 | 8 | 3 | 72 | 53 | 8 | 8 | 0 | 50% | 840 | 875 |
| H. Ads and reels | 13 | 3 | 1 | 56 | 46 | 8 | 4 | 1 | 67% | 2674 | 3048 |
| J. Conversation | 18 | 13 | 10 | 83 | 71 | 7 | 6 | 5 | 54% | 1171 | 1248 |

## What the MCP side did

Models it chose: qwen-image-2.1 ×67, ltx-2.5 ×34, minimax-h3 ×17, flux-schnell ×10, flux-2-klein ×6.
Tools it called (steps): edit_image ×83, generate_image ×46, create_video_from_text ×40, create_video_from_image ×13, detect_faces ×8, add_subtitles_to_video ×6, generate_music ×6, edit_video ×3, remove_image_background ×2, swap_face_in_photo ×2, swap_face_in_video ×2, upscale_image ×1, create_meme ×1.

Calls the free-plan gate refused:
- 3× insufficient credits: this call needs about n credits and n remain of 

## Where the MCP won (77)

- **I47a** Seed Growth With Supplied Narration · agent 37 (192 cr) vs MCP 100 pass (192 cr) · A offers a clear, simple widescreen soil cutaway with downward roots, an upward shoot, visible light, and no text. B includes conspicuous, malformed captions, d
- **I90a** Two economists, a 30 s video podcast · agent 58 (720 cr) vs MCP 42 (720 cr) · Both show consistent, live-action-looking hosts at microphones in warm, widescreen studios. B has a slightly stronger video-podcast presentation through headpho
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (240 cr) vs MCP 58 (240 cr) · Both show steaming coffee on wood and the exact closing words in widescreen. A better sustains the warm, quiet specialty-coffee mood with its rustic mug, golden
- **I93a** Night ride, a 60 s single take · agent 37 (1440 cr) vs MCP 39 (1440 cr) · A visibly delivers the bridge opening and a café-door arrival with the rider putting a foot down, while retaining a similar yellow jacket and bicycle. B has con
- **I46a** Meet the Real F-35A · agent 29 (287 cr) vs MCP 34 (192 cr) · B better conveys a conventional runway takeoff followed by flight, with more realistic aircraft proportions and broadly consistent views. A has two correct labe
- **I47a** Seed Growth With Supplied Narration · agent 37 (242 cr) vs MCP 100 pass (192 cr) · A is a much clearer simple animated explainer: the soil cutaway shows water at the seed, downward roots, and an upward shoot reaching toward visible sunlight. B
- **I90a** Two economists, a 30 s video podcast · agent 42 (775 cr) vs MCP 42 (720 cr) · B offers a cleaner, more convincing live-action podcast presentation, with consistent hosts, prominent microphones, and a cosy studio. A’s captions provide stro
- **I91a** Cabin Coffee, 10 s YouTube ad · agent 58 (415 cr) vs MCP 58 (240 cr) · A more convincingly delivers the warm dawn atmosphere, steaming handmade mug, wooden table, and restrained specialty-coffee aesthetic. Its final frame clearly d
- **A01b** Premium Candle Product Shot · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · A delivers a more convincing luxury scented-candle advertisement through amber glass, restrained branding, a gold lid, and coordinated warm lighting. Its suppor
- **A01c** Square White Background Sneaker · agent 100 pass (5 cr) vs MCP 100 pass (5 cr) · Both meet the core requirements, but A offers a more balanced composition and clearer shoe details, making it the stronger marketplace product photo.
- **A01d** Exact Brand Name on Label · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both show amber glass bottles with cream labels and correctly spelled, integrated VELORA lettering. A better fulfills the hand-soap product brief through its pu
- **A02a** Exact Headline for Coffee Post · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B delivers the exact, readable headline with no extra text, a steaming espresso-style cup on a sunlit table, and a cleaner, warmer composition. A meets the text
- **A02b** Write the Cleanup Headline · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both satisfy the brief, but B has a catchier headline, a cohesive friendly composition, and unmistakable litter collection with grabbers. Its intergenerational 
- **A02c** Instagram Plant Shop Announcement · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B pairs a clean cream background with lush, clearly visible potted plants and an elegant, readable headline. Both are square and contain the exact requested tex
- **A02d** Headline Above the Coach · agent 94 pass (5 cr) vs MCP 100 pass (20 cr) · B delivers the exact headline with comfortable margins and clear separation above the coach’s fully visible face. Its bright studio and colorful fitness clothin
- **A03a** Community Picnic With Complete Details · agent 94 pass (5 cr) vs MCP 100 pass (20 cr) · Both include the required text and flowers, but A is a cohesive, cheerful picnic flyer with balanced typography, warm colours, and a picnic-blanket illustration
- **A03b** Four Clearly Separated Flyer Blocks · agent 100 pass (5 cr) vs MCP 100 pass (20 cr) · A presents all four requested text blocks with clear separation, strong hierarchy, and no extra wording. Its warm lanterns frame the text beautifully against da
- **A04b** Somewhere Quiet and Hopeful · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · Both are cohesive, wordless illustrations that meet the request. B edges ahead with its spacious sky, still pond, restrained palette, and softly glowing windows
- **A04d** Cup Left of the Laptop · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B better matches the requested simple illustration style and avoids visible lettering, while clearly placing the yellow cup left and closed blue notebook right 
- **A05a** LinkedIn Headshot From Park Photo · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · Both provide square, centred head-and-shoulders portraits with navy blazers, grey backgrounds, and full curly hair visible. A has more convincing skin texture a
- **A05b** Make My Photo Look Professional · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both provide clean professional clothing, neutral backgrounds, short grey hair, and realistic facial detail. A narrowly wins for its more natural shoulder angle
- **A05c** Professional Portrait Without Changing My Face · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · A offers more natural-looking lighting and a less stylized face and hair treatment, better fitting the request for restrained editing. Both provide professional
- **A05d** Choose The Right Headshot Subject · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both are clean square portraits with a single short-haired blonde woman, a natural smile, and neutral backgrounds. A edges ahead with its blouse-and-blazer styl
- **A06b** Exact Spelling For Repair Logo · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both render 'KwickFixx' correctly in legible black lettering on white without extra text. B better matches the requested small orange wrench and presents a clea
- **A06d** Three Distinct Cycling Logo Options · agent 87 pass (30 cr) vs MCP 94 pass (30 cr) · Both deliver three separate square images with the correct name and ampersand. B offers cleaner, flatter, more reproducible logos with three distinct symbol ide
- **B07c** Warmer Colours Only · agent 94 pass (5 cr) vs MCP 87 pass (10 cr) · A delivers a natural, warmer colour balance while preserving the composition and lake reflections. B retains the scene layout but applies a harsher, cooler-look
- **B07d** Change Only the Bottle · agent 100 pass (5 cr) vs MCP 38 (10 cr) · A more completely recolors the bottle forest green while retaining a matte appearance and clean edges. Both show similar framing and surroundings, but B leaves 
- **B08b** Clear Selected Desk Clutter · agent 100 pass (5 cr) vs MCP 81 (10 cr) · Both remove the papers and takeaway cup while preserving the wide office scene, laptop and mug. B has more consistent desk texture and cleaner, more continuous-
- **B09b** Beach Background for My Portrait · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · Both provide a square head-and-shoulders beach portrait with sand, blue sea, curls, and sweater intact. A looks more natural overall, retaining better skin text
- **B09c** Sneaker on Studio White · agent 87 pass (5 cr) vs MCP 87 pass (10 cr) · A provides the cleaner studio product shot, with recognizable sneaker details and a restrained, soft grounding shadow. B's conspicuously dark shadow conflicts w
- **B10a** Portrait From a Seventies Film · agent 94 pass (5 cr) vs MCP 100 pass (10 cr) · B better balances a warm, muted 1970s film look with clear facial features, dark curls, sweater texture and the identifiable park. Both retain square head-and-s
- **B10c** Car Photo in Black and White · agent 100 pass (0 cr) vs MCP 81 (10 cr) · Both appear fully neutral black and white and show essentially the same car and street composition. B has slightly crisper body details and background textures,
- **B10d** Fox Mascot in Reference Style · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B gives the friendly, full-body fox more breathing room and preserves a distinctly orange hoodie. Its pink-to-teal gradient, striped sun, palm silhouettes, and 
- **B11a** Quiet Caption Over The Lake · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A provides the requested clean white lettering with minimal interference with the full landscape. B has the correct text and preserves the framing, but its prom
- **B11b** Chalkboard Outside The Café · agent 100 pass (5 cr) vs MCP 94 pass (10 cr) · A presents the exact requested words clearly on a convincing freestanding chalkboard, while preserving the wide café view. B has stronger ground shadow, but its
- **B11c** Shocked Cat Monday Meme · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both satisfy the exact wording, square format, outlined white uppercase lettering, and unobstructed eyes. A has slightly cleaner placement, keeping the captions
- **B11d** Something Catchy For Coffee · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A adds a short, warm, readable caption with cleaner typography placement and a warmer café feel. It keeps the coffee and leaf fully unobscured, whereas B's dark
- **B12a** Square Crop Keeps Whole Sneaker · agent 52 (0 cr) vs MCP 100 pass (10 cr) · B provides a continuous, natural-looking floor and background while keeping the whole sneaker visible. A also preserves the sneaker, but its blurred padding vis
- **B12d** Left Edge Sneaker Stays Visible · agent 100 pass (0 cr) vs MCP 52 (10 cr) · Both outputs are square and retain the complete sneaker, but B presents it larger and centrally with consistent, unobtrusive padding. A's patchwork background a
- **B13a** Restore a Faded Family Scan · agent 94 pass (5 cr) vs MCP 43 (10 cr) · A provides clearer facial features, clothing, and architectural detail with stronger, more natural contrast while retaining sepia. Both depict the same visible 
- **B13b** Sharpen a Blurry Dog Photo · agent 94 pass (5 cr) vs MCP 52 (10 cr) · A provides substantially clearer eyes, nose, muzzle, and fur while retaining a natural appearance without pronounced sharpening halos. Both show the same seated
- **C15a** Five Second Talking Face Swap · agent 94 pass (240 cr) vs MCP 84 (270 cr) · A meets the explicit five-second duration and maintains consistent framing, kitchen and clothing. Neither convincingly demonstrates the requested identity throu
- **C15c** Two Coworkers Two Replacement Faces · agent 37 (735 cr) vs MCP 3 (0 cr) · the MCP side delivered a file; the agent delivered nothing
- **C16a** Fox Mascot Across Three Scenes · agent 94 pass (15 cr) vs MCP 100 pass (30 cr) · Both deliver three separate square, text-free scenes with a consistent fox and orange hoodie. B has more convincing activity poses: mixing cookie dough, riding 
- **C16b** My Dog In Three Places · agent 100 pass (15 cr) vs MCP 100 pass (30 cr) · Both deliver three square, photorealistic images with the requested settings, no clothes and no text. B slightly wins through more consistent facial features an
- **C16c** Invent A Courier Then Reuse · agent 35 (25 cr) vs MCP 91 (25 cr) · B preserves its original robot’s single amber eye, separate round head, torso details, articulated limbs, red boots and yellow shoulder bag across both follow-u
- **C17a** Photo Speaks My Short Script · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · Both show a consistent curly-haired woman in square, caption-free frames with changing mouth positions. A looks more naturally expressive and friendly, while B'
- **C17b** Write My Talking Sale Pitch · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · Both show a consistent grey-haired presenter in square frames without captions, with changing mouth positions suggesting speech. A meets the stated 8-second dur
- **D18a** Bottle Turns Slowly in Place · agent 42 (144 cr) vs MCP 94 pass (144 cr) · B better preserves the bottle’s position, upright proportions, and stationary setting, while the changing cap orientation indicates rotation. It also matches th
- **D20a** Five Café Photos With Music · agent 42 (15 cr) vs MCP 94 pass (240 cr) · B better preserves the recognizable photo compositions, especially the barista and café setting. A has cleaner full-bleed presentation but feels excessively zoo
- **D20c** Make My Photo Reel Fun · agent 73 (0 cr) vs MCP 94 pass (192 cr) · B visibly adds a fun scrapbook-style border and sparkle doodles while keeping the woman’s face unobscured. Its wider framing also preserves more of each photo. 
- **D22a** Make a Cat Then Animate · agent 30 (125 cr) vs MCP 26 (125 cr) · B has cleaner, more coherent anatomy, a visibly shifting single tail, and the requested 5-second duration. Both depict the requested square sunny-window illustr
- **D22b** Animate the Lighthouse Just Made · agent 23 (149 cr) vs MCP 42 (149 cr) · B matches the requested duration and shows a distinct beam changing across the water, alongside visible wave changes. It also preserves its original lighthouse,
- **D22c** Keep My Robot Recognizable · agent 41 (125 cr) vs MCP 58 (125 cr) · B preserves its original robot and flat cartoon style, retains the single eye, yellow body and purple boots, and shows the red can tipping toward the seedlings.
- **D23b** Gardener Interview Name Caption · agent 39 (168 cr) vs MCP 46 (168 cr) · A shows the exact two requested lines clearly in white on a dark bottom-left backing, stable across frames and clear of her face. B adds conspicuous unwanted gr
- **D23c** Coffee Clip Exact URL Ending · agent 32 (125 cr) vs MCP 34 (192 cr) · Both show a vertical close-up of coffee pouring into a ceramic cup, and neither delivers a usable exact URL. A is closer overall because its end card is plain b
- **E24d** Make Those Captions TikTok Bold · agent 0 (53 cr) vs MCP 27 (336 cr) · the MCP side delivered a file; the agent delivered nothing
- **E25b** Portrait Cut for Two Speakers · agent 37 (0 cr) vs MCP 28 (240 cr) · A at least keeps both actual speakers' faces fully visible and retains the stated 10-second duration. B achieves portrait framing but sacrifices the essential c
- **F30c** Exactly Fifteen Seconds of Music · agent 41 (15 cr) vs MCP 94 pass (15 cr) · by the grader's score (41 vs 94)
- **G33a** Shocked Face Gaming Thumbnail · agent 100 pass (10 cr) vs MCP 81 (10 cr) · Both have the exact headline clearly on the left and a large shocked face on the right. A has stronger overall composition, vivid colors, and gaming cues, with 
- **G33b** Morning Video Frame Thumbnail · agent 100 pass (10 cr) vs MCP 83 (10 cr) · A’s finished thumbnail closely retains the face and pose visible in its accompanying frame, with a large unobstructed face, the exact headline beside it, and a 
- **G34b** Five Tips Five Separate Slides · agent 52 (50 cr) vs MCP 52 (60 cr) · Both provide correctly ordered, readable first-three tips in 4:5 format, but B clearly better matches the requested clean blue-and-white design, with more cohes
- **G34c** One Print Style Across Plants · agent 34 (40 cr) vs MCP 25 (40 cr) · B clearly better preserves the requested carousel template: matching sage-and-cream palette, paper texture, double-line border, serif lettering, aligned layout 
- **G35a** Kitchen Renovation Side by Side · agent 48 (0 cr) vs MCP 36 (10 cr) · A provides the requested separate, readable labels above the correct kitchens and shows more of both scenes. B has the correct canvas ratio, but its labeling cl
- **G37b** Rescheduled Event Across All Formats · agent 37 (285 cr) vs MCP 21 (280 cr) · A correctly updates both images while closely preserving their original cream-and-burgundy designs. Neither pack fully satisfies the request, but B’s additional
- **G38a** Three Matching Mug Listing Photos · agent 34 (15 cr) vs MCP 39 (30 cr) · B has a more convincing sage-green finish, a clearly styled breakfast setting, and a sharper close-up that reveals the rim and glaze texture. Both keep the mug 
- **G39b** Monday Meme From Scratch · agent 90 (20 cr) vs MCP 100 pass (10 cr) · Both deliver legible, finished Monday memes with fitting reactions. A wins narrowly for its tighter composition and immediately recognizable disbelief joke; B’s
- **H40a** Black Bottle Product Reel · agent 47 (390 cr) vs MCP 34 (370 cr) · B presents a more consistent matte-black bottle with cleaner studio lighting and a polished full-product view plus detail close-up. A’s conspicuous nonsense let
- **H41a** FitTrack Ad From Supplied Screenshots · agent 40 (15 cr) vs MCP 49 (240 cr) · A provides a much more polished widescreen ad composition, shows the home screen in context, and clearly displays FitTrack on its closing card. B has sharper in
- **H42a** Café Reel From Owner Photos · agent 45 (231 cr) vs MCP 49 (216 cr) · B better preserves the complete storefront, striped awning and outdoor tables, with warmer, more characterful typography. Both show the exact requested opening 
- **H43a** Casual Talking Camera Testimonial · agent 0 (0 cr) vs MCP 52 (230 cr) · the MCP side delivered a file; the agent delivered nothing
- **J49b** Bigger Headline Same Poster · agent 94 pass (20 cr) vs MCP 94 pass (20 cr) · A better preserves the original serif font, headline centre point, and coffee illustration. Both retain the exact wording and square format, but B noticeably ch
- **J50a** Make the First One Square · agent 58 (10 cr) vs MCP 100 pass (25 cr) · B preserves its earlier fox illustration, including the curled pose, colours, moon, and meadow details. A introduces an entirely different fox-and-moon composit
- **J51a** Switch to TikTok Before Making · agent 49 (144 cr) vs MCP 94 pass (144 cr) · A better delivers the cosy atmosphere through warmer wood tones, softer rendering, and a balanced windowsill composition. Both are vertical with visible rain an
- **J51b** Resize Finished Clip Without Remaking · agent 44 (192 cr) vs MCP 30 (192 cr) · A preserves a complete, readable cartoon composition with the robot, potted plant and exact title visible. B has the vertical shape but sacrifices the full pict
- **J52a** Night Market Poster and Reel · agent 58 (207 cr) vs MCP 35 (202 cr) · B’s reel is substantially more polished, with all five requested strings clearly readable and visible steam/light animation behind them. A supplies both assets,
- **J55a** Full Creative Control Within Brief · agent 94 pass (144 cr) vs MCP 94 pass (144 cr) · A delivers the exact six-second duration and clearly shows water reaching the potted sunflower’s soil. Its detailed robot, warm lighting, and rooftop setting al

## The agent's clearest wins (top 12 of 69)

- **E25a** Keep Her Centred in Portrait · agent 100 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E26a** Pick the Best Ten Seconds · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27b** Choose Music That Fits · agent 94 pass (30 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27a** Warm Music for Morning Tips · agent 94 pass (30 cr) vs MCP 5 (15 cr) · B delivers a 10.1-second clip showing the woman at the kitchen table, consistent with the requested video and duration. Although the audio requirements cannot b
- **E27c** Music Beneath the Radio Calls · agent 94 pass (30 cr) vs MCP 5 (15 cr) · B provides a seven-second cockpit clip with visible subtitles including 'Rook, you with me?', whereas A delivers nothing usable. The images alone do not establi
- **E29a** Fox Logo Throughout the Clip · agent 100 pass (5 cr) vs MCP 20 (5 cr) · B shows the woman at the kitchen table with a small, unclipped fox in the top-right corner, clear margins, no white rectangle, and no obstruction of her face in
- **G37a** Night Market Event Pack · agent 94 pass (265 cr) vs MCP 16 (260 cr) · B delivers all three requested formats with the exact event details legible and unclipped. Its 10-second reel shows changing lantern imagery while keeping the t
- **A06c** Transparent Moon Bakery Logo · agent 94 pass (10 cr) vs MCP 17 (15 cr) · A clearly presents the exact name “Mooncrumb” in dark navy with an intact gold crescent above it. Although its white background raises a transparency concern, i
- **F31a** Calm Voice Reading Supplied Script · agent 76 (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **J49c** Shorter Clip Same Opening · agent 94 pass (192 cr) vs MCP 20 (192 cr) · B meets the requested five-second duration and retains a widescreen, text-free pond scene. However, its visibly different footage violates the instruction to ch
- **A03d** Long Venue Address Preserved Exactly · agent 100 pass (20 cr) vs MCP 27 (20 cr) · B provides the requested headline, date, time, and complete address with clear punctuation and no extra wording. Its crisp typography makes the address substant
- **F30b** Upbeat Reel Music Default · agent 91 (15 cr) vs MCP 20 (15 cr) · by the grader's score (91 vs 20)

## Both failed (58)

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
- **D18b** Portrait With Subtle Natural Motion · agent: The portrait remains recognizable and visually consistent, but noticeable sideways sway exceeds the requested  · MCP: The woman remains recognizable and shows a blink-like eyelid movement, but a pronounced zoom violates the requ
- **D18c** Lake Clouds and Water Moving · agent: The lake scene remains recognizable and stable with gentle water motion, but rapid cloud evolution, changing s · MCP: The lake has gentle animated ripples and moving clouds, but a pronounced push-in, changing light, and incorrec
- **D19a** Dog Catches a Flying Frisbee · agent: A realistic golden retriever runs through a grassy park and ends with a red frisbee in its mouth, but the requ · MCP: A realistic golden retriever catches an identifiable red frisbee in a grassy park, but the camera moves instea
- **D19c** Hands Fold a Paper Sheet · agent: The realistic overhead clip shows plausible hands folding and smoothing blue paper, but the extra folds and en · MCP: The clip convincingly shows blue paper being folded and creased, but uses a white surface instead of a wooden 
- **D20d** Mixed Sizes Without Cropping · agent: The 10-second vertical reel has no visible added text, but it crops photos to fill the frame instead of keepin · MCP: not-made
- **D21a** Quiet Lake Website Loop · agent: A calm, fixed-view mountain lake at dusk with subtle water movement suits the background brief, but the clip r · MCP: The clip shows a calm, fixed-view mountain lake at dusk with subtle ripples, but unwanted audio and excess dur
- **D22a** Make a Cat Then Animate · agent: The sunny square animation shows the requested cat blinking and swishing a tail, but the cat has two tails and · MCP: The square clip attractively depicts the requested cat and shows tail movement, but the standalone picture is 
- **D22b** Animate the Lighthouse Just Made · agent: The clip shows a stable striped lighthouse at dusk with moving surf, but lacks the requested watercolor appear · MCP: The dusk lighthouse scene shows moving surf and a sweeping beam, but the requested watercolor appearance is no
- **D22c** Keep My Robot Recognizable · agent: The robot visibly waters the seedlings, but the glossy 3D rendering fails the requested drawing style and the  · MCP: The cartoon robot visibly tips its red can and waters the plants, but the malformed boots and pot–leg overlap 
- **D23a** Mountain Morning Opening Title · agent: The correct title and attractive moving sunrise lake scene are present, but the title card lasts too long. · MCP: The clip has an attractive misty sunrise lake scene, but the title is misspelled and remains onscreen too long
- **D23b** Gardener Interview Name Caption · agent: The smiling garden portrait and requested wording are present, but an unwanted logo and garbled banner spoil t · MCP: The clip shows the requested smiling garden portrait with clear, correctly spelled titles, but unwanted speech
- **D23c** Coffee Clip Exact URL Ending · agent: The coffee pour looks appropriate, but the end card has the wrong background and a severely cropped URL. · MCP: The coffee pour and black end card are present, but the URL is garbled and split across two lines, requiring a
- **E24b** Spanish Subtitles For This Clip · agent: The footage and English speech appear preserved, but the Spanish overlay is an unrelated request rather than a · MCP: not-made
- **E24c** Silent Clip Subtitle Check · agent: The agent avoided fabricating speech or presenting subtitles but failed to clearly report that the clip has no · MCP: The agent meets all four must-haves, although the transcript does not substantiate its specific claim that the
- **E24d** Make Those Captions TikTok Bold · agent: not-wired:video-edit, not-made:not-wired · MCP: The output adds large, readable captions and keeps her face visible, but fails to make the video vertical.
- **E25b** Portrait Cut for Two Speakers · agent: The clip is portrait and caption-free, but its crop favours the central man instead of framing the questioner  · MCP: The output keeps a 10-second office scene but fails to make it vertical or centre the speakers individually.
- **E25c** Vertical Speaker Cut With Captions · agent: The centred vertical edit includes the complete spoken wording in short captions, but the captions need strong · MCP: The clip has readable captions below her face, but it remains landscape instead of the requested 9:16 portrait
- **E26b** Cut Out the Boring Parts · agent: not-wired:video-edit, not-made:not-wired · MCP: not-made
- **E28a** Add My Supplied Voiceover · agent: The kitchen-table video has a voice-over and no visible added captions, but the narration omits the required o · MCP: not-made
- **E28b** Write Narration From The Clip · agent: The 10-second office clip has English narration, but it describes the coworkers' movements instead of explaini · MCP: not-made
- **E28c** Fit Narration To Seven Seconds · agent: The seven-second output retains cockpit imagery but fails the audio replacement and includes prohibited dialog · MCP: not-made
- **E29b** Append a Clean End Card · agent: The end card has the correct, readable centered text, but appears too early and cuts short the requested cockp · MCP: not-made
- **E29c** Subtle Handle Watermark Throughout · agent: The correct handle is consistently readable, but it appears as a large bottom-center label with a dark box rat · MCP: not-made
- **F30b** Upbeat Reel Music Default · agent: A 15-second music WAV is delivered, but the supplied transcription does not establish its energy, opening timi · MCP: A 15-second audio file was delivered, but it contains unrelated spoken dialogue, and the supplied evidence doe
- **F31a** Calm Voice Reading Supplied Script · agent: The standalone WAV contains the exact script but runs slightly short; vocal delivery and background silence ca · MCP: not-made
- **F31b** Two Voices Trading Short Lines · agent: The seven-second audio contains only A's two lines and omits both of B's replies, making the requested convers · MCP: not-made
- **F32a** Twenty Second Podcast Intro · agent: A 20-second audio file was delivered, but its reported speech replaces the entire requested introduction with  · MCP: A 20-second audio file was produced, but the spoken introduction has an incorrect opening.
- **F32b** Tiny Forests Two Host Segment · agent: A 100-second audio file has a relevant, conversational opening, but the supplied transcript is incomplete and  · MCP: not-made
- **G34b** Five Tips Five Separate Slides · agent: Five correctly ordered, readable, illustrated slides were delivered, but the requested blue-and-white palette  · MCP: Five readable blue-and-white slides were delivered, but slide 4 repeats the first tip instead of saying 'Set a
- **G34c** One Print Style Across Plants · agent: The four correctly named plants are recognizable, but the set fails the requested consistency in palette, bord · MCP: Three attractive, closely matched plant slides were delivered, but the required opening Monstera slide is miss

