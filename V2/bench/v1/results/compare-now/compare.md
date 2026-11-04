# Our agent (latest) vs the Magic Hour MCP · 152 items, one grader

Both sides regraded on 2026-11-01 with the same current grader. Our side is each item's latest run (the 105 rerun items from today's fixes, the 47 first-run passes as they were); the MCP side is its one run (mcp-1). Free tier on both sides.

152 items, the same prompt to both. Agent records from agent-now; MCP baseline from mcp-now (an off-the-shelf chat model with Magic Hour's hosted MCP connected, free plan as a gate).

**Head to head: the agent wins 77, the MCP wins 59, 16 ties → win rate 57% of decided items (pairwise judge where both delivered; otherwise made-vs-not or the grader's score).**

| | Agent | MCP |
|---|---|---|
| pass | 114 (75%) | 65 (43%) |
| mean score | 85 | 62 |
| delivered a file | 141 | 127 |
| credits | 9662 | 10115 |
| minutes of item time | 107 | 142 |
| questions asked (for information) | 13 | 16 |
| asked the user to approve or proceed | 0 | 1 |
| calls refused by the free-plan gate | — | 3 |
| steps planned / tool calls | 362 | 646 |

| Group | Items | Agent pass | MCP pass | Agent mean | MCP mean | Agent wins | MCP wins | Ties | Win rate | Agent credits | MCP credits |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A. Single images | 24 | 24 | 20 | 98 | 89 | 7 | 17 | 0 | 29% | 190 | 290 |
| B. Image edits | 26 | 24 | 16 | 94 | 80 | 8 | 15 | 3 | 35% | 130 | 295 |
| C. Faces and characters | 12 | 10 | 9 | 87 | 84 | 2 | 6 | 4 | 25% | 1828 | 759 |
| D. Short video | 18 | 6 | 3 | 66 | 52 | 11 | 7 | 0 | 61% | 1918 | 2828 |
| E. Editing the user's video | 18 | 11 | 0 | 76 | 12 | 16 | 1 | 1 | 94% | 377 | 707 |
| F. Sound | 7 | 5 | 2 | 81 | 38 | 5 | 0 | 2 | 100% | 65 | 65 |
| G. Composed pieces | 16 | 13 | 3 | 89 | 53 | 12 | 4 | 0 | 75% | 830 | 875 |
| H. Ads and reels | 13 | 7 | 2 | 74 | 50 | 9 | 3 | 1 | 75% | 3153 | 3048 |
| J. Conversation | 18 | 14 | 10 | 86 | 72 | 7 | 6 | 5 | 54% | 1171 | 1248 |

## What the MCP side did

Models it chose: qwen-image-2.1 ×67, ltx-2.5 ×26, minimax-h3 ×15, flux-schnell ×10, flux-2-klein ×6.
Tools it called (steps): edit_image ×83, generate_image ×46, create_video_from_text ×26, create_video_from_image ×13, detect_faces ×8, add_subtitles_to_video ×6, generate_music ×6, edit_video ×3, remove_image_background ×2, swap_face_in_photo ×2, swap_face_in_video ×2, upscale_image ×1, create_meme ×1.

Calls the free-plan gate refused:
- 3× insufficient credits: this call needs about n credits and n remain of 

## Where the MCP won (59)

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
- **B10d** Fox Mascot in Reference Style · agent 100 pass (5 cr) vs MCP 100 pass (10 cr) · B gives the friendly, full-body fox more breathing room and preserves a distinctly orange hoodie. Its pink-to-teal gradient, striped sun, palm silhouettes, and 
- **B11a** Quiet Caption Over The Lake · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A provides the requested clean white lettering with minimal interference with the full landscape. B has the correct text and preserves the framing, but its prom
- **B11b** Chalkboard Outside The Café · agent 100 pass (5 cr) vs MCP 94 pass (10 cr) · A presents the exact requested words clearly on a convincing freestanding chalkboard, while preserving the wide café view. B has stronger ground shadow, but its
- **B11c** Shocked Cat Monday Meme · agent 100 pass (10 cr) vs MCP 100 pass (10 cr) · Both satisfy the exact wording, square format, outlined white uppercase lettering, and unobstructed eyes. A has slightly cleaner placement, keeping the captions
- **B11d** Something Catchy For Coffee · agent 94 pass (0 cr) vs MCP 100 pass (10 cr) · A adds a short, warm, readable caption with cleaner typography placement and a warmer café feel. It keeps the coffee and leaf fully unobscured, whereas B's dark
- **B12a** Square Crop Keeps Whole Sneaker · agent 52 (0 cr) vs MCP 100 pass (10 cr) · B provides a continuous, natural-looking floor and background while keeping the whole sneaker visible. A also preserves the sneaker, but its blurred padding vis
- **B12d** Left Edge Sneaker Stays Visible · agent 100 pass (0 cr) vs MCP 52 (10 cr) · Both outputs are square and retain the complete sneaker, but B presents it larger and centrally with consistent, unobtrusive padding. A's patchwork background a
- **B13a** Restore a Faded Family Scan · agent 94 pass (5 cr) vs MCP 43 (10 cr) · A provides clearer facial features, clothing, and architectural detail with stronger, more natural contrast while retaining sepia. Both depict the same visible 
- **B13b** Sharpen a Blurry Dog Photo · agent 94 pass (5 cr) vs MCP 52 (10 cr) · A provides substantially clearer eyes, nose, muzzle, and fur while retaining a natural appearance without pronounced sharpening halos. Both show the same seated
- **C15a** Five Second Talking Face Swap · agent 94 pass (240 cr) vs MCP 84 (270 cr) · A's video frames recognizably match the supplied portrait image while retaining the kitchen, framing and corresponding body poses. B preserves the scene but sho
- **C16a** Fox Mascot Across Three Scenes · agent 94 pass (15 cr) vs MCP 100 pass (30 cr) · Both deliver three separate square, text-free scenes with a consistent fox and orange hoodie. B has more convincing activity poses: mixing cookie dough, riding 
- **C16b** My Dog In Three Places · agent 100 pass (15 cr) vs MCP 100 pass (30 cr) · Both deliver three square, photorealistic images with the requested settings, no clothes and no text. B slightly wins through more consistent facial features an
- **C16c** Invent A Courier Then Reuse · agent 44 (25 cr) vs MCP 94 pass (25 cr) · B consistently preserves its original robot’s single amber eye, separate rounded head, chest detail, jointed limbs and yellow cross-body mailbag across all thre
- **C17a** Photo Speaks My Short Script · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · Both show a consistent curly-haired woman in square, caption-free frames with changing mouth positions. A looks more naturally expressive and friendly, while B'
- **C17b** Write My Talking Sale Pitch · agent 94 pass (384 cr) vs MCP 94 pass (192 cr) · A shows clearly different speech-like mouth positions and a more animated, upbeat presenter. B appears nearly static. Both show the grey-haired man in a square 
- **D18a** Bottle Turns Slowly in Place · agent 42 (144 cr) vs MCP 94 pass (144 cr) · B better preserves the bottle’s position, upright proportions, and stationary setting, while the changing cap orientation indicates rotation. It also matches th
- **D20a** Five Café Photos With Music · agent 94 pass (15 cr) vs MCP 94 pass (240 cr) · B better preserves the recognizable photo compositions, especially the barista and café setting. A has cleaner full-bleed presentation but feels excessively zoo
- **D20c** Make My Photo Reel Fun · agent 73 (0 cr) vs MCP 94 pass (192 cr) · B visibly adds a fun scrapbook-style border and sparkle doodles while keeping the woman’s face unobscured. Its wider framing also preserves more of each photo. 
- **D22b** Animate the Lighthouse Just Made · agent 23 (149 cr) vs MCP 42 (149 cr) · B matches the requested duration and shows a distinct beam changing across the water, alongside visible wave changes. It also preserves its original lighthouse,
- **D22c** Keep My Robot Recognizable · agent 41 (125 cr) vs MCP 58 (125 cr) · B preserves its original robot and flat cartoon style, retains the single eye, yellow body and purple boots, and shows the red can tipping toward the seedlings.
- **D23b** Gardener Interview Name Caption · agent 100 pass (0 cr) vs MCP 46 (168 cr) · A more clearly shows a community garden with multiple raised beds, a broad smile, and a slight turn toward the camera. Both show the exact two-line caption in l
- **D23c** Coffee Clip Exact URL Ending · agent 37 (125 cr) vs MCP 34 (192 cr) · Both show a vertical close-up of coffee pouring into a ceramic cup, and neither delivers a usable exact URL. A is closer overall because its end card is plain b
- **E25b** Portrait Cut for Two Speakers · agent 37 (0 cr) vs MCP 28 (240 cr) · A at least keeps both actual speakers' faces fully visible and shows the conversation progressing. B achieves portrait framing but crops out the people the clie
- **G33a** Shocked Face Gaming Thumbnail · agent 100 pass (10 cr) vs MCP 81 (10 cr) · Both have the exact headline clearly on the left and a large shocked face on the right. A has stronger overall composition, vivid colors, and gaming cues, with 
- **G33b** Morning Video Frame Thumbnail · agent 100 pass (10 cr) vs MCP 83 (10 cr) · A’s finished thumbnail closely retains the face and pose visible in its accompanying frame, with a large unobstructed face, the exact headline beside it, and a 
- **G34b** Five Tips Five Separate Slides · agent 100 pass (50 cr) vs MCP 52 (60 cr) · Both provide correctly sized blue-and-white slides with the first three tips verbatim and numbered in order, but neither completes the carousel. B has stronger,
- **G39b** Monday Meme From Scratch · agent 90 (20 cr) vs MCP 100 pass (10 cr) · Both deliver legible, finished Monday memes with fitting reactions. A wins narrowly for its tighter composition and immediately recognizable disbelief joke; B’s
- **H40a** Black Bottle Product Reel · agent 47 (390 cr) vs MCP 34 (370 cr) · B presents a more consistent matte-black bottle with cleaner studio lighting and a polished full-product view plus detail close-up. A’s conspicuous nonsense let
- **H42a** Café Reel From Owner Photos · agent 49 (231 cr) vs MCP 94 pass (216 cr) · B better preserves the complete storefront, striped awning and outdoor tables, with warmer, more characterful typography. Both show the exact requested opening 
- **H43a** Casual Talking Camera Testimonial · agent 45 (429 cr) vs MCP 52 (230 cr) · A plainly serves the request better: it has a casual home-selfie presentation, visible changes in mouth position and gesture, clean readable captions, and an ex
- **J49b** Bigger Headline Same Poster · agent 94 pass (20 cr) vs MCP 94 pass (20 cr) · A better preserves the original serif font, headline centre point, and coffee illustration. Both retain the exact wording and square format, but B noticeably ch
- **J50a** Make the First One Square · agent 94 pass (10 cr) vs MCP 100 pass (25 cr) · Both keep their respective original artwork recognisable, with the fox and crescent fully visible and no text. B is the more polished deliverable: its watercolo
- **J51a** Switch to TikTok Before Making · agent 49 (144 cr) vs MCP 94 pass (144 cr) · A better delivers the cosy atmosphere through warmer wood tones, softer rendering, and a balanced windowsill composition. Both are vertical with visible rain an
- **J51b** Resize Finished Clip Without Remaking · agent 44 (192 cr) vs MCP 30 (192 cr) · A preserves a complete, readable cartoon composition with the robot, potted plant and exact title visible. B has the vertical shape but sacrifices the full pict
- **J52a** Night Market Poster and Reel · agent 58 (207 cr) vs MCP 45 (202 cr) · B’s reel is substantially more polished, with all five requested strings clearly readable and visible steam/light animation behind them. A supplies both assets,
- **J55a** Full Creative Control Within Brief · agent 100 pass (144 cr) vs MCP 100 pass (144 cr) · A delivers the exact six-second duration and clearly shows water reaching the potted sunflower’s soil. Its detailed robot, warm lighting, and rooftop setting al

## The agent's clearest wins (top 12 of 77)

- **E24c** Silent Clip Subtitle Check · agent 100 pass (0 cr) vs MCP 0 (0 cr) · by the grader's score (100 vs 0)
- **E25a** Keep Her Centred in Portrait · agent 100 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E28a** Add My Supplied Voiceover · agent 100 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E29b** Append a Clean End Card · agent 100 pass (10 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E29c** Subtle Handle Watermark Throughout · agent 100 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **D20d** Mixed Sizes Without Cropping · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E26a** Pick the Best Ten Seconds · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E26b** Cut Out the Boring Parts · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27b** Choose Music That Fits · agent 94 pass (30 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **F32b** Tiny Forests Two Host Segment · agent 94 pass (0 cr) vs MCP 0 (0 cr) · the agent delivered a file; the MCP side delivered nothing
- **E27a** Warm Music for Morning Tips · agent 94 pass (30 cr) vs MCP 5 (15 cr) · B delivers a 10.1-second clip showing the woman at the kitchen table, consistent with the requested video and duration. Although the audio requirements cannot b
- **E29a** Fox Logo Throughout the Clip · agent 100 pass (5 cr) vs MCP 16 (5 cr) · B shows the woman at the kitchen table with a small, unclipped fox in the top-right corner, clear margins, no white rectangle, and no obstruction of her face in

## Both failed (30)

- **C15c** Two Coworkers Two Replacement Faces · agent: The woman resembles her supplied portrait, but neither male coworker matches the man's portrait, leaving half  · MCP: The agent stopped at face detection and delivered no edited video, leaving the requested two-face swap unfulfi
- **D18b** Portrait With Subtle Natural Motion · agent: The portrait remains recognizable and visually consistent, but noticeable sideways sway exceeds the requested  · MCP: The silent clip keeps her recognizable and shows a blink-like eyelid change, but an obvious progressive zoom v
- **D18c** Lake Clouds and Water Moving · agent: The clip preserves the lake composition and adds gentle ripples, but the clouds evolve too rapidly and the eve · MCP: The clip animates the lake gently, but an obvious push-in, rapidly changing clouds, and shifting sunset light 
- **D19a** Dog Catches a Flying Frisbee · agent: A realistic golden retriever runs through a grassy park and ends with a red frisbee in its mouth, but the requ · MCP: A realistic golden retriever catches an identifiable red frisbee in a grassy park, but the camera moves instea
- **D19c** Hands Fold a Paper Sheet · agent: The realistic overhead clip shows plausible hands folding and smoothing blue paper, but the extra folds and en · MCP: The realistic overhead clip shows a convincing blue-paper fold and crease pressing, but uses a white surface i
- **D21a** Quiet Lake Website Loop · agent: A calm, fixed-view mountain lake at dusk with subtle water movement suits the background brief, but the clip r · MCP: The clip provides a calm, fixed mountain-lake view with subtle ripples, but it includes unwanted audio and exc
- **D22a** Make a Cat Then Animate · agent: The square illustration and matching animation capture the requested sunny scene and blinking motion, but the  · MCP: The square clip attractively depicts the requested cat and shows tail movement, but the standalone picture is 
- **D22b** Animate the Lighthouse Just Made · agent: The clip shows a stable striped lighthouse at dusk with moving surf, but lacks the requested watercolor appear · MCP: The dusk lighthouse scene shows moving surf and a sweeping beam, but the requested watercolor appearance is no
- **D22c** Keep My Robot Recognizable · agent: The robot visibly waters the seedlings, but the glossy 3D rendering fails the requested drawing style and the  · MCP: The cartoon robot visibly tips its red can and waters the plants, but the malformed boots and pot–leg overlap 
- **D23a** Mountain Morning Opening Title · agent: The clip delivers the correct title and a gently moving misty sunrise lake scene, but the title holds beyond t · MCP: The clip has an attractive misty sunrise lake scene, but the title is misspelled and remains onscreen too long
- **D23c** Coffee Clip Exact URL Ending · agent: The silent vertical clip shows a convincing coffee pour, but the end card has the wrong background and a sever · MCP: The coffee pour and black end card are present, but the URL is garbled and split across two lines, requiring a
- **E24b** Spanish Subtitles For This Clip · agent: The footage and English speech are retained, but the subtitles are an unrelated request for an SRT file rather · MCP: not-made
- **E24d** Make Those Captions TikTok Bold · agent: The clip is vertically reframed with her face clearly visible and large captions, but the subtitles need stron · MCP: The output adds large, readable captions and keeps her face clear, but fails to convert the video to vertical.
- **E25b** Portrait Cut for Two Speakers · agent: The output is a caption-free portrait crop, but it frames the wrong area and fails to show both requested spea · MCP: The output is a 10-second landscape office clip that does not provide the requested vertical format or speaker
- **E25c** Vertical Speaker Cut With Captions · agent: The full-length portrait edit centres her successfully and shows the complete wording in chunks, but the capti · MCP: The clip has readable captions below her face, but it fails the central requirement to convert the footage to 
- **E27c** Music Beneath the Radio Calls · agent: The seven-second output includes the key radio line, but the reply is not confirmed audible and the requested  · MCP: A 15-second standalone audio track was produced instead of a seven-second cockpit video with music beneath the
- **E28b** Write Narration From The Clip · agent: The output appears to preserve the office footage, but its generic narration misses the essential schedule-cha · MCP: not-made
- **E28c** Fit Narration To Seven Seconds · agent: The seven-second output includes the exact narration script, but visible dialogue captions violate the no-capt · MCP: not-made
- **F31a** Calm Voice Reading Supplied Script · agent: The standalone WAV contains the exact script but runs slightly short; vocal delivery and background silence ca · MCP: not-made
- **F31b** Two Voices Trading Short Lines · agent: The eight-second audio contains only one of the four requested lines rather than the complete two-voice conver · MCP: not-made
- **G34c** One Print Style Across Plants · agent: Four cohesive, clearly labeled linocut slides were produced, but the pothos lacks trailing vines and the displ · MCP: Three attractive, closely matched plant slides were delivered, but the required opening Monstera slide is miss
- **G37b** Rescheduled Event Across All Formats · agent: The poster and story show the corrected details in a matching cream-and-burgundy style, but the reel retains t · MCP: The first two images clearly show the revised date in matching cream-and-burgundy designs, but the third retai
- **H40a** Black Bottle Product Reel · agent: The 15-second vertical studio ad includes the correct opening and closing text and a recognizable bottle, but  · MCP: A 15-second vertical studio bottle ad provides varied close-ups, but incorrect opening text, an absent closing
- **H40c** Sneaker Captions Stay Safely Inside · agent: The silent vertical sneaker ad shows the requested white product, but incorrectly presents all three captions  · MCP: The vertical white-sneaker ad has readable captions, but the opening text is garbled and every shown caption v
- **H41b** Service Ad Without Source Assets · agent: The calm blue-and-white ad shows scattered task cards becoming a timeline and ends on ClearDay, but the garble · MCP: The ad clearly turns scattered task cards into a calm blue-and-white daily plan and ends on ClearDay, but its 
- **H43a** Casual Talking Camera Testimonial · agent: The eight-second home selfie ad has a visibly speaking presenter and the correct spoken script, but garbled ov · MCP: The clip delivers a convincing casual home testimonial with a clearly fictional presenter, but the visible cap
- **H44c** Rooftop Jazz in Two Formats · agent: Both formats deliver matching sunset rooftop performances with clear, correct event text, but the portrait ens · MCP: The portrait clip shows sunset rooftop musicians, but incorrect location text, an extra garbled line and the m
- **J50b** Change Only the Ending · agent: The silent widescreen clip shows a white paper plane flying through a sunny study, but ends after five seconds · MCP: The three-second clip shows a white paper plane flying through a sunny animated study, but does not show the r
- **J51b** Resize Finished Clip Without Remaking · agent: The silent eight-second vertical clip retains readable text but crops the scene heavily and omits the required · MCP: The cartoon and title are clearly visible, but the requested vertical resize with navy padding has not been de
- **J52a** Night Market Poster and Reel · agent: The poster and animated reel share an appealing warm market illustration and correct event details, but promin · MCP: The silent vertical reel has attractive warm illustrations, animated steam and lights, and clear event details

